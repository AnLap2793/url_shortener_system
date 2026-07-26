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
