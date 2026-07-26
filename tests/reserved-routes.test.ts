import { describe, expect, it } from "vitest";
import { isReservedApplicationRoute } from "../packages/application/src/reserved-routes.js";

const reserved = [
  "/health/live",
  "/health/ready",
  "/sign-in",
  "/sign-up",
  "/api",
  "/api/links",
  "/api/auth/session",
  "/assets",
  "/assets/app.js",
];
const available = ["/apix", "/assetss", "/unknown"];

describe("reserved application routes", () => {
  it.each(reserved)("reserves %s", (path) => expect(isReservedApplicationRoute(path)).toBe(true));
  it.each(available)("does not reserve lookalike %s", (path) => expect(isReservedApplicationRoute(path)).toBe(false));
});
