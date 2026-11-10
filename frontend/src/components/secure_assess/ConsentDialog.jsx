import React, { useState } from 'react';
import { ShieldCheck, Info, Check, Eye, Lock, FileText, X } from 'lucide-react';

export default function ConsentDialog({ onConsentGranted, onCancel, roleTitle = 'Technical Candidate' }) {
  const [agreedTelemetry, setAgreedTelemetry] = useState(false);
  const [agreedAudioVideo, setAgreedAudioVideo] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);

  const allAgreed = agreedTelemetry && agreedAudioVideo && agreedTerms;

  const handleSubmit = () => {
    if (allAgreed && onConsentGranted) {
      onConsentGranted({
        timestamp: new Date().toISOString(),
        granted: true,
        scope: ['telemetry_integrity', 'camera_mic_recording', 'browser_focus_events'],
        retentionPolicyDays: 30
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl bg-slate-900 border border-indigo-500/30 rounded-2xl p-6 shadow-2xl shadow-indigo-950/40">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">Gnani SecureAssess Informed Consent</h3>
              <p className="text-xs text-slate-400">Company Assessment for {roleTitle}</p>
            </div>
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="my-5 space-y-4 text-xs text-slate-300 max-h-[60vh] overflow-y-auto pr-1">
          <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-800/40 flex items-start gap-3">
            <Info className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              To ensure a fair evaluation, this company interview utilizes objective session telemetry. 
              All face detection is processed <strong className="text-indigo-300">locally in your browser</strong> via MediaPipe. 
              No biometric face prints or templates are ever uploaded or sold.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="text-slate-200 font-semibold text-xs uppercase tracking-wider">What We Monitor:</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-2.5 rounded-lg bg-slate-800/50 border border-slate-800 flex items-start gap-2">
                <Eye className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-200 block">Device Telemetry</span>
                  <span className="text-slate-400 text-[11px]">Webcam and microphone stream continuity during question responses.</span>
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-800/50 border border-slate-800 flex items-start gap-2">
                <Lock className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-200 block">Focus & Visibility</span>
                  <span className="text-slate-400 text-[11px]">Tab switching, window minimize, or exiting fullscreen mode.</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <h4 className="text-slate-200 font-semibold text-xs uppercase tracking-wider">Candidate Rights:</h4>
            <ul className="list-disc pl-5 space-y-1 text-slate-400 text-[11px]">
              <li>You may request human recruiter review of any technical log.</li>
              <li>You can pause or exit the interview at any time if you experience technical issues.</li>
              <li>Session telemetry is retained for 30 days and automatically scheduled for deletion.</li>
            </ul>
          </div>

          {/* Consent Checkboxes */}
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreedAudioVideo}
                onChange={e => setAgreedAudioVideo(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-slate-300">
                I consent to the recording of my audio and video responses for evaluation by the hiring company.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreedTelemetry}
                onChange={e => setAgreedTelemetry(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-slate-300">
                I understand objective session events (such as tab switching or device disconnects) are recorded to the audit log.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreedTerms}
                onChange={e => setAgreedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-slate-300">
                I confirm that I will complete this assessment independently and without unauthorized automated assistance.
              </span>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <button
            onClick={onCancel}
            type="button"
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            Decline & Exit
          </button>
          <button
            onClick={handleSubmit}
            disabled={!allAgreed}
            type="button"
            className={`px-5 py-2.5 text-xs font-semibold rounded-xl flex items-center gap-2 transition-all shadow-lg ${
              allAgreed
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-indigo-500/25'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
            }`}
          >
            <Check className="w-4 h-4" />
            Accept & Continue to Assessment
          </button>
        </div>
      </div>
    </div>
  );
}

