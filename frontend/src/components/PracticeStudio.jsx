import React, { useState } from 'react';
import { 
  RotateCcw, 
  HelpCircle, 
  BookOpen, 
  Layers, 
  Award, 
  Volume2, 
  Mic, 
  Play,
  ArrowRight,
  Radio,
  Compass,
  CheckCircle2
} from 'lucide-react';
import { AIAvatar } from './AIAvatar';
import { AudioPlayer } from './AudioPlayer';

export const PracticeStudio = ({ 
  roles = [], 
  onStartPracticeSession 
}) => {
  const [selectedRole, setSelectedRole] = useState(roles[0] || null);
  const [activeHintIndex, setActiveHintIndex] = useState(0);

  const learningPointers = [
    {
      title: "STAR Technique Articulation",
      desc: "Frame complex engineering achievements with Situation, Task, Action, and Measurable Result (e.g. 'reduced latency by 45%')."
    },
    {
      title: "Vocal Cadence & Filler Mitigation",
      desc: "Use deliberate 1-second pauses instead of filler words ('um', 'basically'). Projects technical authority and composure."
    },
    {
      title: "Architectural Rationale",
      desc: "Don't just mention the tool (e.g. Kafka or Redis) — justify why alternatives were dismissed based on scale or consistency."
    }
  ];

  return (
    <div className="space-y-6 animate-fadeIn max-w-5xl mx-auto">
      {/* Studio Header Card */}
      <div className="saas-card p-6 border-b border-[#E2E8F0]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-[#315C8C]/10 text-[#315C8C] inline-flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5" />
              Candidate Self-Paced Coaching Studio
            </span>
            <h1 className="text-xl font-bold text-[#172B45] tracking-tight">
              Voice Interview Practice & Cadence Studio
            </h1>
            <p className="text-xs text-[#64748B] max-w-2xl leading-relaxed">
              Build spoken fluency and concise technical answers in a low-stakes environment. Listen to AI speech synthesis, practice recording answers, and review speech metrics.
            </p>
          </div>

          <button
            onClick={() => onStartPracticeSession?.(selectedRole)}
            className="btn-primary text-xs flex items-center gap-2 cursor-pointer self-start md:self-auto"
          >
            <span>Launch Practice Session</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Role Selection & Pointers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Left 2 Cols: Role Selector */}
        <div className="md:col-span-2 saas-card p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
            <h2 className="text-sm font-bold text-[#172B45]">
              Select Practice Job Role
            </h2>
            <span className="text-[11px] text-[#64748B] font-mono">
              {roles.length} Roles Configured
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {roles.map(role => (
              <div
                key={role.id}
                onClick={() => setSelectedRole(role)}
                className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer ${
                  selectedRole?.id === role.id
                    ? 'bg-[#315C8C]/5 border-[#315C8C] ring-1 ring-[#315C8C]'
                    : 'bg-white border-[#E2E8F0] hover:bg-[#F8FAFC]'
                }`}
              >
                <div className="font-bold text-xs text-[#172B45]">{role.title}</div>
                <div className="text-[11px] text-[#64748B] mt-1 line-clamp-2">{role.description}</div>
                <div className="flex flex-wrap gap-1 mt-2.5">
                  {(role.default_tech || ['Java', 'Spring']).slice(0, 3).map((tech, i) => (
                    <span key={i} className="px-1.5 py-0.2 rounded bg-[#F1F5F9] text-[10px] text-[#64748B] font-mono">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 1 Col: Articulation Guides */}
        <div className="saas-card p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#E2E8F0]">
            <Award className="w-4 h-4 text-[#315C8C]" />
            <h2 className="text-sm font-bold text-[#172B45]">
              Spoken Interview Best Practices
            </h2>
          </div>

          <div className="space-y-3">
            {learningPointers.map((p, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                <div className="font-bold text-xs text-[#172B45] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#167C72]" />
                  <span>{p.title}</span>
                </div>
                <p className="text-[11px] text-[#64748B] leading-relaxed">
                  {p.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
