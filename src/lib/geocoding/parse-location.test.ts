import { describe, expect, it } from "vitest";
import {
  formatLatLng,
  isMapsLink,
  isRawLocationText,
  isUnresolvedShortLink,
  parseLocationInput,
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
