import { expect, test } from "@playwright/test";

for (const route of ["/sign-in", "/sign-up"]) {
  test(`${route} is accessible and reflows`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("h1")).toHaveText(
      route === "/sign-in" ? "Sign in" : "Sign up",
    );
    await expect(page).toHaveTitle(
      route === "/sign-in" ? /Sign in/ : /Sign up/,
    );
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page.addStyleTag({
      content:
        "* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; }",
    });
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.keyboard.press("Tab");
    const focused = page.locator(":focus");
    await expect(focused).toHaveAttribute("href", "#main-content");
    expect(
      await focused.evaluate(
        (element) => getComputedStyle(element).outlineWidth,
      ),
    ).toBe("2px");
    await page.keyboard.press("Enter");
    await expect(page.locator("main")).toBeFocused();
  });
}
