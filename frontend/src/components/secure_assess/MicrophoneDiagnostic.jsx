import React, { useState, useEffect, useRef } from 'react';
import { Mic, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

export default function MicrophoneDiagnostic({ onStatusChange, autoStart = true }) {
  const [status, setStatus] = useState('pending'); // pending, checking, ready, error
  const [volumeLevel, setVolumeLevel] = useState(0); // 0 to 100
  const [hasDetectedAudio, setHasDetectedAudio] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [deviceLabel, setDeviceLabel] = useState('');

  const [testRecordingBlob, setTestRecordingBlob] = useState(null);
  const [testAudioUrl, setTestAudioUrl] = useState(null);
  const [isTestRecording, setIsTestRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const startTestRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    setTestRecordingBlob(null);
    setTestAudioUrl(null);
    try {
      const rec = new MediaRecorder(streamRef.current);
      mediaRecorderRef.current = rec;
      rec.ondataavailable = e => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const b = new Blob(chunksRef.current, { type: 'audio/webm' });
        setTestRecordingBlob(b);
        setTestAudioUrl(URL.createObjectURL(b));
      };
      rec.start();
      setIsTestRecording(true);
      setTimeout(() => {
        if (rec.state === 'recording') {
          rec.stop();
          setIsTestRecording(false);
        }
      }, 3000);
    } catch (e) {
      console.warn('[MicrophoneDiagnostic] Test recording error:', e);
    }
  };
  const audioCtxRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);

  const stopAudio = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      try {
        audioCtxRef.current.close().catch(() => {});
      } catch (e) {}
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const runCheck = async () => {
    setStatus('checking');
    setErrorMsg('');
    setVolumeLevel(0);
    setHasDetectedAudio(false);
    stopAudio();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone access is not supported by your browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true }
      });
      streamRef.current = stream;

      const track = stream.getAudioTracks()[0];
      if (!track) {
        throw new Error('No audio input track was found.');
      }
      setDeviceLabel(track.label || 'Default Microphone');

      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) {
        throw new Error('Web Audio API is not supported in this browser.');
      }

      const ctx = new AudioCtxClass();
      audioCtxRef.current = ctx;

      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      let detected = false;
      let peak = 0;

      const updateMeter = () => {
        if (!analyser) return;
        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setVolumeLevel(normalized);

        if (normalized > 5) {
          detected = true;
          setHasDetectedAudio(true);
        }
        peak = Math.max(peak, normalized);

        animFrameRef.current = requestAnimationFrame(updateMeter);
      };

      updateMeter();

      setStatus('ready');
      if (onStatusChange) {
        onStatusChange({
          pass: true,
          details: {
            device: track.label || 'Microphone',
            ready: true,
            sampleRate: ctx.sampleRate
          }
        });
      }
    } catch (err) {
      console.warn('[MicrophoneDiagnostic] Error:', err);
      let humanMsg = 'Microphone access could not be acquired.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        humanMsg = 'Permission denied. Please allow microphone access in your browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        humanMsg = 'No audio input hardware detected. Please plug in a microphone.';
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
      stopAudio();
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
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-100">Microphone Input Level</h4>
            <p className="text-xs text-slate-400">Verifies acoustic input level and Web Audio stream</p>
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
            aria-label="Retry mic check"
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title="Recheck Microphone"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {status === 'ready' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="truncate max-w-[240px] font-medium text-slate-300">{deviceLabel}</span>
            <span className={hasDetectedAudio ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
              {hasDetectedAudio ? 'Voice activity detected' : 'Say something to test input'}
            </span>
          </div>

          {/* Volume visualizer meter */}
          <div className="w-full bg-slate-800/80 rounded-full h-3 overflow-hidden p-0.5 border border-slate-700/50">
            <div
              className={`h-full rounded-full transition-all duration-75 ${
                volumeLevel > 80 ? 'bg-gradient-to-r from-emerald-500 via-yellow-400 to-rose-500' :
                volumeLevel > 20 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' :
                'bg-slate-600'
              }`}
              style={{ width: `${Math.max(4, volumeLevel)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>Quiet</span>
            <span>Normal Speech</span>
            <span>Peak</span>
          </div>

          {/* Test Record and Playback Sandbox */}
          <div className="pt-2 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-slate-400">Microphone loopback test:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={startTestRecording}
                disabled={isTestRecording}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  isTestRecording
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30'
                }`}
              >
                {isTestRecording ? 'Recording (3s)...' : 'Record 3s Audio Test'}
              </button>
              {testAudioUrl && (
                <audio
                  src={testAudioUrl}
                  controls
                  className="h-7 max-w-[200px]"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
          <p className="font-medium mb-1 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            Microphone Check Failed
          </p>
          <p className="text-slate-300 pl-5.5">{errorMsg}</p>
        </div>
      )}
    </div>
  );
}

