import { renderToStaticMarkup } from "react-dom/server";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { AuthPage } from "./auth-page.js";

function render(mode: "sign-in" | "sign-up") {
  const router = createMemoryRouter([{ path: "/", element: <AuthPage mode={mode} /> }]);
  return renderToStaticMarkup(<RouterProvider router={router} />);
}

describe("public auth shell", () => {
  it("keeps sign-in as a placeholder", () => {
    const html = render("sign-in");
    expect(html).toContain('href="#main-content"');
    expect(html).toContain('href="/sign-up"');
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain("<form");
  });

  it("renders an accessible sign-up form with password manager semantics", () => {
    const html = render("sign-up");
    expect(html).toContain('method="post"');
    expect(html).toContain('type="email"');
    expect(html).toContain('autoComplete="email"');
    expect(html).toContain('type="password"');
    expect(html).toContain('autoComplete="new-password"');
    expect(html).toContain('minLength="12"');
    expect(html).toContain('maxLength="128"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("Show password");
    expect(html).not.toContain("onpaste");
  });
});
