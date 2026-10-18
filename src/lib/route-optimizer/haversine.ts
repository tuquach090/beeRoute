import type { LatLng } from "./types";

const EARTH_RADIUS_KM = 6371;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Great-circle distance in km.
 *
 * This is straight-line distance, NOT road distance. It is only good enough to
 * decide the ORDER of stops; Google Maps computes the real route afterwards.
 */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Distances between every pair of points, computed once.
 *
 * Index 0 is the start, 1..n are the stops, n+1 is the end. Both solvers read
 * the matrix instead of recomputing haversine inside their loops.
 */
export function buildDistanceMatrix(points: LatLng[]): number[][] {
  const n = points.length;
  const matrix: number[][] = Array.from({ length: n }, () =>
    new Array<number>(n).fill(0),
  );

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = haversineKm(points[i], points[j]);
      matrix[i][j] = d;
      matrix[j][i] = d;
    }
  }

  return matrix;
}
