import crypto from "crypto";
import { MediaTrack, MediaSyncState } from "../types";
import { roomService } from "./roomService";

// Built-in Curated Legal / Royalty-Free Ambient Cyber Tracks for Instant Sync
export const DEFAULT_LEGAL_TRACKS: MediaTrack[] = [
  {
    id: "track-phantom-core",
    title: "Obsidian Lattice (Cyber Ambient)",
    artist: "Phantom Sound Lab",
    url: "https://actions.google.com/sounds/v1/science_fiction/scifi_engine_hum_subtle.ogg",
    duration: 184,
    thumbnail: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&auto=format&fit=crop&q=60",
    type: "audio",
  },
  {
    id: "track-synthetic-pulse",
    title: "Quantum Drift (Deep Focus)",
    artist: "Zero Day Project",
    url: "https://actions.google.com/sounds/v1/science_fiction/teleport_whoosh_pulse.ogg",
    duration: 215,
    thumbnail: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=300&auto=format&fit=crop&q=60",
    type: "audio",
  },
  {
    id: "track-neural-network",
    title: "Sub-Zero Frequency (Darkwave)",
    artist: "Cipher Systems",
    url: "https://actions.google.com/sounds/v1/science_fiction/alien_spaceship_drone.ogg",
    duration: 260,
    thumbnail: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=300&auto=format&fit=crop&q=60",
    type: "audio",
  },
];

export class MediaSyncEngine {
  /**
   * Calculate exact authoritative playback position considering elapsed time
   */
  public getCalculatedPosition(state: MediaSyncState): number {
    if (!state.isPlaying || !state.currentTrack) {
      return state.positionSeconds;
    }

    const elapsedSeconds = (Date.now() - state.serverTimestamp) / 1000;
    const computedPosition = state.positionSeconds + elapsedSeconds * state.playbackRate;

    if (state.currentTrack.duration > 0 && computedPosition >= state.currentTrack.duration) {
      return state.currentTrack.duration;
    }

    return Math.max(0, computedPosition);
  }

  /**
   * Initialize sync state for a new room
   */
  public initializeRoomMedia(roomId: string): MediaSyncState {
    const room = roomService.getRoom(roomId);
    const initialTrack = DEFAULT_LEGAL_TRACKS[0];
    const queue = [...DEFAULT_LEGAL_TRACKS.slice(1)];

    const syncState: MediaSyncState = {
      currentTrack: initialTrack,
      isPlaying: false,
      positionSeconds: 0,
      playbackRate: 1.0,
      serverTimestamp: Date.now(),
      version: 1,
      queue,
      isLockedByHost: false,
    };

    if (room) {
      room.mediaSyncState = syncState;
    }

    return syncState;
  }

  /**
   * Play media command
   */
  public play(roomId: string, fromPosition?: number): MediaSyncState | null {
    const room = roomService.getRoom(roomId);
    if (!room || !room.mediaSyncState.currentTrack) return null;

    const state = room.mediaSyncState;
    const now = Date.now();
    const position = fromPosition !== undefined ? fromPosition : this.getCalculatedPosition(state);

    state.isPlaying = true;
    state.positionSeconds = position;
    state.serverTimestamp = now;
    state.version += 1;

    return { ...state };
  }

  /**
   * Pause media command
   */
  public pause(roomId: string, atPosition?: number): MediaSyncState | null {
    const room = roomService.getRoom(roomId);
    if (!room || !room.mediaSyncState.currentTrack) return null;

    const state = room.mediaSyncState;
    const now = Date.now();
    const position = atPosition !== undefined ? atPosition : this.getCalculatedPosition(state);

    state.isPlaying = false;
    state.positionSeconds = position;
    state.serverTimestamp = now;
    state.version += 1;

    return { ...state };
  }

  /**
   * Seek media command
   */
  public seek(roomId: string, targetPosition: number): MediaSyncState | null {
    const room = roomService.getRoom(roomId);
    if (!room || !room.mediaSyncState.currentTrack) return null;

    const state = room.mediaSyncState;
    const now = Date.now();
    const maxDur = state.currentTrack?.duration || 99999;
    const boundedPos = Math.max(0, Math.min(targetPosition, maxDur));

    state.positionSeconds = boundedPos;
    state.serverTimestamp = now;
    state.version += 1;

    return { ...state };
  }

  /**
   * Change current track
   */
  public changeTrack(roomId: string, track: MediaTrack): MediaSyncState | null {
    const room = roomService.getRoom(roomId);
    if (!room) return null;

    const state = room.mediaSyncState;
    const now = Date.now();

    state.currentTrack = track;
    state.positionSeconds = 0;
    state.isPlaying = true;
    state.serverTimestamp = now;
    state.version += 1;

    return { ...state };
  }

  /**
   * Next track in queue
   */
  public nextTrack(roomId: string): MediaSyncState | null {
    const room = roomService.getRoom(roomId);
    if (!room) return null;

    const state = room.mediaSyncState;
    if (state.queue.length === 0) {
      // Loop back default
      return this.seek(roomId, 0);
    }

    const next = state.queue.shift()!;
    if (state.currentTrack) {
      state.queue.push(state.currentTrack);
    }

    return this.changeTrack(roomId, next);
  }

  /**
   * Add a track to queue
   */
  public addToQueue(roomId: string, track: MediaTrack): MediaSyncState | null {
    const room = roomService.getRoom(roomId);
    if (!room) return null;

    const state = room.mediaSyncState;
    if (!state.currentTrack) {
      return this.changeTrack(roomId, track);
    }

    state.queue.push(track);
    state.version += 1;
    return { ...state };
  }

  /**
   * Remove track from queue
   */
  public removeFromQueue(roomId: string, trackId: string): MediaSyncState | null {
    const room = roomService.getRoom(roomId);
    if (!room) return null;

    const state = room.mediaSyncState;
    state.queue = state.queue.filter((t) => t.id !== trackId);
    state.version += 1;
    return { ...state };
  }

  /**
   * Reorder track in queue
   */
  public reorderQueue(roomId: string, fromIndex: number, toIndex: number): MediaSyncState | null {
    const room = roomService.getRoom(roomId);
    if (!room) return null;

    const state = room.mediaSyncState;
    if (fromIndex < 0 || fromIndex >= state.queue.length || toIndex < 0 || toIndex >= state.queue.length) {
      return state;
    }

    const [moved] = state.queue.splice(fromIndex, 1);
    state.queue.splice(toIndex, 0, moved);
    state.version += 1;
    return { ...state };
  }

  /**
   * Toggle Host Only Control
   */
  public toggleLock(roomId: string, isHost: boolean): MediaSyncState | null {
    const room = roomService.getRoom(roomId);
    if (!room || !isHost) return null;

    room.mediaSyncState.isLockedByHost = !room.mediaSyncState.isLockedByHost;
    room.mediaSyncState.version += 1;
    return { ...room.mediaSyncState };
  }
}

export const syncEngine = new MediaSyncEngine();
