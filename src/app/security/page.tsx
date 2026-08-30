import React from "react";
import { Shield, ArrowLeft, Lock, Key, Cpu, RefreshCw, EyeOff, ShieldAlert } from "lucide-react";

export default function SecurityWhitepaperPage() {
  return (
    <div className="min-h-screen bg-background text-slate-100 p-6 md:p-12 selection:bg-phantom-cyan selection:text-phantom-dark font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        <a href="/" className="inline-flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-phantom-cyan transition">
          <ArrowLeft className="w-4 h-4" />
          <span>BACK TO PHANTOM ROOM</span>
        </a>

        <div className="space-y-2 border-b border-white/10 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-phantom-cyan/10 border border-phantom-cyan/30 flex items-center justify-center text-phantom-cyan">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Security Architecture Whitepaper</h1>
              <p className="text-xs font-mono text-slate-400 mt-0.5">Threat Modeling, Cryptographic Primitives, & Anti-Abuse Defenses</p>
            </div>
          </div>
        </div>

        <div className="space-y-6 text-sm text-slate-300 leading-relaxed font-light">
          {/* Section 1: Dual-Tier Identity Boundary */}
          <section className="p-6 rounded-2xl bg-surface-100 border border-white/10 space-y-3">
            <h2 className="text-white font-semibold font-mono text-base flex items-center gap-2">
              <Key className="w-4 h-4 text-phantom-cyan" />
              1. Dual-Tier Identity & Security Boundary
            </h2>
            <p>
              In conventional apps, short codes create significant brute-force vulnerabilities. In PHANTOM ROOM, the 4-digit human room code (e.g. <code>4829</code>) is strictly an ingress pointer mapped internally to a 256-bit cryptographically secure room UUID (<code>crypto.randomUUID()</code>).
            </p>
            <p className="text-xs text-slate-400 font-mono bg-surface-200 p-3 rounded-lg border border-white/5">
              Human Ingress Code: 4829 → Internal Room UUID: f47ac10b-58cc-4372-a567-0e02b2c3d479 → HMAC Session Token: eyJhbGci...
            </p>
          </section>

          {/* Section 2: Anti-Brute Force Protection */}
          <section className="p-6 rounded-2xl bg-surface-100 border border-white/10 space-y-3">
            <h2 className="text-white font-semibold font-mono text-base flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-phantom-crimson" />
              2. Anti-Brute-Force & Timing-Safe Mitigation
            </h2>
            <p>
              To defend against room enumeration across the 10,000 combinations of 4-digit PINs:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-400 text-xs font-mono pl-2">
              <li>Token-bucket rate limiting restricts clients to 5 failed guesses per 15 minutes.</li>
              <li>Exceeding thresholds triggers an automatic 15-minute temporary lockout.</li>
              <li>Constant-time HMAC comparisons prevent side-channel timing attacks.</li>
              <li>Responses return generic "Unable to join this room" messages with zero database existence leakage.</li>
            </ul>
          </section>

          {/* Section 3: Web Crypto AES-GCM-256 */}
          <section className="p-6 rounded-2xl bg-surface-100 border border-white/10 space-y-3">
            <h2 className="text-white font-semibold font-mono text-base flex items-center gap-2">
              <Cpu className="w-4 h-4 text-phantom-purple" />
              3. Web Crypto AES-GCM-256 E2EE Implementation
            </h2>
            <p>
              Encryption keys are derived on the client using <code>window.crypto.subtle.deriveKey()</code> with PBKDF2 (100,000 iterations, SHA-256) and AES-GCM with unique 96-bit initialization vectors (IVs) per message payload. The server acts strictly as a transport relay for ciphertext.
            </p>
          </section>

          {/* Section 4: File Sharing & Magic-Byte Verification */}
          <section className="p-6 rounded-2xl bg-surface-100 border border-white/10 space-y-3">
            <h2 className="text-white font-semibold font-mono text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-phantom-emerald" />
              4. File Sandboxing & Metadata Sanitization
            </h2>
            <p>
              Uploaded media undergoes client-side canvas re-encoding to strip EXIF and GPS geolocation metadata. On receipt, the server inspects the binary magic bytes (JPEG <code>FF D8 FF</code>, PNG <code>89 50 4E 47</code>, PDF <code>%PDF</code>, etc.) and executes files from sandboxed directories outside the webroot using short-lived signed HMAC download URLs.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
