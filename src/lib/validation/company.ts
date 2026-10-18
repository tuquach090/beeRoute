import { z } from "zod";

/**
 * Vietnamese numbers the app should accept:
 *   mobile       0901234567            (10 digits, leads with 0)
 *   mobile +84   +84901234567
 *   landline     02838123456           (area code + subscriber)
 *   written with separators            090 123 4567 / 028-3812-3456
 */
const PHONE_RE = /^(?:0\d{9,10}|\+84\d{9,10})$/;

export function normalisePhone(raw: string): string {
  return raw.replace(/[\s.\-()]/g, "");
}

/**
 * Optional, but must look like a Vietnamese number once something is typed.
 *
 * `nullish` rather than `optional` so the schema is idempotent: the server
 * action re-validates the values the form already transformed, and those carry
 * null for empty fields.
 */
export const phoneSchema = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? normalisePhone(v) : null))
  .refine(
    (v) => v === null || PHONE_RE.test(v),
    "Số không hợp lệ. Dùng dạng 0901234567, 02838123456 hoặc +84901234567.",
  );

export const contactSchema = z.object({
  id: z.string().optional(),
  // Both fields are optional; a completely blank row is dropped below.
  contactName: z
    .string()
    .trim()
    .max(120, "Tối đa 120 ký tự")
    .nullish()
    .transform((v) => (v ? v : null)),
  phone: phoneSchema,
});

export const companySchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Phải nhập tên hiển thị")
    .max(120, "Tối đa 120 ký tự"),
  address: z.string().trim().min(1, "Phải nhập địa chỉ"),
  // The database columns are NOT NULL, so the form cannot submit without a
  // location — picked from the suggestions, or pasted as coordinates.
  lat: z
    .number({ error: "Phải chọn được toạ độ" })
    .min(-90, "Vĩ độ ngoài khoảng")
    .max(90, "Vĩ độ ngoài khoảng"),
  lng: z
    .number({ error: "Phải chọn được toạ độ" })
    .min(-180, "Kinh độ ngoài khoảng")
    .max(180, "Kinh độ ngoài khoảng"),
  note: z
    .string()
    .trim()
    .max(2000, "Tối đa 2000 ký tự")
    .nullish()
    .transform((v) => (v ? v : null)),
  isPublic: z.boolean(),
  contacts: z
    .array(contactSchema)
    .max(20, "Tối đa 20 dòng liên hệ")
    // The form always renders one empty row; saving should not create it.
    .transform((rows) =>
      rows.filter((r) => r.contactName !== null || r.phone !== null),
    ),
});

export type CompanyInput = z.input<typeof companySchema>;
export type CompanyValues = z.output<typeof companySchema>;
