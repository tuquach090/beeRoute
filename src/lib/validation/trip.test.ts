import { describe, expect, it } from "vitest";
import { registerPhotoSchema, tripSchema } from "./trip";

const stop = (over: Record<string, unknown> = {}) => ({
  stopId: null,
  companyId: "11111111-1111-1111-1111-111111111111",
  displayName: "Kho Tân Bình",
  address: "285 Cách Mạng Tháng 8, Tân Bình, TP.HCM",
  lat: 10.7909,
  lng: 106.6533,
  legKm: 2.4,
  ...over,
});

const base = {
  tripDate: "2026-10-25",
  slot: "morning" as const,
  travelMode: "two-wheeler" as const,
  startLabel: "Vị trí hiện tại",
  startLat: 10.7721,
  startLng: 106.698,
  endLabel: "Nhà",
  endLat: 10.7626,
  endLng: 106.6601,
  totalKm: 28.2,
  method: "exact" as const,
  note: "",
  stops: [stop()],
};

describe("tripSchema — idempotence", () => {
  /**
   * The form validates in the browser, then the server action validates the
   * already-transformed output again. Empty optional fields come back as null,
   * so the schema has to accept its own output. companySchema was shipped
   * without this and failed with "expected string, received null".
   */
  it("re-parses its own output", () => {
    const first = tripSchema.safeParse(base);
    expect(first.success).toBe(true);

    const second = tripSchema.safeParse(first.data);
    expect(second.success).toBe(true);
    expect(second.data).toEqual(first.data);
  });

  it("re-parses output with every optional field empty", () => {
    const first = tripSchema.parse({
      ...base,
      note: "",
      stops: [stop({ stopId: null, companyId: "", legKm: null })],
    });
    expect(tripSchema.parse(first)).toEqual(first);
    expect(first.note).toBeNull();
    expect(first.stops[0].companyId).toBeNull();
  });
});

describe("tripSchema — dates", () => {
  it.each(["2026-10-25", "2024-02-29"])("accepts %s", (d) => {
    expect(tripSchema.safeParse({ ...base, tripDate: d }).success).toBe(true);
  });

  it.each([
    ["2026-02-30", "a day that does not exist"],
    ["2026-13-01", "month 13"],
    ["2026-02-29", "29 Feb in a non-leap year"],
    ["25/10/2026", "the wrong format"],
    ["2026-2-5", "unpadded parts"],
  ])("rejects %s (%s)", (d) => {
    expect(tripSchema.safeParse({ ...base, tripDate: d }).success).toBe(false);
  });
});

describe("tripSchema — stops", () => {
  it("requires at least one stop", () => {
    expect(tripSchema.safeParse({ ...base, stops: [] }).success).toBe(false);
  });

  it("rejects a repeated stopId, which would make save_trip ambiguous", () => {
    const dup = "22222222-2222-2222-2222-222222222222";
    const result = tripSchema.safeParse({
      ...base,
      stops: [stop({ stopId: dup }), stop({ stopId: dup })],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Danh sách điểm bị trùng");
  });

  it("allows several stops that are all new (stopId null)", () => {
    expect(
      tripSchema.safeParse({
        ...base,
        stops: [stop(), stop({ displayName: "Lạc Tỷ" })],
      }).success,
    ).toBe(true);
  });

  it("keeps a company-less stop, for a company deleted after the trip ran", () => {
    const parsed = tripSchema.parse({
      ...base,
      stops: [stop({ companyId: null })],
    });
    expect(parsed.stops[0].companyId).toBeNull();
    expect(parsed.stops[0].displayName).toBe("Kho Tân Bình");
  });

  it("rejects a stop with no name or no address", () => {
    expect(
      tripSchema.safeParse({ ...base, stops: [stop({ displayName: "  " })] })
        .success,
    ).toBe(false);
    expect(
      tripSchema.safeParse({ ...base, stops: [stop({ address: "" })] }).success,
    ).toBe(false);
  });

  it("rejects coordinates outside the world", () => {
    expect(
      tripSchema.safeParse({ ...base, stops: [stop({ lat: 91 })] }).success,
    ).toBe(false);
    expect(
      tripSchema.safeParse({ ...base, stops: [stop({ lng: -181 })] }).success,
    ).toBe(false);
  });
});

describe("tripSchema — required fields", () => {
  it.each([
    ["slot", "evening"],
    ["travelMode", "walking"],
    ["method", "guess"],
  ])("rejects an unknown %s", (field, value) => {
    expect(tripSchema.safeParse({ ...base, [field]: value }).success).toBe(
      false,
    );
  });

  it("rejects a negative total", () => {
    expect(tripSchema.safeParse({ ...base, totalKm: -1 }).success).toBe(false);
  });

  it("requires both endpoint labels", () => {
    expect(tripSchema.safeParse({ ...base, startLabel: " " }).success).toBe(
      false,
    );
    expect(tripSchema.safeParse({ ...base, endLabel: "" }).success).toBe(false);
  });
});

describe("registerPhotoSchema", () => {
  const photo = {
    stopId: "33333333-3333-3333-3333-333333333333",
    storagePath: "user/trip/stop/abc.jpg",
    kind: "receipt" as const,
    note: "",
  };

  it("re-parses its own output", () => {
    const first = registerPhotoSchema.parse(photo);
    expect(registerPhotoSchema.parse(first)).toEqual(first);
    expect(first.note).toBeNull();
  });

  it.each(["order", "receipt", "warehouse", "sample"])(
    "accepts kind %s",
    (kind) => {
      expect(registerPhotoSchema.safeParse({ ...photo, kind }).success).toBe(
        true,
      );
    },
  );

  it("rejects an unknown kind", () => {
    expect(
      registerPhotoSchema.safeParse({ ...photo, kind: "invoice" }).success,
    ).toBe(false);
  });

  it("requires a storage path", () => {
    expect(
      registerPhotoSchema.safeParse({ ...photo, storagePath: "" }).success,
    ).toBe(false);
  });
});
