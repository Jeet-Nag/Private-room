import { roomService } from "./roomService";
import { fileService } from "./fileService";

let cleanupTimer: NodeJS.Timeout | null = null;

export function startCleanupJob(intervalMs: number = 30000): void {
  if (cleanupTimer) return;

  cleanupTimer = setInterval(() => {
    try {
      const expiredRoomIds = roomService.getExpiredRooms();
      for (const roomId of expiredRoomIds) {
        console.log(`[CLEANUP-JOB] Purging expired room: ${roomId}`);
        fileService.purgeRoomFiles(roomId);
        roomService.destroyRoom(roomId, "EXPIRED");
      }
    } catch (err) {
      console.error("[CLEANUP-JOB] Error running cleanup:", err);
    }
  }, intervalMs);

  console.log(`[CLEANUP-JOB] Background room and storage garbage collector initialized (${intervalMs / 1000}s interval)`);
}

export function stopCleanupJob(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
