"use client";

import React from "react";
import { useRoom } from "../../lib/store/roomStore";
import { AlertCircle, AlertTriangle, Info, X, RefreshCw } from "lucide-react";

export const ErrorToastContainer: React.FC = () => {
  const { errors, removeError } = useRoom();

  if (errors.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {errors.map((err) => (
        <div
          key={err.id}
          className={`pointer-events-auto p-4 rounded-2xl border shadow-2xl backdrop-blur-xl transition-all duration-200 animate-in fade-in slide-in-from-top-2 ${
            err.severity === "critical" || err.severity === "error"
              ? "bg-surface-100/95 border-red-500/40 text-red-300"
              : err.severity === "warning"
              ? "bg-surface-100/95 border-amber-500/40 text-amber-300"
              : "bg-surface-100/95 border-phantom-cyan/40 text-slate-200"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              {err.severity === "critical" || err.severity === "error" ? (
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              ) : err.severity === "warning" ? (
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              ) : (
                <Info className="w-4 h-4 text-phantom-cyan flex-shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                  {err.title}
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed font-light">
                  {err.message}
                </p>
                {err.actionLabel && err.onAction && (
                  <button
                    onClick={() => {
                      err.onAction?.();
                      removeError(err.id);
                    }}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-mono font-semibold text-white transition"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>{err.actionLabel}</span>
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={() => removeError(err.id)}
              className="p-1 rounded text-slate-400 hover:text-white transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
