import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

/** Structural view of the Express response used by the static pipeline. */
export interface StaticResponseLike extends NodeJS.WritableStream {
  statusCode: number;
  headersSent: boolean;
  setHeader(name: string, value: string): void;
  once(event: "close", listener: () => void): this;
}

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

/** Extracts the pathname from a request target, or null when unparsable. */
export function requestPath(requestTarget: string): string | null {
  try {
    return new URL(requestTarget, "http://localhost").pathname;
  } catch {
    return null;
  }
}

/** Percent-decodes a request path once and rejects undecodable or NUL-bearing values. */
export function decodeRequestPath(rawPath: string): string | null {
  try {
    const decoded = decodeURIComponent(rawPath);
    return decoded.includes("\0") ? null : decoded;
  } catch {
    return null;
  }
}

/** Resolves a root-relative path and refuses any result escaping that root. */
export function resolveContainedFile(rootDirectory: string, relativePath: string): string | null {
  const resolved = resolve(rootDirectory, relativePath);
  return resolved === rootDirectory || resolved.startsWith(`${rootDirectory}${sep}`) ? resolved : null;
}

/**
 * Streams a file with safe settlement on every path: resolves false when the
 * file is unavailable before headers are sent, and never leaves the returned
 * promise pending on client abort or stream failure after headers.
 */
export async function serveFile(
  filePath: string,
  cacheControl: string,
  method: string,
  response: StaticResponseLike,
): Promise<boolean> {
  let size: number;
  try {
    const stats = await stat(filePath);
    if (!stats.isFile()) return false;
    size = stats.size;
  } catch {
    return false;
  }
  response.statusCode = 200;
  response.setHeader("Content-Type", contentTypes[extname(filePath).toLowerCase()] ?? "application/octet-stream");
  response.setHeader("Content-Length", String(size));
  response.setHeader("Cache-Control", cacheControl);
  response.setHeader("X-Content-Type-Options", "nosniff");
  if (method === "HEAD") {
    response.end();
    return true;
  }
  await new Promise<void>((settle) => {
    const stream = createReadStream(filePath);
    stream.on("error", () => {
      // Headers are already sent; ending the response yields a truncated body
      // the client detects via Content-Length instead of crashing the process.
      response.end();
      settle();
    });
    stream.on("end", settle);
    response.once("close", () => {
      stream.destroy();
      settle();
    });
    stream.pipe(response);
  });
  return true;
}
