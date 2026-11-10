import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Volume2, VolumeX, RotateCcw } from 'lucide-react';

/**
 * Enhanced AudioPlayer component for Gnani Timbre TTS playback.
 * Supports:
 * - Exposing internal HTMLAudioElement to parent components via forwardRef and onAudioElementReady.
 * - Explicit playback controls (Play, Pause, Replay).
 * - Safe handling of browser autoplay restrictions without breaking native sound.
 * - Notifying parent of audio playback state changes.
 */
export const AudioPlayer = forwardRef(({
  base64Audio,
  autoPlay = false,
  label = "Interviewer Voice Question (Gnani Timbre)",
  onPlayStateChange = null,
  onAutoplayBlocked = null,
  onAudioElementReady = null
}, ref) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasAutoplayFailed, setHasAutoplayFailed] = useState(false);
  const internalAudioRef = useRef(null);
  const lastLoadedSrcRef = useRef(null);

  // Keep references to incoming callbacks so their reference changes do not trigger effects
  const callbacksRef = useRef({ onPlayStateChange, onAutoplayBlocked, onAudioElementReady });
  useEffect(() => {
    callbacksRef.current = { onPlayStateChange, onAutoplayBlocked, onAudioElementReady };
  });

  // Expose internal audio element to parent imperative ref
  useImperativeHandle(ref, () => internalAudioRef.current);

  const audioSrc = React.useMemo(() => {
    if (!base64Audio) return null;
    return base64Audio.startsWith('data:')
      ? base64Audio
      : `data:audio/wav;base64,${base64Audio}`;
  }, [base64Audio]);

  // Expose element to parent once on mount or when audio element changes
  useEffect(() => {
    const el = internalAudioRef.current;
    if (el) {
      callbacksRef.current.onAudioElementReady?.(el);
    }
  }, []);

  // 1. Audio event listeners: Attached once to HTMLAudioElement
  useEffect(() => {
    const el = internalAudioRef.current;
    if (!el) return;

    const handlePlay = () => {
      setIsPlaying(true);
      setHasAutoplayFailed(false);
      callbacksRef.current.onAutoplayBlocked?.(false);
      callbacksRef.current.onPlayStateChange?.('playing');
    };

    const handlePause = () => {
      setIsPlaying(false);
      callbacksRef.current.onPlayStateChange?.('paused');
    };

    const handleEnded = () => {
      setIsPlaying(false);
      callbacksRef.current.onPlayStateChange?.('ended');
    };

    const handleError = (e) => {
      console.warn("[Audio Pipeline] Audio element error encountered:", e);
      setIsPlaying(false);
      callbacksRef.current.onPlayStateChange?.('error');
    };

    el.addEventListener('play', handlePlay);
    el.addEventListener('pause', handlePause);
    el.addEventListener('ended', handleEnded);
    el.addEventListener('error', handleError);

    return () => {
      el.removeEventListener('play', handlePlay);
      el.removeEventListener('pause', handlePause);
      el.removeEventListener('ended', handleEnded);
      el.removeEventListener('error', handleError);
    };
  }, []);

  // 2. Track loading and autoplay: ONLY runs when audioSrc or autoPlay actually changes
  useEffect(() => {
    const el = internalAudioRef.current;
    if (!el || !audioSrc) return;

    // Only reset and trigger autoplay if this is a genuinely new audio source
    if (lastLoadedSrcRef.current === audioSrc) {
      return;
    }
    lastLoadedSrcRef.current = audioSrc;

    // Reset state for new audio track
    setIsPlaying(false);
    setHasAutoplayFailed(false);

    if (autoPlay) {
      let cancelled = false;
      const timer = setTimeout(() => {
        if (cancelled) return;

        // Ensure any active AudioContext is resumed before attempting play
        try {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) {
            const ctx = new AudioCtx();
            if (ctx.state === 'suspended') {
              ctx.resume().catch(() => {});
            }
          }
        } catch (e) {}

        const playPromise = el.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            if (!cancelled) {
              console.info("[Audio Pipeline] Autoplay succeeded on question track.");
              setHasAutoplayFailed(false);
              callbacksRef.current.onAutoplayBlocked?.(false);
            }
          }).catch((err) => {
            if (!cancelled) {
              console.warn("[Audio Pipeline] Autoplay policy prevented playback. Manual user trigger required:", err.name);
              setHasAutoplayFailed(true);
              callbacksRef.current.onAutoplayBlocked?.(true);
              callbacksRef.current.onPlayStateChange?.('paused');
            }
          });
        }
      }, 50);

      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }
  }, [audioSrc, autoPlay]);

  if (!base64Audio) return null;

  const togglePlayback = () => {
    if (!internalAudioRef.current) return;
    if (isPlaying) {
      internalAudioRef.current.pause();
    } else {
      internalAudioRef.current.play().then(() => {
        setHasAutoplayFailed(false);
        onAutoplayBlocked?.(false);
      }).catch(e => {
        console.warn("[Audio Pipeline] Manual audio playback error:", e);
      });
    }
  };

  const replayAudio = () => {
    if (!internalAudioRef.current) return;
    internalAudioRef.current.currentTime = 0;
    internalAudioRef.current.play().then(() => {
      setHasAutoplayFailed(false);
      onAutoplayBlocked?.(false);
    }).catch(e => {
      console.warn("[Audio Pipeline] Replay audio error:", e);
    });
  };

  return (
    <div className="bg-slate-900/90 border border-white/[0.08] rounded-2xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md backdrop-blur-md">
      <audio
        ref={internalAudioRef}
        src={audioSrc}
        preload="auto"
      />

      <div className="flex items-center gap-3 w-full sm:w-auto min-w-0">
        <button
          onClick={togglePlayback}
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-sm cursor-pointer flex-shrink-0 ${isPlaying
              ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 ring-2 ring-amber-500/30'
              : 'bg-violet-600 hover:bg-violet-500 text-white ring-2 ring-violet-500/20'
            }`}
          title={isPlaying ? "Pause Spoken Question" : "Play Spoken Question"}
          aria-label={isPlaying ? "Pause Spoken Question" : "Play Spoken Question"}
        >
          {isPlaying ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-violet-200 truncate">{label}</div>
          <div className="text-[11px] text-slate-400 truncate">
            {isPlaying
              ? "Speaking with real Gnani Timbre voice synthesis..."
              : hasAutoplayFailed
                ? "Audio ready. Click to play."
                : "Natural speech synthesis playback"}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={replayAudio}
          className="p-1.5 px-2.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-slate-300 hover:text-white transition-all text-xs flex items-center gap-1 cursor-pointer"
          title="Replay from beginning"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Replay</span>
        </button>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          Timbre Active
        </span>
      </div>
    </div>
  );
});

AudioPlayer.displayName = 'AudioPlayer';
