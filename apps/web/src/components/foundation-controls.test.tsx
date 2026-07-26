import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Dialog } from "./dialog.js";
import { EmptyState } from "./empty-state.js";
import { ErrorSummary } from "./error-summary.js";
import { PrimaryButton } from "./primary-button.js";
import { ToastBanner } from "./toast-banner.js";

describe("PrimaryButton contract", () => {
  it("renders a native focusable button with shared tokens", () => {
    const html = renderToStaticMarkup(<PrimaryButton>Create short link</PrimaryButton>);
    expect(html).toContain('type="button"');
    expect(html).toContain("primary-button");
    expect(html).toContain("focus-indicator");
    expect(html).not.toContain("aria-busy");
  });

  it("communicates disabled and loading semantics", () => {
    expect(renderToStaticMarkup(<PrimaryButton disabled>Save</PrimaryButton>)).toContain("disabled");
    const loading = renderToStaticMarkup(<PrimaryButton loading loadingLabel="Creating…">Save</PrimaryButton>);
    expect(loading).toContain('aria-busy="true"');
    expect(loading).toContain("disabled");
    expect(loading).toContain("Creating…");
  });
});

describe("ToastBanner contract", () => {
  it("keeps a stable polite live region even without a message", () => {
    const html = renderToStaticMarkup(<ToastBanner message={null} />);
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('role="status"');
  });

  it("announces the current message inside the region", () => {
    const html = renderToStaticMarkup(<ToastBanner message="Short link created. Copy it to share." tone="success" />);
    expect(html).toContain("Short link created. Copy it to share.");
    expect(html).toContain("toast-success");
  });

  it("pairs tone color with a textual label so color never carries meaning alone", () => {
    const success = renderToStaticMarkup(<ToastBanner message="Saved." tone="success" />);
    expect(success).toContain("Success:");
    expect(success).toContain("visually-hidden");
    const warning = renderToStaticMarkup(<ToastBanner message="Check casing." tone="warning" />);
    expect(warning).toContain("Warning:");
  });
});

describe("Dialog contract", () => {
  it("uses the native dialog element labelled by its title", () => {
    const html = renderToStaticMarkup(
      <Dialog open={false} onClose={() => {}} title="Delete this link?">
        <p>Its path will return 404 and cannot be reused.</p>
      </Dialog>,
    );
    expect(html).toContain("<dialog");
    const labelId = html.match(/aria-labelledby="([^"]+)"/)?.[1];
    expect(labelId).toBeDefined();
    expect(html).toContain(`id="${labelId}"`);
    expect(html).toContain("Delete this link?");
  });
});

describe("ErrorSummary contract", () => {
  it("renders nothing when there are no errors", () => {
    expect(renderToStaticMarkup(<ErrorSummary errors={[]} />)).toBe("");
  });

  it("links each error to its field from a focusable container", () => {
    const html = renderToStaticMarkup(
      <ErrorSummary
        errors={[
          { fieldId: "destination-url", message: "Use an http or https URL." },
          { fieldId: "alias", message: "That alias is unavailable. Try another." },
        ]}
      />,
    );
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('href="#destination-url"');
    expect(html).toContain('href="#alias"');
    expect(html).toContain("Use an http or https URL.");
  });
});

describe("EmptyState contract", () => {
  it("renders calm operational copy with optional description", () => {
    const html = renderToStaticMarkup(
      <EmptyState title="No short links yet." description="Create a short link to start tracking campaigns." />,
    );
    expect(html).toContain("empty-state");
    expect(html).toContain("No short links yet.");
    expect(html).toContain("Create a short link to start tracking campaigns.");
  });
});
