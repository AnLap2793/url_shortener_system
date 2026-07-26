import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, Outlet, useLocation } from "react-router";
import { RouterProvider } from "react-router/dom";
import { AppShell } from "../src/components/app-shell.js";
import { Dialog } from "../src/components/dialog.js";
import { EmptyState } from "../src/components/empty-state.js";
import { ErrorSummary, type FieldError } from "../src/components/error-summary.js";
import { PrimaryButton } from "../src/components/primary-button.js";
import { ToastBanner } from "../src/components/toast-banner.js";
import "../src/styles.css";

/** Test-only harness exercising foundation component behavior contracts. */
function HarnessSurface() {
  const location = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [primaryClicks, setPrimaryClicks] = useState(0);
  const [errors, setErrors] = useState<FieldError[]>([]);

  return (
    <>
      <h1>{location.pathname}</h1>
      <div className="harness-controls">
        <button id="open-dialog" type="button" className="focus-indicator" onClick={() => setDialogOpen(true)}>
          Open dialog
        </button>
        <button
          id="show-toast"
          type="button"
          className="focus-indicator"
          onClick={() => setToast("Short link created. Copy it to share.")}
        >
          Show toast
        </button>
        <button
          id="trigger-errors"
          type="button"
          className="focus-indicator"
          onClick={() => setErrors([{ fieldId: "destination-url", message: "Use an http or https URL." }])}
        >
          Trigger errors
        </button>
        <PrimaryButton
          loading={loading}
          onClick={() => {
            setPrimaryClicks((count) => count + 1);
            setLoading(true);
          }}
        >
          Create short link
        </PrimaryButton>
        <output id="primary-clicks">{primaryClicks}</output>
      </div>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Delete this link?">
        <p>Its path will return 404 and cannot be reused.</p>
        <button id="dialog-cancel" type="button" className="focus-indicator" onClick={() => setDialogOpen(false)}>
          Cancel
        </button>
      </Dialog>
      <ToastBanner message={toast} tone="success" />
      <ErrorSummary errors={errors} />
      <label>
        Destination URL
        <input id="destination-url" type="text" readOnly value="" />
      </label>
      <EmptyState title="No short links yet." />
    </>
  );
}

const router = createMemoryRouter(
  [
    {
      element: (
        <AppShell>
          <Outlet />
        </AppShell>
      ),
      children: [
        { path: "/dashboard", element: <HarnessSurface /> },
        { path: "/links", element: <HarnessSurface /> },
        { path: "/account", element: <HarnessSurface /> },
      ],
    },
  ],
  { initialEntries: ["/dashboard"] },
);

const root = document.getElementById("root");
if (!root) throw new Error("Harness root is missing");
createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
