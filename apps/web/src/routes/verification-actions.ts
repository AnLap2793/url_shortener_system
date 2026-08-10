import { createApiClient } from "@url-shortener/contracts";

export type VerificationResult = { status: "verified" | "invalid" | "delayed" };
export type ResendResult =
  | { status: "verification-pending" }
  | { status: "cooldown"; retryAfterSeconds: number }
  | { status: "error" };

function headers(origin: string) {
  return { Origin: origin, "Sec-Fetch-Site": "same-origin" } as const;
}

export async function verifyEmailToken(
  token: string,
  fetchImplementation: typeof fetch = fetch,
  origin = window.location.origin,
): Promise<VerificationResult> {
  try {
    const result = await createApiClient(fetchImplementation, origin).POST("/api/registration/verify-email", {
      body: { token },
      headers: headers(origin),
    });
    if (result.response.ok && result.data?.status === "verified") return { status: "verified" };
    return { status: result.response.status === 400 ? "invalid" : "delayed" };
  } catch {
    return { status: "delayed" };
  }
}

export async function resendVerification(
  email: string,
  fetchImplementation: typeof fetch = fetch,
  origin = window.location.origin,
): Promise<ResendResult> {
  try {
    const result = await createApiClient(fetchImplementation, origin).POST("/api/registration/resend-verification", {
      body: { email },
      headers: headers(origin),
    });
    if (result.response.ok) return { status: "verification-pending" };
    if (result.response.status === 429) {
      const value = result.response.headers.get("Retry-After");
      return { status: "cooldown", retryAfterSeconds: value && /^\d+$/.test(value) ? Number(value) : 1 };
    }
    return { status: "error" };
  } catch {
    return { status: "error" };
  }
}
