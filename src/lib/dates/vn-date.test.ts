import { describe, expect, it } from "vitest";
import {
  addMonths,
  buildMonthGrid,
  daysInMonth,
  monthRange,
  parseIsoDate,
  slotForNowInVn,
  toIsoDate,
  todayInVn,
  weekdayMondayFirst,
} from "./vn-date";

describe("todayInVn", () => {
  /**
   * The bug this guards: UTC is 7 hours behind Vietnam, so a run at 06:30
   * local happens at 23:30 UTC the PREVIOUS day. Using the server's own date
   * would file it under yesterday.
   */
  it("reports the Vietnam day, not the UTC day", () => {
    // 2026-10-25T23:30Z is 2026-10-26 06:30 in Vietnam.
    expect(todayInVn(new Date("2026-10-25T23:30:00Z"))).toBe("2026-10-26");
  });

  it("holds the previous day right up to 17:00Z", () => {
    // 16:59Z is 23:59 in Vietnam, still the 25th.
    expect(todayInVn(new Date("2026-10-25T16:59:00Z"))).toBe("2026-10-25");
    // 17:00Z is midnight, now the 26th.
    expect(todayInVn(new Date("2026-10-25T17:00:00Z"))).toBe("2026-10-26");
  });

  it("rolls over the end of a month and a year", () => {
    expect(todayInVn(new Date("2026-10-31T17:00:00Z"))).toBe("2026-11-01");
    expect(todayInVn(new Date("2026-12-31T17:00:00Z"))).toBe("2027-01-01");
  });

  it("pads single digits", () => {
    expect(todayInVn(new Date("2026-01-05T06:00:00Z"))).toBe("2026-01-05");
  });
});

describe("slotForNowInVn", () => {
  it("splits at Vietnam noon, not UTC noon", () => {
    // 04:59Z = 11:59 in Vietnam.
    expect(slotForNowInVn(new Date("2026-10-25T04:59:00Z"))).toBe("morning");
    // 05:00Z = 12:00 in Vietnam.
    expect(slotForNowInVn(new Date("2026-10-25T05:00:00Z"))).toBe("afternoon");
  });

  it("treats the small hours as morning", () => {
    // 18:00Z = 01:00 next day in Vietnam.
    expect(slotForNowInVn(new Date("2026-10-25T18:00:00Z"))).toBe("morning");
  });

  it("treats late evening as afternoon", () => {
    // 15:00Z = 22:00 in Vietnam.
    expect(slotForNowInVn(new Date("2026-10-25T15:00:00Z"))).toBe("afternoon");
  });
});

describe("daysInMonth", () => {
  it.each([
    [2026, 1, 31],
    [2026, 2, 28],
    [2026, 4, 30],
    [2026, 12, 31],
    [2024, 2, 29], // leap year
    [2000, 2, 29], // divisible by 400
    [1900, 2, 28], // divisible by 100 but not 400
  ])("%i-%i has %i days", (y, m, expected) => {
    expect(daysInMonth(y, m)).toBe(expected);
  });
});

describe("weekdayMondayFirst", () => {
  it("returns 0 for Monday and 6 for Sunday", () => {
    // 2026-10-26 is a Monday.
    expect(weekdayMondayFirst(2026, 10, 26)).toBe(0);
    expect(weekdayMondayFirst(2026, 10, 25)).toBe(6); // Sunday
    expect(weekdayMondayFirst(2026, 10, 27)).toBe(1); // Tuesday
  });
});

describe("addMonths", () => {
  it("moves forward across a year boundary", () => {
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({
      year: 2027,
      month: 1,
    });
  });

  it("moves backward across a year boundary", () => {
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({
      year: 2025,
      month: 12,
    });
  });

  it("handles a jump of more than a year in either direction", () => {
    expect(addMonths({ year: 2026, month: 6 }, 14)).toEqual({
      year: 2027,
      month: 8,
    });
    expect(addMonths({ year: 2026, month: 6 }, -18)).toEqual({
      year: 2024,
      month: 12,
    });
  });

  it("is a no-op for zero", () => {
    expect(addMonths({ year: 2026, month: 3 }, 0)).toEqual({
      year: 2026,
      month: 3,
    });
  });
});

describe("monthRange", () => {
  it("covers the whole month inclusively", () => {
    expect(monthRange({ year: 2026, month: 2 })).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
    expect(monthRange({ year: 2024, month: 2 })).toEqual({
      from: "2024-02-01",
      to: "2024-02-29",
    });
  });
});

describe("parseIsoDate / toIsoDate", () => {
  it("round-trips", () => {
    const parsed = parseIsoDate("2026-10-25");
    expect(parsed).toEqual({ year: 2026, month: 10, day: 25 });
    expect(toIsoDate(parsed.year, parsed.month, parsed.day)).toBe("2026-10-25");
  });

  it.each([
    "2026-13-01",
    "2026-00-01",
    "2026-02-30",
    "2026-2-5",
    "25/10/2026",
    "",
  ])("rejects %s", (bad) => {
    expect(() => parseIsoDate(bad)).toThrow();
  });

  it("accepts 29 February in a leap year only", () => {
    expect(() => parseIsoDate("2024-02-29")).not.toThrow();
    expect(() => parseIsoDate("2026-02-29")).toThrow();
  });
});

describe("buildMonthGrid", () => {
  it("always returns six rows, so the page never reflows", () => {
    for (const ym of [
      { year: 2026, month: 2 }, // 28 days, starts Sunday
      { year: 2026, month: 10 },
      { year: 2024, month: 2 }, // leap
      { year: 2026, month: 8 }, // 31 days
    ]) {
      expect(buildMonthGrid(ym)).toHaveLength(42);
    }
  });

  it("starts on the Monday of the first week", () => {
    // 2026-10-01 is a Thursday, so the grid opens on Monday 2026-09-28.
    const cells = buildMonthGrid({ year: 2026, month: 10 });
    expect(cells[0]).toEqual({ iso: "2026-09-28", day: 28, inMonth: false });
    expect(weekdayMondayFirst(2026, 9, 28)).toBe(0);
  });

  it("marks exactly the real days of the month as inMonth", () => {
    const cells = buildMonthGrid({ year: 2026, month: 2 });
    const inside = cells.filter((c) => c.inMonth);
    expect(inside).toHaveLength(28);
    expect(inside[0].iso).toBe("2026-02-01");
    expect(inside.at(-1)!.iso).toBe("2026-02-28");
  });

  it("handles a month that itself begins on a Monday", () => {
    // 2026-06-01 is a Monday — no leading days borrowed.
    const cells = buildMonthGrid({ year: 2026, month: 6 });
    expect(cells[0]).toEqual({ iso: "2026-06-01", day: 1, inMonth: true });
  });

  it("produces unique, chronologically ordered keys", () => {
    const cells = buildMonthGrid({ year: 2026, month: 10 });
    const isos = cells.map((c) => c.iso);
    expect(new Set(isos).size).toBe(42);
    expect([...isos].sort()).toEqual(isos);
  });

  it("borrows from the right neighbouring months across a year boundary", () => {
    const cells = buildMonthGrid({ year: 2026, month: 1 });
    expect(cells[0].iso.startsWith("2025-12")).toBe(true);
    expect(cells.at(-1)!.iso.startsWith("2026-02")).toBe(true);
  });
});
