import React, { useState } from 'react';
import { 
  Calendar, 
  Clock, 
  Mail, 
  User, 
  Briefcase, 
  FileText, 
  Send, 
  AlertCircle, 
  CheckCircle2, 
  X,
  Sparkles
} from 'lucide-react';

export const ScheduleInterviewModal = ({
  isOpen,
  onClose,
  roles = [],
  candidates = [],
  initialCandidate = null,
  onInvitationCreated
}) => {
  if (!isOpen) return null;

  const [candidateName, setCandidateName] = useState(initialCandidate?.name || '');
  const [candidateEmail, setCandidateEmail] = useState(initialCandidate?.email || '');
  const [candidateId, setCandidateId] = useState(initialCandidate?.candidate_id || '');
  const [selectedRoleId, setSelectedRoleId] = useState(roles[0]?.id || 'python-fullstack');
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [dateStr, setDateStr] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [customNotes, setCustomNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleSelectCandidate = (e) => {
    const cid = e.target.value;
    setCandidateId(cid);
    const found = candidates.find(c => c.candidate_id === cid);
    if (found) {
      setCandidateName(found.name);
      setCandidateEmail(found.email);
      if (found.role_id) setSelectedRoleId(found.role_id);
    }
  };

  const handleSchedule = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const scheduledTimestamp = Math.floor(new Date(dateStr).getTime() / 1000);
      const chosenRole = roles.find(r => r.id === selectedRoleId) || roles[0];
      const token = localStorage.getItem('recruiter_token');

      const res = await fetch('/api/invitations/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          candidate_id: candidateId || undefined,
          candidate_name: candidateName,
          candidate_email: candidateEmail,
          role_id: selectedRoleId,
          role_title: chosenRole?.title || chosenRole?.name || 'Software Engineer',
          scheduled_time: scheduledTimestamp,
          duration_minutes: Number(durationMinutes),
          custom_notes: customNotes,
          expires_in_hours: 72
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Could not schedule interview invitation.');
      }

      setSuccess(data.invitation);
      onInvitationCreated?.(data.invitation);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0A2540]/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-[#0A2540] to-[#1E3A8A] text-white flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Schedule Candidate Assessment</h2>
            <p className="text-xs text-white/80 mt-0.5">Send a branded invitation with single-use secure link & reminders.</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl font-bold">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2 text-xs text-emerald-700">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Interview Scheduled & Invitation Sent!</p>
                <p className="text-[11px] mt-0.5 font-mono break-all">{success.invitation_link}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSchedule} className="space-y-4">
            {candidates.length > 0 && !initialCandidate && (
              <div>
                <label className="block text-xs font-semibold text-[#172B45] mb-1">Select Registered Candidate (Optional)</label>
                <select
                  value={candidateId}
                  onChange={handleSelectCandidate}
                  className="w-full px-3 py-2 text-xs border border-[#CBD5E1] rounded-lg"
                >
                  <option value="">-- Choose existing candidate or enter new --</option>
                  {candidates.map(c => (
                    <option key={c.candidate_id} value={c.candidate_id}>
                      {c.name} ({c.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#172B45] mb-1">Candidate Name</label>
                <input
                  type="text"
                  required
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-3 py-2 text-xs border border-[#CBD5E1] rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#172B45] mb-1">Candidate Email</label>
                <input
                  type="email"
                  required
                  value={candidateEmail}
                  onChange={(e) => setCandidateEmail(e.target.value)}
                  placeholder="rahul@example.com"
                  className="w-full px-3 py-2 text-xs border border-[#CBD5E1] rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#172B45] mb-1">Assessment Job Role</label>
                <select
                  value={selectedRoleId}
                  onChange={(e) => setSelectedRoleId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#CBD5E1] rounded-lg"
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.title || r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#172B45] mb-1">Duration (Minutes)</label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#CBD5E1] rounded-lg"
                >
                  <option value={10}>10 Minutes (Quick Screen)</option>
                  <option value={15}>15 Minutes (Standard Assessment)</option>
                  <option value={20}>20 Minutes (Deep Dive)</option>
                  <option value={30}>30 Minutes (Comprehensive)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#172B45] mb-1">Scheduled Date & Time (Local / UTC)</label>
              <input
                type="datetime-local"
                required
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#CBD5E1] rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#172B45] mb-1">Preparation Notes / Topic Focus</label>
              <textarea
                rows={2}
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder="e.g. Focus on microservices design, async event loops, and system architecture."
                className="w-full px-3 py-2 text-xs border border-[#CBD5E1] rounded-lg resize-none"
              />
            </div>

            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3 text-[11px] text-[#64748B] space-y-1">
              <div className="font-semibold text-[#172B45] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>Automated Email Workflow Included:</span>
              </div>
              <p>• Immediate branded interview invitation with single-use token.</p>
              <p>• Automated 24-hour reminder email scheduled in the database queue.</p>
              <p>• Auto-cancellation if recruiter cancels the interview slot.</p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 border border-[#CBD5E1] text-[#64748B] rounded-lg text-xs font-semibold hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-xs font-semibold shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{loading ? 'Dispatching...' : 'Send Interview Invitation'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

