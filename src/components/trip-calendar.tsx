"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  Plus,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { vi } from "@/lib/i18n/vi";
import {
  addMonths,
  buildMonthGrid,
  parseIsoDate,
  type YearMonth,
} from "@/lib/dates/vn-date";
import { dayMarks, type DayMarks, type SlotMark } from "@/lib/trips/classify";
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
            const marks = dayMarks(byDay.get(cell.iso) ?? []);
            const isSelected = cell.iso === selected;
            const isToday = cell.iso === today;

            return (
              <button
                key={cell.iso}
                type="button"
                onClick={() => setSelected(cell.iso)}
                aria-pressed={isSelected}
                aria-current={isToday ? "date" : undefined}
                aria-label={vi.calendar.dayLabel(cell.day, marks)}
                className={cn(
                  // 44px minimum so it is comfortably tappable one-handed.
                  "flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg py-1 transition-colors",
                  !cell.inMonth && "text-muted-foreground/40",
                  // A ring on a pale fill rather than a solid blue cell, so the
                  // coloured marks underneath keep their meaning when selected.
                  isSelected
                    ? "bg-tint text-tint-foreground ring-primary ring-2"
                    : "hover:bg-muted",
                )}
              >
                <span
                  className={cn(
                    "tnum text-sm",
                    isToday && "text-primary font-bold",
                    isSelected && "font-bold",
                  )}
                >
                  {cell.day}
                </span>
                <DayMarksView marks={marks} />
              </button>
            );
          })}
        </div>

        <Legend />
      </div>

      <DayDetail date={selected} trips={byDay.get(selected) ?? []} />
    </div>
  );
}

function monthHref(ym: YearMonth) {
  return `/trips?m=${ym.year}-${String(ym.month).padStart(2, "0")}`;
}

const SLOT_BAR: Record<SlotMark, string> = {
  none: "h-1 bg-border",
  trip: "h-1 bg-primary",
  // Thicker as well as violet, so it does not rest on colour alone.
  far: "h-1.5 bg-far",
};

/**
 * Two bars under the date — left Sáng, right Chiều — violet when that slot
 * went to a far province, plus a honey dot when a sample was taken that day.
 * Still legible in a ~48px cell on a 390px screen.
 */
function DayMarksView({ marks }: { marks: DayMarks }) {
  return (
    <span className="flex h-2 items-center gap-0.5" aria-hidden>
      <span className={cn("w-2.5 rounded-full", SLOT_BAR[marks.morning])} />
      <span className={cn("w-2.5 rounded-full", SLOT_BAR[marks.afternoon])} />
      {marks.sample && <SampleDot />}
    </span>
  );
}

/** Honey is 1.6:1 on white, so the ink ring is what makes it visible. */
function SampleDot() {
  return (
    <span className="bg-honey ring-foreground ml-0.5 size-1.5 rounded-full ring-1" />
  );
}

function Legend() {
  return (
    <ul className="text-muted-foreground mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t px-1 pt-2 text-xs">
      <li className="flex items-center gap-1.5">
        <span className="bg-primary h-1 w-2.5 rounded-full" aria-hidden />
        {vi.calendar.legendTrip}
      </li>
      <li className="flex items-center gap-1.5">
        <span className="bg-far h-1.5 w-2.5 rounded-full" aria-hidden />
        {vi.calendar.legendFar}
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="flex">
          <SampleDot />
        </span>
        {vi.calendar.legendSample}
      </li>
    </ul>
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
  const allDelivered =
    trip.stop_count > 0 && trip.delivered_count === trip.stop_count;

  return (
    <Link
      href={`/trips/${trip.id}`}
      className={cn(
        "hover:bg-muted flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors",
        // A coloured edge echoes the calendar mark for far trips.
        trip.is_far && "border-l-far border-l-4",
      )}
    >
      <span className="min-w-0 flex-1 space-y-1.5">
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium">
            {vi.trips.stopCount(trip.stop_count)}
          </span>
          <span className="tnum text-muted-foreground shrink-0 text-xs">
            {vi.trips.straightKm(trip.total_straight_km.toFixed(1))}
          </span>
        </span>

        {trip.stop_names.length > 0 && (
          <span className="text-muted-foreground line-clamp-2 block text-xs leading-5">
            {trip.stop_names.join(" → ")}
          </span>
        )}

        <span className="flex flex-wrap gap-1.5">
          {trip.is_far && (
            <span className="bg-far text-far-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold">
              <Truck className="size-3" aria-hidden />
              {vi.trips.far}
            </span>
          )}
          {trip.sample_count > 0 && (
            <span className="bg-accent text-accent-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold">
              <FlaskConical className="size-3" aria-hidden />
              {vi.trips.sampleBadge(trip.sample_count, trip.stop_count)}
            </span>
          )}
          <span
            className={cn(
              "tnum inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
              allDelivered
                ? "bg-tint text-tint-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            <Check className="size-3" aria-hidden />
            {vi.trips.deliveredCount(trip.delivered_count, trip.stop_count)}
          </span>
        </span>
      </span>
      <ChevronRight
        className="text-muted-foreground size-4 shrink-0"
        aria-hidden
      />
    </Link>
  );
}
