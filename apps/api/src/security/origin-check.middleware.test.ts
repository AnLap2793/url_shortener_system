import { describe, expect, it } from "vitest";
import { createOriginCheck } from "./origin-check.middleware.js";

const publicOrigin = "http://127.0.0.1:4173";

interface Sent { status?: number; body?: string; headers: Record<string, string> }

function run(method: string, headers: Record<string, string | undefined>): { nexted: boolean; sent: Sent } {
  const check = createOriginCheck(publicOrigin);
  const sent: Sent = { headers: {} };
  let nexted = false;
  check(
    { method, headers },
    {
      set statusCode(value: number) {
        sent.status = value;
      },
      setHeader(name: string, value: string) {
        sent.headers[name.toLowerCase()] = value;
      },
      end(body?: string) {
        sent.body = body;
      },
    },
    () => {
      nexted = true;
    },
  );
  return { nexted, sent };
}

describe("AD-18 origin check", () => {
  it("passes safe methods through untouched", () => {
    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      expect(run(method, {}).nexted, method).toBe(true);
    }
  });

  it("accepts unsafe requests with the exact public origin and same-origin fetch site", () => {
    const { nexted } = run("POST", { origin: publicOrigin, "sec-fetch-site": "same-origin" });
    expect(nexted).toBe(true);
  });

  it("rejects missing, mismatched, or cross-site headers with 403 problem+json", () => {
    const cases: Record<string, string | undefined>[] = [
      {},
      { origin: publicOrigin },
      { "sec-fetch-site": "same-origin" },
      { origin: "https://evil.example", "sec-fetch-site": "same-origin" },
      { origin: publicOrigin, "sec-fetch-site": "cross-site" },
      { origin: `${publicOrigin}.evil.example`, "sec-fetch-site": "same-origin" },
    ];
    for (const headers of cases) {
      const { nexted, sent } = run("POST", headers);
      expect(nexted, JSON.stringify(headers)).toBe(false);
      expect(sent.status).toBe(403);
      expect(sent.headers["content-type"]).toBe("application/problem+json");
      expect(JSON.parse(sent.body!)).toMatchObject({ status: 403, code: "CSRF_REJECTED" });
    }
  });

  it("rejects every unsafe method the same way", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(run(method, {}).sent.status, method).toBe(403);
    }
  });
});
