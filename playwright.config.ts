import { defineConfig } from "@playwright/test";

const unreachableDatabaseUrl = "postgres://test:test@127.0.0.1:9/url_shortener_e2e";

export default defineConfig({
  testDir: "./tests/e2e",
  forbidOnly: Boolean(process.env.CI),
  projects: [
    {
      name: "shell",
      testMatch: /(auth-shell|shell-smoke)\.spec\.ts/,
      use: { baseURL: "http://127.0.0.1:4173" },
    },
    {
      name: "components",
      testMatch: /component-contracts\.spec\.ts/,
      use: { baseURL: "http://127.0.0.1:4174" },
    },
  ],
  webServer: [
    {
      // Same-origin production host: NestJS serves the built SPA even while the
      // database is unreachable (degraded readiness must not break serving).
      command:
        "npm run build:packages && npm run build --workspace=@url-shortener/web && npm run build --workspace=@url-shortener/api && node apps/api/dist/main.js",
      port: 4173,
      reuseExistingServer: false,
      env: {
        PORT: "4173",
        WEB_DIST_DIR: "apps/web/dist",
        // Always unreachable: shell-smoke asserts degraded readiness (503), so
        // an ambient developer DATABASE_URL must never leak into this server.
        DATABASE_URL: unreachableDatabaseUrl,
      },
      timeout: 180_000,
    },
    {
      command:
        "npm run build:harness --workspace=@url-shortener/web && npm run preview:harness --workspace=@url-shortener/web -- --host 127.0.0.1",
      port: 4174,
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
