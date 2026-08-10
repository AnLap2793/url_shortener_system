import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { PrimaryButton } from "../components/primary-button.js";
import { RouteAnnouncer } from "./route-announcer.js";
import { resendVerification, verifyEmailToken, type VerificationResult } from "./verification-actions.js";

export function VerifyEmailPage() {
  const token = useRef(typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("token"));
  const [result, setResult] = useState<VerificationResult>({ status: "delayed" });
  const [checking, setChecking] = useState(Boolean(token.current));
  const [email, setEmail] = useState("");
  const [resendStatus, setResendStatus] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    document.title = "Verify email | Campaign Links";
    history.replaceState(history.state, "", window.location.pathname);
    if (!token.current) {
      setResult({ status: "invalid" });
      setChecking(false);
      return;
    }
    const verificationToken = token.current;
    token.current = null;
    void verifyEmailToken(verificationToken).then((value) => {
      setResult(value);
      setChecking(false);
    });
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1_000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function resend(event: React.FormEvent) {
    event.preventDefault();
    const response = await resendVerification(email);
    if (response.status === "cooldown") {
      setCooldown(response.retryAfterSeconds);
      setResendStatus(`Try again in ${response.retryAfterSeconds} seconds.`);
    } else if (response.status === "verification-pending") {
      setResendStatus("If the account can be verified, a new email is on its way.");
    } else setResendStatus("Email delivery is delayed. Try again later.");
  }

  const copy = checking
    ? "Checking your verification link…"
    : result.status === "verified"
      ? "Your email is verified. You can now sign in."
      : result.status === "invalid"
        ? "This verification link is invalid or expired."
        : "Verification is delayed. Try again shortly.";

  return (
    <>
      <RouteAnnouncer message="Verify email page loaded" />
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="site-header"><span>Campaign Links</span></header>
      <main id="main-content" className="auth-shell" tabIndex={-1}>
        <section className="auth-card" aria-labelledby="verify-heading">
          <p className="eyebrow">Secure marketer workspace</p>
          <h1 id="verify-heading">Verify email</h1>
          <p role="status">{copy}</p>
          {result.status !== "verified" && !checking && (
            <form onSubmit={resend}>
              <label htmlFor="resend-email">Email address</label>
              <input id="resend-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              <PrimaryButton type="submit" disabled={cooldown > 0}>{cooldown > 0 ? `Resend in ${cooldown}s` : "Resend email"}</PrimaryButton>
              <p aria-live="polite">{resendStatus}</p>
            </form>
          )}
          <Link className="route-link" to="/sign-in">{result.status === "verified" ? "Sign in" : "Back to sign in"}</Link>
        </section>
      </main>
      <footer className="site-footer">URL Shortener System</footer>
    </>
  );
}
