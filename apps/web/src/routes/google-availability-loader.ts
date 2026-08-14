import { createApiClient, type ApiClient } from "@url-shortener/contracts";

export interface GoogleAvailability {
  enabled: boolean;
}

export function createGoogleAvailabilityLoader(client: ApiClient = createApiClient()) {
  return async (): Promise<GoogleAvailability> => {
    try {
      const { data, response } = await client.GET("/api/authentication/google");
      return { enabled: response.ok && data?.enabled === true };
    } catch {
      return { enabled: false };
    }
  };
}
