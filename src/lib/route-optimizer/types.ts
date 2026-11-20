export type LatLng = { lat: number; lng: number };

export type Stop = { id: string; label: string; location: LatLng };

export type OptimizeInput = {
  start: LatLng;
  /** Destinations. Ids must be unique. */
  stops: Stop[];
  /**
   * Optional fixed end point. It does not influence the order — the next
   * stop is always the nearest one left — it only adds a final leg.
   *
   * Ad-hoc routes leave this out: the round finishes at the last delivery,
   * and forcing a leg back to a depot would report kilometres nobody rides.
   * Trips saved before the end point was dropped still carry one.
   */
  end?: LatLng | null;
};

export type OptimizeResult = {
  orderedStops: Stop[];
  /**
   * start→stop1, stop1→stop2, …
   *
   * Length is orderedStops.length + 1 when an end point was given, and
   * orderedStops.length when it was not.
   */
  legsKm: number[];
  totalKm: number;
  /**
   * Always "heuristic" now: nearest-neighbour makes no claim to the shortest
   * order. The type stays a string literal because saved trips store it, and
   * trips from before 20/11/2026 may say "exact".
   */
  method: "heuristic";
};
