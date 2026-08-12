import { expect, test } from "@playwright/test";

test("sign-in normalizes input, uses the facade protocol and rejects unsafe redirects", async ({ page }) => {
  let requestBody: unknown;
  await page.route("**/api/authentication/sign-in", async (route) => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 401,
      contentType: "application/problem+json",
      body: JSON.stringify({ code: "INVALID_CREDENTIALS" }),
    });
  });
  await page.goto("/sign-in?redirectTo=%2Fdashboard%2F..%2Faccount");
  await page.getByLabel("Email address").fill(" Marketer@Example.COM ");
  await page.getByLabel("Password").fill("wrong");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("alert")).toContainText("Invalid email or password.");
  await expect(page.getByLabel("Email address")).toHaveValue("marketer@example.com");
  await expect(page.getByLabel("Password")).toHaveValue("");
  expect(requestBody).toEqual({ email: "marketer@example.com", password: "wrong" });
});

test("sign-in and sign-out navigate only after their facade confirms success", async ({ page }) => {
  let authenticated = false;
  await page.route("**/api/me", (route) => route.fulfill({
    status: authenticated ? 200 : 401,
    contentType: authenticated ? "application/json" : "application/problem+json",
    body: JSON.stringify(authenticated ? { actorId: "actor-1" } : { code: "UNAUTHENTICATED" }),
  }));
  await page.route("**/api/authentication/sign-in", (route) => {
    authenticated = true;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "signed-in" }) });
  });
  await page.route("**/api/authentication/sign-out", (route) => {
    authenticated = false;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "signed-out" }) });
  });

  await page.goto("/sign-in?redirectTo=%2Faccount");
  await page.getByLabel("Email address").fill("marketer@example.com");
  await page.getByLabel("Password").fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/account");
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await page.getByRole("link", { name: "Dashboard" }).first().click();
  await expect(page.locator("#main-content")).toBeFocused();
  await page.getByRole("link", { name: "Account" }).first().click();

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/sign-in");
  await page.goto("/account");
  await page.waitForURL("**/sign-in?redirectTo=%2Faccount");
});

test("a sign-out failure keeps the protected account surface without reloading session", async ({ page }) => {
  let sessionRequests = 0;
  await page.route("**/api/me", (route) => {
    sessionRequests += 1;
    return route.fulfill({
      status: sessionRequests === 1 ? 200 : 503,
      contentType: sessionRequests === 1 ? "application/json" : "application/problem+json",
      body: JSON.stringify(sessionRequests === 1
        ? { actorId: "actor-1" }
        : { code: "AUTHENTICATION_UNAVAILABLE" }),
    });
  });
  await page.route("**/api/authentication/sign-out", (route) => route.fulfill({
    status: 503,
    contentType: "application/problem+json",
    body: JSON.stringify({ code: "AUTHENTICATION_UNAVAILABLE" }),
  }));
  await page.goto("/account");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("alert")).toContainText("Sign-out is temporarily unavailable.");
  expect(sessionRequests).toBe(1);
});
