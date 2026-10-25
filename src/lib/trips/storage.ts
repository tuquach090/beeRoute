export const PHOTO_BUCKET = "delivery-photos";

/** How many photos one stop may carry. Enforced in the UI and the action. */
export const MAX_PHOTOS_PER_STOP = 6;

/** Signed URLs last an hour; long enough for a delivery round, short enough to matter. */
export const SIGNED_URL_TTL_SECONDS = 3600;

/**
 * Object key for one photo.
 *
 * The FIRST segment must be the owner's id: every storage policy authorises by
 * `(storage.foldername(name))[1] = auth.uid()::text`, with no join back to the
 * database. Change this shape and uploads start failing with a permission
 * error that points nowhere near here.
 */
export function photoPath(
  userId: string,
  tripId: string,
  stopId: string,
  fileName: string,
): string {
  return `${userId}/${tripId}/${stopId}/${fileName}`;
}

/** A collision-proof file name. crypto.randomUUID exists in every target browser. */
export function newPhotoFileName(extension = "jpg"): string {
  return `${crypto.randomUUID()}.${extension}`;
}

/** Picks the file extension from the blob type the compressor produced. */
export function extensionForType(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}
