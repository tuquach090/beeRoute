import { describe, expect, it } from "vitest";
import {
  companyNameKey,
  companySearchFields,
  findDuplicateName,
  matchesSearch,
  normaliseForSearch,
} from "./match";

describe("normaliseForSearch", () => {
  it("strips Vietnamese accents and folds đ", () => {
    expect(normaliseForSearch("Đại Hoa – Bình Dương")).toBe(
      "dai hoa – binh duong",
    );
    expect(normaliseForSearch("ĐƯỜNG Số 30")).toBe("duong so 30");
  });

  it("treats decomposed and composed input the same", () => {
    expect(normaliseForSearch("Hùng")).toBe(normaliseForSearch("Hùng"));
  });
});

describe("matchesSearch", () => {
  const fields = [
    "Đại Hoa",
    "KCN Tân Uyên, Bình Dương",
    "Chị Lan",
    "0901234567",
  ];

  it("matches everything on an empty or blank query", () => {
    expect(matchesSearch(fields, "")).toBe(true);
    expect(matchesSearch(fields, "   ")).toBe(true);
  });

  it("matches without accents or case", () => {
    expect(matchesSearch(fields, "dai hoa")).toBe(true);
    expect(matchesSearch(fields, "ĐẠI")).toBe(true);
  });

  it("needs every word, but in any field and any order", () => {
    expect(matchesSearch(fields, "binh duong hoa")).toBe(true);
    expect(matchesSearch(fields, "hoa thu duc")).toBe(false);
  });

  it("finds a phone number typed with spaces", () => {
    expect(matchesSearch(fields, "0901 234")).toBe(true);
  });

  it("ignores missing fields", () => {
    expect(matchesSearch(["Delta", null, undefined], "delta")).toBe(true);
  });
});

describe("companySearchFields", () => {
  it("covers name, address, contact names and phones", () => {
    expect(
      companySearchFields({
        display_name: "Delta",
        address: "Thủ Đức",
        company_contacts: [{ contact_name: "Bảo vệ", phone: null }],
      }),
    ).toEqual(["Delta", "Thủ Đức", "Bảo vệ", null]);
  });
});

describe("companyNameKey", () => {
  it("ignores case and extra spaces", () => {
    expect(companyNameKey("  Kho   Tân Bình ")).toBe(
      companyNameKey("kho tân bình"),
    );
  });

  it("keeps accents: a tone mark makes a different name", () => {
    expect(companyNameKey("Hoà")).not.toBe(companyNameKey("Hoa"));
  });

  it("treats decomposed and composed input the same", () => {
    expect(companyNameKey("Hùng")).toBe(companyNameKey("Hùng"));
  });
});

describe("findDuplicateName", () => {
  const companies = [
    { id: "a", display_name: "Delta" },
    { id: "b", display_name: "Craft" },
  ];

  it("finds another company with the same name", () => {
    expect(findDuplicateName(companies, " delta ", null)?.id).toBe("a");
  });

  it("does not flag a company against itself when editing", () => {
    expect(findDuplicateName(companies, "Delta", "a")).toBeNull();
  });

  it("returns null when the name is free", () => {
    expect(findDuplicateName(companies, "Kisoo", null)).toBeNull();
  });
});
