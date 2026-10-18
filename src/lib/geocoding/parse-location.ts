import { isValidLatLng, type LatLng } from "./types";

/**
 * Vietnamese addresses are patchy on OpenStreetMap, so the user can skip the
 * search entirely by pasting coordinates or a Google Maps link (CLAUDE.md §8).
 */

const PLAIN_PAIR = /^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/;

// Google Maps packs the coordinates into several different shapes.
const GMAPS_PATTERNS: RegExp[] = [
  // .../@10.776,106.700,17z  — the map centre
  /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
  // ...!3d10.776!4d106.700   — the pinned place, more accurate than @
  /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
  // ...?q=10.776,106.700  /  ?query=  /  &ll=  /  &destination=
  /[?&](?:q|query|ll|destination|center)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
];

/**
 * Pulls a coordinate pair out of free text. Returns null when the input is an
 * ordinary address that should go to the geocoder instead.
 */
export function parseLocationInput(raw: string): LatLng | null {
  const text = raw.trim();
  if (!text) return null;

  const plain = text.match(PLAIN_PAIR);
  if (plain) {
    const candidate = { lat: Number(plain[1]), lng: Number(plain[2]) };
    return isValidLatLng(candidate) ? candidate : null;
  }

  // Both host shapes occur: google.com/maps/... and maps.google.com/?q=...
  if (
    !/(?:google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|goo\.gl\/maps|maps\.app\.goo\.gl)/i.test(
      text,
    )
  ) {
    return null;
  }

  // !3d!4d marks the actual place, so prefer it over the viewport centre.
  for (const pattern of [
    GMAPS_PATTERNS[1],
    GMAPS_PATTERNS[0],
    GMAPS_PATTERNS[2],
  ]) {
    const m = text.match(pattern);
    if (m) {
      const candidate = { lat: Number(m[1]), lng: Number(m[2]) };
      if (isValidLatLng(candidate)) return candidate;
    }
  }

  return null;
}

/** Short links (maps.app.goo.gl/xxx) carry no coordinates until resolved. */
export function isUnresolvedShortLink(raw: string): boolean {
  const text = raw.trim();
  return (
    /(?:goo\.gl\/maps|maps\.app\.goo\.gl)/i.test(text) &&
    parseLocationInput(text) === null
  );
}

export function formatLatLng({ lat, lng }: LatLng): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

/** True for a URL, as opposed to a bare coordinate pair or a typed address. */
export function isMapsLink(raw: string): boolean {
  const text = raw.trim();
  return (
    /https?:\/\//i.test(text) ||
    /google\.[a-z.]+\/maps|maps\.google\.|goo\.gl\/maps|maps\.app\.goo\.gl/i.test(
      text,
    )
  );
}

/**
 * True when the text is raw machine input (a coordinate pair or a Maps URL)
 * rather than something a person would want to read in a list.
 */
export function isRawLocationText(raw: string): boolean {
  const text = raw.trim();
  if (!text) return false;
  return (
    PLAIN_PAIR.test(text) ||
    /https?:\/\//i.test(text) ||
    /google\.[a-z.]+\/maps|maps\.google\./i.test(text)
  );
}
