import { describe, expect, it } from "vitest";
import { MAX_WAYPOINTS_PER_LINK, buildGoogleMapsLinks } from "./build-links";
import type { Stop } from "@/lib/route-optimizer/types";

const start = { lat: 10.7721, lng: 106.698 };
const end = { lat: 10.7626, lng: 106.6601 };

const stops = (n: number): Stop[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    label: `Stop ${i}`,
    location: { lat: 10.78 + i * 0.01, lng: 106.7 + i * 0.01 },
  }));

const params = (url: string) => new URL(url).searchParams;

describe("buildGoogleMapsLinks", () => {
  it("builds a single link for a short route", () => {
    const legs = buildGoogleMapsLinks({ orderedStops: stops(3) }, start, end);
    expect(legs).toHaveLength(1);

    const p = params(legs[0].url);
    expect(p.get("api")).toBe("1");
    expect(p.get("origin")).toBe("10.7721,106.698");
    expect(p.get("destination")).toBe("10.7626,106.6601");
    expect(p.get("waypoints")?.split("|")).toHaveLength(3);
  });

  it("defaults to the motorbike travel mode", () => {
    const legs = buildGoogleMapsLinks({ orderedStops: stops(2) }, start, end);
    expect(params(legs[0].url).get("travelmode")).toBe("two-wheeler");
  });

  it("accepts driving", () => {
    const legs = buildGoogleMapsLinks(
      { orderedStops: stops(2) },
      start,
      end,
      "driving",
    );
    expect(params(legs[0].url).get("travelmode")).toBe("driving");
  });

  it("omits waypoints entirely when there is only one stop", () => {
    const legs = buildGoogleMapsLinks({ orderedStops: stops(1) }, start, end);
    const p = params(legs[0].url);
    expect(p.get("waypoints")).toBe("10.78,106.7");
  });

  it("encodes the waypoint separator", () => {
    const legs = buildGoogleMapsLinks({ orderedStops: stops(2) }, start, end);
    // Raw "|" must not appear unencoded in the query string.
    expect(legs[0].url).toContain("%7C");
    expect(legs[0].url.split("?")[1]).not.toContain("|");
  });

  it("splits into several legs past the waypoint limit", () => {
    const legs = buildGoogleMapsLinks(
      { orderedStops: stops(MAX_WAYPOINTS_PER_LINK + 3) },
      start,
      end,
    );
    expect(legs.length).toBeGreaterThan(1);
    for (const leg of legs) {
      const p = params(leg.url);
      const waypoints = p.get("waypoints")?.split("|") ?? [];
      expect(waypoints.length).toBeLessThanOrEqual(MAX_WAYPOINTS_PER_LINK);
    }
  });

  it("hands each leg over at the previous leg's destination", () => {
    const legs = buildGoogleMapsLinks({ orderedStops: stops(20) }, start, end);
    for (let i = 1; i < legs.length; i++) {
      const prevEnd = params(legs[i - 1].url).get("destination");
      const thisStart = params(legs[i].url).get("origin");
      expect(thisStart).toBe(prevEnd);
    }
  });

  it("covers every stop across the split, in order and without loss", () => {
    const list = stops(20);
    const legs = buildGoogleMapsLinks({ orderedStops: list }, start, end);

    // Walk the links and rebuild the full point sequence.
    const seen: string[] = [];
    legs.forEach((leg, i) => {
      const p = params(leg.url);
      const points = [
        p.get("origin")!,
        ...(p.get("waypoints")?.split("|") ?? []),
        p.get("destination")!,
      ];
      // Skip the repeated hand-over point on every leg after the first.
      seen.push(...(i === 0 ? points : points.slice(1)));
    });

    const expected = [
      `${start.lat},${start.lng}`,
      ...list.map((s) => `${s.location.lat},${s.location.lng}`),
      `${end.lat},${end.lng}`,
    ];
    expect(seen).toEqual(expected);
  });

  it("numbers legs from 1", () => {
    const legs = buildGoogleMapsLinks({ orderedStops: stops(20) }, start, end);
    expect(legs.map((l) => l.index)).toEqual(legs.map((_, i) => i + 1));
  });

  it("still produces one link when there are no stops", () => {
    const legs = buildGoogleMapsLinks({ orderedStops: [] }, start, end);
    expect(legs).toHaveLength(1);
    expect(params(legs[0].url).get("waypoints")).toBeNull();
  });
});
