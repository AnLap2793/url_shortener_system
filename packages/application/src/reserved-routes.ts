export const reservedExactRoutes = [
  "/health/live",
  "/health/ready",
  "/sign-in",
  "/sign-up",
] as const;

export const reservedRoutePrefixes = ["/api", "/assets"] as const;

export function isReservedApplicationRoute(path: string): boolean {
  return reservedExactRoutes.includes(path as (typeof reservedExactRoutes)[number]) ||
    reservedRoutePrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
