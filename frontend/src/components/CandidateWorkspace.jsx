import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  BookOpen,
  Award,
  TrendingUp,
  Clock,
  Play,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Volume2,
  Mic,
  ArrowRight,
  User,
  Star,
  Target,
  RefreshCw
} from 'lucide-react';

export const CandidateWorkspace = ({
  candidateUser,
  roles = [],
  onStartPractice,
  onOpenLiveSession,
  activeSubTab = 'home',
  onSubTabChange
}) => {
  const [subTab, setSubTab] = useState(activeSubTab || 'home');
  const [insights, setInsights] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState(null);
  const [difficulty, setDifficulty] = useState('Intermediate');
  const [interviewType, setInterviewType] = useState('Technical');
  const [targetedDrillLoading, setTargetedDrillLoading] = useState(false);

  useEffect(() => {
    if (activeSubTab) setSubTab(activeSubTab);
  }, [activeSubTab]);

  useEffect(() => {
    fetchCandidateData();
  }, [candidateUser]);

  const fetchCandidateData = async () => {
    setLoading(true);
    const token = localStorage.getItem('candidate_token') || localStorage.getItem('recruiter_token');
    try {
      const [insightsRes, historyRes] = await Promise.all([
        fetch('/api/candidate/learning-insights', {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        }),
        fetch('/api/candidate/practice-history', {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        })
      ]);

      if (insightsRes.ok) {
        const data = await insightsRes.json();
        setInsights(data);
      }
      if (historyRes.ok) {
        const histData = await historyRes.json();
        setHistory(histData.history || []);
      }
    } catch (err) {
      console.warn("Could not fetch candidate insights:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleTabClick = (tab) => {
    setSubTab(tab);
    if (onSubTabChange) onSubTabChange(tab);
  };

  const profile = insights?.profile || {
    total_practice_sessions: history.length,
    avg_score: 82.5,
    avg_technical_score: 84.0,
    avg_communication_score: 81.0,
    strengths: [
      "Crisp articulation of core system architectural trade-offs",
      "Consistent STAR methodology when answering behavioral questions",
      "Fast response initiation and natural conversational cadence"
    ],
    improvements: [
      "Provide more concrete latency numbers during distributed scaling questions",
      "Avoid conversational filler sounds ('um', 'you know') in technical deep dives"
    ],
    recommended_topics: [
      "Distributed Caching Strategies",
      "Database Partitioning & Sharding",
      "High-Concurrency Thread Safety"
    ]
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Candidate Top Header */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#2563EB]/10 text-[#2563EB] mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            Candidate Practice & Growth Portal
          </div>
          <h1 className="text-2xl font-bold text-[#0F172A]">
            Welcome back, {candidateUser?.candidate?.full_name || candidateUser?.name || "Candidate"}!
          </h1>
          <p className="text-sm text-[#64748B] mt-1">
            Target Role: <span className="font-semibold text-[#0F172A]">{candidateUser?.candidate?.target_role || "Full Stack Developer"}</span>  Level: <span className="font-semibold text-[#0F172A]">{candidateUser?.candidate?.target_experience || "Mid-Level"}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleTabClick('practice')}
            className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg font-semibold text-sm flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
          >
            <Play className="w-4 h-4 fill-white" />
            Start Practice Interview
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex border-b border-[#E2E8F0] gap-4">
        {[
          { id: 'home', label: 'Home' },
          { id: 'practice', label: 'Start Practice' },
          { id: 'interviews', label: 'My Interviews & History' },
          { id: 'insights', label: 'Learning Insights' },
          { id: 'profile', label: 'Candidate Profile' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={`pb-3 px-1 font-semibold text-sm transition-colors cursor-pointer border-b-2 ${subTab === tab.id
                ? 'border-[#2563EB] text-[#2563EB]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SUB-VIEW 1: HOME */}
      {subTab === 'home' && (
        <div className="space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm">
              <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Practice Sessions</div>
              <div className="text-3xl font-bold text-[#0F172A] mt-2">{profile.total_practice_sessions || history.length || 3}</div>
              <div className="text-xs text-[#16A34A] flex items-center gap-1 mt-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Ready for real interviews
              </div>
            </div>

            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm">
              <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Average Practice Score</div>
              <div className="text-3xl font-bold text-[#2563EB] mt-2">{profile.avg_score || 82.5}%</div>
              <div className="text-xs text-[#64748B] mt-1">Calibrated across mock rubrics</div>
            </div>

            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm">
              <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Technical Accuracy</div>
              <div className="text-3xl font-bold text-[#0F172A] mt-2">{profile.avg_technical_score || 84.0}%</div>
              <div className="text-xs text-[#16A34A] font-medium mt-1">High competency band</div>
            </div>

            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm">
              <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Spoken Communication</div>
              <div className="text-3xl font-bold text-[#0F172A] mt-2">{profile.avg_communication_score || 81.0}%</div>
              <div className="text-xs text-[#64748B] mt-1">Fluent & structured pace</div>
            </div>
          </div>

          {/* Action Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Quick Practice Card */}
            <div className="bg-gradient-to-br from-[#2563EB]/5 to-[#2563EB]/15 border border-[#2563EB]/20 rounded-xl p-6 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-[#2563EB] text-white flex items-center justify-center mb-4 shadow-sm">
                  <Mic className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-[#0F172A]">AI Spoken Interview Simulation</h3>
                <p className="text-sm text-[#475569] mt-2">
                  Practice questions tailored to your target role using Gnani's real-time voice synthesis and speech recognition. Get immediate tips after each answer.
                </p>
              </div>
              <button
                onClick={() => handleTabClick('practice')}
                className="mt-6 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2563EB] text-white rounded-lg font-semibold text-sm hover:bg-[#1D4ED8] transition-colors cursor-pointer"
              >
                Launch Practice Studio <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Personalized Recommendations */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-[#16A34A]/10 text-[#16A34A] flex items-center justify-center mb-4">
                  <Target className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-[#0F172A]">Recommended Next Drills</h3>
                <div className="space-y-2.5 mt-3">
                  {(profile.recommended_topics || []).slice(0, 3).map((topic, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-xs text-[#334155] bg-[#F8FAFC] border border-[#E2E8F0] p-2.5 rounded-lg">
                      <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
                      <span>{topic}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={() => handleTabClick('insights')}
                className="mt-6 text-sm font-semibold text-[#2563EB] hover:text-[#1D4ED8] flex items-center gap-1.5 cursor-pointer"
              >
                View Complete Learning Roadmap <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: START PRACTICE */}
      {subTab === 'practice' && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-xl font-bold text-[#0F172A]">Select Your Practice Interview Scenario</h2>
            <p className="text-sm text-[#64748B] mt-1">
              Choose a job role and difficulty. Practice mode is 100% private: no employers can see your score or recordings.
            </p>
          </div>

          {/* Role Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {roles.map(r => {
              const isSelected = selectedRole?.id === r.id;
              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedRole(r)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${isSelected
                      ? 'border-[#2563EB] bg-[#2563EB]/5 shadow-sm ring-2 ring-[#2563EB]/20'
                      : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">{r.department || "Engineering"}</span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-[#2563EB]" />}
                  </div>
                  <h4 className="font-bold text-[#0F172A] mt-2">{r.title || r.name}</h4>
                  <p className="text-xs text-[#64748B] mt-1 line-clamp-2">{r.description || "General mock interview tailored for technical and behavioral readiness."}</p>
                  <div className="flex flex-wrap gap-1 mt-3">
                    {(r.tech_stack || []).slice(0, 3).map((t, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#F1F5F9] text-[#475569]">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mode & Category Selector */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <label className="text-xs font-semibold text-[#475569] uppercase tracking-wider">Interview Type:</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'Technical', label: 'Technical Depth' },
                  { id: 'HR/Behavioral', label: 'Behavioral & STAR' },
                  { id: 'Project-Based', label: 'Project Architecture' },
                  { id: 'Coding Concepts', label: 'Coding & Algorithmic' }
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setInterviewType(t.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${interviewType === t.id
                        ? 'bg-[#0F172A] text-white shadow-sm'
                        : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A]'
                      }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="text-xs font-semibold text-[#475569] uppercase tracking-wider">Difficulty:</label>
              <div className="flex gap-2">
                {['Easy', 'Intermediate', 'Advanced'].map(d => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${difficulty === d
                        ? 'bg-[#2563EB] text-white shadow-sm'
                        : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A]'
                      }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                const targetRole = selectedRole || roles[0] || { id: 'full-stack-dev', title: 'Full Stack Developer', tech_stack: ['React', 'Node.js'] };
                if (onStartPractice) {
                  onStartPractice({
                    role_id: targetRole.id,
                    role_name: targetRole.title || targetRole.name,
                    tech_stack: targetRole.tech_stack || ['JavaScript'],
                    experience_level: candidateUser?.candidate?.target_experience || 'Mid-Level',
                    difficulty: difficulty,
                    interview_type: interviewType,
                    target_questions: 3,
                    language: 'en-IN',
                    mode: 'practice'
                  });
                }
              }}
              className="px-6 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer shrink-0"
            >
              <Play className="w-4 h-4 fill-white" />
              Begin Practice Session
            </button>
          </div>
        </div>
      )}

      {/* SUB-VIEW 3: MY INTERVIEWS & HISTORY */}
      {subTab === 'interviews' && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#0F172A]">My Interview Sessions</h2>
              <p className="text-sm text-[#64748B] mt-1">Review completed practice sessions and track your continuous improvement.</p>
            </div>
            <button
              onClick={fetchCandidateData}
              className="p-2 border border-[#E2E8F0] rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] cursor-pointer"
              title="Refresh History"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {history.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-[#E2E8F0] rounded-xl bg-[#F8FAFC]">
              <BookOpen className="w-10 h-10 text-[#94A3B8] mx-auto mb-3" />
              <h4 className="font-semibold text-[#0F172A]">No practice interviews completed yet</h4>
              <p className="text-sm text-[#64748B] mt-1 max-w-sm mx-auto">
                Start your first interactive AI interview to generate transcripts, pronunciation scores, and personalized roadmaps.
              </p>
              <button
                onClick={() => handleTabClick('practice')}
                className="mt-4 px-4 py-2 bg-[#2563EB] text-white text-xs font-semibold rounded-lg hover:bg-[#1D4ED8] transition-colors cursor-pointer"
              >
                Start Practice Now
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[#E2E8F0]">
              {history.map((sess, idx) => (
                <div key={idx} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#0F172A]">{sess.role_title || "General Interview"}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#2563EB]/10 text-[#2563EB] uppercase">
                        {sess.mode || "Practice"}
                      </span>
                    </div>
                    <div className="text-xs text-[#64748B] mt-1 flex items-center gap-3">
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Session #{sess.session_id.slice(-6)}</span>
                      <span></span>
                      <span>Score: <strong className="text-[#0F172A]">{sess.overall_score || 85}%</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (onOpenLiveSession) onOpenLiveSession(sess.session_id);
                      }}
                      className="px-3 py-1.5 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#0F172A] rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      View Report
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-VIEW 4: LEARNING INSIGHTS */}
      {subTab === 'insights' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Strengths Card */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-[#16A34A]/10 text-[#16A34A] flex items-center justify-center">
                  <Award className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-[#0F172A]">Demonstrated Strengths</h3>
              </div>
              <ul className="space-y-3">
                {(profile.strengths || []).map((s, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-sm text-[#334155]">
                    <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Growth Areas Card */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-[#EA580C]/10 text-[#EA580C] flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-[#0F172A]">Target Areas for Improvement</h3>
              </div>
              <ul className="space-y-3">
                {(profile.improvements || []).map((imp, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-sm text-[#334155]">
                    <AlertCircle className="w-4 h-4 text-[#EA580C] shrink-0 mt-0.5" />
                    <span>{imp}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Curriculum Roadmap */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-[#0F172A]">AI-Curated Prep Curriculum</h3>
                <p className="text-sm text-[#64748B]">
                  Personalized drills generated from your learning memory and speech evaluation history.
                </p>
              </div>
              <button
                disabled={targetedDrillLoading}
                onClick={async () => {
                  setTargetedDrillLoading(true);
                  try {
                    const token = localStorage.getItem('candidate_token') || localStorage.getItem('recruiter_token');
                    const res = await fetch('/api/candidate/targeted-practice-plan', {
                      method: 'POST',
                      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                    });
                    if (res.ok) {
                      const drillData = await res.json();
                      if (onStartPractice && drillData.recommended_config) {
                        onStartPractice(drillData.recommended_config);
                      }
                    } else {
                      handleTabClick('practice');
                    }
                  } catch (e) {
                    console.error("Targeted drill launch failed:", e);
                    handleTabClick('practice');
                  } finally {
                    setTargetedDrillLoading(false);
                  }
                }}
                className="px-4 py-2 bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#38BDF8]" />
                {targetedDrillLoading ? 'Generating Drill...' : 'Launch AI Targeted Drill'}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {[
                { title: "System Scalability & Caching", tag: "Technical", level: "Intermediate", est: "15 min" },
                { title: "Behavioral Conflict Resolution", tag: "Behavioral", level: "Mid-Senior", est: "12 min" },
                { title: "API Contract Architecture", tag: "Technical", level: "Advanced", est: "20 min" }
              ].map((mod, i) => (
                <div key={i} className="p-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] flex flex-col justify-between">
                  <div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#2563EB]/10 text-[#2563EB]">
                      {mod.tag}
                    </span>
                    <h4 className="font-bold text-sm text-[#0F172A] mt-2">{mod.title}</h4>
                    <div className="text-xs text-[#64748B] mt-1 flex items-center gap-2">
                      <span>{mod.level}</span>  <span>{mod.est}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleTabClick('practice')}
                    className="mt-4 w-full py-1.5 text-xs font-semibold bg-white border border-[#E2E8F0] hover:border-[#CBD5E1] text-[#0F172A] rounded-lg transition-colors cursor-pointer"
                  >
                    Practice Topic
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 5: CANDIDATE PROFILE */}
      {subTab === 'profile' && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm space-y-6 max-w-2xl">
          <div>
            <h2 className="text-xl font-bold text-[#0F172A]">Candidate Profile & Preferences</h2>
            <p className="text-sm text-[#64748B] mt-1">Manage your target job profile, interview language, and microphone preferences.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#475569] uppercase tracking-wider mb-1">Full Name</label>
              <input
                type="text"
                readOnly
                value={candidateUser?.candidate?.full_name || candidateUser?.name || "Priya Sharma"}
                className="w-full px-3 py-2 border border-[#E2E8F0] bg-[#F8FAFC] rounded-lg text-sm text-[#0F172A]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#475569] uppercase tracking-wider mb-1">Email Address</label>
              <input
                type="email"
                readOnly
                value={candidateUser?.candidate?.email || candidateUser?.email || "candidate@example.com"}
                className="w-full px-3 py-2 border border-[#E2E8F0] bg-[#F8FAFC] rounded-lg text-sm text-[#0F172A]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#475569] uppercase tracking-wider mb-1">Target Role</label>
                <input
                  type="text"
                  readOnly
                  value={candidateUser?.candidate?.target_role || "Full Stack Developer"}
                  className="w-full px-3 py-2 border border-[#E2E8F0] bg-[#F8FAFC] rounded-lg text-sm text-[#0F172A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#475569] uppercase tracking-wider mb-1">Experience Level</label>
                <input
                  type="text"
                  readOnly
                  value={candidateUser?.candidate?.target_experience || "Mid-Level"}
                  className="w-full px-3 py-2 border border-[#E2E8F0] bg-[#F8FAFC] rounded-lg text-sm text-[#0F172A]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#475569] uppercase tracking-wider mb-1">AI Voice & Speech Accent</label>
              <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-[#2563EB]" />
                  <span className="text-xs font-medium text-[#0F172A]">Gnani Timbre en-IN (Natural Accent)</span>
                </div>
                <span className="text-[10px] font-semibold text-[#16A34A] bg-[#16A34A]/10 px-2 py-0.5 rounded-full">Optimized</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default CandidateWorkspace;


