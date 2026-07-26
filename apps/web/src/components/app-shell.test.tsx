import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { AppShell } from "./app-shell.js";

function renderShellAt(path: string): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <AppShell>
        <h1>Surface</h1>
      </AppShell>
    </MemoryRouter>,
  );
}

describe("AppShell contract", () => {
  it("renders skip link, landmarks, primary navigation and live region", () => {
    const html = renderShellAt("/links");
    expect(html).toContain('href="#main-content"');
    expect(html).toContain("<header");
    expect(html).toContain('<nav aria-label="Primary"');
    expect(html).toContain('id="main-content"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain('href="/links"');
    expect(html).toContain('href="/account"');
  });

  it("marks exactly one active navigation item in each nav landmark", () => {
    for (const [path, label] of [
      ["/dashboard", "Dashboard"],
      ["/links", "Links"],
      ["/account", "Account"],
    ] as const) {
      const html = renderShellAt(path);
      const navSections = html.split("<nav ").slice(1);
      expect(navSections, path).toHaveLength(2);
      for (const section of navSections) {
        expect(section.match(/aria-current="page"/g)?.length ?? 0, path).toBe(1);
      }
      expect(html).toContain(label);
    }
  });

  it("exposes a labelled drawer toggle that is closed by default", () => {
    const html = renderShellAt("/dashboard");
    expect(html).toMatch(/aria-expanded="false"/);
    expect(html).toContain("<dialog");
    expect(html).toContain("Open navigation");
  });
});
