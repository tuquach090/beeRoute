"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Home, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AddressInput } from "@/components/address-input";
import { saveSettings } from "@/lib/settings/actions";
import { vi } from "@/lib/i18n/vi";
import type { LatLng } from "@/lib/geocoding/types";
import type { DefaultStart } from "@/lib/settings/types";

export function SettingsForm({
  defaultStart,
}: {
  defaultStart: DefaultStart | null;
}) {
  const router = useRouter();
  const fieldId = useId();

  const [address, setAddress] = useState(defaultStart?.label ?? "");
  const [location, setLocation] = useState<LatLng | null>(
    defaultStart ? { lat: defaultStart.lat, lng: defaultStart.lng } : null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(next: { label: string; at: LatLng | null }) {
    setSaving(true);
    setError(null);
    setSaved(false);

    const trimmed = next.label.trim();
    const result = await saveSettings({
      // An empty box means "ask me every time", so the coordinates go with it
      // rather than lingering as a default nobody can see.
      defaultStartLabel: trimmed ? trimmed : null,
      defaultStartLat: trimmed ? (next.at?.lat ?? null) : null,
      defaultStartLng: trimmed ? (next.at?.lng ?? null) : null,
    });

    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }

    setSaved(true);
    router.refresh();
  }

  function onClear() {
    setAddress("");
    setLocation(null);
    void submit({ label: "", at: null });
  }

  return (
    <div className="space-y-5 pb-24">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {vi.settings.title}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm leading-5">
          {vi.settings.subtitle}
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-muted-foreground flex items-center gap-2 text-sm font-semibold tracking-wide uppercase">
          <Home className="size-4" aria-hidden />
          {vi.settings.defaultStart}
        </h2>

        <div className="bg-card space-y-3 rounded-xl border p-3">
          <Label htmlFor={fieldId} className="sr-only">
            {vi.settings.defaultStart}
          </Label>
          <AddressInput
            id={fieldId}
            value={address}
            location={location}
            onChange={(nextAddress, nextLocation) => {
              setAddress(nextAddress);
              setLocation(nextLocation);
              setSaved(false);
            }}
          />
          <p className="text-muted-foreground text-xs leading-5">
            {vi.settings.defaultStartHint}
          </p>
        </div>

        {!defaultStart && !address && (
          <p className="text-muted-foreground text-xs leading-5">
            {vi.settings.defaultStartEmpty}
          </p>
        )}

        {(defaultStart || address) && (
          <Button
            variant="outline"
            className="h-11 w-full gap-2"
            onClick={onClear}
            disabled={saving}
          >
            <Trash2 className="size-4" aria-hidden />
            {vi.settings.clear}
          </Button>
        )}
      </section>

      {error && (
        <p className="bg-destructive/10 text-destructive flex gap-2 rounded-xl p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {saved && !error && (
        <p className="text-primary flex items-center gap-2 text-sm font-medium">
          <Check className="size-4" aria-hidden />
          {vi.settings.saved}
        </p>
      )}

      <div
        className="bottom-tabbar bg-card/95 fixed inset-x-0 z-20 border-t px-4 py-3 backdrop-blur"
        style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto max-w-md">
          <Button
            className="h-action w-full gap-2 text-base font-semibold"
            onClick={() => submit({ label: address, at: location })}
            disabled={saving}
          >
            {saving && <Loader2 className="size-5 animate-spin" aria-hidden />}
            {saving ? vi.settings.saving : vi.settings.save}
          </Button>
        </div>
      </div>
    </div>
  );
}
