import { describe, expect, it } from "vitest";
import {
  MAX_WAYPOINTS_PER_LINK,
  buildGoogleMapsLinks,
  buildSingleStopLink,
  pointToParam,
} from "./build-links";
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

/** Mirrors the 6-decimal rounding build-links applies to coordinates. */
const asCoord = (lat: number, lng: number) =>
  `${Number(lat.toFixed(6))},${Number(lng.toFixed(6))}`;

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
      asCoord(start.lat, start.lng),
      ...list.map((s) => asCoord(s.location.lat, s.location.lng)),
      asCoord(end.lat, end.lng),
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

describe("pointToParam — readable labels vs coordinates", () => {
  const loc = { lat: 10.7909, lng: 106.6533 };

  it("sends name + address when the address is a real address", () => {
    expect(
      pointToParam({
        location: loc,
        name: "Kho Tân Bình",
        address: "285 Cách Mạng Tháng 8, Tân Bình, TP.HCM",
      }),
    ).toBe("Kho Tân Bình, 285 Cách Mạng Tháng 8, Tân Bình, TP.HCM");
  });

  it("falls back to coordinates when the address is just coordinates", () => {
    // Matches the companies saved before reverse geocoding existed.
    expect(
      pointToParam({
        location: loc,
        name: "Lạc Tỷ",
        address: "10.739866, 106.614413",
      }),
    ).toBe("10.7909,106.6533");
  });

  it("falls back to coordinates when there is no address", () => {
    expect(pointToParam({ location: loc, name: "Kho Tân Bình" })).toBe(
      "10.7909,106.6533",
    );
    expect(pointToParam({ location: loc })).toBe("10.7909,106.6533");
  });

  it("uses the address alone when the name is missing", () => {
    expect(
      pointToParam({ location: loc, address: "285 Cách Mạng Tháng 8" }),
    ).toBe("285 Cách Mạng Tháng 8");
  });
});

describe("buildGoogleMapsLinks — labelled stops", () => {
  it("labels stops that have an address, and keeps endpoints as coordinates", () => {
    const list: Stop[] = [
      { id: "a", label: "Kho Tân Bình", location: { lat: 10.79, lng: 106.65 } },
      { id: "b", label: "Lạc Tỷ", location: { lat: 10.73, lng: 106.61 } },
    ];
    const labels = new Map([
      ["a", { name: "Kho Tân Bình", address: "285 Cách Mạng Tháng 8, TP.HCM" }],
      // Address is still a raw coordinate pair.
      ["b", { name: "Lạc Tỷ", address: "10.739866, 106.614413" }],
    ]);

    const legs = buildGoogleMapsLinks(
      { orderedStops: list },
      start,
      end,
      "two-wheeler",
      labels,
    );
    const wp = params(legs[0].url).get("waypoints")!.split("|");

    expect(wp[0]).toBe("Kho Tân Bình, 285 Cách Mạng Tháng 8, TP.HCM");
    expect(wp[1]).toBe("10.73,106.61");

    // Start and end have no company record behind them.
    expect(params(legs[0].url).get("origin")).toBe("10.7721,106.698");
    expect(params(legs[0].url).get("destination")).toBe("10.7626,106.6601");
  });

  it("still uses coordinates everywhere when no labels are supplied", () => {
    const legs = buildGoogleMapsLinks({ orderedStops: stops(2) }, start, end);
    // Float noise (106.71000000000001) must not reach the URL.
    expect(params(legs[0].url).get("waypoints")).toBe(
      "10.78,106.7|10.79,106.71",
    );
  });
});

describe("buildSingleStopLink", () => {
  const loc = { lat: 10.7909, lng: 106.6533 };

  it("omits origin so Maps starts from the current location", () => {
    const p = params(buildSingleStopLink({ location: loc }));
    expect(p.get("origin")).toBeNull();
    expect(p.get("waypoints")).toBeNull();
    expect(p.get("destination")).toBe("10.7909,106.6533");
    expect(p.get("travelmode")).toBe("two-wheeler");
  });

  it("uses the readable label when the stop has a real address", () => {
    expect(
      params(
        buildSingleStopLink({
          location: loc,
          name: "Kho Tân Bình",
          address: "285 Cách Mạng Tháng 8, TP.HCM",
        }),
      ).get("destination"),
    ).toBe("Kho Tân Bình, 285 Cách Mạng Tháng 8, TP.HCM");
  });

  it("falls back to coordinates when the address is itself coordinates", () => {
    expect(
      params(
        buildSingleStopLink({
          location: loc,
          name: "Lạc Tỷ",
          address: "10.739866, 106.614413",
        }),
      ).get("destination"),
    ).toBe("10.7909,106.6533");
  });

  it("accepts the car travel mode", () => {
    expect(
      params(buildSingleStopLink({ location: loc }, "driving")).get(
        "travelmode",
      ),
    ).toBe("driving");
  });
});
