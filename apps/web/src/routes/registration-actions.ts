import { createApiClient } from "@url-shortener/contracts";

export type SignUpActionResult =
  | { status: "invalid"; errors: Array<{ fieldId: string; message: string }>; email?: string }
  | { status: "verification-pending"; email: string }
  | { status: "error"; email: string; message: string };

interface ActionArgs {
  request: Request;
}

type RegistrationFieldError = { fieldId: string; message: string };

function validate(email: string, password: string): RegistrationFieldError[] {
  const errors: RegistrationFieldError[] = [];
  if (!/^\S+@\S+\.\S+$/.test(email)) errors.push({ fieldId: "email", message: "Enter a valid email address." });
  if (password.length < 12 || password.length > 128) errors.push({ fieldId: "password", message: "Password must be 12–128 characters." });
  return errors;
}

export async function signUpAction(
  { request }: ActionArgs,
): Promise<SignUpActionResult> {
  return executeSignUpAction(request, fetch);
}

export async function executeSignUpAction(
  request: Request,
  fetchImplementation: typeof fetch,
): Promise<SignUpActionResult> {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const errors = validate(email, password);
  if (errors.length) return { status: "invalid", errors, email };

  try {
    const client = createApiClient(fetchImplementation, new URL(request.url).origin);
    const response = await client.POST("/api/registration/sign-up", {
      body: { email, password },
      headers: { Origin: new URL(request.url).origin, "Sec-Fetch-Site": "same-origin" },
    });
    if (response.response.ok && response.data?.status === "verification-pending") {
      return { status: "verification-pending", email };
    }
    return { status: "error", email, message: "Registration is temporarily unavailable. Try again." };
  } catch {
    return { status: "error", email, message: "Registration is temporarily unavailable. Try again." };
  }
}
