import { createApiClient } from "@url-shortener/contracts";
import { safeAuthRedirect } from "@url-shortener/domain";
import { redirect, type ShouldRevalidateFunctionArgs } from "react-router";

export type SignInActionResult =
  | { status: "invalid"; errors: Array<{ fieldId: string; message: string }>; email?: string }
  | { status: "credentials-invalid"; email: string }
  | { status: "verification-required"; email: string }
  | { status: "throttled"; email: string; retryAfterSeconds: number }
  | { status: "error"; email?: string; message: string };

export type SignOutActionResult = { status: "error"; message: string };

export function shouldRevalidateProtectedSession({
  actionResult,
  formAction,
  formMethod,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs): boolean {
  if (
    formMethod?.toUpperCase() === "POST"
    && formAction?.endsWith("/account")
    && (actionResult as SignOutActionResult | undefined)?.status === "error"
  ) return false;
  return defaultShouldRevalidate;
}

interface ActionArgs {
  request: Request;
}

export function safeRedirectTo(request: Request): string {
  const url = new URL(request.url);
  return safeAuthRedirect(url.searchParams.get("redirectTo"), url.origin);
}

export async function signInAction({ request }: ActionArgs): Promise<Response | SignInActionResult> {
  return executeSignInAction(request, fetch);
}

export async function executeSignInAction(
  request: Request,
  fetchImplementation: typeof fetch,
): Promise<Response | SignInActionResult> {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const errors = validate(email, password);
  if (errors.length) return { status: "invalid", errors, email };

  try {
    const origin = new URL(request.url).origin;
    const client = createApiClient(fetchImplementation, origin);
    const result = await client.POST("/api/authentication/sign-in", {
      body: { email, password },
      headers: { Origin: origin, "Sec-Fetch-Site": "same-origin" },
    });
    if (result.response.ok && result.data?.status === "signed-in") {
      return redirect(safeRedirectTo(request), 303);
    }
    if (result.response.status === 401) return { status: "credentials-invalid", email };
    if (result.response.status === 403) return { status: "verification-required", email };
    if (result.response.status === 429) {
      return { status: "throttled", email, retryAfterSeconds: retryAfter(result.response.headers) };
    }
  } catch {
    // A generic recovery state avoids exposing transport or server details.
  }
  return { status: "error", email, message: "Sign-in is temporarily unavailable. Try again." };
}

export async function signOutAction({ request }: ActionArgs): Promise<Response | SignOutActionResult> {
  return executeSignOutAction(request, fetch);
}

export async function executeSignOutAction(
  request: Request,
  fetchImplementation: typeof fetch,
): Promise<Response | SignOutActionResult> {
  try {
    const origin = new URL(request.url).origin;
    const client = createApiClient(fetchImplementation, origin);
    const result = await client.POST("/api/authentication/sign-out", {
      headers: { Origin: origin, "Sec-Fetch-Site": "same-origin" },
    });
    if (result.response.ok && result.data?.status === "signed-out") return redirect("/sign-in", 303);
  } catch {
    // Keep the protected surface available until the server confirms logout.
  }
  return { status: "error", message: "Sign-out is temporarily unavailable. Try again." };
}

function validate(email: string, password: string): Array<{ fieldId: string; message: string }> {
  const errors: Array<{ fieldId: string; message: string }> = [];
  if (!/^\S+@\S+\.\S+$/.test(email)) errors.push({ fieldId: "email", message: "Enter a valid email address." });
  if (password.length < 1 || password.length > 128) {
    errors.push({ fieldId: "password", message: "Enter a password of at most 128 characters." });
  }
  return errors;
}

function retryAfter(headers: Headers): number {
  const value = Number(headers.get("Retry-After"));
  return Number.isSafeInteger(value) && value > 0 ? value : 1;
}
