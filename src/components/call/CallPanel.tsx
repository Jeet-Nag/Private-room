"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRoom } from "../../lib/store/roomStore";
import { Participant } from "../../../server/types";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Share2,
  PhoneOff,
  PhoneCall,
  Settings,
  Shield,
  Activity,
  Monitor,
  Volume2,
  VolumeX,
} from "lucide-react";

/**
 * Local Video Tile
 */
const LocalVideoTile: React.FC<{
  currentParticipant: Participant | null;
  localStream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
  isSpeaking: boolean;
  isScreenSharing: boolean;
}> = ({ currentParticipant, localStream, isMuted, isVideoOff, isSpeaking, isScreenSharing }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (localStream) {
      if (videoEl.srcObject !== localStream) {
        console.log("[RTC] Attaching local stream to preview element");
        videoEl.srcObject = localStream;
      }
      videoEl.play().catch((err) => console.warn("[RTC] Local video play error:", err));
    }
  }, [localStream, isVideoOff]);

  return (
    <div
      className={`relative w-full aspect-video rounded-2xl bg-surface-200 border overflow-hidden flex items-center justify-center transition-all ${
        isSpeaking ? "border-phantom-cyan shadow-cyan-glow" : "border-white/10"
      }`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover ${isVideoOff ? "hidden" : "block"}`}
      />

      {isVideoOff && (
        <div className="flex flex-col items-center justify-center gap-2">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold font-mono text-white shadow-lg"
            style={{ backgroundColor: currentParticipant?.avatarColor || "#00F2FE" }}
          >
            {currentParticipant?.codename.slice(0, 2).toUpperCase()}
          </div>
          <span className="text-xs font-mono text-slate-300">Camera Off</span>
        </div>
      )}

      {/* Participant Label & Status */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-[11px] font-mono text-white z-10">
        <span className="truncate">{currentParticipant?.displayName || currentParticipant?.codename} (You)</span>
        <div className="flex items-center gap-1.5">
          {isMuted ? <MicOff className="w-3 h-3 text-red-400" /> : <Mic className="w-3 h-3 text-phantom-emerald" />}
          {isVideoOff && <VideoOff className="w-3 h-3 text-red-400" />}
          {isScreenSharing && <Monitor className="w-3 h-3 text-phantom-cyan" />}
        </div>
      </div>
    </div>
  );
};

/**
 * Remote Video & Audio Tile with Autoplay Resilience
 */
const RemoteVideoTile: React.FC<{
  participant: Participant;
  stream: MediaStream | undefined;
}> = ({ participant, stream }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [videoActive, setVideoActive] = useState(false);

  useEffect(() => {
    const videoEl = videoRef.current;
    const audioEl = audioRef.current;

    if (stream) {
      console.log(`[RTC] Attaching remote stream for ${participant.codename}: tracks=${stream.getTracks().length}`);
      
      if (videoEl && videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }
      if (audioEl && audioEl.srcObject !== stream) {
        audioEl.srcObject = stream;
      }

      // Check if video track is active
      const hasLiveVideo = stream.getVideoTracks().some((t) => t.enabled && t.readyState === "live");
      setVideoActive(hasLiveVideo);

      videoEl?.play().catch((err) => {
        console.warn(`[RTC] Remote video playback error for ${participant.codename}:`, err);
      });

      audioEl?.play().catch((err) => {
        console.warn(`[RTC] Remote audio autoplay blocked for ${participant.codename}:`, err);
        setAudioBlocked(true);
      });
    }
  }, [stream, participant.codename]);

  const isSharing = participant.mediaState.isScreenSharing;
  const isVideoAllowed = !participant.mediaState.isVideoOff || isSharing || videoActive;

  return (
    <div
      className={`relative w-full aspect-video rounded-2xl bg-surface-200 border overflow-hidden flex items-center justify-center transition-all ${
        participant.mediaState.isSpeaking ? "border-phantom-purple shadow-purple-glow" : "border-white/10"
      }`}
    >
      {/* Hidden dedicated audio element for crystal-clear WebRTC audio */}
      <audio ref={audioRef} autoPlay playsInline />

      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full ${isSharing ? "object-contain bg-black" : "object-cover"} ${
          isVideoAllowed ? "block" : "hidden"
        }`}
      />

      {/* Autoplay Unblock Action Prompt */}
      {audioBlocked && (
        <button
          onClick={() => {
            audioRef.current?.play().then(() => setAudioBlocked(false));
          }}
          className="absolute inset-0 z-30 bg-black/80 flex flex-col items-center justify-center text-xs font-mono text-phantom-cyan p-4 text-center gap-2"
        >
          <Volume2 className="w-6 h-6 animate-bounce" />
          <span>CLICK TO UNBLOCK REMOTE AUDIO</span>
        </button>
      )}

      {/* Screen Sharing Badge */}
      {isSharing && (
        <div className="absolute top-2 left-2 z-10 bg-phantom-cyan/20 border border-phantom-cyan/50 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono text-phantom-cyan flex items-center gap-1.5 shadow-md">
          <Monitor className="w-3 h-3" />
          <span>SCREEN SHARING</span>
        </div>
      )}

      {/* Camera Off Avatar Fallback */}
      {!isVideoAllowed && (
        <div className="flex flex-col items-center justify-center gap-2">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold font-mono text-white shadow-lg"
            style={{ backgroundColor: participant.avatarColor || "#9D4EDD" }}
          >
            {participant.codename.slice(0, 2).toUpperCase()}
          </div>
          <span className="text-xs font-mono text-slate-300">{participant.displayName || participant.codename}</span>
        </div>
      )}

      {/* Participant Label & Status */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-[11px] font-mono text-white z-10">
        <span className="truncate">{participant.displayName || participant.codename}</span>
        <div className="flex items-center gap-1.5">
          {participant.mediaState.isMuted ? (
            <MicOff className="w-3 h-3 text-red-400" />
          ) : (
            <Mic className="w-3 h-3 text-phantom-emerald" />
          )}
          {participant.mediaState.isVideoOff && !isSharing && <VideoOff className="w-3 h-3 text-red-400" />}
          {isSharing && <Monitor className="w-3 h-3 text-phantom-cyan" />}
        </div>
      </div>
    </div>
  );
};

