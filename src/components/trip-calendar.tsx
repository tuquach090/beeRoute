"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { vi } from "@/lib/i18n/vi";
import {
  addMonths,
  buildMonthGrid,
  parseIsoDate,
  type YearMonth,
} from "@/lib/dates/vn-date";
import type { TripSummary } from "@/lib/trips/queries";
import type { TripSlot } from "@/types/database";

type Props = {
  month: YearMonth;
  today: string;
  /** Every trip in `month`, so tapping a day costs no round trip. */
  trips: TripSummary[];
  initialSelected: string;
};

export function TripCalendar({ month, today, trips, initialSelected }: Props) {
  const [selected, setSelected] = useState(initialSelected);

  const byDay = useMemo(() => {
    const map = new Map<string, TripSummary[]>();
    for (const t of trips) {
      const list = map.get(t.trip_date) ?? [];
      list.push(t);
      map.set(t.trip_date, list);
    }
    return map;
  }, [trips]);

  const cells = useMemo(() => buildMonthGrid(month), [month]);
  const prev = addMonths(month, -1);
  const next = addMonths(month, 1);
  const monthLabel = vi.calendar.monthYear(
    vi.calendar.months[month.month - 1],
    month.year,
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Button
          asChild
          variant="ghost"
          size="icon"
          aria-label={vi.calendar.prevMonth}
        >
          <Link href={monthHref(prev)}>
            <ChevronLeft className="size-5" />
          </Link>
        </Button>

        <h1 className="text-lg font-bold tracking-tight">{monthLabel}</h1>

        <Button
          asChild
          variant="ghost"
          size="icon"
          aria-label={vi.calendar.nextMonth}
        >
          <Link href={monthHref(next)}>
            <ChevronRight className="size-5" />
          </Link>
        </Button>
      </div>

      <div className="bg-card rounded-2xl border p-2">
        <div className="grid grid-cols-7">
          {vi.calendar.weekdays.map((w) => (
            <div
              key={w}
              className="text-muted-foreground py-1 text-center text-xs font-semibold"
            >
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((cell) => {
            const dayTrips = byDay.get(cell.iso) ?? [];
            const isSelected = cell.iso === selected;
            const isToday = cell.iso === today;

            return (
              <button
                key={cell.iso}
                type="button"
                onClick={() => setSelected(cell.iso)}
                aria-pressed={isSelected}
                aria-current={isToday ? "date" : undefined}
                className={cn(
                  // 44px minimum so it is comfortably tappable one-handed.
                  "flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg py-1 transition-colors",
                  !cell.inMonth && "text-muted-foreground/40",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted",
                )}
              >
                <span
                  className={cn(
                    "tnum text-sm",
                    isToday && !isSelected && "text-primary font-bold",
                    isSelected && "font-bold",
                  )}
                >
                  {cell.day}
                </span>
                <SlotMarks trips={dayTrips} selected={isSelected} />
              </button>
            );
          })}
        </div>
      </div>

      <DayDetail date={selected} trips={byDay.get(selected) ?? []} />
    </div>
  );
}

function monthHref(ym: YearMonth) {
  return `/trips?m=${ym.year}-${String(ym.month).padStart(2, "0")}`;
}

/**
 * Two bars under the date: left for Sáng, right for Chiều, filled when that
 * slot has a trip. More informative than a single dot, and still legible in a
 * ~48px cell on a 390px screen.
 */
function SlotMarks({
  trips,
  selected,
}: {
  trips: TripSummary[];
  selected: boolean;
}) {
  const has = (slot: TripSlot) => trips.some((t) => t.slot === slot);

  return (
    <span className="flex gap-0.5" aria-hidden>
      {(["morning", "afternoon"] as const).map((slot) => (
        <span
          key={slot}
          className={cn(
            "h-1 w-2.5 rounded-full",
            has(slot)
              ? selected
                ? "bg-primary-foreground"
                : "bg-primary"
              : selected
                ? "bg-primary-foreground/25"
                : "bg-border",
          )}
        />
      ))}
    </span>
  );
}

function DayDetail({ date, trips }: { date: string; trips: TripSummary[] }) {
  const { year, month, day } = parseIsoDate(date);
  const heading = `${day}/${month}/${year}`;

  return (
    <section className="space-y-4">
      <h2 className="tnum text-sm font-semibold tracking-wide uppercase">
        {heading}
      </h2>

      {(["morning", "afternoon"] as const).map((slot) => (
        <SlotBlock
          key={slot}
          slot={slot}
          date={date}
          trips={trips
            .filter((t) => t.slot === slot)
            .sort((a, b) => a.slot_position - b.slot_position)}
        />
      ))}
    </section>
  );
}

function SlotBlock({
  slot,
  date,
  trips,
}: {
  slot: TripSlot;
  date: string;
  trips: TripSummary[];
}) {
  const label = slot === "morning" ? vi.trips.morning : vi.trips.afternoon;
  const [main, ...extras] = trips;

  return (
    <div className="bg-card rounded-2xl border p-4">
      <h3 className="font-semibold">{label}</h3>

      <div className="mt-3">
        {main ? (
          <TripCard trip={main} />
        ) : (
          <div className="rounded-xl border border-dashed p-4 text-center">
            <p className="text-muted-foreground text-sm">
              {vi.trips.noTripThisSlot}
            </p>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="mt-3 gap-1.5"
            >
              <Link href={`/?date=${date}&slot=${slot}`}>
                <Plus className="size-4" aria-hidden />
                {vi.trips.createHere}
              </Link>
            </Button>
          </div>
        )}
      </div>

      {extras.length > 0 && (
        <div className="mt-4">
          <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
            {vi.trips.extraTrips}
          </p>
          <div className="space-y-2">
            {extras.map((t) => (
              <TripCard key={t.id} trip={t} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TripCard({ trip }: { trip: TripSummary }) {
  return (
    <Link
      href={`/trips/${trip.id}`}
      className="hover:bg-muted flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium">
          {vi.trips.stopCount(trip.stop_count)}
        </span>
        <span className="tnum text-muted-foreground mt-0.5 block text-xs">
          {vi.trips.straightKm(trip.total_straight_km.toFixed(1))}
        </span>
      </span>
      <ChevronRight
        className="text-muted-foreground size-4 shrink-0"
        aria-hidden
      />
    </Link>
  );
}
