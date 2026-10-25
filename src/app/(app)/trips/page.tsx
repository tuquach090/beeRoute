import type { Metadata } from "next";
import { TripCalendar } from "@/components/trip-calendar";
import { listTripsForMonth } from "@/lib/trips/queries";
import { parseIsoDate, todayInVn, type YearMonth } from "@/lib/dates/vn-date";
import { vi } from "@/lib/i18n/vi";

export const metadata: Metadata = { title: vi.trips.title };

/** "YYYY-MM" from the query string, or the month containing today in Vietnam. */
function resolveMonth(raw: string | undefined, today: string): YearMonth {
  const m = typeof raw === "string" ? /^(\d{4})-(\d{2})$/.exec(raw) : null;
  if (m) {
    const month = Number(m[2]);
    if (month >= 1 && month <= 12) return { year: Number(m[1]), month };
  }
  const t = parseIsoDate(today);
  return { year: t.year, month: t.month };
}

export default async function TripsPage({ searchParams }: PageProps<"/trips">) {
  const { m, d } = await searchParams;

  // todayInVn, not new Date(): the server runs in UTC and would call a 6am
  // Vietnam trip "yesterday".
  const today = todayInVn();
  const month = resolveMonth(typeof m === "string" ? m : undefined, today);

  const selected =
    typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : today;

  const trips = await listTripsForMonth(month);

  return (
    <TripCalendar
      month={month}
      today={today}
      trips={trips}
      initialSelected={selected}
    />
  );
}
