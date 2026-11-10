import React, { useState, useEffect, useRef } from 'react';
import { Camera, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

export default function CameraDiagnostic({ onStatusChange, autoStart = true }) {
  const [status, setStatus] = useState('pending'); // pending, checking, ready, error
  const [details, setDetails] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const runCheck = async () => {
    setStatus('checking');
    setErrorMsg('');
    stopStream();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access API is not supported in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;

      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error('No active video track detected.');
      }

      const settings = videoTrack.getSettings ? videoTrack.getSettings() : {};
      const res = {
        label: videoTrack.label || 'Webcam',
        width: settings.width || 1280,
        height: settings.height || 720,
        frameRate: Math.round(settings.frameRate || 30),
        status: 'ready'
      };

      setDetails(res);
      setStatus('ready');

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }

      if (onStatusChange) {
        onStatusChange({ pass: true, details: res });
      }
    } catch (err) {
      console.warn('[CameraDiagnostic] Error:', err);
      let humanMsg = 'Camera access was denied or device is not available.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        humanMsg = 'Permission denied. Please click the lock/camera icon in your address bar and allow camera access.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        humanMsg = 'No camera device detected. Please connect a webcam and retry.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        humanMsg = 'Camera is currently in use by another application (Zoom, Teams, etc.). Please close it and retry.';
      }

      setErrorMsg(humanMsg);
      setStatus('error');
      if (onStatusChange) {
        onStatusChange({ pass: false, error: humanMsg });
      }
    }
  };

  useEffect(() => {
    if (autoStart) {
      runCheck();
    }
    return () => {
      stopStream();
    };
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
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-100">Camera Feed & Resolution</h4>
            <p className="text-xs text-slate-400">Verifies local webcam stream and optical resolution</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status === 'ready' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" /> Ready
            </span>
          )}
          {status === 'error' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertTriangle className="w-3.5 h-3.5" /> Failed
            </span>
          )}
          {status === 'checking' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 animate-pulse">
              Testing...
            </span>
          )}
          <button
            onClick={runCheck}
            aria-label="Retry camera check"
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title="Recheck Camera"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {status === 'ready' && details && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div className="relative aspect-video rounded-lg overflow-hidden bg-black/60 border border-slate-800 max-h-36">
            <video
              ref={videoRef}
              muted
              playsInline
              autoPlay
              className="w-full h-full object-cover mirror"
            />
            <div className="absolute bottom-1.5 left-2 px-2 py-0.5 rounded bg-black/70 text-[10px] text-emerald-400 font-mono">
              LIVE STREAM ACTIVE
            </div>
          </div>
          <div className="space-y-1.5 text-xs text-slate-300">
            <p className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Device:</span>
              <span className="font-medium text-slate-200 truncate max-w-[180px]">{details.label}</span>
            </p>
            <p className="flex justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Resolution:</span>
              <span className="font-mono text-slate-200">{details.width} × {details.height}</span>
            </p>
            <p className="flex justify-between py-1">
              <span className="text-slate-400">Framerate:</span>
              <span className="font-mono text-slate-200">~{details.frameRate} fps</span>
            </p>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
          <p className="font-medium mb-1 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            Camera Check Failed
          </p>
          <p className="text-slate-300 pl-5.5">{errorMsg}</p>
        </div>
      )}
    </div>
  );
}

