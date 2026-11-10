import React, { useState, useEffect } from 'react';
import { Globe, Volume2, Maximize, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

export default function BrowserDiagnostic({ onStatusChange, autoStart = true }) {
  const [status, setStatus] = useState('pending'); // pending, checking, ready, error
  const [capabilities, setCapabilities] = useState(null);
  const [testTonePlayed, setTestTonePlayed] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const runCheck = async () => {
    setStatus('checking');
    setErrorMsg('');

    try {
      const caps = {
        mediaRecorder: typeof window.MediaRecorder !== 'undefined',
        audioContext: typeof (window.AudioContext || window.webkitAudioContext) !== 'undefined',
        fullscreenEnabled: !!(document.fullscreenEnabled || document.webkitFullscreenEnabled),
        cryptoSubtle: !!(window.crypto && window.crypto.subtle),
        displayMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)
      };

      if (!caps.mediaRecorder) {
        throw new Error('MediaRecorder API is not available. Please upgrade your browser.');
      }
      if (!caps.audioContext) {
        throw new Error('Web Audio API is missing. Supported in Chrome, Edge, Firefox, and Safari.');
      }

      setCapabilities(caps);
      setStatus('ready');

      if (onStatusChange) {
        onStatusChange({
          pass: true,
          details: caps
        });
      }
    } catch (err) {
      console.warn('[BrowserDiagnostic] Error:', err);
      const msg = err.message || 'Browser compatibility validation failed.';
      setErrorMsg(msg);
      setStatus('error');
      if (onStatusChange) {
        onStatusChange({ pass: false, error: msg });
      }
    }
  };

  const playSynthesizedTone = () => {
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) return;
      const ctx = new AudioCtxClass();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime); // 440 Hz (Concert A)
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.45);
      setTestTonePlayed(true);
    } catch (e) {
      console.warn('[BrowserDiagnostic] Tone play failed:', e);
    }
  };

  useEffect(() => {
    if (autoStart) {
      runCheck();
    }
  }, [autoStart]);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg ${
            status === 'ready' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
            status === 'error' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
            'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
          }`}>
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-100">Browser APIs & Sound Output</h4>
            <p className="text-xs text-slate-400">Verifies audio output, recording codec, and security APIs</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status === 'ready' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" /> Compatible
            </span>
          )}
          {status === 'error' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertTriangle className="w-3.5 h-3.5" /> Incompatible
            </span>
          )}
          <button
            onClick={runCheck}
            aria-label="Retry browser check"
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title="Recheck Browser"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {status === 'ready' && capabilities && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <div className="p-2 rounded bg-slate-800/40 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">MediaRecorder</span>
              <span className="text-emerald-400 font-mono text-[11px]">Active</span>
            </div>
            <div className="p-2 rounded bg-slate-800/40 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Web Audio</span>
              <span className="text-emerald-400 font-mono text-[11px]">Active</span>
            </div>
            <div className="p-2 rounded bg-slate-800/40 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Fullscreen</span>
              <span className={capabilities.fullscreenEnabled ? "text-emerald-400 font-mono text-[11px]" : "text-amber-400 font-mono text-[11px]"}>
                {capabilities.fullscreenEnabled ? 'Available' : 'Restricted'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
            <span className="text-xs text-slate-300 flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-indigo-400" />
              Audio Output Test:
            </span>
            <button
              onClick={playSynthesizedTone}
              type="button"
              className={`px-3 py-1 text-xs rounded-lg border transition-colors flex items-center gap-1.5 ${
                testTonePlayed
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  : 'bg-indigo-600/20 text-indigo-300 border-indigo-500/30 hover:bg-indigo-600/30'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" />
              {testTonePlayed ? 'Played (Test Again)' : 'Play Test Chime'}
            </button>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
          <p className="font-medium mb-1 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            Browser API Check Failed
          </p>
          <p className="text-slate-300 pl-5.5">{errorMsg}</p>
        </div>
      )}
    </div>
  );
}

