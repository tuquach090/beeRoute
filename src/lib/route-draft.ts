export type EndpointMode = "current" | "address";

export type LatLng = { lat: number; lng: number };

export type TravelMode = "two-wheeler" | "driving";

export type RouteDraft = {
  startMode: EndpointMode;
  startAddress: string;
  startLocation: LatLng | null;
  endMode: EndpointMode;
  endAddress: string;
  endLocation: LatLng | null;
  selectedIds: string[];
  travelMode: TravelMode;
};

export const EMPTY_DRAFT: RouteDraft = {
  startMode: "current",
  startAddress: "",
  startLocation: null,
  endMode: "address",
  endAddress: "",
  endLocation: null,
  selectedIds: [],
  travelMode: "two-wheeler",
};

const STORAGE_KEY = "beeroute-route-draft";

/**
 * sessionStorage treated as an external store, so the route form can read it
 * with useSyncExternalStore instead of restoring it with setState in an effect.
 * It survives the trip to "create company" and back (CLAUDE.md §5.2).
 */

const listeners = new Set<() => void>();

// useSyncExternalStore compares snapshots by reference, so the parsed object
// must be cached until the underlying string actually changes.
let cachedRaw: string | null = null;
let cachedDraft: RouteDraft = EMPTY_DRAFT;

export function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function getSnapshot(): RouteDraft {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY_DRAFT;
  }

  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedDraft = parse(raw);
  }
  return cachedDraft;
}

/** No sessionStorage during SSR; the first client snapshot fills it in. */
export function getServerSnapshot(): RouteDraft {
  return EMPTY_DRAFT;
}

export function writeDraft(next: RouteDraft) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode: the draft simply will not survive navigation.
  }
  for (const listener of listeners) listener();
}

function parse(raw: string | null): RouteDraft {
  if (!raw) return EMPTY_DRAFT;
  try {
    return { ...EMPTY_DRAFT, ...(JSON.parse(raw) as Partial<RouteDraft>) };
  } catch {
    return EMPTY_DRAFT;
  }
}
