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
    expect(css).toMatch(/a\s*\{\s*color:\s*var\(--interactive-text\)/);
    expect(contrast("0d4f99", "fcfcfb")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("0b0b0b", "fcfcfb")).toBeGreaterThanOrEqual(4.5);
  });

  it("declares the DESIGN foundation tokens for shared components", async () => {
    const css = await readFile("apps/web/src/styles.css", "utf8");
    for (const declaration of [
      "--accent: #0d366b",
      "--success: #006300",
      "--warning: #8a5700",
      "--danger: #b42318",
      "--ink-secondary: #52514e",
      "--ink-muted: #64635f",
      "--radius-lg: 12px",
      "--space-card: 24px",
      "--space-section: 32px",
    ]) {
      expect(css).toContain(declaration);
    }
    expect(css).toMatch(/\.focus-indicator:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--primary\)/);
  });

  it("keeps token pairings at AA contrast for their real usage", async () => {
    expect(contrast("ffffff", "0d366b"), "active nav text on accent").toBeGreaterThanOrEqual(4.5);
    expect(contrast("ffffff", "1c5cab"), "primary button text").toBeGreaterThanOrEqual(4.5);
    expect(contrast("52514e", "fcfcfb"), "secondary ink on surface").toBeGreaterThanOrEqual(4.5);
    expect(contrast("b42318", "fcfcfb"), "danger text on surface").toBeGreaterThanOrEqual(4.5);
    expect(contrast("006300", "fcfcfb"), "success text on surface").toBeGreaterThanOrEqual(4.5);
    expect(contrast("8a5700", "fcfcfb"), "warning text on surface").toBeGreaterThanOrEqual(4.5);
  });
});
