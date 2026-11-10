import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Users, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Plus, 
  UserCheck, 
  Palette, 
  Sliders, 
  Activity, 
  RefreshCw,
  Mail,
  Lock
} from 'lucide-react';

export const OrganizationWorkspace = ({ currentOrg, userProfile, onOrgUpdated }) => {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'recruiters' | 'branding' | 'platform'
  const [recruiters, setRecruiters] = useState([]);
  const [loadingRecruiters, setLoadingRecruiters] = useState(false);
  const [platformMetrics, setPlatformMetrics] = useState(null);
  const [allOrgs, setAllOrgs] = useState([]);

  // Recruiter Invite Form
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteRole, setInviteRole] = useState('recruiter');
  const [actionMsg, setActionMsg] = useState(null);

  // Branding Form
  const [portalName, setPortalName] = useState(currentOrg?.branding?.portal_name || 'Gnani VoicePrep AI');
  const [primaryColor, setPrimaryColor] = useState(currentOrg?.branding?.primary_color || '#0A2540');
  const [accentColor, setAccentColor] = useState(currentOrg?.branding?.accent_color || '#2563EB');
  const [isSavingBranding, setIsSavingBranding] = useState(false);

  const isPlatformAdmin = userProfile?.role === 'platform_admin';
  const isOrgAdmin = userProfile?.role === 'org_admin' || isPlatformAdmin;

  useEffect(() => {
    if (activeTab === 'recruiters' && isOrgAdmin) {
      fetchRecruiters();
    }
    if (activeTab === 'platform' && isPlatformAdmin) {
      fetchPlatformData();
    }
  }, [activeTab]);

  const fetchRecruiters = async () => {
    setLoadingRecruiters(true);
    try {
      const token = localStorage.getItem('recruiter_token');
      const res = await fetch('/api/tenants/recruiters', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRecruiters(data.recruiters || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRecruiters(false);
    }
  };

  const fetchPlatformData = async () => {
    try {
      const token = localStorage.getItem('recruiter_token');
      const [metricsRes, orgsRes] = await Promise.all([
        fetch('/api/platform/metrics', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/platform/organizations', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      if (metricsRes.ok) setPlatformMetrics(await metricsRes.json());
      if (orgsRes.ok) {
        const d = await orgsRes.json();
        setAllOrgs(d.organizations || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleInviteRecruiter = async (e) => {
    e.preventDefault();
    setActionMsg(null);
    try {
      const token = localStorage.getItem('recruiter_token');
      const res = await fetch('/api/tenants/recruiters/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: inviteEmail,
          password: invitePassword || 'TemporaryPass123!',
          name: inviteName,
          org_id: currentOrg?.org_id || 'org_default',
          role: inviteRole
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Could not provision recruiter.');
      
      setActionMsg({ type: 'success', text: `Recruiter ${inviteEmail} provisioned successfully.` });
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteName('');
      setInvitePassword('');
      fetchRecruiters();
    } catch (err) {
      setActionMsg({ type: 'error', text: err.message });
    }
  };

  const handleToggleRecruiterStatus = async (userId, currentStatus) => {
    try {
      const token = localStorage.getItem('recruiter_token');
      const res = await fetch('/api/tenants/recruiters/status', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: userId,
          is_active: !currentStatus
        })
      });
      if (res.ok) {
        fetchRecruiters();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleOrgStatus = async (orgId, currentStatus) => {
    try {
      const token = localStorage.getItem('recruiter_token');
      const res = await fetch('/api/platform/organization/status', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          org_id: orgId,
          is_active: !currentStatus,
          reason: 'Administrator manual override'
        })
      });
      if (res.ok) {
        fetchPlatformData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveBranding = async (e) => {
    e.preventDefault();
    setIsSavingBranding(true);
    setActionMsg(null);
    try {
      const token = localStorage.getItem('recruiter_token');
      const res = await fetch('/api/tenants/current', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          branding: {
            portal_name: portalName,
            primary_color: primaryColor,
            accent_color: accentColor,
            logo_url: currentOrg?.branding?.logo_url || null
          }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Could not update branding.');
      setActionMsg({ type: 'success', text: 'Organization branding and portal styling updated.' });
      onOrgUpdated?.(data.organization);
    } catch (err) {
      setActionMsg({ type: 'error', text: err.message });
    } finally {
      setIsSavingBranding(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Workspace Header */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white text-lg shadow-sm"
            style={{ backgroundColor: currentOrg?.branding?.primary_color || '#0A2540' }}
          >
            {currentOrg?.name?.slice(0, 2).toUpperCase() || 'GN'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-[#172B45]">{currentOrg?.name || 'Gnani Organization'}</h1>
              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                currentOrg?.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {currentOrg?.is_active ? 'Active Tenant' : 'Suspended'}
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5 font-mono">
              Domain Slug: {currentOrg?.slug || 'gnani-default'} • Tenant ID: {currentOrg?.org_id || 'org_default'}
            </p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1.5 bg-[#F8FAFC] border border-[#E2E8F0] p-1 rounded-lg text-xs font-semibold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              activeTab === 'overview' ? 'bg-white text-[#172B45] shadow-xs' : 'text-[#64748B] hover:text-[#172B45]'
            }`}
          >
            Overview
          </button>
          {isOrgAdmin && (
            <button
              onClick={() => setActiveTab('recruiters')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                activeTab === 'recruiters' ? 'bg-white text-[#172B45] shadow-xs' : 'text-[#64748B] hover:text-[#172B45]'
              }`}
            >
              Recruiter Team
            </button>
          )}
          {isOrgAdmin && (
            <button
              onClick={() => setActiveTab('branding')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                activeTab === 'branding' ? 'bg-white text-[#172B45] shadow-xs' : 'text-[#64748B] hover:text-[#172B45]'
              }`}
            >
              Custom Branding
            </button>
          )}
          {isPlatformAdmin && (
            <button
              onClick={() => setActiveTab('platform')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'platform' ? 'bg-[#0A2540] text-white shadow-xs' : 'text-[#64748B] hover:text-[#172B45]'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>Platform Admin</span>
            </button>
          )}
        </div>
      </div>

      {actionMsg && (
        <div className={`p-4 rounded-xl border text-xs flex items-center gap-2 ${
          actionMsg.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {actionMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <ShieldAlert className="w-4 h-4 flex-shrink-0" />}
          <span>{actionMsg.text}</span>
        </div>
      )}

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs space-y-3">
            <h3 className="text-xs uppercase font-bold text-[#64748B] tracking-wider">Tenant Identity</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-[#F1F5F9] pb-1.5">
                <span className="text-[#64748B]">Industry:</span>
                <span className="font-medium text-[#172B45]">{currentOrg?.industry || 'Technology'}</span>
              </div>
              <div className="flex justify-between border-b border-[#F1F5F9] pb-1.5">
                <span className="text-[#64748B]">Contact Email:</span>
                <span className="font-medium text-[#172B45]">{currentOrg?.contact_email || 'admin@gnani.ai'}</span>
              </div>
              <div className="flex justify-between border-b border-[#F1F5F9] pb-1.5">
                <span className="text-[#64748B]">Data Isolation:</span>
                <span className="font-semibold text-emerald-700">Strict Multi-Tenant</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs space-y-3">
            <h3 className="text-xs uppercase font-bold text-[#64748B] tracking-wider">Proctoring & Assessment Policy</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-[#F1F5F9] pb-1.5">
                <span className="text-[#64748B]">Strict Proctoring:</span>
                <span className="font-medium text-[#172B45]">Enabled</span>
              </div>
              <div className="flex justify-between border-b border-[#F1F5F9] pb-1.5">
                <span className="text-[#64748B]">Default Retention:</span>
                <span className="font-medium text-[#172B45]">90 Days</span>
              </div>
              <div className="flex justify-between border-b border-[#F1F5F9] pb-1.5">
                <span className="text-[#64748B]">AI Speech Engine:</span>
                <span className="font-medium text-[#172B45]">Gnani Timbre (Nalini)</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs space-y-3">
            <h3 className="text-xs uppercase font-bold text-[#64748B] tracking-wider">Portal Appearance</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-[#F1F5F9] pb-1.5">
                <span className="text-[#64748B]">Portal Title:</span>
                <span className="font-medium text-[#172B45]">{currentOrg?.branding?.portal_name || 'Gnani VoicePrep AI'}</span>
              </div>
              <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-1.5">
                <span className="text-[#64748B]">Theme Swatch:</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-full border" style={{ backgroundColor: currentOrg?.branding?.primary_color || '#0A2540' }} />
                  <span className="w-3.5 h-3.5 rounded-full border" style={{ backgroundColor: currentOrg?.branding?.accent_color || '#2563EB' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RECRUITER TEAM MANAGEMENT */}
      {activeTab === 'recruiters' && isOrgAdmin && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div className="p-5 border-b border-[#E2E8F0] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#172B45]">Organization Recruiter Directory</h2>
              <p className="text-xs text-[#64748B]">Manage recruiter seat provisioning and authorization in your workspace.</p>
            </div>
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-3 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Provision Recruiter</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] font-semibold">
                <tr>
                  <th className="py-3 px-4">Recruiter</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Provisioned</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {recruiters.map(r => (
                  <tr key={r.user_id} className="hover:bg-[#F8FAFC]">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#172B45]">{r.name}</div>
                      <div className="text-[11px] text-[#64748B]">{r.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {r.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        r.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {r.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#64748B] text-[11px]">
                      {new Date(r.created_at * 1000).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {r.email !== userProfile?.email && (
                        <button
                          onClick={() => handleToggleRecruiterStatus(r.user_id, r.is_active)}
                          className={`text-xs font-semibold px-2.5 py-1 rounded border transition-all ${
                            r.is_active 
                              ? 'border-red-200 text-red-600 hover:bg-red-50' 
                              : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          {r.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CUSTOM BRANDING */}
      {activeTab === 'branding' && isOrgAdmin && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm max-w-xl">
          <h2 className="text-sm font-bold text-[#172B45] mb-1">Tenant Branding & Appearance</h2>
          <p className="text-xs text-[#64748B] mb-5">Customize your candidate-facing portal title and brand palette.</p>

          <form onSubmit={handleSaveBranding} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#172B45] mb-1">Candidate Portal Name</label>
              <input
                type="text"
                value={portalName}
                onChange={(e) => setPortalName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#172B45] mb-1">Primary Theme Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-8 h-8 rounded border cursor-pointer"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs border border-[#CBD5E1] rounded-lg font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#172B45] mb-1">Accent Brand Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-8 h-8 rounded border cursor-pointer"
                  />
                  <input
                    type="text"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs border border-[#CBD5E1] rounded-lg font-mono"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSavingBranding}
              className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-xs font-semibold transition-all shadow-xs disabled:opacity-50"
            >
              {isSavingBranding ? 'Saving Branding...' : 'Update Organization Branding'}
            </button>
          </form>
        </div>
      )}

      {/* TAB 4: PLATFORM ADMIN CONSOLE */}
      {activeTab === 'platform' && isPlatformAdmin && (
        <div className="space-y-6">
          {/* Aggregate Platform Metrics */}
          {platformMetrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-xs">
                <span className="text-[11px] font-bold text-[#64748B] uppercase">Total Tenants</span>
                <div className="text-2xl font-bold text-[#172B45] mt-1">{platformMetrics.total_tenants}</div>
                <div className="text-[10px] text-emerald-600 mt-0.5">{platformMetrics.active_tenants} Active</div>
              </div>
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-xs">
                <span className="text-[11px] font-bold text-[#64748B] uppercase">Platform Candidates</span>
                <div className="text-2xl font-bold text-[#172B45] mt-1">{platformMetrics.total_candidates_platform}</div>
                <div className="text-[10px] text-[#64748B] mt-0.5">Across all organizations</div>
              </div>
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-xs">
                <span className="text-[11px] font-bold text-[#64748B] uppercase">Total Interviews</span>
                <div className="text-2xl font-bold text-[#172B45] mt-1">{platformMetrics.total_sessions_platform}</div>
                <div className="text-[10px] text-[#64748B] mt-0.5">Persistent sessions</div>
              </div>
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-xs">
                <span className="text-[11px] font-bold text-[#64748B] uppercase">Active Recruiters</span>
                <div className="text-2xl font-bold text-[#172B45] mt-1">{platformMetrics.total_recruiters_platform}</div>
                <div className="text-[10px] text-emerald-600 mt-0.5">Enterprise accounts</div>
              </div>
            </div>
          )}

          {/* Tenants Directory & Suspension */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="p-5 border-b border-[#E2E8F0]">
              <h2 className="text-sm font-bold text-[#172B45]">Platform Multi-Tenant Registry</h2>
              <p className="text-xs text-[#64748B]">Activate or suspend tenant organizations. Sensitive candidate data is never exposed here.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] font-semibold">
                  <tr>
                    <th className="py-3 px-4">Organization</th>
                    <th className="py-3 px-4">Slug</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Tenant Control</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {allOrgs.map(o => (
                    <tr key={o.org_id} className="hover:bg-[#F8FAFC]">
                      <td className="py-3 px-4 font-semibold text-[#172B45]">{o.name}</td>
                      <td className="py-3 px-4 font-mono text-[11px] text-[#64748B]">{o.slug}</td>
                      <td className="py-3 px-4 text-[#64748B]">{o.contact_email}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          o.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        }`}>
                          {o.is_active ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleToggleOrgStatus(o.org_id, o.is_active)}
                          className={`text-xs font-semibold px-2.5 py-1 rounded border transition-all ${
                            o.is_active
                              ? 'border-red-200 text-red-600 hover:bg-red-50'
                              : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          {o.is_active ? 'Suspend Tenant' : 'Activate Tenant'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Provision Recruiter Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-[#0A2540]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-[#E2E8F0] max-w-sm w-full p-6">
            <h3 className="text-sm font-bold text-[#172B45] mb-1">Provision Organization Recruiter</h3>
            <p className="text-xs text-[#64748B] mb-4">Add a recruiter account to {currentOrg?.name}.</p>

            <form onSubmit={handleInviteRecruiter} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#172B45] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Jane Recruiter"
                  className="w-full px-3 py-2 text-xs border border-[#CBD5E1] rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#172B45] mb-1">Work Email</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="jane@company.com"
                  className="w-full px-3 py-2 text-xs border border-[#CBD5E1] rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#172B45] mb-1">Initial Password</label>
                <input
                  type="password"
                  required
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-xs border border-[#CBD5E1] rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#172B45] mb-1">Role Assignment</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-2 py-2 text-xs border border-[#CBD5E1] rounded-lg"
                >
                  <option value="recruiter">Recruiter (Standard Assessment)</option>
                  <option value="org_admin">Organization Administrator</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 py-2 border border-[#CBD5E1] text-[#64748B] rounded-lg text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  Provision Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

