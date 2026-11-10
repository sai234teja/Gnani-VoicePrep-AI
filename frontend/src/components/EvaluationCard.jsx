import React from 'react';
import { Award, CheckCircle2, AlertTriangle, ArrowRight, BookOpen, Volume2 } from 'lucide-react';
import { AudioPlayer } from './AudioPlayer';

export const EvaluationCard = ({ evaluation, onRetry }) => {
  if (!evaluation) return null;

  const {
    overall_score,
    rating,
    breakdown,
    strengths,
    improvements,
    suggested_structure,
    spoken_summary,
    detected_language,
    transcript,
    audio_base64,
    is_live_gnani_stt,
    is_live_gnani_tts
  } = evaluation;

  const getScoreBadgeColor = (score) => {
    if (score >= 80) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (score >= 60) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Score */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border ${getScoreBadgeColor(overall_score)}`}>
                {rating}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                Lang: {detected_language}
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white">
              Interview Evaluation Score
            </h2>
            <p className="text-sm text-slate-400 max-w-xl">
              Analyzed through Gnani Prisma Speech-to-Text transcription and benchmarked against structured interview rubrics.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-slate-950/80 border border-slate-800 p-4 rounded-2xl">
            <div className="relative flex items-center justify-center">
              <div className="text-4xl md:text-5xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
                {overall_score}
              </div>
              <span className="text-slate-500 text-lg font-bold ml-1">/100</span>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
            <div className="text-xs text-slate-400 mb-1">Relevance</div>
            <div className="text-lg font-bold text-white">{breakdown.relevance_score}%</div>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
            <div className="text-xs text-slate-400 mb-1">Clarity & Cadence</div>
            <div className="text-lg font-bold text-white">{breakdown.clarity_score}%</div>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
            <div className="text-xs text-slate-400 mb-1">STAR Structure</div>
            <div className="text-lg font-bold text-white">{breakdown.structure_score}%</div>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
            <div className="text-xs text-slate-400 mb-1">Impact & Depth</div>
            <div className="text-lg font-bold text-white">{breakdown.depth_score}%</div>
          </div>
        </div>
      </div>

      {/* Spoken Feedback Player (Gnani Timbre) */}
      <AudioPlayer 
        base64Audio={audio_base64} 
        autoPlay={true}
        label="AI Spoken Feedback (Gnani Timbre)"
      />

      {/* Transcript Box */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
              Gnani Prisma Transcript
            </h3>
          </div>
          <span className="text-xs font-medium px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
            {is_live_gnani_stt ? 'Live Prisma v3.0' : 'Prisma Verified Engine'}
          </span>
        </div>
        <p className="text-slate-200 text-sm leading-relaxed italic bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
          "{transcript}"
        </p>
      </div>

      {/* Strengths & Improvements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Strengths */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 text-emerald-400 mb-4">
            <CheckCircle2 className="w-5 h-5" />
            <h3 className="font-bold text-base text-white">Key Strengths</h3>
          </div>
          <ul className="space-y-3">
            {strengths.map((s, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Improvements */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 text-amber-400 mb-4">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="font-bold text-base text-white">Actionable Improvements</h3>
          </div>
          <ul className="space-y-3">
            {improvements.map((imp, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
                <span>{imp}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Recommended Answer Framework */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 text-indigo-400 mb-3">
          <BookOpen className="w-5 h-5" />
          <h3 className="font-bold text-base text-white">Recommended Delivery Strategy</h3>
        </div>
        <pre className="text-sm text-slate-300 font-sans whitespace-pre-wrap bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 leading-relaxed">
          {suggested_structure}
        </pre>
      </div>

      {/* Action to Practice Again */}
      <div className="flex justify-end pt-2">
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-2xl transition-all shadow-lg hover:shadow-indigo-500/20 active:scale-95"
        >
          <span>Practice Another Question</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

