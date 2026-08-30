import express, { Request, Response } from "express";
import http from "http";
import https from "https";
import fs from "fs";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import multer from "multer";
import path from "path";
import { initializeSocketIO } from "./socket";
import { roomService } from "./services/roomService";
import { rateLimiter } from "./services/rateLimiter";
import { fileService } from "./services/fileService";
import { securityAudit } from "./services/securityAudit";
import { startCleanupJob } from "./services/cleanupJob";
import { ensureDevelopmentCertificates } from "./services/certService";

const dev = process.env.NODE_ENV !== "production";
const PORT = parseInt(process.env.PORT || "3000", 10);
const USE_HTTPS = process.env.HTTPS === "true" || process.argv.includes("--https");

const nextApp = next({ dev, dir: process.cwd() });
const handle = nextApp.getRequestHandler();

// Multer in-memory storage for inspection before writing to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB max
  },
});

async function bootstrap() {
  await nextApp.prepare();
  const app = express();

  // Create HTTP or HTTPS server
  let server: http.Server | https.Server;

  if (USE_HTTPS) {
    const { keyPath, certPath } = await ensureDevelopmentCertificates();
    server = https.createServer(
      {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      },
      app
    );
    console.log("[HTTPS] Secure TLS context initialized using local dev certificates with LAN SAN coverage.");
  } else {
    server = http.createServer(app);
  }

  // Security Middleware
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Socket.IO Server initialization
  const io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    maxHttpBufferSize: 10 * 1024 * 1024, // 10MB
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  initializeSocketIO(io);

  // ==========================================
  // REST API ENDPOINTS
  // ==========================================

  /**
   * Health check
   */
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "healthy", timestamp: Date.now(), activeRooms: roomService.getActiveRoomCount() });
  });

  /**
   * GET /api/ice-servers - Provide verified STUN/TURN server configuration
   */
  app.get("/api/ice-servers", (_req: Request, res: Response) => {
    const iceServers: RTCIceServer[] = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
      { urls: "stun:stun.cloudflare.com:3478" },
      { urls: "stun:stun.nextcloud.com:443" },
    ];

    // If TURN server environment variables are configured, add them
    if (process.env.TURN_URL) {
      iceServers.push({
        urls: process.env.TURN_URL,
        username: process.env.TURN_USERNAME || "",
        credential: process.env.TURN_CREDENTIAL || "",
      });
    }

    res.json({ iceServers });
  });

  /**
   * POST /api/rooms - Create Room
   */
  app.post("/api/rooms", (req: Request, res: Response) => {
    const clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";

    if (!rateLimiter.checkRateLimit(clientIp, 30)) {
      return res.status(429).json({ error: "Rate limit exceeded. Please wait a moment." });
    }

    const { settings, passphrase } = req.body;
    const result = roomService.createRoom(settings, passphrase);

    res.status(201).json({
      room: {
        id: result.room.id,
        code: result.room.code,
        expiresAt: result.room.expiresAt,
        settings: result.room.settings,
      },
      participant: result.hostParticipant,
      sessionToken: result.sessionToken,
    });
  });

  /**
   * POST /api/rooms/join - Join Room
   */
  app.post("/api/rooms/join", (req: Request, res: Response) => {
    const clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";
    const { code, passphrase, codename } = req.body;

    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "Room code or identifier is required." });
    }

    const trimmedCode = code.trim().toUpperCase();

    // Anti-Brute Force Check
    const bruteForceCheck = rateLimiter.checkRoomJoinAttempt(clientIp, trimmedCode);
    if (!bruteForceCheck.allowed) {
      return res.status(429).json({
        error: `Too many invalid attempts. Access temporarily restricted. Retry in ${bruteForceCheck.retryAfterSeconds}s.`,
      });
    }

    const result = roomService.joinRoom(trimmedCode, passphrase, codename);

    if ("error" in result) {
      rateLimiter.recordFailedJoinAttempt(clientIp, trimmedCode);
      return res.status(result.code).json({ error: result.error });
    }

    // Success -> Reset rate limit bucket
    rateLimiter.recordSuccessfulJoin(clientIp);

    res.json({
      room: {
        id: result.room.id,
        code: result.room.code,
        expiresAt: result.room.expiresAt,
        settings: result.room.settings,
      },
      participant: result.participant,
      sessionToken: result.sessionToken,
    });
  });

  /**
   * POST /api/uploads - Upload File
   */
  app.post("/api/uploads", upload.single("file"), async (req: Request, res: Response) => {
    const clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";

    if (!rateLimiter.checkRateLimit(`${clientIp}_upload`, 20)) {
      return res.status(429).json({ error: "Upload rate limit exceeded. Please wait a moment." });
    }

    const file = req.file;
    const { roomId, token, isEncrypted, iv } = req.body;

    if (!file || !roomId) {
      return res.status(400).json({ error: "File buffer and roomId are required." });
    }

    // Verify session
    if (token) {
      const verified = roomService.verifySessionToken(token);
      if (!verified || verified.roomId !== roomId) {
        return res.status(403).json({ error: "Unauthorized upload session." });
      }
    }

    const room = roomService.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ error: "Room not found or expired." });
    }

    if (!room.settings.permissions.allowFileSharing) {
      return res.status(403).json({ error: "File sharing is disabled in this room." });
    }

    const uploadResult = await fileService.saveUpload(
      roomId,
      file.buffer,
      file.originalname,
      file.mimetype,
      isEncrypted === "true" || isEncrypted === true,
      iv
    );

    if ("error" in uploadResult) {
      return res.status(400).json({ error: uploadResult.error });
    }

    res.status(201).json({ file: uploadResult });
  });

  /**
   * GET /api/files/:id - Download File (Signed Token Required)
   */
  app.get("/api/files/:id", (req: Request, res: Response) => {
    const { id } = req.params;
    const token = req.query.token as string;

    if (!token || !fileService.verifyDownloadToken(token, id)) {
      return res.status(403).json({ error: "Invalid or expired file download authorization." });
    }

    const filePath = fileService.getFilePath(id);
    if (!filePath) {
      return res.status(404).json({ error: "File not found or has been purged." });
    }

    res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.sendFile(filePath);
  });

  /**
   * GET /api/admin/security - Sanitized Security Telemetry Dashboard
   */
  app.get("/api/admin/security", (req: Request, res: Response) => {
    const events = securityAudit.getRecentEvents(50);
    const stats = securityAudit.getStats();

    res.json({
      activeRooms: roomService.getActiveRoomCount(),
      stats,
      recentEvents: events,
      serverTime: Date.now(),
      securityVersion: "PHANTOM-CORE-2.4-E2EE",
    });
  });

  // Next.js Catch-All Handler
  app.all("*", (req: Request, res: Response) => {
    return handle(req, res);
  });

  // Start cleanup scheduler
  startCleanupJob(30000);

  server.on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.error(`\n[ERROR] Port ${PORT} is already in use by another process (EADDRINUSE).`);
      console.error(`[TIP] A previous instance of Node/PHANTOM is still holding port ${PORT}.`);
      console.error(`[TIP] Run 'npm run clean:port' to terminate orphaned instances on port ${PORT}.\n`);
    } else {
      console.error("Server error:", err);
    }
    process.exit(1);
  });

  server.listen(PORT, "0.0.0.0", () => {
    const protocol = USE_HTTPS ? "https" : "http";
    console.log(`> PHANTOM ROOM server active on ${protocol}://localhost:${PORT}`);
    console.log(`> Local Network (LAN): ${protocol}://0.0.0.0:${PORT}`);
    console.log(`> Mode: ${dev ? "development" : "production"}`);
  });
}

bootstrap().catch((err) => {
  console.error("Critical failure during server bootstrap:", err);
  process.exit(1);
});
