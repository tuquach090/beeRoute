import { buildDistanceMatrix } from "./haversine";
import {
  EXACT_MAX_STOPS,
  type OptimizeInput,
  type OptimizeResult,
  type Stop,
} from "./types";

/**
 * Orders the destinations so the total straight-line distance from start to
 * end is as short as possible.
 *
 * Start and end are fixed, so this is an open path problem, not a tour: only
 * the middle is permuted.
 */
export function optimizeRoute(input: OptimizeInput): OptimizeResult {
  const { start, stops, end } = input;

  if (stops.length === 0) {
    throw new Error("Phải có ít nhất một điểm đến");
  }

  const ids = new Set(stops.map((s) => s.id));
  if (ids.size !== stops.length) {
    throw new Error("Các điểm đến bị trùng id");
  }

  // Matrix layout: 0 = start, 1..n = stops, n + 1 = end.
  const n = stops.length;
  const matrix = buildDistanceMatrix([
    start,
    ...stops.map((s) => s.location),
    end,
  ]);
  const START = 0;
  const END = n + 1;

  const order =
    n <= EXACT_MAX_STOPS
      ? solveExact(n, matrix, START, END)
      : solveHeuristic(n, matrix, START, END);

  const orderedStops: Stop[] = order.map((i) => stops[i - 1]);
  const legsKm = legsFor(order, matrix, START, END);

  return {
    orderedStops,
    legsKm,
    totalKm: legsKm.reduce((sum, km) => sum + km, 0),
    method: n <= EXACT_MAX_STOPS ? "exact" : "heuristic",
  };
}

/** Distance of each hop along start → …order… → end. */
function legsFor(
  order: number[],
  matrix: number[][],
  START: number,
  END: number,
): number[] {
  const legs: number[] = [];
  let prev = START;
  for (const node of order) {
    legs.push(matrix[prev][node]);
    prev = node;
  }
  legs.push(matrix[prev][END]);
  return legs;
}

function costOf(
  order: number[],
  matrix: number[][],
  START: number,
  END: number,
): number {
  let total = 0;
  let prev = START;
  for (const node of order) {
    total += matrix[prev][node];
    prev = node;
  }
  return total + matrix[prev][END];
}

/** Every permutation. Exact, and fast enough up to EXACT_MAX_STOPS. */
function solveExact(
  n: number,
  matrix: number[][],
  START: number,
  END: number,
): number[] {
  const nodes = Array.from({ length: n }, (_, i) => i + 1);
  let best: number[] = nodes.slice();
  let bestCost = costOf(best, matrix, START, END);

  const current: number[] = [];
  const used = new Array<boolean>(n + 1).fill(false);

  // Depth-first over permutations, abandoning any prefix that already costs
  // more than the best complete route found so far.
  function recurse(costSoFar: number, prev: number) {
    if (costSoFar >= bestCost) return;

    if (current.length === n) {
      const total = costSoFar + matrix[prev][END];
      if (total < bestCost) {
        bestCost = total;
        best = current.slice();
      }
      return;
    }

    for (let k = 0; k < n; k++) {
      const node = nodes[k];
      if (used[k]) continue;
      used[k] = true;
      current.push(node);
      recurse(costSoFar + matrix[prev][node], node);
      current.pop();
      used[k] = false;
    }
  }

  recurse(0, START);
  return best;
}

/**
 * Nearest Neighbour for a starting order — "gần trước, xa sau" — then 2-opt
 * until no swap improves it.
 */
function solveHeuristic(
  n: number,
  matrix: number[][],
  START: number,
  END: number,
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

  return twoOpt(order, matrix, START, END);
}

/**
 * Reverses each candidate segment and keeps the reversal when it shortens the
 * path. Repeats until a full sweep finds no improvement.
 */
function twoOpt(
  order: number[],
  matrix: number[][],
  START: number,
  END: number,
): number[] {
  const route = order.slice();
  const n = route.length;
  // Guards against a pathological input looping for a long time; real inputs
  // settle in a handful of passes.
  const MAX_PASSES = 100;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let improved = false;

    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        // Nodes bounding the segment being reversed.
        const before = i === 0 ? START : route[i - 1];
        const after = j === n - 1 ? END : route[j + 1];

        const current = matrix[before][route[i]] + matrix[route[j]][after];
        const swapped = matrix[before][route[j]] + matrix[route[i]][after];

        // Interior distances are unchanged by a reversal, so comparing just
        // the two boundary edges is enough.
        if (swapped < current - 1e-12) {
          let lo = i;
          let hi = j;
          while (lo < hi) {
            [route[lo], route[hi]] = [route[hi], route[lo]];
            lo++;
            hi--;
          }
          improved = true;
        }
      }
    }

    if (!improved) break;
  }

  return route;
}