export const CallPanel: React.FC = () => {
  const {
    currentParticipant,
    participants,
    isInCall,
    isMuted,
    isVideoOff,
    isScreenSharing,
    isSpeaking,
    localStream,
    remoteStreams,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    startCall,
    leaveCall,
  } = useRoom();

  const [showDeviceSettings, setShowDeviceSettings] = useState(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState<string>("");
  const [selectedVideoInput, setSelectedVideoInput] = useState<string>("");

  useEffect(() => {
    if (navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        setAudioDevices(devices.filter((d) => d.kind === "audioinput"));
        setVideoDevices(devices.filter((d) => d.kind === "videoinput"));
      });
    }
  }, []);

  const isInsecureContext = typeof window !== "undefined" && !window.isSecureContext && location.hostname !== "localhost" && location.hostname !== "127.0.0.1";

  if (!isInCall) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 bg-surface-300 text-center">
        {isInsecureContext && (
          <div className="mb-6 max-w-md p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono space-y-2 text-left">
            <div className="flex items-center gap-2 font-bold text-amber-400">
              <Shield className="w-4 h-4 text-amber-400" />
              <span>INSECURE CONTEXT DETECTED (HTTP)</span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-200/90">
              Desktop browsers restrict camera and microphone access on remote LAN IP addresses unless accessed via secure HTTPS.
            </p>
            <button
              onClick={() => {
                window.location.href = `https://${location.hostname}:${location.port || 3000}${location.pathname}`;
              }}
              className="mt-2 w-full py-2 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs font-mono hover:bg-amber-300 transition"
            >
              SWITCH TO HTTPS (PORT {location.port || 3000})
            </button>
          </div>
        )}

        <div className="w-16 h-16 rounded-3xl bg-surface-100 border border-phantom-cyan/30 flex items-center justify-center text-phantom-cyan shadow-cyan-glow mb-4">
          <PhoneCall className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">Private Voice, Video & Screen Mesh</h2>
        <p className="text-xs text-slate-400 mt-1 max-w-sm">
          Connect directly via WebRTC peer streams with active speaker detection and device isolation.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => {
              console.log("[CALL BUTTON] CLICKED");
              startCall();
            }}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-phantom-cyan via-phantom-blue to-phantom-purple text-phantom-dark font-bold text-sm tracking-wide shadow-cyan-glow hover:opacity-95 active:scale-95 transition flex items-center justify-center gap-2"
          >
            <PhoneCall className="w-4 h-4" />
            <span>JOIN CALL NOW</span>
          </button>
        </div>

        <div className="mt-8 flex items-center gap-6 text-xs text-slate-500 font-mono">
          <span className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-phantom-emerald" /> Encrypted in Transit (TLS/WSS)
          </span>
          <span className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-phantom-cyan" /> Zero Network Leakage
          </span>
        </div>
      </div>
    );
  }

  const remoteParticipants = participants.filter((p) => p.id !== currentParticipant?.id);

  return (
    <div className="relative h-full flex flex-col bg-surface-400 overflow-hidden select-none">
      {/* Screen Sharing Active Banner */}
      {isScreenSharing && (
        <div className="w-full bg-phantom-blue/20 border-b border-phantom-blue/40 px-4 py-2 flex items-center justify-between z-10">
          <div className="flex items-center gap-2 text-xs font-mono text-phantom-cyan">
            <span className="w-2 h-2 rounded-full bg-phantom-cyan animate-ping" />
            <span>YOU ARE SHARING YOUR SCREEN</span>
          </div>
          <button
            onClick={toggleScreenShare}
            className="px-3 py-1 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-mono hover:bg-red-500/30 transition"
          >
            STOP SHARING
          </button>
        </div>
      )}

      {/* Video Tile Grid */}
      <div className="flex-1 p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 overflow-y-auto items-center justify-center">
        {/* Local Participant Tile */}
        <LocalVideoTile
          currentParticipant={currentParticipant}
          localStream={localStream}
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          isSpeaking={isSpeaking}
          isScreenSharing={isScreenSharing}
        />

        {/* Remote Participants Video Tiles */}
        {remoteParticipants.map((p) => (
          <RemoteVideoTile key={p.id} participant={p} stream={remoteStreams[p.id]} />
        ))}
      </div>

      {/* Floating Call Action Controls Bar */}
      <div className="p-4 bg-surface-200/90 border-t border-white/10 flex items-center justify-between">
        {/* Connection Quality indicator */}
        <div className="hidden sm:flex items-center gap-2 font-mono text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-phantom-emerald animate-pulse" />
          <span>CONNECTED ● WebRTC Mesh</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-3 mx-auto sm:mx-0">
          {/* Mute Toggle */}
          <button
            onClick={toggleMute}
            className={`p-3 rounded-xl border transition ${
              isMuted
                ? "bg-red-500/20 border-red-500 text-red-400"
                : "bg-surface-100 border-white/10 text-white hover:border-phantom-cyan/40"
            }`}
            title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Video Toggle */}
          <button
            onClick={toggleVideo}
            className={`p-3 rounded-xl border transition ${
              isVideoOff
                ? "bg-red-500/20 border-red-500 text-red-400"
                : "bg-surface-100 border-white/10 text-white hover:border-phantom-cyan/40"
            }`}
            title={isVideoOff ? "Turn On Camera" : "Turn Off Camera"}
          >
            {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>

          {/* Screen Share */}
          <button
            onClick={toggleScreenShare}
            className={`p-3 rounded-xl border transition ${
              isScreenSharing
                ? "bg-phantom-cyan/20 border-phantom-cyan text-phantom-cyan shadow-cyan-glow"
                : "bg-surface-100 border-white/10 text-white hover:border-phantom-cyan/40"
            }`}
            title={isScreenSharing ? "Stop Sharing Screen" : "Share Screen"}
          >
            <Share2 className="w-5 h-5" />
          </button>

          {/* Settings */}
          <button
            onClick={() => setShowDeviceSettings(true)}
            className="p-3 rounded-xl bg-surface-100 border border-white/10 text-slate-300 hover:text-white hover:border-white/20 transition"
            title="Audio & Video Settings"
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* End Call */}
          <button
            onClick={leaveCall}
            className="p-3 rounded-xl bg-red-600 hover:bg-red-500 text-white shadow-lg transition"
            title="Leave Call"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Device Settings Modal */}
      {showDeviceSettings && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-surface-100 border border-white/15 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-white">Audio & Video Devices</h3>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Microphone</label>
              <select
                value={selectedAudioInput}
                onChange={(e) => setSelectedAudioInput(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-surface-200 border border-white/10 text-xs text-white focus:outline-none"
              >
                {audioDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Microphone ${d.deviceId.slice(0, 5)}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Camera</label>
              <select
                value={selectedVideoInput}
                onChange={(e) => setSelectedVideoInput(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-surface-200 border border-white/10 text-xs text-white focus:outline-none"
              >
                {videoDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera ${d.deviceId.slice(0, 5)}`}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setShowDeviceSettings(false)}
              className="w-full py-2.5 rounded-lg bg-phantom-cyan text-phantom-dark font-bold text-xs"
            >
              SAVE SETTINGS
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
