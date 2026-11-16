"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { settingsSchema } from "@/lib/validation/settings";

export type ActionResult = { ok: true } | { ok: false; message: string };

/**
 * Writes the default start point onto the caller's profile.
 *
 * Validated here as well as in the form: the browser check is only there to
 * be quick, and a client can post whatever it likes.
 */
export async function saveSettings(raw: unknown): Promise<ActionResult> {
  const parsed = settingsSchema.safeParse(raw);
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

  // Update, not upsert: the profile row is created by the handle_new_user
  // trigger at first sign-in, and an upsert here would need an id the
  // policies would then have to be trusted to check.
  const { error } = await supabase
    .from("profiles")
    .update({
      default_start_label: v.defaultStartLabel,
      default_start_lat: v.defaultStartLat,
      default_start_lng: v.defaultStartLng,
    })
    .eq("id", user.id);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/settings");
  // The route form preselects this, so its cached render is now stale.
  revalidatePath("/");

  return { ok: true };
}
