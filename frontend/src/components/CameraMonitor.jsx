import React, { useRef, useEffect, useState } from 'react';
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  AlertCircle,
  ShieldAlert,
  CheckCircle2,
  Users,
  PauseCircle,
  LogOut,
  Trash2,
  HelpCircle,
  UserCheck,
  UserX,
  Smartphone,
  Laptop,
  BookOpen,
  Activity,
  Layers,
  Eye
} from 'lucide-react';
import { RobustFaceTracker } from '../utils/faceTracker';
import { MediaPipeObjectTracker } from '../utils/objectTracker';

export const CameraMonitor = ({
  mode = "practice",
  sessionId,
  onIntegrityEvent,
  onEmergencyExit,
  onStreamPause,
  onStreamResume
}) => {
  const videoRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const faceTrackerRef = useRef(null);
  const objectTrackerRef = useRef(null);

  const [hasPermission, setHasPermission] = useState(false);
  const [permissionError, setPermissionError] = useState(null);
  const [isCameraMuted, setIsCameraMuted] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [micVolume, setMicVolume] = useState(0);

  // STAGE 1 & 2: Face & Person & Object States
  const [faceDetectionState, setFaceDetectionState] = useState('One face detected');
  const [detectedFacesCount, setDetectedFacesCount] = useState(1);
  const [personState, setPersonState] = useState('one person');
  const [detectedPeopleCount, setDetectedPeopleCount] = useState(1);
  const [detectedObjects, setDetectedObjects] = useState([]);
  const [neutralNotice, setNeutralNotice] = useState(null);
  const [lightingStatus, setLightingStatus] = useState('Optimal'); // 'Low Light' | 'Optimal' | 'Overexposed'
  const [lightingValue, setLightingValue] = useState(128);

  // Performance metrics
  const [inferenceFps, setInferenceFps] = useState(4);
  const [isHardwarePaused, setIsHardwarePaused] = useState(false);

  // Practice mode local recording & preview controls
  const [practiceRecordingBlob, setPracticeRecordingBlob] = useState(null);
  const [practicePreviewUrl, setPracticePreviewUrl] = useState(null);
  const [isPracticeRecording, setIsPracticeRecording] = useState(false);
  const practiceMediaRecorderRef = useRef(null);
  const practiceChunksRef = useRef([]);

  // 1. Initialize Media Streams (Low-bandwidth 480p @ 15fps)
  useEffect(() => {
    let audioContext = null;
    let analyser = null;
    let micSource = null;
    let animId = null;

    const startMedia = async () => {
      try {
        const constraints = {
          video: {
            width: { ideal: 640, max: 640 },
            height: { ideal: 480, max: 480 },
            frameRate: { ideal: 15, max: 15 },
            facingMode: 'user'
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true
          }
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        setHasPermission(true);
        setPermissionError(null);
        setIsHardwarePaused(false);

        // Hardware disconnection listeners
        stream.getVideoTracks().forEach(track => {
          track.onended = () => handleDisconnection("Camera video track ended or disconnected.");
          track.onmute = () => handleDisconnection("Camera hardware feed was muted by operating system.");
        });

        // Initialize Face Tracker (BlazeFace) & Object Tracker (EfficientDet)
        faceTrackerRef.current = new RobustFaceTracker();
        faceTrackerRef.current.initialize().catch(e => console.warn("Face tracker init:", e));

        objectTrackerRef.current = new MediaPipeObjectTracker();
        objectTrackerRef.current.initialize().catch(e => console.warn("Object tracker init:", e));

        // Audio visualizer
        try {
          audioContext = new (window.AudioContext || window.webkitAudioContext)();
          analyser = audioContext.createAnalyser();
          analyser.fftSize = 64;
          micSource = audioContext.createMediaStreamSource(stream);
          micSource.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateVolume = () => {
            if (!analyser) return;
            analyser.getByteFrequencyData(dataArray);
            const sum = dataArray.reduce((acc, val) => acc + val, 0);
            const avg = sum / dataArray.length;
            setMicVolume(Math.min(100, Math.round((avg / 128) * 100)));
            animId = requestAnimationFrame(updateVolume);
          };
          updateVolume();
        } catch (e) {
          console.warn("Audio meter skipped:", e);
        }
      } catch (err) {
        console.error("Camera/Mic access error:", err);
        setPermissionError("Camera or microphone permission is required. Please check your browser device permissions.");
        setHasPermission(false);
        handleDisconnection("Permission denied or camera device absent.");
      }
    };

    startMedia();

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (audioContext) audioContext.close();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (practicePreviewUrl) URL.revokeObjectURL(practicePreviewUrl);
    };
  }, []);

  const handleDisconnection = (reason) => {
    setIsHardwarePaused(true);
    setNeutralNotice(`Camera notice: ${reason}`);
    onStreamPause?.(reason);
    onIntegrityEvent?.({
      category: "confirmed_technical_event",
      event_type: "camera_disconnected",
      detail: reason,
      duration_seconds: 0.0
    });
  };

  const attemptStreamRecovery = async () => {
    setIsHardwarePaused(false);
    setNeutralNotice("Attempting to restore camera stream...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, frameRate: 15 },
        audio: true
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setHasPermission(true);
      setPermissionError(null);
      setNeutralNotice("Stream restored.");
      onStreamResume?.();
      onIntegrityEvent?.({
        category: "confirmed_technical_event",
        event_type: "stream_resumed",
        detail: "Media hardware reconnected successfully.",
        duration_seconds: 0.0
      });
      setTimeout(() => setNeutralNotice(null), 3000);
    } catch (e) {
      handleDisconnection("Reconnection failed: Device not ready.");
    }
  };

  // 2. Tab & Focus Listeners
  useEffect(() => {
    let hideStartTime = null;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        hideStartTime = performance.now();
        setNeutralNotice("Notice: Interview tab moved to background.");
        onIntegrityEvent?.({
          category: "confirmed_technical_event",
          event_type: "tab_hidden",
          detail: "Browser tab switched to background or minimized.",
          duration_seconds: 0.0
        });
      } else {
        const durationSec = hideStartTime ? Math.round((performance.now() - hideStartTime) / 1000) : 0;
        setNeutralNotice("Notice: Interview tab focused again.");
        onIntegrityEvent?.({
          category: "confirmed_technical_event",
          event_type: "tab_visible",
          detail: `Browser tab restored after ${durationSec}s.`,
          duration_seconds: durationSec
        });
        setTimeout(() => setNeutralNotice(null), 4000);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [sessionId, onIntegrityEvent]);

  // 3. Combined Local Computer Vision Loop (Runs ~3-4 FPS to preserve CPU/GPU)
  useEffect(() => {
    if (!hasPermission || isCameraMuted || isHardwarePaused) return;

    let priorPeopleCount = 1;
    let priorPhoneDetected = false;

    const interval = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;
      const video = videoRef.current;

      // 1. Face Tracker (MediaPipe BlazeFace + NMS)
      let faceRes = { state: 'One face detected', faceCount: 1, faces: [] };
      if (faceTrackerRef.current) {
        faceRes = await faceTrackerRef.current.analyzeFrame(video);
        setFaceDetectionState(faceRes.state);
        setDetectedFacesCount(faceRes.faceCount);
      }

      // 2. Object & Person Tracker (MediaPipe EfficientDet)
      let objRes = { personCount: 1, personState: 'one person', objects: [] };
      if (objectTrackerRef.current) {
        objRes = await objectTrackerRef.current.analyzeFrame(video);
        setPersonState(objRes.personState);
        setDetectedPeopleCount(objRes.personCount);
        setDetectedObjects(objRes.objects);
      }

      // Render Bounding Boxes on Overlay Canvas
      if (overlayCanvasRef.current) {
        const cvs = overlayCanvasRef.current;
        cvs.width = video.clientWidth;
        cvs.height = video.clientHeight;
        const ctx = cvs.getContext('2d');
        ctx.clearRect(0, 0, cvs.width, cvs.height);

        // Lightweight Lighting Quality Calculation (Downsampled 32x32)
        try {
          ctx.drawImage(video, 0, 0, 32, 32);
          const imgData = ctx.getImageData(0, 0, 32, 32).data;
          let brightnessSum = 0;
          for (let p = 0; p < imgData.length; p += 4) {
            // Perceived luminance formula (ITU-R BT.709)
            brightnessSum += 0.2126 * imgData[p] + 0.7152 * imgData[p + 1] + 0.0722 * imgData[p + 2];
          }
          const avgBrightness = Math.round(brightnessSum / (32 * 32));
          setLightingValue(avgBrightness);
          ctx.clearRect(0, 0, 32, 32);

          if (avgBrightness < 45) {
            setLightingStatus('Low Light');
          } else if (avgBrightness > 215) {
            setLightingStatus('Overexposed');
          } else {
            setLightingStatus('Optimal');
          }
        } catch (e) {
          // Cross-origin fallback
        }

        // Visual bounding boxes: disabled on candidate view for a natural human experience
        // Computer vision analysis continues silently in the background
        /* Bounding boxes removed from candidate viewport for high-trust video experience */
      }

      // STAGE 3: Record Neutral Events (Without Calling Cheating)
      // Additional person entering frame
      if (objRes.personCount > priorPeopleCount && objRes.personCount > 1) {
        setNeutralNotice(`Environment observation: Additional person detected (${objRes.personCount} people total).`);
        onIntegrityEvent?.({
          category: "confirmed_technical_event",
          event_type: "additional_person_entered",
          detail: `Additional person visible in frame (count: ${objRes.personCount}).`,
          duration_seconds: 0.0
        });
      }
      priorPeopleCount = objRes.personCount;

      // Phone detection observation
      const hasPhone = objRes.objects.some(o => o.label.toLowerCase() === 'cell phone');
      if (hasPhone && !priorPhoneDetected) {
        setNeutralNotice("Environment observation: Possible cell phone visible in frame.");
        onIntegrityEvent?.({
          category: "uncertain_observation",
          event_type: "possible_phone_visible",
          detail: "Possible mobile device visible in camera perimeter (uncertain observation).",
          duration_seconds: 0.0
        });
      }
      priorPhoneDetected = hasPhone;

    }, 320); // ~3.2 FPS loop keeps CPU load minimal

    return () => clearInterval(interval);
  }, [hasPermission, isCameraMuted, isHardwarePaused, onIntegrityEvent]);

  // Practice mode controls
  const togglePracticeRecording = () => {
    if (!streamRef.current) return;

    if (isPracticeRecording) {
      practiceMediaRecorderRef.current?.stop();
      setIsPracticeRecording(false);
    } else {
      practiceChunksRef.current = [];
      const mr = new MediaRecorder(streamRef.current, { mimeType: 'video/webm' });
      practiceMediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) practiceChunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        const blob = new Blob(practiceChunksRef.current, { type: 'video/webm' });
        setPracticeRecordingBlob(blob);
        const url = URL.createObjectURL(blob);
        setPracticePreviewUrl(url);
      };

      mr.start(500);
      setIsPracticeRecording(true);
    }
  };

  const deletePracticeRecording = () => {
    if (practicePreviewUrl) URL.revokeObjectURL(practicePreviewUrl);
    setPracticePreviewUrl(null);
    setPracticeRecordingBlob(null);
  };

  const toggleCamera = () => {
    if (mode === "company") return;
    if (!streamRef.current) return;
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsCameraMuted(!videoTrack.enabled);
    }
  };

  const toggleMic = () => {
    if (mode === "company") return;
    if (!streamRef.current) return;
    const audioTrack = streamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMicMuted(!audioTrack.enabled);
    }
  };

  const getObjectIcon = (label) => {
    switch (label.toLowerCase()) {
      case 'cell phone': return <Smartphone className="w-3.5 h-3.5 text-purple-400" />;
      case 'laptop': return <Laptop className="w-3.5 h-3.5 text-blue-400" />;
      case 'book': return <BookOpen className="w-3.5 h-3.5 text-amber-400" />;
      default: return <Layers className="w-3.5 h-3.5 text-indigo-400" />;
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 backdrop-blur-xl relative flex flex-col justify-between overflow-hidden shadow-xl">
      {/* Disconnection Alert Overlay */}
      {isHardwarePaused && (
        <div className="absolute inset-0 z-30 bg-slate-950/95 backdrop-blur-md p-6 flex flex-col items-center justify-center text-center">
          <PauseCircle className="w-12 h-12 text-amber-400 mb-3 animate-pulse" />
          <h4 className="text-base font-bold text-white mb-1">Assessment Paused</h4>
          <p className="text-xs text-slate-400 max-w-xs mb-4">
            Camera or microphone disconnected. Reconnect device to resume your assessment.
          </p>
          <div className="flex gap-3">
            <button
              onClick={attemptStreamRecovery}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg"
            >
              Reconnect Hardware
            </button>
            <button
              onClick={() => onEmergencyExit?.("Candidate exited due to hardware disconnect")}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
            >
              Emergency Exit
            </button>
          </div>
        </div>
      )}

      {/* Neutral Notice Banner */}
      {neutralNotice && !isHardwarePaused && (
        <div className="absolute top-3 inset-x-3 z-20 bg-slate-950/95 border border-slate-700 rounded-xl p-2.5 flex items-center justify-between text-[11px] text-slate-200 shadow-xl">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>{neutralNotice}</span>
          </div>
          <span className="text-[10px] text-slate-500">Observation</span>
        </div>
      )}

      {/* Video Preview Box */}
      <div className="relative aspect-video bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-800/80 mb-3">
        {permissionError ? (
          <div className="p-4 text-center text-xs text-red-300">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p>{permissionError}</p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover transform -scale-x-100 ${isCameraMuted ? 'hidden' : 'block'}`}
            />
            {/* Real-time Bounding Box Overlay */}
            <canvas
              ref={overlayCanvasRef}
              className={`absolute inset-0 pointer-events-none transform -scale-x-100 ${isCameraMuted ? 'hidden' : 'block'}`}
            />
            {isCameraMuted && (
              <div className="flex flex-col items-center text-slate-500 text-xs">
                <CameraOff className="w-10 h-10 mb-2" />
                <span>Camera feed is muted</span>
              </div>
            )}
          </>
        )}

        {/* Clean, subtle status pill */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/70 border border-white/10 text-[11px] text-slate-300 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-medium text-slate-200">Camera Live</span>
            <span className="text-[10px] text-slate-400 font-mono">REC 480p/15fps</span>
          </div>
          {lightingStatus !== 'Optimal' && (
            <div className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-medium backdrop-blur-md">
              <span>{lightingStatus === 'Low Light' ? 'Low lighting' : 'High backlighting'}</span>
            </div>
          )}
        </div>

        {/* Mic Volume Activity Meter */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/70 border border-white/10 text-[11px] text-slate-300 backdrop-blur-md">
          <Mic className="w-3.5 h-3.5 text-violet-400" />
          <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-400 transition-all duration-75"
              style={{ width: `${isMicMuted ? 0 : micVolume}%` }}
            />
          </div>
        </div>

        {/* Bottom Floating Framing Info */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-full bg-slate-950/70 border border-white/10 text-[11px] font-medium backdrop-blur-md text-slate-300 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Frame centered</span>
          </div>
        </div>
      </div>

      {/* STAGE 4: Vision Telemetry (Shown in Practice / Benchmark Only) */}
      {mode !== 'company' && (
        <div className="bg-slate-950/60 rounded-2xl p-3 border border-slate-800/80 mb-3 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-teal-400" />
              <span>Local Vision Telemetry</span>
            </span>
            <span className="font-mono text-[10px] text-slate-500">~3.5 FPS Local WASM</span>
          </div>

          {/* Detected Visible Objects Tags */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
              Visible Objects:
            </span>
            {detectedObjects.length === 0 ? (
              <span className="text-[11px] text-slate-400 italic">No secondary objects detected</span>
            ) : (
              detectedObjects.map((obj, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300 text-[11px] font-medium"
                >
                  {getObjectIcon(obj.label)}
                  <span>{obj.label}</span>
                  <span className="text-[9px] font-mono text-purple-400/80 font-bold">{obj.score}%</span>
                </span>
              ))
            )}
          </div>
        </div>
      )}

      {/* Mode-Specific Controls */}
      {mode === "company" ? (
        <div className="flex items-center justify-between px-1 pt-1 border-t border-slate-800">
          <div className="text-[11px] text-slate-400 font-medium">
            Controls locked during active company assessment.
          </div>
          <button
            type="button"
            onClick={() => onEmergencyExit?.("Candidate pressed Emergency Exit & Stop")}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-950/60 hover:bg-red-900/60 border border-red-500/50 rounded-xl text-red-200 text-xs font-bold transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Emergency Exit & Stop</span>
          </button>
        </div>
      ) : (
        /* Practice Mode Controls */
        <div className="space-y-3 pt-1 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleCamera}
                className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 ${isCameraMuted ? 'bg-rose-950/60 border-rose-600 text-rose-300' : 'bg-slate-800/80 border-slate-700 text-slate-300'
                  }`}
              >
                {isCameraMuted ? <CameraOff className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" />}
                <span className="text-[10px]">{isCameraMuted ? 'Turn On' : 'Camera Off'}</span>
              </button>

              <button
                type="button"
                onClick={toggleMic}
                className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 ${isMicMuted ? 'bg-rose-950/60 border-rose-600 text-rose-300' : 'bg-slate-800/80 border-slate-700 text-slate-300'
                  }`}
              >
                {isMicMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                <span className="text-[10px]">{isMicMuted ? 'Unmute' : 'Mute Mic'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={togglePracticeRecording}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${isPracticeRecording
                  ? 'bg-red-600 text-white animate-pulse'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
            >
              {isPracticeRecording ? "Stop Local Rec" : "Record Video"}
            </button>
          </div>

          {/* Local Practice Replay / Delete Bar */}
          {practicePreviewUrl && (
            <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Local Practice Recording (Candidate Controlled)</span>
                <button onClick={deletePracticeRecording} className="text-red-400 hover:text-red-300 flex items-center gap-1">
                  <Trash2 className="w-3 h-3" />
                  <span>Delete</span>
                </button>
              </div>
              <video src={practicePreviewUrl} controls className="w-full rounded-xl max-h-32" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
