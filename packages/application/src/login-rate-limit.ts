import { createHmac } from "node:crypto";

export type LoginRateLimitScope = "account" | "ip";

export interface LoginRateLimitRequest {
  scope: LoginRateLimitScope;
  keyDigest: string;
  windowSeconds: number;
  maximumAttempts: number;
}

export interface LoginRateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
  rejectedScopes?: LoginRateLimitScope[];
}

export interface LoginRateLimitRepository {
  consume(requests: LoginRateLimitRequest[]): Promise<LoginRateLimitResult>;
}

/** Produces a domain-separated opaque key; callers must never persist its input. */
export function createLoginRateLimitKey(
  scope: LoginRateLimitScope,
  value: string,
  secret: string,
): string {
  return createHmac("sha256", secret)
    .update(`login-rate-limit:v1:${scope}:${value}`)
    .digest("hex");
}

export class ConsumeLoginRateLimit {
  constructor(private readonly repository: LoginRateLimitRepository) {}

  execute(requests: LoginRateLimitRequest[]) {
    return this.repository.consume(requests);
  }
}
