import { describe, it, expect } from "vitest";
import { fileService } from "../server/services/fileService";

describe("PHANTOM ROOM: File Validation & Magic Byte Security", () => {
  it("correctly identifies valid PNG magic bytes", () => {
    // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    const result = fileService.verifyMagicBytes(pngBuffer, ".png");
    expect(result.isValid).toBe(true);
    expect(result.detectedMime).toBe("image/png");
  });

  it("correctly identifies valid JPEG magic bytes", () => {
    // JPEG magic bytes: FF D8 FF
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    const result = fileService.verifyMagicBytes(jpegBuffer, ".jpg");
    expect(result.isValid).toBe(true);
    expect(result.detectedMime).toBe("image/jpeg");
  });

  it("blocks disguised Windows PE executables (MZ header)", () => {
    // Disguised EXE with .jpg extension: MZ header (4D 5A)
    const maliciousBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    const result = fileService.verifyMagicBytes(maliciousBuffer, ".jpg");
    expect(result.isValid).toBe(false);
    expect(result.detectedMime).toBe("application/x-executable-blocked");
  });

  it("generates and verifies signed download tokens", () => {
    const fileId = "test-file-uuid";
    const roomId = "test-room-uuid";

    const token = fileService.generateDownloadToken(fileId, roomId);
    expect(typeof token).toBe("string");

    const isValid = fileService.verifyDownloadToken(token, fileId);
    expect(isValid).toBe(true);

    const isInvalidFile = fileService.verifyDownloadToken(token, "wrong-file-id");
    expect(isInvalidFile).toBe(false);
  });
});
