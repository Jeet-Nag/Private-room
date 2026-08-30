/**
 * PHANTOM ROOM: Production-Grade Types & Protocol Contracts
 */

export type RoomStatus = "ACTIVE" | "EXPIRED" | "LOCKED" | "DESTROYED";
export type RetentionPolicy = "SESSION_ONLY" | "24_HOURS" | "7_DAYS" | "NEVER";
export type ConnectionQuality = "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "DISCONNECTED";

export interface EventEnvelope<T = any> {
  eventId: string;
  eventType: string;
  roomId: string;
  timestamp: number;
  version: number;
  payload: T;
}

export interface RoomPermissions {
  allowMicrophone: boolean;
  allowCamera: boolean;
  allowScreenShare: boolean;
  allowFileSharing: boolean;
  allowMediaSync: boolean;
  allowNewParticipants: boolean;
  autoDestroyOnEmpty: boolean;
  requireE2EE: boolean;
}

export interface RoomSettings {
  maxParticipants: number;
  expiresInSeconds: number;
  messageRetention: RetentionPolicy;
  fileRetention: RetentionPolicy;
  permissions: RoomPermissions;
}

export interface Participant {
  id: string; // Ephemeral Session ID (UUID v4)
  socketId: string;
  codename: string; // e.g. "Nexus-18", "Mirage-43"
  displayName: string;
  avatarColor: string;
  isHost: boolean;
  joinedAt: number;
  lastActive: number;
  e2eePublicKey?: string;
  mediaState: {
    isMuted: boolean;
    isVideoOff: boolean;
    isScreenSharing: boolean;
    isSpeaking: boolean;
    connectionQuality: ConnectionQuality;
  };
}

export interface Room {
  id: string; // Cryptographic Internal Room UUID
  code: string; // 4-character/digit human room code (e.g. "4829")
  secretHash: string;
  hostSessionId: string;
  createdAt: number;
  expiresAt: number;
  status: RoomStatus;
  settings: RoomSettings;
  participants: Record<string, Participant>;
  mediaSyncState: MediaSyncState;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderCodename: string;
  senderAvatarColor: string;
  encryptedContent?: string;
  iv?: string;
  plaintextFallback?: string;
  type: "text" | "code" | "file" | "system";
  codeLanguage?: string;
  fileMetadata?: FileAttachmentMetadata;
  replyToId?: string;
  replySnippet?: string;
  reactions: Record<string, string[]>;
  createdAt: number;
  editedAt?: number;
  isDeleted?: boolean;
}

export interface FileAttachmentMetadata {
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  category: "image" | "video" | "audio" | "document" | "archive" | "other";
  downloadUrl: string;
  isEncrypted: boolean;
  iv?: string;
  dimensions?: { width: number; height: number };
  duration?: number;
}

export interface MediaTrack {
  id: string;
  title: string;
  artist: string;
  url: string;
  duration: number;
  thumbnail?: string;
  type: "audio" | "video" | "stream" | "spotify";
  spotifyUri?: string;
  uploadedByCodename?: string;
}

export interface MediaSyncState {
  currentTrack: MediaTrack | null;
  isPlaying: boolean;
  positionSeconds: number;
  playbackRate: number;
  serverTimestamp: number;
  version: number;
  queue: MediaTrack[];
  isLockedByHost: boolean;
}

export interface SecurityEvent {
  id: string;
  type: "BRUTE_FORCE_ATTEMPT" | "RATE_LIMIT_HIT" | "UNAUTHORIZED_ACCESS" | "MALICIOUS_UPLOAD_BLOCKED" | "ROOM_EXPIRED" | "ROOM_PURGED";
  timestamp: number;
  ipHash: string;
  roomCode?: string;
  details: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

// WebRTC Signaling Messages
export interface SignalPayload {
  eventId?: string;
  roomId?: string;
  targetParticipantId: string;
  senderParticipantId: string;
  type: "offer" | "answer" | "candidate" | "renegotiate";
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  streamKind?: "camera" | "screen";
  timestamp?: number;
}

export interface AppError {
  id: string;
  source?: "ICE" | "SIGNALING" | "MEDIA" | "SOCKET" | "AUTH" | "SECURITY" | "ROOM";
  code?: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "error" | "critical";
  timestamp: number;
  peerId?: string;
  details?: string;
  actionLabel?: string;
  onAction?: () => void;
}
