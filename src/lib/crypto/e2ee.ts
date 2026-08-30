/**
 * PHANTOM ROOM: Client-Side True End-to-End Encryption (AES-GCM-256)
 * Native Web Crypto API Implementation
 */

export class E2EEService {
  private cryptoKey: CryptoKey | null = null;
  private salt = new Uint8Array([75, 142, 99, 210, 88, 12, 45, 199, 34, 112, 85, 241, 109, 67, 180, 22]);

  /**
   * Derive a 256-bit AES-GCM key from room secret / passphrase
   */
  public async deriveKeyFromSecret(secret: string): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );

    this.cryptoKey = await window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: this.salt,
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );

    return this.cryptoKey;
  }

  /**
   * Encrypt plaintext string to AES-GCM ciphertext + IV
   */
  public async encrypt(text: string): Promise<{ ciphertext: string; iv: string } | null> {
    if (!this.cryptoKey) return null;

    const enc = new TextEncoder();
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit standard IV for GCM

    const encryptedBuffer = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
      },
      this.cryptoKey,
      enc.encode(text)
    );

    const ciphertext = this.arrayBufferToBase64(encryptedBuffer);
    const ivBase64 = this.arrayBufferToBase64(iv);

    return { ciphertext, iv: ivBase64 };
  }

  /**
   * Decrypt AES-GCM ciphertext using IV
   */
  public async decrypt(ciphertext: string, ivBase64: string): Promise<string> {
    if (!this.cryptoKey) return "[E2EE Key Required]";

    try {
      const encryptedBuffer = this.base64ToArrayBuffer(ciphertext);
      const iv = new Uint8Array(this.base64ToArrayBuffer(ivBase64));

      const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv,
        },
        this.cryptoKey,
        encryptedBuffer
      );

      const dec = new TextDecoder();
      return dec.decode(decryptedBuffer);
    } catch (err) {
      console.warn("E2EE Decryption failed (key mismatch or corrupted data):", err);
      return "[Decryption Failed]";
    }
  }

  public isKeyLoaded(): boolean {
    return this.cryptoKey !== null;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

export const e2ee = new E2EEService();
