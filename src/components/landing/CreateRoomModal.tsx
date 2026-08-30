"use client";

import React, { useState } from "react";
import { X, Shield, Lock, Clock, Users, Copy, Check, Sparkles, ArrowRight, Video, Mic, Share2, FileText, Music } from "lucide-react";
import { RoomSettings } from "../../../server/types";

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoomCreated: (data: { room: any; participant: any; sessionToken: string }) => void;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({ isOpen, onClose, onRoomCreated }) => {
  const [expiresInSeconds, setExpiresInSeconds] = useState<number>(3600); // 1 hr default
  const [maxParticipants, setMaxParticipants] = useState<number>(8);
  const [messageRetention, setMessageRetention] = useState<"SESSION_ONLY" | "24_HOURS" | "7_DAYS">("SESSION_ONLY");
  const [allowFileSharing, setAllowFileSharing] = useState<boolean>(true);
  const [allowScreenShare, setAllowScreenShare] = useState<boolean>(true);
  const [allowMicrophone, setAllowMicrophone] = useState<boolean>(true);
  const [allowCamera, setAllowCamera] = useState<boolean>(true);
  const [allowMediaSync, setAllowMediaSync] = useState<boolean>(true);
  const [autoDestroyOnEmpty, setAutoDestroyOnEmpty] = useState<boolean>(true);
  const [passphrase, setPassphrase] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [createdResult, setCreatedResult] = useState<{ room: any; participant: any; sessionToken: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreate = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        settings: {
          expiresInSeconds,
          maxParticipants,
          messageRetention,
          fileRetention: messageRetention,
          permissions: {
            allowMicrophone,
            allowCamera,
            allowScreenShare,
            allowFileSharing,
            allowMediaSync,
            allowNewParticipants: true,
            autoDestroyOnEmpty,
            requireE2EE: true,
          },
        },
        passphrase: passphrase.trim() || undefined,
      };

      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create private room.");
      }

      setCreatedResult(data);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCode = () => {
    if (!createdResult) return;
    navigator.clipboard.writeText(createdResult.room.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    if (!createdResult) return;
    const url = `${window.location.origin}/room/${createdResult.room.code}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleEnterRoom = () => {
    if (createdResult) {
      onRoomCreated(createdResult);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-surface-100 border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Glow ambient */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-phantom-cyan/10 blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-phantom-cyan/10 border border-phantom-cyan/30 text-phantom-cyan">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white tracking-tight">Create Private Room</h2>
              <p className="text-xs text-slate-400">Configure ephemeral security parameters</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-center gap-2">
            <span>{error}</span>
          </div>
        )}

        {!createdResult ? (
          <div className="mt-6 space-y-6 overflow-y-auto pr-1 flex-1">
            {/* Expiration selection */}
            <div>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-300 uppercase tracking-wider mb-2">
                <Clock className="w-3.5 h-3.5 text-phantom-cyan" />
                Room Expiration Time
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "10 Min", value: 600 },
                  { label: "1 Hour", value: 3600 },
                  { label: "24 Hours", value: 86400 },
                  { label: "7 Days", value: 604800 },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setExpiresInSeconds(item.value)}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border transition ${
                      expiresInSeconds === item.value
                        ? "bg-phantom-cyan/15 border-phantom-cyan text-phantom-cyan shadow-sm"
                        : "bg-surface-200 border-white/5 text-slate-400 hover:border-white/20 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Max Participants */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-300 uppercase tracking-wider">
                  <Users className="w-3.5 h-3.5 text-phantom-purple" />
                  Max Capacity
                </label>
                <span className="text-xs font-mono text-phantom-purple">{maxParticipants} Members</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[2, 4, 8, 16].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setMaxParticipants(count)}
                    className={`py-2 text-xs font-medium rounded-lg border transition ${
                      maxParticipants === count
                        ? "bg-phantom-purple/15 border-phantom-purple text-phantom-purple"
                        : "bg-surface-200 border-white/5 text-slate-400 hover:border-white/20"
                    }`}
                  >
                    {count} Participants
                  </button>
                ))}
              </div>
            </div>

            {/* Permissions Matrix */}
            <div>
              <label className="text-xs font-medium text-slate-300 uppercase tracking-wider block mb-2.5">
                Room Capabilities & Controls
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <label className="flex items-center justify-between p-3 rounded-lg bg-surface-200 border border-white/5 cursor-pointer hover:border-white/10 transition">
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4 text-slate-400" />
                    <span className="text-xs text-slate-200">Voice Calling</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowMicrophone}
                    onChange={(e) => setAllowMicrophone(e.target.checked)}
                    className="accent-phantom-cyan w-4 h-4 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-lg bg-surface-200 border border-white/5 cursor-pointer hover:border-white/10 transition">
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-slate-400" />
                    <span className="text-xs text-slate-200">Video Calling</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowCamera}
                    onChange={(e) => setAllowCamera(e.target.checked)}
                    className="accent-phantom-cyan w-4 h-4 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-lg bg-surface-200 border border-white/5 cursor-pointer hover:border-white/10 transition">
                  <div className="flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-slate-400" />
                    <span className="text-xs text-slate-200">Screen Sharing</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowScreenShare}
                    onChange={(e) => setAllowScreenShare(e.target.checked)}
                    className="accent-phantom-cyan w-4 h-4 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-lg bg-surface-200 border border-white/5 cursor-pointer hover:border-white/10 transition">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <span className="text-xs text-slate-200">File Sharing</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowFileSharing}
                    onChange={(e) => setAllowFileSharing(e.target.checked)}
                    className="accent-phantom-cyan w-4 h-4 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-lg bg-surface-200 border border-white/5 cursor-pointer hover:border-white/10 transition">
                  <div className="flex items-center gap-2">
                    <Music className="w-4 h-4 text-slate-400" />
                    <span className="text-xs text-slate-200">Synchronized Media</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowMediaSync}
                    onChange={(e) => setAllowMediaSync(e.target.checked)}
                    className="accent-phantom-cyan w-4 h-4 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-lg bg-surface-200 border border-white/5 cursor-pointer hover:border-white/10 transition">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-slate-400" />
                    <span className="text-xs text-slate-200">Auto-Destroy on Empty</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoDestroyOnEmpty}
                    onChange={(e) => setAutoDestroyOnEmpty(e.target.checked)}
                    className="accent-phantom-cyan w-4 h-4 rounded"
                  />
                </label>
              </div>
            </div>

            {/* Optional Passphrase */}
            <div>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-300 uppercase tracking-wider mb-2">
                <Lock className="w-3.5 h-3.5 text-phantom-blue" />
                Optional Passphrase Lock
              </label>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Leave blank for open code access"
                className="w-full px-3.5 py-2.5 rounded-lg bg-surface-200 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-phantom-cyan/50 focus:ring-1 focus:ring-phantom-cyan/50 transition font-mono"
              />
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleCreate}
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-phantom-cyan to-phantom-blue text-phantom-dark font-semibold text-sm tracking-wide hover:opacity-95 active:scale-[0.99] transition flex items-center justify-center gap-2 shadow-cyan-glow disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-phantom-dark border-t-transparent rounded-full animate-spin" />
                    <span>INITIALIZING ENCRYPTED ROOM...</span>
                  </>
                ) : (
                  <>
                    <span>CREATE PRIVATE ROOM</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Room Created Success State */
          <div className="mt-6 space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 rounded-2xl bg-surface-200 border border-phantom-cyan/30 text-center relative overflow-hidden">
              <div className="text-[11px] uppercase tracking-widest text-slate-400 font-mono mb-1">
                HUMAN ROOM CODE
              </div>
              <div className="text-4xl font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-phantom-cyan via-white to-phantom-purple font-mono py-1 select-all">
                {createdResult.room.code}
              </div>
              <div className="text-[11px] text-phantom-emerald font-mono mt-1 flex items-center justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-phantom-emerald animate-ping" />
                <span>EPHEMERAL ENCRYPTION ACTIVE</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleCopyCode}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-surface-200 border border-white/10 text-xs font-medium text-slate-300 hover:text-white hover:border-white/20 transition"
              >
                {copiedCode ? <Check className="w-4 h-4 text-phantom-emerald" /> : <Copy className="w-4 h-4" />}
                <span>{copiedCode ? "CODE COPIED" : "COPY CODE"}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyLink}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-surface-200 border border-white/10 text-xs font-medium text-slate-300 hover:text-white hover:border-white/20 transition"
              >
                {copiedLink ? <Check className="w-4 h-4 text-phantom-emerald" /> : <Share2 className="w-4 h-4" />}
                <span>{copiedLink ? "LINK COPIED" : "SHARE INVITE"}</span>
              </button>
            </div>

            <div className="p-3 rounded-xl bg-phantom-cyan/5 border border-phantom-cyan/20 text-left text-xs text-slate-300 space-y-1">
              <p className="text-white font-medium">Identity Assigned: <span className="font-mono text-phantom-cyan">{createdResult.participant.codename}</span></p>
              <p className="text-slate-400 text-[11px]">No personal data, email, or phone numbers are linked to this room.</p>
            </div>

            <button
              type="button"
              onClick={handleEnterRoom}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-phantom-cyan via-phantom-blue to-phantom-purple text-white font-bold text-sm tracking-wider hover:opacity-95 active:scale-[0.99] transition shadow-cyan-glow flex items-center justify-center gap-2"
            >
              <span>ENTER PRIVATE ROOM</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
