import { buildDistanceMatrix } from "./haversine";
import { alongKm, detectCorridor, sideOf, type Corridor } from "./corridor";
import {
  EXACT_MAX_STOPS,
  type OptimizeInput,
  type OptimizeResult,
  type Stop,
} from "./types";

/**
 * What one U-turn is worth in kilometres of detour.
 *
 * On a divided road, doubling back means riding to the next median opening
 * and riding the same stretch again. In Saigon those openings sit roughly
 * 500–700m apart, so a reversal costs about a kilometre of riding plus the
 * lights — which is why the rider asked for this rule even though it adds
 * straight-line distance. Raise it to sweep harder, drop it to 0 to get the
 * old shortest-distance behaviour back.
 */
export const U_TURN_PENALTY_KM = 1.2;

/**
 * Nudge for serving the right-hand kerb on the way out, as right-hand traffic
 * wants. Deliberately small: the side a stop sits on is the least certain
 * thing corridor.ts reports, so this may only break a near-tie, never
 * outweigh a real detour.
 */
export const WRONG_SIDE_PENALTY_KM = 0.2;

/**
 * Two stops within this distance along the corridor count as level with each
 * other. Without it, float noise between neighbouring shops would register as
 * a direction reversal.
 */
const LEVEL_TOLERANCE_KM = 0.01;

/**
 * Orders the destinations so the rider covers them in the least awkward way.
 *
 * The objective is straight-line distance plus a penalty for doubling back
 * along a road corridor (CLAUDE.md §6.2). Where the stops do not form a
 * corridor the penalty is zero and this is exactly the old shortest-path
 * solver; where they do, it produces the "serve the right-hand kerb out to
 * the far end, then collect the other side coming back" shape.
 *
 * The start is fixed. The end is optional: without one this is an open path
 * that simply stops at the last delivery.
 */
export function optimizeRoute(input: OptimizeInput): OptimizeResult {
  const { start, stops } = input;
  const end = input.end ?? null;

  if (stops.length === 0) {
    throw new Error("Phải có ít nhất một điểm đến");
  }

  const ids = new Set(stops.map((s) => s.id));
  if (ids.size !== stops.length) {
    throw new Error("Các điểm đến bị trùng id");
  }

  // Matrix layout: 0 = start, 1..n = stops, and n + 1 = end when there is one.
  const n = stops.length;
  const points = [start, ...stops.map((s) => s.location)];
  if (end) points.push(end);

  const matrix = buildDistanceMatrix(points);
  const START = 0;
  const END = end ? n + 1 : null;

  const corridor = detectCorridor(
    start,
    stops.map((s) => s.location),
  );
  const scoring = makeScoring(matrix, START, END, corridor, stops);

  const exact = n <= EXACT_MAX_STOPS;
  const order = exact
    ? solveExact(n, matrix, START, scoring.score)
    : solveHeuristic(n, matrix, START, scoring);

  const orderedStops: Stop[] = order.map((i) => stops[i - 1]);
  const legsKm = legsFor(order, matrix, START, END);

  return {
    orderedStops,
    legsKm,
    totalKm: legsKm.reduce((sum, km) => sum + km, 0),
    method: exact ? "exact" : "heuristic",
    corridor: corridor && {
      lengthKm: corridor.lengthKm,
      bearingDeg: corridor.bearingDeg,
      uTurns: scoring.uTurns(order),
      sidesKnown: corridor.sidesKnown,
    },
  };
}

/** Distance of each hop along start → …order… → end. */
function legsFor(
  order: number[],
  matrix: number[][],
  START: number,
  END: number | null,
): number[] {
  const legs: number[] = [];
  let prev = START;
  for (const node of order) {
    legs.push(matrix[prev][node]);
    prev = node;
  }
  if (END !== null) legs.push(matrix[prev][END]);
  return legs;
}

type Scoring = {
  /** The full objective: kilometres plus corridor penalties. */
  score: (order: number[]) => number;
  /** Pure straight-line distance, which is what the result reports. */
  distance: (order: number[]) => number;
  uTurns: (order: number[]) => number;
  /** The out-and-back order, or null when there is no corridor. */
  sweep: () => number[] | null;
};

