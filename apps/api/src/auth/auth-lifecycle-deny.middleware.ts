interface RequestLike {
  method: string;
  path: string;
}

interface ResponseLike {
  status(code: number): ResponseLike;
  type(contentType: string): ResponseLike;
  set(name: string, value: string): ResponseLike;
  json(body: unknown): void;
}

type Next = () => void;

const googleCallbackPath = "/callback/google";

export function createAuthLifecycleDeny() {
  return (request: RequestLike, response: ResponseLike, next: Next): void => {
    const rawPath = request.path.startsWith("/api/auth")
      ? request.path.slice("/api/auth".length)
      : request.path;
    const path = rawPath;
    if (request.method === "GET" && path === googleCallbackPath) {
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
