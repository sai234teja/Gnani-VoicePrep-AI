import React from 'react';
import {
  Award,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Layers,
  ShieldCheck,
  RotateCcw,
  Info,
  Clock,
  Eye,
  Lock,
  Compass
} from 'lucide-react';

export const FinalReportModal = ({ report, onRestart }) => {
  if (!report) return null;

  const {
    session_id,
    mode,
    role_name,
    experience_level,
    overall_score,
    performance_tier,
    dimension_scores,
    strengths,
    areas_for_growth,
    learning_roadmap,
    question_evaluations,
    integrity_summary,
    candidate_intro_summary,
    evaluator_comments,
    status,
    evidence_breakdown,
    unassessed_competencies,
    recommended_next_topics,
    evaluation_confidence,
    targeted_next_practice_plan,
    suggested_improved_answers
  } = report;

  const confirmed = integrity_summary?.confirmed_technical_events || {};
  const uncertain = integrity_summary?.uncertain_observations || {};

  const outcomeBadge = () => {
    if (status === 'TERMINATED_INACTIVITY' || evaluator_comments?.toLowerCase().includes('inactivity')) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
          Terminated (Inactivity)
        </span>
      );
    }
    if (status === 'INTERRUPTED' || status === 'EMERGENCY_EXIT' || evaluator_comments?.toLowerCase().includes('emergency')) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
          Interrupted Session
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
        Completed Successfully
      </span>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Header Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${mode === 'company'
                ? 'bg-teal-500/10 text-teal-400 border-teal-500/20'
                : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                }`}>
                {mode === 'company' ? 'Company Assessment Summary' : 'Practice Mastery Assessment'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs bg-slate-800 text-slate-300 border border-slate-700">
                {role_name} • {experience_level}
              </span>
              {outcomeBadge()}
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white">
              Interview Evaluation & Diagnostics
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Multi-dimensional evaluation based on candidate spoken answers and local session environment metrics.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-slate-950/80 border border-slate-800 p-5 rounded-3xl">
            <div className="text-center">
              <div className="text-xs uppercase font-bold text-slate-400 mb-1">Overall Benchmark</div>
              <div className="text-5xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-teal-400">
                {overall_score}
                <span className="text-xl text-slate-500 font-bold ml-1">/100</span>
              </div>
            </div>
          </div>
        </div>

        {/* Learning Readiness Level */}
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30">
          <div>
            <div className="text-xs uppercase tracking-wider text-indigo-300 font-bold">Interview Readiness Level</div>
            <div className="text-lg font-bold text-white mt-0.5">{performance_tier}</div>
          </div>
          <button
            onClick={onRestart}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Practice Another Session</span>
          </button>
        </div>

        {/* 4 Dimension Scores */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6">
          {Object.entries(dimension_scores).map(([dim, score]) => (
            <div key={dim} className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/70">
              <div className="text-xs text-slate-400 mb-1 font-medium">{dim}</div>
              <div className="text-2xl font-bold font-mono text-white">{score}%</div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${score}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* Candidate Self-Introduction & Evaluator Comments (Company Mode Feature) */}
        {candidate_intro_summary && (
          <div className="mt-6 p-4 rounded-2xl bg-teal-950/30 border border-teal-500/30 space-y-2">
            <div className="text-xs uppercase font-bold tracking-wider text-teal-400">
              Candidate Introduction Summary (Question 1)
            </div>
            <p className="text-xs text-slate-200 italic leading-relaxed">
              "{candidate_intro_summary}"
            </p>
            {evaluator_comments && (
              <div className="pt-2 border-t border-teal-500/20 text-xs text-slate-300">
                <span className="font-semibold text-white">Evaluator Note: </span>
                {evaluator_comments}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Strengths & Growth Areas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6">
          <div className="flex items-center gap-2 text-emerald-400 mb-4 font-bold text-base">
            <CheckCircle2 className="w-5 h-5" />
            <h3 className="text-white">Demonstrated Strengths</h3>
          </div>
          <ul className="space-y-3">
            {strengths.map((s, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-300 leading-relaxed">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6">
          <div className="flex items-center gap-2 text-amber-400 mb-4 font-bold text-base">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="text-white">Targeted Refinement Areas</h3>
          </div>
          <ul className="space-y-3">
            {areas_for_growth.map((a, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-300 leading-relaxed">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Question by Question Breakdown */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-400" />
          <span>Question-by-Question Diagnostics</span>
        </h3>
        <div className="space-y-4">
          {question_evaluations.map((evalItem, idx) => (
            <div key={idx} className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="text-sm font-bold text-white">
                  Q{idx + 1}: {evalItem.question_title}
                </div>
                <div className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border border-indigo-500/30 text-indigo-300 bg-indigo-500/10">
                  {evalItem.overall_score}/100
                </div>
              </div>

              <div className="text-xs text-slate-300 italic bg-slate-900/60 p-3 rounded-xl border border-slate-800/60">
                "{evalItem.transcript}"
              </div>

              <div className="text-xs text-indigo-300 font-medium">
                Interviewer Feedback: {evalItem.spoken_feedback}
              </div>

              {/* Phase 10 Extracted Evidence Concepts & Notes */}
              {(evalItem.extracted_concepts?.length > 0 || evalItem.evidence_notes) && (
                <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-400 font-medium">Verified Concepts:</span>
                    {(evalItem.extracted_concepts || []).map((c, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                        {c}
                      </span>
                    ))}
                  </div>
                  {evalItem.evidence_notes && (
                    <span className="text-slate-400 italic text-[10px]">
                      {evalItem.evidence_notes}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Phase 17 Suggested Answer Improvements */}
      {suggested_improved_answers?.length > 0 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-base">
            <BookOpen className="w-5 h-5" />
            <h3 className="text-white">AI Coach: Suggested Model Answers & Talking Points</h3>
          </div>
          <p className="text-xs text-slate-400">
            Compare your spoken response against structured, evidence-based answer frameworks.
          </p>
          <div className="space-y-4 pt-1">
            {suggested_improved_answers.map((item, idx) => (
              <div key={idx} className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span>Q{idx + 1}: {item.question_title}</span>
                  <span className="text-indigo-400 font-mono text-[11px]">{item.target_competency}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                    <span className="text-[11px] font-semibold text-rose-300 uppercase tracking-wider block mb-1">
                      Identified Opportunity:
                    </span>
                    <p className="text-slate-300 leading-relaxed">{item.candidate_gap || "Lacked structured metrics or architectural depth."}</p>
                  </div>
                  <div className="p-3 bg-indigo-950/30 rounded-xl border border-indigo-900/40">
                    <span className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider block mb-1">
                      Recommended Answer Strategy:
                    </span>
                    <p className="text-slate-200 leading-relaxed">{item.improved_answer_framework}</p>
                  </div>
                </div>
                {item.key_talking_points?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {item.key_talking_points.map((pt, pIdx) => (
                      <span key={pIdx} className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px]">
                        ✓ {pt}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phase 17 Targeted Next Practice Plan */}
      {targeted_next_practice_plan && (
        <div className="bg-gradient-to-r from-indigo-950/60 to-slate-900 border border-indigo-800/40 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-base">
              <Compass className="w-5 h-5" />
              <h3 className="text-white">Recommended Next Practice Drill</h3>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
              Personalized
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <span className="text-slate-400 block mb-1">Focus Area:</span>
              <span className="font-semibold text-white">{targeted_next_practice_plan.recommended_focus_area}</span>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <span className="text-slate-400 block mb-1">Recommended Difficulty:</span>
              <span className="font-semibold text-white">{targeted_next_practice_plan.suggested_difficulty}</span>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <span className="text-slate-400 block mb-1">Suggested Question Count:</span>
              <span className="font-semibold text-white">{targeted_next_practice_plan.question_count} Questions</span>
            </div>
          </div>
          <div className="text-xs text-slate-300 bg-slate-950/40 p-3 rounded-xl border border-slate-800/60">
            <span className="font-semibold text-indigo-300">Why this drill? </span>
            {targeted_next_practice_plan.rationale}
          </div>
        </div>
      )}

      {/* 4-Week Learning Roadmap */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Compass className="w-5 h-5 text-indigo-400" />
          <span>Actionable 4-Week Mastery Roadmap</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {learning_roadmap.map((stage, idx) => (
            <div key={idx} className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <div className="text-xs font-bold text-indigo-400 mb-1.5">{stage.stage}</div>
                <p className="text-xs text-slate-300 leading-relaxed">{stage.action}</p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800/80 text-[10px] text-slate-500 font-mono">
                Milestone #{idx + 1}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Phase 10 Intelligent Next Steps & Unassessed Competencies */}
      {(recommended_next_topics?.length > 0 || unassessed_competencies?.length > 0) && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-400" />
            <span>AI Assessment Intelligence & Next Round Strategy</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommended_next_topics?.length > 0 && (
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                  Recommended Technical Follow-ups:
                </span>
                <ul className="text-xs text-slate-300 space-y-1.5">
                  {recommended_next_topics.map((t, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {unassessed_competencies?.length > 0 && (
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                  Unassessed Competencies for Next Interviewer:
                </span>
                <ul className="text-xs text-slate-300 space-y-1.5">
                  {unassessed_competencies.map((u, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                      <span>{u}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Structured Integrity Report (Distinguishing Confirmed Events from Uncertain Observations) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-6">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-teal-400" />
            <span>Environment Continuity & Integrity Diagnostics</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Recorded with candidate consent. Objective environment measurements are distinguished from natural uncertain observations.
          </p>
        </div>

        {/* 1. Confirmed Technical Events */}
        <div className="space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Confirmed Technical Events (Measured Durations)</span>
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
              <div className="text-[11px] text-slate-400">Tab Switches</div>
              <div className="text-lg font-bold text-white">{confirmed.tab_switches_count || 0}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Total duration: {confirmed.total_tab_switch_duration_seconds || 0}s
              </div>
            </div>
            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
              <div className="text-[11px] text-slate-400">Face Not Visible</div>
              <div className="text-lg font-bold text-white">{confirmed.face_not_detected_intervals || 0}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Total duration: {confirmed.total_face_missing_duration_seconds || 0}s
              </div>
            </div>
            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
              <div className="text-[11px] text-slate-400">Multiple Figures</div>
              <div className="text-lg font-bold text-white">{confirmed.multiple_faces_detected_count || 0}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Verified bounding boxes</div>
            </div>
            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
              <div className="text-[11px] text-slate-400">Hardware Disconnects</div>
              <div className="text-lg font-bold text-emerald-400">{confirmed.camera_disconnects || 0}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Media track continuity</div>
            </div>
          </div>
        </div>

        {/* 2. Uncertain Observations */}
        <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
            <Eye className="w-4 h-4 text-amber-400" />
            <span>Uncertain Observations (Natural Cognitive Shifts)</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>Peripheral gaze / head orientation shifts detected:</span>
            <span className="font-mono font-bold text-white">{uncertain.gaze_or_head_direction_shifts || 0} occurrences</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed italic">
            Note: Gaze and head movements are normal cognitive processes and are never treated as proof of dishonesty.
          </p>
        </div>

        {/* Timeline Log */}
        {integrity_summary.detailed_timeline && integrity_summary.detailed_timeline.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-400">Chronological Event Timeline:</span>
            <div className="max-h-48 overflow-y-auto space-y-1.5 p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono">
              {integrity_summary.detailed_timeline.map((ev, i) => (
                <div key={i} className="flex items-center justify-between text-slate-400 border-b border-slate-900 pb-1">
                  <span>[{ev.time}] [{ev.category}] {ev.event_type}</span>
                  <span className="text-slate-500">{ev.detail} ({ev.duration})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/60 text-[11px] text-slate-500 flex items-center gap-2">
          <Info className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <span>{integrity_summary.neutral_disclaimer}</span>
        </div>
      </div>
    </div>
  );
};
