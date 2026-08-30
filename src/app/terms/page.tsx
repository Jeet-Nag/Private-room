import React from "react";
import { Shield, ArrowLeft, CheckSquare, AlertCircle } from "lucide-react";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background text-slate-100 p-6 md:p-12 selection:bg-phantom-cyan selection:text-phantom-dark">
      <div className="max-w-4xl mx-auto space-y-8">
        <a href="/" className="inline-flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-phantom-cyan transition">
          <ArrowLeft className="w-4 h-4" />
          <span>BACK TO PHANTOM ROOM</span>
        </a>

        <div className="space-y-2 border-b border-white/10 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-phantom-purple/10 border border-phantom-purple/30 flex items-center justify-center text-phantom-purple">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Terms of Service & Usage Agreement</h1>
              <p className="text-xs font-mono text-slate-400 mt-0.5">Guidelines for Lawful, Ephemeral Private Communications</p>
            </div>
          </div>
        </div>

        <div className="space-y-6 text-sm text-slate-300 leading-relaxed font-light">
          <section className="p-6 rounded-2xl bg-surface-100 border border-white/10 space-y-3">
            <h2 className="text-white font-semibold font-mono text-base flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-phantom-cyan" />
              1. Permitted Use
            </h2>
            <p>
              PHANTOM ROOM is provided for private, peer-to-peer real-time collaboration, media synchronization, voice/video communications, and document sharing. You agree not to use the platform for unlawful transmission of malware, copyrighted material without authorization, harassment, or abusive exploitation.
            </p>
          </section>

          <section className="p-6 rounded-2xl bg-surface-100 border border-white/10 space-y-3">
            <h2 className="text-white font-semibold font-mono text-base flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-phantom-amber" />
              2. Ephemeral Storage Disclaimer
            </h2>
            <p>
              By design, PHANTOM ROOM is an ephemeral service. No long-term backups or recovery mechanisms exist for expired or destroyed rooms. Users are responsible for saving any vital shared documents locally before the room expires.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
