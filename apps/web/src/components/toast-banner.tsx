interface ToastBannerProps {
  /** Current non-blocking feedback; null keeps the live region stable and silent. */
  message: string | null;
  tone?: "success" | "info" | "warning";
}

const toneLabels: Record<string, string> = {
  success: "Success:",
  warning: "Warning:",
};

/**
 * Non-blocking feedback surface. The polite live region always exists so
 * announcements are never missed; identical messages keep an identical DOM so
 * screen readers do not re-announce them. Dismissal is parent-controlled by
 * design (no timer). Blocking errors must use inline role=alert, never a toast.
 */
export function ToastBanner({ message, tone = "info" }: ToastBannerProps) {
  const toneLabel = toneLabels[tone];
  return (
    <div className="toast-region" role="status" aria-live="polite" aria-atomic="true">
      {message ? (
        <div className={`toast toast-${tone}`}>
          {toneLabel ? <span className="visually-hidden">{toneLabel} </span> : null}
          {message}
        </div>
      ) : null}
    </div>
  );
}
