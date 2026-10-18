export type LatLng = { lat: number; lng: number };

export type GeocodeResult = {
  /** Stable id from the provider, used as a React key. */
  id: string;
  /** Human-readable address to show in the suggestion list. */
  label: string;
  location: LatLng;
};

/**
 * Swapping Nominatim for Google Places later means writing another one of
 * these, not touching the form.
 */
export interface Geocoder {
  search(query: string, signal?: AbortSignal): Promise<GeocodeResult[]>;
}

export function isValidLatLng(v: LatLng): boolean {
  return (
    Number.isFinite(v.lat) &&
    Number.isFinite(v.lng) &&
    v.lat >= -90 &&
    v.lat <= 90 &&
    v.lng >= -180 &&
    v.lng <= 180
  );
}
