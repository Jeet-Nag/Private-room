"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRoom } from "../../lib/store/roomStore";
import { formatDuration } from "../../lib/utils/formatters";
import { MediaTrack } from "../../../server/types";
import {
  Play,
  Pause,
  SkipForward,
  Volume2,
  VolumeX,
  Music,
  Plus,
  Trash2,
  Lock,
  Unlock,
  Radio,
  ExternalLink,
} from "lucide-react";

export const SyncRoomPanel: React.FC = () => {
  const {
    currentParticipant,
    mediaSyncState,
    syncPlay,
    syncPause,
    syncSeek,
    syncChangeTrack,
    syncNextTrack,
    syncAddToQueue,
    syncRemoveFromQueue,
    syncToggleLock,
  } = useRoom();

  const [currentLocalPos, setCurrentLocalPos] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newArtist, setNewArtist] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [activeTab, setActiveTab] = useState<"player" | "spotify">("player");

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Synchronize HTML5 Audio Element with Server State
  useEffect(() => {
    if (!audioRef.current || !mediaSyncState.currentTrack) return;
    const audio = audioRef.current;

    // Track changed
    if (audio.src !== mediaSyncState.currentTrack.url) {
      audio.src = mediaSyncState.currentTrack.url;
    }

    // Calculate server authoritative position
    const elapsedSeconds = mediaSyncState.isPlaying
      ? (Date.now() - mediaSyncState.serverTimestamp) / 1000
      : 0;
    const authoritativePos = mediaSyncState.positionSeconds + elapsedSeconds * mediaSyncState.playbackRate;

    // Drift correction: if client is desynced by more than 0.8s, jump to authoritative time
    if (Math.abs(audio.currentTime - authoritativePos) > 0.8) {
      audio.currentTime = authoritativePos;
    }

    // Play or pause
    if (mediaSyncState.isPlaying && audio.paused) {
      audio.play().catch((err) => console.warn("[SYNC] Audio autoplay blocked by browser policy:", err));
    } else if (!mediaSyncState.isPlaying && !audio.paused) {
      audio.pause();
    }
  }, [mediaSyncState]);

  // Local Scrubber ticker
  useEffect(() => {
    const interval = setInterval(() => {
      if (audioRef.current && !isSeeking) {
        setCurrentLocalPos(audioRef.current.currentTime);
      }
    }, 250);
    return () => clearInterval(interval);
  }, [isSeeking]);

  const handlePlayPause = () => {
    if (mediaSyncState.isPlaying) {
      syncPause(currentLocalPos);
    } else {
      syncPlay(currentLocalPos);
    }
  };

  const handleSeekCommit = (pos: number) => {
    setIsSeeking(false);
    syncSeek(pos);
  };

  const handleAddTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newUrl.trim()) return;

    const track: MediaTrack = {
      id: `custom-${Date.now()}`,
      title: newTitle.trim(),
      artist: newArtist.trim() || "Independent Audio",
      url: newUrl.trim(),
      duration: 240,
      type: "audio",
    };

    syncAddToQueue(track);
    setNewTitle("");
    setNewArtist("");
    setNewUrl("");
    setShowAddModal(false);
  };

  const currentTrack = mediaSyncState.currentTrack;
  const isHost = currentParticipant?.isHost;
  const isLocked = mediaSyncState.isLockedByHost;
  const canControl = isHost || !isLocked;

  return (
    <div className="h-full flex flex-col bg-surface-300 select-none overflow-y-auto">
      {/* Hidden authoritative audio tag */}
      <audio
        ref={audioRef}
        onEnded={() => {
          if (canControl) syncNextTrack();
        }}
      />

      {/* Tab Switcher */}
      <div className="p-3 border-b border-white/10 bg-surface-200/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("player")}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition ${
              activeTab === "player"
                ? "bg-phantom-cyan/15 border border-phantom-cyan/30 text-phantom-cyan"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Mode A: Room Media Sync
          </button>
          <button
            onClick={() => setActiveTab("spotify")}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition ${
              activeTab === "spotify"
                ? "bg-phantom-emerald/15 border border-phantom-emerald/30 text-phantom-emerald"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Mode B: Spotify Connect Protocol
          </button>
        </div>

        {/* Host lock status */}
        {isHost && (
          <button
            onClick={syncToggleLock}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono transition ${
              isLocked
                ? "bg-phantom-amber/15 border-phantom-amber/30 text-phantom-amber"
                : "bg-surface-100 border-white/10 text-slate-400 hover:text-white"
            }`}
          >
            {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
            <span>{isLocked ? "Host Locked" : "Collaborative"}</span>
          </button>
        )}
      </div>

      {activeTab === "player" ? (
        <div className="flex-1 p-6 flex flex-col max-w-2xl mx-auto w-full space-y-6">
          {/* NOW PLAYING CARD */}
          <div className="p-6 rounded-3xl bg-surface-100 border border-white/10 shadow-2xl relative overflow-hidden text-center">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-phantom-cyan/10 blur-3xl pointer-events-none" />

            {/* Album artwork */}
            <div className="w-32 h-32 mx-auto rounded-2xl overflow-hidden border border-white/10 shadow-cyan-glow relative flex items-center justify-center bg-surface-200">
              {currentTrack?.thumbnail ? (
                <img
                  src={currentTrack.thumbnail}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Music className="w-12 h-12 text-phantom-cyan animate-pulse" />
              )}
            </div>

            {/* Track metadata */}
            <div className="mt-4">
              <h3 className="text-lg font-bold text-white tracking-tight truncate">
                {currentTrack?.title || "No Track Active"}
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {currentTrack?.artist || "Sync Room"}
              </p>
            </div>

            {/* Scrubber / Progress bar */}
            <div className="mt-6 space-y-1.5">
              <input
                type="range"
                min={0}
                max={currentTrack?.duration || 100}
                value={currentLocalPos}
                disabled={!canControl}
                onChange={(e) => {
                  setIsSeeking(true);
                  setCurrentLocalPos(Number(e.target.value));
                }}
                onMouseUp={(e) => handleSeekCommit(Number((e.target as HTMLInputElement).value))}
                onTouchEnd={(e) => handleSeekCommit(Number((e.target as HTMLInputElement).value))}
                className="w-full h-1.5 bg-surface-300 rounded-lg appearance-none cursor-pointer accent-phantom-cyan disabled:cursor-not-allowed"
              />
              <div className="flex justify-between text-[11px] font-mono text-slate-500">
                <span>{formatDuration(currentLocalPos)}</span>
                <span>{formatDuration(currentTrack?.duration || 0)}</span>
              </div>
            </div>

            {/* Transport Controls */}
            <div className="mt-6 flex items-center justify-center gap-4">
              <button
                onClick={handlePlayPause}
                disabled={!canControl}
                className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-phantom-cyan to-phantom-blue text-phantom-dark font-bold flex items-center justify-center shadow-cyan-glow hover:scale-105 active:scale-95 transition disabled:opacity-40"
              >
                {mediaSyncState.isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
              </button>

              <button
                onClick={() => syncNextTrack()}
                disabled={!canControl}
                className="p-3 rounded-xl bg-surface-200 border border-white/10 text-slate-300 hover:text-white hover:border-white/20 transition disabled:opacity-40"
                title="Next Track"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>

            {/* Volume Control */}
            <div className="mt-6 flex items-center justify-center gap-3 max-w-xs mx-auto">
              <button
                onClick={() => {
                  if (audioRef.current) {
                    audioRef.current.muted = !isMuted;
                    setIsMuted(!isMuted);
                  }
                }}
                className="text-slate-400 hover:text-white"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setVolume(val);
                  if (audioRef.current) {
                    audioRef.current.volume = val;
                    audioRef.current.muted = false;
                    setIsMuted(false);
                  }
                }}
                className="w-28 h-1 bg-surface-300 rounded-lg appearance-none cursor-pointer accent-phantom-cyan"
              />
            </div>
          </div>

          {/* QUEUE & PRESETS */}
          <div className="p-5 rounded-2xl bg-surface-100 border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
                Synchronized Media Queue
              </h4>
              <button
                onClick={() => setShowAddModal(true)}
                disabled={!canControl}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-200 border border-white/10 text-xs font-mono text-phantom-cyan hover:border-phantom-cyan/40 transition disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Track</span>
              </button>
            </div>

            <div className="space-y-2">
              {mediaSyncState.queue.length === 0 ? (
                <p className="text-xs font-mono text-slate-500 text-center py-4">Queue is empty.</p>
              ) : (
                mediaSyncState.queue.map((track, idx) => (
                  <div
                    key={track.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-surface-200 border border-white/5 hover:border-white/10 transition"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <span className="font-mono text-xs text-slate-500">{String(idx + 1).padStart(2, "0")}</span>
                      <div className="truncate">
                        <p className="text-xs font-medium text-white truncate">{track.title}</p>
                        <p className="text-[10px] text-slate-400 font-mono truncate">{track.artist}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => syncChangeTrack(track)}
                        disabled={!canControl}
                        className="px-2 py-1 rounded bg-phantom-cyan/10 text-phantom-cyan text-[11px] font-mono hover:bg-phantom-cyan/20 transition disabled:opacity-40"
                      >
                        Play Now
                      </button>
                      {canControl && (
                        <button
                          onClick={() => syncRemoveFromQueue(track.id)}
                          className="p-1 text-slate-500 hover:text-red-400 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        /* LEGAL SPOTIFY CONNECT INTEGRATION ARCHITECTURE */
        <div className="flex-1 p-6 max-w-2xl mx-auto w-full space-y-6 overflow-y-auto">
          <div className="p-6 rounded-3xl bg-surface-100 border border-phantom-emerald/30 shadow-2xl relative overflow-hidden space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-phantom-emerald/10 border border-phantom-emerald/30 flex items-center justify-center text-phantom-emerald">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Official Spotify Connect Protocol</h3>
                <p className="text-xs text-slate-400 font-mono">Compliant Peer-to-Peer State Synchronization</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Mode 1: Synchronized Controls */}
              <div className="p-4 rounded-2xl bg-surface-200/80 border border-white/5 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-phantom-emerald">
                  <span className="w-2 h-2 rounded-full bg-phantom-emerald animate-pulse" />
                  <span>MODE 1: Dual Premium Auth</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Both desktop PCs authenticate with their own Spotify accounts. Playback commands (<code className="text-[11px] text-phantom-cyan font-mono">play</code>, <code className="text-[11px] text-phantom-cyan font-mono">pause</code>, <code className="text-[11px] text-phantom-cyan font-mono">seek</code>) are synchronized across both Spotify Web Players simultaneously.
                </p>
              </div>

              {/* Mode 2: Single Account Notice */}
              <div className="p-4 rounded-2xl bg-surface-200/80 border border-white/5 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>MODE 2: Single Account Limitation</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Spotify terms strictly forbid audio proxying or rebroadcasting. If one user lacks Spotify, switch to the <strong>Shared Audio Queue</strong> to stream high-fidelity local or hosted audio files legally.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-white font-mono">Spotify Playback Linker</h4>
                  <p className="text-[11px] text-slate-400">Queue a Spotify Track URI to synchronize playback state</p>
                </div>
                <span className="px-2 py-0.5 rounded bg-phantom-emerald/10 border border-phantom-emerald/30 text-[10px] font-mono text-phantom-emerald">
                  READY
                </span>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="spotify:track:6rqhFgbbKwnb9MLmUQDhG6 or track URL"
                  className="flex-1 p-2.5 rounded-xl bg-surface-200 border border-white/10 text-xs text-white focus:outline-none font-mono"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.currentTarget.value) {
                      const uri = e.currentTarget.value.trim();
                      syncChangeTrack({
                        id: `spotify_${Date.now()}`,
                        title: "Spotify Synchronized Track",
                        artist: "Spotify Web Client",
                        url: uri,
                        duration: 180,
                        type: "spotify",
                        spotifyUri: uri,
                      });
                      e.currentTarget.value = "";
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => setActiveTab("player")}
                  className="px-3.5 py-2 rounded-xl bg-surface-200 border border-white/10 text-slate-300 font-mono text-xs hover:border-phantom-cyan transition"
                >
                  USE SHARED PLAYER
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Track Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <form
            onSubmit={handleAddTrack}
            className="w-full max-w-md bg-surface-100 border border-white/15 rounded-2xl p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-base font-semibold text-white">Add Track to Room Queue</h3>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Track Title</label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Cyber Ambient 01"
                className="w-full p-2.5 rounded-lg bg-surface-200 border border-white/10 text-xs text-white focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Artist (Optional)</label>
              <input
                type="text"
                value={newArtist}
                onChange={(e) => setNewArtist(e.target.value)}
                placeholder="e.g. Phantom Sound Lab"
                className="w-full p-2.5 rounded-lg bg-surface-200 border border-white/10 text-xs text-white focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Direct Audio Stream URL (MP3, OGG, WAV)</label>
              <input
                type="url"
                required
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://example.com/audio.mp3"
                className="w-full p-2.5 rounded-lg bg-surface-200 border border-white/10 text-xs text-white focus:outline-none font-mono"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 rounded-lg bg-surface-200 text-slate-400 text-xs font-mono"
              >
                CANCEL
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-lg bg-phantom-cyan text-phantom-dark font-bold text-xs font-mono shadow-cyan-glow"
              >
                ADD TO QUEUE
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
