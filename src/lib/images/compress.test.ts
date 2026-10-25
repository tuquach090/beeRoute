import { describe, expect, it } from "vitest";
import { MAX_EDGE_PX, fitWithin, formatBytes } from "./compress";

// Only the pure half is tested here. compressImage needs canvas and
// createImageBitmap, which exist in a browser, not in vitest's node runner.

describe("fitWithin", () => {
  it("leaves an image that already fits alone", () => {
    expect(fitWithin({ width: 900, height: 600 })).toEqual({
      width: 900,
      height: 600,
    });
  });

  it("does not upscale — that would only add bytes", () => {
    expect(fitWithin({ width: 320, height: 240 })).toEqual({
      width: 320,
      height: 240,
    });
  });

  it("scales a landscape photo by its long edge", () => {
    // A typical phone shot: 4032x3024 (4:3).
    expect(fitWithin({ width: 4032, height: 3024 })).toEqual({
      width: 1600,
      height: 1200,
    });
  });

  it("scales a portrait photo by its long edge", () => {
    expect(fitWithin({ width: 3024, height: 4032 })).toEqual({
      width: 1200,
      height: 1600,
    });
  });

  it("keeps the aspect ratio within a rounding pixel", () => {
    const source = { width: 4000, height: 2251 };
    const out = fitWithin(source);
    const before = source.width / source.height;
    const after = out.width / out.height;
    expect(Math.abs(before - after)).toBeLessThan(0.01);
  });

  it("treats an exactly-at-the-limit image as already fitting", () => {
    expect(fitWithin({ width: MAX_EDGE_PX, height: 900 })).toEqual({
      width: MAX_EDGE_PX,
      height: 900,
    });
  });

  it("never collapses an extreme panorama to zero width", () => {
    // 10000x5 scaled by 0.16 would floor to 0 and make an invalid canvas.
    const out = fitWithin({ width: 10000, height: 5 });
    expect(out.width).toBe(1600);
    expect(out.height).toBeGreaterThanOrEqual(1);
  });

  it("honours a custom limit", () => {
    expect(fitWithin({ width: 4000, height: 2000 }, 1000)).toEqual({
      width: 1000,
      height: 500,
    });
  });

  it.each([
    [{ width: 0, height: 100 }],
    [{ width: 100, height: 0 }],
    [{ width: -10, height: 100 }],
    [{ width: Number.NaN, height: 100 }],
    [{ width: Number.POSITIVE_INFINITY, height: 100 }],
  ])("rejects %o", (bad) => {
    expect(() => fitWithin(bad)).toThrow();
  });
});

describe("formatBytes", () => {
  it.each([
    [512, "512 B"],
    [1024, "1 KB"],
    [320_000, "313 KB"],
    [2_621_440, "2.5 MB"],
  ])("%i → %s", (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });
});
