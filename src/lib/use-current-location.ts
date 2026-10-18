"use client";

import { useCallback, useState } from "react";
import type { LatLng } from "@/lib/route-draft";
import { vi } from "@/lib/i18n/vi";

/**
 * Reads the browser's Geolocation API on demand, rather than on mount: asking
 * for the permission prompt before the user has pressed anything is hostile,
 * and the position should be fresh at the moment the route is built
 * (CLAUDE.md §5.2c).
 */
export function useCurrentLocation() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const request = useCallback((): Promise<LatLng | null> => {
    setError(null);

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError(vi.geo.unsupported);
      return Promise.resolve(null);
    }

    setPending(true);
    return new Promise<LatLng | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPending(false);
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          setPending(false);
          setError(
            err.code === err.PERMISSION_DENIED
              ? vi.geo.denied
              : err.code === err.TIMEOUT
                ? vi.geo.timeout
                : vi.geo.failed,
          );
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
      );
    });
  }, []);

  return { request, error, pending, clearError: () => setError(null) };
}
