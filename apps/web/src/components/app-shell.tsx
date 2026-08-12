import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router";
import { RouteAnnouncer } from "../routes/route-announcer.js";

const navigationItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/links", label: "Links" },
  { to: "/account", label: "Account" },
] as const;

function navigationLinks(onNavigate?: () => void) {
  return navigationItems.map((item) => (
    <li key={item.to}>
      <NavLink className="nav-link focus-indicator" to={item.to} onClick={onNavigate}>
        {item.label}
      </NavLink>
    </li>
  ));
}

/**
 * Authenticated workspace chrome: persistent sidebar >=1024px, reduced sidebar
 * on tablet, native-dialog drawer below 768px (platform focus trap, Escape and
 * focus return). Exactly one navigation item is active per route.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDialogElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const previousPath = useRef(location.pathname);
  const currentLabel =
    navigationItems.find((item) => location.pathname.startsWith(item.to))?.label ?? "Workspace";

  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return;
    if (drawerOpen && !drawer.open) drawer.showModal();
    if (!drawerOpen && drawer.open) drawer.close();
  }, [drawerOpen]);

  useEffect(() => {
    if (previousPath.current !== location.pathname) mainRef.current?.focus();
    previousPath.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    // The drawer chrome is display:none from 768px up; close it on breakpoint
    // growth so pointer users are never trapped behind an inert backdrop.
    const sidebarViewport = window.matchMedia("(min-width: 768px)");
    const closeOnGrow = (event: MediaQueryListEvent) => {
      if (event.matches) setDrawerOpen(false);
    };
    sidebarViewport.addEventListener("change", closeOnGrow);
    return () => sidebarViewport.removeEventListener("change", closeOnGrow);
  }, []);

  return (
    <>
      <RouteAnnouncer message={`${currentLabel} page loaded`} />
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <div className="app-shell">
        <header className="app-topbar">
          <button
            type="button"
            className="drawer-toggle focus-indicator"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            Open navigation
          </button>
          <span className="brand">Campaign Links</span>
        </header>
        <nav aria-label="Primary" className="app-sidebar">
          <ul className="nav-list">{navigationLinks()}</ul>
        </nav>
        <main ref={mainRef} id="main-content" tabIndex={-1} className="app-main">
          {children}
        </main>
      </div>
      <dialog
        ref={drawerRef}
        className="nav-drawer"
        aria-label="Primary navigation"
        onClose={() => setDrawerOpen(false)}
      >
        <button
          type="button"
          className="drawer-close focus-indicator"
          onClick={() => setDrawerOpen(false)}
        >
          Close navigation
        </button>
        <nav aria-label="Primary">
          <ul className="nav-list">{navigationLinks(() => setDrawerOpen(false))}</ul>
        </nav>
      </dialog>
    </>
  );
}
