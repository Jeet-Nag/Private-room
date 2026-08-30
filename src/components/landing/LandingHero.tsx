"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { RoomCore3D } from "../3d/RoomCore3D";
import { CreateRoomModal } from "./CreateRoomModal";
import { JoinRoomModal } from "./JoinRoomModal";
import { Shield, KeyRound, Lock, EyeOff, Music, Video, FileText, Zap, Sparkles, ArrowRight } from "lucide-react";

export const LandingHero: React.FC = () => {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);

  const handleSessionStarted = (data: { room: any; participant: any; sessionToken: string }) => {
    // Store session info in sessionStorage
    sessionStorage.setItem(`phantom_session_${data.room.id}`, JSON.stringify(data));
    sessionStorage.setItem(`phantom_token_${data.room.id}`, data.sessionToken);
    router.push(`/room/${data.room.code}`);
  };

  return (
    <div className="relative min-h-screen flex flex-col bg-background text-slate-100 selection:bg-phantom-cyan selection:text-phantom-dark overflow-hidden">
      {/* Background cyber grid & glow atmosphere */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#161B22_1px,transparent_1px),linear-gradient(to_bottom,#161B22_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-phantom-cyan/15 via-phantom-purple/15 to-transparent blur-[120px] pointer-events-none" />

      {/* Navigation Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-surface-100 border border-phantom-cyan/40 flex items-center justify-center shadow-cyan-glow">
            <Shield className="w-5 h-5 text-phantom-cyan" />
          </div>
          <div>
            <span className="font-mono font-black tracking-widest text-lg text-white">PHANTOM<span className="text-phantom-cyan">.ROOM</span></span>
            <span className="hidden sm:inline-block ml-2 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded-full bg-phantom-cyan/10 border border-phantom-cyan/30 text-phantom-cyan">
              E2EE Active
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <a
            href="/admin/security"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-100 border border-white/10 text-slate-300 hover:text-white hover:border-phantom-cyan/40 transition"
          >
            <Lock className="w-3.5 h-3.5 text-phantom-cyan" />
            <span>Security Telemetry</span>
          </a>
          <button
            onClick={() => setIsJoinOpen(true)}
            className="px-4 py-2 rounded-lg bg-surface-100 border border-white/15 text-slate-200 hover:border-phantom-purple/50 hover:text-white transition font-medium"
          >
            Join Room
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 rounded-lg bg-phantom-cyan text-phantom-dark font-bold hover:shadow-cyan-glow transition"
          >
            Create Room
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto px-6 py-12 text-center">
        {/* Top badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-100 border border-white/10 text-slate-300 text-xs font-mono mb-6 backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-phantom-cyan animate-pulse" />
          <span>ZERO-REGISTRATION REAL-TIME PROTOCOL</span>
        </div>

        <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.1] text-white">
          PRIVATE
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-phantom-cyan via-white to-phantom-purple">
            WITHOUT THE PHONE NUMBER.
          </span>
        </h1>

        <p className="mt-6 text-base sm:text-lg md:text-xl text-slate-400 max-w-2xl font-light">
          Create an ephemeral room. Share a 4-digit code. Talk with voice, video, files, and synchronized media. Disappears when you are done.
        </p>

        {/* 3D Visualizer Core */}
        <div className="my-6 relative flex items-center justify-center">
          <RoomCore3D compact={false} isEncrypted={true} />
        </div>

        {/* CTA Button Group */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-md">
          <button
            onClick={() => setIsCreateOpen(true)}
            className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-phantom-cyan via-phantom-blue to-phantom-purple text-phantom-dark font-bold text-base tracking-wide hover:opacity-95 active:scale-[0.99] transition shadow-cyan-glow flex items-center justify-center gap-2"
          >
            <span>CREATE PRIVATE ROOM</span>
            <ArrowRight className="w-5 h-5" />
          </button>

          <button
            onClick={() => setIsJoinOpen(true)}
            className="w-full py-4 px-6 rounded-xl bg-surface-100 border border-white/15 text-white font-semibold text-base hover:border-phantom-purple/50 hover:bg-surface-50 transition flex items-center justify-center gap-2"
          >
            <KeyRound className="w-5 h-5 text-phantom-purple" />
            <span>ENTER ROOM CODE</span>
          </button>
        </div>

        {/* Trust Indicators */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 w-full text-left">
          <div className="p-4 rounded-xl bg-surface-100/60 border border-white/5 backdrop-blur-sm">
            <EyeOff className="w-5 h-5 text-phantom-cyan mb-2" />
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">No Phone / Profile</h3>
            <p className="text-xs text-slate-400 mt-1">Random phantom codenames. Zero email or phone requirement.</p>
          </div>

          <div className="p-4 rounded-xl bg-surface-100/60 border border-white/5 backdrop-blur-sm">
            <Lock className="w-5 h-5 text-phantom-purple mb-2" />
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">Client-Side E2EE</h3>
            <p className="text-xs text-slate-400 mt-1">AES-GCM-256 Web Crypto primitives. Server stores ciphertext.</p>
          </div>

          <div className="p-4 rounded-xl bg-surface-100/60 border border-white/5 backdrop-blur-sm">
            <Zap className="w-5 h-5 text-phantom-blue mb-2" />
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">WebRTC Mesh & Calls</h3>
            <p className="text-xs text-slate-400 mt-1">Voice, camera, and native screen sharing with connection meters.</p>
          </div>

          <div className="p-4 rounded-xl bg-surface-100/60 border border-white/5 backdrop-blur-sm">
            <Music className="w-5 h-5 text-phantom-emerald mb-2" />
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">Authoritative Sync</h3>
            <p className="text-xs text-slate-400 mt-1">Shared media clock with drift correction and collaborative queues.</p>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="mt-16 text-left w-full">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Built as Private Digital Infrastructure</h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 font-mono">Everything designed for strict isolation and instant disposal.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-surface-100 border border-white/10 hover:border-phantom-cyan/30 transition">
              <div className="w-10 h-10 rounded-lg bg-phantom-cyan/10 border border-phantom-cyan/20 flex items-center justify-center text-phantom-cyan mb-4">
                <Video className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-white">Voice, Video & Screen Sharing</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Peer-to-peer WebRTC channels with active speaker waveforms, mute controls, camera toggles, and device selectors. No IP addresses leaked in application UI.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-surface-100 border border-white/10 hover:border-phantom-purple/30 transition">
              <div className="w-10 h-10 rounded-lg bg-phantom-purple/10 border border-phantom-purple/20 flex items-center justify-center text-phantom-purple mb-4">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-white">Metadata-Stripped File Sharing</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Client-side canvas re-encoding strips GPS coordinates and EXIF tags before upload. Magic-byte verification rejects disguised executables with signed short-lived download tokens.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-surface-100 border border-white/10 hover:border-phantom-emerald/30 transition">
              <div className="w-10 h-10 rounded-lg bg-phantom-emerald/10 border border-phantom-emerald/20 flex items-center justify-center text-phantom-emerald mb-4">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-white">Anti-Brute Force Protection</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                4-digit room codes backed by 256-bit cryptographic room UUIDs, token-bucket throttling, exponential lockouts, timing-safe evaluation, and generic non-leaking error responses.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full border-t border-white/10 py-8 px-6 text-center font-mono text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 PHANTOM ROOM. Privacy-First Ephemeral Communications.</p>
          <div className="flex items-center gap-6">
            <a href="/privacy" className="hover:text-slate-300 transition">Zero-Log Privacy Policy</a>
            <a href="/terms" className="hover:text-slate-300 transition">Terms of Service</a>
            <a href="/security" className="hover:text-slate-300 transition">Security Whitepaper</a>
            <a href="/admin/security" className="hover:text-phantom-cyan transition">Security Telemetry</a>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <CreateRoomModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onRoomCreated={handleSessionStarted}
      />

      <JoinRoomModal
        isOpen={isJoinOpen}
        onClose={() => setIsJoinOpen(false)}
        onJoinSuccess={handleSessionStarted}
      />
    </div>
  );
};
