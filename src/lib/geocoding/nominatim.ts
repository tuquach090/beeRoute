import type { GeocodeResult } from "./types";

const SEARCH_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const REVERSE_ENDPOINT = "https://nominatim.openstreetmap.org/reverse";

/** Nominatim's usage policy allows at most one request per second. */
const MIN_INTERVAL_MS = 1000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;

type NominatimItem = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

// Module-level state. One Node process serves every request, so this throttles
// the whole server rather than a single caller.
let lastRequestAt = 0;
let queue: Promise<unknown> = Promise.resolve();
const cache = new Map<string, { at: number; results: GeocodeResult[] }>();

function readCache(key: string): GeocodeResult[] | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  // Refresh insertion order so the Map evicts least-recently-used first.
  cache.delete(key);
  cache.set(key, hit);
  return hit.results;
}

function writeCache(key: string, results: GeocodeResult[]) {
  cache.set(key, { at: Date.now(), results });
  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** Serialises calls so two concurrent requests cannot both slip through. */
function throttle<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
    return task();
  });
  // Keep the chain alive even when one call rejects.
  queue = run.catch(() => undefined);
  return run;
}

export async function searchNominatim(
  query: string,
  signal?: AbortSignal,
): Promise<GeocodeResult[]> {
  const key = query.trim().toLowerCase();
  const cached = readCache(key);
  if (cached) return cached;

  const url = new URL(SEARCH_ENDPOINT);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "0");
  url.searchParams.set("limit", "6");
  url.searchParams.set("countrycodes", "vn");
  url.searchParams.set("accept-language", "vi");

  const results = await throttle(async () => {
    const res = await fetch(url, {
      signal,
      headers: {
        // Nominatim blocks clients that do not identify themselves.
        "User-Agent":
          process.env.NOMINATIM_USER_AGENT ?? "BeeRoute/0.1 (unconfigured)",
        "Accept-Language": "vi",
      },
    });

    if (!res.ok) {
      throw new Error(`Nominatim trả về ${res.status}`);
    }

    const items = (await res.json()) as NominatimItem[];
    return items.map((item) => ({
      id: String(item.place_id),
      label: item.display_name,
      location: { lat: Number(item.lat), lng: Number(item.lon) },
    }));
  });

  writeCache(key, results);
  return results;
}

/**
 * Coordinates → a readable address.
 *
 * Used when the user pastes a Google Maps link or raw coordinates: the numbers
 * locate the place correctly but read as noise in a list of companies.
 */
export async function reverseNominatim(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<string | null> {
  const key = `rev:${lat.toFixed(6)},${lng.toFixed(6)}`;
  const cached = readCache(key);
  if (cached) return cached[0]?.label ?? null;

  const url = new URL(REVERSE_ENDPOINT);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("accept-language", "vi");
  // Street-level detail; the full building-level name is usually too long.
  url.searchParams.set("zoom", "18");

  const label = await throttle(async () => {
    const res = await fetch(url, {
      signal,
      headers: {
        "User-Agent":
          process.env.NOMINATIM_USER_AGENT ?? "BeeRoute/0.1 (unconfigured)",
        "Accept-Language": "vi",
      },
    });
    if (!res.ok) throw new Error(`Nominatim trả về ${res.status}`);
    const body = (await res.json()) as { display_name?: string };
    return body.display_name ?? null;
  });

  if (label) {
    writeCache(key, [{ id: key, label, location: { lat, lng } }]);
  }
  return label;
}
