import { useEffect } from "react";
import { Link } from "react-router";

interface AuthPageProps {
  mode: "sign-in" | "sign-up";
}

export function AuthPage({ mode }: AuthPageProps) {
  const isSignIn = mode === "sign-in";
  useEffect(() => {
    document.title = `${isSignIn ? "Sign in" : "Sign up"} | Campaign Links`;
  }, [isSignIn]);
  const heading = isSignIn ? "Sign in" : "Sign up";
  const otherRoute = isSignIn ? "/sign-up" : "/sign-in";
  const otherLabel = isSignIn ? "Create an account" : "Back to sign in";

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="site-header">
        <span>Campaign Links</span>
      </header>
      <main id="main-content" className="auth-shell" tabIndex={-1}>
        <section aria-labelledby="auth-heading" className="auth-card">
          <p className="eyebrow">Secure marketer workspace</p>
          <h1 id="auth-heading">{heading}</h1>
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
