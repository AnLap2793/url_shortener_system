import createClient from "openapi-fetch";
import type { paths } from "./generated/api-types.js";

export type { paths } from "./generated/api-types.js";

/**
 * The only browser API client (AD-14/AD-18): typed by the generated OpenAPI
 * contract, always same-origin with credentials. The generated files under
 * src/generated are never hand-edited; regenerate via `npm run generate:contracts`.
 */
export function createApiClient(fetchImplementation?: typeof fetch, baseUrl = "/") {
  return createClient<paths>({
    baseUrl,
    credentials: "same-origin",
    fetch: fetchImplementation,
  });
}

export type ApiClient = ReturnType<typeof createApiClient>;
