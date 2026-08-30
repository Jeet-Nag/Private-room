import { describe, it, expect } from "vitest";
import { roomService } from "../server/services/roomService";
import { ChatMessage } from "../server/types";

describe("PHANTOM ROOM: Room Lifecycle & Permissions", () => {
  it("creates a room, allows joining by 4-digit code, and enforces host permissions", () => {
    const { room, hostParticipant } = roomService.createRoom();
    expect(hostParticipant.isHost).toBe(true);

    const joinResult = roomService.joinRoom(room.code);
    expect("error" in joinResult).toBe(false);

    if (!("error" in joinResult)) {
      expect(joinResult.participant.isHost).toBe(false);
      expect(joinResult.room.id).toBe(room.id);
      expect(Object.keys(joinResult.room.participants).length).toBe(2);
    }
  });

  it("handles in-memory message storage, reactions, and deletion", () => {
    const { room, hostParticipant } = roomService.createRoom();

    const testMessage: ChatMessage = {
      id: "msg-001",
      roomId: room.id,
      senderId: hostParticipant.id,
      senderCodename: hostParticipant.codename,
      senderAvatarColor: hostParticipant.avatarColor,
      plaintextFallback: "Hello ephemeral room",
      type: "text",
      reactions: {},
      createdAt: Date.now(),
    };

    roomService.addMessage(room.id, testMessage);
    expect(roomService.getMessages(room.id)).toHaveLength(1);

    // Reaction
    const reacted = roomService.updateMessageReactions(room.id, "msg-001", "🔥", hostParticipant.id);
    expect(reacted?.reactions["🔥"]).toContain(hostParticipant.id);

    // Delete message
    const deleted = roomService.deleteMessage(room.id, "msg-001", hostParticipant.id, true);
    expect(deleted).toBe(true);

    const messages = roomService.getMessages(room.id);
    expect(messages[0].isDeleted).toBe(true);
  });

  it("destroys room and purges all references immediately", () => {
    const { room } = roomService.createRoom();
    expect(roomService.getRoom(room.id)).toBeDefined();

    roomService.destroyRoom(room.id);
    expect(roomService.getRoom(room.id)).toBeUndefined();
    expect(roomService.getRoomByCode(room.code)).toBeUndefined();
  });
});
