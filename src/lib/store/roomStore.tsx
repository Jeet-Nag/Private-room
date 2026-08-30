"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Room, Participant, ChatMessage, MediaSyncState, MediaTrack, FileAttachmentMetadata, AppError, EventEnvelope } from "../../../server/types";
import { socketManager } from "../socket/socketClient";
import { webrtc } from "../webrtc/webrtcManager";
import { e2ee } from "../crypto/e2ee";

export type RoomTab = "chat" | "call" | "sync" | "media" | "people" | "privacy";

interface RoomContextType {
  room: Room | null;
  currentParticipant: Participant | null;
  participants: Participant[];
  participantsById: Record<string, Participant>;
  messages: ChatMessage[];
  attachments: { meta: FileAttachmentMetadata; sender: string; time: number }[];
  mediaSyncState: MediaSyncState;
  activeTab: RoomTab;
  setActiveTab: (tab: RoomTab) => void;
  isInCall: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isSpeaking: boolean;
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  remoteScreenStreams: Record<string, MediaStream>;
  typingUsers: string[];
  e2eeEnabled: boolean;
  isDestroyed: boolean;
  destroyedReason: string;
  sessionToken: string | null;
  errors: AppError[];
  removeError: (id: string) => void;
  // Actions
  joinRoomSession: (roomId: string, participant: Participant, token: string) => void;
  sendMessage: (text: string, type?: "text" | "code" | "file", codeLanguage?: string, fileMeta?: any, replyToId?: string, replySnippet?: string) => Promise<void>;
  sendReaction: (messageId: string, emoji: string) => void;
  deleteMessage: (messageId: string) => void;
  startTyping: () => void;
  stopTyping: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => Promise<void>;
  startCall: () => Promise<void>;
  leaveCall: () => void;
  syncPlay: (position?: number) => void;
  syncPause: (position?: number) => void;
  syncSeek: (position: number) => void;
  syncChangeTrack: (track: MediaTrack) => void;
  syncNextTrack: () => void;
  syncAddToQueue: (track: MediaTrack) => void;
  syncRemoveFromQueue: (trackId: string) => void;
  syncReorderQueue: (fromIndex: number, toIndex: number) => void;
  syncToggleLock: () => void;
  updateDisplayName: (name: string) => void;
  destroyRoomNow: () => void;
  leaveRoom: () => void;
}

const RoomContext = createContext<RoomContextType | null>(null);

