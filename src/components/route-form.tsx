"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  AlertTriangle,
  Crosshair,
  ExternalLink,
  Flag,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  StickyNote,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CompanyPickerSheet } from "@/components/company-picker-sheet";
import { AddressInput } from "@/components/address-input";
import { useCurrentLocation } from "@/lib/use-current-location";
import { cn } from "@/lib/utils";
import { vi } from "@/lib/i18n/vi";
import type { CompanyWithContacts } from "@/lib/companies/queries";
import {
  getServerSnapshot,
  getSnapshot,
  subscribe,
  writeDraft,
  type EndpointMode,
  type LatLng,
  type RouteDraft,
  type TravelMode,
} from "@/lib/route-draft";
import { optimizeRoute } from "@/lib/route-optimizer/optimize";
import type { OptimizeResult } from "@/lib/route-optimizer/types";
import {
  buildGoogleMapsLinks,
  buildSingleStopLink,
  type RouteLeg,
  type StopLabel,
} from "@/lib/google-maps/build-links";

type Props = {
  companies: CompanyWithContacts[];
  addedId?: string;
};

type Computed = {
  result: OptimizeResult;
  links: RouteLeg[];
};

export function RouteForm({ companies, addedId }: Props) {
  const draft = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const geo = useCurrentLocation();

  const [computed, setComputed] = useState<Computed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  // The result lands below the fold on a phone, under the fixed action bar.
  // Without this the button looks like it did nothing.
  useEffect(() => {
    if (!computed) return;
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [computed]);

  useEffect(() => {
    if (!addedId) return;
    const current = getSnapshot();
    if (current.selectedIds.includes(addedId)) return;
    writeDraft({
      ...current,
      selectedIds: [...current.selectedIds, addedId],
    });
  }, [addedId]);

  function patch(next: Partial<RouteDraft>) {
    writeDraft({ ...getSnapshot(), ...next });
    // Any input change invalidates a result computed from the old inputs.
    setComputed(null);
  }

  const selected = draft.selectedIds
    .map((id) => companies.find((c) => c.id === id))
    .filter((c): c is CompanyWithContacts => Boolean(c));

  /** Resolves one endpoint to coordinates, asking the browser when needed. */
  async function resolveEndpoint(which: "start" | "end") {
    const mode = which === "start" ? draft.startMode : draft.endMode;
    if (mode === "current") {
      // Read the position now rather than reusing a stale fix (CLAUDE.md §5.2c).
      return geo.request();
    }
    return which === "start" ? draft.startLocation : draft.endLocation;
  }

  async function onOptimize() {
    setError(null);
    setComputed(null);

    if (selected.length === 0) {
      setError(vi.route.errorNoDestinations);
      return;
    }

    setWorking(true);
    try {
      const start = await resolveEndpoint("start");
      if (!start) {
        setError(geo.error ?? vi.route.errorNoStart);
        return;
      }
      const end = await resolveEndpoint("end");
      if (!end) {
        setError(geo.error ?? vi.route.errorNoEnd);
        return;
      }

      // Runs in the browser, no server round trip (CLAUDE.md §5.2d).
      const result = optimizeRoute({
        start,
        end,
        stops: selected.map((c) => ({
          id: c.id,
          label: c.display_name,
          location: { lat: c.lat, lng: c.lng },
        })),
      });

      // Give Maps the company name and address so each stop shows a real
      // label instead of "Đã thả ghim".
      const labels = new Map<string, StopLabel>(
        selected.map((c) => [
          c.id,
          { name: c.display_name, address: c.address },
        ]),
      );

      setComputed({
        result,
        links: buildGoogleMapsLinks(
          result,
          start,
          end,
          draft.travelMode,
          labels,
        ),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : vi.route.errorGeneric);
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-5 pb-40">
      <h1 className="text-2xl font-bold tracking-tight">{vi.route.title}</h1>

      <Section icon={<MapPin className="size-4" />} title={vi.route.start}>
        <EndpointPicker
          mode={draft.startMode}
          address={draft.startAddress}
          location={draft.startLocation}
          onModeChange={(m) => patch({ startMode: m })}
          onAddressChange={(address, location) =>
            patch({ startAddress: address, startLocation: location })
          }
        />
      </Section>

      <Section
        icon={<Flag className="size-4" />}
        title={vi.route.destinations}
        badge={selected.length > 0 ? String(selected.length) : undefined}
      >
        {selected.length === 0 ? (
          <div className="rounded-xl border border-dashed p-5 text-center">
            <p className="text-sm font-medium">{vi.route.noDestinations}</p>
            <p className="text-muted-foreground mt-1 text-sm">
              {vi.route.noDestinationsHint}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {selected.map((c) => (
              <li
                key={c.id}
                className="bg-card flex items-start gap-3 rounded-xl border p-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{c.display_name}</span>
                  <span className="text-muted-foreground mt-0.5 block text-sm leading-5 wrap-anywhere">
                    {c.address}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={vi.route.removeDestination}
                  onClick={() =>
                    patch({
                      selectedIds: draft.selectedIds.filter((x) => x !== c.id),
                    })
                  }
                >
                  <X className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <CompanyPickerSheet
          companies={companies}
          selectedIds={draft.selectedIds}
          onConfirm={(ids) => patch({ selectedIds: ids })}
        />
      </Section>

      <Section icon={<Flag className="size-4" />} title={vi.route.end}>
        <EndpointPicker
          mode={draft.endMode}
          address={draft.endAddress}
          location={draft.endLocation}
          onModeChange={(m) => patch({ endMode: m })}
          onAddressChange={(address, location) =>
            patch({ endAddress: address, endLocation: location })
          }
        />
      </Section>

      <Section
        icon={<Crosshair className="size-4" />}
        title={vi.route.travelMode}
      >
        <div className="grid grid-cols-2 gap-2">
          <ModeButton
            active={draft.travelMode === "two-wheeler"}
            onClick={() => patch({ travelMode: "two-wheeler" as TravelMode })}
          >
            {vi.route.motorbike}
          </ModeButton>
          <ModeButton
            active={draft.travelMode === "driving"}
            onClick={() => patch({ travelMode: "driving" as TravelMode })}
          >
            {vi.route.car}
          </ModeButton>
        </div>
      </Section>

      {error && (
        <p className="bg-destructive/10 text-destructive flex gap-2 rounded-xl p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {computed && (
        <ResultCard
          ref={resultRef}
          computed={computed}
          companies={companies}
          startLabel={
            draft.startMode === "current"
              ? vi.route.useCurrentLocation
              : draft.startAddress
          }
          endLabel={
            draft.endMode === "current"
              ? vi.route.useCurrentLocation
              : draft.endAddress
          }
          travelMode={draft.travelMode}
        />
      )}

      <div
        className="bottom-tabbar bg-card/95 fixed inset-x-0 z-20 border-t px-4 py-3 backdrop-blur"
        style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto max-w-md">
          <Button
            className="h-action w-full gap-2 text-base font-semibold"
            onClick={onOptimize}
            disabled={working || geo.pending || selected.length === 0}
          >
            {(working || geo.pending) && (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            )}
            {geo.pending ? vi.route.locating : vi.route.optimize}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ResultCard({
  ref,
  computed,
  companies,
  startLabel,
  endLabel,
  travelMode,
}: {
  ref: React.Ref<HTMLDivElement>;
  computed: Computed;
  companies: CompanyWithContacts[];
  startLabel: string;
  endLabel: string;
  travelMode: TravelMode;
}) {
  const { result, links } = computed;
  const byId = new Map(companies.map((c) => [c.id, c]));

  return (
    <section ref={ref} className="bg-card scroll-mt-16 rounded-2xl border p-4">
      <h2 className="font-semibold">{vi.route.resultTitle}</h2>

      <ol className="mt-4">
        <Stop index={null} name={vi.route.startLabel} address={startLabel} />
        {result.orderedStops.map((s, i) => {
          const company = byId.get(s.id);
          return (
            <Stop
              key={s.id}
              index={i + 1}
              name={s.label}
              address={company?.address ?? ""}
              km={result.legsKm[i]}
              contacts={company?.company_contacts}
              note={company?.note}
              mapUrl={buildSingleStopLink(
                {
                  location: s.location,
                  name: company?.display_name ?? s.label,
                  address: company?.address,
                },
                travelMode,
              )}
            />
          );
        })}
        <Stop
          index={null}
          name={vi.route.endLabel}
          address={endLabel}
          km={result.legsKm[result.legsKm.length - 1]}
          last
        />
      </ol>

      <div className="mt-4 flex items-baseline justify-between border-t pt-4">
        <span className="text-muted-foreground text-sm">
          {vi.route.totalDistance}
        </span>
        <span className="tnum text-xl font-bold">
          {result.totalKm.toFixed(1)} {vi.common.km}
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
        {links.length > 1 && (
          <p className="text-muted-foreground text-xs leading-5">
            {vi.route.splitNote(links.length)}
          </p>
        )}
      </div>
    </section>
  );
}

function Section({
  icon,
  title,
  badge,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-muted-foreground flex items-center gap-2 text-sm font-semibold tracking-wide uppercase">
        <span aria-hidden>{icon}</span>
        {title}
        {badge && (
          <span className="tnum bg-accent text-accent-foreground rounded-full px-2 py-0.5 text-xs font-bold">
            {badge}
          </span>
        )}
      </h2>
      {children}
    </section>
  );
}

function EndpointPicker({
  mode,
  address,
  location,
  onModeChange,
  onAddressChange,
}: {
  mode: EndpointMode;
  address: string;
  location: LatLng | null;
  onModeChange: (m: EndpointMode) => void;
  onAddressChange: (address: string, location: LatLng | null) => void;
}) {
  const id = useId();
  return (
    <div className="bg-card space-y-3 rounded-xl border p-3">
      <div className="grid grid-cols-2 gap-2">
        <ModeButton
          active={mode === "current"}
          onClick={() => onModeChange("current")}
        >
          <Crosshair className="size-4" aria-hidden />
          {vi.route.useCurrentLocation}
        </ModeButton>
        <ModeButton
          active={mode === "address"}
          onClick={() => onModeChange("address")}
        >
          <MapPin className="size-4" aria-hidden />
          {vi.route.enterAddress}
        </ModeButton>
      </div>

      {mode === "current" ? (
        <p className="text-muted-foreground text-xs leading-5">
          {vi.route.currentLocationHint}
        </p>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor={id} className="sr-only">
            {vi.route.enterAddress}
          </Label>
          <AddressInput
            id={id}
            value={address}
            location={location}
            onChange={onAddressChange}
          />
        </div>
      )}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex h-12 items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors",
        active
          ? "border-primary bg-tint text-tint-foreground"
          : "bg-card text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function Stop({
  index,
  name,
  address,
  km,
  contacts,
  note,
  last,
  mapUrl,
}: {
  index: number | null;
  name: string;
  address: string;
  km?: number;
  contacts?: CompanyWithContacts["company_contacts"];
  note?: string | null;
  last?: boolean;
  mapUrl?: string;
}) {
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {!last && (
        <span
          className="bg-border absolute top-9 bottom-0 left-4 w-px"
          aria-hidden
        />
      )}
      <span
        className={cn(
          "tnum relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
          index === null
            ? "bg-muted text-muted-foreground"
            : "bg-primary text-primary-foreground",
        )}
      >
        {index ?? <MapPin className="size-4" aria-hidden />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-medium">{name}</span>
          {km !== undefined && (
            <span className="tnum text-muted-foreground shrink-0 text-sm">
              +{km.toFixed(1)} {vi.common.km}
            </span>
          )}
        </div>
        {address && (
          <p className="text-muted-foreground mt-0.5 text-sm leading-5 wrap-anywhere">
            {address}
          </p>
        )}

        {contacts && contacts.length > 0 && (
          <ul className="mt-2 space-y-1">
            {contacts.map((ct) => (
              <li key={ct.id}>
                {ct.phone ? (
                  <a
                    href={`tel:${ct.phone}`}
                    className="text-primary inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
                  >
                    <Phone className="size-3.5" aria-hidden />
                    <span className="tnum">{ct.phone}</span>
                    {ct.contact_name && (
                      <span className="text-muted-foreground font-normal">
                        · {ct.contact_name}
                      </span>
                    )}
                  </a>
                ) : (
                  <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
                    <Phone className="size-3.5" aria-hidden />
                    {ct.contact_name}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {note && (
          <p className="bg-muted mt-2 flex gap-1.5 rounded-lg p-2 text-sm leading-5">
            <StickyNote className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {note}
          </p>
        )}

        {mapUrl && (
          <Button asChild variant="outline" size="sm" className="mt-2 gap-1.5">
            <a href={mapUrl} target="_blank" rel="noopener noreferrer">
              <Navigation className="size-3.5" aria-hidden />
              {vi.route.openThisStop}
            </a>
          </Button>
        )}
      </div>
    </li>
  );
}
