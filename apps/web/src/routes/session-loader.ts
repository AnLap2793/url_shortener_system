import { redirect } from "react-router";
import { createApiClient, type ApiClient } from "@url-shortener/contracts";

interface LoaderArguments {
  request: Request;
}

/**
 * Route guard for authenticated surfaces. Identity is resolved exclusively
 * through the generated contract client against /api/me (AD-9/AD-14); any
 * non-OK or failed check fails closed to /sign-in preserving the intended
 * route including its query string.
 */
export function createSessionLoader(client: ApiClient = createApiClient()) {
  return async ({ request }: LoaderArguments): Promise<Response | null> => {
    const intendedUrl = new URL(request.url);
    const intendedPath = `${intendedUrl.pathname}${intendedUrl.search}`;
    const signIn = () => redirect(`/sign-in?redirectTo=${encodeURIComponent(intendedPath)}`);
    try {
      const { response } = await client.GET("/api/me");
      return response.ok ? null : signIn();
    } catch {
      return signIn();
    }
  };
}
