interface RequestLike {
  path: string;
}

interface ResponseLike {
  status(code: number): ResponseLike;
  set(name: string, value: string): ResponseLike;
  type(contentType: string): ResponseLike;
  json(body: unknown): void;
}

type NextFunction = (error: unknown) => void;

interface ParserError extends Error {
  status?: number;
  type?: string;
}

export function registrationParserError(
  error: ParserError,
  request: RequestLike,
  response: ResponseLike,
  next: NextFunction,
): void {
  if (!request.path.startsWith("/api/registration/") || !isParserError(error)) {
    next(error);
    return;
  }
  const status = error.status === 413 ? 413 : 400;
  response
    .status(status)
    .set("Cache-Control", "no-store")
    .type("application/problem+json")
    .json({
      type: "about:blank",
      title: status === 413 ? "Request body too large" : "Invalid request",
      status,
      detail: status === 413 ? "Request body exceeds the allowed size." : "Request body must contain valid JSON.",
      instance: request.path,
      code: status === 413 ? "PAYLOAD_TOO_LARGE" : "INVALID_JSON",
    });
}

function isParserError(error: ParserError): boolean {
  return error.type === "entity.parse.failed" || error.type === "entity.too.large";
}
