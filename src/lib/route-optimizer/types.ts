export type LatLng = { lat: number; lng: number };

export type Stop = { id: string; label: string; location: LatLng };

export type OptimizeInput = {
  start: LatLng;
  /** Destinations. Ids must be unique. */
  stops: Stop[];
  /** Fixed end point. */
  end: LatLng;
};

export type OptimizeResult = {
  orderedStops: Stop[];
  /** start→stop1, stop1→stop2, …, stopN→end. Always orderedStops.length + 1. */
  legsKm: number[];
  totalKm: number;
  method: "exact" | "heuristic";
};

/**
 * Above this many destinations, trying every permutation stops being viable
 * (9! = 362,880 orders × 10 legs each). CLAUDE.md §6.2 sets the threshold.
 */
export const EXACT_MAX_STOPS = 8;
