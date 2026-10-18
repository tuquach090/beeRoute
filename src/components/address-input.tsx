"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  formatLatLng,
  isMapsLink,
  parseMapsPlaceName,
  isUnresolvedShortLink,
  parseLocationInput,
} from "@/lib/geocoding/parse-location";
import type { GeocodeResult, LatLng } from "@/lib/geocoding/types";
import { vi } from "@/lib/i18n/vi";

const DEBOUNCE_MS = 500;
const MIN_QUERY_LENGTH = 4;

type Props = {
  value: string;
  location: LatLng | null;
  onChange: (address: string, location: LatLng | null) => void;
  placeholder?: string;
  id?: string;
  invalid?: boolean;
};

export function AddressInput({
  value,
  location,
  onChange,
  placeholder,
  id,
  invalid,
}: Props) {
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Set when a suggestion is picked, so the effect does not turn around and
  // search for the text it just wrote.
  const justPicked = useRef(false);

  // Classified during render — these are facts about `value`, not state.
  const text = value.trim();
  const pastedLocation = parseLocationInput(text);
  const shortLink = isUnresolvedShortLink(text);
  const shouldSearch =
    !pastedLocation && !shortLink && text.length >= MIN_QUERY_LENGTH;
  useEffect(() => {
    if (!shouldSearch) return;
    if (justPicked.current) {
      justPicked.current = false;
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(text)}`, {
          signal: controller.signal,
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? vi.address.failed);
        setResults(body.results ?? []);
        setOpen(true);
      } catch (e) {
        if (controller.signal.aborted) return;
        setFetchError(e instanceof Error ? e.message : vi.address.failed);
        setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [text, shouldSearch]);

  function handleInput(next: string) {
    const parsed = parseLocationInput(next);

    // Collapse a pasted Maps URL to its coordinates straight away. Keeping the
    // raw link in the field is unreadable, and it is what ends up saved as the
    // address if the reverse lookup below never completes.
    //
    // Only for links: reformatting a coordinate pair while it is being typed
    // by hand would fight the user.
    if (parsed && isMapsLink(next)) {
      // Google's own name for the place beats anything a reverse lookup will
      // guess from the coordinates. Only fall back to numbers without one.
      const placeName = parseMapsPlaceName(next);
      onChange(placeName ?? formatLatLng(parsed), parsed);
      return;
    }

    onChange(next, parsed);
  }

  function pick(result: GeocodeResult) {
    justPicked.current = true;
    onChange(result.label, result.location);
    setOpen(false);
    setResults([]);
  }

  // Stale results must not show while the input no longer warrants a search.
  const visibleResults = shouldSearch ? results : [];
  const hint = shortLink
    ? vi.address.shortLink
    : shouldSearch && fetchError
      ? fetchError
      : vi.address.hint;

  return (
    <div className="relative">
      <div className="relative">
        <Input
          id={id}
          value={value}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => visibleResults.length > 0 && setOpen(true)}
          placeholder={placeholder ?? vi.address.placeholder}
          className={cn("h-12 pr-9", invalid && "border-destructive")}
          autoComplete="off"
        />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground">
          {loading && shouldSearch ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Search className="size-4" aria-hidden />
          )}
        </span>
      </div>

      {open && visibleResults.length > 0 && (
        <ul
          className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border bg-popover p-1 shadow-lg"
          role="listbox"
        >
          {visibleResults.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => pick(r)}
                className="w-full rounded-lg px-3 py-2.5 text-left text-sm leading-5 hover:bg-muted"
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      {location ? (
        <p className="bg-tint text-tint-foreground mt-2 flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          <span className="font-medium">{vi.companyForm.coordinates}:</span>
          <span className="tnum font-mono">{formatLatLng(location)}</span>
        </p>
      ) : (
        <p className="text-muted-foreground mt-2 text-xs">{hint}</p>
      )}
    </div>
  );
}
