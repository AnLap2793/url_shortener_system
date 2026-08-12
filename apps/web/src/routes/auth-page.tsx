import { useEffect, useRef, useState } from "react";
import { Form, Link, useActionData, useLocation, useNavigation } from "react-router";
import { ErrorSummary } from "../components/error-summary.js";
import { PrimaryButton } from "../components/primary-button.js";
import { RouteAnnouncer } from "./route-announcer.js";
import type { SignInActionResult } from "./authentication-actions.js";
import type { SignUpActionResult } from "./registration-actions.js";

interface AuthPageProps {
  mode: "sign-in" | "sign-up";
}

export function AuthPage({ mode }: AuthPageProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousMode = useRef(mode);
  const isSignIn = mode === "sign-in";
  const heading = isSignIn ? "Sign in" : "Sign up";
  const action = useActionData() as SignUpActionResult | SignInActionResult | undefined;
  const navigation = useNavigation();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const pending = navigation.state === "submitting";

  useEffect(() => {
    document.title = `${heading} | Campaign Links`;
    if (previousMode.current !== mode) headingRef.current?.focus();
    previousMode.current = mode;
  }, [heading, mode]);

  const otherRoute = isSignIn ? "/sign-up" : "/sign-in";
  const otherLabel = isSignIn ? "Create an account" : "Back to sign in";
  if (isSignIn) {
    return <SignInForm action={action as SignInActionResult | undefined} heading={heading} headingRef={headingRef} otherRoute={otherRoute} otherLabel={otherLabel} pending={pending} redirectTo={location.search} showPassword={showPassword} setShowPassword={setShowPassword} />;
  }

  const signUpAction = action as SignUpActionResult | undefined;
  if (signUpAction?.status === "verification-pending") {
    return (
      <AuthShell heading={heading} headingRef={headingRef} otherRoute={otherRoute} otherLabel={otherLabel}>
        <p role="status">Check your email for a verification link.</p>
        <Link className="route-link" to="/verify-email">Resend email</Link>
      </AuthShell>
    );
  }

  const email = signUpAction?.status === "error" || signUpAction?.status === "invalid" ? signUpAction.email ?? "" : "";
  const errors = signUpAction?.status === "invalid" ? signUpAction.errors : [];
  return (
    <AuthShell heading={heading} headingRef={headingRef} otherRoute={otherRoute} otherLabel={otherLabel}>
      <Form method="post" replace noValidate onSubmit={(event) => { if (pending) event.preventDefault(); }}>
        <ErrorSummary errors={errors} />
        {signUpAction?.status === "error" && <p role="alert">{signUpAction.message}</p>}
        <p id="email-description">Use your work email address.</p>
        <label htmlFor="email">Email address</label>
        <input id="email" name="email" type="email" autoComplete="email" defaultValue={email} aria-describedby="email-description" aria-invalid={errors.some((error) => error.fieldId === "email") || undefined} required />
        <PasswordControl showPassword={showPassword} setShowPassword={setShowPassword} autoComplete="new-password" invalid={errors.some((error) => error.fieldId === "password")} />
        <PrimaryButton type="submit" loading={pending} loadingLabel="Creating account…">Create account</PrimaryButton>
      </Form>
    </AuthShell>
  );
}

