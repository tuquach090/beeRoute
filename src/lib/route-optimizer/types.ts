export type LatLng = { lat: number; lng: number };

export type Stop = { id: string; label: string; location: LatLng };

export type OptimizeInput = {
  start: LatLng;
  /** Destinations. Ids must be unique. */
  stops: Stop[];
  /**
   * Optional fixed end point.
   *
   * Ad-hoc routes leave this out: the round finishes at the last delivery,
   * and forcing a leg back to a depot would report kilometres nobody rides.
   * Trips saved before the end point was dropped still carry one.
   */
  end?: LatLng | null;
};

/** What the corridor rule did, for the note shown under the result. */
export type CorridorSummary = {
  lengthKm: number;
  bearingDeg: number;
  /** How many times the route reverses direction along the corridor. */
  uTurns: number;
  /** False when the stops could not be sorted onto two kerbs. */
  sidesKnown: boolean;
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
  method: "exact" | "heuristic";
  /** Set when the stops lay along one road and the sweep rule applied. */
  corridor: CorridorSummary | null;
};

/**
 * Above this many destinations, trying every permutation stops being viable
 * (9! = 362,880 orders × 10 legs each). CLAUDE.md §6.2 sets the threshold.
 */
export const EXACT_MAX_STOPS = 8;
