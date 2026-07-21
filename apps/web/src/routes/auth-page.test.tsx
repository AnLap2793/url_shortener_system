import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { AuthPage } from "./auth-page.js";

describe("public auth shell", () => {
  it("renders landmarks, skip link, heading, and route link without dead auth controls", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AuthPage mode="sign-in" />
      </MemoryRouter>,
    );
    expect(html).toContain('href="#main-content"');
    expect(html).toContain("<main");
    expect(html).toContain("<h1");
    expect(html).toContain('href="/sign-up"');
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<button");
    expect(html).not.toContain('type="password"');
  });
});
