import crypto from "crypto";
import { SecurityEvent } from "../types";

class SecurityAuditService {
  private events: SecurityEvent[] = [];
  private maxStoredEvents = 200; // Ring buffer in memory

  public logEvent(event: Omit<SecurityEvent, "id" | "timestamp">): void {
    const fullEvent: SecurityEvent = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      ...event,
    };

    this.events.unshift(fullEvent);

    // Keep ring buffer bounded to prevent unbounded memory growth
    if (this.events.length > this.maxStoredEvents) {
      this.events.pop();
    }

    // Console output in structured JSON format
    const logOutput = {
      level: event.severity === "CRITICAL" || event.severity === "HIGH" ? "warn" : "info",
      type: event.type,
      ipHash: event.ipHash,
      details: event.details,
      timestamp: new Date().toISOString(),
    };
    console.log(`[SECURITY-AUDIT] ${JSON.stringify(logOutput)}`);
  }

  public getRecentEvents(limit: number = 50): SecurityEvent[] {
    return this.events.slice(0, limit);
  }

  public getStats(): { totalEvents: number; criticalCount: number; bruteForceCount: number } {
    return {
      totalEvents: this.events.length,
      criticalCount: this.events.filter((e) => e.severity === "CRITICAL" || e.severity === "HIGH").length,
      bruteForceCount: this.events.filter((e) => e.type === "BRUTE_FORCE_ATTEMPT").length,
    };
  }
}

export const securityAudit = new SecurityAuditService();
