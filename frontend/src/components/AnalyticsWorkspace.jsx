import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Users,
  Award,
  CheckCircle2,
  Clock,
  Briefcase,
  Layers,
  ArrowUpRight,
  Filter,
  Download,
  AlertCircle,
  Sparkles,
  ArrowUpDown,
  BookOpen,
  PieChart
} from 'lucide-react';

export const AnalyticsWorkspace = ({ onViewReport }) => {
  const [summary, setSummary] = useState(null);
  const [roleAnalytics, setRoleAnalytics] = useState([]);
  const [insights, setInsights] = useState(null);
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Candidate Comparison State
  const [comparisonSessions, setComparisonSessions] = useState([]);
  const [comparisonData, setComparisonData] = useState([]);
  const [isComparing, setIsComparing] = useState(false);
  const [availableCandidates, setAvailableCandidates] = useState([]);

  useEffect(() => {
    fetchAnalyticsData();
    fetchCandidateList();
  }, [selectedRole]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('gnani_recruiter_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  const fetchAnalyticsData = async () => {
    setIsLoading(true);
    try {
      const headers = getAuthHeaders();
      const roleQuery = selectedRole !== 'ALL' ? `?role_id=${selectedRole}` : '';

      const [sumRes, roleRes, insRes] = await Promise.all([
        fetch('/api/analytics/dashboard-summary', { headers }),
        fetch(`/api/analytics/roles${roleQuery}`, { headers }),
        fetch('/api/analytics/intelligent-insights', { headers })
      ]);

      if (sumRes.ok) setSummary(await sumRes.json());
      if (roleRes.ok) {
        const rdata = await roleRes.json();
        setRoleAnalytics(rdata.role_analytics || []);
      }
      if (insRes.ok) setInsights(await insRes.json());
    } catch (err) {
      console.warn("Analytics fetch failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCandidateList = async () => {
    try {
      const res = await fetch('/api/candidates');
      if (res.ok) {
        const data = await res.json();
        const candList = [];
        (data.candidates || []).forEach(c => {
          (c.sessions || []).forEach(s => {
            candList.push({
              session_id: s.session_id,
              name: c.name,
              role_title: c.role_title,
              score: s.overall_score || 0,
              status: s.interview_status
            });
          });
        });
        setAvailableCandidates(candList);
      }
    } catch (_) {}
  };

  const handleToggleCompare = (sessionId) => {
    let updated;
    if (comparisonSessions.includes(sessionId)) {
      updated = comparisonSessions.filter(id => id !== sessionId);
    } else {
      if (comparisonSessions.length >= 4) return; // Limit to 4 candidates
      updated = [...comparisonSessions, sessionId];
    }
    setComparisonSessions(updated);
    if (updated.length > 0) {
      executeComparison(updated);
    } else {
      setComparisonData([]);
    }
  };

  const executeComparison = async (sessionIds) => {
    setIsComparing(true);
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      };
      const res = await fetch('/api/analytics/compare', {
        method: 'POST',
        headers,
        body: JSON.stringify({ session_ids: sessionIds })
      });
      if (res.ok) {
        const data = await res.json();
        setComparisonData(data.comparison || []);
      }
    } catch (e) {
      console.warn("Comparison fetch failed:", e);
    } finally {
      setIsComparing(false);
    }
  };

  const handleExportAnalyticsCSV = () => {
    if (!summary) return;
    const headers = ["Metric", "Value"];
    const rows = [
      ["Total Registered", summary.total_registered],
      ["Total Sessions", summary.total_sessions],
      ["Attended", summary.attended],
      ["Absent", summary.absent],
      ["Completed", summary.completed],
      ["In Progress", summary.in_progress],
      ["Interrupted", summary.interrupted],
      ["Terminated", summary.terminated],
      ["Average Score", `${summary.average_score}%`],
      ["Completion Rate", `${summary.completion_rate_percentage}%`]
    ];

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Gnani_Analytics_Summary_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fadeIn">
      {/* Header Banner */}
      <div className="saas-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-[#315C8C]/10 text-[#315C8C] inline-flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" />
              Recruiter Analytics & Assessment Insights
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#167C72]/10 text-[#167C72] font-semibold">
              Live SQL Telemetry
            </span>
          </div>
          <h1 className="text-xl font-bold text-[#172B45] tracking-tight mt-1">
            Enterprise Talent Intelligence
          </h1>
          <p className="text-xs text-[#64748B] max-w-2xl mt-0.5">
            Cohort benchmark distributions, role-wise competency averages, multi-candidate comparisons, and evidence-based curriculum recommendations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="px-3 py-1.5 rounded-md border border-[#E2E8F0] bg-white text-xs text-[#172B45] focus:outline-none focus:border-[#315C8C]"
          >
            <option value="ALL">All Job Roles</option>
            <option value="java-dev">Java Developer</option>
            <option value="python-fullstack">Python Full Stack</option>
            <option value="mern-stack">MERN Stack</option>
            <option value="frontend-dev">Frontend Developer</option>
            <option value="backend-dev">Backend Developer</option>
          </select>

          <button
            onClick={handleExportAnalyticsCSV}
            className="btn-secondary text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Summary</span>
          </button>
        </div>
      </div>

      {/* 1. Core Key Performance Metrics */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="saas-card p-4 space-y-1">
            <div className="text-[11px] font-medium text-[#64748B] flex items-center justify-between">
              <span>Total Candidate Cohort</span>
              <Users className="w-4 h-4 text-[#315C8C]" />
            </div>
            <div className="text-2xl font-bold font-mono text-[#172B45]">{summary.total_registered}</div>
            <div className="text-[10px] text-[#167C72]">
              {summary.attended} Attended • {summary.absent} Absent
            </div>
          </div>

          <div className="saas-card p-4 space-y-1">
            <div className="text-[11px] font-medium text-[#64748B] flex items-center justify-between">
              <span>Cohort Average Score</span>
              <Award className="w-4 h-4 text-[#167C72]" />
            </div>
            <div className="text-2xl font-bold font-mono text-[#172B45]">{summary.average_score}%</div>
            <div className="text-[10px] text-[#64748B]">Across completed assessments</div>
          </div>

          <div className="saas-card p-4 space-y-1">
            <div className="text-[11px] font-medium text-[#64748B] flex items-center justify-between">
              <span>Interview Completion Rate</span>
              <CheckCircle2 className="w-4 h-4 text-[#315C8C]" />
            </div>
            <div className="text-2xl font-bold font-mono text-[#172B45]">{summary.completion_rate_percentage}%</div>
            <div className="text-[10px] text-[#64748B]">{summary.completed} of {summary.total_sessions} completed</div>
          </div>

          <div className="saas-card p-4 space-y-1">
            <div className="text-[11px] font-medium text-[#64748B] flex items-center justify-between">
              <span>Interrupted / Inactivity</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold font-mono text-[#172B45]">{summary.interrupted + summary.terminated}</div>
            <div className="text-[10px] text-amber-700">
              {summary.terminated} Timed out • {summary.interrupted} Exits
            </div>
          </div>
        </div>
      )}

      {/* 2. Intelligent Assessment Insights Banner */}
      {insights && (
        <div className="saas-card p-5 border-l-4 border-l-[#167C72] space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#167C72]" />
            <h2 className="text-sm font-bold text-[#172B45]">
              Evidence-Based Assessment Intelligence & Curriculum Insights
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Top Strengths */}
            <div className="p-3.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
              <div className="text-xs font-bold text-[#172B45] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Consistently Observed Strengths</span>
              </div>
              <ul className="text-xs text-[#64748B] space-y-1.5">
                {insights.top_candidate_strengths.length > 0 ? (
                  insights.top_candidate_strengths.map((s, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                      <span>{s.insight}</span>
                    </li>
                  ))
                ) : (
                  <li className="italic text-[#94A3B8]">No evaluated strengths recorded in cohort yet.</li>
                )}
              </ul>
            </div>

            {/* Top Skill Gaps */}
            <div className="p-3.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
              <div className="text-xs font-bold text-[#172B45] flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>Frequently Observed Skill Gaps</span>
              </div>
              <ul className="text-xs text-[#64748B] space-y-1.5">
                {insights.top_observed_skill_gaps.length > 0 ? (
                  insights.top_observed_skill_gaps.map((g, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                      <span>{g.insight}</span>
                    </li>
                  ))
                ) : (
                  <li className="italic text-[#94A3B8]">No recurring skill gaps identified yet.</li>
                )}
              </ul>
            </div>
          </div>

          {/* Actionable Recommendations */}
          {insights.actionable_curriculum_recommendations.length > 0 && (
            <div className="p-3 rounded-lg bg-teal-50/50 border border-teal-200/60 text-xs text-teal-900 space-y-1">
              <span className="font-bold flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-[#167C72]" />
                Curriculum & Question Bank Recommendations:
              </span>
              <p className="leading-relaxed">
                {insights.actionable_curriculum_recommendations[0]}
              </p>
            </div>
          )}
        </div>
      )}

      {/* 3. Role-Based Competency & Dimension Radar Breakdown */}
      <div className="saas-card p-5 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
          <div>
            <h3 className="text-sm font-bold text-[#172B45]">
              Role-Wise Assessment Performance & Competency Breakdown
            </h3>
            <p className="text-[11px] text-[#64748B]">
              Aggregate scores mapped across Technical Knowledge, Problem Solving, Communication, and Architecture.
            </p>
          </div>
          <span className="text-xs font-semibold text-[#315C8C]">
            {roleAnalytics.length} Roles Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
          {roleAnalytics.map((role) => (
            <div key={role.role_id} className="p-4 rounded-lg border border-[#E2E8F0] bg-white space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#172B45] truncate">{role.role_title}</span>
                <span className="text-xs font-mono font-bold text-[#315C8C]">{role.average_score}%</span>
              </div>

              {/* Competency Bars */}
              <div className="space-y-1.5 text-[10px]">
                {Object.entries(role.dimension_averages || {}).map(([dim, val]) => (
                  <div key={dim} className="space-y-0.5">
                    <div className="flex justify-between text-[#64748B]">
                      <span>{dim}</span>
                      <span className="font-mono font-semibold text-[#172B45]">{val}%</span>
                    </div>
                    <div className="w-full bg-[#F1F5F9] h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#315C8C] rounded-full transition-all duration-300"
                        style={{ width: `${val}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-[#F1F5F9] flex justify-between text-[11px] text-[#64748B]">
                <span>Candidates: <strong className="text-[#172B45]">{role.candidate_count}</strong></span>
                <span>Range: {role.min_score}% – {role.max_score}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Multi-Candidate Competency Comparison Workspace */}
      <div className="saas-card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#E2E8F0]">
          <div>
            <h3 className="text-sm font-bold text-[#172B45] flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-[#315C8C]" />
              <span>Multi-Candidate Competency Comparison</span>
            </h3>
            <p className="text-[11px] text-[#64748B]">
              Select up to 4 candidates to benchmark competency dimensions, strengths, and growth areas side-by-side.
            </p>
          </div>

          <div className="text-xs text-[#64748B]">
            {comparisonSessions.length}/4 Selected
          </div>
        </div>

        {/* Candidate Selector Badges */}
        <div className="flex flex-wrap gap-2 pt-1">
          {availableCandidates.slice(0, 8).map((cand) => {
            const isSelected = comparisonSessions.includes(cand.session_id);
            return (
              <button
                key={cand.session_id}
                onClick={() => handleToggleCompare(cand.session_id)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#315C8C] text-white border-[#315C8C]'
                    : 'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0] hover:border-[#CBD5E1]'
                }`}
              >
                <span>{cand.name}</span>
                <span className="font-mono text-[10px] opacity-80">({cand.score}%)</span>
              </button>
            );
          })}
        </div>

        {/* Comparison Table */}
        {comparisonData.length > 0 ? (
          <div className="overflow-x-auto border border-[#E2E8F0] rounded-lg mt-3 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B]">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Candidate</th>
                  <th className="py-2.5 px-3 font-semibold">Job Role</th>
                  <th className="py-2.5 px-3 font-semibold">Overall</th>
                  <th className="py-2.5 px-3 font-semibold">Technical</th>
                  <th className="py-2.5 px-3 font-semibold">Problem Solving</th>
                  <th className="py-2.5 px-3 font-semibold">Communication</th>
                  <th className="py-2.5 px-3 font-semibold">Demonstrated Strengths</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {comparisonData.map((c) => (
                  <tr key={c.session_id} className="hover:bg-[#F8FAFC]">
                    <td className="py-2.5 px-3 font-semibold text-[#172B45] whitespace-nowrap">
                      {c.name}
                    </td>
                    <td className="py-2.5 px-3 text-[#64748B]">{c.role_title}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-[#315C8C]">{c.overall_score}%</td>
                    <td className="py-2.5 px-3 font-mono text-[#172B45]">{c.dimension_scores["Technical Knowledge"] || 70}%</td>
                    <td className="py-2.5 px-3 font-mono text-[#172B45]">{c.dimension_scores["Problem Solving"] || 70}%</td>
                    <td className="py-2.5 px-3 font-mono text-[#172B45]">{c.dimension_scores["Communication"] || 75}%</td>
                    <td className="py-2.5 px-3 text-[#64748B] max-w-xs truncate" title={c.strengths.join(", ")}>
                      {c.strengths[0] || 'Standard proficiency'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => onViewReport?.(c.session_id)}
                        className="text-xs text-[#315C8C] font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>View</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-[#94A3B8] border border-dashed border-[#CBD5E1] rounded-lg">
            Click candidate tags above to benchmark and compare competencies side-by-side.
          </div>
        )}
      </div>
    </div>
  );
};

