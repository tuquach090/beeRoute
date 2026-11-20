import { buildDistanceMatrix } from "./haversine";
import type { OptimizeInput, OptimizeResult, Stop } from "./types";

/**
 * Orders the destinations nearest-first: from the start go to the closest
 * stop, from there to the closest stop not yet visited, and so on
 * (CLAUDE.md §6.2).
 *
 * This is deliberately NOT a shortest-route search. The rider asked for this
 * rule on 20/11/2026 after the earlier solver — exhaustive search plus a
 * right-hand-kerb penalty — kept producing orders that were shorter on paper
 * but not how anyone rides: straight out to the furthest stop, delivering on
 * the way back along the wrong side of the road. Each step here only looks
 * one hop ahead, which is exactly what makes the result predictable from the
 * saddle. Do not "improve" it with 2-opt or a full search without asking.
 *
 * Distances are straight-line (haversine), used only to rank. Equal distances
 * keep the order the stops were given in, so the result is deterministic.
 *
 * The start is fixed. The end is optional and only adds a final leg: it does
 * not pull the order towards itself.
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

  const order = nearestNeighbour(n, matrix, START);
  const orderedStops: Stop[] = order.map((i) => stops[i - 1]);
  const legsKm = legsFor(order, matrix, START, END);

  return {
    orderedStops,
    legsKm,
    totalKm: legsKm.reduce((sum, km) => sum + km, 0),
    method: "heuristic",
  };
}

function nearestNeighbour(
  n: number,
  matrix: number[][],
  START: number,
): number[] {
  const visited = new Array<boolean>(n + 1).fill(false);
  const order: number[] = [];
  let current = START;

  for (let step = 0; step < n; step++) {
    let nearest = -1;
    let nearestKm = Infinity;
    // Ascending index plus a strict `<` is what makes ties go to the stop
    // listed first.
    for (let node = 1; node <= n; node++) {
      if (visited[node]) continue;
      if (matrix[current][node] < nearestKm) {
        nearestKm = matrix[current][node];
        nearest = node;
      }
    }
    visited[nearest] = true;
    order.push(nearest);
    current = nearest;
  }

  return order;
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
