import { Outlet } from "react-router";
import { AppShell } from "../components/app-shell.js";

/**
 * Layout for authenticated surfaces; the route-level session loader has already
 * verified a session before this renders.
 */
export function ProtectedLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
