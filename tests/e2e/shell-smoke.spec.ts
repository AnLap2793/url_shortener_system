import { expect, test } from "@playwright/test";

test("deep protected route refresh serves the SPA document then redirects to sign-in", async ({ page }) => {
  const response = await page.goto("/dashboard");
  expect(response?.status()).toBe(200);
  expect(response?.headers()["content-type"]).toContain("text/html");
  await page.waitForURL("**/sign-in?redirectTo=%2Fdashboard");
  await expect(page.locator("h1")).toHaveText("Sign in");
});

test("protected routes preserve their own intended path and query", async ({ page }) => {
  await page.goto("/links?filter=active");
  await page.waitForURL("**/sign-in?redirectTo=%2Flinks%3Ffilter%3Dactive");
  await page.goto("/account");
  await page.waitForURL("**/sign-in?redirectTo=%2Faccount");
});

test("browser refresh on a public route never 404s", async ({ page }) => {
  await page.goto("/sign-up");
  const reloaded = await page.reload();
  expect(reloaded?.status()).toBe(200);
  await expect(page.locator("h1")).toHaveText("Sign up");
});

test("unknown API paths stay JSON 404 while unknown browser paths get the SPA", async ({ page }) => {
  const api = await page.request.get("/api/unknown", { headers: { accept: "text/html" } });
  expect(api.status()).toBe(404);
  expect(api.headers()["content-type"]).toContain("application/json");

  const spa = await page.request.get("/some/unknown/browser/path", { headers: { accept: "text/html" } });
  expect(spa.status()).toBe(200);
  expect(spa.headers()["content-type"]).toContain("text/html");
});

test("liveness stays healthy on the same origin while the database is down", async ({ page }) => {
  const live = await page.request.get("/health/live");
  expect(live.status()).toBe(200);
  const ready = await page.request.get("/health/ready");
  expect(ready.status()).toBe(503);
});
