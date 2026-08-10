import type { ArgumentsHost } from "@nestjs/common";
import { validate } from "class-validator";
import { describe, expect, it, vi } from "vitest";
import { SignUpRegistrationDto } from "./registration.dto.js";
import { registrationParserError } from "./registration-parser-error.middleware.js";
import { RegistrationProblemFilter } from "./registration-problem.filter.js";
import { registrationProblem } from "./registration-problem.js";

function responseHarness() {
  const headers = new Map<string, string>();
  let status = 0;
  let body: unknown;
  const response = {
    status(code: number) { status = code; return response; },
    set(name: string, value: string) { headers.set(name, value); return response; },
    setHeader(name: string, value: string) { headers.set(name, value); },
    type(value: string) { headers.set("Content-Type", value); return response; },
    json(value: unknown) { body = value; },
  };
  return { response, headers, get status() { return status; }, get body() { return body; } };
}

describe("registration HTTP error contracts", () => {
  it("uses Better Auth's email grammar at the DTO boundary", async () => {
    for (const email of ["ü@example.com", '"x y"@example.com']) {
      const dto = Object.assign(new SignUpRegistrationDto(), {
        email,
        password: "correct-horse-battery-staple",
      });
      expect(await validate(dto)).not.toHaveLength(0);
    }
    const valid = Object.assign(new SignUpRegistrationDto(), {
      email: "marketer@example.com",
      password: "correct-horse-battery-staple",
    });
    expect(await validate(valid)).toEqual([]);
  });

  it.each([
    [{ status: 400, type: "entity.parse.failed" }, 400, "INVALID_JSON"],
    [{ status: 413, type: "entity.too.large" }, 413, "PAYLOAD_TOO_LARGE"],
  ])("normalizes parser failures without leaking parser details", (error, expectedStatus, code) => {
    const result = responseHarness();
    registrationParserError(
      Object.assign(new Error("sensitive parser detail"), error),
      { path: "/api/registration/sign-up" },
      result.response,
      vi.fn(),
    );
    expect(result.status).toBe(expectedStatus);
    expect(result.headers.get("Cache-Control")).toBe("no-store");
    expect(result.headers.get("Content-Type")).toBe("application/problem+json");
    expect(result.body).toMatchObject({
      status: expectedStatus,
      code,
      instance: "/api/registration/sign-up",
    });
    expect(JSON.stringify(result.body)).not.toContain("sensitive parser detail");
  });

  it("sets RFC 9457 instance from the exact request path", () => {
    const result = responseHarness();
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ path: "/api/registration/verify-email" }),
        getResponse: () => result.response,
      }),
    } as ArgumentsHost;
    new RegistrationProblemFilter().catch(
      registrationProblem(400, "Invalid request", "VALIDATION_FAILED", "/api/registration"),
      host,
    );
    expect(result.body).toMatchObject({ instance: "/api/registration/verify-email" });
  });
});
