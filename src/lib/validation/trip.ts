import { z } from "zod";
import { daysInMonth } from "@/lib/dates/vn-date";

/**
 * Same house rule as companySchema: `nullish` rather than `optional`, so the
 * schema is idempotent. The form validates once in the browser and the server
 * action validates the already-transformed result again — meaning z.output has
 * to be a valid z.input, or empty fields blow up as "expected string,
 * received null".
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const tripDateSchema = z
  .string()
  .trim()
  .regex(ISO_DATE, "Ngày không hợp lệ")
  .refine((v) => {
    const [y, m, d] = v.split("-").map(Number);
    return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
  }, "Ngày không có thật");

export const tripSlotSchema = z.enum(["morning", "afternoon"], {
  error: "Phải chọn buổi sáng hoặc chiều",
});

export const travelModeSchema = z.enum(["two-wheeler", "driving"]);
export const tripMethodSchema = z.enum(["exact", "heuristic"]);

const latSchema = z
  .number({ error: "Thiếu toạ độ" })
  .min(-90, "Vĩ độ ngoài khoảng")
  .max(90, "Vĩ độ ngoài khoảng");

const lngSchema = z
  .number({ error: "Thiếu toạ độ" })
  .min(-180, "Kinh độ ngoài khoảng")
  .max(180, "Kinh độ ngoài khoảng");

export const tripStopSchema = z.object({
  /**
   * The existing trip_stops.id when this stop is already saved. Sending it
   * back is what lets a re-optimise keep the stop's photos and delivery note —
   * see save_trip in the migration.
   */
  stopId: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v ? v : null)),
  companyId: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v ? v : null)),
  displayName: z
    .string()
    .trim()
    .min(1, "Điểm đến thiếu tên")
    .max(200, "Tên quá dài"),
  address: z.string().trim().min(1, "Điểm đến thiếu địa chỉ"),
  lat: latSchema,
  lng: lngSchema,
  legKm: z
    .number()
    .min(0, "Khoảng cách không hợp lệ")
    .nullish()
    .transform((v) => (v == null ? null : v)),
});

export const tripSchema = z.object({
  tripDate: tripDateSchema,
  slot: tripSlotSchema,
  travelMode: travelModeSchema,
  startLabel: z.string().trim().min(1, "Thiếu điểm bắt đầu"),
  startLat: latSchema,
  startLng: lngSchema,
  endLabel: z.string().trim().min(1, "Thiếu điểm kết thúc"),
  endLat: latSchema,
  endLng: lngSchema,
  totalKm: z.number().min(0, "Quãng đường không hợp lệ"),
  method: tripMethodSchema,
  note: z
    .string()
    .trim()
    .max(2000, "Tối đa 2000 ký tự")
    .nullish()
    .transform((v) => (v ? v : null)),
  stops: z
    .array(tripStopSchema)
    .min(1, "Chuyến phải có ít nhất một điểm đến")
    .max(50, "Tối đa 50 điểm đến")
    // A repeated stopId would make the UPDATE inside save_trip ambiguous.
    // The RPC guards this too; catching it here gives a readable message.
    .refine((rows) => {
      const ids = rows.map((r) => r.stopId).filter((v): v is string => !!v);
      return new Set(ids).size === ids.length;
    }, "Danh sách điểm bị trùng"),
});

export type TripInput = z.input<typeof tripSchema>;
export type TripValues = z.output<typeof tripSchema>;

/** Photo categories, matching the check constraint on trip_stop_photos.kind. */
export const photoKindSchema = z.enum([
  "order",
  "receipt",
  "warehouse",
  "sample",
]);

export const registerPhotoSchema = z.object({
  stopId: z.string().trim().min(1),
  storagePath: z.string().trim().min(1),
  kind: photoKindSchema,
  note: z
    .string()
    .trim()
    .max(500, "Tối đa 500 ký tự")
    .nullish()
    .transform((v) => (v ? v : null)),
});

export type RegisterPhotoValues = z.output<typeof registerPhotoSchema>;
