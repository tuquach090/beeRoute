"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  registerPhotoSchema,
  tripSchema,
  type TripValues,
} from "@/lib/validation/trip";
import { MAX_PHOTOS_PER_STOP, PHOTO_BUCKET } from "./storage";
import type { Database } from "@/types/database";

type TripStopPatch = Database["public"]["Tables"]["trip_stops"]["Update"];

export type SaveTripResult =
  { ok: true; id: string } | { ok: false; message: string };

export type ActionResult = { ok: true } | { ok: false; message: string };

const EXPIRED = "Phiên đăng nhập đã hết hạn";

/**
 * Creates a trip, or overwrites the route of an existing one.
 *
 * Only the route shape travels here. The delivery record — delivered_at,
 * sample_taken, the per-stop note and every photo — is written by the other
 * actions below and is deliberately left alone by save_trip, which is what
 * lets a rider re-optimise mid-round without losing the receipts already shot.
 */
export async function saveTrip(
  tripId: string | null,
  raw: unknown,
): Promise<SaveTripResult> {
  const parsed = tripSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ",
    };
  }

  const v: TripValues = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: EXPIRED };

  const { data, error } = await supabase.rpc("save_trip", {
    p_trip_id: tripId,
    p_trip_date: v.tripDate,
    p_slot: v.slot,
    p_travel_mode: v.travelMode,
    p_start_label: v.startLabel,
    p_start_lat: v.startLat,
    p_start_lng: v.startLng,
    p_end_label: v.endLabel,
    p_end_lat: v.endLat,
    p_end_lng: v.endLng,
    p_total_km: v.totalKm,
    p_method: v.method,
    p_note: v.note,
    p_stops: v.stops.map((s) => ({
      stop_id: s.stopId,
      company_id: s.companyId,
      display_name: s.displayName,
      address: s.address,
      lat: s.lat,
      lng: s.lng,
      leg_km: s.legKm,
    })),
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/trips");
  if (tripId) revalidatePath(`/trips/${tripId}`);

  return { ok: true, id: data as string };
}

/**
 * Removes a trip, and the photo FILES with it.
 *
 * The foreign keys cascade the rows, but cascading does not touch Storage.
 * Left to the cascade alone every deleted trip would strand its images in a
 * 1GB bucket with no way to find them again, so the objects go first.
 */
export async function deleteTrip(tripId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: EXPIRED };

  const { data: stops, error: readError } = await supabase
    .from("trip_stops")
    .select("trip_stop_photos(storage_path)")
    .eq("trip_id", tripId);

  if (readError) return { ok: false, message: readError.message };

  const paths = (stops ?? []).flatMap((s) =>
    (
      (s as unknown as { trip_stop_photos: { storage_path: string }[] })
        .trip_stop_photos ?? []
    ).map((p) => p.storage_path),
  );

  if (paths.length > 0) {
    // A storage failure is not fatal: better an orphaned file than a trip the
    // user cannot delete. The rows still go.
    await supabase.storage.from(PHOTO_BUCKET).remove(paths);
  }

  const { error } = await supabase.from("trips").delete().eq("id", tripId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/trips");
  return { ok: true };
}

/** Marks a stop delivered, or clears it. The time is the server's, not the client's. */
export async function setStopDelivered(
  stopId: string,
  delivered: boolean,
): Promise<ActionResult> {
  return updateStop(stopId, {
    delivered_at: delivered ? new Date().toISOString() : null,
  });
}

export async function setStopSample(
  stopId: string,
  sampleTaken: boolean,
): Promise<ActionResult> {
  return updateStop(stopId, { sample_taken: sampleTaken });
}

export async function setStopNote(
  stopId: string,
  note: string,
): Promise<ActionResult> {
  const trimmed = note.trim();
  if (trimmed.length > 2000) {
    return { ok: false, message: "Ghi chú tối đa 2000 ký tự" };
  }
  return updateStop(stopId, { note: trimmed ? trimmed : null });
}

async function updateStop(
  stopId: string,
  patch: TripStopPatch,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: EXPIRED };

  // RLS restricts the update to stops on the caller's own trips.
  const { error } = await supabase
    .from("trip_stops")
    .update(patch)
    .eq("id", stopId);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/trips");
  return { ok: true };
}

/**
 * Records a photo that the browser has already uploaded.
 *
 * The upload is direct from the browser to Storage — the bytes never pass
 * through here, so the 1MB server-action body limit does not apply. If THIS
 * call fails the caller must delete the object it just uploaded, or the file
 * is stranded with nothing pointing at it.
 */
export async function registerPhoto(raw: unknown): Promise<ActionResult> {
  const parsed = registerPhotoSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ",
    };
  }

  const v = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: EXPIRED };

  const { count, error: countError } = await supabase
    .from("trip_stop_photos")
    .select("id", { count: "exact", head: true })
    .eq("trip_stop_id", v.stopId);

  if (countError) return { ok: false, message: countError.message };
  if ((count ?? 0) >= MAX_PHOTOS_PER_STOP) {
    return {
      ok: false,
      message: `Mỗi điểm tối đa ${MAX_PHOTOS_PER_STOP} ảnh`,
    };
  }

  const { error } = await supabase.from("trip_stop_photos").insert({
    trip_stop_id: v.stopId,
    storage_path: v.storagePath,
    kind: v.kind,
    note: v.note,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/trips");
  return { ok: true };
}

/** Deletes the file first, then the row — same reasoning as deleteTrip. */
export async function deletePhoto(photoId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: EXPIRED };

  const { data: photo, error: readError } = await supabase
    .from("trip_stop_photos")
    .select("storage_path")
    .eq("id", photoId)
    .maybeSingle();

  if (readError) return { ok: false, message: readError.message };
  if (!photo) return { ok: false, message: "Không tìm thấy ảnh" };

  await supabase.storage.from(PHOTO_BUCKET).remove([photo.storage_path]);

  const { error } = await supabase
    .from("trip_stop_photos")
    .delete()
    .eq("id", photoId);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/trips");
  return { ok: true };
}
