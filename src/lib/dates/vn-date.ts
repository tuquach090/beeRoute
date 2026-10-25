import type { TripSlot } from "@/types/database";

/**
 * The only place in the app that asks what day or hour it is.
 *
 * Both Postgres `now()` and `new Date()` on Vercel run in UTC. Between 00:00
 * and 07:00 Vietnam time they still report the previous day, so a 06:30 run
 * would be filed under yesterday — wrong, silent, and infuriating to debug.
 * Everything here pins the answer to Asia/Ho_Chi_Minh.
 *
 * Below the two "what time is it" helpers, everything is integer arithmetic on
 * {y, m, d} with no timezone involved at all.
 */

export const VN_TIME_ZONE = "Asia/Ho_Chi_Minh";

/** Calendar date in Vietnam, as "YYYY-MM-DD". */
export function todayInVn(now: Date = new Date()): string {
  // formatToParts, not format(): assembling from named parts avoids depending
  // on how a locale happens to order or punctuate the pieces.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: VN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Which slot the current Vietnam hour falls in. Before noon is morning. */
export function slotForNowInVn(now: Date = new Date()): TripSlot {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: VN_TIME_ZONE,
      hour: "2-digit",
      hour12: false,
    })
      .formatToParts(now)
      .find((p) => p.type === "hour")?.value ?? "0",
  );

  // en-GB renders midnight as "24" in some runtimes; treat it as hour 0.
  const normalised = hour === 24 ? 0 : hour;
  return normalised < 12 ? "morning" : "afternoon";
}

export type YearMonth = { year: number; month: number };

/** "YYYY-MM-DD" → parts. Throws on anything that is not that exact shape. */
export function parseIsoDate(iso: string): {
  year: number;
  month: number;
  day: number;
} {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Ngày không hợp lệ: ${iso}`);

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);

  if (month < 1 || month > 12) throw new Error(`Ngày không hợp lệ: ${iso}`);
  if (day < 1 || day > daysInMonth(year, month)) {
    throw new Error(`Ngày không hợp lệ: ${iso}`);
  }

  return { year, month, day };
}

export function toIsoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** `month` is 1-based. Handles leap years. */
export function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 0 = Monday … 6 = Sunday, matching how a Vietnamese calendar is laid out. */
export function weekdayMondayFirst(
  year: number,
  month: number,
  day: number,
): number {
  // UTC getters only: a local-time Date would shift the weekday for anyone
  // running the app west of Greenwich.
  const sundayFirst = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return (sundayFirst + 6) % 7;
}

export function addMonths(ym: YearMonth, delta: number): YearMonth {
  const zeroBased = ym.year * 12 + (ym.month - 1) + delta;
  return {
    year: Math.floor(zeroBased / 12),
    month: (((zeroBased % 12) + 12) % 12) + 1,
  };
}

/** Inclusive first and last day of a month, for a `between` query. */
export function monthRange(ym: YearMonth): { from: string; to: string } {
  return {
    from: toIsoDate(ym.year, ym.month, 1),
    to: toIsoDate(ym.year, ym.month, daysInMonth(ym.year, ym.month)),
  };
}

export type CalendarCell = {
  /** "YYYY-MM-DD" — unique, so it doubles as the React key. */
  iso: string;
  day: number;
  /** False for the leading and trailing days borrowed from adjacent months. */
  inMonth: boolean;
};

/**
 * Always 42 cells, six rows of seven.
 *
 * Fixed height on purpose: a grid that grows to six rows only in some months
 * makes the page jump when you page through them.
 */
export function buildMonthGrid(ym: YearMonth): CalendarCell[] {
  const { year, month } = ym;
  const leading = weekdayMondayFirst(year, month, 1);

  const cells: CalendarCell[] = [];
  const prev = addMonths(ym, -1);
  const prevDays = daysInMonth(prev.year, prev.month);

  for (let i = leading - 1; i >= 0; i--) {
    const day = prevDays - i;
    cells.push({
      iso: toIsoDate(prev.year, prev.month, day),
      day,
      inMonth: false,
    });
  }

  const total = daysInMonth(year, month);
  for (let day = 1; day <= total; day++) {
    cells.push({ iso: toIsoDate(year, month, day), day, inMonth: true });
  }

  const next = addMonths(ym, 1);
  let day = 1;
  while (cells.length < 42) {
    cells.push({
      iso: toIsoDate(next.year, next.month, day),
      day,
      inMonth: false,
    });
    day++;
  }

  return cells;
}
