import { beforeEach, describe, expect, it, vi as vitest } from "vitest";
import {
  AD_HOC_KEY,
  EMPTY_DRAFT,
  createDraftStore,
  draftStoreFor,
  tripDraftKey,
  type RouteDraft,
} from "./route-draft";

// A minimal sessionStorage, since the node runner has none.
function installStorage() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  };
  vitest.stubGlobal("sessionStorage", storage);
  return data;
}

const draft = (over: Partial<RouteDraft> = {}): RouteDraft => ({
  ...EMPTY_DRAFT,
  ...over,
});

describe("createDraftStore", () => {
  beforeEach(() => {
    installStorage();
  });

  it("starts empty", () => {
    expect(createDraftStore("k").getSnapshot()).toEqual(EMPTY_DRAFT);
  });

  it("round-trips a draft", () => {
    const store = createDraftStore("k");
    const next = draft({ selectedIds: ["a", "b"], travelMode: "driving" });
    store.write(next);
    expect(store.getSnapshot()).toEqual(next);
  });

  it("returns a stable reference until the stored value changes", () => {
    // useSyncExternalStore compares by identity; a fresh object every call
    // would make React re-render forever.
    const store = createDraftStore("k");
    store.write(draft({ selectedIds: ["a"] }));

    const first = store.getSnapshot();
    expect(store.getSnapshot()).toBe(first);

    store.write(draft({ selectedIds: ["a", "b"] }));
    expect(store.getSnapshot()).not.toBe(first);
  });

  it("notifies subscribers on write, and stops after unsubscribe", () => {
    const store = createDraftStore("k");
    let calls = 0;
    const unsubscribe = store.subscribe(() => {
      calls++;
    });

    store.write(draft({ selectedIds: ["a"] }));
    expect(calls).toBe(1);

    unsubscribe();
    store.write(draft({ selectedIds: ["b"] }));
    expect(calls).toBe(1);
  });

  it("keeps namespaces apart, so editing a trip cannot clobber the ad-hoc route", () => {
    const adhoc = createDraftStore(AD_HOC_KEY);
    const trip = createDraftStore(tripDraftKey("trip-1"));

    adhoc.write(draft({ selectedIds: ["adhoc"] }));
    trip.write(draft({ selectedIds: ["trip"] }));

    expect(adhoc.getSnapshot().selectedIds).toEqual(["adhoc"]);
    expect(trip.getSnapshot().selectedIds).toEqual(["trip"]);
  });

  it("serves the server snapshot without touching storage", () => {
    expect(createDraftStore("k").getServerSnapshot()).toEqual(EMPTY_DRAFT);
  });
});

describe("parsing stored values", () => {
  beforeEach(() => {
    installStorage();
  });

  it("fills in fields a previous build never wrote", () => {
    // A draft stored before stopIdByCompanyId existed must still load.
    sessionStorage.setItem(
      "k",
      JSON.stringify({ selectedIds: ["a"], travelMode: "driving" }),
    );
    const snapshot = createDraftStore("k").getSnapshot();

    expect(snapshot.selectedIds).toEqual(["a"]);
    expect(snapshot.travelMode).toBe("driving");
    expect(snapshot.stopIdByCompanyId).toEqual({});
    expect(snapshot.startMode).toBe("current");
  });

  it("falls back to empty on corrupt JSON instead of throwing", () => {
    sessionStorage.setItem("k", "{not json");
    expect(createDraftStore("k").getSnapshot()).toEqual(EMPTY_DRAFT);
  });

  it("survives storage that throws, as in a locked-down private window", () => {
    vitest.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });

    const store = createDraftStore("k");
    expect(store.getSnapshot()).toEqual(EMPTY_DRAFT);
    expect(() => store.write(draft({ selectedIds: ["a"] }))).not.toThrow();
  });
});

describe("draftStoreFor", () => {
  beforeEach(() => {
    installStorage();
  });

  it("hands back the same store for the same key", () => {
    expect(draftStoreFor("same")).toBe(draftStoreFor("same"));
    expect(draftStoreFor("a")).not.toBe(draftStoreFor("b"));
  });
});

describe("tripDraftKey", () => {
  it("namespaces per trip and never collides with the ad-hoc key", () => {
    expect(tripDraftKey("x")).not.toBe(tripDraftKey("y"));
    expect(tripDraftKey("x")).not.toBe(AD_HOC_KEY);
  });
});
