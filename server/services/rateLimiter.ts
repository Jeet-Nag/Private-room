import crypto from "crypto";
import { securityAudit } from "./securityAudit";

interface RateBucket {
  tokens: number;
  lastRefill: number;
  failedAttempts: number;
  lockedUntil: number;
}

export class RateLimiterService {
  private ipBuckets: Map<string, RateBucket> = new Map();
  private roomAttemptBuckets: Map<string, RateBucket> = new Map();

  // Hash IP using SHA-256 to ensure metadata minimization (no raw IPs stored)
  public hashIp(ip: string): string {
    return crypto.createHash("sha256").update(ip + "phantom_salt_2026").digest("hex").slice(0, 16);
  }

  /**
   * Anti-Brute-Force Check for Room Code Entry
   * Allows 5 failed attempts per 15 minutes before locking out for 15 minutes.
   */
  public checkRoomJoinAttempt(ip: string, roomCode: string): { allowed: boolean; retryAfterSeconds: number } {
    const hashedIp = this.hashIp(ip);
    const now = Date.now();
    const key = `${hashedIp}_join`;

    let bucket = this.ipBuckets.get(key);
    if (!bucket) {
      bucket = {
        tokens: 5,
        lastRefill: now,
        failedAttempts: 0,
        lockedUntil: 0,
      };
      this.ipBuckets.set(key, bucket);
    }

    // Check if currently locked out
    if (bucket.lockedUntil > now) {
      const retryAfterSeconds = Math.ceil((bucket.lockedUntil - now) / 1000);
      securityAudit.logEvent({
        type: "BRUTE_FORCE_ATTEMPT",
        ipHash: hashedIp,
        roomCode,
        details: `Blocked locked-out client. Attempted room code: ${roomCode}. Retry after: ${retryAfterSeconds}s`,
        severity: "HIGH",
      });
      return { allowed: false, retryAfterSeconds };
    }

    // Refill tokens over time (1 token per 3 minutes)
    const timeSinceLastRefill = now - bucket.lastRefill;
    const tokensToAdd = Math.floor(timeSinceLastRefill / (3 * 60 * 1000));
    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(5, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    if (bucket.tokens <= 0) {
      bucket.lockedUntil = now + 15 * 60 * 1000; // 15 minutes lock
      securityAudit.logEvent({
        type: "BRUTE_FORCE_ATTEMPT",
        ipHash: hashedIp,
        roomCode,
        details: `Token exhaustion. Client locked for 15m after repeated room guesses.`,
        severity: "HIGH",
      });
      return { allowed: false, retryAfterSeconds: 15 * 60 };
    }

    return { allowed: true, retryAfterSeconds: 0 };
  }

  /**
   * Register a failed join attempt
   */
  public recordFailedJoinAttempt(ip: string, roomCode: string): void {
    const hashedIp = this.hashIp(ip);
    const now = Date.now();
    const key = `${hashedIp}_join`;
    const bucket = this.ipBuckets.get(key);

    if (bucket) {
      bucket.tokens = Math.max(0, bucket.tokens - 1);
      bucket.failedAttempts += 1;
      if (bucket.failedAttempts >= 5) {
        bucket.lockedUntil = now + 15 * 60 * 1000;
        securityAudit.logEvent({
          type: "BRUTE_FORCE_ATTEMPT",
          ipHash: hashedIp,
          roomCode,
          details: `5 failed room attempts reached. Enforced 15-minute temporary lockout.`,
          severity: "CRITICAL",
        });
      }
    }
  }

  /**
   * Reset failed attempts upon successful authorized join
   */
  public recordSuccessfulJoin(ip: string): void {
    const hashedIp = this.hashIp(ip);
    const key = `${hashedIp}_join`;
    this.ipBuckets.delete(key);
  }

  /**
   * General API & Message rate limiter (e.g. max 120 requests/messages per minute)
   */
  public checkRateLimit(ipOrSessionId: string, limitPerMinute: number = 120): boolean {
    const hashedKey = this.hashIp(ipOrSessionId);
    const now = Date.now();
    let bucket = this.ipBuckets.get(hashedKey);

    if (!bucket) {
      bucket = {
        tokens: limitPerMinute,
        lastRefill: now,
        failedAttempts: 0,
        lockedUntil: 0,
      };
      this.ipBuckets.set(hashedKey, bucket);
    }

    // Refill 2 tokens per second
    const elapsedSeconds = (now - bucket.lastRefill) / 1000;
    const tokensToAdd = Math.floor(elapsedSeconds * (limitPerMinute / 60));
    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(limitPerMinute, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    if (bucket.tokens > 0) {
      bucket.tokens -= 1;
      return true;
    }

    securityAudit.logEvent({
      type: "RATE_LIMIT_HIT",
      ipHash: hashedKey,
      details: `Rate limit threshold exceeded (${limitPerMinute} req/min).`,
      severity: "MEDIUM",
    });

    return false;
  }
}

export const rateLimiter = new RateLimiterService();
