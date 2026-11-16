import { z } from "zod";

/**
 * Per-person preferences, stored on the profile row.
 *
 * Same house rule as companySchema and tripSchema: `nullish` rather than
 * `optional`, so the schema can re-parse its own output. The form validates in
 * the browser and the server action validates the transformed result again.
 */
export const settingsSchema = z
  .object({
    /**
     * The start point every new route begins at — usually the warehouse.
     * Clearing the address clears the whole thing and the form goes back to
     * asking each time.
     */
    defaultStartLabel: z
      .string()
      .trim()
      .max(200, "Tối đa 200 ký tự")
      .nullish()
      .transform((v) => (v ? v : null)),
    defaultStartLat: z
      .number()
      .min(-90, "Vĩ độ ngoài khoảng")
      .max(90, "Vĩ độ ngoài khoảng")
      .nullish()
      .transform((v) => (v == null ? null : v)),
    defaultStartLng: z
      .number()
      .min(-180, "Kinh độ ngoài khoảng")
      .max(180, "Kinh độ ngoài khoảng")
      .nullish()
      .transform((v) => (v == null ? null : v)),
  })
  // A label with no coordinates would silently fail to preselect anything,
  // which looks like the setting was lost. Mirrors the check constraint on
  // profiles.
  .refine(
    (v) =>
      (v.defaultStartLabel === null &&
        v.defaultStartLat === null &&
        v.defaultStartLng === null) ||
      (v.defaultStartLabel !== null &&
        v.defaultStartLat !== null &&
        v.defaultStartLng !== null),
    "Phải dán link Google Maps để lấy toạ độ cho điểm bắt đầu",
  );

export type SettingsInput = z.input<typeof settingsSchema>;
export type SettingsValues = z.output<typeof settingsSchema>;
