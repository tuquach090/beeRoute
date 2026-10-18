"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { companySchema } from "@/lib/validation/company";

export type SaveResult =
  { ok: true; id: string } | { ok: false; message: string };

/**
 * Validates on the server as well as in the form. A client can post anything;
 * the browser-side check is only there to be fast and friendly.
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

  revalidatePath("/companies");
  revalidatePath("/");

  return { ok: true, id: data as string };
}

export async function deleteCompany(
  companyId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = await createClient();

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
