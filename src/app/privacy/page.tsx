import React from "react";
import { Shield, ArrowLeft, Lock, EyeOff, Server, Trash2 } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background text-slate-100 p-6 md:p-12 selection:bg-phantom-cyan selection:text-phantom-dark">
      <div className="max-w-4xl mx-auto space-y-8">
        <a href="/" className="inline-flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-phantom-cyan transition">
          <ArrowLeft className="w-4 h-4" />
          <span>BACK TO PHANTOM ROOM</span>
        </a>

        <div className="space-y-2 border-b border-white/10 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-phantom-cyan/10 border border-phantom-cyan/30 flex items-center justify-center text-phantom-cyan">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Zero-Log Privacy Policy</h1>
              <p className="text-xs font-mono text-slate-400 mt-0.5">Strict Metadata Minimization & Ephemeral Data Retention</p>
            </div>
          </div>
        </div>

        <div className="space-y-6 text-sm text-slate-300 leading-relaxed font-light">
          <section className="p-6 rounded-2xl bg-surface-100 border border-white/10 space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold font-mono text-base">
              <EyeOff className="w-5 h-5 text-phantom-cyan" />
              <h2>1. No Personal Identity Required</h2>
            </div>
            <p>
              PHANTOM ROOM does not require, collect, or store phone numbers, email addresses, real names, or social profiles. Room participants are assigned randomized, ephemeral codenames (e.g. <code>Ghost-71</code>) that exist solely for the duration of the active room session.
            </p>
          </section>

          <section className="p-6 rounded-2xl bg-surface-100 border border-white/10 space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold font-mono text-base">
              <Lock className="w-5 h-5 text-phantom-purple" />
              <h2>2. Client-Side End-to-End Encryption (E2EE)</h2>
            </div>
            <p>
              When room encryption is active, message payloads and shared files are encrypted on your local device using standard Web Crypto API primitives (AES-GCM-256) prior to transmission over WebSockets. Keys are derived from room secrets client-side; our servers only relay encrypted ciphertext and never possess the decryption keys.
            </p>
          </section>

          <section className="p-6 rounded-2xl bg-surface-100 border border-white/10 space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold font-mono text-base">
              <Server className="w-5 h-5 text-phantom-blue" />
              <h2>3. Zero-Log Network Architecture & IP Hashing</h2>
            </div>
            <p>
              We do not log user IP addresses in application logs or share network topologies. To mitigate denial-of-service and brute-force attacks on 4-digit codes, our rate limiter computes salted, one-way SHA-256 hashes of incoming connection IPs. Raw IP strings are never written to disk.
            </p>
          </section>

          <section className="p-6 rounded-2xl bg-surface-100 border border-white/10 space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold font-mono text-base">
              <Trash2 className="w-5 h-5 text-phantom-crimson" />
              <h2>4. Automated Ephemeral Purging</h2>
            </div>
            <p>
              All room sessions are ephemeral. When a room reaches its configured expiration time (from 10 minutes to 7 days) or when the host activates immediate self-destruction, all in-memory buffers and uploaded files are irreversibly destroyed by our automated background garbage collector.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
