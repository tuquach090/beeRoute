/**
 * Where a company's "mã vào cổng" photo lives.
 *
 * Same private bucket as the delivery paperwork, under the owner's folder:
 * "<user_id>/companies/<file>". The first segment must be the owner for the
 * bucket policies to let them read and delete it (see trips/storage.ts), and
 * a check constraint on companies.gate_photo_path enforces the same thing.
 * "companies" cannot collide with a trip folder, which is a uuid.
 */
export function gatePhotoPath(userId: string, fileName: string): string {
  return `${userId}/companies/${fileName}`;
}

/**
 * Whether a path the browser sent back is one this user may attach.
 *
 * The bucket policies already stop anyone reading another user's file, but a
 * row pointing at one would be a photo its owner can never load or delete.
 * Exactly three segments, nothing that could walk out of the folder.
 */
export function isOwnGatePhotoPath(userId: string, path: string): boolean {
  const parts = path.split("/");
  return (
    parts.length === 3 &&
    parts[0] === userId &&
    parts[1] === "companies" &&
    /^[A-Za-z0-9-]+\.(jpg|png|webp)$/.test(parts[2])
  );
}
