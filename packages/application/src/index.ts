/** Canonical actor identity: the Better Auth user id string (AD-9). */
export type ActorId = string;

export interface ReadinessProbe {
  isReady(): Promise<boolean>;
  close(): Promise<void>;
}

export {
  CaptureVerificationEmailTransport,
  FailingVerificationEmailTransport,
  type VerificationEmailDelivery,
  type VerificationEmailDeliveryResult,
  type VerificationEmailFailureCategory,
  type VerificationEmailTransport,
} from "./verification-email-delivery.js";

export {
  CheckVerificationEmailDelivery,
  ConsumeVerificationEmailCooldown,
  EnqueueVerificationEmail,
  ProcessVerificationEmailQueue,
  createVerificationEmailCooldownKey,
  type ClaimedVerificationEmail,
  type VerificationEmailEnqueueInput,
  type VerificationEmailQueueRepository,
} from "./verification-email-queue.js";

export {
  ConsumeLoginRateLimit,
  createLoginRateLimitKey,
  type LoginRateLimitRepository,
  type LoginRateLimitRequest,
  type LoginRateLimitResult,
  type LoginRateLimitScope,
} from "./login-rate-limit.js";

export {
  applicationBrowserRoutes,
  controllerOwnedExactRoutes,
  controllerOwnedPrefixes,
  isControllerOwnedRoute,
  isReservedApplicationRoute,
  reservedExactRoutes,
  reservedRoutePrefixes,
} from "./reserved-routes.js";
