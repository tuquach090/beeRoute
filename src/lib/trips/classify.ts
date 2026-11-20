import type { TripSlot } from "@/types/database";

/**
 * A trip counts as "đi tỉnh xa" when it goes to a single stop more than this
 * many kilometres away — the rider's own rule (20/11/2026). One stop is the
 * tell: a run to another province is a dedicated trip, not part of a round.
 *
 * Measured on total_straight_km, the same straight-line figure the app shows
 * everywhere, so the badge agrees with the number printed next to it.
 */
export const FAR_TRIP_MIN_KM = 60;

export function isFarTrip(stopCount: number, totalStraightKm: number): boolean {
  return stopCount === 1 && totalStraightKm > FAR_TRIP_MIN_KM;
}

type Classifiable = {
  slot: TripSlot;
  is_far: boolean;
  sample_count: number;
};

export type SlotMark = "none" | "trip" | "far";

/** What the calendar draws under one date. */
export type DayMarks = {
  morning: SlotMark;
  afternoon: SlotMark;
  /** Any stop that day had a sample taken. */
  sample: boolean;
};

export function dayMarks(trips: Classifiable[]): DayMarks {
  const slot = (s: TripSlot): SlotMark => {
    const inSlot = trips.filter((t) => t.slot === s);
    if (inSlot.length === 0) return "none";
    return inSlot.some((t) => t.is_far) ? "far" : "trip";
  };
  return {
    morning: slot("morning"),
    afternoon: slot("afternoon"),
    sample: trips.some((t) => t.sample_count > 0),
  };
}
