import { Server as SocketIOServer, Socket } from "socket.io";
import { roomService } from "./services/roomService";
import { syncEngine } from "./services/syncEngine";
import { rateLimiter } from "./services/rateLimiter";
import { securityAudit } from "./services/securityAudit";
import { ChatMessage, SignalPayload, MediaTrack, EventEnvelope } from "./types";
import crypto from "crypto";

function wrapEnvelope<T>(eventType: string, roomId: string, payload: T): EventEnvelope<T> {
  return {
    eventId: crypto.randomUUID(),
    eventType,
    roomId,
    timestamp: Date.now(),
    version: 1,
    payload,
  };
}

export function initializeSocketIO(io: SocketIOServer): void {
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (token && typeof token === "string") {
      const verified = roomService.verifySessionToken(token);
      if (verified) {
        socket.data.roomId = verified.roomId;
        socket.data.participantId = verified.participantId;
        socket.data.isHost = verified.isHost;
      }
    }
    return next();
  });

  io.on("connection", (socket: Socket) => {
    const clientIp = (socket.handshake.headers["x-forwarded-for"] as string) || socket.handshake.address || "127.0.0.1";
    console.log(`[WS] Client connected: socket=${socket.id}`);

    /**
     * Join Room via Socket
     */
    socket.on("room:join", ({ roomId, participantId, token }: { roomId: string; participantId: string; token?: string }) => {
      let authorizedRoomId = roomId;
      let authorizedParticipantId = participantId;

      if (token) {
        const verified = roomService.verifySessionToken(token);
        if (verified) {
          authorizedRoomId = verified.roomId;
          authorizedParticipantId = verified.participantId;
          socket.data.isHost = verified.isHost;
        }
      }

      const room = roomService.getRoom(authorizedRoomId);
      if (!room || !room.participants[authorizedParticipantId]) {
        socket.emit("room:error", { message: "Unable to join this private room or session expired." });
        return;
      }

      // Associate socket ID
      socket.data.roomId = authorizedRoomId;
      socket.data.participantId = authorizedParticipantId;
      room.participants[authorizedParticipantId].socketId = socket.id;

      socket.join(authorizedRoomId);
      console.log(`[ROOM] Participant ${authorizedParticipantId} (${room.participants[authorizedParticipantId].codename}) joined room ${room.code}`);

      // Initialize media state if not yet set
      if (!room.mediaSyncState.currentTrack) {
        syncEngine.initializeRoomMedia(authorizedRoomId);
      }

      // Send initial full room state to newly connected client
      socket.emit("room:initial_state", wrapEnvelope("room:initial_state", authorizedRoomId, {
        room,
        participant: room.participants[authorizedParticipantId],
        messages: roomService.getMessages(authorizedRoomId),
        mediaSyncState: room.mediaSyncState,
      }));

      // Broadcast participant joined to everyone else in the room
      socket.to(authorizedRoomId).emit("room:participant_joined", wrapEnvelope("room:participant_joined", authorizedRoomId, {
        participant: room.participants[authorizedParticipantId],
      }));
    });

    /**
     * Update Participant Display Name
     */
    socket.on("room:update_name", ({ newName }: { newName: string }) => {
      const { roomId, participantId } = socket.data;
      if (!roomId || !participantId) return;

      const updated = roomService.updateParticipantName(roomId, participantId, newName);
      if (updated) {
        io.to(roomId).emit("room:participant_updated", wrapEnvelope("room:participant_updated", roomId, { participant: updated }));
      }
    });

    /**
     * Real-time Chat Message
     */
    socket.on("chat:send", (payload: Partial<ChatMessage>) => {
      const { roomId, participantId } = socket.data;
      if (!roomId || !participantId) return;

      // Rate limit check (max 60 messages/min per participant)
      if (!rateLimiter.checkRateLimit(`${clientIp}_chat`, 60)) {
        socket.emit("chat:error", { message: "Message rate limit exceeded. Please slow down." });
        return;
      }

      const room = roomService.getRoom(roomId);
      if (!room || !room.participants[participantId]) return;

      const sender = room.participants[participantId];

      const message: ChatMessage = {
        id: crypto.randomUUID(),
        roomId,
        senderId: participantId,
        senderCodename: sender.displayName || sender.codename,
        senderAvatarColor: sender.avatarColor,
        encryptedContent: payload.encryptedContent,
        iv: payload.iv,
        plaintextFallback: payload.plaintextFallback,
        type: payload.type || "text",
        codeLanguage: payload.codeLanguage,
        fileMetadata: payload.fileMetadata,
        replyToId: payload.replyToId,
        replySnippet: payload.replySnippet,
        reactions: {},
        createdAt: Date.now(),
      };

      const saved = roomService.addMessage(roomId, message);
      console.log(`[CHAT] Message created: id=${saved.id}, room=${room.code}, sender=${sender.codename}`);

      // Broadcast single authoritative event to entire room
      io.to(roomId).emit("chat:message_received", wrapEnvelope("chat:message_received", roomId, { message: saved }));
    });

    /**
     * Typing Indicators
     */
    socket.on("chat:typing_start", () => {
      const { roomId, participantId } = socket.data;
      if (!roomId || !participantId) return;
      const room = roomService.getRoom(roomId);
      if (!room || !room.participants[participantId]) return;

      const participant = room.participants[participantId];
      socket.to(roomId).emit("chat:typing", wrapEnvelope("chat:typing", roomId, {
        participantId,
        codename: participant.displayName || participant.codename,
        isTyping: true,
      }));
    });

    socket.on("chat:typing_stop", () => {
      const { roomId, participantId } = socket.data;
      if (!roomId || !participantId) return;
      socket.to(roomId).emit("chat:typing", wrapEnvelope("chat:typing", roomId, {
        participantId,
        isTyping: false,
      }));
    });

    /**
     * Message Reactions
     */
    socket.on("chat:reaction", ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      const { roomId, participantId } = socket.data;
      if (!roomId || !participantId) return;

      const updated = roomService.updateMessageReactions(roomId, messageId, emoji, participantId);
      if (updated) {
        io.to(roomId).emit("chat:reaction_updated", wrapEnvelope("chat:reaction_updated", roomId, { message: updated }));
      }
    });

    /**
     * Delete Message
     */
    socket.on("chat:delete", ({ messageId }: { messageId: string }) => {
      const { roomId, participantId, isHost } = socket.data;
      if (!roomId || !participantId) return;

      const success = roomService.deleteMessage(roomId, messageId, participantId, !!isHost);
      if (success) {
        io.to(roomId).emit("chat:message_deleted", wrapEnvelope("chat:message_deleted", roomId, { messageId }));
      }
    });

    /**
     * WebRTC Signaling (Offers, Answers, Candidates, Renegotiation)
     */
    socket.on("signal:offer", (payload: SignalPayload) => {
      const { roomId } = socket.data;
      if (!roomId) return;
      const room = roomService.getRoom(roomId);
      if (!room) return;

      const target = room.participants[payload.targetParticipantId];
      if (target && target.socketId) {
        console.log(`[RTC] Offer relayed from ${payload.senderParticipantId} to ${payload.targetParticipantId}`);
        io.to(target.socketId).emit("signal:offer", payload);
      }
    });

    socket.on("signal:answer", (payload: SignalPayload) => {
      const { roomId } = socket.data;
      if (!roomId) return;
      const room = roomService.getRoom(roomId);
      if (!room) return;

      const target = room.participants[payload.targetParticipantId];
      if (target && target.socketId) {
        console.log(`[RTC] Answer relayed from ${payload.senderParticipantId} to ${payload.targetParticipantId}`);
        io.to(target.socketId).emit("signal:answer", payload);
      }
    });

    socket.on("signal:candidate", (payload: SignalPayload) => {
      const { roomId } = socket.data;
      if (!roomId) return;
      const room = roomService.getRoom(roomId);
      if (!room) return;

      const target = room.participants[payload.targetParticipantId];
      if (target && target.socketId) {
        io.to(target.socketId).emit("signal:candidate", payload);
      }
    });

    socket.on("signal:renegotiate", (payload: { targetParticipantId: string; senderParticipantId: string }) => {
      const { roomId } = socket.data;
      if (!roomId) return;
      const room = roomService.getRoom(roomId);
      if (!room) return;

      const target = room.participants[payload.targetParticipantId];
      if (target && target.socketId) {
        console.log(`[RTC] Renegotiate signal from ${payload.senderParticipantId} to ${payload.targetParticipantId}`);
        io.to(target.socketId).emit("signal:renegotiate", payload);
      }
    });

    /**
     * Media State Updates (Mic, Cam, Screen, Active Speaker)
     */
    socket.on("signal:media_state", (mediaState: any) => {
      const { roomId, participantId } = socket.data;
      if (!roomId || !participantId) return;

      const updated = roomService.updateParticipantMediaState(roomId, participantId, mediaState);
      if (updated) {
        io.to(roomId).emit("signal:media_state_changed", wrapEnvelope("signal:media_state_changed", roomId, {
          participantId,
          mediaState: updated.mediaState,
        }));
      }
    });

    /**
     * Synchronized Media Events
     */
    socket.on("sync:play", ({ position }: { position?: number }) => {
      const { roomId } = socket.data;
      if (!roomId) return;
      const updated = syncEngine.play(roomId, position);
      if (updated) {
        io.to(roomId).emit("sync:state_updated", wrapEnvelope("sync:state_updated", roomId, { state: updated }));
      }
    });

    socket.on("sync:pause", ({ position }: { position?: number }) => {
      const { roomId } = socket.data;
      if (!roomId) return;
      const updated = syncEngine.pause(roomId, position);
      if (updated) {
        io.to(roomId).emit("sync:state_updated", wrapEnvelope("sync:state_updated", roomId, { state: updated }));
      }
    });

    socket.on("sync:seek", ({ position }: { position: number }) => {
      const { roomId } = socket.data;
      if (!roomId) return;
      const updated = syncEngine.seek(roomId, position);
      if (updated) {
        io.to(roomId).emit("sync:state_updated", wrapEnvelope("sync:state_updated", roomId, { state: updated }));
      }
    });

    socket.on("sync:change_track", ({ track }: { track: MediaTrack }) => {
      const { roomId } = socket.data;
      if (!roomId) return;
      const updated = syncEngine.changeTrack(roomId, track);
      if (updated) {
        io.to(roomId).emit("sync:state_updated", wrapEnvelope("sync:state_updated", roomId, { state: updated }));
      }
    });

    socket.on("sync:next_track", () => {
      const { roomId } = socket.data;
      if (!roomId) return;
      const updated = syncEngine.nextTrack(roomId);
      if (updated) {
        io.to(roomId).emit("sync:state_updated", wrapEnvelope("sync:state_updated", roomId, { state: updated }));
      }
    });

    socket.on("sync:add_queue", ({ track }: { track: MediaTrack }) => {
      const { roomId } = socket.data;
      if (!roomId) return;
      const updated = syncEngine.addToQueue(roomId, track);
      if (updated) {
        io.to(roomId).emit("sync:state_updated", wrapEnvelope("sync:state_updated", roomId, { state: updated }));
      }
    });

    socket.on("sync:remove_queue", ({ trackId }: { trackId: string }) => {
      const { roomId } = socket.data;
      if (!roomId) return;
      const updated = syncEngine.removeFromQueue(roomId, trackId);
      if (updated) {
        io.to(roomId).emit("sync:state_updated", wrapEnvelope("sync:state_updated", roomId, { state: updated }));
      }
    });

    socket.on("sync:reorder_queue", ({ fromIndex, toIndex }: { fromIndex: number; toIndex: number }) => {
      const { roomId } = socket.data;
      if (!roomId) return;
      const updated = syncEngine.reorderQueue(roomId, fromIndex, toIndex);
      if (updated) {
        io.to(roomId).emit("sync:state_updated", wrapEnvelope("sync:state_updated", roomId, { state: updated }));
      }
    });

    socket.on("sync:toggle_lock", () => {
      const { roomId, isHost } = socket.data;
      if (!roomId) return;
      const updated = syncEngine.toggleLock(roomId, !!isHost);
      if (updated) {
        io.to(roomId).emit("sync:state_updated", wrapEnvelope("sync:state_updated", roomId, { state: updated }));
      }
    });

    /**
     * Self-Destruct / Immediate Room Purge
     */
    socket.on("room:destroy", () => {
      const { roomId, isHost } = socket.data;
      if (!roomId || !isHost) return;

      io.to(roomId).emit("room:destroyed", wrapEnvelope("room:destroyed", roomId, { message: "This room was terminated by the host." }));
      roomService.destroyRoom(roomId, "DESTROYED");
    });

    /**
     * Disconnect Handling
     */
    socket.on("disconnect", (reason) => {
      const { roomId, participantId } = socket.data;
      console.log(`[WS] Client disconnected: id=${socket.id}, reason=${reason}`);
      if (roomId && participantId) {
        const result = roomService.leaveRoom(roomId, participantId);
        if (result.roomDestroyed) {
          io.to(roomId).emit("room:destroyed", wrapEnvelope("room:destroyed", roomId, { message: "Room was destroyed as all members left." }));
        } else {
          socket.to(roomId).emit("room:participant_left", wrapEnvelope("room:participant_left", roomId, {
            participantId,
            newHostId: result.newHostId,
          }));
        }
      }
    });
  });
}
