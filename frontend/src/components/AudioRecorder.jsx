import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Mic, Square, RotateCcw, Send, Play, AlertCircle, Sparkles } from 'lucide-react';

export const AudioRecorder = forwardRef(({ 
  onRecordingComplete, 
  onRecordingStateChange, 
  isSubmitting,
  autoStartTrigger = false,
  isCompanyMode = false
}, ref) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [actualMimeType, setActualMimeType] = useState('audio/webm');

  const mediaRecorderRef = useRef(null);
  const timerRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const isRecordingRef = useRef(false);

  // Expose imperative triggers to parent
  useImperativeHandle(ref, () => ({
    startRecording,
    stopRecording,
    isRecording: () => isRecordingRef.current,
    hasRecording: () => !!audioBlob
  }));

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [audioUrl]);

  // Handle automated recording start trigger
  useEffect(() => {
    if (autoStartTrigger && !isRecording && !isSubmitting && !audioBlob) {
      const autoTimer = setTimeout(() => {
        startRecording();
      }, 400);
      return () => clearTimeout(autoTimer);
    }
  }, [autoStartTrigger, isSubmitting, audioBlob]);

  const startRecording = async () => {
    if (isRecordingRef.current || isSubmitting) return;

    setErrorMsg(null);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingDuration(0);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      streamRef.current = stream;

      // Notify parent of active recording and share stream for real-time visualization
      onRecordingStateChange?.({
        isRecording: true,
        stream
      });
      
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/wav')) {
        mimeType = 'audio/wav';
      }

      setActualMimeType(mimeType);
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const recordedBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(recordedBlob);
        const url = URL.createObjectURL(recordedBlob);
        setAudioUrl(url);

        // Stop all tracks to release mic
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        isRecordingRef.current = false;
        setIsRecording(false);

        onRecordingStateChange?.({
          isRecording: false,
          stream: null
        });

        // In company mode, automatically submit answer when candidate finishes speaking
        if (isCompanyMode && recordedBlob.size > 500 && onRecordingComplete) {
          onRecordingComplete(recordedBlob, mimeType);
        }
      };

      mediaRecorder.start(250);
      isRecordingRef.current = true;
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          // Automatic 120s limit safeguard
          if (prev >= 120) {
            stopRecording();
            return 120;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error("Microphone access error:", err);
      setErrorMsg("Microphone permission denied or not found. Please enable your microphone to record your answer.");
      isRecordingRef.current = false;
      setIsRecording(false);
      onRecordingStateChange?.({
        isRecording: false,
        stream: null
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecordingRef.current) {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn("MediaRecorder stop error:", e);
      }
      isRecordingRef.current = false;
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resetRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingDuration(0);
    setErrorMsg(null);
  };

  const handleSubmit = () => {
    if (audioBlob && onRecordingComplete) {
      onRecordingComplete(audioBlob, actualMimeType);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`rounded-2xl p-4 backdrop-blur-md relative overflow-hidden transition-all ${
      isCompanyMode ? 'bg-slate-900/60 border border-violet-500/20' : 'bg-slate-900/80 border border-slate-800'
    }`}>
      {errorMsg && (
        <div className="mb-3 p-3 bg-red-950/60 border border-red-500/40 rounded-xl flex items-center gap-2 text-red-200 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Left: Button & Timer */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isSubmitting}
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 shadow-md cursor-pointer disabled:opacity-50 flex-shrink-0 ${
              isRecording
                ? 'bg-rose-500 text-white ring-4 ring-rose-500/25 animate-pulse'
                : audioBlob
                ? 'bg-emerald-600 text-white ring-2 ring-emerald-500/30'
                : isCompanyMode
                ? 'bg-violet-600 hover:bg-violet-500 text-white ring-2 ring-violet-500/20'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white ring-2 ring-indigo-500/20'
            }`}
            title={isRecording ? "Click when finished speaking" : "Click to speak"}
            aria-label={isRecording ? "Stop recording answer" : "Start recording answer"}
          >
            {isRecording ? (
              <Square className="w-5 h-5 fill-current" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-mono font-bold text-white">
                {formatTime(recordingDuration)}
              </span>
              {isRecording && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                  Recording Live
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">
              {isRecording
                ? 'Candidate speaking... Click square or "Done Speaking" when finished.'
                : audioBlob
                ? `Response recorded (${Math.round(audioBlob.size / 1024)} KB). Submitting to Gnani Prisma...`
                : isCompanyMode
                ? 'Listening activates automatically after AI finishes question.'
                : 'Click microphone to begin your answer.'}
            </div>
          </div>
        </div>

        {/* Audio Player for review in Practice Mode */}
        {audioUrl && !isRecording && !isCompanyMode && (
          <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
            <audio src={audioUrl} controls className="h-7 w-48" />
          </div>
        )}

        {/* Right: Manual Trigger Controls (Done speaking / Retry in Practice) */}
        <div className="flex items-center gap-2">
          {isRecording && (
            <button
              type="button"
              onClick={stopRecording}
              className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Done Speaking</span>
            </button>
          )}

          {!isCompanyMode && audioBlob && !isRecording && (
            <button
              type="button"
              onClick={resetRecording}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Reset recording"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          )}

          {!isCompanyMode && audioBlob && !isRecording && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit Answer</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

AudioRecorder.displayName = 'AudioRecorder';
