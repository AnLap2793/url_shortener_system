import { expect, test } from "@playwright/test";

const harnessPath = "/harness.html";

test.describe("AppShell navigation contracts", () => {
  test("keeps exactly one active sidebar item that follows navigation", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(harnessPath);
    const activeSidebarLinks = page.locator('.app-sidebar [aria-current="page"]');
    await expect(activeSidebarLinks).toHaveCount(1);
    await expect(activeSidebarLinks).toHaveAttribute("href", "/dashboard");

    await page.locator(".app-sidebar .nav-link", { hasText: "Links" }).click();
    await expect(page.locator("h1")).toHaveText("/links");
    await expect(page.locator('.app-sidebar [aria-current="page"]')).toHaveAttribute("href", "/links");
    await expect(page.locator('.app-sidebar [aria-current="page"]')).toHaveCount(1);
  });

  test("mobile drawer sets initial focus, closes on Escape and returns focus", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 });
    await page.goto(harnessPath);
    const toggle = page.getByRole("button", { name: "Open navigation" });
    await toggle.click();
    const drawer = page.locator(".nav-drawer");
    await expect(drawer).toHaveAttribute("open", "");
    await expect(page.locator(".nav-drawer :focus")).toHaveCount(1);

    await page.keyboard.press("Escape");
    await expect(drawer).not.toHaveAttribute("open", "");
    await expect(toggle).toBeFocused();
  });

  test("mobile drawer closes after navigating", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 720 });
    await page.goto(harnessPath);
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.locator(".nav-drawer .nav-link", { hasText: "Account" }).click();
    await expect(page.locator("h1")).toHaveText("/account");
    await expect(page.locator(".nav-drawer")).not.toHaveAttribute("open", "");
  });
});

test.describe("Dialog contract", () => {
  test("opens modally, closes with Escape and returns focus to its trigger", async ({ page }) => {
    await page.goto(harnessPath);
    const trigger = page.locator("#open-dialog");
    await trigger.click();
    const dialog = page.locator(".dialog");
    await expect(dialog).toHaveAttribute("open", "");
    await expect(dialog.getByRole("heading", { name: "Delete this link?" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).not.toHaveAttribute("open", "");
    await expect(trigger).toBeFocused();
  });
});

test.describe("Toast contract", () => {
  test("announces messages through a stable polite region", async ({ page }) => {
    await page.goto(harnessPath);
    const region = page.locator(".toast-region");
    await expect(region).toHaveAttribute("aria-live", "polite");
    await expect(region).toHaveAttribute("role", "status");
    await page.locator("#show-toast").click();
    await expect(region).toContainText("Short link created. Copy it to share.");
  });
});

test.describe("PrimaryButton contract", () => {
  test("meets 44px targets, shows focus ring and blocks duplicate activation", async ({ page }) => {
    await page.goto(harnessPath);
    const button = page.getByRole("button", { name: "Create short link" });
    const box = await button.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);

    await button.focus();
    const outline = await button.evaluate((element) => {
      const style = getComputedStyle(element);
      return { width: style.outlineWidth, offset: style.outlineOffset };
    });
    expect(outline).toMatchObject({ width: "2px", offset: "2px" });

    await button.click();
    await expect(page.getByRole("button", { name: "Working…" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Working…" })).toHaveAttribute("aria-busy", "true");
    await expect(page.locator("#primary-clicks")).toHaveText("1");
  });
});

test.describe("AppShell reflow contract", () => {
  for (const viewport of [
    { width: 320, height: 720 },
    { width: 375, height: 720 },
    { width: 800, height: 800 },
    { width: 1280, height: 800 },
  ]) {
    test(`shell layout reflows without 2D scroll at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(harnessPath);
      await page.locator(".app-shell").waitFor();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
      ).toBe(true);

      await page.addStyleTag({
        content:
          "* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }",
      });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
      ).toBe(true);
    });
  }
});

test.describe("ErrorSummary contract", () => {
  test("receives focus and links to the invalid field", async ({ page }) => {
    await page.goto(harnessPath);
    await page.locator("#trigger-errors").click();
    const summary = page.locator(".error-summary");
    await expect(summary).toBeFocused();
    await summary.getByRole("link", { name: "Use an http or https URL." }).click();
    await expect(page).toHaveURL(/#destination-url$/);
  });
});
