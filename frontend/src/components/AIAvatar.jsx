import React, { useRef, useEffect, useState } from 'react';
import {
  Volume2,
  Mic,
  Sparkles,
  Play,
  RotateCw,
  AlertCircle,
  Activity,
  Layers,
  Cpu
} from 'lucide-react';

/**
 * AIAvatar Component (Phase 18 Redesign)
 *
 * Siri-Inspired Fluid Animated Voice Visualizer for Gnani VoicePrep AI.
 * Redesigned into a panoramic, edge-to-edge dark navy/deep charcoal panel (#0B1120 / #0F172A)
 * with subtle purple/blue reactive lighting.
 *
 * Supported Voice States:
 * - 'idle': Soft glowing central orb or fluid waveform, slow subtle breathing animation.
 * - 'generating': Animated processing indicator with rotating gradient aura.
 * - 'speaking': Real audio waveform & particles in sync with Gnani Timbre TTS playback via AnalyserNode.
 * - 'listening': Fluid wave animation reacting to candidate's real microphone stream energy.
 * - 'transcribing': Clear transcription progress indicator.
 * - 'evaluating': Structured rubric assessment state with neural pulse rings.
 * - 'error': Clear error state with actionable retry mechanism.
 */
export const AIAvatar = ({
  state = 'idle', // 'idle' | 'generating' | 'speaking' | 'listening' | 'transcribing' | 'evaluating' | 'error' | 'thinking'
  audioElement = null, // HTMLAudioElement for Gnani Timbre TTS
  audioRef = null, // Backwards-compatible ref
  micStream = null, // MediaStream for candidate microphone
  isAutoplayBlocked = false,
  onPlayRequest = null,
  isCompanyMode = false,
  questionText = '',
  speakingProgress = 0,
  label = 'AI Interviewer',
  errorMessage = null,
  onRetry = null,
  liveTranscript = ''
}) => {
  // Normalize legacy 'thinking' to 'evaluating'
  const normalizedState = state === 'thinking' ? 'evaluating' : state;

  const [audioEnergy, setAudioEnergy] = useState(0);
  const [analyserActive, setAnalyserActive] = useState(false);
  const canvasRef = useRef(null);

  const audioCtxRef = useRef(null);
  const connectedAudioElRef = useRef(null);
  const audioSourceNodeRef = useRef(null);
  const micSourceNodeRef = useRef(null);
  const audioAnalyserRef = useRef(null);
  const micAnalyserRef = useRef(null);
  const rafIdRef = useRef(null);
  const animTimeRef = useRef(0);

  const activeAudioEl = audioElement || audioRef?.current || null;

  // Reduced motion preference
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mediaQuery.matches);
      const listener = (e) => setPrefersReducedMotion(e.matches);
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, []);

  // Safe Web Audio Context accessor
  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
    }
    return audioCtxRef.current;
  };

  const resumeAudioContext = async () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      try {
        await ctx.resume();
        console.info("[Audio Pipeline] AudioContext resumed on user gesture. State:", ctx.state);
      } catch (e) {
        console.warn("[Audio Pipeline] AudioContext resume note:", e);
      }
    }
  };

  const handleUserPlay = async () => {
    await resumeAudioContext();
    onPlayRequest?.();
  };

  // 1. Hook up Speaking State Audio Analyser (Gnani Timbre TTS)
  useEffect(() => {
    if (normalizedState !== 'speaking' || !activeAudioEl) {
      if (normalizedState !== 'listening') setAudioEnergy(0);
      setAnalyserActive(false);
      return;
    }

    const ctx = getAudioContext();
    if (!ctx) {
      setAnalyserActive(false);
      return;
    }

    try {
      if (!audioAnalyserRef.current) {
        audioAnalyserRef.current = ctx.createAnalyser();
        audioAnalyserRef.current.fftSize = 128;
        audioAnalyserRef.current.smoothingTimeConstant = 0.8;
      }

      if (connectedAudioElRef.current !== activeAudioEl) {
        try {
          audioSourceNodeRef.current = ctx.createMediaElementSource(activeAudioEl);
          audioSourceNodeRef.current.connect(audioAnalyserRef.current);
          audioAnalyserRef.current.connect(ctx.destination);
          connectedAudioElRef.current = activeAudioEl;
          console.info("[Audio Pipeline] Connected audio element to Web Audio analyser graph.");
        } catch (err) {
          console.warn("[Audio Pipeline] Audio node connection note:", err.message);
        }
      }

      setAnalyserActive(true);
    } catch (e) {
      console.warn("[Audio Pipeline] Speaking audio analyser setup note:", e);
      setAnalyserActive(false);
    }
  }, [normalizedState, activeAudioEl]);

  // 2. Hook up Listening State Audio Analyser (Candidate Mic Stream)
  useEffect(() => {
    if (normalizedState !== 'listening' || !micStream) {
      if (normalizedState !== 'speaking') setAudioEnergy(0);
      return;
    }

    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      if (!micAnalyserRef.current) {
        micAnalyserRef.current = ctx.createAnalyser();
        micAnalyserRef.current.fftSize = 128;
        micAnalyserRef.current.smoothingTimeConstant = 0.75;
      }

      if (!micSourceNodeRef.current) {
        try {
          micSourceNodeRef.current = ctx.createMediaStreamSource(micStream);
          micSourceNodeRef.current.connect(micAnalyserRef.current);
          // Crucial: do NOT connect to ctx.destination to avoid mic feedback loop
        } catch (err) {
          console.warn("[Audio Pipeline] Mic stream connect note:", err.message);
        }
      }

      setAnalyserActive(true);
    } catch (e) {
      console.warn("[Audio Pipeline] Mic stream analyser setup note:", e);
    }
  }, [normalizedState, micStream]);

  // 3. Siri-Inspired Fluid Canvas Visualizer Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isRunning = true;
    const freqData = new Uint8Array(64);

    const renderFrame = () => {
      if (!isRunning) return;
      animTimeRef.current += 0.03;
      const t = animTimeRef.current;

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      let currentEnergy = 0;

      // Extract real audio energy
      if (normalizedState === 'speaking' && audioAnalyserRef.current && activeAudioEl && !activeAudioEl.paused && !activeAudioEl.ended) {
        audioAnalyserRef.current.getByteFrequencyData(freqData);
        let sum = 0;
        for (let i = 2; i < 20; i++) sum += freqData[i];
        currentEnergy = Math.min(1, Math.max(0, (sum / 18) / 130));
        setAudioEnergy(currentEnergy);
      } else if (normalizedState === 'listening' && micAnalyserRef.current) {
        micAnalyserRef.current.getByteFrequencyData(freqData);
        let sum = 0;
        for (let i = 0; i < 30; i++) sum += freqData[i];
        currentEnergy = Math.min(1, Math.max(0, (sum / 30) / 120));
        setAudioEnergy(currentEnergy);
      } else {
        setAudioEnergy(0);
      }

      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = Math.min(width, height) * 0.22;

      // Draw Siri-style multi-layered fluid wave ribbons
      const waveCount = normalizedState === 'speaking' || normalizedState === 'listening' ? 4 : 2;
      const palette = getWavePalette(normalizedState);

      for (let w = 0; w < waveCount; w++) {
        ctx.beginPath();
        const waveOffset = (w * Math.PI) / waveCount;
        const speed = prefersReducedMotion ? 0.3 : 1.0;
        const energyAmp = currentEnergy * (height * 0.16);
        const idleAmp = normalizedState === 'idle' ? 6 : 14;
        const totalAmp = idleAmp + energyAmp;

        ctx.moveTo(0, centerY);
        for (let x = 0; x <= width; x += 12) {
          const normX = x / width;
          // Gaussian envelope to keep waves centered
          const envelope = Math.exp(-Math.pow((normX - 0.5) * 3.5, 2));
          const freq = 0.015 + (w * 0.005);
          const y = centerY + Math.sin(x * freq + t * speed * (w % 2 === 0 ? 1 : -1) + waveOffset) * totalAmp * envelope;
          ctx.lineTo(x, y);
        }

        ctx.strokeStyle = palette[w % palette.length];
        ctx.lineWidth = w === 0 ? 3.5 : 2;
        ctx.lineCap = 'round';
        ctx.shadowColor = palette[w % palette.length];
        ctx.shadowBlur = normalizedState === 'speaking' || normalizedState === 'listening' ? 16 + currentEnergy * 24 : 8;
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      // Draw Center Glowing Orb / Siri Core
      const pulseScale = prefersReducedMotion ? 1 : 1 + currentEnergy * 0.28 + (normalizedState === 'idle' ? Math.sin(t * 1.5) * 0.04 : 0);
      const orbRadius = baseRadius * pulseScale;

      const grad = ctx.createRadialGradient(
        centerX, centerY, orbRadius * 0.1,
        centerX, centerY, orbRadius * 1.4
      );

      if (normalizedState === 'speaking') {
        grad.addColorStop(0, 'rgba(168, 85, 247, 0.95)');   // Purple
        grad.addColorStop(0.45, 'rgba(99, 102, 241, 0.7)'); // Indigo
        grad.addColorStop(0.8, 'rgba(56, 189, 248, 0.35)'); // Sky blue
        grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      } else if (normalizedState === 'listening') {
        grad.addColorStop(0, 'rgba(52, 211, 153, 0.95)');   // Emerald
        grad.addColorStop(0.5, 'rgba(16, 185, 129, 0.65)'); // Teal
        grad.addColorStop(0.85, 'rgba(6, 182, 212, 0.35)'); // Cyan
        grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      } else if (normalizedState === 'evaluating') {
        grad.addColorStop(0, 'rgba(251, 191, 36, 0.95)');   // Amber
        grad.addColorStop(0.5, 'rgba(245, 158, 11, 0.65)'); // Orange
        grad.addColorStop(0.85, 'rgba(217, 119, 6, 0.3)');
        grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      } else if (normalizedState === 'generating' || normalizedState === 'transcribing') {
        grad.addColorStop(0, 'rgba(96, 165, 250, 0.95)');   // Blue
        grad.addColorStop(0.5, 'rgba(129, 140, 248, 0.6)'); // Indigo
        grad.addColorStop(0.85, 'rgba(147, 51, 234, 0.3)'); // Purple
        grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      } else if (normalizedState === 'error') {
        grad.addColorStop(0, 'rgba(244, 63, 94, 0.95)');    // Rose
        grad.addColorStop(0.5, 'rgba(225, 29, 72, 0.6)');
        grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      } else {
        // Idle calm glow
        grad.addColorStop(0, 'rgba(129, 140, 248, 0.7)');
        grad.addColorStop(0.5, 'rgba(99, 102, 241, 0.35)');
        grad.addColorStop(0.9, 'rgba(59, 130, 246, 0.12)');
        grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      }

      ctx.beginPath();
      ctx.arc(centerX, centerY, orbRadius * 1.4, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // State-specific orbital rings
      if (normalizedState === 'generating' || normalizedState === 'evaluating' || normalizedState === 'transcribing') {
        ctx.beginPath();
        const spinSpeed = t * 2.2;
        ctx.arc(centerX, centerY, orbRadius * 1.1, spinSpeed, spinSpeed + Math.PI * 1.3);
        ctx.strokeStyle = normalizedState === 'evaluating' ? 'rgba(251, 191, 36, 0.85)' : 'rgba(56, 189, 248, 0.85)';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      rafIdRef.current = requestAnimationFrame(renderFrame);
    };

    rafIdRef.current = requestAnimationFrame(renderFrame);

    return () => {
      isRunning = false;
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [normalizedState, activeAudioEl, micStream, prefersReducedMotion]);

  // Color palette helper
  const getWavePalette = (st) => {
    switch (st) {
      case 'speaking':
        return [
          'rgba(192, 132, 252, 0.85)', // Light Purple
          'rgba(129, 140, 248, 0.75)', // Indigo
          'rgba(56, 189, 248, 0.7)',   // Sky Blue
          'rgba(232, 121, 249, 0.65)'  // Fuchsia
        ];
      case 'listening':
        return [
          'rgba(52, 211, 153, 0.85)',  // Emerald
          'rgba(45, 212, 191, 0.75)',  // Teal
          'rgba(56, 189, 248, 0.7)',   // Sky Blue
          'rgba(110, 231, 183, 0.6)'
        ];
      case 'evaluating':
        return [
          'rgba(251, 191, 36, 0.85)',  // Amber
          'rgba(245, 158, 11, 0.75)',  // Orange
          'rgba(252, 211, 77, 0.6)'
        ];
      case 'generating':
      case 'transcribing':
        return [
          'rgba(56, 189, 248, 0.85)',  // Sky Blue
          'rgba(129, 140, 248, 0.75)', // Indigo
          'rgba(168, 85, 247, 0.65)'
        ];
      case 'error':
        return [
          'rgba(244, 63, 94, 0.85)',   // Rose
          'rgba(251, 113, 133, 0.7)'
        ];
      case 'idle':
      default:
        return [
          'rgba(129, 140, 248, 0.55)',
          'rgba(99, 102, 241, 0.4)'
        ];
    }
  };

  // State Badge Info with backward-compatible text strings
  const getStateBadge = () => {
    switch (normalizedState) {
      case 'speaking':
        return {
          shortText: isCompanyMode ? 'Speaking' : 'Speaking (Gnani Timbre)',
          fullText: 'AI Interviewer speaking with Gnani Timbre vocal synthesis',
          color: 'text-violet-300 bg-violet-500/20 border-violet-500/40',
          dot: 'bg-violet-400'
        };
      case 'listening':
        return {
          shortText: isCompanyMode ? 'Listening' : 'Listening to your answer',
          fullText: 'Microphone active — candidate voice input stream',
          color: 'text-emerald-300 bg-emerald-500/20 border-emerald-500/40',
          dot: 'bg-emerald-400'
        };
      case 'transcribing':
        return {
          shortText: 'Transcribing',
          fullText: 'Gnani Prisma 16kHz STT transcribing spoken response...',
          color: 'text-sky-300 bg-sky-500/20 border-sky-500/40',
          dot: 'bg-sky-400'
        };
      case 'evaluating':
        return {
          shortText: isCompanyMode ? 'Evaluating' : 'Analyzing evaluation rubric...',
          fullText: 'Scoring response against standardized competency rubrics',
          color: 'text-amber-300 bg-amber-500/20 border-amber-500/40',
          dot: 'bg-amber-400'
        };
      case 'generating':
        return {
          shortText: 'Preparing Response',
          fullText: 'Adaptive engine formulating contextual question...',
          color: 'text-blue-300 bg-blue-500/20 border-blue-500/40',
          dot: 'bg-blue-400'
        };
      case 'error':
        return {
          shortText: 'Error',
          fullText: errorMessage || 'An error occurred during audio processing',
          color: 'text-rose-300 bg-rose-500/20 border-rose-500/40',
          dot: 'bg-rose-400'
        };
      case 'idle':
      default:
        return {
          shortText: isCompanyMode ? 'Ready' : 'AI Technical Evaluator Ready',
          fullText: 'AI Interviewer ready for next response',
          color: 'text-slate-400 bg-white/[0.04] border-white/[0.08]',
          dot: 'bg-slate-400'
        };
    }
  };

  const badge = getStateBadge();

  return (
    <div
      className="relative w-full h-full min-h-[260px] rounded-2xl overflow-hidden bg-gradient-to-b from-[#0F172A] via-[#0B1120] to-[#020617] border border-slate-800 shadow-xl flex flex-col justify-between p-4 sm:p-5 select-none"
      role="region"
      aria-label="AI Interviewer Avatar"
    >
      {/* Background ambient lighting */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-500 opacity-60"
        style={{
          background: normalizedState === 'speaking'
            ? 'radial-gradient(circle at 50% 45%, rgba(139, 92, 246, 0.22) 0%, transparent 65%)'
            : normalizedState === 'listening'
              ? 'radial-gradient(circle at 50% 45%, rgba(16, 185, 129, 0.22) 0%, transparent 65%)'
              : normalizedState === 'evaluating'
                ? 'radial-gradient(circle at 50% 45%, rgba(245, 158, 11, 0.22) 0%, transparent 65%)'
                : 'radial-gradient(circle at 50% 45%, rgba(99, 102, 241, 0.12) 0%, transparent 65%)'
        }}
      />

      {/* TOP HEADER: Wide Panel Bar */}
      <div className="relative z-10 w-full flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <Cpu className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-bold text-white truncate flex items-center gap-2">
              <span>{label}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-normal">
                Gnani Timbre
              </span>
            </h4>
            <span className="text-[10px] text-slate-400 block -mt-0.5">
              Live Conversational AI Interviewer
            </span>
          </div>
        </div>

        {/* State Badge */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border backdrop-blur-md transition-all shrink-0 cursor-help ${badge.color}`}
          title={badge.fullText}
          aria-live="polite"
        >
          <span className={`w-2 h-2 rounded-full ${badge.dot} ${normalizedState !== 'idle' ? 'animate-pulse' : ''}`} />
          <span>{badge.shortText}</span>
        </div>
      </div>

      {/* CENTER VISUALIZER STAGE */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full my-auto min-h-[140px]">
        <canvas
          ref={canvasRef}
          width={640}
          height={200}
          className="w-full max-w-xl h-36 sm:h-44 object-contain"
        />

        {/* Autoplay restriction fallback trigger */}
        {isAutoplayBlocked && (
          <button
            onClick={handleUserPlay}
            className="absolute z-20 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl text-xs flex items-center gap-2 shadow-2xl ring-4 ring-indigo-500/40 animate-bounce transition-all cursor-pointer"
            title="Click to hear question audio"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Tap to Hear Question</span>
          </button>
        )}

        {/* Error Retry Overlay */}
        {normalizedState === 'error' && (
          <div className="absolute z-20 flex flex-col items-center gap-2 bg-slate-900/90 border border-rose-500/30 p-3 rounded-xl max-w-xs text-center backdrop-blur-md">
            <div className="flex items-center gap-1.5 text-rose-400 text-xs font-semibold">
              <AlertCircle className="w-4 h-4" />
              <span>{errorMessage || 'Audio processing error'}</span>
            </div>
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RotateCw className="w-3 h-3" />
                <span>Retry Recording</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* BOTTOM FOOTER / LIVE SPEECH SUBTITLE */}
      <div className="relative z-10 w-full pt-1">
        {questionText ? (
          <div className="w-full bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 backdrop-blur-md flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Volume2 className="w-4 h-4 text-indigo-400 shrink-0" />
              <p className="text-xs sm:text-sm font-medium text-slate-200 truncate">
                "{questionText}"
              </p>
            </div>
            {normalizedState === 'speaking' && (
              <span className="text-[10px] text-indigo-400 font-mono shrink-0 hidden sm:inline">
                Audio Synced
              </span>
            )}
          </div>
        ) : liveTranscript ? (
          <div className="w-full bg-slate-950/60 rounded-xl p-2.5 border border-slate-800/80 backdrop-blur-md flex items-center gap-2 text-xs text-slate-300">
            <Mic className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="italic truncate">"{liveTranscript}"</span>
          </div>
        ) : (
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span>Powered by Gnani Timbre & Prisma Neural Speech</span>
            <span className="font-mono text-[10px] text-slate-500">16kHz High-Fidelity</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIAvatar;
