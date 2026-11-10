import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  Lock,
  CheckCircle2,
  XCircle,
  Clock,
  Camera,
  Mic,
  Wifi,
  Globe,
  Monitor,
  Volume2,
  FileCheck2
} from 'lucide-react';
import IdentityPhotoCapture from './IdentityPhotoCapture';
import CameraDiagnostic from './CameraDiagnostic';
import MicrophoneDiagnostic from './MicrophoneDiagnostic';
import NetworkDiagnostic from './NetworkDiagnostic';
import BrowserDiagnostic from './BrowserDiagnostic';
import ScreenShareDiagnostic from './ScreenShareDiagnostic';
import ConsentDialog from './ConsentDialog';

export default function SystemReadiness({
  sessionId,
  roleTitle = 'Software Engineer',
  onReadinessPassed,
  onExit
}) {
  const [showConsent, setShowConsent] = useState(false);
  const [hasConsented, setHasConsented] = useState(false);
  const [consentData, setConsentData] = useState(null);

  const [checks, setChecks] = useState({
    identityPhoto: { pass: false, details: null },
    camera: { pass: false, details: null, error: null },
    microphone: { pass: false, details: null, error: null },
    network: { pass: false, details: null, error: null },
    browser: { pass: false, details: null, error: null },
    screenShare: { pass: true, details: null, active: false } // Default true if optional
  });

  const [submittingDiagnostics, setSubmittingDiagnostics] = useState(false);
  const [submittingError, setSubmittingError] = useState(null);

  const allMandatoryPassed =
    checks.identityPhoto.pass &&
    checks.camera.pass &&
    checks.microphone.pass &&
    checks.network.pass &&
    checks.browser.pass;

  const updateCheck = (key, result) => {
    setChecks(prev => ({
      ...prev,
      [key]: result
    }));
  };

  const handleStartConsent = () => {
    setShowConsent(true);
  };

  const handleConsentGranted = async (data) => {
    setHasConsented(true);
    setConsentData(data);
    setShowConsent(false);

    try {
      await fetch('/api/security/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          granted: true,
          scope: data.scope,
          retention_policy_days: data.retentionPolicyDays
        })
      });
    } catch (e) {
      console.warn('[SystemReadiness] Failed to log consent:', e);
    }
  };

  const handleProceedToInterview = async () => {
    if (!allMandatoryPassed || !hasConsented) return;

    setSubmittingDiagnostics(true);
    setSubmittingError(null);

    try {
      const payload = {
        session_id: sessionId,
        camera: checks.camera,
        microphone: checks.microphone,
        network: checks.network,
        browser: checks.browser,
        fullscreen_ready: !!document.fullscreenEnabled,
        screenshare_available: !!checks.screenShare.details,
        timestamp: new Date().toISOString()
      };

      // Proactively unlock AudioContext within the user click gesture before async fetch
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const warmUpCtx = new AudioCtx();
          if (warmUpCtx.state === 'suspended') {
            await warmUpCtx.resume();
          }
        }
      } catch (audioErr) {
        console.warn('[SystemReadiness] AudioContext warm-up note:', audioErr);
      }

      // Send verified readiness payload to backend
      const res = await fetch('/api/security/diagnostics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`Failed to store diagnostic telemetry: HTTP ${res.status}`);
      }

      // Enter fullscreen if supported and requested
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        try {
          await document.documentElement.requestFullscreen();
        } catch (e) {
          console.warn('[SystemReadiness] Fullscreen entry ignored or rejected:', e);
        }
      }

      if (onReadinessPassed) {
        onReadinessPassed({
          diagnostics: payload,
          consent: consentData
        });
      }
    } catch (err) {
      console.error('[SystemReadiness] Proceed error:', err);
      setSubmittingError(err.message || 'Failed to submit diagnostic report');
      setSubmittingDiagnostics(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 md:p-8 animate-fade-in font-sans">
      <div className="max-w-4xl mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-6 border-b border-slate-800/80 gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400 shadow-lg shadow-indigo-950/50">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-slate-100 via-slate-200 to-indigo-300 bg-clip-text text-transparent">
                  SecureAssess Identity & Device Verification
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">
                  Pre-Interview
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Target Role: <span className="text-slate-200 font-medium">{roleTitle}</span> • Session ID: <span className="font-mono text-slate-400">{sessionId}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {hasConsented ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm">
                <CheckCircle2 className="w-4 h-4" /> Consent Granted
              </span>
            ) : (
              <button
                onClick={handleStartConsent}
                type="button"
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-all flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" /> Sign Consent
              </button>
            )}
          </div>
        </div>

        {/* Enterprise Readiness Status Summary Table */}
        <div className="mb-6 p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/80">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-indigo-400" />
              Final Readiness Checklist
            </span>
            <span className="text-xs text-slate-400">
              Mandatory Requirements: <span className={allMandatoryPassed && hasConsented ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                {allMandatoryPassed && hasConsented ? "All Passed" : "Pending Verification"}
              </span>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5" /> Identity Photo:
              </span>
              <span className={checks.identityPhoto.pass ? "text-emerald-400 font-semibold" : "text-amber-400"}>
                {checks.identityPhoto.pass ? "Completed" : "Pending"}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5" /> Camera:
              </span>
              <span className={checks.camera.pass ? "text-emerald-400 font-semibold" : checks.camera.error ? "text-rose-400" : "text-amber-400"}>
                {checks.camera.pass ? "Passed" : checks.camera.error ? "Failed" : "Pending"}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5" /> Microphone:
              </span>
              <span className={checks.microphone.pass ? "text-emerald-400 font-semibold" : checks.microphone.error ? "text-rose-400" : "text-amber-400"}>
                {checks.microphone.pass ? "Passed" : checks.microphone.error ? "Failed" : "Pending"}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5" /> Network:
              </span>
              <span className={checks.network.pass ? "text-emerald-400 font-semibold" : checks.network.error ? "text-rose-400" : "text-amber-400"}>
                {checks.network.pass ? "Passed" : checks.network.error ? "Warning" : "Pending"}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5" /> Screen Share:
              </span>
              <span className={checks.screenShare.active ? "text-emerald-400 font-semibold" : "text-slate-400"}>
                {checks.screenShare.active ? "Sharing" : "Optional"}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" /> Browser API:
              </span>
              <span className={checks.browser.pass ? "text-emerald-400 font-semibold" : "text-amber-400"}>
                {checks.browser.pass ? "Passed" : "Pending"}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5" /> Audio Chime:
              </span>
              <span className={checks.browser.pass ? "text-emerald-400 font-semibold" : "text-amber-400"}>
                {checks.browser.pass ? "Ready" : "Pending"}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> Consent:
              </span>
              <span className={hasConsented ? "text-emerald-400 font-semibold" : "text-amber-400 font-semibold"}>
                {hasConsented ? "Signed" : "Pending"}
              </span>
            </div>
          </div>

          {/* Candidate Pre-Interview Protocol & Instructions */}
          <div className="mt-5 pt-4 border-t border-slate-800 text-xs text-slate-300 space-y-2.5">
            <div className="font-semibold text-slate-200 flex items-center gap-1.5 text-xs">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              Candidate Pre-Interview Protocol
            </div>
            <ul className="space-y-1.5 list-disc list-inside text-slate-400 leading-relaxed">
              <li><strong className="text-slate-300">Spoken Flow:</strong> Listen carefully as Gnani Timbre vocalizes each question. Speak clearly into your mic after the chime.</li>
              <li><strong className="text-slate-300">Inactivity Notice:</strong> You will receive a reminder after 30s of silence. Sessions auto-terminate after 75s of inactivity.</li>
              <li><strong className="text-slate-300">Privacy & Proctoring:</strong> Audio & video checks run locally in-browser to verify ambient conditions and focus.</li>
            </ul>
          </div>
        </div>

        {/* Diagnostics & Verification Modules */}
        <div className="space-y-4">
          {/* 1. Identity Photo Snapshot */}
          <IdentityPhotoCapture
            sessionId={sessionId}
            onStatusChange={res => updateCheck('identityPhoto', res)}
          />

          {/* 2. Camera Diagnostics */}
          <CameraDiagnostic
            onStatusChange={res => updateCheck('camera', res)}
          />

          {/* 3. Microphone & Loopback Diagnostics */}
          <MicrophoneDiagnostic
            onStatusChange={res => updateCheck('microphone', res)}
          />

          {/* 4. Real Network Ping & Latency */}
          <NetworkDiagnostic
            onStatusChange={res => updateCheck('network', res)}
          />

          {/* 5. Browser APIs & Sound Chime */}
          <BrowserDiagnostic
            onStatusChange={res => updateCheck('browser', res)}
          />

          {/* 6. Screen Share Verification */}
          <ScreenShareDiagnostic
            onStatusChange={res => updateCheck('screenShare', res)}
            isRequired={false}
          />
        </div>

        {submittingError && (
          <div className="mt-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{submittingError}</span>
          </div>
        )}
      </div>

      {/* Bottom Action Footer */}
      <div className="max-w-4xl mx-auto w-full pt-8 mt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
        <button
          onClick={onExit}
          type="button"
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors"
        >
          Cancel & Return to Dashboard
        </button>

        <div className="w-full sm:w-auto flex items-center gap-3">
          {!hasConsented && (
            <button
              onClick={handleStartConsent}
              type="button"
              className="w-full sm:w-auto px-6 py-3 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" /> Review & Sign Consent
            </button>
          )}

          <button
            onClick={handleProceedToInterview}
            disabled={!allMandatoryPassed || !hasConsented || submittingDiagnostics}
            type="button"
            className={`w-full sm:w-auto px-7 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${allMandatoryPassed && hasConsented && !submittingDiagnostics
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-emerald-500/25 scale-[1.02] cursor-pointer'
                : 'bg-slate-800/80 text-slate-500 cursor-not-allowed border border-slate-700/40'
              }`}
          >
            {submittingDiagnostics ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Entering Interview...
              </>
            ) : (
              <>
                Enter Company Assessment
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {showConsent && (
        <ConsentDialog
          roleTitle={roleTitle}
          onConsentGranted={handleConsentGranted}
          onCancel={() => setShowConsent(false)}
        />
      )}
    </div>
  );
}
