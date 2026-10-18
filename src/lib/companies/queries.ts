import "server-only";
import { createClient } from "@/lib/supabase/server";

export type CompanyWithContacts = {
  id: string;
  user_id: string;
  display_name: string;
  address: string;
  lat: number;
  lng: number;
  note: string | null;
  is_public: boolean;
  company_contacts: {
    id: string;
    contact_name: string | null;
    phone: string | null;
    sort_order: number;
  }[];
};

const SELECT =
  "id, user_id, display_name, address, lat, lng, note, is_public, company_contacts(id, contact_name, phone, sort_order)" as const;

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

export async function getCompany(
  id: string,
): Promise<CompanyWithContacts | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("companies")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return sortContacts([data as unknown as CompanyWithContacts])[0];
}

/** Postgres returns the embedded rows unordered; the form depends on order. */
function sortContacts(rows: CompanyWithContacts[]): CompanyWithContacts[] {
  for (const row of rows) {
    row.company_contacts?.sort((a, b) => a.sort_order - b.sort_order);
  }
  return rows;
}
