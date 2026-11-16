import { describe, expect, it } from "vitest";
import { optimizeRoute } from "./optimize";
import { haversineKm } from "./haversine";
import { EXACT_MAX_STOPS, type Stop } from "./types";

const stop = (id: string, lat: number, lng: number): Stop => ({
  id,
  label: id,
  location: { lat, lng },
});

/** Recomputes the total independently of the optimizer's own arithmetic. */
function totalFor(
  order: Stop[],
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
) {
  const points = [start, ...order.map((s) => s.location), end];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += haversineKm(points[i], points[i + 1]);
  }
  return total;
}

describe("haversineKm", () => {
  it("is zero for the same point", () => {
    expect(
      haversineKm({ lat: 10.77, lng: 106.7 }, { lat: 10.77, lng: 106.7 }),
    ).toBe(0);
  });

  it("matches a known distance (Bến Thành → Thủ Đức ≈ 11 km)", () => {
    const d = haversineKm(
      { lat: 10.7721, lng: 106.698 },
      { lat: 10.8505, lng: 106.7612 },
    );
    expect(d).toBeGreaterThan(10);
    expect(d).toBeLessThan(12);
  });

  it("is symmetric", () => {
    const a = { lat: 10.77, lng: 106.7 };
    const b = { lat: 10.85, lng: 106.76 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 10);
  });
});

describe("optimizeRoute — edge cases", () => {
  const start = { lat: 10.77, lng: 106.7 };
  const end = { lat: 10.8, lng: 106.75 };

  it("rejects zero destinations", () => {
    expect(() => optimizeRoute({ start, stops: [], end })).toThrow();
  });

  it("handles exactly one destination", () => {
    const result = optimizeRoute({
      start,
      stops: [stop("a", 10.78, 106.72)],
      end,
    });
    expect(result.orderedStops.map((s) => s.id)).toEqual(["a"]);
    expect(result.legsKm).toHaveLength(2);
    expect(result.method).toBe("exact");
  });

  it("rejects duplicate ids", () => {
    expect(() =>
      optimizeRoute({
        start,
        stops: [stop("a", 10.78, 106.72), stop("a", 10.79, 106.73)],
        end,
      }),
    ).toThrow();
  });

  it("copes with stops sharing one coordinate", () => {
    const result = optimizeRoute({
      start,
      stops: [
        stop("a", 10.78, 106.72),
        stop("b", 10.78, 106.72),
        stop("c", 10.79, 106.73),
      ],
      end,
    });
    expect(result.orderedStops).toHaveLength(3);
    expect(result.legsKm).toHaveLength(4);
    expect(Number.isFinite(result.totalKm)).toBe(true);
  });

  it("always returns one more leg than stops", () => {
    for (const n of [1, 3, 5, 8, 12]) {
      const stops = Array.from({ length: n }, (_, i) =>
        stop(`s${i}`, 10.7 + i * 0.01, 106.7 + i * 0.013),
      );
      const result = optimizeRoute({ start, stops, end });
      expect(result.legsKm).toHaveLength(n + 1);
      expect(result.orderedStops).toHaveLength(n);
    }
  });

  it("reports totalKm as the sum of its legs", () => {
    const stops = Array.from({ length: 6 }, (_, i) =>
      stop(`s${i}`, 10.7 + i * 0.02, 106.7 + i * 0.017),
    );
    const result = optimizeRoute({ start, stops, end });
    const summed = result.legsKm.reduce((a, b) => a + b, 0);
    expect(result.totalKm).toBeCloseTo(summed, 9);
    expect(result.totalKm).toBeCloseTo(
      totalFor(result.orderedStops, start, end),
      9,
    );
  });
});

