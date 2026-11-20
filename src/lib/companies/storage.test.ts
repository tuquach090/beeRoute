import { describe, expect, it } from "vitest";
import { gatePhotoPath, isOwnGatePhotoPath } from "./storage";

const me = "11111111-1111-1111-1111-111111111111";
const them = "22222222-2222-2222-2222-222222222222";
const file = "0b7d5a8e-3c1f-4f7a-9d55-2b9c1e6f4a10.jpg";

describe("gatePhotoPath", () => {
  it("puts the owner first, as the bucket policies require", () => {
    expect(gatePhotoPath(me, file)).toBe(`${me}/companies/${file}`);
  });

  it("is accepted by its own check", () => {
    expect(isOwnGatePhotoPath(me, gatePhotoPath(me, file))).toBe(true);
  });
});

describe("isOwnGatePhotoPath", () => {
  it("rejects someone else's folder", () => {
    expect(isOwnGatePhotoPath(me, gatePhotoPath(them, file))).toBe(false);
  });

  it("rejects a delivery photo path", () => {
    expect(isOwnGatePhotoPath(me, `${me}/trip-id/stop-id/${file}`)).toBe(false);
  });

  it("rejects anything that could walk out of the folder", () => {
    expect(isOwnGatePhotoPath(me, `${me}/companies/../x.jpg`)).toBe(false);
    expect(isOwnGatePhotoPath(me, `${me}/companies/a/b.jpg`)).toBe(false);
    expect(isOwnGatePhotoPath(me, `${me}/companies/`)).toBe(false);
  });

  it("only takes the image types the bucket accepts", () => {
    expect(isOwnGatePhotoPath(me, `${me}/companies/a.png`)).toBe(true);
    expect(isOwnGatePhotoPath(me, `${me}/companies/a.webp`)).toBe(true);
    expect(isOwnGatePhotoPath(me, `${me}/companies/a.heic`)).toBe(false);
  });
});
