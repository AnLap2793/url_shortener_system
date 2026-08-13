import { expect, test } from "@playwright/test";

test("Google collision returns a local non-enumerating recovery state", async ({ page }) => {
  await page.route("**/api/authentication/google", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ enabled: true }),
  }));
  await page.goto("/sign-in?google=collision&redirectTo=%2Faccount");

  await expect(page.getByRole("alert")).toContainText("Google is not linked to this account.");
  await expect(page.getByRole("alert")).not.toContainText("@example.com");
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.locator('form[action="/api/authentication/sign-in/google"] input[name="redirectTo"]')).toHaveValue("/account");
});

test("Google CTA is a native same-origin form control", async ({ page }) => {
  await page.route("**/api/authentication/google", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ enabled: true }),
  }));
  await page.goto("/sign-in?redirectTo=%2Flinks%3Ffilter%3Dactive");

  const control = page.getByRole("button", { name: "Continue with Google" });
  await expect(control).toBeVisible();
  const box = await control.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
  await expect(page.locator('form[action="/api/authentication/sign-in/google"]')).toHaveAttribute("method", "post");
  await expect(page.locator('input[name="redirectTo"]')).toHaveValue("/links?filter=active");

  const request = page.waitForRequest("**/api/authentication/sign-in/google");
  await page.route("**/api/authentication/sign-in/google", (route) => route.fulfill({ status: 200, body: "ok" }));
  await control.click();
  expect((await request).headers().origin).toBe(new URL(page.url()).origin);
});
