interface EmptyStateProps {
  title: string;
  description?: string;
  /** Optional primary action slot; feature stories supply real actions. */
  action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <p className="empty-state-title">{title}</p>
      {description ? <p className="empty-state-description">{description}</p> : null}
      {action ?? null}
    </div>
  );
}
