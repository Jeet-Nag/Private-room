"use client";

import React, { useState, useEffect } from "react";
import { useRoom } from "../../lib/store/roomStore";
import { socketManager } from "../../lib/socket/socketClient";
import { webrtc } from "../../lib/webrtc/webrtcManager";
import { Bug, X, Activity, Radio, Cpu, Layers, Shield, AlertTriangle } from "lucide-react";

export const DebugDiagnosticsOverlay: React.FC = () => {
  const {
    room,
    currentParticipant,
    participants,
    messages,
    attachments,
    mediaSyncState,
    isInCall,
    isMuted,
    isVideoOff,
    isScreenSharing,
    isSpeaking,
    errors,
  } = useRoom();

  const [isOpen, setIsOpen] = useState(false);
  const [rtcDiagnostics, setRtcDiagnostics] = useState<any>(null);
  const [socketStatus, setSocketStatus] = useState<any>(null);

  // Keyboard shortcut: Ctrl + Shift + D
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setRtcDiagnostics(webrtc.getDiagnostics());
      setSocketStatus(socketManager.getStatus());
    }, 500);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-14 right-4 z-40 p-2.5 rounded-xl bg-surface-100/90 hover:bg-surface-100 border border-phantom-cyan/30 text-phantom-cyan shadow-cyan-glow transition backdrop-blur-md"
        title="Toggle Real-Time WebRTC Diagnostics HUD (Ctrl+Shift+D)"
      >
        <Bug className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-h-[88vh] overflow-y-auto bg-surface-100/95 border border-phantom-cyan/40 rounded-2xl p-4 shadow-2xl backdrop-blur-xl font-mono text-xs text-slate-200 select-text">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-phantom-cyan" />
          <span className="font-bold text-white tracking-wider">WEBRTC DIAGNOSTICS</span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1 rounded text-slate-400 hover:text-white transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-3 space-y-3">
        {/* Local Media Telemetry */}
        <div className="p-2.5 rounded-lg bg-surface-200/80 border border-white/5 space-y-1">
          <div className="flex items-center justify-between text-slate-400 font-semibold">
            <span className="flex items-center gap-1.5 text-white">
              <Cpu className="w-3.5 h-3.5 text-phantom-cyan" /> Local Media
            </span>
            <span className={isInCall ? "text-phantom-emerald" : "text-slate-500"}>
              {isInCall ? "CALL ACTIVE" : "IDLE"}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 space-y-0.5">
            <div>Camera: <span className={!isVideoOff ? "text-phantom-emerald font-bold" : "text-red-400"}>{!isVideoOff ? "AVAILABLE" : "DISABLED"}</span> (Tracks: {rtcDiagnostics?.localVideoTracks || 0})</div>
            <div>Microphone: <span className={!isMuted ? "text-phantom-emerald font-bold" : "text-red-400"}>{!isMuted ? "AVAILABLE" : "MUTED"}</span> (Tracks: {rtcDiagnostics?.localAudioTracks || 0})</div>
            <div>Screen Share: <span className={isScreenSharing ? "text-phantom-cyan font-bold" : "text-slate-500"}>{isScreenSharing ? "ACTIVE" : "OFF"}</span></div>
            <div>Voice Activity: <span className={isSpeaking ? "text-phantom-cyan font-bold" : "text-slate-500"}>{isSpeaking ? "SPEAKING" : "SILENT"}</span></div>
          </div>
        </div>

        {/* WebSocket Signaling Telemetry */}
        <div className="p-2.5 rounded-lg bg-surface-200/80 border border-white/5 space-y-1">
          <div className="flex items-center justify-between text-slate-400 font-semibold">
            <span className="flex items-center gap-1.5 text-white">
              <Radio className="w-3.5 h-3.5 text-phantom-cyan" /> WebSocket Signaling
            </span>
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] ${
                socketStatus?.connected ? "bg-phantom-emerald/20 text-phantom-emerald" : "bg-red-500/20 text-red-400"
              }`}
            >
              {socketStatus?.connected ? "CONNECTED" : "DISCONNECTED"}
            </span>
          </div>
          <div className="text-[11px] text-slate-400">
            <div>Socket ID: <span className="text-white">{socketStatus?.id || "none"}</span></div>
            <div>Registered Event Listeners: <span className="text-phantom-cyan font-bold">{socketStatus?.listenerCount || 0}</span></div>
          </div>
        </div>

        {/* WebRTC Peer Connections & Track Mapping */}
        <div className="p-2.5 rounded-lg bg-surface-200/80 border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-slate-400 font-semibold">
            <span className="flex items-center gap-1.5 text-white">
              <Shield className="w-3.5 h-3.5 text-phantom-purple" /> WebRTC Mesh Peers
            </span>
            <span className="text-phantom-purple font-bold">Count: {rtcDiagnostics?.peerCount || 0}</span>
          </div>

          {rtcDiagnostics?.peerStates && Object.keys(rtcDiagnostics.peerStates).length > 0 ? (
            <div className="space-y-1.5">
              {Object.entries(rtcDiagnostics.peerStates).map(([pId, st]: any) => {
                const p = participants.find((part) => part.id === pId);
                return (
                  <div key={pId} className="text-[10px] text-slate-300 bg-surface-300/80 p-2 rounded-lg border border-white/5 space-y-0.5">
                    <div className="font-semibold text-white truncate">
                      • {p?.displayName || p?.codename || pId.slice(0, 8)}
                    </div>
                    <div>PeerConnection: <span className={st.connectionState === "connected" ? "text-phantom-emerald font-bold" : "text-phantom-amber"}>{st.connectionState}</span></div>
                    <div>ICE State: <span className={st.iceState === "connected" || st.iceState === "completed" ? "text-phantom-emerald" : "text-phantom-amber"}>{st.iceState}</span> (Gathering: {st.iceGatheringState})</div>
                    <div>Signaling State: <span className="text-phantom-cyan">{st.signalingState}</span></div>
                    <div>Candidate Types: <span className="text-white font-semibold">{st.candidateTypes.length > 0 ? st.candidateTypes.join(", ") : "gathering..."}</span></div>
                    <div>Remote Tracks: Video: <span className="text-phantom-emerald font-bold">{st.remoteVideoTracks}</span>, Audio: <span className="text-phantom-emerald font-bold">{st.remoteAudioTracks}</span></div>
                    <div>Remote Stream: <span className={st.hasRemoteStream ? "text-phantom-emerald font-bold" : "text-red-400"}>{st.hasRemoteStream ? "AVAILABLE" : "WAITING"}</span></div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-[11px] text-slate-500 py-1">No remote peer connections active.</div>
          )}
        </div>

        {/* Real-Time Errors / Diagnostic Alerts */}
        <div className="p-2.5 rounded-lg bg-surface-200/80 border border-white/5 space-y-1">
          <div className="flex items-center justify-between text-slate-400 font-semibold">
            <span className="flex items-center gap-1.5 text-white">
              <AlertTriangle className="w-3.5 h-3.5 text-phantom-amber" /> Diagnostic Log
            </span>
            <span className={errors.length > 0 ? "text-red-400 font-bold" : "text-phantom-emerald"}>
              Errors: {errors.length}
            </span>
          </div>
          {errors.length > 0 ? (
            <div className="space-y-1 mt-1">
              {errors.map((e) => (
                <div key={e.id} className="text-[10px] text-red-300 bg-red-950/40 p-1.5 rounded border border-red-500/20">
                  <div className="font-bold">[{e.source || "SYSTEM"}] {e.code || e.title}</div>
                  <div>{e.message}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[11px] text-slate-500">Zero active errors. Pipeline healthy.</div>
          )}
        </div>

        {/* Physical Hardware Media Probe */}
        <div className="p-2.5 rounded-lg bg-surface-200/80 border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-slate-400 font-semibold">
            <span className="flex items-center gap-1.5 text-white">
              <Layers className="w-3.5 h-3.5 text-phantom-cyan" /> Hardware Media Probe
            </span>
            <span className="text-[10px] text-slate-400">
              {typeof window !== "undefined" && window.isSecureContext ? "HTTPS (Secure)" : "HTTP (Insecure)"}
            </span>
          </div>

          <button
            onClick={async () => {
              try {
                console.log("[PROBE] Testing enumerateDevices & getUserMedia...");
                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoInputs = devices.filter((d) => d.kind === "videoinput");
                const audioInputs = devices.filter((d) => d.kind === "audioinput");
                console.log(`[PROBE] Detected ${videoInputs.length} video inputs, ${audioInputs.length} audio inputs.`);
                
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                console.log(`[PROBE] getUserMedia SUCCESS: videoTracks=${stream.getVideoTracks().length}, audioTracks=${stream.getAudioTracks().length}`);
                stream.getTracks().forEach((t) => t.stop());
                alert(`Hardware Probe: SUCCESS\nVideo Inputs: ${videoInputs.length}\nAudio Inputs: ${audioInputs.length}\nTracks acquired live.`);
              } catch (err: any) {
                console.error("[PROBE ERROR]", err.name, err.message);
                alert(`Hardware Probe Result:\nException: ${err.name}\nMessage: ${err.message}\nConstraint: ${err.constraint || "none"}`);
              }
            }}
            className="w-full py-1.5 rounded-lg bg-phantom-cyan/20 border border-phantom-cyan/50 text-phantom-cyan font-bold text-[10px] hover:bg-phantom-cyan/30 transition text-center"
          >
            RUN HARDWARE MEDIA PROBE
          </button>
        </div>
      </div>
    </div>
  );
};
