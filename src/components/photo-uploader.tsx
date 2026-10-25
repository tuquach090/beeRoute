"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { compressImage, formatBytes } from "@/lib/images/compress";
import {
  MAX_PHOTOS_PER_STOP,
  PHOTO_BUCKET,
  extensionForType,
  newPhotoFileName,
  photoPath,
} from "@/lib/trips/storage";
import { deletePhoto, registerPhoto } from "@/lib/trips/actions";
import { cn } from "@/lib/utils";
import { vi } from "@/lib/i18n/vi";
import type { TripStopPhotoView } from "@/lib/trips/queries";
import type { PhotoKind } from "@/types/database";

const KINDS: PhotoKind[] = ["order", "receipt", "warehouse", "sample"];

type Props = {
  userId: string;
  tripId: string;
  stopId: string;
  photos: TripStopPhotoView[];
  onChanged: () => void;
};

export function PhotoUploader({
  userId,
  tripId,
  stopId,
  photos,
  onChanged,
}: Props) {
  const [kind, setKind] = useState<PhotoKind>("order");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  const atLimit = photos.length >= MAX_PHOTOS_PER_STOP;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);

    const supabase = createClient();
    let remaining = MAX_PHOTOS_PER_STOP - photos.length;

    for (const file of Array.from(files)) {
      if (remaining <= 0) {
        setError(vi.photos.limit(MAX_PHOTOS_PER_STOP));
        break;
      }

      try {
        setBusy(vi.photos.compressing);
        const { blob, compressed, originalBytes, bytes } =
          await compressImage(file);

        setBusy(vi.photos.uploading);
        const path = photoPath(
          userId,
          tripId,
          stopId,
          newPhotoFileName(extensionForType(blob.type)),
        );

        const { error: uploadError } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(path, blob, {
            contentType: blob.type || "image/jpeg",
            upsert: false,
          });

        if (uploadError) throw new Error(uploadError.message);

        const result = await registerPhoto({
          stopId,
          storagePath: path,
          kind,
          note: compressed
            ? vi.photos.compressed(
                formatBytes(originalBytes),
                formatBytes(bytes),
              )
            : null,
        });

        if (!result.ok) {
          // The object is already in the bucket with nothing pointing at it.
          // Remove it, or it eats quota forever with no way to find it again.
          await supabase.storage.from(PHOTO_BUCKET).remove([path]);
          throw new Error(result.message);
        }

        remaining -= 1;
        onChanged();
      } catch (e) {
        setError(e instanceof Error ? e.message : vi.photos.failed);
        break;
      } finally {
        setBusy(null);
      }
    }

    // Clear both inputs so picking the same file twice still fires onChange.
    if (cameraRef.current) cameraRef.current.value = "";
    if (libraryRef.current) libraryRef.current.value = "";
  }

  async function onDelete(photoId: string) {
    setError(null);
    setBusy(vi.photos.delete);
    const result = await deletePhoto(photoId);
    setBusy(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onChanged();
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">{vi.photos.title}</p>

      <div>
        <p className="text-muted-foreground mb-1.5 text-xs">
          {vi.photos.kindLabel}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              aria-pressed={kind === k}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                kind === k
                  ? "border-primary bg-tint text-tint-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {vi.photos.kinds[k]}
            </button>
          ))}
        </div>
      </div>

      {photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <li key={p.id} className="relative">
              {p.signed_url ? (
                <a
                  href={p.signed_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {/* Signed URLs expire and change, so next/image would cache
                      against a URL that stops resolving within the hour. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.signed_url}
                    alt={vi.photos.kinds[p.kind]}
                    loading="lazy"
                    decoding="async"
                    className="aspect-square w-full rounded-lg border object-cover"
                  />
                </a>
              ) : (
                <div className="bg-muted text-muted-foreground flex aspect-square w-full items-center justify-center rounded-lg border p-2 text-center text-[10px]">
                  {vi.photos.expired}
                </div>
              )}

              <span className="bg-ink/70 absolute bottom-1 left-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-white">
                {vi.photos.kinds[p.kind]}
              </span>

              <Button
                variant="ghost"
                size="icon"
                className="bg-card/90 absolute top-1 right-1 size-7 rounded-full"
                aria-label={vi.photos.delete}
                onClick={() => onDelete(p.id)}
                disabled={busy !== null}
              >
                <X className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {photos.length === 0 && (
        <p className="text-muted-foreground text-xs">{vi.photos.empty}</p>
      )}

      {/* Two separate inputs: capture="environment" opens the camera but on
          iOS it also REMOVES the library option, which is wrong when the photo
          was already taken with the native camera. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="secondary"
          className="h-12 gap-2 font-semibold"
          onClick={() => cameraRef.current?.click()}
          disabled={busy !== null || atLimit}
        >
          <Camera className="size-4" aria-hidden />
          {vi.photos.take}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-12 gap-2"
          onClick={() => libraryRef.current?.click()}
          disabled={busy !== null || atLimit}
        >
          <ImagePlus className="size-4" aria-hidden />
          {vi.photos.pick}
        </Button>
      </div>

      {atLimit && (
        <p className="text-muted-foreground text-xs">
          {vi.photos.limit(MAX_PHOTOS_PER_STOP)}
        </p>
      )}

      {busy && (
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          {busy}
        </p>
      )}

      {error && (
        <p className="bg-destructive/10 text-destructive flex gap-2 rounded-lg p-2.5 text-xs">
          <Trash2 className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}
