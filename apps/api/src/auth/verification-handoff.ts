export function createVerificationEmailUrl(publicOrigin: string, token: string): string {
  const url = new URL("/verify-email", `${publicOrigin}/`);
  url.searchParams.set("token", token);
  return url.toString();
}
