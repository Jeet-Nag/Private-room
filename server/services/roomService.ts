import crypto from "crypto";
import {
  Room,
  RoomStatus,
  RoomSettings,
  Participant,
  ChatMessage,
  RetentionPolicy,
} from "../types";
import { securityAudit } from "./securityAudit";

// Cyberpunk / Stealth Codename Generator
const CODENAME_PREFIXES = [
  "Ghost", "Shadow", "Cipher", "Nova", "Vortex", "Phantom", 
  "Specter", "Aegis", "Mirage", "Nexus", "Sentinel", "Zero", 
  "Pulse", "Echo", "Apex", "Flux", "Onyx", "Drift", "Krypton", "Raven"
];

const AVATAR_PALETTE = [
  "#00F2FE", // Cyan
  "#9D4EDD", // Purple
  "#3A86FF", // Blue
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#EC4899", // Pink
  "#06B6D4", // Light Cyan
  "#8B5CF6", // Indigo
  "#14B8A6", // Teal
  "#6366F1", // Violet
];

const SECRET_KEY = process.env.PHANTOM_JWT_SECRET || "phantom_super_secret_ephemeral_key_2026";

export class RoomService {
  private rooms: Map<string, Room> = new Map(); // roomId -> Room
  private codeToRoomId: Map<string, string> = new Map(); // humanCode -> roomId
  private roomMessages: Map<string, ChatMessage[]> = new Map(); // roomId -> messages
  private participantSessions: Map<string, { roomId: string; participantId: string }> = new Map();

  /**
   * Generates a unique 4-digit human-friendly room code
   */
  private generateUniqueRoomCode(): string {
    let attempts = 0;
    while (attempts < 1000) {
      // 4-digit numeric code 1000 - 9999
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      if (!this.codeToRoomId.has(code)) {
        return code;
      }
      attempts++;
    }
    // Fallback to 6-char alphanumeric if dense
    return crypto.randomBytes(3).toString("hex").toUpperCase();
  }

  /**
   * Generates an Ephemeral Codename (e.g. "Ghost-71")
   */
  public generateCodename(): { codename: string; avatarColor: string } {
    const prefix = CODENAME_PREFIXES[Math.floor(Math.random() * CODENAME_PREFIXES.length)];
    const num = Math.floor(10 + Math.random() * 90);
    const avatarColor = AVATAR_PALETTE[Math.floor(Math.random() * AVATAR_PALETTE.length)];
    return {
      codename: `${prefix}-${num}`,
      avatarColor,
    };
  }

  /**
   * Sign an ephemeral session token (HMAC-SHA256)
   */
  public signSessionToken(roomId: string, participantId: string, isHost: boolean): string {
    const payload = JSON.stringify({
      roomId,
      participantId,
      isHost,
      iat: Date.now(),
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });
    const base64Payload = Buffer.from(payload).toString("base64url");
    const signature = crypto
      .createHmac("sha256", SECRET_KEY)
      .update(base64Payload)
      .digest("base64url");
    return `${base64Payload}.${signature}`;
  }

