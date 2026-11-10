import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Clock,
  Building2,
  CheckCircle2,
  Volume2,
  FileText,
  MessageSquare,
  Activity,
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  AlertTriangle,
  User,
  ShieldCheck,
  Send,
  Square,
  RotateCcw,
  Radio,
  SlidersHorizontal
} from 'lucide-react';
import { CameraMonitor } from './CameraMonitor';
import { AudioPlayer } from './AudioPlayer';
import { AIAvatar } from './AIAvatar';
import IntegrityMonitor from './secure_assess/IntegrityMonitor';
import { GnaniLogo } from './GnaniLogo';

export const LiveInterviewRoom = ({
  session,
  onAnswerSubmit,
  onIntegrityEvent,
  onEmergencyExit,
  onStreamPause,
  onStreamResume,
  isSubmitting,
  errorMessage
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const audioPlayerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  // Inactivity Detection State (30s first reminder, 15s second reminder, 30s auto-terminate)
  const [inactivitySeconds, setInactivitySeconds] = useState(0);
  const [inactivityPrompt, setInactivityPrompt] = useState(null);
  const [isTerminatedForInactivity, setIsTerminatedForInactivity] = useState(false);
  const inactivityTimerRef = useRef(null);

  // Audio & Avatar States (Phase 18 Unified Voice States: 'idle' | 'generating' | 'speaking' | 'listening' | 'transcribing' | 'evaluating' | 'error')
  const [activeAudioElement, setActiveAudioElement] = useState(null);
  const [voiceState, setVoiceState] = useState('speaking'); // Unified voice state
  const [micStream, setMicStream] = useState(null);
  const [isAutoplayBlocked, setIsAutoplayBlocked] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [recordingBlob, setRecordingBlob] = useState(null);

  // Side Drawer Tabs: 'chat' | 'transcript' | 'rubric'
  const [activeTab, setActiveTab] = useState('chat');

  const isCompanyMode = session.mode === 'company';
  const currentQuestion = session.question;

  // Elapsed interview timer
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSec) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Reset when question advances
  useEffect(() => {
    setActiveAudioElement(null);
    setIsAutoplayBlocked(false);
    setIsRecording(false);
    setRecordingBlob(null);
    setRecordDuration(0);
    setInactivitySeconds(0);
    setInactivityPrompt(null);
    setVoiceState('speaking');
    setLiveTranscript('');
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
  }, [session.current_index, currentQuestion.id]);

  // Inactivity Timer tracking candidate silence during response phase
  useEffect(() => {
    if (inactivityTimerRef.current) clearInterval(inactivityTimerRef.current);

    // Track inactivity when candidate should be speaking
    const shouldTrackInactivity = isCompanyMode && !isSubmitting && !isTerminatedForInactivity && (voiceState === 'idle' || voiceState === 'listening');

    if (shouldTrackInactivity) {
      inactivityTimerRef.current = setInterval(() => {
        setInactivitySeconds(prev => {
          const nextSec = prev + 1;
          if (nextSec === 30) {
            setInactivityPrompt("I haven't heard your response yet. Take your time or press Answer Question when you're ready.");
          } else if (nextSec === 45) {
            setInactivityPrompt("We are still waiting for your answer. The session will automatically close shortly if you do not respond.");
          } else if (nextSec >= 75) {
            handleInactivityAutoTermination();
          }
          return nextSec;
        });
      }, 1000);
    } else {
      setInactivitySeconds(0);
    }
  }, [isCompanyMode, isSubmitting, isTerminatedForInactivity, voiceState]);

    return () => {
      if (inactivityTimerRef.current) clearInterval(inactivityTimerRef.current);
    };
  }, [isCompanyMode, flowState, isSubmitting, isRecording, isTerminatedForInactivity]);

  const handleInactivityAutoTermination = async () => {
    setIsTerminatedForInactivity(true);
    if (inactivityTimerRef.current) clearInterval(inactivityTimerRef.current);
    try {
      await fetch('/api/session/terminate-inactivity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.session_id,
          inactivity_seconds: 75,
          reason: "Candidate remained silent for 75 seconds after multiple reminders"
        })
      });
    } catch (e) {
      console.warn("Could not submit inactivity termination:", e);
    }
    if (onEmergencyExit) {
      onEmergencyExit({
        session_id: session.session_id,
        reason: "TERMINATED_INACTIVITY: 75 seconds of silence"
      });
    }
  };

  // Coordinate evaluation/transcribing state during submission
  useEffect(() => {
    if (isSubmitting) {
      setVoiceState('transcribing');
      const evalTimer = setTimeout(() => {
        setVoiceState('evaluating');
      }, 1200);
      return () => clearTimeout(evalTimer);
    }
  }, [isSubmitting]);

  // Synchronize TTS play states
  const handleAudioPlayStateChange = useCallback((audioState) => {
    if (audioState === 'playing') {
      setIsAutoplayBlocked(false);
      setVoiceState('speaking');
    } else if (audioState === 'ended') {
      if (isSubmitting) {
        setVoiceState('evaluating');
      } else {
        setVoiceState('idle');
        if (isCompanyMode) {
          // Auto-start microphone for natural human conversation pacing
          setTimeout(() => {
            startLocalRecording();
          }, 350);
        }
      }
    } else if (audioState === 'paused' || audioState === 'error') {
      if (!isSubmitting) setVoiceState('idle');
    }
  }, [isCompanyMode, isSubmitting]);

  const handleAudioElementReady = useCallback((el) => {
    setActiveAudioElement(el);
  }, []);

  const handleAutoplayBlocked = useCallback((blocked) => {
    setIsAutoplayBlocked(blocked);
  }, []);

  const handleManualPlay = () => {
    const el = activeAudioElement || audioPlayerRef.current;
    if (el) {
      el.play().then(() => {
        setIsAutoplayBlocked(false);
        setVoiceState('speaking');
      }).catch(e => {
        console.warn("[Audio] Manual play failed:", e);
      });
    }
  };

  // Recording Engine
  const startLocalRecording = async () => {
    if (isRecording || isSubmitting) return;
    setInactivityPrompt(null);
    setInactivitySeconds(0);
    try {
      if (activeAudioElement && !activeAudioElement.paused) {
        activeAudioElement.pause();
      }
      setRecordingBlob(null);
      setRecordDuration(0);
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      setMicStream(stream);

      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const finalType = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: finalType });
        setRecordingBlob(blob);
        stream.getTracks().forEach(t => t.stop());
        setMicStream(null);
        setIsRecording(false);
        setVoiceState('transcribing');
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);

        // Auto submit in company mode
        if (blob && blob.size > 0) {
          onAnswerSubmit(blob);
        }
      };

      recorder.start(250);
      setIsRecording(true);
      setVoiceState('listening');

      recordingTimerRef.current = setInterval(() => {
        setRecordDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("[Recording] Failed to start:", err);
      setVoiceState('error');
    }
  };

  const stopLocalRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  return (
    <div className="fixed inset-0 bg-[#F5F7FA] text-[#172B45] flex flex-col z-50 overflow-hidden font-sans select-none antialiased">
      {/* Integrity Monitor */}
      <IntegrityMonitor
        sessionId={session.session_id}
        isActive={isCompanyMode}
        currentQuestionId={currentQuestion?.id}
        onEmergencyExit={onEmergencyExit}
      />

      {/* TOP HEADER: Clean Professional Call Bar */}
      <header className="h-14 border-b border-[#E2E8F0] bg-white px-4 sm:px-6 flex items-center justify-between flex-shrink-0 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <GnaniLogo variant="light" size="sm" />
          <div className="h-4 w-px bg-[#E2E8F0] hidden sm:block" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs sm:text-sm text-[#172B45] truncate">
                {session.role_name}
              </span>
              <span className="text-xs text-[#94A3B8]">•</span>
              <span className="text-xs text-[#64748B]">
                {session.company_name || 'Acme Tech'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-mono text-[#172B45]">
            <Clock className="w-3.5 h-3.5 text-[#64748B]" />
            <span>{formatTimer(elapsedSeconds)}</span>
          </div>

          <div className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#167C72]/10 text-[#167C72] hidden sm:block">
            Question {session.current_index} of {session.total_questions}
          </div>

          <button
            type="button"
            onClick={() => onEmergencyExit?.("Candidate requested to leave call")}
            className="px-3 py-1.5 rounded-md border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Leave Session</span>
          </button>
        </div>
      </header>

      {/* ERROR BANNER */}
      {errorMessage && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 flex items-center justify-between text-xs text-red-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* AUTOPLAY NOTICE */}
      {isAutoplayBlocked && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between text-xs text-amber-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>Audio playback paused by browser autoplay policy. Click to play.</span>
          </div>
          <button
            onClick={handleManualPlay}
            className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer shadow-sm"
          >
            Play Audio
          </button>
        </div>
      )}

      {/* MAIN MEETING STAGE */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 p-3 sm:p-4 gap-3 sm:gap-4 overflow-hidden">
        {/* VIDEO CALL STAGE (Side-by-Side Candidate & AI Interviewer) */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 gap-3">
          {/* Split Screen Video Layout */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 min-h-0">
            {/* Candidate Video Tile */}
            <div className="relative bg-[#0F172A] border border-[#CBD5E1] rounded-xl overflow-hidden flex flex-col justify-between shadow-sm min-h-[220px]">
              <div className="absolute inset-0 z-0">
                <CameraMonitor
                  mode={session.mode}
                  sessionId={session.session_id}
                  onIntegrityEvent={onIntegrityEvent}
                  onEmergencyExit={onEmergencyExit}
                  onStreamPause={onStreamPause}
                  onStreamResume={onStreamResume}
                />
              </div>

              {/* Candidate Tile Overlay */}
              <div className="relative z-10 p-3 flex items-center justify-between pointer-events-none">
                <div className="px-2.5 py-1 rounded bg-black/60 backdrop-blur-md text-[11px] font-medium text-white border border-white/10 flex items-center gap-1.5">
                  <User className="w-3 h-3 text-slate-300" />
                  <span>You (Candidate)</span>
                </div>
              </div>

              <div className="relative z-10 p-3 flex items-center justify-between pointer-events-none">
                <div className="px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-[10px] text-slate-300 font-mono border border-white/10">
                  {isRecording ? 'Speaking' : 'Listening'}
                </div>
              </div>
            </div>

            {/* AI Interviewer Wide Panoramic Panel (Phase 18 Redesign) */}
            <div className="relative rounded-xl overflow-hidden flex flex-col justify-between shadow-sm min-h-[220px]">
              <AIAvatar
                key={`avatar-${session.current_index}-${currentQuestion.id}`}
                state={voiceState}
                audioElement={activeAudioElement}
                audioRef={audioPlayerRef}
                micStream={micStream}
                isAutoplayBlocked={isAutoplayBlocked}
                onPlayRequest={handleManualPlay}
                isCompanyMode={isCompanyMode}
                questionText={currentQuestion?.title || ''}
                label="AI Technical Evaluator"
                errorMessage={errorMessage}
                onRetry={startLocalRecording}
                liveTranscript={liveTranscript}
              />
            </div>
          </div>

          {/* QUESTION PROMPT CARD */}
          <div className="saas-card p-4 flex-shrink-0 space-y-2">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#315C8C] flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5" />
                <span>Spoken Question</span>
                {session.question_audio_b64 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#167C72]/10 text-[#167C72] font-semibold lowercase">
                    timbre tts
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2">
                {currentQuestion.key_points && (
                  <div className="hidden sm:flex items-center gap-1">
                    {currentQuestion.key_points.slice(0, 3).map((kp, idx) => (
                      <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#64748B] font-mono border border-[#E2E8F0]">
                        #{kp}
                      </span>
                    ))}
                  </div>
                )}
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0]">
                  Difficulty: {currentQuestion.difficulty}
                </span>
              </div>
            </div>

            <p className="text-sm sm:text-base font-semibold text-[#172B45] leading-relaxed">
              {currentQuestion.title}
            </p>

            {/* Inactivity Reminder Notification */}
            {inactivityPrompt && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between gap-2 animate-fadeIn">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>{inactivityPrompt}</span>
                </div>
                <span className="font-mono text-[10px] font-semibold bg-white px-2 py-0.5 rounded border border-amber-300 text-amber-900">
                  {75 - inactivitySeconds}s remaining
                </span>
              </div>
            )}

            {/* Visible Audio Playback Controls if Autoplay was Blocked */}
            {isAutoplayBlocked && (
              <div className="p-2.5 rounded-lg bg-[#315C8C]/5 border border-[#315C8C]/20 flex items-center justify-between gap-2">
                <span className="text-xs text-[#315C8C] font-medium">Browser blocked autoplay for this question.</span>
                <button
                  type="button"
                  onClick={handleManualPlay}
                  className="px-3 py-1 rounded bg-[#315C8C] hover:bg-[#264A72] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Play Question Audio</span>
                </button>
              </div>
            )}
          </div>

          {/* CENTRAL CALL ACTION BAR */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 flex-shrink-0 shadow-sm">
            {/* Audio Feedback Details */}
            <div className="flex items-center gap-2 min-w-0">
              <span className={`w-2.5 h-2.5 rounded-full ${
                voiceState === 'listening' ? 'bg-emerald-500 animate-ping' :
                voiceState === 'transcribing' ? 'bg-sky-500 animate-pulse' :
                voiceState === 'evaluating' ? 'bg-amber-500 animate-pulse' :
                voiceState === 'speaking' ? 'bg-violet-500 animate-pulse' :
                voiceState === 'error' ? 'bg-rose-500' : 'bg-[#167C72]'
              }`} />
              <span className="text-xs text-[#172B45] font-medium truncate">
                {voiceState === 'listening' ? `Recording (${formatTimer(recordDuration)})` :
                 voiceState === 'transcribing' ? 'Transcribing spoken response...' :
                 voiceState === 'evaluating' ? 'Evaluating answer with AI...' :
                 voiceState === 'speaking' ? 'AI Interviewer speaking...' :
                 voiceState === 'error' ? 'Error during processing' : 'Microphone Ready'}
              </span>
            </div>

            {/* Central Call Actions */}
            <div className="flex items-center gap-2">
              {isRecording ? (
                <button
                  type="button"
                  onClick={stopLocalRecording}
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-[#315C8C] hover:bg-[#264A72] text-white font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>Done Speaking</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startLocalRecording}
                  disabled={isSubmitting || voiceState === 'transcribing' || voiceState === 'evaluating' || voiceState === 'speaking'}
                  className="px-5 py-2 rounded-lg bg-[#315C8C] hover:bg-[#264A72] disabled:opacity-50 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
                >
                  <Mic className="w-4 h-4" />
                  <span>
                    {voiceState === 'transcribing' ? 'Transcribing...' :
                     voiceState === 'evaluating' ? 'Evaluating...' :
                     voiceState === 'speaking' ? 'Listening to AI...' : 'Answer Question'}
                  </span>
                </button>
              )}

              {session.question_audio_b64 && (
                <button
                  type="button"
                  onClick={handleManualPlay}
                  className="p-2 rounded-lg bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#64748B] border border-[#CBD5E1] transition-colors cursor-pointer"
                  title="Replay Spoken Question"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Session Security Pill */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#64748B]">
              <ShieldCheck className="w-4 h-4 text-[#167C72]" />
              <span>Proctored Session</span>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE PANEL: Meeting Notes & Rubric */}
        <div className="w-full lg:w-80 xl:w-96 saas-card flex flex-col overflow-hidden flex-shrink-0 shadow-sm">
          {/* Tab Header */}
          <div className="flex items-center border-b border-[#E2E8F0] bg-[#F8FAFC] p-1.5 gap-1">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${activeTab === 'chat'
                  ? 'bg-white text-[#315C8C] shadow-sm border border-[#E2E8F0]'
                  : 'text-[#64748B] hover:text-[#172B45]'
                }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Live Chat</span>
            </button>
            <button
              onClick={() => setActiveTab('transcript')}
              className={`flex-1 py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${activeTab === 'transcript'
                  ? 'bg-white text-[#315C8C] shadow-sm border border-[#E2E8F0]'
                  : 'text-[#64748B] hover:text-[#172B45]'
                }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Transcript</span>
            </button>
            <button
              onClick={() => setActiveTab('insights')}
              className={`flex-1 py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${activeTab === 'insights'
                  ? 'bg-white text-[#315C8C] shadow-sm border border-[#E2E8F0]'
                  : 'text-[#64748B] hover:text-[#172B45]'
                }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Rubric</span>
            </button>
          </div>

          {/* Tab Content Container */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3">
            {activeTab === 'chat' && (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                  <div className="text-[10px] uppercase font-bold text-[#315C8C] flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    <span>AI Interviewer</span>
                  </div>
                  <p className="text-xs text-[#172B45] leading-relaxed">
                    {currentQuestion.title}
                  </p>
                </div>

                {session.last_evaluation && (
                  <div className="p-3 rounded-lg bg-white border border-[#E2E8F0] space-y-1.5 shadow-sm">
                    <div className="text-[10px] uppercase font-semibold text-[#167C72] flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Prior Response Score: {session.last_evaluation.overall_score}/100</span>
                    </div>
                    <p className="text-xs text-[#64748B] italic">
                      "{session.last_evaluation.transcript}"
                    </p>
                    <div className="text-xs text-[#315C8C] pt-1 font-medium">
                      {session.last_evaluation.spoken_feedback}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'transcript' && (
              <div className="space-y-2">
                <div className="text-[11px] text-[#64748B] flex items-center justify-between pb-1 border-b border-[#E2E8F0]">
                  <span>Gnani Prisma Verified STT</span>
                  <span className="font-mono text-[#167C72] text-[10px]">16kHz Audio</span>
                </div>
                {session.last_evaluation?.transcript ? (
                  <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#172B45] space-y-1">
                    <div className="text-[10px] text-[#64748B] font-mono">Q{session.current_index - 1} Candidate:</div>
                    <p className="italic">"{session.last_evaluation.transcript}"</p>
                  </div>
                ) : (
                  <div className="text-center py-10 text-xs text-[#94A3B8]">
                    Transcripts will populate as responses are processed by Gnani Prisma.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'insights' && (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                  <div className="text-xs font-semibold text-[#172B45]">Rubric Criteria</div>
                  {currentQuestion.context && (
                    <p className="text-xs text-[#64748B] leading-relaxed">
                      {currentQuestion.context}
                    </p>
                  )}
                  {currentQuestion.key_points?.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {currentQuestion.key_points.map((kp, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded bg-white text-[10px] text-[#315C8C] border border-[#E2E8F0] font-mono">
                          #{kp}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dedicated Audio Player Container (Ensuring In-DOM Playback & Audibility) */}
      {session.question_audio_b64 && (
        <div className="fixed bottom-3 right-3 z-50 max-w-sm w-full opacity-95">
          <AudioPlayer
            key={`audioplayer-${session.current_index}-${currentQuestion.id}`}
            ref={audioPlayerRef}
            base64Audio={session.question_audio_b64}
            autoPlay={true}
            label={`Interviewer Voice (${session.mode === 'practice' ? 'Practice' : 'Assessment'})`}
            onPlayStateChange={handleAudioPlayStateChange}
            onAutoplayBlocked={handleAutoplayBlocked}
            onAudioElementReady={handleAudioElementReady}
          />
        </div>
      )}
    </div>
  );
};
