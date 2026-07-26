import { describe, expect, it } from "vitest";
import {
  isControllerOwnedRoute,
  isReservedApplicationRoute,
} from "../packages/application/src/reserved-routes.js";

const reserved = [
  "/health",
  "/health/live",
  "/health/ready",
  "/sign-in",
  "/sign-up",
  "/dashboard",
  "/links",
  "/account",
  "/api",
  "/api/links",
  "/api/auth/session",
  "/assets",
  "/assets/app.js",
];
const available = ["/apix", "/assetss", "/unknown", "/dashboardx", "/links2", "/accounts", "/healthz"];

const controllerOwned = [
  "/health",
  "/health/live",
  "/health/ready",
  "/api",
  "/api/auth/session",
  "/assets",
  "/assets/app.js",
];
const spaDocuments = ["/sign-in", "/sign-up", "/dashboard", "/links", "/account", "/unknown", "/links/deep", "/healthz"];

describe("reserved application routes", () => {
  it.each(reserved)("reserves %s", (path) => expect(isReservedApplicationRoute(path)).toBe(true));
  it.each(available)("does not reserve lookalike %s", (path) => expect(isReservedApplicationRoute(path)).toBe(false));
  it.each(controllerOwned)("controllers own %s", (path) => expect(isControllerOwnedRoute(path)).toBe(true));
  it.each(spaDocuments)("SPA document may serve %s", (path) => expect(isControllerOwnedRoute(path)).toBe(false));
});
