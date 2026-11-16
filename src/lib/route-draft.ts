export type EndpointMode = "current" | "address";

export type LatLng = { lat: number; lng: number };

export type TravelMode = "two-wheeler" | "driving";

export type RouteDraft = {
  startMode: EndpointMode;
  startAddress: string;
  startLocation: LatLng | null;
  /**
   * Whether the default start point from Cài đặt has already been applied.
   *
   * Without this flag there is no telling "the rider has not touched the form
   * yet" from "the rider deliberately switched back to Vị trí hiện tại", and
   * the default would keep reappearing after every navigation.
   */
  startSeeded: boolean;
  selectedIds: string[];
  travelMode: TravelMode;
  /**
   * company id → the trip_stops row that already exists for it.
   *
   * Sent back on save so a re-optimise updates those rows instead of replacing
   * them, which is what keeps their photos and delivery notes alive. Empty
   * when building an ad-hoc route.
   */
  stopIdByCompanyId: Record<string, string>;
};

export const EMPTY_DRAFT: RouteDraft = {
  startMode: "current",
  startAddress: "",
  startLocation: null,
  startSeeded: false,
  selectedIds: [],
  travelMode: "two-wheeler",
  stopIdByCompanyId: {},
};

export const AD_HOC_KEY = "beeroute-route-draft";

/** One namespace per trip, so editing never clobbers the ad-hoc route. */
export function tripDraftKey(tripId: string) {
  return `beeroute-trip-draft:${tripId}`;
}

export type DraftStore = {
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => RouteDraft;
  getServerSnapshot: () => RouteDraft;
  write: (next: RouteDraft) => void;
};

/**
 * sessionStorage treated as an external store, so the route form reads it with
 * useSyncExternalStore instead of restoring it with setState in an effect.
 * It survives the trip to "create company" and back (CLAUDE.md §5.2).
 *
 * One store per key: useSyncExternalStore compares snapshots by reference, so
 * each namespace needs its own cache or two forms would hand each other stale
 * objects.
 */
export function createDraftStore(storageKey: string): DraftStore {
  const listeners = new Set<() => void>();
  let cachedRaw: string | null = null;
  let cachedDraft: RouteDraft = EMPTY_DRAFT;

  function getSnapshot(): RouteDraft {
    let raw: string | null;
    try {
      raw = sessionStorage.getItem(storageKey);
    } catch {
      return EMPTY_DRAFT;
    }

    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedDraft = parse(raw);
    }
    return cachedDraft;
  }

  return {
    subscribe(onChange) {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    getSnapshot,
    /** No sessionStorage during SSR; the first client snapshot fills it in. */
    getServerSnapshot: () => EMPTY_DRAFT,
    write(next) {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Private mode: the draft simply will not survive navigation.
      }
      for (const listener of listeners) listener();
    },
  };
}

/** Spreading over EMPTY_DRAFT keeps drafts written by older builds working. */
function parse(raw: string | null): RouteDraft {
  if (!raw) return EMPTY_DRAFT;
  try {
    return { ...EMPTY_DRAFT, ...(JSON.parse(raw) as Partial<RouteDraft>) };
  } catch {
    return EMPTY_DRAFT;
  }
}

const stores = new Map<string, DraftStore>();

/** Stores are cached so repeated renders keep the same snapshot identity. */
export function draftStoreFor(storageKey: string): DraftStore {
  let store = stores.get(storageKey);
  if (!store) {
    store = createDraftStore(storageKey);
    stores.set(storageKey, store);
  }
  return store;
}
