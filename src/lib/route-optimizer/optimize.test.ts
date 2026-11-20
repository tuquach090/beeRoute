import { describe, expect, it } from "vitest";
import { optimizeRoute } from "./optimize";
import { haversineKm } from "./haversine";
import type { Stop } from "./types";

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
    expect(result.method).toBe("heuristic");
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

/** A point `km` kilometres east of `origin`, on the same latitude. */
const east = (origin: { lat: number; lng: number }, km: number) => ({
  lat: origin.lat,
  lng: origin.lng + km / (111.32 * Math.cos((origin.lat * Math.PI) / 180)),
});

describe("optimizeRoute — nearest first, then nearest to the previous stop", () => {
  const kho = { lat: 10.77, lng: 106.7 };
  const at = (id: string, km: number) => {
    const p = east(kho, km);
    return stop(id, p.lat, p.lng);
  };

  it("follows the rider's own example: kho → A (5km) → C (8km) → B (2km)", () => {
    // From A, C is 8 km away and B is 10, so C comes next; B is then 2 km on.
    const stops = [at("B", 15), at("C", 13), at("A", 5)];
    const result = optimizeRoute({ start: kho, stops });

    expect(result.orderedStops.map((s) => s.id)).toEqual(["A", "C", "B"]);
    expect(result.legsKm[0]).toBeCloseTo(5, 1);
    expect(result.legsKm[1]).toBeCloseTo(8, 1);
    expect(result.legsKm[2]).toBeCloseTo(2, 1);
  });

  it("picks the stop nearest the start first, whatever the input order", () => {
    const stops = [at("far", 12), at("near", 1), at("mid", 6)];
    expect(optimizeRoute({ start: kho, stops }).orderedStops[0].id).toBe(
      "near",
    );
  });

  it("measures each step from the previous stop, not from the start", () => {
    // A is nearest the start. From A, B (3 km back west) beats C (9 km east),
    // even though C is closer to the start than B is.
    const stops = [at("C", 10), at("B", -2), at("A", 1)];
    expect(
      optimizeRoute({ start: kho, stops }).orderedStops.map((s) => s.id),
    ).toEqual(["A", "B", "C"]);
  });

  it("does not trade the greedy order for a shorter one", () => {
    // Same layout: B first would total 2 + 3 + 9 = 14 km, the greedy order
    // totals 1 + 3 + 12 = 16. The rule is nearest-next, not shortest-total.
    const stops = [at("C", 10), at("B", -2), at("A", 1)];
    const result = optimizeRoute({ start: kho, stops });
    expect(result.totalKm).toBeCloseTo(16, 1);
  });

  it("breaks a tie in favour of the stop listed first", () => {
    const stops = [at("west", -3), at("east", 3)];
    expect(optimizeRoute({ start: kho, stops }).orderedStops[0].id).toBe(
      "west",
    );
    const flipped = [at("east", 3), at("west", -3)];
    expect(
      optimizeRoute({ start: kho, stops: flipped }).orderedStops[0].id,
    ).toBe("east");
  });

  it("does not let the end point pull the order towards itself", () => {
    const stops = [at("C", 10), at("B", -2), at("A", 1)];
    const open = optimizeRoute({ start: kho, stops });
    const toEnd = optimizeRoute({ start: kho, stops, end: east(kho, -5) });
    expect(toEnd.orderedStops.map((s) => s.id)).toEqual(
      open.orderedStops.map((s) => s.id),
    );
  });

  it("handles more stops than the old exact solver allowed", () => {
    const stops = Array.from({ length: 25 }, (_, i) =>
      at(`s${i}`, ((i * 7) % 25) + 1),
    );
    const result = optimizeRoute({ start: kho, stops });
    expect(result.orderedStops.map((s) => s.id)).toEqual(
      [...stops]
        .sort((a, b) => a.location.lng - b.location.lng)
        .map((s) => s.id),
    );
  });
});

describe("optimizeRoute — the rider's real Bình Dương run", () => {
  // Coordinates the rider supplied on 16/11/2026: warehouse in Thủ Đức, six
  // factories strung north along TL743B.
  const kho = { lat: 10.820982, lng: 106.794399 };
  const stops = [
    stop("Đại Hoa", 11.071434, 106.7736494),
    stop("Kisoo", 10.9549211, 106.743391),
    stop("Delta", 10.8701362, 106.747389),
    stop("Chí Hùng", 10.9740923, 106.752528),
    stop("Craft", 10.9257095, 106.7414861),
    stop("Pungkook3", 10.9542643, 106.7454434),
  ];

  it("works outwards from the warehouse, nearest hop each time", () => {
    const result = optimizeRoute({ start: kho, stops });
    expect(result.orderedStops.map((s) => s.id)).toEqual([
      "Delta",
      "Craft",
      "Pungkook3",
      "Kisoo",
      "Chí Hùng",
      "Đại Hoa",
    ]);
    expect(result.totalKm).toBeCloseTo(30.6, 1);
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
