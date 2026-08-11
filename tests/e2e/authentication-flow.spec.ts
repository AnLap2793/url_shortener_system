import { expect, test } from "@playwright/test";

test("sign-in accepts only a safe redirect and clears password after an invalid response", async ({ page }) => {
  await page.route("**/api/authentication/sign-in", (route) => route.fulfill({
    status: 401,
    contentType: "application/problem+json",
    body: JSON.stringify({ code: "INVALID_CREDENTIALS" }),
  }));
  await page.goto("/sign-in?redirectTo=https%3A%2F%2Fevil.example");
  await page.getByLabel("Email address").fill("marketer@example.com");
  await page.getByLabel("Password").fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("alert")).toContainText("Invalid email or password.");
  await expect(page.getByLabel("Email address")).toHaveValue("marketer@example.com");
  await expect(page.getByLabel("Password")).toHaveValue("");
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

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/sign-in");
  await page.goto("/account");
  await page.waitForURL("**/sign-in?redirectTo=%2Faccount");
});

test("a sign-out failure keeps the protected account surface available", async ({ page }) => {
  await page.route("**/api/me", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ actorId: "actor-1" }),
  }));
  await page.route("**/api/authentication/sign-out", (route) => route.fulfill({
    status: 503,
    contentType: "application/problem+json",
    body: JSON.stringify({ code: "AUTHENTICATION_UNAVAILABLE" }),
  }));
  await page.goto("/account");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("alert")).toContainText("Sign-out is temporarily unavailable.");
});
