import React, { useState } from 'react';
import {
  Briefcase,
  Plus,
  Code2,
  Layers,
  Clock,
  CheckCircle2,
  Globe2,
  Sliders,
  ArrowRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

export const JobRoleManager = ({
  roles = [],
  onConfigureRole
}) => {
  const [selectedRole, setSelectedRole] = useState(roles[0] || null);
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'create'

  // New role form state
  const [newRoleName, setNewRoleName] = useState('');
  const [newTechInput, setNewTechInput] = useState('');
  const [newTechList, setNewTechList] = useState([]);
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [createSuccessMsg, setCreateSuccessMsg] = useState(false);

  const handleAddTech = (e) => {
    e.preventDefault();
    if (newTechInput.trim() && !newTechList.includes(newTechInput.trim())) {
      setNewTechList([...newTechList, newTechInput.trim()]);
      setNewTechInput('');
    }
  };

  const handleCreateRole = (e) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    setCreateSuccessMsg(true);
    setTimeout(() => {
      setCreateSuccessMsg(false);
      setActiveTab('list');
      setNewRoleName('');
      setNewTechList([]);
      setNewRoleDesc('');
    }, 1200);
  };

  return (
    <div className="space-y-6 animate-fadeIn max-w-5xl mx-auto pb-12">
      {/* Top Banner Card */}
      <div className="saas-card p-6 border-b border-[#E2E8F0]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#172B45] tracking-tight">
              Job Roles & Rubric Benchmarks
            </h1>
            <p className="text-xs text-[#64748B] mt-0.5">
              Standardize competencies, question banks, and seniority scoring parameters across engineering hiring.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab(activeTab === 'list' ? 'create' : 'list')}
              className="btn-primary text-xs flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{activeTab === 'list' ? 'Add New Job Role' : 'View Configured Roles'}</span>
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'create' ? (
        <div className="saas-card p-6 space-y-4 max-w-2xl">
          <h2 className="text-sm font-bold text-[#172B45]">Define Job Role Specification</h2>
          {createSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Role configuration saved to workspace.</span>
            </div>
          )}
          <form onSubmit={handleCreateRole} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-[#172B45] block mb-1">Role Title</label>
              <input
                type="text"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="e.g. Lead Distributed Systems Engineer"
                className="w-full px-3 py-2 rounded-md border border-[#E2E8F0] text-xs text-[#172B45] focus:outline-none focus:border-[#315C8C]"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[#172B45] block mb-1">Role Objective & Description</label>
              <textarea
                value={newRoleDesc}
                onChange={(e) => setNewRoleDesc(e.target.value)}
                placeholder="Describe key responsibilities and target qualifications..."
                rows={3}
                className="w-full px-3 py-2 rounded-md border border-[#E2E8F0] text-xs text-[#172B45] focus:outline-none focus:border-[#315C8C]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[#172B45] block mb-1">Primary Technical Competencies</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {newTechList.map((t, i) => (
                  <span key={i} className="px-2 py-0.5 rounded bg-[#F1F5F9] border border-[#CBD5E1] text-[11px] font-mono text-[#172B45]">
                    {t}
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTechInput}
                  onChange={(e) => setNewTechInput(e.target.value)}
                  placeholder="e.g. Go, Kubernetes, gRPC"
                  className="flex-1 px-3 py-1.5 rounded-md border border-[#E2E8F0] text-xs text-[#172B45] focus:outline-none focus:border-[#315C8C]"
                />
                <button
                  type="button"
                  onClick={handleAddTech}
                  className="btn-secondary text-xs"
                >
                  Add Skill
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary text-xs"
              >
                Save Role
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map(role => (
            <div key={role.id} className="saas-card p-5 space-y-3 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-[#172B45]">{role.title}</h3>
                  <span className="text-[10px] font-semibold text-[#167C72] px-2 py-0.5 rounded bg-[#167C72]/10">Active</span>
                </div>
                <p className="text-xs text-[#64748B] leading-relaxed">
                  {role.description || 'Comprehensive evaluation covering system architecture and implementation trade-offs.'}
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-[#E2E8F0]">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">Core Skills</div>
                <div className="flex flex-wrap gap-1">
                  {(role.default_tech || ['Java', 'Spring', 'Architecture']).map((tech, i) => (
                    <span key={i} className="px-2 py-0.5 rounded bg-[#F8FAFC] border border-[#E2E8F0] text-[10px] font-mono text-[#64748B]">
                      {tech}
                    </span>
                  ))}
                </div>

                <button
                  onClick={() => onConfigureRole?.(role)}
                  className="w-full mt-2 py-2 rounded border border-[#E2E8F0] hover:bg-[#F8FAFC] text-xs font-semibold text-[#315C8C] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Launch Assessment</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