function makeScoring(
  matrix: number[][],
  START: number,
  END: number | null,
  corridor: Corridor | null,
  stops: Stop[],
): Scoring {
  const distance = (order: number[]) => {
    let total = 0;
    let prev = START;
    for (const node of order) {
      total += matrix[prev][node];
      prev = node;
    }
    return total + (END === null ? 0 : matrix[prev][END]);
  };

  if (!corridor) {
    return {
      score: distance,
      distance,
      uTurns: () => 0,
      sweep: () => null,
    };
  }

  // Indexed to match the matrix: slot 0 is the start, which sits at the
  // corridor's origin and so is 0 km along it by construction.
  const along = [0, ...stops.map((s) => alongKm(corridor, s.location))];
  const side = [0, ...stops.map((s) => sideOf(corridor, s.location))];

  /**
   * One pass down the route, counting the turnarounds it forces.
   *
   * The rule that makes this work: on a divided road the kerb a stop sits on
   * decides which way you have to be driving to reach it. A right-hand-kerb
   * stop can only be served heading one way, a left-hand one only heading the
   * other. So every change of kerb is a turnaround — even when the route is
   * still marching steadily down the road, which is exactly the zig-zag the
   * plain shortest-distance order produces and the rider wanted rid of.
   *
   * Overshooting counts too: two stops on the same kerb, the second one
   * behind the first, means riding past and doubling back.
   *
   * Where corridor.ts could not tell the kerbs apart, every side reads 0 and
   * this degrades to counting plain direction reversals.
   */
  function walk(order: number[]) {
    let turnarounds = 0;
    let wrongSide = 0;
    /** Which way along the corridor we are currently driving. */
    let heading = 0;
    let previousAlong = along[START];

    for (const node of order) {
      const delta = along[node] - previousAlong;
      const moved = Math.abs(delta) < LEVEL_TOLERANCE_KM ? 0 : Math.sign(delta);
      // A known kerb dictates the heading; otherwise take the heading from
      // the direction we actually travelled to get here.
      const required = side[node] !== 0 ? side[node] : moved;

      if (required !== 0) {
        if (heading !== 0 && required !== heading) {
          turnarounds++;
        } else if (heading !== 0 && moved !== 0 && moved !== heading) {
          turnarounds++;
        }
        heading = required;
      }

      // Serving the left kerb before the first turnaround means setting off
      // down the wrong side of the road.
      if (turnarounds === 0 && side[node] === -1) wrongSide++;
      previousAlong = along[node];
    }

    return { turnarounds, wrongSide };
  }

  return {
    distance,
    uTurns: (order) => walk(order).turnarounds,
    score: (order) => {
      const { turnarounds, wrongSide } = walk(order);
      return (
        distance(order) +
        turnarounds * U_TURN_PENALTY_KM +
        wrongSide * WRONG_SIDE_PENALTY_KM
      );
    },
    sweep: () => {
      const byDistance = stops
        .map((_, i) => i + 1)
        .sort((a, b) => along[a] - along[b]);
      // Out along the right-hand kerb to the far end, then back down the
      // other side. Stops too near the centreline to place go on the way out,
      // since nothing has to be crossed to reach them.
      const outbound = byDistance.filter((i) => side[i] >= 0);
      const back = byDistance.filter((i) => side[i] === -1).reverse();
      return [...outbound, ...back];
    },
  };
}

/**
 * Every permutation, scored with the full objective.
 *
 * Branch-and-bound still prunes on distance alone: the penalties are never
 * negative, so distance stays a valid lower bound on the score.
 */
function solveExact(
  n: number,
  matrix: number[][],
  START: number,
  score: (order: number[]) => number,
): number[] {
  const nodes = Array.from({ length: n }, (_, i) => i + 1);
  let best: number[] = nodes.slice();
  let bestCost = score(best);

  const current: number[] = [];
  const used = new Array<boolean>(n).fill(false);

  function recurse(distanceSoFar: number, prev: number) {
    if (distanceSoFar >= bestCost) return;

    if (current.length === n) {
      const total = score(current);
      if (total < bestCost) {
        bestCost = total;
        best = current.slice();
      }
      return;
    }

    for (let k = 0; k < n; k++) {
      if (used[k]) continue;
      const node = nodes[k];
      used[k] = true;
      current.push(node);
      recurse(distanceSoFar + matrix[prev][node], node);
      current.pop();
      used[k] = false;
    }
  }

  recurse(0, START);
  return best;
}

/**
 * Nearest Neighbour for a starting order — "gần trước, xa sau" — then 2-opt.
 * When the stops form a corridor the sweep is tried as a second seed, because
 * 2-opt from a zig-zag rarely finds its way to the out-and-back shape.
 */
function solveHeuristic(
  n: number,
  matrix: number[][],
  START: number,
  scoring: Scoring,
): number[] {
  const seeds = [nearestNeighbour(n, matrix, START)];
  const sweep = scoring.sweep();
  if (sweep) seeds.push(sweep);

  return seeds
    .map((seed) => twoOpt(seed, scoring.score))
    .reduce((best, candidate) =>
      scoring.score(candidate) < scoring.score(best) ? candidate : best,
    );
}

function nearestNeighbour(
  n: number,
  matrix: number[][],
  START: number,
): number[] {
  const remaining = new Set(Array.from({ length: n }, (_, i) => i + 1));
  const order: number[] = [];
  let current = START;

  while (remaining.size > 0) {
    let nearest = -1;
    let nearestDist = Infinity;
    for (const node of remaining) {
      const d = matrix[current][node];
      if (d < nearestDist) {
        nearestDist = d;
        nearest = node;
      }
    }
    order.push(nearest);
    remaining.delete(nearest);
    current = nearest;
  }

  return order;
}

/**
 * Reverses each candidate segment and keeps the reversal when it improves the
 * score. Repeats until a full sweep finds no improvement.
 *
 * This scores the whole route each time rather than comparing the two
 * boundary edges. The shortcut only holds for a cost made of independent
 * edges, and the U-turn penalty depends on the order as a whole.
 */
function twoOpt(order: number[], score: (order: number[]) => number): number[] {
  let route = order.slice();
  let best = score(route);
  const n = route.length;
  // Guards against a pathological input looping for a long time; real inputs
  // settle in a handful of passes.
  const MAX_PASSES = 100;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let improved = false;

    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const candidate = route.slice();
        let lo = i;
        let hi = j;
        while (lo < hi) {
          [candidate[lo], candidate[hi]] = [candidate[hi], candidate[lo]];
          lo++;
          hi--;
        }

        const cost = score(candidate);
        if (cost < best - 1e-12) {
          route = candidate;
          best = cost;
          improved = true;
        }
      }
    }

    if (!improved) break;
  }

  return route;
}
