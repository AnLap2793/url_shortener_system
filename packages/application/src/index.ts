/** Canonical actor identity: the Better Auth user id string (AD-9). */
export type ActorId = string;

export interface ReadinessProbe {
  isReady(): Promise<boolean>;
  close(): Promise<void>;
}

export {
  applicationBrowserRoutes,
  controllerOwnedExactRoutes,
  controllerOwnedPrefixes,
  isControllerOwnedRoute,
  isReservedApplicationRoute,
  reservedExactRoutes,
  reservedRoutePrefixes,
} from "./reserved-routes.js";
