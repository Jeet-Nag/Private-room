import { describe, it, expect } from "vitest";
import { syncEngine } from "../server/services/syncEngine";
import { roomService } from "../server/services/roomService";
import { MediaTrack } from "../server/types";

describe("PHANTOM ROOM: Media Synchronization Engine", () => {
  it("initializes room media and calculates accurate authoritative playback position", () => {
    const { room } = roomService.createRoom();
    const syncState = syncEngine.initializeRoomMedia(room.id);

    expect(syncState.currentTrack).not.toBeNull();
    expect(syncState.isPlaying).toBe(false);
    expect(syncEngine.getCalculatedPosition(syncState)).toBe(0);

    // Play track
    const played = syncEngine.play(room.id, 10);
    expect(played?.isPlaying).toBe(true);
    expect(played?.positionSeconds).toBe(10);
    expect(played?.version).toBe(2);

    // Seek track
    const seeked = syncEngine.seek(room.id, 45);
    expect(seeked?.positionSeconds).toBe(45);
    expect(seeked?.version).toBe(3);
  });

  it("manages collaborative queue operations", () => {
    const { room } = roomService.createRoom();
    syncEngine.initializeRoomMedia(room.id);

    const customTrack: MediaTrack = {
      id: "test-track-99",
      title: "Test Track",
      artist: "Phantom Test",
      url: "https://example.com/test.mp3",
      duration: 180,
      type: "audio",
    };

    const added = syncEngine.addToQueue(room.id, customTrack);
    expect(added?.queue.some((t) => t.id === "test-track-99")).toBe(true);

    const removed = syncEngine.removeFromQueue(room.id, "test-track-99");
    expect(removed?.queue.some((t) => t.id === "test-track-99")).toBe(false);
  });
});
