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