  /**
   * Verify an ephemeral session token
   */
  public verifySessionToken(token: string): { roomId: string; participantId: string; isHost: boolean } | null {
    try {
      const [base64Payload, signature] = token.split(".");
      if (!base64Payload || !signature) return null;

      const expectedSig = crypto
        .createHmac("sha256", SECRET_KEY)
        .update(base64Payload)
        .digest("base64url");

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
        return null;
      }

      const payload = JSON.parse(Buffer.from(base64Payload, "base64url").toString("utf-8"));
      if (payload.exp && payload.exp < Date.now()) {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }

  /**
   * Create a new private room
   */
  public createRoom(
    settingsInput?: Partial<RoomSettings>,
    customPassphrase?: string
  ): { room: Room; hostParticipant: Participant; sessionToken: string } {
    const internalRoomId = crypto.randomUUID();
    const humanCode = this.generateUniqueRoomCode();
    const hostParticipantId = crypto.randomUUID();
    const { codename, avatarColor } = this.generateCodename();

    const expiresInSeconds = settingsInput?.expiresInSeconds || 3600; // Default 1 hour
    const now = Date.now();
    const expiresAt = now + expiresInSeconds * 1000;

    const defaultPermissions = {
      allowMicrophone: true,
      allowCamera: true,
      allowScreenShare: true,
      allowFileSharing: true,
      allowMediaSync: true,
      allowNewParticipants: true,
      autoDestroyOnEmpty: true,
      requireE2EE: true,
      ...settingsInput?.permissions,
    };

    const roomSettings: RoomSettings = {
      maxParticipants: settingsInput?.maxParticipants || 10,
      expiresInSeconds,
      messageRetention: settingsInput?.messageRetention || "SESSION_ONLY",
      fileRetention: settingsInput?.fileRetention || "SESSION_ONLY",
      permissions: defaultPermissions,
    };

    const secretHash = customPassphrase
      ? crypto.createHash("sha256").update(customPassphrase + "phantom_passphrase_salt").digest("hex")
      : "";

    const hostParticipant: Participant = {
      id: hostParticipantId,
      socketId: "",
      codename,
      displayName: codename,
      avatarColor,
      isHost: true,
      joinedAt: now,
      lastActive: now,
      mediaState: {
        isMuted: true,
        isVideoOff: true,
        isScreenSharing: false,
        isSpeaking: false,
        connectionQuality: "EXCELLENT",
      },
    };

    const newRoom: Room = {
      id: internalRoomId,
      code: humanCode,
      secretHash,
      hostSessionId: hostParticipantId,
      createdAt: now,
      expiresAt,
      status: "ACTIVE",
      settings: roomSettings,
      participants: {
        [hostParticipantId]: hostParticipant,
      },
      mediaSyncState: {
        currentTrack: null,
        isPlaying: false,
        positionSeconds: 0,
        playbackRate: 1.0,
        serverTimestamp: now,
        version: 1,
        queue: [],
        isLockedByHost: false,
      },
    };

    this.rooms.set(internalRoomId, newRoom);
    this.codeToRoomId.set(humanCode, internalRoomId);
    this.roomMessages.set(internalRoomId, []);
    this.participantSessions.set(hostParticipantId, { roomId: internalRoomId, participantId: hostParticipantId });

    const sessionToken = this.signSessionToken(internalRoomId, hostParticipantId, true);

    securityAudit.logEvent({
      type: "ROOM_EXPIRED", // informational
      ipHash: "system",
      roomCode: humanCode,
      details: `Created new room ${humanCode} with internal ID ${internalRoomId.slice(0, 8)}... (Expires in ${expiresInSeconds}s)`,
      severity: "LOW",
    });

    return {
      room: newRoom,
      hostParticipant,
      sessionToken,
    };
  }

  /**
   * Validate and join a room by 4-digit code or direct internal ID
   */
  public joinRoom(
    codeOrId: string,
    passphrase?: string,
    requestedCodename?: string
  ): { room: Room; participant: Participant; sessionToken: string } | { error: string; code: number } {
    let roomId = this.rooms.has(codeOrId) ? codeOrId : this.codeToRoomId.get(codeOrId);
    if (!roomId) {
      return { error: "Unable to join this room.", code: 404 };
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      return { error: "Unable to join this room.", code: 404 };
    }

    // Check expiration
    if (Date.now() > room.expiresAt || room.status !== "ACTIVE") {
      this.destroyRoom(room.id, "EXPIRED");
      return { error: "This private room no longer exists.", code: 410 };
    }

    // Check permissions
    if (!room.settings.permissions.allowNewParticipants) {
      return { error: "This room is currently locked by the host.", code: 403 };
    }

    // Check participant count
    const currentCount = Object.keys(room.participants).length;
    if (currentCount >= room.settings.maxParticipants) {
      return { error: "Room has reached its maximum participant limit.", code: 403 };
    }

    // Check passphrase if room has one
    if (room.secretHash) {
      const providedHash = passphrase
        ? crypto.createHash("sha256").update(passphrase + "phantom_passphrase_salt").digest("hex")
        : "";
      if (
        !passphrase ||
        !crypto.timingSafeEqual(Buffer.from(providedHash), Buffer.from(room.secretHash))
      ) {
        return { error: "Incorrect room security passphrase.", code: 401 };
      }
    }

    const participantId = crypto.randomUUID();
    const generated = this.generateCodename();
    const codename = requestedCodename && requestedCodename.trim().length <= 20
      ? requestedCodename.trim()
      : generated.codename;

    const participant: Participant = {
      id: participantId,
      socketId: "",
      codename,
      displayName: codename,
      avatarColor: generated.avatarColor,
      isHost: false,
      joinedAt: Date.now(),
      lastActive: Date.now(),
      mediaState: {
        isMuted: true,
        isVideoOff: true,
        isScreenSharing: false,
        isSpeaking: false,
        connectionQuality: "EXCELLENT",
      },
    };

    room.participants[participantId] = participant;
    this.participantSessions.set(participantId, { roomId: room.id, participantId });

    const sessionToken = this.signSessionToken(room.id, participantId, false);

    return {
      room,
      participant,
      sessionToken,
    };
  }

  /**
   * Retrieve room by ID
   */
  public getRoom(roomId: string): Room | undefined {
    const room = this.rooms.get(roomId);
    if (room && Date.now() > room.expiresAt) {
      this.destroyRoom(room.id, "EXPIRED");
      return undefined;
    }
    return room;
  }

  /**
   * Retrieve room by human code
   */
  public getRoomByCode(code: string): Room | undefined {
    const roomId = this.codeToRoomId.get(code);
    if (!roomId) return undefined;
    return this.getRoom(roomId);
  }

  /**
   * Leave a room
   */
  public leaveRoom(roomId: string, participantId: string): { roomDestroyed: boolean; newHostId?: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { roomDestroyed: true };

    delete room.participants[participantId];
    this.participantSessions.delete(participantId);

    const remainingParticipants = Object.keys(room.participants);

    if (remainingParticipants.length === 0) {
      if (room.settings.permissions.autoDestroyOnEmpty) {
        this.destroyRoom(roomId, "DESTROYED");
        return { roomDestroyed: true };
      }
    } else if (room.hostSessionId === participantId) {
      // Reassign host to next participant
      const nextHostId = remainingParticipants[0];
      room.hostSessionId = nextHostId;
      if (room.participants[nextHostId]) {
        room.participants[nextHostId].isHost = true;
      }
      return { roomDestroyed: false, newHostId: nextHostId };
    }

    return { roomDestroyed: false };
  }

  /**
   * Destroy a room immediately and purge its contents
   */
  public destroyRoom(roomId: string, reason: RoomStatus = "DESTROYED"): void {
    const room = this.rooms.get(roomId);
    if (room) {
      this.codeToRoomId.delete(room.code);
      Object.keys(room.participants).forEach((pid) => {
        this.participantSessions.delete(pid);
      });
      room.status = reason;
      this.rooms.delete(roomId);
      this.roomMessages.delete(roomId);

      securityAudit.logEvent({
        type: "ROOM_PURGED",
        ipHash: "system",
        roomCode: room.code,
        details: `Room ${room.code} (${roomId.slice(0, 8)}) purged. Reason: ${reason}`,
        severity: "LOW",
      });
    }
  }

  /**
   * Messages handling
   */
  public addMessage(roomId: string, message: ChatMessage): ChatMessage {
    const messages = this.roomMessages.get(roomId) || [];
    messages.push(message);

    // Limit in-memory message history to 500 messages per room
    if (messages.length > 500) {
      messages.shift();
    }

    this.roomMessages.set(roomId, messages);
    return message;
  }

  public getMessages(roomId: string): ChatMessage[] {
    return this.roomMessages.get(roomId) || [];
  }

  public updateMessageReactions(roomId: string, messageId: string, emoji: string, participantId: string): ChatMessage | null {
    const messages = this.roomMessages.get(roomId) || [];
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return null;

    if (!msg.reactions[emoji]) {
      msg.reactions[emoji] = [];
    }

    const index = msg.reactions[emoji].indexOf(participantId);
    if (index > -1) {
      msg.reactions[emoji].splice(index, 1);
      if (msg.reactions[emoji].length === 0) {
        delete msg.reactions[emoji];
      }
    } else {
      msg.reactions[emoji].push(participantId);
    }

    return msg;
  }

  public deleteMessage(roomId: string, messageId: string, requesterId: string, isHost: boolean): boolean {
    const messages = this.roomMessages.get(roomId) || [];
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return false;

    if (msg.senderId !== requesterId && !isHost) {
      return false; // Unauthorized
    }

    msg.isDeleted = true;
    msg.encryptedContent = undefined;
    msg.plaintextFallback = "[Message deleted by sender]";
    return true;
  }

  public updateParticipantMediaState(
    roomId: string,
    participantId: string,
    mediaState: Partial<Participant["mediaState"]>
  ): Participant | null {
    const room = this.rooms.get(roomId);
    if (!room || !room.participants[participantId]) return null;

    room.participants[participantId].mediaState = {
      ...room.participants[participantId].mediaState,
      ...mediaState,
    };
    room.participants[participantId].lastActive = Date.now();
    return room.participants[participantId];
  }

  public updateParticipantName(roomId: string, participantId: string, newName: string): Participant | null {
    const room = this.rooms.get(roomId);
    if (!room || !room.participants[participantId]) return null;

    const trimmed = newName.trim().slice(0, 24);
    if (!trimmed) return null;

    room.participants[participantId].displayName = trimmed;
    return room.participants[participantId];
  }

  public getActiveRoomCount(): number {
    return this.rooms.size;
  }

  public getExpiredRooms(): string[] {
    const now = Date.now();
    const expired: string[] = [];
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.expiresAt < now) {
        expired.push(roomId);
      }
    }
    return expired;
  }
}

export const roomService = new RoomService();
