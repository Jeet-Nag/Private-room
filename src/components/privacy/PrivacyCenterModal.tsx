"use client";

import React, { useState } from "react";
import { useRoom } from "../../lib/store/roomStore";
import { formatCountdown } from "../../lib/utils/formatters";
import {
  X,
  Shield,
  Lock,
  Clock,
  Trash2,
  CheckCircle,
  AlertTriangle,
  UserCheck,
  Zap,
  Flame,
  FileText,
} from "lucide-react";

interface PrivacyCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyCenterModal: React.FC<PrivacyCenterModalProps> = ({ isOpen, onClose }) => {
  const {
    room,
    currentParticipant,
    updateDisplayName,
    destroyRoomNow,
    leaveRoom,
  } = useRoom();

  const [editName, setEditName] = useState(currentParticipant?.displayName || "");
  const [nameSaved, setNameSaved] = useState(false);

  if (!isOpen || !room) return null;

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;
    updateDisplayName(editName.trim());
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
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
              <h2 className="text-lg font-semibold text-white tracking-tight">Privacy & Security Center</h2>
              <p className="text-xs text-slate-400 font-mono">Zero-Trace Ephemeral Session Controls</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-6 space-y-6 overflow-y-auto pr-1 flex-1 text-xs">
          {/* Identity & Codename Editor */}
          <div className="p-4 rounded-xl bg-surface-200 border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-slate-300 uppercase tracking-wider font-semibold">
                Ephemeral Participant Handle
              </span>
              <span className="px-2 py-0.5 rounded bg-phantom-cyan/10 text-phantom-cyan font-mono text-[11px]">
                {currentParticipant?.isHost ? "Room Host" : "Member"}
              </span>
            </div>

            <form onSubmit={handleSaveName} className="flex gap-2">
              <input
                type="text"
                maxLength={20}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Custom Display Name"
                className="flex-1 px-3 py-2 rounded-lg bg-surface-100 border border-white/10 text-white font-mono focus:outline-none focus:border-phantom-cyan/40"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-phantom-cyan text-phantom-dark font-bold font-mono hover:opacity-90 transition"
              >
                {nameSaved ? "SAVED!" : "UPDATE"}
              </button>
            </form>
          </div>

          {/* Cryptographic Security Status */}
          <div className="p-4 rounded-xl bg-surface-200 border border-white/5 space-y-2.5">
            <h4 className="font-mono text-slate-300 uppercase tracking-wider font-semibold">
              Cryptographic Safeguards
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[11px]">
              <div className="p-2.5 rounded-lg bg-surface-100 border border-white/5 flex items-center gap-2 text-slate-300">
                <CheckCircle className="w-4 h-4 text-phantom-emerald flex-shrink-0" />
                <span>AES-GCM-256 Client E2EE</span>
              </div>

              <div className="p-2.5 rounded-lg bg-surface-100 border border-white/5 flex items-center gap-2 text-slate-300">
                <CheckCircle className="w-4 h-4 text-phantom-emerald flex-shrink-0" />
                <span>HMAC-Signed Ephemeral Token</span>
              </div>

              <div className="p-2.5 rounded-lg bg-surface-100 border border-white/5 flex items-center gap-2 text-slate-300">
                <CheckCircle className="w-4 h-4 text-phantom-emerald flex-shrink-0" />
                <span>Client-Side Metadata Stripper</span>
              </div>

              <div className="p-2.5 rounded-lg bg-surface-100 border border-white/5 flex items-center gap-2 text-slate-300">
                <CheckCircle className="w-4 h-4 text-phantom-emerald flex-shrink-0" />
                <span>SHA-256 Hashed IP Telemetry</span>
              </div>
            </div>
          </div>

          {/* Retention & Lifecycle Policies */}
          <div className="p-4 rounded-xl bg-surface-200 border border-white/5 space-y-2 text-slate-300">
            <h4 className="font-mono text-slate-300 uppercase tracking-wider font-semibold mb-1">
              Active Room Configuration
            </h4>
            <div className="flex justify-between py-1 border-b border-white/5 font-mono">
              <span className="text-slate-400">Room Code / Token:</span>
              <span className="text-phantom-cyan font-bold">{room.code}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-white/5 font-mono">
              <span className="text-slate-400">Time Until Auto-Purge:</span>
              <span className="text-phantom-amber">{formatCountdown(room.expiresAt)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-white/5 font-mono">
              <span className="text-slate-400">Message Retention:</span>
              <span className="text-white">{room.settings.messageRetention}</span>
            </div>
            <div className="flex justify-between py-1 font-mono">
              <span className="text-slate-400">Auto-Destroy on Empty:</span>
              <span className="text-phantom-emerald">
                {room.settings.permissions.autoDestroyOnEmpty ? "ACTIVE" : "OFF"}
              </span>
            </div>
          </div>

          {/* Self-Destruct Action */}
          <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/20 space-y-3">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-4 h-4" />
              <h4 className="font-semibold font-mono uppercase">Immediate Room Destruction</h4>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Terminates the room immediately. All active WebSocket connections will be severed, and all ephemeral messages and files will be permanently erased.
            </p>

            <div className="flex gap-2 pt-1">
              {currentParticipant?.isHost ? (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Destroy this room now? This action is irreversible.")) {
                      destroyRoomNow();
                      onClose();
                    }
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold font-mono tracking-wider transition flex items-center justify-center gap-2 shadow-lg"
                >
                  <Flame className="w-4 h-4" />
                  <span>DESTROY ROOM NOW</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    leaveRoom();
                    onClose();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-surface-100 border border-white/10 text-slate-300 hover:text-white font-mono transition"
                >
                  DISCONNECT & LEAVE ROOM
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
