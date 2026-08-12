interface RequestLike {
  path: string;
}

interface ResponseLike {
  status(code: number): ResponseLike;
  type(contentType: string): ResponseLike;
  set(name: string, value: string): ResponseLike;
  json(body: unknown): void;
}

type Next = () => void;

const deniedPaths = new Set([
  "/sign-up/email",
  "/send-verification-email",
  "/verify-email",
  "/sign-in/email",
  "/sign-out",
  "/get-session",
]);

export function createAuthLifecycleDeny() {
  return (request: RequestLike, response: ResponseLike, next: Next): void => {
    const rawPath = request.path.startsWith("/api/auth")
      ? request.path.slice("/api/auth".length)
      : request.path;
    const path = rawPath.length > 1 ? rawPath.replace(/\/+$/, "") : rawPath;
    if (!deniedPaths.has(path)) {
      next();
      return;
    }
    response
      .status(404)
      .type("application/problem+json")
      .set("Cache-Control", "no-store")
      .json({
        type: "about:blank",
        title: "Not Found",
        status: 404,
        detail: "The requested resource was not found.",
        instance: path,
        code: "NOT_FOUND",
      });
  };
}