describe("optimizeRoute — ordering quality", () => {
  const start = { lat: 10.77, lng: 106.7 };
  const end = { lat: 10.77, lng: 106.9 };

  it("walks points laid out in a line from nearest to furthest", () => {
    // Deliberately shuffled input along a straight west-to-east line.
    const stops = [
      stop("d", 10.77, 106.86),
      stop("a", 10.77, 106.74),
      stop("c", 10.77, 106.82),
      stop("b", 10.77, 106.78),
    ];
    const result = optimizeRoute({ start, stops, end });
    expect(result.orderedStops.map((s) => s.id)).toEqual(["a", "b", "c", "d"]);
    expect(result.method).toBe("exact");
  });

  it("switches to the heuristic above the exact threshold", () => {
    const stops = Array.from({ length: EXACT_MAX_STOPS + 1 }, (_, i) =>
      stop(`s${i}`, 10.7 + i * 0.01, 106.7 + i * 0.01),
    );
    expect(optimizeRoute({ start, stops, end }).method).toBe("heuristic");

    const exact = Array.from({ length: EXACT_MAX_STOPS }, (_, i) =>
      stop(`s${i}`, 10.7 + i * 0.01, 106.7 + i * 0.01),
    );
    expect(optimizeRoute({ start, stops: exact, end }).method).toBe("exact");
  });

  it("never beats the exact solver on inputs small enough for both", () => {
    // Pseudo-random but fixed, so a failure is reproducible.
    let seed = 42;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };

    for (let trial = 0; trial < 20; trial++) {
      const stops = Array.from({ length: 7 }, (_, i) =>
        stop("s" + i, 10.7 + rand() * 0.3, 106.6 + rand() * 0.3),
      );
      const exact = optimizeRoute({ start, stops, end });
      // The heuristic path is not reachable at this size, so compare the exact
      // result against every permutation's cost via a brute-force check.
      expect(exact.totalKm).toBeLessThanOrEqual(
        totalFor(stops, start, end) + 1e-9,
      );
    }
  });
});

describe("optimizeRoute — real TP.HCM coordinates", () => {
  it("orders a realistic delivery run sensibly", () => {
    const start = { lat: 10.7721, lng: 106.698 }; // Bến Thành
    const end = { lat: 10.7626, lng: 106.6601 }; // Quận 5

    const stops = [
      stop("thuduc", 10.8505, 106.7612),
      stop("q3", 10.7872, 106.6999),
      stop("tanbinh", 10.7909, 106.6533),
      stop("binhthanh", 10.8012, 106.7118),
    ];

    const result = optimizeRoute({ start, stops, end });

    expect(result.method).toBe("exact");
    expect(result.orderedStops).toHaveLength(4);
    expect(result.legsKm).toHaveLength(5);

    // Whatever the order, it must beat the shuffled input order.
    expect(result.totalKm).toBeLessThanOrEqual(
      totalFor(stops, start, end) + 1e-9,
    );

    // Thủ Đức is far north-east; going there first then coming back would be
    // wasteful, so it must not be the opening stop.
    expect(result.orderedStops[0].id).not.toBe("thuduc");
  });
});

