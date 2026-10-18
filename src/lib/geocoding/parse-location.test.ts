import { describe, expect, it } from "vitest";
import {
  formatLatLng,
  isMapsLink,
  isRawLocationText,
  isUnresolvedShortLink,
  parseLocationInput,
  parseMapsPlaceName,
} from "./parse-location";

/** The link that exposed the "long URL saved as the address" bug. */
const AN_PHUOC =
  "google.com/maps/place/An+Phước-+Pierre+Cardin+-+An+Dương+Vương/@10.7571333,106.6701499,17z/data=!3m1!4b1!4m6!3m5!1s0x31752f...!8m2!3d10.7571333!4d106.6701499";

describe("parseLocationInput — typed coordinates", () => {
  it.each([
    ["10.756842, 106.669972", 10.756842, 106.669972],
    ["10.756842,106.669972", 10.756842, 106.669972],
    ["10.756842 106.669972", 10.756842, 106.669972],
    ["  10.756842 , 106.669972  ", 10.756842, 106.669972],
    ["10.756842; 106.669972", 10.756842, 106.669972],
    ["-10.5, -106.5", -10.5, -106.5],
  ])("accepts %s", (input, lat, lng) => {
    expect(parseLocationInput(input)).toEqual({ lat, lng });
  });

  it.each([
    ["285 Cách Mạng Tháng 8, Tân Bình", "a plain address"],
    ["91.0, 106.7", "latitude out of range"],
    ["10.7, 181.0", "longitude out of range"],
    ["", "empty"],
    ["abc, def", "not numbers"],
  ])("rejects %s (%s)", (input) => {
    expect(parseLocationInput(input)).toBeNull();
  });
});

describe("parseLocationInput — Google Maps links", () => {
  it("reads the real An Phước link", () => {
    expect(parseLocationInput(AN_PHUOC)).toEqual({
      lat: 10.7571333,
      lng: 106.6701499,
    });
  });

  it("prefers the pinned place (!3d!4d) over the viewport centre (@)", () => {
    const link =
      "https://www.google.com/maps/place/X/@10.1,106.1,17z/data=!3m1!4b1!3d10.7769!4d106.7009";
    expect(parseLocationInput(link)).toEqual({ lat: 10.7769, lng: 106.7009 });
  });

  it("reads the maps.google.com/?q= shape", () => {
    expect(
      parseLocationInput("https://maps.google.com/?q=10.7769,106.7009"),
    ).toEqual({ lat: 10.7769, lng: 106.7009 });
  });

  it("reads a bare /@ link", () => {
    expect(
      parseLocationInput("https://www.google.com/maps/@10.7769,106.7009,17z"),
    ).toEqual({ lat: 10.7769, lng: 106.7009 });
  });

  it("cannot resolve a short link, and says so", () => {
    const short = "https://maps.app.goo.gl/abc123";
    expect(parseLocationInput(short)).toBeNull();
    expect(isUnresolvedShortLink(short)).toBe(true);
  });
});

describe("isMapsLink", () => {
  it("is true for links, false for coordinates and addresses", () => {
    expect(isMapsLink(AN_PHUOC)).toBe(true);
    expect(isMapsLink("https://maps.app.goo.gl/x")).toBe(true);
    expect(isMapsLink("10.756842, 106.669972")).toBe(false);
    expect(isMapsLink("285 Cách Mạng Tháng 8")).toBe(false);
  });
});

describe("isRawLocationText", () => {
  it("covers both links and coordinate pairs", () => {
    expect(isRawLocationText(AN_PHUOC)).toBe(true);
    expect(isRawLocationText("10.756842, 106.669972")).toBe(true);
    expect(isRawLocationText("285 Cách Mạng Tháng 8")).toBe(false);
    expect(isRawLocationText("")).toBe(false);
  });
});

