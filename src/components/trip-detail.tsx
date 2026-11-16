"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ExternalLink,
  MapPin,
  Navigation,
  Pencil,
  Phone,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PhotoUploader } from "@/components/photo-uploader";
import {
  deleteTrip,
  setStopDelivered,
  setStopNote,
  setStopSample,
} from "@/lib/trips/actions";
import {
  buildGoogleMapsLinks,
  buildSingleStopLink,
  type StopLabel,
} from "@/lib/google-maps/build-links";
import { parseIsoDate } from "@/lib/dates/vn-date";
import { cn } from "@/lib/utils";
import { vi } from "@/lib/i18n/vi";
import type { TripDetail, TripStopView } from "@/lib/trips/queries";

export function TripDetailView({
  trip,
  userId,
}: {
  trip: TripDetail;
  userId: string;
}) {
  const router = useRouter();
  const [deleting, startDelete] = useTransition();

  const { year, month, day } = parseIsoDate(trip.trip_date);
  const slotLabel =
    trip.slot === "morning" ? vi.trips.morning : vi.trips.afternoon;

  // The snapshot holds the coordinates, so the Maps links still work months on.
  const labels = new Map<string, StopLabel>(
    trip.stops.map((s) => [s.id, { name: s.display_name, address: s.address }]),
  );
  const links = buildGoogleMapsLinks(
    {
      orderedStops: trip.stops.map((s) => ({
        id: s.id,
        label: s.display_name,
        location: { lat: s.lat, lng: s.lng },
      })),
    },
    { lat: trip.start_lat, lng: trip.start_lng },
    // Trips saved before the end point was dropped still have one; newer ones
    // finish at the last delivery.
    trip.end_lat !== null && trip.end_lng !== null
      ? { lat: trip.end_lat, lng: trip.end_lng }
      : null,
    trip.travel_mode,
    labels,
  );

  function onDelete() {
    startDelete(async () => {
      const result = await deleteTrip(trip.id);
      if (!result.ok) return;
      router.push(`/trips?d=${trip.trip_date}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5 pb-24">
      <div className="flex items-center gap-1">
        <Button asChild variant="ghost" size="icon" aria-label={vi.common.back}>
          <Link href={`/trips?d=${trip.trip_date}`}>
            <ChevronLeft className="size-5" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="tnum text-xl font-bold tracking-tight">
            {day}/{month}/{year}
          </h1>
          <p className="text-muted-foreground text-sm">
            {slotLabel} ·{" "}
            {trip.slot_position === 0 ? vi.trips.mainTrip : vi.trips.extraTrips}
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link href={`/trips/${trip.id}/edit`}>
            <Pencil className="size-3.5" aria-hidden />
            {vi.tripDetail.edit}
          </Link>
        </Button>
      </div>

      <ol>
        <Endpoint label={vi.route.startLabel} value={trip.start_label} />
        {trip.stops.map((stop, i) => (
          <StopRow
            key={stop.id}
            index={i + 1}
            stop={stop}
            last={trip.end_label === null && i === trip.stops.length - 1}
            userId={userId}
            tripId={trip.id}
            mapUrl={buildSingleStopLink(
              {
                location: { lat: stop.lat, lng: stop.lng },
                name: stop.display_name,
                address: stop.address,
              },
              trip.travel_mode,
            )}
            onChanged={() => router.refresh()}
          />
        ))}
        {trip.end_label !== null && (
          <Endpoint label={vi.route.endLabel} value={trip.end_label} last />
        )}
      </ol>

      <div className="bg-card rounded-2xl border p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-muted-foreground text-sm">
            {vi.route.totalDistance}
          </span>
          <span className="tnum text-xl font-bold">
            {trip.total_straight_km.toFixed(1)} {vi.common.km}
          </span>
        </div>
        <p className="text-muted-foreground mt-2 text-xs leading-5">
          {vi.route.straightLineNote}
        </p>

        <div className="mt-4 space-y-2">
          {links.map((leg) => (
            <Button
              key={leg.index}
              asChild
              className="h-action w-full gap-2 text-base font-semibold"
            >
              <a href={leg.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-5" aria-hidden />
                {links.length === 1
                  ? vi.route.openInMaps
                  : vi.route.openLeg(leg.index)}
              </a>
            </Button>
          ))}
        </div>
      </div>

      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            className="text-destructive h-12 w-full gap-2"
          >
            <Trash2 className="size-4" aria-hidden />
            {vi.trips.delete}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-xs rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-left">
              {vi.trips.deleteConfirmTitle}
            </DialogTitle>
            <DialogDescription className="text-left">
              {vi.trips.deleteConfirmBody}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-3">
            <DialogClose asChild>
              <Button variant="outline" className="h-12 flex-1">
                {vi.companyForm.cancel}
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              className="h-12 flex-1"
              onClick={onDelete}
              disabled={deleting}
            >
              {vi.trips.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Endpoint({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <li className="relative flex gap-3 pb-4">
      {!last && (
        <span
          className="bg-border absolute top-9 bottom-0 left-4 w-px"
          aria-hidden
        />
      )}
      <span className="bg-muted text-muted-foreground relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full">
        <MapPin className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <span className="font-medium">{label}</span>
        <p className="text-muted-foreground mt-0.5 text-sm leading-5 wrap-anywhere">
          {value}
        </p>
      </div>
    </li>
  );
}

function StopRow({
  index,
  stop,
  userId,
  tripId,
  mapUrl,
  last,
  onChanged,
}: {
  index: number;
  stop: TripStopView;
  userId: string;
  tripId: string;
  mapUrl: string;
  /** True for the final row, so it does not trail a connector into nothing. */
  last?: boolean;
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();
  // Mirrored locally so the switch and the tick respond instantly; the server
  // is the source of truth on the next refresh.
  const [sample, setSample] = useState(stop.sample_taken);
  const [delivered, setDelivered] = useState(Boolean(stop.delivered_at));
  const [note, setNote] = useState(stop.note ?? "");

  function toggleSample(next: boolean) {
    setSample(next);
    startTransition(async () => {
      const r = await setStopSample(stop.id, next);
      if (!r.ok) setSample(!next);
      else onChanged();
    });
  }

  function toggleDelivered() {
    const next = !delivered;
    setDelivered(next);
    startTransition(async () => {
      const r = await setStopDelivered(stop.id, next);
      if (!r.ok) setDelivered(!next);
      else onChanged();
    });
  }

  function saveNote() {
    if (note.trim() === (stop.note ?? "")) return;
    startTransition(async () => {
      await setStopNote(stop.id, note);
      onChanged();
    });
  }

  const deliveredTime = stop.delivered_at
    ? new Intl.DateTimeFormat("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Ho_Chi_Minh",
      }).format(new Date(stop.delivered_at))
    : null;

  return (
    <li className="relative flex gap-3 pb-4">
      {!last && (
        <span
          className="bg-border absolute top-9 bottom-0 left-4 w-px"
          aria-hidden
        />
      )}
      <span
        className={cn(
          "tnum relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
          delivered
            ? "bg-accent text-accent-foreground"
            : "bg-primary text-primary-foreground",
        )}
      >
        {delivered ? <Check className="size-4" aria-hidden /> : index}
      </span>

      <div className="bg-card min-w-0 flex-1 space-y-3 rounded-xl border p-3">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-medium">{stop.display_name}</span>
            {stop.leg_km !== null && (
              <span className="tnum text-muted-foreground shrink-0 text-sm">
                +{stop.leg_km.toFixed(1)} {vi.common.km}
              </span>
            )}
          </div>
          <p className="text-muted-foreground mt-0.5 text-sm leading-5 wrap-anywhere">
            {stop.address}
          </p>
        </div>

        {!stop.company_id && (
          <p className="bg-muted text-muted-foreground flex gap-1.5 rounded-lg p-2 text-xs leading-5">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {vi.tripDetail.companyGone}
          </p>
        )}

        {stop.contacts.length > 0 && (
          <ul className="space-y-1">
            {stop.contacts.map((c) => (
              <li key={c.id}>
                {c.phone ? (
                  <a
                    href={`tel:${c.phone}`}
                    className="text-primary inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
                  >
                    <Phone className="size-3.5" aria-hidden />
                    <span className="tnum">{c.phone}</span>
                    {c.contact_name && (
                      <span className="text-muted-foreground font-normal">
                        · {c.contact_name}
                      </span>
                    )}
                  </a>
                ) : (
                  <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
                    <Phone className="size-3.5" aria-hidden />
                    {c.contact_name}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <a href={mapUrl} target="_blank" rel="noopener noreferrer">
              <Navigation className="size-3.5" aria-hidden />
              {vi.route.openThisStop}
            </a>
          </Button>
          {stop.company_id && (
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <Link href={`/companies/${stop.company_id}/edit`}>
                <Pencil className="size-3.5" aria-hidden />
                {vi.tripDetail.editCompany}
              </Link>
            </Button>
          )}
        </div>

        <Button
          type="button"
          variant={delivered ? "secondary" : "default"}
          className="h-12 w-full gap-2 font-semibold"
          onClick={toggleDelivered}
          disabled={pending}
        >
          <Check className="size-4" aria-hidden />
          {deliveredTime
            ? vi.tripDetail.deliveredAt(deliveredTime)
            : vi.tripDetail.markDelivered}
        </Button>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
          <Switch
            checked={sample}
            onCheckedChange={toggleSample}
            disabled={pending}
          />
          <span>
            <span className="block text-sm font-semibold">
              {vi.tripDetail.sample}
            </span>
            <span className="text-muted-foreground mt-0.5 block text-xs leading-5">
              {vi.tripDetail.sampleHint}
            </span>
          </span>
        </label>

        <div className="space-y-1.5">
          <p className="text-sm font-semibold">{vi.tripDetail.stopNote}</p>
          <Textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={saveNote}
            placeholder={vi.tripDetail.stopNotePlaceholder}
          />
        </div>

        <PhotoUploader
          userId={userId}
          tripId={tripId}
          stopId={stop.id}
          photos={stop.photos}
          onChanged={onChanged}
        />
      </div>
    </li>
  );
}
