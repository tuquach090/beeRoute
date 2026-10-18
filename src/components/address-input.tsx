"use client";

import { Check, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  formatLatLng,
  isMapsLink,
  isUnresolvedShortLink,
  parseLocationInput,
  parseMapsPlaceName,
} from "@/lib/geocoding/parse-location";
import type { LatLng } from "@/lib/geocoding/types";
import { vi } from "@/lib/i18n/vi";

type Props = {
  value: string;
  location: LatLng | null;
  onChange: (address: string, location: LatLng | null) => void;
  placeholder?: string;
  id?: string;
  invalid?: boolean;
};

/**
 * Locations come from Google Maps links; nothing here queries a geocoder.
 *
 * The real workflow is to find the place on Google Maps first and paste the
 * link, so the link already carries both the name Google uses and the exact
 * coordinates. Asking a second geocoder to re-derive either one only adds a
 * way for the two to disagree.
 */
export function AddressInput({
  value,
  location,
  onChange,
  placeholder,
  id,
  invalid,
}: Props) {
  const text = value.trim();
  const shortLink = isUnresolvedShortLink(text);

  function handleInput(next: string) {
    const parsed = parseLocationInput(next);

    if (parsed && isMapsLink(next)) {
      // Google's own name for the place, with its exact coordinates.
      onChange(parseMapsPlaceName(next) ?? formatLatLng(parsed), parsed);
      return;
    }

    if (parsed) {
      // Coordinates typed or pasted directly.
      onChange(next, parsed);
      return;
    }

    // Plain text. Keep the coordinates already attached, so the name can be
    // shortened after pasting a link; emptying the field clears them.
    onChange(next, next.trim() ? location : null);
  }

  return (
    <div>
      <Input
        id={id}
        value={value}
        onChange={(e) => handleInput(e.target.value)}
        placeholder={placeholder ?? vi.address.placeholder}
        className={cn("h-12", invalid && "border-destructive")}
        autoComplete="off"
      />

      {location ? (
        <p className="bg-tint text-tint-foreground mt-2 flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs">
          <Check className="size-3.5 shrink-0" aria-hidden />
          <span className="font-medium">{vi.companyForm.coordinates}:</span>
          <span className="tnum font-mono">{formatLatLng(location)}</span>
        </p>
      ) : (
        <p
          className={cn(
            "mt-2 flex gap-1.5 text-xs leading-5",
            shortLink ? "text-destructive" : "text-muted-foreground",
          )}
        >
          <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {shortLink ? vi.address.shortLink : vi.address.hint}
        </p>
      )}
    </div>
  );
}
