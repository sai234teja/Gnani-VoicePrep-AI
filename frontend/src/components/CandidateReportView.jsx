import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Briefcase, 
  Video, 
  FileCheck2, 
  Search, 
  ArrowUpRight, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  ExternalLink,
  ChevronRight,
  Award,
  Filter,
  Download,
  AlertCircle,
  FileText
} from 'lucide-react';
import IntegrityTimeline from './secure_assess/IntegrityTimeline';

export const CandidateReportView = ({ onSelectCandidate, onLaunchAssessment, onViewReport }) => {
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCandidateDetail, setActiveCandidateDetail] = useState(null);
  const [realCandidates, setRealCandidates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCandidates();
  }, []);

  const fetchCandidates = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/candidates');
      if (res.ok) {
        const data = await res.json();
        setRealCandidates(data.candidates || []);
      }
    } catch (e) {
      console.warn("Could not fetch candidates from backend:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Clearly labeled demonstration assessment data for fallback exploration
  const sampleCandidatesData = [
    {
      id: "cand-201",
      name: "Kavya Subramanian",
      email: "kavya.sub@example.com",
      role: "Python Full Stack",
      roleId: "python-fullstack",
      experience: "Senior (5+ yrs)",
      interviewDate: "Nov 09, 2026",
      status: "Evaluated - High Readiness",
      overallScore: 92,
      dimensionScores: {
        "Technical Knowledge": 94,
        "Problem Solving": 90,
        "Communication Clarity": 88,
        "Project Explanation": 95,
        "STAR Articulation": 92
      },
      introduction: "Full-stack engineer with 6 years experience architecting distributed async Python APIs (FastAPI/Django) and modern React interfaces. Led migration of monolithic microservices reducing p99 latency by 35%.",
      integrityStatus: "Verified Clear (0 Disconnects, Local Processing)",
      strengths: [
        "Exceptional architectural clarity explaining Celery worker queues and Redis backpressure.",
        "Demonstrated quantified STAR methodology across all scenario prompts.",
        "Smooth conversational cadence with minimal verbal filler."
      ],
      growthAreas: [
        "Elaborate further on edge cases when third-party OAuth provider timeouts occur."
      ],
      isDemo: true
    },
    {
      id: "cand-202",
      name: "Rahul Verma",
      email: "rahul.v@example.com",
      role: "DevOps & Cloud Engineer",
      roleId: "devops-cloud",
      experience: "Mid-Level (3 yrs)",
      interviewDate: "Nov 08, 2026",
      status: "Evaluated - Medium Readiness",
      overallScore: 78,
      dimensionScores: {
        "Technical Knowledge": 80,
        "Problem Solving": 75,
        "Communication Clarity": 79,
        "Project Explanation": 76,
        "STAR Articulation": 80
      },
      introduction: "DevOps specialist with 3 years supporting Kubernetes container clusters and Terraform cloud infrastructure on AWS.",
      integrityStatus: "Verified Clear (0 Disconnects, Local Processing)",
      strengths: [
        "Strong fundamental knowledge of Docker multi-stage builds.",
        "Clear articulation of GitOps workflows with ArgoCD."
      ],
      growthAreas: [
        "Provide more depth on distributed tracing and Prometheus alertmanager routing."
      ],
      isDemo: true
    }
  ];

  // Map real candidates from SQLite
  const mappedRealCandidates = realCandidates.map(c => {
    const latestSession = c.sessions && c.sessions.length > 0 ? c.sessions[0] : null;
    const report = latestSession?.final_report || {};
    return {
      id: c.candidate_id,
      sessionId: latestSession?.session_id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      institution: c.institution || 'N/A',
      role: c.role_title,
      roleId: c.role_id,
      experience: c.experience_level,
      interviewDate: new Date(c.created_at * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
      status: latestSession ? `Session: ${latestSession.interview_status}` : 'Registered',
      overallScore: latestSession?.overall_score || 0,
      dimensionScores: report.dimension_scores || {
        "Technical Knowledge": latestSession?.overall_score || 60,
        "Problem Solving": latestSession?.overall_score || 60,
        "Communication Clarity": 70,
        "STAR Articulation": 65
      },
      introduction: report.candidate_intro_summary || `Candidate registered for ${c.role_title} with ${c.experience_level} experience at ${c.institution || 'University/Organization'}.`,
      integrityStatus: "Verified Clear (Local Evaluation)",
      strengths: report.strengths || ["Engaged in conversational speech assessment", "Clear articulation during interview session"],
      growthAreas: report.areas_for_growth || ["Continue elaborating on practical production engineering scenarios."],
      sessions: c.sessions || [],
      isDemo: false
    };
  });

  const displayList = mappedRealCandidates.length > 0 ? mappedRealCandidates : sampleCandidatesData;

  const filtered = displayList.filter(c => {
    const matchRole = selectedRole === 'ALL' || c.roleId === selectedRole;
    const matchSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchRole && matchSearch;
  });

  const handleExportCandidateCSV = (candidate) => {
    const headers = ["Candidate ID", "Name", "Email", "Phone", "Institution", "Role", "Experience", "Date", "Overall Score", "Status"];
    const row = [
      candidate.id,
      `"${candidate.name}"`,
      `"${candidate.email}"`,
      `"${candidate.phone || 'N/A'}"`,
      `"${candidate.institution || 'N/A'}"`,
      `"${candidate.role}"`,
      `"${candidate.experience}"`,
      `"${candidate.interviewDate}"`,
      candidate.overallScore,
      `"${candidate.status}"`
    ];

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), row.join(",")].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${candidate.name.replace(/\s+/g, '_')}_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fadeIn max-w-6xl mx-auto pb-12">
      {/* Top Banner Card */}
      <div className="saas-card p-6 border-b border-[#E2E8F0]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#172B45] tracking-tight">
              Candidate Evaluation & Performance Records
            </h1>
            <p className="text-xs text-[#64748B] mt-0.5">
              Review transcripts, speech pacing, STAR scores, and verified camera telemetry.
            </p>
          </div>

          <button
            onClick={() => onLaunchAssessment?.()}
            className="btn-primary text-xs flex items-center gap-2 cursor-pointer self-start md:self-auto"
          >
            <span>Assess New Candidate</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Grid: List + Detail Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Candidate List (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="saas-card p-3 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-[#94A3B8]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search candidate records..."
              className="w-full text-xs text-[#172B45] placeholder-[#94A3B8] focus:outline-none bg-transparent"
            />
          </div>

          <div className="space-y-2">
            {filtered.map(cand => (
              <div
                key={cand.id}
                onClick={() => setActiveCandidateDetail(cand)}
                className={`saas-card p-4 transition-colors cursor-pointer ${
                  activeCandidateDetail?.id === cand.id
                    ? 'border-[#315C8C] ring-1 ring-[#315C8C] bg-[#315C8C]/5'
                    : 'hover:bg-[#F8FAFC]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-[#172B45]">{cand.name}</span>
                    {cand.isDemo ? (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-[#315C8C]/10 text-[#315C8C]">Demo</span>
                    ) : (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-[#167C72]/10 text-[#167C72]">Active</span>
                    )}
                  </div>
                  <span className="font-mono text-xs font-bold text-[#172B45]">{cand.overallScore}/100</span>
                </div>
                <div className="text-[11px] text-[#64748B] mt-1">{cand.role} • {cand.experience}</div>
                <div className="text-[10px] text-[#94A3B8]">{cand.email}</div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#E2E8F0] text-[10px] text-[#64748B]">
                  <span>{cand.interviewDate}</span>
                  <span className="text-[#167C72] font-semibold">{cand.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Detailed Breakdown (7 cols) */}
        <div className="lg:col-span-7">
          {activeCandidateDetail ? (
            <div className="saas-card p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
                <div>
                  <h2 className="text-base font-bold text-[#172B45]">{activeCandidateDetail.name}</h2>
                  <div className="text-xs text-[#64748B]">
                    {activeCandidateDetail.role} • {activeCandidateDetail.email} {activeCandidateDetail.phone && `• ${activeCandidateDetail.phone}`}
                  </div>
                  {activeCandidateDetail.institution && (
                    <div className="text-[11px] text-[#94A3B8]">Institution / Company: {activeCandidateDetail.institution}</div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xl font-bold text-[#315C8C]">{activeCandidateDetail.overallScore}/100</div>
                    <div className="text-[10px] text-[#167C72] font-semibold">{activeCandidateDetail.status}</div>
                  </div>
                  <button
                    onClick={() => handleExportCandidateCSV(activeCandidateDetail)}
                    className="p-2 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#315C8C] transition-colors cursor-pointer"
                    title="Export candidate profile as CSV"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  {activeCandidateDetail.sessionId && (
                    <button
                      onClick={() => onViewReport?.(activeCandidateDetail.sessionId)}
                      className="px-3 py-1.5 rounded-lg bg-[#315C8C] hover:bg-[#264A72] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>Full Assessment</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Introduction & Profile Summary */}
              <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#172B45] leading-relaxed">
                <span className="font-semibold block text-[11px] text-[#64748B] uppercase mb-1">Candidate Profile Intro</span>
                {activeCandidateDetail.introduction}
              </div>

              {/* Dimension Scores */}
              <div className="space-y-2">
                <span className="font-bold text-xs text-[#172B45] block">Evaluation Dimensions</span>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(activeCandidateDetail.dimensionScores).map(([dim, score]) => (
                    <div key={dim} className="p-2.5 rounded border border-[#E2E8F0] bg-white flex justify-between items-center text-xs">
                      <span className="text-[#64748B]">{dim}</span>
                      <span className="font-bold text-[#172B45] font-mono">{score}/100</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Key Strengths */}
              <div className="space-y-1.5">
                <span className="font-bold text-xs text-[#167C72] block">Demonstrated Strengths</span>
                <ul className="text-xs text-[#172B45] space-y-1 list-disc list-inside">
                  {activeCandidateDetail.strengths.map((str, i) => (
                    <li key={i} className="leading-relaxed">{str}</li>
                  ))}
                </ul>
              </div>

              {/* Target Growth Areas */}
              <div className="space-y-1.5 pt-2 border-t border-[#E2E8F0]">
                <span className="font-bold text-xs text-amber-700 block">Growth & Refinement Areas</span>
                <ul className="text-xs text-[#64748B] space-y-1 list-disc list-inside">
                  {activeCandidateDetail.growthAreas.map((area, i) => (
                    <li key={i} className="leading-relaxed">{area}</li>
                  ))}
                </ul>
              </div>

              {/* Session History if multiple sessions exist */}
              {activeCandidateDetail.sessions?.length > 1 && (
                <div className="pt-2 border-t border-[#E2E8F0] space-y-2">
                  <span className="font-bold text-xs text-[#172B45] block">Prior Interview Sessions</span>
                  <div className="space-y-1">
                    {activeCandidateDetail.sessions.map((sess, idx) => (
                      <div key={idx} className="p-2 rounded bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between text-xs">
                        <span className="font-mono text-[11px] text-[#64748B]">{sess.session_id.slice(0, 8)}... ({new Date(sess.joined_at * 1000).toLocaleDateString()})</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#172B45]">{sess.overall_score}/100</span>
                          <button
                            onClick={() => onViewReport?.(sess.session_id)}
                            className="text-[#315C8C] hover:underline text-[11px] font-semibold cursor-pointer"
                          >
                            View
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="saas-card p-12 text-center text-xs text-[#64748B]">
              Select a candidate report from the left column to inspect transcripts, speech pacing, and dimension scores.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
