import type { LatLng } from "./types";

/**
 * Detecting the "big road with a median" case from coordinates alone.
 *
 * BeeRoute has no road data — Supabase is the only outside service (CLAUDE.md
 * §2), so there is nothing here that knows a highway from an alley. Everything
 * below is inferred from the shape of the stop cloud, and the thresholds are
 * deliberately strict: when the evidence is weak the caller falls back to the
 * plain shortest-order solver, which is never wrong, only sometimes annoying.
 *
 * What IS reliable at this precision is the kilometre-scale question "do these
 * stops lie along one long axis, and where is each one along it". What is NOT
 * reliable is the ten-metre question "which kerb is this stop on": a median is
 * ~15m wide while an axis fitted to eight points over 5km is good to a few
 * tens of metres. So sides are reported as a best guess guarded by
 * `sidesKnown`, and the caller only ever uses them to break a near-tie.
 */

/** Kilometres in one degree of latitude: 6371 × π / 180. */
const KM_PER_DEG = 111.19492664455873;

/** Fewer stops than this and a "corridor" is just a coincidence. */
export const MIN_CORRIDOR_STOPS = 3;

/** Short hops are city blocks, not a highway worth sweeping. */
export const MIN_CORRIDOR_LENGTH_KM = 1.5;

/**
 * RMS distance of the stops from the fitted centreline.
 *
 * This is the curvature filter. A straight road holds its stops within a kerb
 * width or two of the fitted line; a road that bends throws them far enough
 * off it that the side-of-the-road reading would be curvature rather than
 * which kerb, so the whole corridor is rejected instead.
 */
export const MAX_CORRIDOR_WIDTH_KM = 0.15;

/** Length ÷ width. A genuine road corridor is far longer than it is wide. */
export const MIN_ELONGATION = 8;

/**
 * A stop further behind the start than this means the start sits in the
 * middle of the corridor, not at one end — "out and back" is then meaningless
 * because there are two different outbound directions.
 */
export const BEHIND_TOLERANCE_KM = 0.3;

/** Right at the dividing line, too close to call. */
export const SIDE_DEAD_ZONE_KM = 0.006;

/** The two kerbs must be at least this far apart to count as a median. */
export const MIN_SIDE_SEPARATION_KM = 0.02;

/**
 * How many stops must sit on each kerb before the split is believed.
 *
 * One stop on its own is an outlier, not a side of the road — and an outlier
 * is exactly what a mistyped pin or a building set well back looks like. Two
 * is the smallest number that can corroborate each other.
 */
export const MIN_STOPS_PER_KERB = 2;

/**
 * How far the kerbs must stand out from the leftover scatter.
 *
 * The half-width has to be this many times the residual spread before the
 * two-kerb story beats "one road, pins placed sloppily". At 2 it is roughly
 * the point where the split stops being explicable by noise.
 */
export const MIN_KERB_CONFIDENCE = 2;

/**
 * Fewest stops that can establish two kerbs at all.
 *
 * The model spends three numbers on an intercept, a slope and a half-width.
 * With four stops there is one observation left to check them against, and
 * any four points can be talked into two tidy kerbs. Five leaves two, which
 * is thin but no longer self-fulfilling.
 */
export const MIN_KERB_STOPS = 5;

export type Vec = { x: number; y: number };

export type Corridor = {
  /** Plane origin: the route's start point. */
  origin: LatLng;
  /** Unit vector along the road, pointing away from the start. */
  along: Vec;
  /** Unit vector 90° clockwise from `along` — the right-hand kerb. */
  right: Vec;
  /** Centre of the stop cloud in plane km; side offsets are measured here. */
  centre: Vec;
  /** How far the corridor runs, start included. */
  lengthKm: number;
  /** RMS spread about the centreline. */
  widthKm: number;
  /** Compass bearing of `along`, for display. */
  bearingDeg: number;
  /**
   * The median line, as offset = intercept + slope × along.
   *
   * Not simply offset = 0. The axis is fitted to the stops, and stops sitting
   * on alternating kerbs tilt it by about as much as the kerbs are apart, so
   * the dividing line has to be allowed its own slope to absorb that.
   */
  centreIntercept: number;
  centreSlope: number;
  /** Fitted distance from the median to either kerb. */
  kerbHalfWidthKm: number;
  /**
   * Whether the two kerbs can be told apart at all. False when every stop
   * sits on one side, or when the offsets are a smear rather than two groups.
   */
  sidesKnown: boolean;
};

/**
 * Equirectangular projection in kilometres, good to a fraction of a percent
 * over the tens of kilometres a delivery round covers. x is east, y is north.
 */
