interface PrimaryButtonProps {
  children: React.ReactNode;
  type?: "button" | "submit";
  disabled?: boolean;
  /** Pending-request state: blocks duplicate activation and labels progress. */
  loading?: boolean;
  loadingLabel?: string;
  onClick?: () => void;
}

export function PrimaryButton({
  children,
  type = "button",
  disabled = false,
  loading = false,
  loadingLabel = "Working…",
  onClick,
}: PrimaryButtonProps) {
  return (
    <button
      type={type}
      className="primary-button focus-indicator"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onClick={onClick}
    >
      {loading ? loadingLabel : children}
    </button>
  );
}
