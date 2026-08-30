"use client";

import React, { useState } from "react";
import { useRoom, RoomTab } from "../../lib/store/roomStore";
import { RoomHeader } from "./RoomHeader";
import { ChatPanel } from "../chat/ChatPanel";
import { CallPanel } from "../call/CallPanel";
import { SyncRoomPanel } from "../sync/SyncRoomPanel";
import { MediaGalleryPanel } from "../files/MediaGalleryPanel";
import { PrivacyCenterModal } from "../privacy/PrivacyCenterModal";
import { RoomCore3D } from "../3d/RoomCore3D";
import { DebugDiagnosticsOverlay } from "../debug/DebugDiagnosticsOverlay";
import { ErrorToastContainer } from "../ui/ErrorToastContainer";
import {
  MessageSquare,
  PhoneCall,
  Music,
  FolderLock,
  Shield,
  Users,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Crown,
  Lock,
  Layers,
} from "lucide-react";

export const RoomLayout: React.FC = () => {
  const {
    room,
    currentParticipant,
    participants,
    activeTab,
    setActiveTab,
    isInCall,
    mediaSyncState,
    isDestroyed,
    destroyedReason,
  } = useRoom();

  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);

  if (isDestroyed) {
    return (
      <div className="min-h-screen bg-background text-slate-100 flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-16 h-16 rounded-3xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-4 animate-bounce">
          <Lock className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-white font-mono tracking-tight">ROOM TERMINATED</h1>
        <p className="text-sm text-slate-400 mt-2 max-w-sm font-mono">
          {destroyedReason || "This private ephemeral room no longer exists. All memory has been purged."}
        </p>
        <a
          href="/"
          className="mt-6 px-6 py-3 rounded-xl bg-surface-100 border border-white/15 text-white font-mono text-xs hover:border-phantom-cyan transition"
        >
          RETURN TO HOME
        </a>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-background text-slate-100 flex items-center justify-center font-mono text-xs">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-phantom-cyan border-t-transparent rounded-full animate-spin" />
          <span>CONNECTING TO SECURE ROOM...</span>
        </div>
      </div>
    );
  }

  const coreState = isInCall
    ? "CALL_ACTIVE"
    : mediaSyncState.isPlaying
    ? "MEDIA_PLAYING"
    : participants.length > 1
    ? "PARTICIPANT_JOINED"
    : "ROOM_CREATED";

  return (
    <div className="min-h-screen h-screen flex flex-col bg-background text-slate-100 overflow-hidden font-sans relative">
      {/* Actionable Error Toasts */}
      <ErrorToastContainer />

      {/* Development Diagnostics HUD */}
      <DebugDiagnosticsOverlay />

      {/* Top App Header */}
      <RoomHeader onOpenPrivacyCenter={() => setIsPrivacyOpen(true)} />

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar: Control Surfaces & Navigation */}
        <aside className="hidden lg:flex w-72 flex-col bg-surface-200 border-r border-white/10 select-none">
          {/* Navigation Control Surfaces */}
          <div className="p-3 border-b border-white/10 space-y-1">
            <button
              onClick={() => setActiveTab("chat")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-mono font-medium transition ${
                activeTab === "chat"
                  ? "bg-phantom-cyan/15 border border-phantom-cyan/40 text-phantom-cyan shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Real-Time Chat</span>
            </button>

            <button
              onClick={() => setActiveTab("call")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-mono font-medium transition ${
                activeTab === "call"
                  ? "bg-phantom-purple/15 border border-phantom-purple/40 text-phantom-purple shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-3">
                <PhoneCall className="w-4 h-4" />
                <span>Voice & Video Call</span>
              </div>
              {isInCall && <span className="w-2 h-2 rounded-full bg-phantom-emerald animate-ping" />}
            </button>

            <button
              onClick={() => setActiveTab("sync")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-mono font-medium transition ${
                activeTab === "sync"
                  ? "bg-phantom-blue/15 border border-phantom-blue/40 text-phantom-blue shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-3">
                <Music className="w-4 h-4" />
                <span>Sync Room Media</span>
              </div>
              {mediaSyncState.isPlaying && <span className="w-2 h-2 rounded-full bg-phantom-amber animate-pulse" />}
            </button>

            <button
              onClick={() => setActiveTab("media")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-mono font-medium transition ${
                activeTab === "media"
                  ? "bg-phantom-emerald/15 border border-phantom-emerald/40 text-phantom-emerald shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <FolderLock className="w-4 h-4" />
              <span>Media & Files</span>
            </button>

            <button
              onClick={() => setIsPrivacyOpen(true)}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-mono font-medium text-slate-400 hover:text-white hover:bg-white/5 transition"
            >
              <Shield className="w-4 h-4 text-phantom-cyan" />
              <span>Privacy Center</span>
            </button>
          </div>

          {/* Participants List */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-phantom-cyan" />
                Participants ({participants.length})
              </span>
            </div>

            <div className="space-y-1.5">
              {participants.map((p) => {
                const isMe = p.id === currentParticipant?.id;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-2 rounded-xl border transition ${
                      isMe
                        ? "bg-surface-100 border-phantom-cyan/30 text-white"
                        : "bg-surface-100/50 border-white/5 text-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold font-mono text-white flex-shrink-0"
                        style={{ backgroundColor: p.avatarColor || "#00F2FE" }}
                      >
                        {p.codename.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-mono font-medium truncate">
                            {p.displayName || p.codename}
                          </span>
                          {p.isHost && (
                            <span title="Host">
                              <Crown className="w-3 h-3 text-phantom-amber flex-shrink-0" />
                            </span>
                          )}
                        </div>
                        {isMe && <span className="text-[10px] text-phantom-cyan font-mono">(You)</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {p.mediaState.isMuted ? (
                        <MicOff className="w-3 h-3 text-slate-500" />
                      ) : (
                        <Mic className="w-3 h-3 text-phantom-emerald" />
                      )}
                      {p.mediaState.isVideoOff ? (
                        <VideoOff className="w-3 h-3 text-slate-500" />
                      ) : (
                        <Video className="w-3 h-3 text-phantom-cyan" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3D Room Core Ambient Widget */}
          <div className="p-3 border-t border-white/10 bg-surface-100/40 flex items-center justify-center">
            <div className="flex items-center gap-3">
              <RoomCore3D compact={true} state={coreState} />
              <div className="text-[11px] font-mono">
                <p className="text-white font-semibold">ENCRYPTED LATTICE</p>
                <p className="text-slate-500">State: {coreState}</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Center Panel (Active View) */}
        <main className="flex-1 flex flex-col overflow-hidden bg-surface-300">
          {activeTab === "chat" && <ChatPanel />}
          {activeTab === "call" && <CallPanel />}
          {activeTab === "sync" && <SyncRoomPanel />}
          {activeTab === "media" && <MediaGalleryPanel />}
          {activeTab === "people" && (
            <div className="p-6 max-w-xl mx-auto w-full space-y-4">
              <h3 className="text-base font-bold text-white font-mono">Room Participants ({participants.length})</h3>
              <div className="space-y-2">
                {participants.map((p) => (
                  <div key={p.id} className="p-3 rounded-xl bg-surface-100 border border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold font-mono text-white" style={{ backgroundColor: p.avatarColor }}>
                        {p.codename.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-mono font-medium text-white">{p.displayName || p.codename}</p>
                        <p className="text-[10px] font-mono text-slate-400">{p.isHost ? "Room Host" : "Participant"}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {activeTab === "privacy" && (
            <div className="p-6">
              <PrivacyCenterModal isOpen={true} onClose={() => setActiveTab("chat")} />
            </div>
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="lg:hidden w-full bg-surface-100 border-t border-white/10 px-2 py-2 flex items-center justify-around z-30 select-none">
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex flex-col items-center gap-1 p-1.5 rounded-lg text-[10px] font-mono transition ${
            activeTab === "chat" ? "text-phantom-cyan" : "text-slate-400"
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          <span>Chat</span>
        </button>

        <button
          onClick={() => setActiveTab("call")}
          className={`relative flex flex-col items-center gap-1 p-1.5 rounded-lg text-[10px] font-mono transition ${
            activeTab === "call" ? "text-phantom-purple" : "text-slate-400"
          }`}
        >
          <PhoneCall className="w-5 h-5" />
          <span>Call</span>
          {isInCall && (
            <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-phantom-emerald animate-ping" />
          )}
        </button>

        <button
          onClick={() => setActiveTab("sync")}
          className={`flex flex-col items-center gap-1 p-1.5 rounded-lg text-[10px] font-mono transition ${
            activeTab === "sync" ? "text-phantom-blue" : "text-slate-400"
          }`}
        >
          <Music className="w-5 h-5" />
          <span>Sync</span>
        </button>

        <button
          onClick={() => setActiveTab("media")}
          className={`flex flex-col items-center gap-1 p-1.5 rounded-lg text-[10px] font-mono transition ${
            activeTab === "media" ? "text-phantom-emerald" : "text-slate-400"
          }`}
        >
          <FolderLock className="w-5 h-5" />
          <span>Media</span>
        </button>

        <button
          onClick={() => setIsPrivacyOpen(true)}
          className="flex flex-col items-center gap-1 p-1.5 rounded-lg text-[10px] font-mono text-slate-400 hover:text-white transition"
        >
          <Shield className="w-5 h-5" />
          <span>Privacy</span>
        </button>
      </nav>

      {/* Privacy Center Modal */}
      <PrivacyCenterModal isOpen={isPrivacyOpen} onClose={() => setIsPrivacyOpen(false)} />
    </div>
  );
};
