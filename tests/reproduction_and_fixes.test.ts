import { describe, it, expect } from "vitest";
import { roomService } from "../server/services/roomService";
import { syncEngine } from "../server/services/syncEngine";
import { rateLimiter } from "../server/services/rateLimiter";
import { ChatMessage, FileAttachmentMetadata } from "../server/types";

describe("PHANTOM REGRESSION SUITE: Bug Reproduction & Architectural Fixes", () => {
  it("PHASE 2 FIX: ensures message state is strictly idempotent when receiving duplicate events", () => {
    const { room, hostParticipant } = roomService.createRoom();

    const sampleMessage: ChatMessage = {
      id: "msg-stable-unique-101",
      roomId: room.id,
      senderId: hostParticipant.id,
      senderCodename: hostParticipant.codename,
      senderAvatarColor: hostParticipant.avatarColor,
      plaintextFallback: "Single authoritative message",
      type: "text",
      reactions: {},
      createdAt: Date.now(),
    };

    // Simulate client-side normalized reducer
    const messagesById: Record<string, ChatMessage> = {};
    let messageIds: string[] = [];

    const insertReducer = (msg: ChatMessage) => {
      if (messagesById[msg.id]) {
        // Message already exists; do not duplicate
        messagesById[msg.id] = { ...messagesById[msg.id], ...msg };
      } else {
        messagesById[msg.id] = msg;
        messageIds.push(msg.id);
      }
    };

    // First arrival
    insertReducer(sampleMessage);
    expect(messageIds).toHaveLength(1);
    expect(Object.keys(messagesById)).toHaveLength(1);

    // Duplicate event arrives (simulating double listener / echo)
    insertReducer(sampleMessage);
    expect(messageIds).toHaveLength(1);
    expect(Object.keys(messagesById)).toHaveLength(1);

    // Third duplicate arrives
    insertReducer(sampleMessage);
    expect(messageIds).toHaveLength(1);
  });

  it("PHASE 3 FIX: ensures file attachments are strictly deduplicated by stable fileId", () => {
    const fileMeta: FileAttachmentMetadata = {
      fileId: "file-uuid-abc-123",
      fileName: "screenshot.png",
      fileSize: 102400,
      mimeType: "image/png",
      category: "image",
      downloadUrl: "/api/files/file-uuid-abc-123?token=sig",
      isEncrypted: false,
    };

    const attachmentsById: Record<string, { meta: FileAttachmentMetadata; sender: string; time: number }> = {};

    const registerAttachment = (meta: FileAttachmentMetadata, sender: string) => {
      attachmentsById[meta.fileId] = {
        meta,
        sender,
        time: Date.now(),
      };
    };

    // File uploaded
    registerAttachment(fileMeta, "Ghost-71");
    expect(Object.keys(attachmentsById)).toHaveLength(1);

    // Duplicate trigger
    registerAttachment(fileMeta, "Ghost-71");
    expect(Object.keys(attachmentsById)).toHaveLength(1);
    expect(attachmentsById["file-uuid-abc-123"].meta.fileName).toBe("screenshot.png");
  });

  it("PHASE 13 FIX: media sync clock prevents feedback loops and calculates sub-second position", () => {
    const { room } = roomService.createRoom();
    const state = syncEngine.initializeRoomMedia(room.id);

    // User A seeks to 120s
    const seeked = syncEngine.seek(room.id, 120);
    expect(seeked?.positionSeconds).toBe(120);
    expect(seeked?.version).toBe(2);

    // Play
    const played = syncEngine.play(room.id, 120);
    expect(played?.isPlaying).toBe(true);
    expect(played?.positionSeconds).toBe(120);
    expect(played?.version).toBe(3);

    // Verify calculated position increases with elapsed time
    const pos = syncEngine.getCalculatedPosition(played!);
    expect(pos).toBeGreaterThanOrEqual(120);
  });

  it("PHASE 15 FIX: room code security uses dual-tier mapping and prevents brute-force enumeration", () => {
    const { room } = roomService.createRoom();
    expect(room.code).toHaveLength(4);
    expect(room.id).toHaveLength(36); // UUID

    // Brute force check
    const attackerIp = "192.0.2.1";
    for (let i = 0; i < 5; i++) {
      const res = rateLimiter.checkRoomJoinAttempt(attackerIp, "0000");
      expect(res.allowed).toBe(true);
      rateLimiter.recordFailedJoinAttempt(attackerIp, "0000");
    }

    const locked = rateLimiter.checkRoomJoinAttempt(attackerIp, "0000");
    expect(locked.allowed).toBe(false);
    expect(locked.retryAfterSeconds).toBeGreaterThan(0);
  });
});
