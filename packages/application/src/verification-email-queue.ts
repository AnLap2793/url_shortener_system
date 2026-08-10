import { createHmac } from "node:crypto";

export interface VerificationEmailEnqueueInput {
  id: string;
  logicalKey: string;
  recipient: string;
  verificationUrl: string;
}

export interface ClaimedVerificationEmail extends VerificationEmailEnqueueInput {
  attempt: number;
  leaseToken: string;
  leaseUntil: Date;
}

export interface VerificationEmailQueueRepository {
  consumeCooldown(keyDigest: string, cooldownSeconds: number): Promise<{
    allowed: boolean;
    retryAfterSeconds?: number;
    reservationToken?: string;
  }>;
  releaseCooldown(keyDigest: string, reservationToken: string): Promise<boolean>;
  enqueue(input: VerificationEmailEnqueueInput): Promise<{ id: string; created: boolean }>;
  hasDelivery(logicalKey: string): Promise<boolean>;
  claim(batchSize: number, leaseSeconds: number): Promise<ClaimedVerificationEmail[]>;
  complete(id: string, leaseToken: string): Promise<boolean>;
  retry(id: string, leaseToken: string, availableAt: Date, category: string): Promise<boolean>;
  dead(id: string, leaseToken: string, category: string): Promise<boolean>;
}

export function createVerificationEmailCooldownKey(email: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`verification-email-cooldown:v1:${email.trim().toLowerCase()}`)
    .digest("hex");
}

export class ConsumeVerificationEmailCooldown {
  constructor(private readonly repository: VerificationEmailQueueRepository) {}

  execute(keyDigest: string, cooldownSeconds: number) {
    return this.repository.consumeCooldown(keyDigest, cooldownSeconds);
  }

  release(keyDigest: string, reservationToken: string) {
    return this.repository.releaseCooldown(keyDigest, reservationToken);
  }
}

export class CheckVerificationEmailDelivery {
  constructor(private readonly repository: VerificationEmailQueueRepository) {}

  execute(logicalKey: string) {
    return this.repository.hasDelivery(logicalKey);
  }
}

export class EnqueueVerificationEmail {
  constructor(private readonly repository: VerificationEmailQueueRepository) {}

  execute(input: VerificationEmailEnqueueInput) {
    return this.repository.enqueue(input);
  }
}

/** Worker-facing use cases keep persistence details outside the delivery loop. */
export class ProcessVerificationEmailQueue {
  constructor(private readonly repository: VerificationEmailQueueRepository) {}

  claim(batchSize: number, leaseSeconds: number) {
    return this.repository.claim(batchSize, leaseSeconds);
  }

  complete(id: string, leaseToken: string) {
    return this.repository.complete(id, leaseToken);
  }

  retry(id: string, leaseToken: string, availableAt: Date, category: string) {
    return this.repository.retry(id, leaseToken, availableAt, category);
  }

  dead(id: string, leaseToken: string, category: string) {
    return this.repository.dead(id, leaseToken, category);
  }
}
