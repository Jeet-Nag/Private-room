import fs from "fs";
import path from "path";
import crypto from "crypto";
import { FileAttachmentMetadata } from "../types";
import { securityAudit } from "./securityAudit";

const UPLOAD_DIR = path.join("/tmp", "phantom-room-uploads");
const SECRET_KEY = process.env.PHANTOM_JWT_SECRET || "phantom_super_secret_ephemeral_key_2026";

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export class FileService {
  private fileMetadataMap: Map<string, { meta: FileAttachmentMetadata; roomId: string; expiresAt: number }> = new Map();

  /**
   * Magic bytes verification for safe file uploads
   */
  public verifyMagicBytes(buffer: Buffer, declaredExt: string): { isValid: boolean; detectedMime: string } {
    if (buffer.length < 4) {
      return { isValid: false, detectedMime: "unknown" };
    }

    const hex = buffer.slice(0, 12).toString("hex").toUpperCase();

    // JPEG: FF D8 FF
    if (hex.startsWith("FFD8FF")) {
      return { isValid: true, detectedMime: "image/jpeg" };
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (hex.startsWith("89504E47")) {
      return { isValid: true, detectedMime: "image/png" };
    }

    // GIF: 47 49 46 38
    if (hex.startsWith("47494638")) {
      return { isValid: true, detectedMime: "image/gif" };
    }

    // WEBP: 52 49 46 46 .... 57 45 42 50
    if (hex.startsWith("52494646") && buffer.slice(8, 12).toString("ascii") === "WEBP") {
      return { isValid: true, detectedMime: "image/webp" };
    }

    // PDF: %PDF (25 50 44 46)
    if (hex.startsWith("25504446")) {
      return { isValid: true, detectedMime: "application/pdf" };
    }

    // ZIP: PK (50 4B 03 04 or 50 4B 05 06)
    if (hex.startsWith("504B0304") || hex.startsWith("504B0506")) {
      return { isValid: true, detectedMime: "application/zip" };
    }

    // MP3: ID3 or MPEG sync frames
    if (hex.startsWith("494433") || hex.startsWith("FFF3") || hex.startsWith("FFFB") || hex.startsWith("FFF2")) {
      return { isValid: true, detectedMime: "audio/mpeg" };
    }

    // MP4 / MOV: ....ftyp
    if (buffer.length >= 8 && buffer.slice(4, 8).toString("ascii") === "ftyp") {
      return { isValid: true, detectedMime: "video/mp4" };
    }

    // Plain text / Markdown / JSON / Code: check for null bytes
    const isText = !buffer.slice(0, 1024).includes(0);
    if (isText && [".txt", ".md", ".json", ".js", ".ts", ".html", ".css", ".csv"].includes(declaredExt.toLowerCase())) {
      return { isValid: true, detectedMime: "text/plain" };
    }

    // Disguised executable check: block EXE, DLL, ELF, Mach-O
    if (hex.startsWith("4D5A") || hex.startsWith("7F454C46") || hex.startsWith("FEEDFACE") || hex.startsWith("CEFAEDFE")) {
      return { isValid: false, detectedMime: "application/x-executable-blocked" };
    }

    // Allow general documents if extension matches safe list
    const safeExtensions = [".docx", ".xlsx", ".pptx", ".wav", ".ogg", ".webm", ".m4a"];
    if (safeExtensions.includes(declaredExt.toLowerCase())) {
      return { isValid: true, detectedMime: "application/octet-stream" };
    }

    return { isValid: false, detectedMime: "application/octet-stream" };
  }

  /**
   * Save uploaded file securely
   */
  public async saveUpload(
    roomId: string,
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    isEncrypted: boolean = false,
    iv?: string
  ): Promise<FileAttachmentMetadata | { error: string }> {
    const ext = path.extname(originalName).toLowerCase();
    const verification = this.verifyMagicBytes(fileBuffer, ext);

    if (!verification.isValid && !isEncrypted) {
      securityAudit.logEvent({
        type: "MALICIOUS_UPLOAD_BLOCKED",
        ipHash: "upload_verifier",
        details: `Blocked upload with mismatched magic bytes or unsafe extension: ${originalName}`,
        severity: "HIGH",
      });
      return { error: "File format verification failed. Disguised or executable files are blocked." };
    }

    const fileId = crypto.randomUUID();
    const safeDiskFileName = `${fileId}${ext}`;
    const filePath = path.join(UPLOAD_DIR, safeDiskFileName);

    await fs.promises.writeFile(filePath, fileBuffer);

    let category: FileAttachmentMetadata["category"] = "other";
    const detected = verification.detectedMime;
    if (detected.startsWith("image/")) category = "image";
    else if (detected.startsWith("video/")) category = "video";
    else if (detected.startsWith("audio/")) category = "audio";
    else if (detected === "application/pdf" || ext === ".docx" || ext === ".xlsx" || ext === ".txt") category = "document";
    else if (detected === "application/zip" || ext === ".zip" || ext === ".tar") category = "archive";

    const downloadToken = this.generateDownloadToken(fileId, roomId);

    const metadata: FileAttachmentMetadata = {
      fileId,
      fileName: originalName.replace(/[^a-zA-Z0-9._-]/g, "_"), // Sanitize original name
      fileSize: fileBuffer.length,
      mimeType: verification.detectedMime,
      category,
      downloadUrl: `/api/files/${fileId}?token=${downloadToken}`,
      isEncrypted,
      iv,
    };

    // Store in metadata registry (default 24h expiration)
    this.fileMetadataMap.set(fileId, {
      meta: metadata,
      roomId,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    });

    return metadata;
  }

  /**
   * Generate short-lived HMAC signed download token (15 mins)
   */
  public generateDownloadToken(fileId: string, roomId: string): string {
    const payload = `${fileId}:${roomId}:${Date.now() + 15 * 60 * 1000}`;
    const base64 = Buffer.from(payload).toString("base64url");
    const sig = crypto.createHmac("sha256", SECRET_KEY).update(base64).digest("base64url");
    return `${base64}.${sig}`;
  }

  /**
   * Verify signed download token
   */
  public verifyDownloadToken(token: string, fileId: string): boolean {
    try {
      const [base64, sig] = token.split(".");
      if (!base64 || !sig) return false;

      const expectedSig = crypto.createHmac("sha256", SECRET_KEY).update(base64).digest("base64url");
      if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
        return false;
      }

      const decoded = Buffer.from(base64, "base64url").toString("utf-8");
      const [tokenFileId, , expStr] = decoded.split(":");

      if (tokenFileId !== fileId) return false;
      if (Number(expStr) < Date.now()) return false;

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file path for download
   */
  public getFilePath(fileId: string): string | null {
    // Prevent path traversal
    const safeFileId = path.basename(fileId);
    const files = fs.readdirSync(UPLOAD_DIR);
    const match = files.find((f) => f.startsWith(safeFileId));
    if (!match) return null;
    return path.join(UPLOAD_DIR, match);
  }

  /**
   * Delete file
   */
  public deleteFile(fileId: string): void {
    try {
      const filePath = this.getFilePath(fileId);
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      this.fileMetadataMap.delete(fileId);
    } catch (err) {
      console.error(`Failed to delete file ${fileId}:`, err);
    }
  }

  /**
   * Purge all files for a room
   */
  public purgeRoomFiles(roomId: string): void {
    for (const [fileId, data] of this.fileMetadataMap.entries()) {
      if (data.roomId === roomId) {
        this.deleteFile(fileId);
      }
    }
  }
}

export const fileService = new FileService();
