import { describe, expect, it } from "vitest";
import {
  MIN_CORRIDOR_LENGTH_KM,
  alongKm,
  detectCorridor,
  offsetKm,
  sideOf,
  toPlane,
} from "./corridor";
import type { LatLng } from "./types";

/**
 * A synthetic divided road running due east from the start, with stops set
 * roughly 55 m off the centreline on each kerb. Driving east, the south kerb
 * is the right-hand one.
 */
const START: LatLng = { lat: 10.77, lng: 106.7 };
const CENTRE_LAT = 10.77;
const KERB = 0.0005; // ≈ 55 m

const southKerb = (lng: number): LatLng => ({ lat: CENTRE_LAT - KERB, lng });
const northKerb = (lng: number): LatLng => ({ lat: CENTRE_LAT + KERB, lng });

/** Compass bearings wrap, so 359.4° and 0.4° are one degree apart. */
function bearingGap(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

describe("toPlane", () => {
  it("puts the origin at zero", () => {
    expect(toPlane(START, START)).toEqual({ x: 0, y: 0 });
  });

  it("measures north as +y and east as +x, in kilometres", () => {
    const north = toPlane(START, { lat: 10.78, lng: 106.7 });
    expect(north.x).toBeCloseTo(0, 9);
    expect(north.y).toBeCloseTo(1.112, 2);

    const east = toPlane(START, { lat: 10.77, lng: 106.71 });
    expect(east.y).toBeCloseTo(0, 9);
    // Shrunk by cos(latitude), so a little under the 1.112 km a degree of
    // latitude buys.
    expect(east.x).toBeCloseTo(1.093, 2);
  });
});

describe("detectCorridor — when it declines", () => {
  it("needs more than two stops", () => {
    expect(
      detectCorridor(START, [southKerb(106.72), northKerb(106.76)]),
    ).toBeNull();
  });

  it("rejects a scattered cloud", () => {
    const scattered = [
      { lat: 10.78, lng: 106.72 },
      { lat: 10.75, lng: 106.74 },
      { lat: 10.8, lng: 106.69 },
      { lat: 10.76, lng: 106.78 },
    ];
    expect(detectCorridor(START, scattered)).toBeNull();
  });

  it("rejects a corridor shorter than the threshold", () => {
    // Three stops in a tidy line, but only a few hundred metres of it.
    const short = [106.701, 106.702, 106.703].map(southKerb);
    const corridor = detectCorridor(START, short);
    expect(corridor).toBeNull();
    expect(MIN_CORRIDOR_LENGTH_KM).toBeGreaterThan(0.4);
  });

  it("rejects a road that bends, where sides would read as curvature", () => {
    // A quarter arc: the stops are spread out, but nothing like a straight
    // road, so the perpendicular offsets mean nothing.
    const arc = Array.from({ length: 6 }, (_, i) => {
      const angle = (i / 5) * (Math.PI / 2);
      return {
        lat: CENTRE_LAT + 0.05 * (1 - Math.cos(angle)),
        lng: 106.7 + 0.05 * Math.sin(angle),
      };
    });
    expect(detectCorridor(START, arc)).toBeNull();
  });

  it("rejects a start sitting in the middle of the corridor", () => {
    // Half the stops are behind the rider, so there is no single way "out".
    const straddling = [
      southKerb(106.66),
      southKerb(106.67),
      southKerb(106.74),
      southKerb(106.75),
    ];
    expect(detectCorridor(START, straddling)).toBeNull();
  });
});

describe("detectCorridor — a divided road", () => {
  const stops = [
    southKerb(106.72),
    northKerb(106.74),
    southKerb(106.76),
    northKerb(106.78),
    southKerb(106.8),
    northKerb(106.82),
  ];
  const corridor = detectCorridor(START, stops)!;

  it("finds it", () => {
    expect(corridor).not.toBeNull();
    expect(corridor.sidesKnown).toBe(true);
  });

  it("points along the road, away from the start", () => {
    // Due east, give or take the tilt the fit picks up from having to run a
    // single line through stops on both kerbs.
    expect(bearingGap(corridor.bearingDeg, 90)).toBeLessThan(1.5);
    for (const s of stops) expect(alongKm(corridor, s)).toBeGreaterThan(0);
  });

  it("still puts every stop on the kerb it belongs to", () => {
    // The fitted axis tilts by about half a degree here, which over nine
    // kilometres swings the far ends by more than the kerbs are apart. The
    // classification has to survive that, since it is the whole point.
    expect(stops.map((s) => sideOf(corridor, s))).toEqual([
      1, -1, 1, -1, 1, -1,
    ]);
  });

  it("orders stops by how far down the road they are", () => {
    const distances = stops.map((s) => alongKm(corridor, s));
    for (let i = 1; i < distances.length; i++) {
      expect(distances[i]).toBeGreaterThan(distances[i - 1]);
    }
  });

  it("calls the south kerb the right-hand one when driving east", () => {
    expect(sideOf(corridor, southKerb(106.73))).toBe(1);
    expect(sideOf(corridor, northKerb(106.73))).toBe(-1);
  });

  it("measures the two kerbs about 110 m apart", () => {
    const gap =
      offsetKm(corridor, southKerb(106.77)) -
      offsetKm(corridor, northKerb(106.77));
    expect(gap).toBeCloseTo(0.111, 2);
    // The fit recovers the same figure as a half-width either side.
    expect(corridor.kerbHalfWidthKm * 2).toBeCloseTo(0.111, 2);
  });

  it("reports a width of roughly one kerb offset, not the road length", () => {
    // One kerb offset, near enough — not the 9 km the road runs for.
    expect(corridor.widthKm).toBeGreaterThan(0.03);
    expect(corridor.widthKm).toBeLessThan(0.07);
    expect(corridor.lengthKm).toBeGreaterThan(8);
  });
});

describe("detectCorridor — one-sided service road", () => {
  it("finds the corridor but admits it cannot tell the kerbs apart", () => {
    // Every stop on the same kerb: there is no median to cross, so "which
    // side" is a question with no useful answer.
    const stops = [106.72, 106.74, 106.76, 106.78, 106.8, 106.82].map(
      southKerb,
    );
    const corridor = detectCorridor(START, stops)!;

    expect(corridor).not.toBeNull();
    expect(corridor.sidesKnown).toBe(false);
    for (const s of stops) expect(sideOf(corridor, s)).toBe(0);
  });
});

describe("a corridor running the other way", () => {
  it("calls the east kerb the right-hand one when driving north", () => {
    const start: LatLng = { lat: 10.7, lng: 106.7 };
    const stops = [
      { lat: 10.72, lng: 106.7005 },
      { lat: 10.74, lng: 106.6995 },
      { lat: 10.76, lng: 106.7005 },
      { lat: 10.78, lng: 106.6995 },
      { lat: 10.8, lng: 106.7005 },
      { lat: 10.82, lng: 106.6995 },
    ];
    const corridor = detectCorridor(start, stops)!;

    expect(bearingGap(corridor.bearingDeg, 0)).toBeLessThan(1.5);
    expect(sideOf(corridor, { lat: 10.75, lng: 106.7005 })).toBe(1);
    expect(sideOf(corridor, { lat: 10.75, lng: 106.6995 })).toBe(-1);
  });
});

describe("detectCorridor — telling a median from noise", () => {
  /**
   * Five stops typed out along Xa lộ Hà Nội with no median in the data: they
   * scatter about twenty metres either side of the fitted line simply because
   * that is how accurately a road gets traced by hand.
   *
   * The first version of this split the offsets at zero and counted signs,
   * which called the single stop furthest off the line "the other kerb". That
   * is noise being handed to the optimiser as fact.
   */
  const alongHighway = [
    { lat: 10.7995, lng: 106.7352 },
    { lat: 10.8064, lng: 106.7436 },
    { lat: 10.8142, lng: 106.7521 },
    { lat: 10.822, lng: 106.7608 },
    { lat: 10.8297, lng: 106.7694 },
  ];

  it("finds the corridor but refuses to invent kerbs", () => {
    const corridor = detectCorridor(
      { lat: 10.7872, lng: 106.7215 },
      alongHighway,
    )!;

    expect(corridor).not.toBeNull();
    expect(corridor.sidesKnown).toBe(false);
    expect(corridor.kerbHalfWidthKm).toBe(0);
    for (const p of alongHighway) expect(sideOf(corridor, p)).toBe(0);
  });

  it("does believe the same road once the stops really do sit on two kerbs", () => {
    // Same line, but each stop pushed 60 m onto one carriageway or the other
    // — the sort of gap a median plus two setbacks actually leaves. That has
    // to clear the ~20 m of scatter already in these coordinates, so the
    // margin here is the real thing being tested.
    const shifted = [...alongHighway, { lat: 10.8375, lng: 106.778 }].map(
      (p, i) => {
        const metres = i % 2 === 0 ? 60 : -60;
        return {
          lat: p.lat - (metres / 111195) * Math.cos(0.84),
          lng: p.lng + (metres / 111195) * Math.sin(0.84),
        };
      },
    );
    const corridor = detectCorridor({ lat: 10.7872, lng: 106.7215 }, shifted)!;

    expect(corridor.sidesKnown).toBe(true);
    expect(shifted.map((p) => sideOf(corridor, p))).toEqual([
      1, -1, 1, -1, 1, -1,
    ]);
  });

  it("is not fooled by a 35 m shift buried in 20 m of scatter", () => {
    // The same trick at half the offset, where the kerbs no longer stand
    // clear of the noise already in the coordinates. Saying "cannot tell" is
    // the right answer; guessing would reorder the round on a coin toss.
    const faint = alongHighway.map((p, i) => {
      const metres = i % 2 === 0 ? 35 : -35;
      return {
        lat: p.lat - (metres / 111195) * Math.cos(0.84),
        lng: p.lng + (metres / 111195) * Math.sin(0.84),
      };
    });
    const corridor = detectCorridor({ lat: 10.7872, lng: 106.7215 }, faint)!;
    expect(corridor.sidesKnown).toBe(false);
  });

  it("will not let one stray stop stand in for a kerb", () => {
    // Five on the line, one well off it. That is an outlier, not a median.
    const start = { lat: 10.77, lng: 106.7 };
    const lopsided = [
      { lat: 10.77, lng: 106.704 },
      { lat: 10.77, lng: 106.708 },
      { lat: 10.77, lng: 106.712 },
      { lat: 10.77, lng: 106.716 },
      { lat: 10.77, lng: 106.72 },
      { lat: 10.7708, lng: 106.724 },
    ];
    expect(detectCorridor(start, lopsided)?.sidesKnown).toBe(false);
  });

  it("will not read two kerbs out of four stops, however tidy", () => {
    // Three coefficients fitted to four points leaves one observation to
    // check them with, and any four points can be talked into two kerbs.
    const start = { lat: 10.77, lng: 106.7 };
    const four = [
      { lat: 10.7695, lng: 106.704 },
      { lat: 10.7705, lng: 106.708 },
      { lat: 10.7695, lng: 106.712 },
      { lat: 10.7705, lng: 106.716 },
    ];
    expect(detectCorridor(start, four)?.sidesKnown).toBe(false);
  });
});
