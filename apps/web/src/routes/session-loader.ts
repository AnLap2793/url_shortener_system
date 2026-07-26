import { redirect } from "react-router";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

interface LoaderArguments {
  request: Request;
}

/**
 * Route guard for authenticated surfaces: the API session endpoint is the only
 * authority (AD-9). Any non-OK or failed check fails closed to /sign-in while
 * preserving the intended route (EXPERIENCE: session expired).
 */
export function createSessionLoader(fetchImplementation: FetchLike = (input, init) => fetch(input, init)) {
  return async ({ request }: LoaderArguments): Promise<Response | null> => {
    const intendedUrl = new URL(request.url);
    const intendedPath = `${intendedUrl.pathname}${intendedUrl.search}`;
    const signIn = () => redirect(`/sign-in?redirectTo=${encodeURIComponent(intendedPath)}`);
    try {
      const response = await fetchImplementation("/api/auth/session", { credentials: "same-origin" });
      return response.ok ? null : signIn();
    } catch {
      return signIn();
    }
  };
}
