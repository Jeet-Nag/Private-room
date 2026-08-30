import { describe, it, expect } from "vitest";
import { roomService } from "../server/services/roomService";
import crypto from "crypto";

describe("PHANTOM ROOM: Cryptographic & Token Services", () => {
  it("generates valid 4-digit human room codes and internal UUIDs", () => {
    const { room, hostParticipant, sessionToken } = roomService.createRoom({
      expiresInSeconds: 3600,
    });

    expect(room.code).toBeDefined();
    expect(room.code.length).toBe(4);
    expect(room.id).toBeDefined();
    expect(room.id).not.toBe(room.code);
    expect(hostParticipant.codename).toMatch(/^[A-Za-z]+-\d{2}$/);
    expect(sessionToken).toBeDefined();
  });

  it("successfully signs and verifies HMAC-SHA256 session tokens", () => {
    const roomId = crypto.randomUUID();
    const participantId = crypto.randomUUID();

    const token = roomService.signSessionToken(roomId, participantId, true);
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(2);

    const verified = roomService.verifySessionToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.roomId).toBe(roomId);
    expect(verified?.participantId).toBe(participantId);
    expect(verified?.isHost).toBe(true);
  });

  it("rejects tampered session tokens", () => {
    const roomId = crypto.randomUUID();
    const participantId = crypto.randomUUID();
    const token = roomService.signSessionToken(roomId, participantId, false);

    const [payload, sig] = token.split(".");
    const tamperedToken = `${payload}.invalidSignature123`;

    const result = roomService.verifySessionToken(tamperedToken);
    expect(result).toBeNull();
  });
});
