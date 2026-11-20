import "server-only";
import { createClient } from "@/lib/supabase/server";
import { PHOTO_BUCKET, SIGNED_URL_TTL_SECONDS } from "@/lib/trips/storage";

export type CompanyWithContacts = {
  id: string;
  user_id: string;
  display_name: string;
  address: string;
  lat: number;
  lng: number;
  note: string | null;
  is_public: boolean;
  /** Storage path of the "mã vào cổng" photo. Not a URL — see getCompany. */
  gate_photo_path: string | null;
  company_contacts: {
    id: string;
    contact_name: string | null;
    phone: string | null;
    sort_order: number;
  }[];
};

/** One company with its gate photo ready to show. */
export type CompanyDetail = CompanyWithContacts & {
  /** Signed, expires after SIGNED_URL_TTL_SECONDS. Null when there is no photo. */
  gate_photo_url: string | null;
};

const SELECT =
  "id, user_id, display_name, address, lat, lng, note, is_public, gate_photo_path, company_contacts(id, contact_name, phone, sort_order)" as const;

/**
 * RLS already filters to rows the caller may read — own rows plus anything
 * shared with is_public. Filtering on user_id here as well keeps other
 * people's public companies out of "my companies".
 */
export async function listOwnCompanies(): Promise<CompanyWithContacts[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("companies")
    .select(SELECT)
    .eq("user_id", user.id)
    .order("display_name", { ascending: true });

  if (error) throw new Error(error.message);

  return sortContacts((data ?? []) as unknown as CompanyWithContacts[]);
}

export async function getCompany(id: string): Promise<CompanyDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("companies")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const company = sortContacts([data as unknown as CompanyWithContacts])[0];
  const path = company.gate_photo_path;
  const urls = await signGatePhotos(supabase, [path]);
  return { ...company, gate_photo_url: path ? (urls.get(path) ?? null) : null };
}

/**
 * Signed URLs for gate photos, keyed by path, in one storage call. The bucket
 * is private (CLAUDE.md §7), so a bare path is useless to a browser.
 */
export async function signGatePhotos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  paths: (string | null)[],
): Promise<Map<string, string>> {
  const wanted = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  const signed = new Map<string, string>();
  if (wanted.length === 0) return signed;

  const { data } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(wanted, SIGNED_URL_TTL_SECONDS);
  for (const u of data ?? []) {
    if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }
  return signed;
}

/** Postgres returns the embedded rows unordered; the form depends on order. */
function sortContacts(rows: CompanyWithContacts[]): CompanyWithContacts[] {
  for (const row of rows) {
    row.company_contacts?.sort((a, b) => a.sort_order - b.sort_order);
  }
  return rows;
}
