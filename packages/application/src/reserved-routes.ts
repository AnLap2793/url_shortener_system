/**
 * Route classification for the single public origin (AD-2).
 *
 * - Controller-owned routes are handled by API controllers or the static asset
 *   pipeline and must never receive the SPA document.
 * - Application browser routes are SPA documents owned by apps/web; they are
 *   still reserved so the future short-path allocator can never claim them.
 */
export const controllerOwnedExactRoutes = [] as const;

export const controllerOwnedPrefixes = ["/api", "/assets", "/health"] as const;

export const applicationBrowserRoutes = [
  "/sign-in",
  "/sign-up",
  "/verify-email",
  "/dashboard",
  "/links",
  "/account",
] as const;

export const reservedExactRoutes = applicationBrowserRoutes;

export const reservedRoutePrefixes = controllerOwnedPrefixes;

function matchesPrefix(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/** True for every route the short-path namespace must never allocate. */
export function isReservedApplicationRoute(path: string): boolean {
  return (
    reservedExactRoutes.includes(path as (typeof reservedExactRoutes)[number]) ||
    matchesPrefix(path, reservedRoutePrefixes)
  );
}

/** True when API controllers or static assets own the path instead of the SPA. */
export function isControllerOwnedRoute(path: string): boolean {
  return (
    controllerOwnedExactRoutes.includes(path as (typeof controllerOwnedExactRoutes)[number]) ||
    matchesPrefix(path, controllerOwnedPrefixes)
  );
}