export function toPlane(origin: LatLng, p: LatLng): Vec {
  return {
    x:
      (p.lng - origin.lng) *
      KM_PER_DEG *
      Math.cos((origin.lat * Math.PI) / 180),
    y: (p.lat - origin.lat) * KM_PER_DEG,
  };
}

/** Kilometres from the start along the road. Negative means behind it. */
export function alongKm(c: Corridor, p: LatLng): number {
  const v = toPlane(c.origin, p);
  return v.x * c.along.x + v.y * c.along.y;
}

/** Signed distance from the centreline. Positive is the right-hand kerb. */
export function offsetKm(c: Corridor, p: LatLng): number {
  const v = toPlane(c.origin, p);
  return (v.x - c.centre.x) * c.right.x + (v.y - c.centre.y) * c.right.y;
}

/** 1 = right of travel, -1 = left, 0 = no answer worth acting on. */
export function sideOf(c: Corridor, p: LatLng): -1 | 0 | 1 {
  if (!c.sidesKnown) return 0;
  // Offsets are measured along `right`, so anything above the median line is
  // on the right-hand kerb.
  const d =
    offsetKm(c, p) - (c.centreIntercept + c.centreSlope * alongKm(c, p));
  if (d > SIDE_DEAD_ZONE_KM) return 1;
  if (d < -SIDE_DEAD_ZONE_KM) return -1;
  return 0;
}

/**
 * Returns the corridor the stops lie along, or null when they do not lie
 * along one convincingly enough to change the route for.
 */
export function detectCorridor(
  start: LatLng,
  stops: LatLng[],
): Corridor | null {
  if (stops.length < MIN_CORRIDOR_STOPS) return null;

  const pts = stops.map((s) => toPlane(start, s));
  const n = pts.length;
  const centre = {
    x: pts.reduce((sum, p) => sum + p.x, 0) / n,
    y: pts.reduce((sum, p) => sum + p.y, 0) / n,
  };

  // Principal axis of the stop cloud: the direction that explains the most
  // spread. For a 2×2 covariance [[sxx, sxy], [sxy, syy]] it closes to one
  // atan2 — no iterative eigen-solver needed.
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const p of pts) {
    const dx = p.x - centre.x;
    const dy = p.y - centre.y;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  let along: Vec = { x: Math.cos(theta), y: Math.sin(theta) };

  // The axis comes out unsigned. Point it away from the start, which is the
  // direction the rider sets off in.
  const reach = pts.reduce((sum, p) => sum + p.x * along.x + p.y * along.y, 0);
  if (reach < 0) along = { x: -along.x, y: -along.y };

  const right: Vec = { x: along.y, y: -along.x };

  // Distances along the road, measured from the start (which is at t = 0).
  const ts = pts.map((p) => p.x * along.x + p.y * along.y);
  if (ts.some((t) => t < -BEHIND_TOLERANCE_KM)) return null;

  const lengthKm = Math.max(...ts, 0) - Math.min(...ts, 0);
  if (lengthKm < MIN_CORRIDOR_LENGTH_KM) return null;

  const offsets = pts.map(
    (p) => (p.x - centre.x) * right.x + (p.y - centre.y) * right.y,
  );
  const widthKm = Math.sqrt(offsets.reduce((sum, d) => sum + d * d, 0) / n);
  if (widthKm > MAX_CORRIDOR_WIDTH_KM) return null;
  if (lengthKm < MIN_ELONGATION * widthKm) return null;

  const bearingDeg =
    ((Math.atan2(along.x, along.y) * 180) / Math.PI + 360) % 360;

  const kerbs = fitKerbs(ts, offsets);

  return {
    origin: start,
    along,
    right,
    centre,
    lengthKm,
    widthKm,
    bearingDeg,
    centreIntercept: kerbs?.intercept ?? 0,
    centreSlope: kerbs?.slope ?? 0,
    kerbHalfWidthKm: kerbs?.halfWidth ?? 0,
    sidesKnown: kerbs !== null,
  };
}

/**
 * Decides whether the stops are better explained by one road or by a road
 * with two kerbs, and fits the median if so.
 *
 * The model is `offset = intercept + slope × along + halfWidth × side`: a
 * centreline free to tilt, plus a constant step onto one kerb or the other.
 * Fitting the tilt at the same time as the kerbs is the whole point. The axis
 * comes from a fit to the stops themselves, and stops that alternate between
 * kerbs drag it over by roughly as much as the kerbs are apart — measure the
 * offsets against an untilted line and the real kerbs smear into each other.
 *
 * Sides and coefficients are solved by alternating between them, each pass
 * reassigning every stop to the nearer kerb. It settles in two or three
 * passes on real input and is capped regardless.
 *
 * Returns null unless the result is worth believing: a median at least
 * MIN_SIDE_SEPARATION_KM wide, standing MIN_KERB_CONFIDENCE times clear of
 * the leftover scatter, with MIN_STOPS_PER_KERB stops on each side.
 */
