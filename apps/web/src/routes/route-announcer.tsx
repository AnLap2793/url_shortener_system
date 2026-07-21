interface RouteAnnouncerProps {
  message: string;
}

export function RouteAnnouncer({ message }: RouteAnnouncerProps) {
  return <p className="visually-hidden" aria-live="polite" aria-atomic="true">{message}</p>;
}
