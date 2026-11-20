"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { compressImage } from "@/lib/images/compress";
import { vi } from "@/lib/i18n/vi";

/**
 * What the form will do with the gate photo on save. Nothing touches storage
 * until then: a photo picked and abandoned would otherwise sit in the bucket
 * with no row pointing at it.
 */
export type GatePhotoDraft =
  { kind: "keep" } | { kind: "remove" } | { kind: "new"; blob: Blob };

export function GatePhotoField({
  currentUrl,
  draft,
  onChange,
}: {
  /** Signed URL of the photo already saved, if any. */
  currentUrl: string | null;
  draft: GatePhotoDraft;
  onChange: (next: GatePhotoDraft) => void;
}) {
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  const previewUrl = useMemo(
    () => (draft.kind === "new" ? URL.createObjectURL(draft.blob) : null),
    [draft],
  );
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const shown =
    draft.kind === "new"
      ? previewUrl
      : draft.kind === "keep"
        ? currentUrl
        : null;

  async function handleFile(file: File | undefined) {
    // Cleared first so picking the same file again still fires onChange.
    if (cameraRef.current) cameraRef.current.value = "";
    if (libraryRef.current) libraryRef.current.value = "";
    if (!file) return;

    setError(null);
    setCompressing(true);
    try {
      const { blob } = await compressImage(file);
      onChange({ kind: "new", blob });
    } catch (e) {
      setError(e instanceof Error ? e.message : vi.photos.failed);
    } finally {
      setCompressing(false);
    }
  }

  return (
    <div className="space-y-3">
      {shown ? (
        <a
          href={shown}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          {/* A signed URL or a blob: URL — next/image can use neither. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={shown}
            alt={vi.companyForm.gatePhoto}
            className="bg-muted max-h-72 w-full rounded-xl border object-contain"
          />
        </a>
      ) : draft.kind === "remove" && currentUrl ? (
        <div className="bg-muted text-muted-foreground flex items-center justify-between gap-3 rounded-xl border p-3 text-sm">
          {vi.companyForm.gatePhotoWillRemove}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => onChange({ kind: "keep" })}
          >
            <RotateCcw className="size-3.5" aria-hidden />
            {vi.companyForm.gatePhotoUndo}
          </Button>
        </div>
      ) : (
        <p className="text-muted-foreground text-xs leading-5">
          {vi.companyForm.gatePhotoEmpty}
        </p>
      )}

      {draft.kind === "new" && (
        <p className="text-muted-foreground text-xs">
          {vi.companyForm.gatePhotoPending}
        </p>
      )}

      {/* Two inputs for the same reason as PhotoUploader: on iOS,
          capture="environment" removes the library option. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="secondary"
          className="h-12 gap-2 font-semibold"
          onClick={() => cameraRef.current?.click()}
          disabled={compressing}
        >
          <Camera className="size-4" aria-hidden />
          {shown ? vi.companyForm.gatePhotoRetake : vi.photos.take}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-12 gap-2"
          onClick={() => libraryRef.current?.click()}
          disabled={compressing}
        >
          <ImagePlus className="size-4" aria-hidden />
          {vi.photos.pick}
        </Button>
      </div>

      {shown && (
        <Button
          type="button"
          variant="ghost"
          className="text-destructive h-11 w-full gap-2"
          onClick={() =>
            // A photo picked but not saved yet just goes back to what is saved.
            onChange(
              draft.kind === "new" && !currentUrl
                ? { kind: "keep" }
                : { kind: "remove" },
            )
          }
          disabled={compressing}
        >
          <Trash2 className="size-4" aria-hidden />
          {vi.companyForm.gatePhotoRemove}
        </Button>
      )}

      {compressing && (
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          {vi.photos.compressing}
        </p>
      )}

      {error && (
        <p className="bg-destructive/10 text-destructive rounded-lg p-2.5 text-xs leading-5">
          {error}
        </p>
      )}
    </div>
  );
}
