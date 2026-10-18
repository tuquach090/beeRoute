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

/**
 * A point on the route, plus the text to show for it in Google Maps.
 *
 * Coordinates alone render as "Đã thả ghim", which is useless when checking
 * you are at the right place. A name and address renders properly — but
 * Google re-geocodes the text, so it is only safe when the address really is
 * an address. See `pointToParam`.
 */
type RoutePoint = {
  location: LatLng;
  /** Company name, when known. */
  name?: string | null;
  /** Stored address — may itself be just a coordinate pair. */
  address?: string | null;
};

export type StopLabel = { name?: string | null; address?: string | null };

/**
 * 6 decimals is about 11 cm — far finer than a delivery address needs, and it
 * strips the float noise that otherwise reaches the URL as
 * "106.71000000000001". Number() drops the trailing zeros toFixed adds.
 */
function coord({ lat, lng }: LatLng): string {
  return `${Number(lat.toFixed(6))},${Number(lng.toFixed(6))}`;
}

/** Matches an address field that is really just a pasted coordinate pair. */
const COORDS_ONLY = /^\s*-?\d+(?:\.\d+)?\s*[,;\s]\s*-?\d+(?:\.\d+)?\s*$/;

/**
 * Prefers readable text, falls back to coordinates.
 *
 * The text is only used when there is a real address to anchor it: a bare
 * company name would send Google hunting across the country, and an address
 * field holding coordinates gains nothing by being sent as a string.
 */
export function pointToParam(point: RoutePoint): string {
  const name = point.name?.trim();
  const address = point.address?.trim();

  const addressIsReal = Boolean(
    address && address.length > 0 && !COORDS_ONLY.test(address),
  );

  if (!addressIsReal) return coord(point.location);

  return name ? `${name}, ${address}` : address!;
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
 *
 * `stopLabels` maps stop id → the name and address to display. Omit it and
 * every point falls back to coordinates.
 */
export function buildGoogleMapsLinks(
  result: Pick<OptimizeResult, "orderedStops">,
  start: LatLng,
  end: LatLng,
  travelMode: TravelMode = "two-wheeler",
  stopLabels?: Map<string, StopLabel>,
): RouteLeg[] {
  const path: RoutePoint[] = [
    // Start and end are a live GPS fix or a typed address, so they stay as
    // coordinates: there is no verified company record behind them.
    { location: start },
    ...result.orderedStops.map((s) => {
      const label = stopLabels?.get(s.id);
      return {
        location: s.location,
        name: label?.name ?? s.label,
        address: label?.address,
      };
    }),
    { location: end },
  ];

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

function buildSingleLink(points: RoutePoint[], travelMode: TravelMode): string {
  const origin = points[0];
  const destination = points[points.length - 1];
  const waypoints = points.slice(1, -1);

  const params = new URLSearchParams({
    api: "1",
    origin: pointToParam(origin),
    destination: pointToParam(destination),
    travelmode: travelMode,
  });

  if (waypoints.length > 0) {
    // URLSearchParams encodes the "|" separators for us.
    params.set("waypoints", waypoints.map(pointToParam).join("|"));
  }

  return `${BASE}?${params.toString()}`;
}
