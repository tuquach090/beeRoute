/**
 * Shrinks a photo in the browser before it is uploaded.
 *
 * A phone camera shot is 2–4MB. The Supabase free tier gives 1GB of storage
 * and 5GB of egress a month, so uploading originals would fill it after a few
 * hundred receipts. At 1600px and JPEG 0.8 a receipt lands around 300KB and
 * the printed text is still readable.
 *
 * No library: canvas does all of it.
 */

export const MAX_EDGE_PX = 1600;
export const JPEG_QUALITY = 0.8;

export type Dimensions = { width: number; height: number };

/**
 * Scales the longest edge down to `maxEdge`, keeping the aspect ratio.
 * Images already smaller are left alone — upscaling only adds bytes.
 *
 * Split out from the canvas work so it can be unit tested; the rest needs a
 * real browser.
 */
export function fitWithin(
  source: Dimensions,
  maxEdge: number = MAX_EDGE_PX,
): Dimensions {
  const { width, height } = source;

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error("Kích thước ảnh không hợp lệ");
  }
  if (width <= 0 || height <= 0) {
    throw new Error("Kích thước ảnh không hợp lệ");
  }

  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };

  const scale = maxEdge / longest;
  return {
    // Round rather than floor so a 1-pixel loss does not accumulate, and clamp
    // to 1 so an extreme panorama never collapses to a zero-width canvas.
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Formats every browser can render, so an original is safe to keep as-is. */
const DISPLAYABLE = new Set(["image/jpeg", "image/png", "image/webp"]);

export class UndecodableImageError extends Error {
  constructor() {
    super(
      "Ảnh định dạng HEIC nên máy không đọc được. Vào Cài đặt → Camera → Định dạng, " +
        'chọn "Tương thích nhất", hoặc lưu ảnh lại thành JPG rồi thử lại.',
    );
    this.name = "UndecodableImageError";
  }
}

export type CompressResult = {
  blob: Blob;
  /** False when the original was returned untouched. */
  compressed: boolean;
  originalBytes: number;
  bytes: number;
};

/**
 * Returns a compressed JPEG, or the original when it is already a format every
 * browser can show.
 *
 * Throws UndecodableImageError for anything else — in practice a HEIC picked
 * from an iPhone library, which only Safari can decode. Uploading those bytes
 * untouched would store a photo Android could never display, so failing loudly
 * with instructions beats failing silently months later.
 */
export async function compressImage(
  file: File,
  maxEdge: number = MAX_EDGE_PX,
  quality: number = JPEG_QUALITY,
): Promise<CompressResult> {
  const original: CompressResult = {
    blob: file,
    compressed: false,
    originalBytes: file.size,
    bytes: file.size,
  };

  if (!file.type.startsWith("image/")) return original;

  let bitmap: ImageBitmap | null = null;
  try {
    // imageOrientation matters: iPhone photos carry EXIF orientation 6, and
    // without this the canvas draws them rotated 90 degrees.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

    const { width, height } = fitWithin(
      { width: bitmap.width, height: bitmap.height },
      maxEdge,
    );

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return keepOriginalOrFail(file, original);

    // A white ground: JPEG has no alpha, and a transparent PNG would otherwise
    // flatten to black.
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );

    if (!blob) return keepOriginalOrFail(file, original);

    // An already-small JPEG can come back larger after a re-encode.
    if (blob.size >= file.size) return keepOriginalOrFail(file, original);

    return {
      blob,
      compressed: true,
      originalBytes: file.size,
      bytes: blob.size,
    };
  } catch (e) {
    // Already the decision below, raised from inside the try.
    if (e instanceof UndecodableImageError) throw e;
    // Decoding failed outright — almost always HEIC outside Safari.
    return keepOriginalOrFail(file, original);
  } finally {
    bitmap?.close();
  }
}

function keepOriginalOrFail(file: File, original: CompressResult) {
  if (DISPLAYABLE.has(file.type)) return original;
  throw new UndecodableImageError();
}

/** "2.4 MB", "312 KB" — for showing how much a photo weighs. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
