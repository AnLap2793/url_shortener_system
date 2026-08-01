const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

interface RequestLike {
  method: string;
  headers: Record<string, string | string[] | undefined>;
}

interface ResponseLike {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

/**
 * AD-18: the single CSRF protocol for the one public origin. Unsafe browser
 * requests under /api are accepted only with an exact Origin match AND
 * Sec-Fetch-Site: same-origin; anything missing, opaque, or mismatched is
 * rejected with 403 before any handler (including Better Auth) runs.
 */
export function createOriginCheck(publicOrigin: string) {
  return (request: RequestLike, response: ResponseLike, next: () => void): void => {
    if (!unsafeMethods.has(request.method)) return next();
    const origin = request.headers.origin;
    const secFetchSite = request.headers["sec-fetch-site"];
    if (origin === publicOrigin && secFetchSite === "same-origin") return next();
    response.statusCode = 403;
    response.setHeader("Content-Type", "application/problem+json");
    response.setHeader("Cache-Control", "no-store");
    response.end(
      JSON.stringify({
        type: "about:blank",
        title: "Forbidden",
        status: 403,
        detail: "Cross-origin request rejected.",
        code: "CSRF_REJECTED",
      }),
    );
  };
}
