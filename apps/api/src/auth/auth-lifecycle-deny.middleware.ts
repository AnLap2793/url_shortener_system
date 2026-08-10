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
]);

export function createAuthLifecycleDeny() {
  return (request: RequestLike, response: ResponseLike, next: Next): void => {
    const path = request.path.startsWith("/api/auth")
      ? request.path.slice("/api/auth".length)
      : request.path;
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
