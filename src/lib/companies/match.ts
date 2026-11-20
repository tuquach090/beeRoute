/**
 * Text matching for companies: the search boxes, and the duplicate-name rule.
 * Pure, so it runs the same in the browser and in a server action.
 */

/**
 * Lower-case, accents stripped, "đ" folded to "d" — so a rider typing
 * "dai hoa" one-handed still finds "Đại Hoa". NFD splits each accented letter
 * into base + combining marks; "đ" is a letter of its own and needs folding
 * by hand.
 */
export function normaliseForSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

/**
 * True when every word of the query appears somewhere in the fields, in any
 * order: "delta binh duong" finds Delta whose address says Bình Dương. An
 * empty query matches everything.
 */
export function matchesSearch(
  fields: (string | null | undefined)[],
  query: string,
): boolean {
  const words = normaliseForSearch(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normaliseForSearch(fields.filter(Boolean).join(" "));
  return words.every((w) => haystack.includes(w));
}

type Searchable = {
  display_name: string;
  address: string;
  company_contacts: { contact_name: string | null; phone: string | null }[];
};

/** What a company search looks through: name, address, contact names, phones. */
export function companySearchFields(c: Searchable): (string | null)[] {
  return [
    c.display_name,
    c.address,
    ...c.company_contacts.flatMap((k) => [k.contact_name, k.phone]),
  ];
}

/**
 * The key two company names are compared on for the duplicate rule.
 *
 * Case and stray spaces do not make a different company, so "Delta" and
 * " delta " collide. Accents DO count: Vietnamese names differing only in a
 * tone mark are different words. NFC first, because pasted text sometimes
 * arrives decomposed and would otherwise look different byte for byte.
 */
export function companyNameKey(name: string): string {
  return name.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}

/** The first company, other than `selfId`, whose name collides with `name`. */
export function findDuplicateName<
  T extends { id: string; display_name: string },
>(companies: T[], name: string, selfId: string | null): T | null {
  const key = companyNameKey(name);
  return (
    companies.find(
      (c) => c.id !== selfId && companyNameKey(c.display_name) === key,
    ) ?? null
  );
}