function SignInForm({ action, heading, headingRef, otherRoute, otherLabel, pending, redirectTo, showPassword, setShowPassword }: {
  action: SignInActionResult | undefined;
  heading: string;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  otherRoute: string;
  otherLabel: string;
  pending: boolean;
  redirectTo: string;
  showPassword: boolean;
  setShowPassword: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const passwordRef = useRef<HTMLInputElement>(null);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  useEffect(() => {
    if (action && action.status !== "invalid" && passwordRef.current) passwordRef.current.value = "";
  }, [action]);
  useEffect(() => {
    let active = true;
    fetch("/api/authentication/google", { credentials: "same-origin" })
      .then((response) => response.ok ? response.json() as Promise<{ enabled?: boolean }> : undefined)
      .then((result) => { if (active) setGoogleEnabled(result?.enabled === true); })
      .catch(() => { if (active) setGoogleEnabled(false); });
    return () => { active = false; };
  }, []);
  const errors = action?.status === "invalid" ? action.errors : [];
  const email = action && "email" in action ? action.email ?? "" : "";
  const message = action?.status === "credentials-invalid"
    ? "Invalid email or password."
    : action?.status === "verification-required"
      ? "Verify your email before signing in. You can request another verification email."
      : action?.status === "throttled"
        ? `Too many sign-in attempts. Try again in ${action.retryAfterSeconds} seconds.`
        : action?.status === "error"
          ? action.message
          : undefined;
  const googleStatus = new URLSearchParams(redirectTo).get("google");
  const googleMessage = googleStatus === "unavailable"
    ? "Google sign-in is temporarily unavailable. Try email and password or try again later."
    : undefined;
  const intendedRoute = new URLSearchParams(redirectTo).get("redirectTo") ?? "";

  return (
    <AuthShell heading={heading} headingRef={headingRef} otherRoute={otherRoute} otherLabel={otherLabel}>
      <Form method="post" replace noValidate onSubmit={(event) => { if (pending) event.preventDefault(); }}>
        <ErrorSummary errors={errors} />
        {message && <p role="alert">{message}</p>}
        {googleMessage && <p role="alert">{googleMessage}</p>}
        {action?.status === "verification-required" && <Link className="route-link" to="/verify-email">Resend verification email</Link>}
        <p id="email-description">Use your work email address.</p>
        <label htmlFor="email">Email address</label>
        <input key={email} id="email" name="email" type="email" autoComplete="email" defaultValue={email} aria-describedby="email-description" aria-invalid={errors.some((error) => error.fieldId === "email") || undefined} required />
        <PasswordControl passwordRef={passwordRef} showPassword={showPassword} setShowPassword={setShowPassword} autoComplete="current-password" minLength={1} invalid={errors.some((error) => error.fieldId === "password")} />
        <PrimaryButton type="submit" loading={pending} loadingLabel="Signing in…">Sign in</PrimaryButton>
      </Form>
      {googleEnabled && <form method="post" action="/api/authentication/sign-in/google" onSubmit={(event) => {
        if (googlePending) event.preventDefault();
        else setGooglePending(true);
      }}>
        {intendedRoute && <input type="hidden" name="redirectTo" value={intendedRoute} />}
        <button type="submit" className="primary-button focus-indicator" disabled={googlePending}>
          {googlePending ? "Opening Google…" : "Continue with Google"}
        </button>
      </form>}
      <p>Password reset is not available in this version.</p>
    </AuthShell>
  );
}

function PasswordControl({ passwordRef, showPassword, setShowPassword, autoComplete, minLength = 12, invalid }: {
  passwordRef?: React.RefObject<HTMLInputElement | null>;
  showPassword: boolean;
  setShowPassword: React.Dispatch<React.SetStateAction<boolean>>;
  autoComplete: "new-password" | "current-password";
  minLength?: number;
  invalid: boolean;
}) {
  return <><label htmlFor="password">Password</label><div className="password-control"><input ref={passwordRef} id="password" name="password" type={showPassword ? "text" : "password"} autoComplete={autoComplete} minLength={minLength} maxLength={128} aria-invalid={invalid || undefined} required /><button type="button" className="focus-indicator" aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>{showPassword ? "Hide password" : "Show password"}</button></div></>;
}

function AuthShell({ heading, headingRef, otherRoute, otherLabel, children }: {
  heading: string;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  otherRoute: string;
  otherLabel: string;
  children?: React.ReactNode;
}) {
  return (
    <>
      <RouteAnnouncer message={`${heading} page loaded`} />
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="site-header"><span>Campaign Links</span></header>
      <main id="main-content" className="auth-shell" tabIndex={-1}>
        <section aria-labelledby="auth-heading" className="auth-card">
          <p className="eyebrow">Secure marketer workspace</p>
          <h1 ref={headingRef} id="auth-heading" tabIndex={-1}>{heading}</h1>
          {children}
          <Link className="route-link" to={otherRoute}>{otherLabel}</Link>
        </section>
      </main>
      <footer className="site-footer">URL Shortener System</footer>
    </>
  );
}
