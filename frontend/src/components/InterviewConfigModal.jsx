import React, { useState } from 'react';
import {
  Briefcase,
  Layers,
  Code2,
  Clock,
  Zap,
  Plus,
  X,
  CheckCircle2,
  Globe2,
  ShieldCheck,
  AlertCircle,
  Building2,
  Lock,
  Camera,
  Mic,
  Video,
  Settings,
  Compass,
  ArrowRight
} from 'lucide-react';

export const InterviewConfigModal = ({ roles, onStart, isStarting, initialMode = 'practice', errorMessage = null }) => {
  // Modes: "practice" (candidate-controlled) vs "company" (strict assessment)
  const [mode, setMode] = useState(initialMode);
  const [selectedRole, setSelectedRole] = useState(roles[0] || null);
  const [techStack, setTechStack] = useState(roles[0]?.default_tech || []);
  const [customSkillInput, setCustomSkillInput] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('Mid-Level (2-5 yrs)');
  const [difficulty, setDifficulty] = useState('Adaptive');
  const [targetQuestions, setTargetQuestions] = useState(3);
  const [interviewDurationMinutes, setInterviewDurationMinutes] = useState(15);
  const [distributionRatio, setDistributionRatio] = useState('balanced');
  const [language, setLanguage] = useState('en-IN');

  // Permissions and informed consent
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
  const [integrityConsent, setIntegrityConsent] = useState(true);
  const [storeRecordingConsent, setStoreRecordingConsent] = useState(false);
  const [validationError, setValidationError] = useState('');

  const handleRoleChange = (role) => {
    setSelectedRole(role);
    setTechStack(role.default_tech || []);
  };

  const toggleTech = (tech) => {
    if (techStack.includes(tech)) {
      setTechStack(techStack.filter(t => t !== tech));
    } else {
      setTechStack([...techStack, tech]);
    }
  };

  const addCustomSkill = (e) => {
    e.preventDefault();
    if (customSkillInput.trim() && !techStack.includes(customSkillInput.trim())) {
      setTechStack([...techStack, customSkillInput.trim()]);
      setCustomSkillInput('');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setValidationError('');

    if (mode === 'company') {
      if (!cameraEnabled || !microphoneEnabled) {
        setValidationError('Company Interview Mode requires both camera and microphone enabled.');
        return;
      }
      if (!integrityConsent) {
        setValidationError('Company Interview Mode requires explicit consent to integrity monitoring.');
        return;
      }
    }

    const roleName = selectedRole?.title || selectedRole?.name || 'Software Engineer';
    const roleId = selectedRole?.id || 'python-fullstack';

    onStart({
      mode,
      role: selectedRole,
      role_id: roleId,
      role_name: roleName,
      techStack,
      tech_stack: techStack,
      experienceLevel,
      experience_level: experienceLevel,
      difficulty,
      targetQuestions: Number(targetQuestions),
      target_questions: Number(targetQuestions),
      interviewDurationMinutes: Number(interviewDurationMinutes),
      interview_duration_minutes: Number(interviewDurationMinutes),
      distributionRatio,
      distribution_ratio: distributionRatio,
      language,
      camera_enabled: cameraEnabled,
      microphone_enabled: microphoneEnabled,
      integrity_consent: integrityConsent,
      store_recording_consent: storeRecordingConsent
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn pb-12">
      {/* Top Banner Header */}
      <div className="saas-card p-6 border-b border-[#E2E8F0]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#172B45] tracking-tight">
              Configure Interview Assessment
            </h1>
            <p className="text-xs text-[#64748B] mt-0.5">
              Select interview methodology, technical competencies, and assessment compliance.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#64748B] font-medium">Engine:</span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#F1F5F9] text-[#172B45] border border-[#E2E8F0]">
              Gnani Prisma & Timbre
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. Mode Selector: Practice vs Company Assessment */}
        <div className="saas-card p-5 space-y-3">
          <label className="text-xs font-bold text-[#172B45] uppercase tracking-wider block">
            Assessment Operating Mode
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Practice Mode Option */}
            <button
              type="button"
              onClick={() => setMode('practice')}
              className={`p-4 rounded-lg border text-left transition-all cursor-pointer ${mode === 'practice'
                ? 'bg-[#315C8C]/5 border-[#315C8C] ring-1 ring-[#315C8C]'
                : 'bg-white border-[#E2E8F0] hover:bg-[#F8FAFC]'
                }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-[#172B45]">Practice Mode (Candidate Controlled, Replay & Delete)</span>
                <Compass className="w-4 h-4 text-[#315C8C]" />
              </div>
              <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed">
                Candidate-controlled coaching. Candidate can re-record, review local video, and practice with hints.
              </p>
            </button>

            {/* Company Assessment Option */}
            <button
              type="button"
              onClick={() => setMode('company')}
              className={`p-4 rounded-lg border text-left transition-all cursor-pointer ${mode === 'company'
                ? 'bg-[#167C72]/5 border-[#167C72] ring-1 ring-[#167C72]'
                : 'bg-white border-[#E2E8F0] hover:bg-[#F8FAFC]'
                }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-[#172B45]">Company Interview Mode (Structured Company Assessment)</span>
                <Building2 className="w-4 h-4 text-[#167C72]" />
              </div>
              <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed">
                Structured proctored evaluation. Fixed question sequence, automated microphone handover, and objective audit logging.
              </p>
            </button>
          </div>
        </div>

        {/* 2. Target Role & Competencies */}
        <div className="saas-card p-5 space-y-4">
          <div>
            <label className="text-xs font-bold text-[#172B45] uppercase tracking-wider block mb-2">
              Select Job Role
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {roles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => handleRoleChange(role)}
                  className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${selectedRole?.id === role.id
                    ? 'bg-[#315C8C]/5 border-[#315C8C] text-[#172B45] font-semibold'
                    : 'bg-white border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'
                    }`}
                >
                  <div className="text-xs font-bold">{role.title}</div>
                  <div className="text-[11px] text-[#64748B] mt-0.5 line-clamp-1">{role.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Competency Skills Tags */}
          <div>
            <label className="text-xs font-bold text-[#172B45] uppercase tracking-wider block mb-2">
              Technical Competencies Evaluated
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {techStack.map((tech) => (
                <span
                  key={tech}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#F1F5F9] border border-[#CBD5E1] text-xs font-medium text-[#172B45]"
                >
                  <span>{tech}</span>
                  <button
                    type="button"
                    onClick={() => toggleTech(tech)}
                    className="text-[#94A3B8] hover:text-[#172B45]"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            <div className="flex items-center gap-2 max-w-sm">
              <input
                type="text"
                value={customSkillInput}
                onChange={(e) => setCustomSkillInput(e.target.value)}
                placeholder="Add skill (e.g. Docker, Redis)..."
                className="flex-1 px-3 py-1.5 rounded-md border border-[#E2E8F0] text-xs text-[#172B45] placeholder-[#94A3B8] focus:outline-none focus:border-[#315C8C]"
              />
              <button
                type="button"
                onClick={addCustomSkill}
                className="btn-secondary text-xs px-3 py-1.5 cursor-pointer"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* 3. Difficulty, Experience & Question Allocation */}
        <div className="saas-card p-5 space-y-4">
          <label className="text-xs font-bold text-[#172B45] uppercase tracking-wider block">
            Assessment Parameters
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-[#64748B] block mb-1">Experience Band</label>
              <select
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-[#E2E8F0] bg-white text-xs text-[#172B45] focus:outline-none focus:border-[#315C8C]"
              >
                <option>Junior (0-2 yrs)</option>
                <option>Mid-Level (2-5 yrs)</option>
                <option>Senior (5+ yrs)</option>
                <option>Lead / Staff (8+ yrs)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-[#64748B] block mb-1">Question Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-[#E2E8F0] bg-white text-xs text-[#172B45] focus:outline-none focus:border-[#315C8C]"
              >
                <option>Adaptive (Auto-Calibrating)</option>
                <option>Foundational</option>
                <option>Intermediate</option>
                <option>Advanced</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-[#64748B] block mb-1">Question Count</label>
              <select
                value={targetQuestions}
                onChange={(e) => setTargetQuestions(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-md border border-[#E2E8F0] bg-white text-xs text-[#172B45] focus:outline-none focus:border-[#315C8C]"
              >
                <option value={3}>3 Questions (~15 mins)</option>
                <option value={5}>5 Questions (~25 mins)</option>
                <option value={7}>7 Questions (~35 mins)</option>
              </select>
            </div>
          </div>
        </div>

        {/* 4. Permissions, Privacy & Informed Consent */}
        <div className="saas-card p-5 space-y-3">
          <label className="text-xs font-bold text-[#172B45] uppercase tracking-wider block">
            {mode === 'company' ? 'Integrity Protocols & Informed Consent' : 'Device & Privacy Preferences (Practice Mode)'}
          </label>

          <div className="space-y-2">
            <label className="flex items-center gap-2.5 text-xs text-[#172B45] cursor-pointer">
              <input
                type="checkbox"
                checked={cameraEnabled}
                aria-label="Camera enabled"
                onChange={(e) => setCameraEnabled(e.target.checked)}
                className="rounded border-[#CBD5E1] text-[#315C8C] focus:ring-[#315C8C]"
              />
              <span>Camera verification enabled (local visual centering)</span>
            </label>

            <label className="flex items-center gap-2.5 text-xs text-[#172B45] cursor-pointer">
              <input
                type="checkbox"
                checked={microphoneEnabled}
                aria-label="Microphone enabled"
                onChange={(e) => setMicrophoneEnabled(e.target.checked)}
                className="rounded border-[#CBD5E1] text-[#315C8C] focus:ring-[#315C8C]"
              />
              <span>Microphone enabled (Gnani Prisma 16kHz speech recognition)</span>
            </label>

            <label className="flex items-center gap-2.5 text-xs text-[#172B45] cursor-pointer">
              <input
                type="checkbox"
                checked={integrityConsent}
                aria-label="Informed Consent"
                onChange={(e) => setIntegrityConsent(e.target.checked)}
                className="rounded border-[#CBD5E1] text-[#315C8C] focus:ring-[#315C8C]"
              />
              <span>Informed Consent: Candidate agrees to objective telemetry & session integrity logging</span>
            </label>
          </div>
        </div>

        {/* Validation or API Error Banner */}
        {(validationError || errorMessage) && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{validationError || errorMessage}</span>
          </div>
        )}

        {/* Final Launch Action */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isStarting}
            className="btn-primary text-xs flex items-center gap-2 px-5 py-2.5 cursor-pointer"
          >
            <span>{isStarting ? 'Preparing Assessment Session...' : mode === 'company' ? 'Begin Company Interview' : 'Start Practice Session'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
