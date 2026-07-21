export interface ReadinessProbe {
  isReady(): Promise<boolean>;
  close(): Promise<void>;
}

export { isReservedApplicationRoute, reservedExactRoutes, reservedRoutePrefixes } from "./reserved-routes.js";
