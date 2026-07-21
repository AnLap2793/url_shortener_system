import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { RouteAnnouncer } from "./route-announcer.js";

interface AuthPageProps {
  mode: "sign-in" | "sign-up";
}

export function AuthPage({ mode }: AuthPageProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousMode = useRef(mode);
  const isSignIn = mode === "sign-in";
  const heading = isSignIn ? "Sign in" : "Sign up";

  useEffect(() => {
    document.title = `${heading} | Campaign Links`;
    if (previousMode.current !== mode) headingRef.current?.focus();
    previousMode.current = mode;
  }, [heading, mode]);
  const otherRoute = isSignIn ? "/sign-up" : "/sign-in";
  const otherLabel = isSignIn ? "Create an account" : "Back to sign in";

  return (
    <>
      <RouteAnnouncer message={`${heading} page loaded`} />
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="site-header">
        <span>Campaign Links</span>
      </header>
      <main id="main-content" className="auth-shell" tabIndex={-1}>
        <section aria-labelledby="auth-heading" className="auth-card">
          <p className="eyebrow">Secure marketer workspace</p>
          <h1 ref={headingRef} id="auth-heading" tabIndex={-1}>{heading}</h1>
          <p>Authentication will be available in a later setup step.</p>
          <Link className="route-link" to={otherRoute}>
            {otherLabel}
          </Link>
        </section>
      </main>
      <footer className="site-footer">URL Shortener System</footer>
    </>
  );
}
