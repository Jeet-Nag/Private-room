"use client";

import React, { useState, useEffect } from "react";
import { Shield, Lock, AlertTriangle, Activity, RefreshCw, ArrowLeft, CheckCircle } from "lucide-react";
import { formatTime } from "../../../lib/utils/formatters";

export default function SecurityTelemetryPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTelemetry = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/security");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to fetch security telemetry:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background text-slate-100 p-6 md:p-12 font-mono">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <a href="/" className="p-2 rounded-xl bg-surface-100 border border-white/10 text-slate-400 hover:text-white transition">
              <ArrowLeft className="w-4 h-4" />
            </a>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">Security & Abuse Telemetry</h1>
                <span className="px-2 py-0.5 rounded bg-phantom-cyan/10 text-phantom-cyan text-xs border border-phantom-cyan/20">
                  LIVE ENGINE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Privacy-preserving threat detection and rate-limit audit stream (Zero plaintext PII).
              </p>
            </div>
          </div>

          <button
            onClick={fetchTelemetry}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-100 border border-white/10 text-xs text-slate-300 hover:text-white transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-phantom-cyan" : ""}`} />
            <span>REFRESH FEED</span>
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            LOADING TELEMETRY DATA...
          </div>
        ) : (
          <>
            {/* Metric KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-surface-100 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400">Active Ephemeral Rooms</span>
                  <Activity className="w-4 h-4 text-phantom-cyan" />
                </div>
                <div className="text-3xl font-bold text-white">{data?.activeRooms || 0}</div>
                <div className="text-[10px] text-slate-500 mt-1">In-Memory Active Mesh</div>
              </div>

              <div className="p-5 rounded-2xl bg-surface-100 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400">Brute-Force Interceptions</span>
                  <Shield className="w-4 h-4 text-phantom-purple" />
                </div>
                <div className="text-3xl font-bold text-phantom-purple">{data?.stats?.bruteForceCount || 0}</div>
                <div className="text-[10px] text-slate-500 mt-1">PIN Guesses Throttled</div>
              </div>

              <div className="p-5 rounded-2xl bg-surface-100 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400">Critical Threat Blocks</span>
                  <AlertTriangle className="w-4 h-4 text-phantom-crimson" />
                </div>
                <div className="text-3xl font-bold text-phantom-crimson">{data?.stats?.criticalCount || 0}</div>
                <div className="text-[10px] text-slate-500 mt-1">15-Min IP Lockouts Enforced</div>
              </div>

              <div className="p-5 rounded-2xl bg-surface-100 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400">Crypto Engine Version</span>
                  <Lock className="w-4 h-4 text-phantom-emerald" />
                </div>
                <div className="text-base font-bold text-phantom-emerald truncate mt-1.5">AES-GCM-256</div>
                <div className="text-[10px] text-slate-500 mt-1">HMAC-SHA256 Token Protocol</div>
              </div>
            </div>

            {/* Sanitized Audit Log Stream */}
            <div className="p-6 rounded-2xl bg-surface-100 border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                  <Shield className="w-4 h-4 text-phantom-cyan" />
                  Sanitized Security Audit Log (Ring Buffer)
                </h3>
                <span className="text-xs text-slate-500">{data?.recentEvents?.length || 0} recorded</span>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {!data?.recentEvents || data.recentEvents.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No security violations recorded. All systems running normally.
                  </div>
                ) : (
                  data.recentEvents.map((evt: any) => (
                    <div
                      key={evt.id}
                      className="p-3 rounded-xl bg-surface-200 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            evt.severity === "CRITICAL"
                              ? "bg-red-500/20 text-red-400 border border-red-500/30"
                              : evt.severity === "HIGH"
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                          }`}
                        >
                          {evt.type}
                        </span>
                        <span className="text-slate-300">{evt.details}</span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-shrink-0">
                        <span>IP Hash: {evt.ipHash}</span>
                        <span>{formatTime(evt.timestamp)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
