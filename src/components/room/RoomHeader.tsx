"use client";

import React, { useState, useEffect } from "react";
import { useRoom } from "../../lib/store/roomStore";
import { formatCountdown } from "../../lib/utils/formatters";
import { Shield, Copy, Check, Lock, Clock, Users, LogOut, Flame, Share2, Settings } from "lucide-react";

interface RoomHeaderProps {
  onOpenPrivacyCenter: () => void;
}

export const RoomHeader: React.FC<RoomHeaderProps> = ({ onOpenPrivacyCenter }) => {
  const { room, currentParticipant, participants, leaveRoom, destroyRoomNow } = useRoom();
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState<string>("...");

  useEffect(() => {
    if (!room?.expiresAt) return;

    const updateTimer = () => {
      setCountdown(formatCountdown(room.expiresAt));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [room?.expiresAt]);

  const handleCopy = () => {
    if (!room?.code) return;
    navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareInvite = () => {
    if (!room?.code) return;
    const url = `${window.location.origin}/room/${room.code}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!room) return null;

  return (
    <header className="w-full bg-surface-100 border-b border-white/10 px-4 py-3 flex items-center justify-between z-20 select-none">
      {/* Left: Brand & Room Code */}
      <div className="flex items-center gap-3">
        <a href="/" className="flex items-center gap-2 text-white font-mono font-bold text-sm tracking-wider">
          <div className="w-7 h-7 rounded-lg bg-surface-200 border border-phantom-cyan/30 flex items-center justify-center text-phantom-cyan">
            <Shield className="w-4 h-4" />
          </div>
          <span className="hidden sm:inline">PHANTOM</span>
        </a>

        <div className="h-4 w-px bg-white/10 mx-1 hidden sm:block" />

        {/* Room Code Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-200 border border-white/10 font-mono text-xs">
          <span className="text-slate-400">ROOM:</span>
          <span className="font-bold text-phantom-cyan tracking-wider">{room.code}</span>
          <button
            onClick={handleCopy}
            className="p-1 text-slate-400 hover:text-white transition rounded ml-0.5"
            title="Copy Room Code"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-phantom-emerald" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={handleShareInvite}
            className="p-1 text-slate-400 hover:text-white transition rounded hidden sm:block"
            title="Copy Shareable Invite Link"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Middle: Security & Expiration status */}
      <div className="hidden md:flex items-center gap-3 font-mono text-xs">
        {/* E2EE Active */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-phantom-cyan/10 border border-phantom-cyan/20 text-phantom-cyan text-[11px]">
          <Lock className="w-3 h-3" />
          <span>E2EE ACTIVE</span>
        </div>

        {/* Expiration Timer */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-200 border border-white/10 text-slate-300 text-[11px]">
          <Clock className="w-3 h-3 text-phantom-amber" />
          <span>EXPIRES: {countdown}</span>
        </div>

        {/* Participants count */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-200 border border-white/10 text-slate-300 text-[11px]">
          <Users className="w-3 h-3 text-phantom-purple" />
          <span>{participants.length} MEMBERS</span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenPrivacyCenter}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-200 border border-white/10 text-xs text-slate-300 hover:text-white hover:border-white/20 transition font-mono"
        >
          <Settings className="w-3.5 h-3.5 text-phantom-cyan" />
          <span className="hidden sm:inline">Privacy Center</span>
        </button>

        {currentParticipant?.isHost && (
          <button
            onClick={() => {
              if (confirm("Destroy this private room immediately? All participants will be disconnected and data purged.")) {
                destroyRoomNow();
              }
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 hover:bg-red-500/20 transition font-mono"
            title="Immediate Room Self-Destruct"
          >
            <Flame className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Self-Destruct</span>
          </button>
        )}

        <button
          onClick={leaveRoom}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-200 border border-white/10 text-xs text-slate-400 hover:text-red-400 hover:border-red-500/30 transition font-mono"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Leave</span>
        </button>
      </div>
    </header>
  );
};
