const protectedPaths = new Set(["/dashboard", "/links", "/account"]);

export function safeAuthRedirect(value: string | null | undefined, origin: string): string {
  if (
    !value
    || !value.startsWith("/")
    || value.startsWith("//")
    || value.includes("\\")
    || /%2f|%5c/i.test(value)
  ) return "/dashboard";
  try {
    const pathSegments = value.split(/[?#]/, 1)[0]!.split("/");
    if (pathSegments.some((segment) => {
      const decoded = decodeURIComponent(segment);
      return decoded === "." || decoded === "..";
    })) return "/dashboard";
    const target = new URL(value, origin);
    if (target.origin !== origin || !protectedPaths.has(target.pathname)) return "/dashboard";
    return `${target.pathname}${target.search}`;
  } catch {
    return "/dashboard";
  }
}
