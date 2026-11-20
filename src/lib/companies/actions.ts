"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { companySchema } from "@/lib/validation/company";
import { PHOTO_BUCKET } from "@/lib/trips/storage";
import { isOwnGatePhotoPath } from "./storage";

export type SaveResult =
  { ok: true; id: string } | { ok: false; message: string };

/**
 * Validates on the server as well as in the form. A client can post anything;
 * the browser-side check is only there to be fast and friendly.
 *
 * The gate photo is already in the bucket by the time this runs — the browser
 * uploads it directly, like delivery photos — so only its path arrives here.
 * If this returns ok: false the browser deletes the file it just uploaded.
 */
export async function saveCompany(
  companyId: string | null,
  raw: unknown,
): Promise<SaveResult> {
  const parsed = companySchema.safeParse(raw);
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
  if (!user) return { ok: false, message: "Phiên đăng nhập đã hết hạn" };

  if (
    v.gatePhotoPath !== null &&
    !isOwnGatePhotoPath(user.id, v.gatePhotoPath)
  ) {
    return { ok: false, message: "Ảnh mã vào cổng không hợp lệ" };
  }

  // Read before writing: once the row is updated, the old path is gone and
  // so is the only way to find the file it named.
  let previousPhoto: string | null = null;
  if (companyId) {
    const { data: current } = await supabase
      .from("companies")
      .select("gate_photo_path")
      .eq("id", companyId)
      .maybeSingle();
    previousPhoto = current?.gate_photo_path ?? null;
  }

  const { data, error } = await supabase.rpc("save_company", {
    p_company_id: companyId,
    p_display_name: v.displayName,
    p_address: v.address,
    p_lat: v.lat,
    p_lng: v.lng,
    p_note: v.note,
    p_is_public: v.isPublic,
    p_contacts: v.contacts.map((c) => ({
      contact_name: c.contactName,
      phone: c.phone,
    })),
  });

  if (error) return { ok: false, message: error.message };
  const id = data as string;

  // A separate statement rather than a new save_company parameter: changing
  // that signature means a second definition of the function (CLAUDE.md
  // §3.8). The cost is that the two writes are not one transaction.
  if (v.gatePhotoPath !== previousPhoto) {
    const { error: photoError } = await supabase
      .from("companies")
      .update({ gate_photo_path: v.gatePhotoPath })
      .eq("id", id);

    if (photoError) {
      return {
        ok: false,
        message: `Đã lưu công ty nhưng chưa lưu được ảnh mã vào cổng: ${photoError.message}`,
      };
    }

    // Row first, file second here, unlike deletes: the replaced file must
    // outlive the row that pointed at it, or a failed update above would
    // leave the company showing a broken image. A failure now only orphans
    // the old file (CLAUDE.md §12).
    if (previousPhoto) {
      await supabase.storage.from(PHOTO_BUCKET).remove([previousPhoto]);
    }
  }

  revalidatePath("/companies");
  revalidatePath("/");

  return { ok: true, id };
}

export async function deleteCompany(
  companyId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = await createClient();

  const { data: current } = await supabase
    .from("companies")
    .select("gate_photo_path")
    .eq("id", companyId)
    .maybeSingle();

  // File first, row second (CLAUDE.md §7): once the row is gone nothing
  // names the file. A storage failure is not fatal — better an orphaned
  // file than a company that cannot be deleted.
  if (current?.gate_photo_path) {
    await supabase.storage.from(PHOTO_BUCKET).remove([current.gate_photo_path]);
  }

  // RLS restricts deletes to the owner, so no ownership check is needed here.
  const { error } = await supabase
    .from("companies")
    .delete()
    .eq("id", companyId);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/companies");
  revalidatePath("/");

  return { ok: true };
}

/**
 * Folds every source company into the target and deletes the sources. The
 * whole database side is one transaction in merge_companies; see the
 * migration for what moves where.
 *
 * The RPC hands back the gate-photo files nothing points at any more, and
 * they are removed only after it has committed: a merge that fails must not
 * have deleted photos the companies still show.
 */
export async function mergeCompanies(
  targetId: string,
  sourceIds: string[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  const sources = [...new Set(sourceIds)].filter((id) => id !== targetId);
  if (sources.length === 0) {
    return { ok: false, message: "Chọn ít nhất một công ty để gộp" };
  }

  const supabase = await createClient();
  const { data: orphans, error } = await supabase.rpc("merge_companies", {
    p_target_id: targetId,
    p_source_ids: sources,
  });

  if (error) return { ok: false, message: error.message };

  if (orphans && orphans.length > 0) {
    await supabase.storage.from(PHOTO_BUCKET).remove(orphans);
  }

  revalidatePath("/companies");
  revalidatePath("/");
  revalidatePath("/trips", "layout");

  return { ok: true };
}
