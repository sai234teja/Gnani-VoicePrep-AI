import React, { useState, useRef, useEffect } from 'react';
import { Camera, CheckCircle2, AlertTriangle, RefreshCw, Eye, ShieldCheck, Check } from 'lucide-react';

export default function IdentityPhotoCapture({ sessionId, onStatusChange }) {
  const [hasConsent, setHasConsent] = useState(false);
  const [streamActive, setStreamActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploaded, setIsUploaded] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setStreamActive(false);
  };

  const startCamera = async () => {
    setErrorMsg('');
    stopStream();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Webcam access is not supported by your browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
      });

      streamRef.current = stream;
      setStreamActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.warn('[IdentityPhotoCapture] Camera error:', err);
      let humanMsg = 'Unable to access camera for identity photo.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        humanMsg = 'Camera permission was denied. Please allow camera access in your browser settings.';
      } else if (err.name === 'NotFoundError') {
        humanMsg = 'No camera hardware found on this machine.';
      }
      setErrorMsg(humanMsg);
      setStreamActive(false);
    }
  };

  useEffect(() => {
    if (hasConsent && !capturedPhoto && !isUploaded) {
      startCamera();
    }
    return () => {
      stopStream();
    };
  }, [hasConsent, capturedPhoto, isUploaded]);

  const handleCapture = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedPhoto(dataUrl);
    stopStream();
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    setIsUploaded(false);
    onStatusChange?.({ pass: false, details: null });
    startCamera();
  };

  const handleConfirmAndUpload = async () => {
    if (!capturedPhoto || !sessionId) return;

    setIsUploading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/security/identity-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          candidate_id: 'candidate_self',
          photo_b64: capturedPhoto,
          consent_granted: true
        })
      });

      if (!res.ok) {
        throw new Error(`Upload failed with status ${res.status}`);
      }

      const result = await res.json();
      setIsUploaded(true);
      if (onStatusChange) {
        onStatusChange({
          pass: true,
          details: {
            filename: result.photo_filename,
            uploaded: true
          }
        });
      }
    } catch (err) {
      console.error('[IdentityPhotoCapture] Upload error:', err);
      setErrorMsg(err.message || 'Failed to upload identity photo.');
      setIsUploaded(false);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg ${
            isUploaded ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
            'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
          }`}>
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-100">Identity Verification Photo</h4>
            <p className="text-xs text-slate-400">Consented snapshot for hiring team verification</p>
          </div>
        </div>

        <div>
          {isUploaded ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700/50">
              Pending Capture
            </span>
          )}
        </div>
      </div>

      {/* Explicit Consent Step */}
      {!hasConsent && (
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-3">
          <div className="flex items-start gap-2.5">
            <Eye className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold text-white block">Candidate Privacy & Verification Notice:</span>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Before commencing the assessment, you will capture a single verification photo. 
                This photo is stored privately in encrypted enterprise storage and is reviewed solely by the authorized recruiter 
                to verify interview attendance. A webcam selfie does not constitute biometric identity matching or legal identification.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setHasConsent(true)}
            className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            I Consent & Wish to Take Verification Photo
          </button>
        </div>
      )}

      {/* Live Preview / Capture Mode */}
      {hasConsent && !capturedPhoto && !isUploaded && (
        <div className="space-y-4">
          <div className="relative aspect-video max-w-md mx-auto rounded-xl overflow-hidden bg-black border border-slate-800">
            <video
              ref={videoRef}
              muted
              playsInline
              autoPlay
              className="w-full h-full object-cover mirror"
            />
            {streamActive && (
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 text-[10px] text-emerald-400 font-mono">
                WEBCAM READY
              </div>
            )}
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleCapture}
              disabled={!streamActive}
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white rounded-xl font-bold text-xs shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Camera className="w-4 h-4" />
              Capture Photo
            </button>
          </div>
        </div>
      )}

      {/* Confirm Captured Photo */}
      {capturedPhoto && !isUploaded && (
        <div className="space-y-4">
          <div className="relative aspect-video max-w-md mx-auto rounded-xl overflow-hidden bg-black border border-indigo-500/30">
            <img
              src={capturedPhoto}
              alt="Candidate Verification Capture"
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 text-[10px] text-indigo-300 font-mono">
              PREVIEW FOR CONFIRMATION
            </div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleRetake}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retake Photo
            </button>
            <button
              type="button"
              onClick={handleConfirmAndUpload}
              disabled={isUploading}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-1.5"
            >
              {isUploading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Encrypting & Saving...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Confirm & Save Photo
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Confirmed State */}
      {isUploaded && capturedPhoto && (
        <div className="flex items-center gap-4 p-3 bg-slate-950 rounded-xl border border-emerald-500/20">
          <img
            src={capturedPhoto}
            alt="Confirmed"
            className="w-20 h-14 object-cover rounded-lg border border-slate-800"
          />
          <div className="flex-1 text-xs">
            <span className="font-semibold text-emerald-400 block flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Verification Photo Confirmed
            </span>
            <span className="text-slate-400 text-[11px]">
              Encrypted and linked to session for recruiter review.
            </span>
          </div>
          <button
            type="button"
            onClick={handleRetake}
            className="text-[11px] text-slate-400 hover:text-slate-200 underline"
          >
            Change
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="mt-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}

