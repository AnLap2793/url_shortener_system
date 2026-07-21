import { describe, expect, it } from "vitest";
import { isReservedApplicationRoute, reservedExactRoutes, reservedRoutePrefixes } from "../packages/application/src/reserved-routes.js";

describe("reserved application routes", () => {
  it("covers exact routes and segment-bounded prefixes", () => {
    for (const path of [...reservedExactRoutes, ...reservedRoutePrefixes, "/api/links", "/api/auth/session", "/assets/app.js"]) {
      expect(isReservedApplicationRoute(path)).toBe(true);
    }
    for (const path of ["/apix", "/assetss", "/unknown"]) expect(isReservedApplicationRoute(path)).toBe(false);
  });
});
