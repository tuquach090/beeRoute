import { describe, expect, it } from "vitest";
import { FAR_TRIP_MIN_KM, dayMarks, isFarTrip } from "./classify";

describe("isFarTrip", () => {
  it("is a single stop beyond the threshold", () => {
    expect(isFarTrip(1, 72.4)).toBe(true);
  });

  it("needs strictly more than the threshold", () => {
    expect(isFarTrip(1, FAR_TRIP_MIN_KM)).toBe(false);
    expect(isFarTrip(1, FAR_TRIP_MIN_KM + 0.1)).toBe(true);
  });

  it("is never a multi-stop round, however long", () => {
    expect(isFarTrip(2, 140)).toBe(false);
    expect(isFarTrip(6, 61)).toBe(false);
  });

  it("is not a short single drop", () => {
    expect(isFarTrip(1, 12)).toBe(false);
  });
});

describe("dayMarks", () => {
  it("marks nothing on an empty day", () => {
    expect(dayMarks([])).toEqual({
      morning: "none",
      afternoon: "none",
      sample: false,
    });
  });

  it("marks each slot on its own", () => {
    expect(
      dayMarks([{ slot: "morning", is_far: false, sample_count: 0 }]),
    ).toEqual({ morning: "trip", afternoon: "none", sample: false });
  });

  it("lets a far trip win the slot, even beside an ordinary one", () => {
    const marks = dayMarks([
      { slot: "afternoon", is_far: false, sample_count: 0 },
      { slot: "afternoon", is_far: true, sample_count: 0 },
    ]);
    expect(marks.afternoon).toBe("far");
  });

  it("flags the day when any trip took a sample", () => {
    const marks = dayMarks([
      { slot: "morning", is_far: false, sample_count: 0 },
      { slot: "afternoon", is_far: false, sample_count: 2 },
    ]);
    expect(marks.sample).toBe(true);
  });
});