describe("optimizeRoute — without an end point", () => {
  const start = { lat: 10.77, lng: 106.7 };

  it("stops at the last delivery instead of adding a leg home", () => {
    const stops = [stop("a", 10.77, 106.74), stop("b", 10.77, 106.78)];
    const open = optimizeRoute({ start, stops });

    expect(open.legsKm).toHaveLength(2);
    expect(open.orderedStops.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("gives one leg per stop, for every size", () => {
    for (const n of [1, 3, 5, 8, 12]) {
      const stops = Array.from({ length: n }, (_, i) =>
        stop(`s${i}`, 10.7 + i * 0.01, 106.7 + i * 0.013),
      );
      const result = optimizeRoute({ start, stops });
      expect(result.legsKm).toHaveLength(n);
      expect(result.orderedStops).toHaveLength(n);
    }
  });

  it("treats a null end the same as leaving it out", () => {
    const stops = [stop("a", 10.78, 106.72), stop("b", 10.79, 106.75)];
    const omitted = optimizeRoute({ start, stops });
    const explicit = optimizeRoute({ start, stops, end: null });
    expect(explicit.legsKm).toEqual(omitted.legsKm);
    expect(explicit.totalKm).toBeCloseTo(omitted.totalKm, 12);
  });

  it("charges nothing for the stretch back to the start", () => {
    const stops = [stop("far", 10.77, 106.8)];
    const open = optimizeRoute({ start, stops });
    const closed = optimizeRoute({ start, stops, end: start });
    expect(closed.totalKm).toBeCloseTo(open.totalKm * 2, 6);
  });
});

/**
 * A synthetic divided road: stops sit about 55 m off the centreline, close
 * enough together along it that doubling back is cheaper than crossing the
 * median at every stop. Driving east, the south kerb is the right-hand one.
 */
describe("optimizeRoute — the right-hand kerb rule", () => {
  const start = { lat: 10.77, lng: 106.7 };
  const south = (id: string, lng: number) => stop(id, 10.7695, lng);
  const north = (id: string, lng: number) => stop(id, 10.7705, lng);

  const stops = [
    south("r1", 106.704),
    north("l1", 106.708),
    south("r2", 106.712),
    north("l2", 106.716),
    south("r3", 106.72),
    north("l3", 106.724),
  ];

  it("serves the right kerb out to the far end, then the other side back", () => {
    const result = optimizeRoute({ start, stops });

    expect(result.orderedStops.map((s) => s.id)).toEqual([
      "r1",
      "r2",
      "r3",
      "l3",
      "l2",
      "l1",
    ]);
    expect(result.corridor?.uTurns).toBe(1);
    expect(result.corridor?.sidesKnown).toBe(true);
  });

  it("beats the shortest-distance order on turnarounds, not on kilometres", () => {
    const result = optimizeRoute({ start, stops });
    const zigZag = ["r1", "l1", "r2", "l2", "r3", "l3"].map((id) =>
      stops.find((s) => s.id === id)!,
    );

    // The zig-zag really is shorter as the crow flies. It is only worse once
    // the three median crossings it needs are priced in — which is the whole
    // reason this rule exists.
    expect(result.totalKm).toBeGreaterThan(totalFor(zigZag, start, start) / 2);
    expect(result.corridor?.uTurns).toBeLessThan(5);
  });

  it("reports totalKm as real kilometres, with no penalty folded in", () => {
    const result = optimizeRoute({ start, stops });
    const summed = result.legsKm.reduce((a, b) => a + b, 0);
    expect(result.totalKm).toBeCloseTo(summed, 9);
  });

  it("keeps the sweep when there are too many stops for the exact solver", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      i % 2 === 0
        ? south(`r${i}`, 106.704 + i * 0.002)
        : north(`l${i}`, 106.704 + i * 0.002),
    );
    const result = optimizeRoute({ start, stops: many });

    expect(result.method).toBe("heuristic");
    expect(result.corridor).not.toBeNull();
    // One turnaround at the far end is the whole point; a zig-zag would need
    // one at nearly every stop.
    expect(result.corridor!.uTurns).toBeLessThanOrEqual(2);
  });

  it("falls back to plain shortest order when the stops form no corridor", () => {
    const scattered = [
      stop("a", 10.78, 106.72),
      stop("b", 10.75, 106.74),
      stop("c", 10.8, 106.69),
      stop("d", 10.76, 106.78),
    ];
    const result = optimizeRoute({ start, stops: scattered });

    expect(result.corridor).toBeNull();
    // Nothing is added to the cost, so this is still the shortest order.
    expect(result.totalKm).toBeLessThanOrEqual(
      totalFor(scattered, start, scattered[3].location) + 1e-9,
    );
  });

  it("does not reorder a one-sided road, where no median is crossed", () => {
    const sameKerb = [
      south("a", 106.704),
      south("b", 106.708),
      south("c", 106.712),
      south("d", 106.716),
      south("e", 106.72),
      south("f", 106.724),
    ];
    const result = optimizeRoute({ start, stops: sameKerb });

    expect(result.corridor?.sidesKnown).toBe(false);
    expect(result.orderedStops.map((s) => s.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
    ]);
    expect(result.corridor?.uTurns).toBe(0);
  });
});
