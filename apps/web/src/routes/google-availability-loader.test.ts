import { createApiClient } from "@url-shortener/contracts";
import { describe, expect, it } from "vitest";
import { createGoogleAvailabilityLoader } from "./google-availability-loader.js";

function clientReturning(status: number, body?: unknown) {
  return createApiClient(async () => new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  }), "http://localhost");
}

describe("Google availability loader", () => {
  it("exposes the enabled flag from the same-origin generated client", async () => {
    const loader = createGoogleAvailabilityLoader(clientReturning(200, { enabled: true }));
    await expect(loader()).resolves.toEqual({ enabled: true });
  });

  it("hides the CTA for disabled, failed, and unavailable responses", async () => {
    await expect(createGoogleAvailabilityLoader(clientReturning(200, { enabled: false }))())
      .resolves.toEqual({ enabled: false });
    await expect(createGoogleAvailabilityLoader(clientReturning(503))()).resolves.toEqual({ enabled: false });
    const loader = createGoogleAvailabilityLoader(createApiClient(async () => {
      throw new TypeError("network down");
    }, "http://localhost"));
    await expect(loader()).resolves.toEqual({ enabled: false });
  });
});
