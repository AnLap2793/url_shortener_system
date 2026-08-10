import { renderToStaticMarkup } from "react-dom/server";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { VerifyEmailPage } from "./verify-email-page.js";

describe("verify email page", () => {
  it("renders verification status, resend form, and accessible navigation", () => {
    const router = createMemoryRouter([{ path: "/verify-email", element: <VerifyEmailPage /> }], {
      initialEntries: ["/verify-email"],
    });
    const html = renderToStaticMarkup(<RouterProvider router={router} />);
    expect(html).toContain("Verify email");
    expect(html).toContain('role="status"');
    expect(html).toContain('type="email"');
    expect(html).toContain('autoComplete="email"');
    expect(html).toContain("Resend email");
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('href="/sign-in"');
  });
});
