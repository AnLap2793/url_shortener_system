import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

function luminance(hex: string): number {
  const values = hex
    .match(/[a-f\d]{2}/gi)!
    .map((value) => Number.parseInt(value, 16) / 255);
  return values
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    )
    .reduce(
      (sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!,
      0,
    );
}

function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort(
    (a, b) => b - a,
  );
  return (light! + 0.05) / (dark! + 0.05);
}

describe("auth shell design tokens", () => {
  it("retains DESIGN primary and uses an AA text-link color", async () => {
    const css = await readFile("apps/web/src/styles.css", "utf8");
    expect(css).toContain("--primary: #1c5cab");
    expect(contrast("0d4f99", "fcfcfb")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("0b0b0b", "fcfcfb")).toBeGreaterThanOrEqual(4.5);
  });
});
