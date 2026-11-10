import React, { useState, useEffect, useRef } from 'react';
import { Monitor, CheckCircle2, AlertTriangle, RefreshCw, StopCircle } from 'lucide-react';

export default function ScreenShareDiagnostic({ onStatusChange, isRequired = false }) {
  const [status, setStatus] = useState('pending'); // pending, sharing, stopped, error
  const [streamActive, setStreamActive] = useState(false);
  const [trackDetails, setTrackDetails] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const streamRef = useRef(null);

  const stopSharing = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setStreamActive(false);
    setStatus('stopped');
    onStatusChange?.({ pass: !isRequired, details: null, active: false });
  };

  const startScreenShare = async () => {
    setErrorMsg('');
    setStatus('checking');

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error('Screen sharing API is not supported in this browser.');
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false
      });

      streamRef.current = stream;
      setStreamActive(true);
      setStatus('sharing');

      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings ? track.getSettings() : {};

      const details = {
        label: track.label || 'Screen Stream',
        width: settings.width || 1920,
        height: settings.height || 1080,
        active: true
      };
      setTrackDetails(details);

      track.onended = () => {
        console.info('[ScreenShareDiagnostic] User stopped sharing screen.');
        setStreamActive(false);
        setStatus('stopped');
        onStatusChange?.({ pass: !isRequired, details: null, active: false });
      };

      onStatusChange?.({ pass: true, details, active: true });
    } catch (err) {
      console.warn('[ScreenShareDiagnostic] Error:', err);
      let humanMsg = 'Screen sharing was cancelled or denied.';
      if (err.name === 'NotAllowedError') {
        humanMsg = 'Screen sharing permission was cancelled or not granted.';
      }
      setErrorMsg(humanMsg);
      setStatus('error');
      onStatusChange?.({ pass: !isRequired, error: humanMsg, active: false });
    }
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg ${
            status === 'sharing' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
            status === 'error' && isRequired ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
            'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
          }`}>
            <Monitor className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              Screen Sharing Diagnostic
              {!isRequired && (
                <span className="text-[10px] px-2 py-0.2 rounded bg-slate-800 text-slate-400 font-normal">
                  Optional
                </span>
              )}
            </h4>
            <p className="text-xs text-slate-400">Verifies screen capture capability for technical reviews</p>
          </div>
        </div>

        <div>
          {status === 'sharing' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" /> Sharing Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700/50">
              {status === 'stopped' ? 'Stopped' : 'Ready to Test'}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs text-slate-300 leading-relaxed">
          Some technical evaluations require sharing a screen or IDE window. 
          The browser will display a picker so you can select the exact window or display to share. 
          <em className="text-slate-400 text-[11px] block mt-0.5">
            Note: The browser cannot detect other unshared displays or background hardware.
          </em>
        </p>

        {status === 'sharing' && trackDetails && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center justify-between">
            <span className="truncate max-w-[260px] font-mono">
              Sharing: {trackDetails.label} ({trackDetails.width} × {trackDetails.height})
            </span>
            <button
              type="button"
              onClick={stopSharing}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-bold transition-colors flex items-center gap-1"
            >
              <StopCircle className="w-3.5 h-3.5" /> Stop Sharing
            </button>
          </div>
        )}

        {status !== 'sharing' && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={startScreenShare}
              className="px-4 py-2 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 rounded-xl text-xs font-semibold transition-colors flex items-center gap-2"
            >
              <Monitor className="w-4 h-4" />
              Test Screen Share
            </button>
            {errorMsg && (
              <span className="text-xs text-rose-300 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> {errorMsg}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