describe("pasting a link collapses to coordinates", () => {
  /**
   * Mirrors AddressInput.handleInput: a pasted link must become coordinates
   * immediately, so a long URL is never what gets saved as the address.
   */
  function fieldValueAfterPaste(input: string): string {
    const parsed = parseLocationInput(input);
    if (parsed && isMapsLink(input)) return formatLatLng(parsed);
    return input;
  }

  it("replaces the An Phước link with its coordinates", () => {
    expect(fieldValueAfterPaste(AN_PHUOC)).toBe("10.757133, 106.670150");
  });

  it("leaves a hand-typed coordinate pair untouched while typing", () => {
    expect(fieldValueAfterPaste("10.75")).toBe("10.75");
    expect(fieldValueAfterPaste("10.756842, 106.6")).toBe("10.756842, 106.6");
  });

  it("leaves an ordinary address untouched", () => {
    expect(fieldValueAfterPaste("285 Cách Mạng Tháng 8")).toBe(
      "285 Cách Mạng Tháng 8",
    );
  });

  it("leaves an unresolvable short link alone, so the user sees the warning", () => {
    const short = "https://maps.app.goo.gl/abc123";
    expect(fieldValueAfterPaste(short)).toBe(short);
  });
});

/** The exact link that produced a wrong "school" label via reverse geocoding. */
const THUAN_PHUONG =
  "https://www.google.com/maps/place/T%E1%BA%ADp+%C4%91o%C3%A0n+May+th%C3%AAu+Thu%E1%BA%ADn+Ph%C6%B0%C6%A1ng/@10.7490456,106.6351744,17z/data=!3m1!4b1!4m6!3m5!1s0x31752e7e00770acf:0x55930245be0450c0!8m2!3d10.7490456!4d106.6351744!16s%2Fg%2F11c4l7ghgx?entry=ttu&g_ep=EgoyMDI2MTAxMy4wIKXMDSoASAFQAw%3D%3D";

describe("parseMapsPlaceName", () => {
  it("reads the Vietnamese place name out of the real link", () => {
    expect(parseMapsPlaceName(THUAN_PHUONG)).toBe(
      "Tập đoàn May thêu Thuận Phương",
    );
  });

  it("still reads the exact coordinates from the same link", () => {
    expect(parseLocationInput(THUAN_PHUONG)).toEqual({
      lat: 10.7490456,
      lng: 106.6351744,
    });
  });

  it("returns null for a link with no /place/ segment", () => {
    expect(
      parseMapsPlaceName("https://www.google.com/maps/@10.7769,106.7009,17z"),
    ).toBeNull();
    expect(
      parseMapsPlaceName("https://maps.google.com/?q=10.7769,106.7009"),
    ).toBeNull();
  });

  it("returns null when the place segment is itself coordinates", () => {
    expect(
      parseMapsPlaceName(
        "https://www.google.com/maps/place/10.7769,106.7009/@10.7769,106.7009,17z",
      ),
    ).toBeNull();
  });

  it("returns null for a plain address or coordinates", () => {
    expect(parseMapsPlaceName("285 Cách Mạng Tháng 8")).toBeNull();
    expect(parseMapsPlaceName("10.7769, 106.7009")).toBeNull();
  });
});

describe("pasting a /place/ link keeps Google's name", () => {
  /** Mirrors AddressInput.handleInput after the place-name change. */
  function fieldValueAfterPaste(input: string): string {
    const parsed = parseLocationInput(input);
    if (parsed && isMapsLink(input)) {
      return parseMapsPlaceName(input) ?? formatLatLng(parsed);
    }
    return input;
  }

  it("uses the place name, not coordinates, and never the raw URL", () => {
    const value = fieldValueAfterPaste(THUAN_PHUONG);
    expect(value).toBe("Tập đoàn May thêu Thuận Phương");
    expect(value).not.toContain("http");
  });

  it("falls back to coordinates for a link without a place name", () => {
    expect(
      fieldValueAfterPaste("https://www.google.com/maps/@10.7769,106.7009,17z"),
    ).toBe("10.776900, 106.700900");
  });

  it("a name is not raw text, so no reverse lookup is triggered", () => {
    expect(isRawLocationText("Tập đoàn May thêu Thuận Phương")).toBe(false);
  });
});
