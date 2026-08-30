"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, Lock, KeyRound, ArrowRight, ShieldCheck } from "lucide-react";
import { getApiUrl } from "../../lib/utils/apiUrl";

interface JoinRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoinSuccess: (data: { room: any; participant: any; sessionToken: string }) => void;
  initialCode?: string;
}

export const JoinRoomModal: React.FC<JoinRoomModalProps> = ({
  isOpen,
  onClose,
  onJoinSuccess,
  initialCode = "",
}) => {
  const [digits, setDigits] = useState<string[]>(["", "", "", ""]);
  const [customInput, setCustomInput] = useState<string>("");
  const [useLongCode, setUseLongCode] = useState<boolean>(false);
  const [passphrase, setPassphrase] = useState<string>("");
  const [requestedCodename, setRequestedCodename] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (initialCode) {
      if (initialCode.length === 4 && /^\d+$/.test(initialCode)) {
        setDigits(initialCode.split(""));
      } else {
        setCustomInput(initialCode);
        setUseLongCode(true);
      }
    }
  }, [initialCode]);

  useEffect(() => {
    if (isOpen && !useLongCode && inputRefs.current[0]) {
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [isOpen, useLongCode]);

  if (!isOpen) return null;

  const handleDigitChange = (index: number, val: string) => {
    const cleanVal = val.replace(/[^0-9]/g, "").slice(-1);
    const newDigits = [...digits];
    newDigits[index] = cleanVal;
    setDigits(newDigits);
    setError(null);

    // Auto-advance
    if (cleanVal && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").trim();
    if (pasted.length === 4 && /^\d+$/.test(pasted)) {
      setDigits(pasted.split(""));
      inputRefs.current[3]?.focus();
    } else if (pasted.length > 0) {
      setCustomInput(pasted);
      setUseLongCode(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const codeToSubmit = useLongCode ? customInput.trim() : digits.join("").trim();

    if (!codeToSubmit || (!useLongCode && codeToSubmit.length < 4)) {
      setError("Please enter the complete 4-digit room code.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(getApiUrl("/api/rooms/join"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: codeToSubmit,
          passphrase: passphrase.trim() || undefined,
          codename: requestedCodename.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to join this room.");
      }

      onJoinSuccess(data);
    } catch (err: any) {
      setError(err.message || "Unable to join this room.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-surface-100 border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl overflow-hidden">
        {/* Glow ambient */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-phantom-purple/10 blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-phantom-purple/10 border border-phantom-purple/30 text-phantom-purple">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white tracking-tight">Enter Private Room</h2>
              <p className="text-xs text-slate-400">Zero phone numbers. Ephemeral session.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-center gap-2">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {!useLongCode ? (
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-slate-400 text-center mb-3">
                ENTER 4-DIGIT ROOM CODE
              </label>
              <div className="flex justify-center gap-3" onPaste={handlePaste}>
                {digits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => { inputRefs.current[idx] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    className="w-14 h-16 text-center text-3xl font-mono font-bold text-white bg-surface-200 border border-white/15 rounded-xl focus:border-phantom-cyan focus:ring-2 focus:ring-phantom-cyan/30 focus:outline-none transition shadow-glass-inset"
                  />
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-slate-400 mb-2">
                ROOM CODE OR IDENTIFIER
              </label>
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="e.g. 4829 or PH-9X2K"
                className="w-full px-4 py-3 rounded-xl bg-surface-200 border border-white/10 text-white font-mono text-sm focus:border-phantom-cyan focus:outline-none transition"
              />
            </div>
          )}

          <div className="text-center">
            <button
              type="button"
              onClick={() => setUseLongCode(!useLongCode)}
              className="text-[11px] font-mono text-slate-400 hover:text-phantom-cyan underline decoration-dotted transition"
            >
              {useLongCode ? "Switch to 4-Digit PIN Pad" : "Have a custom link or alphanumeric ID?"}
            </button>
          </div>

          <div className="space-y-3 pt-1">
            <div>
              <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span>Room Passphrase (If Required)</span>
              </label>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Leave blank if room has no passphrase"
                className="w-full px-3.5 py-2 rounded-lg bg-surface-200 border border-white/10 text-xs text-white placeholder-slate-500 focus:border-phantom-purple/50 focus:outline-none transition"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                <span>Custom Ephemeral Codename (Optional)</span>
              </label>
              <input
                type="text"
                maxLength={20}
                value={requestedCodename}
                onChange={(e) => setRequestedCodename(e.target.value)}
                placeholder="e.g. Phantom-99 (Randomly assigned if blank)"
                className="w-full px-3.5 py-2 rounded-lg bg-surface-200 border border-white/10 text-xs text-white placeholder-slate-500 focus:border-phantom-cyan/50 focus:outline-none transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-phantom-purple via-phantom-blue to-phantom-cyan text-white font-bold text-sm tracking-wider hover:opacity-95 active:scale-[0.99] transition shadow-purple-glow flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>VERIFYING CRYPTOGRAPHIC TOKEN...</span>
              </>
            ) : (
              <>
                <span>JOIN PRIVATE ROOM</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