function fitKerbs(
  ts: number[],
  offsets: number[],
): { intercept: number; slope: number; halfWidth: number } | null {
  const n = ts.length;
  if (n < MIN_KERB_STOPS) return null;

  // Start from which side of a plain straight line each stop falls.
  const plain = fitLine(ts, offsets);
  if (!plain) return null;
  let sides = offsets.map((y, i) =>
    y - (plain.intercept + plain.slope * ts[i]) >= 0 ? 1 : -1,
  );

  let fit: { intercept: number; slope: number; halfWidth: number } | null =
    null;

  for (let pass = 0; pass < 8; pass++) {
    fit = fitLineWithStep(ts, offsets, sides);
    if (!fit) return null;

    const next = offsets.map((y, i) =>
      y - (fit!.intercept + fit!.slope * ts[i]) >= 0 ? 1 : -1,
    );
    if (next.every((v, i) => v === sides[i])) break;
    sides = next;
  }

  if (!fit) return null;

  const halfWidth = Math.abs(fit.halfWidth);
  if (2 * halfWidth < MIN_SIDE_SEPARATION_KM) return null;

  const right = sides.filter((v) => v > 0).length;
  if (right < MIN_STOPS_PER_KERB || n - right < MIN_STOPS_PER_KERB) return null;

  // What the two-kerb model still fails to explain. If the kerbs do not stand
  // clear of it, they are scatter with a story attached.
  // Divided by the degrees of freedom left, not by n: three of the stops
  // have been spent fitting the model and cannot also vouch for it.
  const residual = Math.sqrt(
    offsets.reduce((sum, y, i) => {
      const predicted =
        fit!.intercept + fit!.slope * ts[i] + fit!.halfWidth * sides[i];
      return sum + (y - predicted) ** 2;
    }, 0) /
      (n - 3),
  );
  if (halfWidth < MIN_KERB_CONFIDENCE * residual) return null;

  return { intercept: fit.intercept, slope: fit.slope, halfWidth };
}

/** Ordinary least squares for y = intercept + slope × t. */
function fitLine(
  ts: number[],
  ys: number[],
): { intercept: number; slope: number } | null {
  const n = ts.length;
  const meanT = ts.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let covariance = 0;
  let variance = 0;
  for (let i = 0; i < n; i++) {
    covariance += (ts[i] - meanT) * (ys[i] - meanY);
    variance += (ts[i] - meanT) ** 2;
  }
  if (variance === 0) return null;

  const slope = covariance / variance;
  return { intercept: meanY - slope * meanT, slope };
}

/**
 * Least squares for y = intercept + slope × t + halfWidth × side, with side
 * fixed at ±1. Three normal equations, solved by elimination — small enough
 * that pulling in a matrix library would cost more than it saves.
 */
function fitLineWithStep(
  ts: number[],
  ys: number[],
  sides: number[],
): { intercept: number; slope: number; halfWidth: number } | null {
  const n = ts.length;
  let sumT = 0;
  let sumS = 0;
  let sumY = 0;
  let sumTT = 0;
  let sumTS = 0;
  let sumTY = 0;
  let sumSY = 0;

  for (let i = 0; i < n; i++) {
    sumT += ts[i];
    sumS += sides[i];
    sumY += ys[i];
    sumTT += ts[i] * ts[i];
    sumTS += ts[i] * sides[i];
    sumTY += ts[i] * ys[i];
    sumSY += sides[i] * ys[i];
  }

  // side² is 1 for every row, so the last diagonal entry is simply n.
  const a = [
    [n, sumT, sumS],
    [sumT, sumTT, sumTS],
    [sumS, sumTS, n],
  ];
  const b = [sumY, sumTY, sumSY];

  const solved = solve3(a, b);
  if (!solved) return null;
  return { intercept: solved[0], slope: solved[1], halfWidth: solved[2] };
}

/** Cramer's rule on a 3×3 system. Null when it is too near singular. */
function solve3(a: number[][], b: number[]): [number, number, number] | null {
  const det = det3(a);
  if (Math.abs(det) < 1e-12) return null;

  const column = (j: number) =>
    det3(a.map((row, i) => row.map((v, k) => (k === j ? b[i] : v)))) / det;

  return [column(0), column(1), column(2)];
}

function det3(m: number[][]): number {
  return (
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  );
}