export const RoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [currentParticipant, setCurrentParticipant] = useState<Participant | null>(null);
  const [participantsById, setParticipantsById] = useState<Record<string, Participant>>({});
  
  // Normalized Message State: messagesById ensures strict idempotency
  const [messagesById, setMessagesById] = useState<Record<string, ChatMessage>>({});
  const [messageIds, setMessageIds] = useState<string[]>([]);
  
  // Normalized Attachments State
  const [attachmentsById, setAttachmentsById] = useState<Record<string, { meta: FileAttachmentMetadata; sender: string; time: number }>>({});

  const [mediaSyncState, setMediaSyncState] = useState<MediaSyncState>({
    currentTrack: null,
    isPlaying: false,
    positionSeconds: 0,
    playbackRate: 1.0,
    serverTimestamp: Date.now(),
    version: 1,
    queue: [],
    isLockedByHost: false,
  });

  const [activeTab, setActiveTab] = useState<RoomTab>("chat");
  const [isInCall, setIsInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [remoteScreenStreams, setRemoteScreenStreams] = useState<Record<string, MediaStream>>({});
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [e2eeEnabled, setE2eeEnabled] = useState(true);
  const [isDestroyed, setIsDestroyed] = useState(false);
  const [destroyedReason, setDestroyedReason] = useState("");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [errors, setErrors] = useState<AppError[]>([]);

  const isInCallRef = useRef(isInCall);
  isInCallRef.current = isInCall;
  const currentParticipantRef = useRef(currentParticipant);
  currentParticipantRef.current = currentParticipant;

  const generateSafeId = (prefix: string = "err"): string => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      try {
        return crypto.randomUUID();
      } catch {}
    }
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  };

  const addError = useCallback((err: Omit<AppError, "id" | "timestamp">) => {
    const fullErr: AppError = {
      id: generateSafeId("err"),
      timestamp: Date.now(),
      ...err,
    };
    setErrors((prev) => [fullErr, ...prev.slice(0, 4)]);
  }, []);

  const removeError = useCallback((id: string) => {
    setErrors((prev) => prev.filter((e) => e.id !== id));
  }, []);

  /**
   * Initialize ICE servers on startup
   */
  useEffect(() => {
    webrtc.fetchIceServers();
    webrtc.setOnDiagnosticEvent((diag) => {
      addError({
        source: diag.source as any,
        code: diag.code,
        title: `[${diag.source}] ${diag.code}`,
        message: diag.message,
        severity: diag.severity || "error",
      });
    });
  }, [addError]);

  /**
   * Decrypt incoming message content if E2EE
   */
  const processMessageDecryption = useCallback(async (msg: ChatMessage): Promise<ChatMessage> => {
    if (msg.encryptedContent && msg.iv) {
      const decrypted = await e2ee.decrypt(msg.encryptedContent, msg.iv);
      return { ...msg, plaintextFallback: decrypted };
    }
    return msg;
  }, []);

  /**
   * Safe Idempotent Message Insertion
   */
  const insertMessage = useCallback((msg: ChatMessage) => {
    setMessagesById((prev) => {
      if (prev[msg.id]) {
        return { ...prev, [msg.id]: { ...prev[msg.id], ...msg } };
      }
      return { ...prev, [msg.id]: msg };
    });

    setMessageIds((prev) => (prev.includes(msg.id) ? prev : [...prev, msg.id]));

    if (msg.fileMetadata && msg.fileMetadata.fileId) {
      const fileMeta = msg.fileMetadata;
      setAttachmentsById((prev) => ({
        ...prev,
        [fileMeta.fileId]: {
          meta: fileMeta,
          sender: msg.senderCodename,
          time: msg.createdAt,
        },
      }));
    }
  }, []);

  /**
   * Centralized Socket Event Listener Setup & Teardown
   */
  useEffect(() => {
    const socket = socketManager.getSocket();

    socketManager.removeAllRoomListeners();

    socket.on("room:initial_state", async (envelope: EventEnvelope | any) => {
      const data = envelope.payload || envelope;
      setRoom(data.room);
      setCurrentParticipant(data.participant);
      setParticipantsById(data.room.participants || {});
      setMediaSyncState(data.mediaSyncState);

      if (data.messages && Array.isArray(data.messages)) {
        for (const m of data.messages) {
          const decrypted = await processMessageDecryption(m);
          insertMessage(decrypted);
        }
      }
    });

    socket.on("room:participant_joined", (envelope: EventEnvelope | any) => {
      const data = envelope.payload || envelope;
      const participant: Participant = data.participant;
      
      setParticipantsById((prev) => ({ ...prev, [participant.id]: participant }));

      // If we are currently in call, initiate WebRTC offer to the newcomer
      if (isInCallRef.current && currentParticipantRef.current) {
        console.log(`[RTC] Initiating offer to newly joined participant: ${participant.id}`);
        webrtc.initiateOffer(participant.id, socket, currentParticipantRef.current.id);
      }
    });

    socket.on("room:participant_updated", (envelope: EventEnvelope | any) => {
      const data = envelope.payload || envelope;
      const participant: Participant = data.participant;
      setParticipantsById((prev) => ({ ...prev, [participant.id]: participant }));
      if (currentParticipantRef.current?.id === participant.id) {
        setCurrentParticipant(participant);
      }
    });

    socket.on("room:participant_left", (envelope: EventEnvelope | any) => {
      const data = envelope.payload || envelope;
      const pId = data.participantId;

      setParticipantsById((prev) => {
        const next = { ...prev };
        delete next[pId];
        return next;
      });

      webrtc.cleanUpPeer(pId);
      setRemoteStreams((prev) => {
        const next = { ...prev };
        delete next[pId];
        return next;
      });
      setRemoteScreenStreams((prev) => {
        const next = { ...prev };
        delete next[pId];
        return next;
      });
    });

    socket.on("room:destroyed", (envelope: EventEnvelope | any) => {
      const data = envelope.payload || envelope;
      setIsDestroyed(true);
      setDestroyedReason(data.message || "This private room was terminated.");
      webrtc.cleanUpAll();
      socketManager.disconnect();
    });

    socket.on("room:error", (err: any) => {
      addError({
        source: "ROOM",
        code: "JOIN_FAILED",
        title: "ROOM ERROR",
        message: err.message || "Unable to join room session.",
        severity: "error",
      });
    });

    socket.on("chat:message_received", async (envelope: EventEnvelope | any) => {
      const data = envelope.payload || envelope;
      const decrypted = await processMessageDecryption(data.message);
      insertMessage(decrypted);
    });

    socket.on("chat:reaction_updated", (envelope: EventEnvelope | any) => {
      const data = envelope.payload || envelope;
      insertMessage(data.message);
    });

    socket.on("chat:message_deleted", (envelope: EventEnvelope | any) => {
      const data = envelope.payload || envelope;
      setMessagesById((prev) => {
        if (!prev[data.messageId]) return prev;
        return {
          ...prev,
          [data.messageId]: {
            ...prev[data.messageId],
            isDeleted: true,
            plaintextFallback: "[Message deleted by sender]",
            encryptedContent: undefined,
          },
        };
      });
    });

    socket.on("chat:typing", (envelope: EventEnvelope | any) => {
      const data = envelope.payload || envelope;
      setTypingUsers((prev) => {
        if (data.isTyping) {
          return prev.includes(data.codename) ? prev : [...prev, data.codename];
        }
        return prev.filter((c) => c !== data.codename);
      });
    });

    socket.on("sync:state_updated", (envelope: EventEnvelope | any) => {
      const data = envelope.payload || envelope;
      setMediaSyncState(data.state);
    });

    socket.on("signal:offer", async (payload) => {
      if (currentParticipantRef.current) {
        if (isInCallRef.current && !webrtc.getLocalStream()) {
          const s = await webrtc.getLocalMedia(!isMuted, !isVideoOff);
          setLocalStream(s);
        }
        webrtc.handleOffer(payload, socket, currentParticipantRef.current.id);
      }
    });

    socket.on("signal:answer", (payload) => {
      webrtc.handleAnswer(payload);
    });

    socket.on("signal:candidate", (payload) => {
      webrtc.handleCandidate(payload);
    });

    socket.on("signal:media_state_changed", (envelope: EventEnvelope | any) => {
      const data = envelope.payload || envelope;
      setParticipantsById((prev) => {
        if (!prev[data.participantId]) return prev;
        return {
          ...prev,
          [data.participantId]: {
            ...prev[data.participantId],
            mediaState: {
              ...prev[data.participantId].mediaState,
              ...data.mediaState,
            },
          },
        };
      });
    });

    webrtc.setOnRemoteStream((pId, stream, kind) => {
      if (kind === "screen") {
        setRemoteScreenStreams((prev) => ({ ...prev, [pId]: stream }));
      } else {
        setRemoteStreams((prev) => ({ ...prev, [pId]: stream }));
      }
    });

    webrtc.setOnRemoteStreamRemoved((pId, kind) => {
      if (kind === "screen") {
        setRemoteScreenStreams((prev) => {
          const next = { ...prev };
          delete next[pId];
          return next;
        });
      } else {
        setRemoteStreams((prev) => {
          const next = { ...prev };
          delete next[pId];
          return next;
        });
      }
    });

    webrtc.setOnSpeaking((speaking) => {
      setIsSpeaking(speaking);
    });

    webrtc.setOnScreenShareEnded(() => {
      setIsScreenSharing(false);
      socket.emit("signal:media_state", { isScreenSharing: false });
    });

    return () => {
      socketManager.removeAllRoomListeners();
    };
  }, [addError, insertMessage, processMessageDecryption, isMuted, isVideoOff]);

  const joinRoomSession = useCallback((newRoomId: string, participant: Participant, token: string) => {
    setSessionToken(token);
    setCurrentParticipant(participant);

    e2ee.deriveKeyFromSecret(newRoomId + "phantom_e2ee_salt").then(() => {
      setE2eeEnabled(true);
    });

    const socket = socketManager.connect(token);
    socket.emit("room:join", {
      roomId: newRoomId,
      participantId: participant.id,
      token,
    });
  }, []);

  const sendMessage = async (
    text: string,
    type: "text" | "code" | "file" = "text",
    codeLanguage?: string,
    fileMeta?: any,
    replyToId?: string,
    replySnippet?: string
  ) => {
    const socket = socketManager.getSocket();
    if (!socket.connected || !room) return;

    let encryptedContent: string | undefined;
    let iv: string | undefined;
    let plaintextFallback: string | undefined = text;

    if (e2eeEnabled && text) {
      const encrypted = await e2ee.encrypt(text);
      if (encrypted) {
        encryptedContent = encrypted.ciphertext;
        iv = encrypted.iv;
        plaintextFallback = undefined;
      }
    }

    socket.emit("chat:send", {
      encryptedContent,
      iv,
      plaintextFallback,
      type,
      codeLanguage,
      fileMetadata: fileMeta,
      replyToId,
      replySnippet,
    });
  };

  const sendReaction = (messageId: string, emoji: string) => {
    const socket = socketManager.getSocket();
    if (socket.connected) {
      socket.emit("chat:reaction", { messageId, emoji });
    }
  };

  const deleteMessage = (messageId: string) => {
    const socket = socketManager.getSocket();
    if (socket.connected) {
      socket.emit("chat:delete", { messageId });
    }
  };

  const startTyping = () => {
    const socket = socketManager.getSocket();
    if (socket.connected) socket.emit("chat:typing_start");
  };

  const stopTyping = () => {
    const socket = socketManager.getSocket();
    if (socket.connected) socket.emit("chat:typing_stop");
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    webrtc.toggleMute(newMuted);
    const socket = socketManager.getSocket();
    if (socket.connected && currentParticipant) {
      socket.emit("signal:media_state", { isMuted: newMuted });
    }
  };

  const toggleVideo = async () => {
    const newOff = !isVideoOff;
    setIsVideoOff(newOff);
    if (!newOff && !localStream) {
      const s = await webrtc.getLocalMedia(!isMuted, true);
      setLocalStream(s);
    }
    webrtc.toggleVideo(newOff);
    const socket = socketManager.getSocket();
    if (socket.connected && currentParticipant) {
      socket.emit("signal:media_state", { isVideoOff: newOff });
    }
  };

  const toggleScreenShare = async () => {
    const socket = socketManager.getSocket();
    if (!isScreenSharing) {
      const stream = await webrtc.startScreenShare(socket, currentParticipant?.id);
      if (stream) {
        setIsScreenSharing(true);
        if (socket.connected) {
          socket.emit("signal:media_state", { isScreenSharing: true });
        }
      }
    } else {
      webrtc.stopScreenShare(socket, currentParticipant?.id);
      setIsScreenSharing(false);
      if (socket.connected) {
        socket.emit("signal:media_state", { isScreenSharing: false });
      }
    }
  };

  const startCall = async () => {
    console.log("[CALL BUTTON] CLICKED");
    console.log("[CALL] button clicked");
    
    const isSecure = typeof window !== "undefined" && window.isSecureContext;
    const isLocal = typeof location !== "undefined" && (location.hostname === "localhost" || location.hostname === "127.0.0.1");
    console.log("[CALL] secure context check:", isSecure ? "SECURE" : isLocal ? "LOCAL_EXEMPT" : "INSECURE");

    if (typeof window !== "undefined" && !isSecure && !isLocal) {
      console.warn("[CALL] Insecure context detected on LAN IP. Browser blocks getUserMedia without HTTPS.");
      addError({
        source: "SECURITY",
        code: "INSECURE_CONTEXT_HTTPS_REQUIRED",
        title: "HTTPS Required for Camera/Microphone",
        message: `Your browser blocks camera and microphone access over plain HTTP (http://${location.host}). Please connect using https://${location.hostname}:${location.port || 3000} or run 'npm run dev:https'.`,
        severity: "critical",
        actionLabel: "SWITCH TO HTTPS",
        onAction: () => {
          window.location.href = `https://${location.hostname}:${location.port || 3000}${location.pathname}`;
        },
      });
      return;
    }

    const muted = false;
    const videoOff = false;
    setIsMuted(muted);
    setIsVideoOff(videoOff);

    console.log("[CALL] media initialization");
    console.log("[CALL] getUserMedia requested");
    const stream = await webrtc.getLocalMedia(!muted, !videoOff);
    
    if (!stream) {
      console.warn("[CALL] Local media stream acquisition failed.");
      return;
    }

    setLocalStream(stream);
    setIsInCall(true);
    console.log("[CALL] signaling initialization");
    console.log("[CALL] peer connection initialization");
    console.log("[CALL] call started");

    const socket = socketManager.getSocket();
    if (socket.connected && currentParticipant) {
      socket.emit("signal:media_state", { isMuted: muted, isVideoOff: videoOff });
      Object.values(participantsById)
        .filter((p) => p.id !== currentParticipant.id)
        .forEach((p) => {
          console.log(`[CALL] creating offer for peer ${p.codename} (${p.id})`);
          webrtc.initiateOffer(p.id, socket, currentParticipant.id);
        });
    }
  };

  const leaveCall = () => {
    webrtc.cleanUpAll();
    setIsInCall(false);
    setIsScreenSharing(false);
    setLocalStream(null);
    setRemoteStreams({});
    setRemoteScreenStreams({});
  };

  const syncPlay = (position?: number) => {
    const socket = socketManager.getSocket();
    if (socket.connected) socket.emit("sync:play", { position });
  };

  const syncPause = (position?: number) => {
    const socket = socketManager.getSocket();
    if (socket.connected) socket.emit("sync:pause", { position });
  };

  const syncSeek = (position: number) => {
    const socket = socketManager.getSocket();
    if (socket.connected) socket.emit("sync:seek", { position });
  };

  const syncChangeTrack = (track: MediaTrack) => {
    const socket = socketManager.getSocket();
    if (socket.connected) socket.emit("sync:change_track", { track });
  };

  const syncNextTrack = () => {
    const socket = socketManager.getSocket();
    if (socket.connected) socket.emit("sync:next_track");
  };

  const syncAddToQueue = (track: MediaTrack) => {
    const socket = socketManager.getSocket();
    if (socket.connected) socket.emit("sync:add_queue", { track });
  };

  const syncRemoveFromQueue = (trackId: string) => {
    const socket = socketManager.getSocket();
    if (socket.connected) socket.emit("sync:remove_queue", { trackId });
  };

  const syncReorderQueue = (fromIndex: number, toIndex: number) => {
    const socket = socketManager.getSocket();
    if (socket.connected) socket.emit("sync:reorder_queue", { fromIndex, toIndex });
  };

  const syncToggleLock = () => {
    const socket = socketManager.getSocket();
    if (socket.connected) socket.emit("sync:toggle_lock");
  };

  const updateDisplayName = (newName: string) => {
    const socket = socketManager.getSocket();
    if (socket.connected) {
      socket.emit("room:update_name", { newName });
    }
  };

  const destroyRoomNow = () => {
    const socket = socketManager.getSocket();
    if (socket.connected) {
      socket.emit("room:destroy");
    }
  };

  const leaveRoom = () => {
    webrtc.cleanUpAll();
    socketManager.disconnect();
    setRoom(null);
    setCurrentParticipant(null);
    setParticipantsById({});
    setMessagesById({});
    setMessageIds([]);
    setAttachmentsById({});
    window.location.href = "/";
  };

  const participants = useMemo(() => Object.values(participantsById), [participantsById]);
  const messages = useMemo(() => messageIds.map((id) => messagesById[id]).filter(Boolean), [messageIds, messagesById]);
  const attachments = useMemo(() => Object.values(attachmentsById), [attachmentsById]);

  return (
    <RoomContext.Provider
      value={{
        room,
        currentParticipant,
        participants,
        participantsById,
        messages,
        attachments,
        mediaSyncState,
        activeTab,
        setActiveTab,
        isInCall,
        isMuted,
        isVideoOff,
        isScreenSharing,
        isSpeaking,
        localStream,
        remoteStreams,
        remoteScreenStreams,
        typingUsers,
        e2eeEnabled,
        isDestroyed,
        destroyedReason,
        sessionToken,
        errors,
        removeError,
        joinRoomSession,
        sendMessage,
        sendReaction,
        deleteMessage,
        startTyping,
        stopTyping,
        toggleMute,
        toggleVideo,
        toggleScreenShare,
        startCall,
        leaveCall,
        syncPlay,
        syncPause,
        syncSeek,
        syncChangeTrack,
        syncNextTrack,
        syncAddToQueue,
        syncRemoveFromQueue,
        syncReorderQueue,
        syncToggleLock,
        updateDisplayName,
        destroyRoomNow,
        leaveRoom,
      }}
    >
      {children}
    </RoomContext.Provider>
  );
};

export const useRoom = () => {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error("useRoom must be used within a RoomProvider");
  }
  return context;
};
