import { expect, test } from "@playwright/test";

const routes = ["/sign-in", "/sign-up"] as const;
const viewports = [
  { width: 320, height: 720 },
  { width: 375, height: 720 },
  { width: 800, height: 800 },
  { width: 1280, height: 800 },
];

test("sign-up validation focuses the summary and preserves form memory", async ({ page }) => {
  await page.goto("/sign-up");
  await page.getByLabel("Email address").fill("bad");
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Create account" }).click();

  const summary = page.getByRole("alert", { name: "Form errors" });
  await expect(summary).toBeFocused();
  await expect(summary).toContainText("Enter a valid email address.");
  await expect(page.getByLabel("Email address")).toHaveValue("bad");
  await expect(page.getByLabel("Password")).toHaveValue("short");
});

test("accepted sign-up clears the password and shows resend", async ({ page }) => {
  await page.route("**/api/registration/sign-up", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ status: "verification-pending" }),
  }));
  await page.goto("/sign-up");
  await page.getByLabel("Email address").fill("marketer@example.com");
  await page.getByLabel("Password").fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("status")).toContainText("Check your email");
  await expect(page.getByLabel("Password")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Resend email" })).toHaveAttribute("href", "/verify-email");
});

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

      await page.keyboard.press("Tab");
      const skipLink = page.getByRole("link", { name: "Skip to main content" });
      await expect(skipLink).toBeFocused();
      const focusStyle = await skipLink.evaluate((element) => {
        const style = getComputedStyle(element);
        return { width: style.outlineWidth, offset: style.outlineOffset, color: style.outlineColor };
      });
      expect(focusStyle).toMatchObject({ width: "2px", offset: "2px" });
      expect(focusStyle.color).not.toBe("transparent");
      await skipLink.press("Enter");
      await expect(page.locator("main")).toBeFocused();

      await expect(page.getByLabel("Email address")).toHaveAttribute("autocomplete", "email");
      await expect(page.getByLabel("Password")).toHaveAttribute(
        "autocomplete",
        route === "/sign-in" ? "current-password" : "new-password",
      );
      const reveal = page.getByRole("button", { name: "Show password" });
      await expect(reveal).toHaveAttribute("aria-pressed", "false");
      await reveal.click();
      await expect(page.getByLabel("Password")).toHaveAttribute("type", "text");
      await expect(page.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");
      if (route === "/sign-in") {
        await expect(page.getByText("Password reset is not available in this version.")).toBeVisible();
        await expect(page.getByRole("button", { name: "Continue with Google" })).toHaveCount(0);
      } else {
        await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
      }
      const allowedRequests = route === "/sign-in"
        ? ["http://127.0.0.1:4173/api/authentication/google"]
        : [];
      expect(unexpectedRequests).toEqual(allowedRequests);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

      await page.addStyleTag({ content: "* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }" });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

      const routeLink = page.locator(".route-link");
      const box = await routeLink.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      expect(await routeLink.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe("0s");

      await routeLink.focus();
      await routeLink.press("Enter");
      await expect(page.locator("h1")).toBeFocused();
      await expect(page.locator('[aria-live="polite"]')).toContainText("page loaded");
    });
  }
}
