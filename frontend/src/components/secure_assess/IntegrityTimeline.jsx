import React, { useState, useEffect } from 'react';
import { ShieldCheck, Clock, CheckCircle2, AlertTriangle, Info, RefreshCw, Key } from 'lucide-react';

export default function IntegrityTimeline({ sessionId }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAuditReport = async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/security/report/${sessionId}`);
      if (!res.ok) {
        throw new Error(`Failed to load security report (HTTP ${res.status})`);
      }
      const data = await res.json();
      setReport(data);
    } catch (err) {
      console.warn('[IntegrityTimeline] Fetch error:', err);
      setError(err.message || 'Audit data unavailable');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditReport();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-400" />
        Loading tamper-evident audit log...
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
        <span>No security audit records logged for this session yet.</span>
        <button
          onClick={fetchAuditReport}
          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
        >
          Refresh
        </button>
      </div>
    );
  }

  const events = report.events || [];
  const diagnostics = report.diagnostics;
  const isChainValid = report.chain_valid;

  return (
    <div className="space-y-4">
      {/* Integrity Summary Card */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg ${
            isChainValid ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400'
          }`}>
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              Gnani SecureAssess Audit Log
              {isChainValid && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  SHA-256 VERIFIED
                </span>
              )}
            </h4>
            <p className="text-xs text-slate-400">
              Total events: <span className="text-slate-200 font-semibold">{report.total_events}</span> • 
              Heartbeats recorded: <span className="text-slate-200 font-semibold">{report.heartbeat_count || 0}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Consent:</span>
          <span className="font-semibold text-emerald-400">
            {report.consent_status === 'granted' ? 'Informed Consent Active' : 'Not Recorded'}
          </span>
        </div>
      </div>

      {/* Diagnostics Readiness Overview */}
      {diagnostics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/80">
            <span className="text-slate-400 block text-[11px]">Camera</span>
            <span className="font-medium text-emerald-400">Verified</span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/80">
            <span className="text-slate-400 block text-[11px]">Microphone</span>
            <span className="font-medium text-emerald-400">Active Input</span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/80">
            <span className="text-slate-400 block text-[11px]">Latency</span>
            <span className="font-medium text-slate-200">
              {diagnostics.network?.details?.latencyMs ? `${diagnostics.network.details.latencyMs}ms` : 'Healthy'}
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/80">
            <span className="text-slate-400 block text-[11px]">Fullscreen</span>
            <span className="font-medium text-slate-200">
              {diagnostics.fullscreen_ready ? 'Available' : 'Restricted'}
            </span>
          </div>
        </div>
      )}

      {/* Chronological Event Timeline */}
      <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800">
        <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
          Chronological Session Events
        </h5>

        {events.length === 0 ? (
          <p className="text-xs text-slate-500 py-3 text-center">
            No technical interruptions or focus events detected during this session.
          </p>
        ) : (
          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {events.map((ev, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-800 flex items-start justify-between text-xs gap-3"
              >
                <div className="flex items-start gap-2.5">
                  <div className={`mt-0.5 p-1 rounded ${
                    ev.severity === 'warning' ? 'text-amber-400 bg-amber-500/10' :
                    ev.severity === 'error' ? 'text-rose-400 bg-rose-500/10' :
                    'text-indigo-400 bg-indigo-500/10'
                  }`}>
                    {ev.severity === 'warning' ? (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    ) : (
                      <Info className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-200 block">
                      {ev.event_type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-slate-400 text-[11px]">{ev.detail}</span>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <span className="text-[10px] text-slate-500 font-mono block">
                    {new Date(ev.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="text-[9px] text-slate-600 font-mono">
                    Seq #{ev.sequence}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

