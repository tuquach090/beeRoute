import { describe, expect, it } from "vitest";
import { companySchema, normalisePhone } from "./company";

const base = {
  displayName: "Kho Tân Bình",
  address: "285 Cách Mạng Tháng 8, Tân Bình, TP.HCM",
  lat: 10.7909,
  lng: 106.6533,
  isPublic: false,
};

describe("companySchema — idempotence", () => {
  /**
   * The form validates in the browser, then the server action validates the
   * ALREADY-TRANSFORMED result again. Empty optional fields come back as null,
   * so the schema has to accept its own output or the second parse explodes
   * with "expected string, received null".
   */
  it("re-parses its own output", () => {
    const first = companySchema.safeParse({
      ...base,
      note: "",
      contacts: [{ contactName: "", phone: "" }],
    });
    expect(first.success).toBe(true);

    const second = companySchema.safeParse(first.data);
    expect(second.success).toBe(true);
    expect(second.data).toEqual(first.data);
  });

  it("re-parses output that still has contacts", () => {
    const first = companySchema.parse({
      ...base,
      note: "Gọi trước 15 phút",
      contacts: [
        { contactName: "Anh Hùng", phone: "090 123 4567" },
        { contactName: "", phone: "02838123456" },
      ],
    });
    const second = companySchema.parse(first);
    expect(second).toEqual(first);
    expect(second.contacts).toHaveLength(2);
  });
});

describe("companySchema — contacts", () => {
  it("accepts a company with no contact at all", () => {
    const parsed = companySchema.parse({
      ...base,
      note: "",
      contacts: [{ contactName: "", phone: "" }],
    });
    expect(parsed.contacts).toEqual([]);
    expect(parsed.note).toBeNull();
  });

  it("keeps a row that has only a name", () => {
    const parsed = companySchema.parse({
      ...base,
      contacts: [{ contactName: "Phòng hành chính", phone: "" }],
    });
    expect(parsed.contacts).toEqual([
      { contactName: "Phòng hành chính", phone: null },
    ]);
  });

  it("keeps a row that has only a phone", () => {
    const parsed = companySchema.parse({
      ...base,
      contacts: [{ contactName: "", phone: "0901234567" }],
    });
    expect(parsed.contacts).toEqual([
      { contactName: null, phone: "0901234567" },
    ]);
  });

  it("drops blank rows but keeps the filled ones", () => {
    const parsed = companySchema.parse({
      ...base,
      contacts: [
        { contactName: "", phone: "" },
        { contactName: "Chị Lan", phone: "0912345678" },
        { contactName: "   ", phone: "  " },
      ],
    });
    expect(parsed.contacts).toHaveLength(1);
    expect(parsed.contacts[0].contactName).toBe("Chị Lan");
  });

  it("rejects a phone that was typed but is malformed", () => {
    const result = companySchema.safeParse({
      ...base,
      contacts: [{ contactName: "", phone: "0901" }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts null for the optional fields directly", () => {
    const parsed = companySchema.parse({
      ...base,
      note: null,
      contacts: [{ contactName: null, phone: null }],
    });
    expect(parsed.note).toBeNull();
    expect(parsed.contacts).toEqual([]);
  });
});

describe("companySchema — required fields", () => {
  it("requires a display name", () => {
    expect(
      companySchema.safeParse({ ...base, displayName: "  ", contacts: [] })
        .success,
    ).toBe(false);
  });

  it("requires coordinates", () => {
    expect(
      companySchema.safeParse({
        ...base,
        lat: Number.NaN,
        lng: Number.NaN,
        contacts: [],
      }).success,
    ).toBe(false);
  });

  it("rejects out-of-range coordinates", () => {
    expect(
      companySchema.safeParse({ ...base, lat: 91, contacts: [] }).success,
    ).toBe(false);
  });
});

describe("normalisePhone", () => {
  it("strips the separators people actually type", () => {
    expect(normalisePhone("090 123 4567")).toBe("0901234567");
    expect(normalisePhone("028-3812-3456")).toBe("02838123456");
    expect(normalisePhone("(028) 3812.3456")).toBe("02838123456");
  });
});
