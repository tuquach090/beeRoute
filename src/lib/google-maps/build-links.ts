import type { LatLng, OptimizeResult } from "@/lib/route-optimizer/types";

export type TravelMode = "two-wheeler" | "driving";

/**
 * Google Maps URLs accept at most 9 intermediate waypoints alongside an origin
 * and a destination. Mobile browsers choke sooner, so this stays conservative
 * and is kept as a constant to make it easy to retune.
 *
 * https://developers.google.com/maps/documentation/urls/get-started#directions-action
 */
export const MAX_WAYPOINTS_PER_LINK = 8;

const BASE = "https://www.google.com/maps/dir/";

function coord({ lat, lng }: LatLng): string {
  return `${lat},${lng}`;
}

export type RouteLeg = {
  /** 1-based, for the "Mở chặng 2" label. */
  index: number;
  url: string;
  /** Points this link covers, origin and destination included. */
  pointCount: number;
};

/**
 * Builds one directions link, or several when the route has more stops than a
 * single link can carry. Each extra leg starts where the previous one ended,
 * so following them in order walks the whole route.
 */
export function buildGoogleMapsLinks(
  result: Pick<OptimizeResult, "orderedStops">,
  start: LatLng,
  end: LatLng,
  travelMode: TravelMode = "two-wheeler",
): RouteLeg[] {
  const waypoints = result.orderedStops.map((s) => s.location);

  // The full sequence the rider has to drive.
  const path: LatLng[] = [start, ...waypoints, end];

  // Each link holds an origin, up to MAX_WAYPOINTS_PER_LINK stops, and a
  // destination. Consecutive links overlap by one point: the hand-over.
  const perLink = MAX_WAYPOINTS_PER_LINK + 2;

  const legs: RouteLeg[] = [];
  let offset = 0;

  while (offset < path.length - 1) {
    const slice = path.slice(offset, offset + perLink);
    legs.push({
      index: legs.length + 1,
      url: buildSingleLink(slice, travelMode),
      pointCount: slice.length,
    });
    // Step back one so the next link starts at this one's destination.
    offset += slice.length - 1;
  }

  return legs;
}

function buildSingleLink(points: LatLng[], travelMode: TravelMode): string {
  const origin = points[0];
  const destination = points[points.length - 1];
  const waypoints = points.slice(1, -1);

  const params = new URLSearchParams({
    api: "1",
    origin: coord(origin),
    destination: coord(destination),
    travelmode: travelMode,
  });

  if (waypoints.length > 0) {
    // URLSearchParams encodes the "|" separators for us.
    params.set("waypoints", waypoints.map(coord).join("|"));
  }

  return `${BASE}?${params.toString()}`;
}
