import { describe, expect, it } from "vitest";
import { settingsSchema } from "./settings";

const full = {
  defaultStartLabel: "Kho Bình Tân",
  defaultStartLat: 10.7626,
  defaultStartLng: 106.6601,
};

describe("settingsSchema", () => {
  it("accepts a complete default start point", () => {
    expect(settingsSchema.parse(full)).toEqual(full);
  });

  it("accepts the setting being cleared", () => {
    const empty = {
      defaultStartLabel: null,
      defaultStartLat: null,
      defaultStartLng: null,
    };
    expect(settingsSchema.parse(empty)).toEqual(empty);
    expect(settingsSchema.parse({}).defaultStartLabel).toBeNull();
  });

  it("re-parses its own output", () => {
    // The browser validates, then the server action validates again. Without
    // this the second pass dies on "expected string, received null".
    const once = settingsSchema.parse({ defaultStartLabel: "   " });
    expect(settingsSchema.parse(once)).toEqual(once);
  });

  it("treats a blank label as cleared rather than as a name", () => {
    expect(settingsSchema.parse({ defaultStartLabel: "  " })).toEqual({
      defaultStartLabel: null,
      defaultStartLat: null,
      defaultStartLng: null,
    });
  });

  it("rejects a label with no coordinates behind it", () => {
    const result = settingsSchema.safeParse({
      defaultStartLabel: "Kho Bình Tân",
    });
    expect(result.success).toBe(false);
  });

  it("rejects coordinates with no label", () => {
    expect(
      settingsSchema.safeParse({
        defaultStartLat: 10.76,
        defaultStartLng: 106.66,
      }).success,
    ).toBe(false);
  });

  it("rejects coordinates off the planet", () => {
    expect(
      settingsSchema.safeParse({ ...full, defaultStartLat: 91 }).success,
    ).toBe(false);
    expect(
      settingsSchema.safeParse({ ...full, defaultStartLng: -181 }).success,
    ).toBe(false);
  });
});
