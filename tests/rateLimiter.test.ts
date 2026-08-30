import { describe, it, expect } from "vitest";
import { rateLimiter } from "../server/services/rateLimiter";

describe("PHANTOM ROOM: Anti-Brute-Force & Rate Limiting", () => {
  it("hashes IP addresses to protect user privacy without storing raw IPs", () => {
    const ip = "192.168.1.100";
    const hash = rateLimiter.hashIp(ip);
    expect(hash).not.toContain(ip);
    expect(hash).toHaveLength(16);
  });

  it("blocks rapid brute-force room code guesses after 5 attempts", () => {
    const attackerIp = "10.0.0.99";
    const guessCode = "9999";

    // 5 attempts allowed initially
    for (let i = 0; i < 5; i++) {
      const check = rateLimiter.checkRoomJoinAttempt(attackerIp, guessCode);
      expect(check.allowed).toBe(true);
      rateLimiter.recordFailedJoinAttempt(attackerIp, guessCode);
    }

    // 6th attempt should be blocked with retry-after lockout
    const blockedCheck = rateLimiter.checkRoomJoinAttempt(attackerIp, guessCode);
    expect(blockedCheck.allowed).toBe(false);
    expect(blockedCheck.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets rate limiting upon successful authorized join", () => {
    const validIp = "10.0.0.101";
    rateLimiter.recordFailedJoinAttempt(validIp, "1234");
    rateLimiter.recordSuccessfulJoin(validIp);

    const check = rateLimiter.checkRoomJoinAttempt(validIp, "5678");
    expect(check.allowed).toBe(true);
  });
});
