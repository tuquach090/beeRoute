export type LatLng = { lat: number; lng: number };

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
