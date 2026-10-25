"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarCheck, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { vi } from "@/lib/i18n/vi";
import { saveTrip } from "@/lib/trips/actions";
import { slotForNowInVn, todayInVn } from "@/lib/dates/vn-date";
import type { TripInput } from "@/lib/validation/trip";
import type { TripSlot } from "@/types/database";

type Props = {
  /** Everything except the date and slot, which this sheet collects. */
  buildValues: (date: string, slot: TripSlot) => TripInput;
  /** Set when overwriting an existing trip rather than creating one. */
  tripId?: string;
  defaultDate?: string;
  defaultSlot?: TripSlot;
  disabled?: boolean;
  /** Photos that will be destroyed because their stop left the route. */
  droppedPhotoCount?: number;
  droppedStopNames?: string[];
};

export function SaveTripSheet({
  buildValues,
  tripId,
  defaultDate,
  defaultSlot,
  disabled,
  droppedPhotoCount = 0,
  droppedStopNames = [],
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // todayInVn, not new Date(): at 6am Vietnam the UTC date is still yesterday.
  const [date, setDate] = useState(defaultDate ?? todayInVn());
  const [slot, setSlot] = useState<TripSlot>(defaultSlot ?? slotForNowInVn());

  async function onSave() {
    setSaving(true);
    setError(null);

    const result = await saveTrip(tripId ?? null, buildValues(date, slot));

    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }

    setOpen(false);
    router.push(`/trips/${result.id}`);
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          className="h-action w-full gap-2 text-base font-semibold"
          variant={tripId ? "default" : "secondary"}
          disabled={disabled}
        >
          <CalendarCheck className="size-5" aria-hidden />
          {tripId ? vi.saveTrip.update : vi.saveTrip.finish}
        </Button>
      </SheetTrigger>

      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader className="text-left">
          <SheetTitle>{vi.saveTrip.title}</SheetTitle>
          <SheetDescription>{vi.saveTrip.description}</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-2">
          <div className="space-y-2">
            <Label htmlFor="trip-date" className="text-sm font-semibold">
              {vi.saveTrip.date}
            </Label>
            {/* Native date input: on a phone this opens the OS date picker,
                which is better than anything we would build and costs no
                dependency. */}
            <Input
              id="trip-date"
              type="date"
              className="h-12"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold">{vi.saveTrip.slot}</p>
            <div className="grid grid-cols-2 gap-2">
              {(["morning", "afternoon"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSlot(s)}
                  aria-pressed={slot === s}
                  className={cn(
                    "flex h-12 items-center justify-center rounded-lg border text-sm font-medium transition-colors",
                    slot === s
                      ? "border-primary bg-tint text-tint-foreground"
                      : "bg-card text-muted-foreground hover:bg-muted",
                  )}
                >
                  {s === "morning" ? vi.trips.morning : vi.trips.afternoon}
                </button>
              ))}
            </div>
          </div>

          {droppedPhotoCount > 0 && (
            <p className="bg-destructive/10 text-destructive flex gap-2 rounded-xl p-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {vi.saveTrip.dropWarning(
                droppedStopNames.join(", "),
                droppedPhotoCount,
              )}
            </p>
          )}

          {error && (
            <p className="bg-destructive/10 text-destructive rounded-xl p-3 text-sm">
              {error}
            </p>
          )}
        </div>

        <SheetFooter
          className="flex-row gap-3"
          style={{
            paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))",
          }}
        >
          <Button
            variant="outline"
            className="h-action flex-1"
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            {vi.companyForm.cancel}
          </Button>
          <Button
            className="h-action flex-[2] gap-2 font-semibold"
            onClick={onSave}
            disabled={saving}
          >
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {saving ? vi.saveTrip.saving : vi.saveTrip.save}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
