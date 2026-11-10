import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  ShieldCheck,
  Lock,
  Cpu,
  Sliders,
  Volume2,
  Globe2,
  KeyRound,
  CheckCircle2,
  HardDrive
} from 'lucide-react';

export const SettingsManager = ({ serviceStatus }) => {
  const [activeTab, setActiveTab] = useState('general');
  const [retentionDays, setRetentionDays] = useState(30);
  const [autoSaveLogs, setAutoSaveLogs] = useState(true);
  const [preferredVoice, setPreferredVoice] = useState('en-IN-Wavenet-A');
  const [sttLanguage, setSttLanguage] = useState('en-IN');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  // Load audit trail when on audit tab
  const fetchAuditLogs = async () => {
    setIsLoadingAudit(true);
    try {
      const token = localStorage.getItem('gnani_recruiter_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch('/api/security/audit-trail?limit=25', { headers });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.audit_logs || []);
      }
    } catch (e) {
      console.warn("Audit logs fetch failed:", e);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveSuccess(true);

    // Audit log config change
    try {
      const token = localStorage.getItem('gnani_recruiter_token');
      if (token) {
        await fetch('/api/security/audit-config-change', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            setting_category: 'WORKSPACE_PREFERENCES',
            changes: { retentionDays, autoSaveLogs, preferredVoice, sttLanguage }
          })
        });
      }
    } catch (_) { }

    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleEnforceRetention = async () => {
    setIsPurging(true);
    setPurgeResult(null);
    try {
      const token = localStorage.getItem('gnani_recruiter_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/security/enforce-retention', {
        method: 'POST',
        headers,
        body: JSON.stringify({ retention_days: retentionDays })
      });
      if (res.ok) {
        const data = await res.json();
        setPurgeResult(data);
        if (activeTab === 'audit') fetchAuditLogs();
      }
    } catch (e) {
      console.error("Purge error:", e);
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto pb-12">
      {/* Top Banner Card */}
      <div className="saas-card p-6 border-b border-[#E2E8F0]">
        <div className="space-y-1">
          <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-[#315C8C]/10 text-[#315C8C] inline-flex items-center gap-1.5">
            <SettingsIcon className="w-3.5 h-3.5" />
            Workspace Configuration
          </span>
          <h1 className="text-xl font-bold text-[#172B45] tracking-tight">
            Platform Settings & Privacy Controls
          </h1>
          <p className="text-xs text-[#64748B] max-w-xl leading-relaxed">
            Manage Speech AI engine defaults, consent-based storage encryption, and candidate data retention.
          </p>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Settings updated successfully.</span>
        </div>
      )}

      {/* Main Settings Form Card */}
      <div className="saas-card p-6 space-y-6">
        <form onSubmit={handleSave} className="space-y-6">
          {/* Audio Engine Configuration */}
          <div className="space-y-3 pb-5 border-b border-[#E2E8F0]">
            <h2 className="text-sm font-bold text-[#172B45] flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-[#315C8C]" />
              <span>Gnani Speech Engine Defaults</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-[#64748B] block mb-1">STT Language Recognition</label>
                <select
                  value={sttLanguage}
                  onChange={(e) => setSttLanguage(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-[#E2E8F0] bg-white text-xs text-[#172B45] focus:outline-none focus:border-[#315C8C]"
                >
                  <option value="en-IN">English (India) - en-IN</option>
                  <option value="en-US">English (US) - en-US</option>
                  <option value="hi-IN">Hindi - hi-IN</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-[#64748B] block mb-1">TTS Voice Persona</label>
                <select
                  value={preferredVoice}
                  onChange={(e) => setPreferredVoice(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-[#E2E8F0] bg-white text-xs text-[#172B45] focus:outline-none focus:border-[#315C8C]"
                >
                  <option value="en-IN-Wavenet-A">Gnani Timbre Professional (Female)</option>
                  <option value="en-IN-Wavenet-B">Gnani Timbre Technical (Male)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Privacy & Storage Retention */}
          <div className="space-y-3 pb-5 border-b border-[#E2E8F0]">
            <h2 className="text-sm font-bold text-[#172B45] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#167C72]" />
              <span>Data Retention & Candidate Privacy</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-[#64748B] block mb-1">Retention Window</label>
                <select
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-md border border-[#E2E8F0] bg-white text-xs text-[#172B45] focus:outline-none focus:border-[#315C8C]"
                >
                  <option value={7}>7 Days</option>
                  <option value={30}>30 Days (Recommended)</option>
                  <option value={90}>90 Days</option>
                </select>
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 text-xs text-[#172B45] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoSaveLogs}
                    onChange={(e) => setAutoSaveLogs(e.target.checked)}
                    className="rounded border-[#CBD5E1] text-[#315C8C]"
                  />
                  <span>Store encrypted candidate transcripts in SQLite</span>
                </label>
              </div>
            </div>

            {/* Retention Enforcement Action */}
            <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
              <div>
                <div className="text-xs font-semibold text-[#172B45]">Enforce Configured Retention Now</div>
                <div className="text-[11px] text-[#64748B]">Permanently purges diagnostics & recordings older than {retentionDays} days.</div>
              </div>
              <button
                type="button"
                onClick={handleEnforceRetention}
                disabled={isPurging}
                className="px-3 py-1.5 rounded-md border border-rose-300 bg-white text-rose-700 hover:bg-rose-50 text-xs font-medium transition-colors cursor-pointer"
              >
                {isPurging ? 'Purging...' : 'Execute Retention Purge'}
              </button>
            </div>

            {purgeResult && (
              <div className="p-2.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                Retention enforced: {purgeResult.encrypted_recordings_purged || 0} recording(s) and expired database diagnostics purged.
              </div>
            )}
          </div>

          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={() => {
                fetchAuditLogs();
                setActiveTab(activeTab === 'audit' ? 'general' : 'audit');
              }}
              className="text-xs text-[#315C8C] font-semibold hover:underline cursor-pointer"
            >
              {activeTab === 'audit' ? '← Back to Settings' : 'View Recruiter Audit Trail →'}
            </button>
            <button
              type="submit"
              className="btn-primary text-xs"
            >
              Save Configuration
            </button>
          </div>
        </form>

        {/* Audit Trail Viewer */}
        {activeTab === 'audit' && (
          <div className="mt-6 pt-6 border-t border-[#E2E8F0] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#172B45]">
                Immutable Security & Recruiter Audit Trail
              </h3>
              <button
                onClick={fetchAuditLogs}
                className="text-[11px] text-[#315C8C] hover:underline"
              >
                Refresh Log
              </button>
            </div>
            
            {isLoadingAudit ? (
              <div className="text-xs text-[#64748B] py-4 text-center">Loading security audit records...</div>
            ) : auditLogs.length === 0 ? (
              <div className="text-xs text-[#64748B] py-4 text-center">No recruiter actions recorded yet.</div>
            ) : (
              <div className="overflow-x-auto border border-[#E2E8F0] rounded-lg bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B]">
                    <tr>
                      <th className="py-2 px-3 font-semibold">Timestamp</th>
                      <th className="py-2 px-3 font-semibold">Action</th>
                      <th className="py-2 px-3 font-semibold">Actor</th>
                      <th className="py-2 px-3 font-semibold">Target</th>
                      <th className="py-2 px-3 font-semibold">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#F8FAFC]">
                        <td className="py-2 px-3 text-[#64748B] whitespace-nowrap">
                          {new Date(log.timestamp * 1000).toLocaleTimeString()}
                        </td>
                        <td className="py-2 px-3 font-semibold text-[#172B45]">
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#315C8C]/10 text-[#315C8C]">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-[#172B45]">{log.actor_email}</td>
                        <td className="py-2 px-3 text-[#64748B] font-mono text-[11px]">{log.target_resource}</td>
                        <td className="py-2 px-3 text-[#64748B] max-w-xs truncate" title={log.details}>
                          {log.details || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
