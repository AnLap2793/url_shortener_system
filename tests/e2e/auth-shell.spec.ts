import { expect, test } from "@playwright/test";

const routes = ["/sign-in", "/sign-up"] as const;
const viewports = [
  { width: 320, height: 720 },
  { width: 375, height: 720 },
  { width: 800, height: 800 },
  { width: 1280, height: 800 },
];

for (const route of routes) {
  for (const viewport of viewports) {
    test(`${route} is accessible at ${viewport.width}px`, async ({ page }) => {
      const unexpectedRequests: string[] = [];
      page.on("request", (request) => {
        if (["xhr", "fetch", "websocket"].includes(request.resourceType())) unexpectedRequests.push(request.url());
      });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize(viewport);
      await page.goto(route);
      await expect(page.locator("main")).toBeVisible();
      await expect(page.locator("h1")).toHaveText(route === "/sign-in" ? "Sign in" : "Sign up");
      await expect(page).toHaveTitle(route === "/sign-in" ? /Sign in/ : /Sign up/);
      await expect(page.locator("form, button, input, [role=button]")).toHaveCount(0);
      expect(unexpectedRequests).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

      await page.addStyleTag({ content: "* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }" });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

      const routeLink = page.locator(".route-link");
      const box = await routeLink.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      expect(await routeLink.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe("0s");

      await page.keyboard.press("Tab");
      const focused = page.locator(":focus");
      await expect(focused).toHaveAttribute("href", "#main-content");
      const focusStyle = await focused.evaluate((element) => {
        const style = getComputedStyle(element);
        return { width: style.outlineWidth, offset: style.outlineOffset, color: style.outlineColor };
      });
      expect(focusStyle).toMatchObject({ width: "2px", offset: "2px" });
      expect(focusStyle.color).not.toBe("transparent");
      await page.keyboard.press("Enter");
      await expect(page.locator("main")).toBeFocused();
      await routeLink.focus();
      await routeLink.press("Enter");
      await expect(page.locator("h1")).toBeFocused();
      await expect(page.locator('[aria-live="polite"]')).toContainText("page loaded");
    });
  }
}
