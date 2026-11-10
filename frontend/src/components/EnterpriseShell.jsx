import React, { useState } from 'react';
import {
  Building2,
  LayoutDashboard,
  Video,
  Briefcase,
  Users,
  FileCheck2,
  BarChart3,
  Settings,
  ShieldCheck,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Radio,
  HelpCircle,
  Bell,
  CreditCard,
  Code
} from 'lucide-react';
import { GnaniLogo } from './GnaniLogo';

export const EnterpriseShell = ({
  children,
  activeNav = 'dashboard', // 'dashboard' | 'interview' | 'practice' | 'benchmark' | 'candidates' | 'roles' | 'organization' | 'settings' | 'setup' | 'report'
  onNavSelect,
  serviceStatus,
  currentSession,
  currentOrg,
  currentUser,
  onOpenAuthModal,
  onLogout
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Dynamic Workspace-Based Navigation Separation
  const isCandidate = currentUser?.role === 'candidate';
  const isPlatformAdmin = currentUser?.role === 'platform_admin';

  let navItems = [];
  if (isCandidate) {
    // 1. Candidate Workspace Navigation
    navItems = [
      { id: 'candidate_home', label: 'Candidate Home', icon: LayoutDashboard },
      { id: 'candidate_practice', label: 'Practice Studio', icon: Radio },
      { id: 'candidate_interviews', label: 'My Interviews', icon: Video, badge: currentSession ? 'Active' : null },
      { id: 'candidate_insights', label: 'Learning Insights', icon: BarChart3 },
      { id: 'candidate_profile', label: 'Profile & Settings', icon: Settings },
    ];
  } else {
    // 2. Recruiter & Organization Admin Consolidated Navigation
    navItems = [
      { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
      { id: 'candidates', label: 'Candidates & Pipeline', icon: Users },
      { id: 'interview', label: 'Live Interview Room', icon: Video, badge: currentSession ? 'Active' : null },
      { id: 'assessments', label: 'Assessments & Reports', icon: FileCheck2 },
      { id: 'analytics', label: 'Talent Analytics', icon: BarChart3 },
      { id: 'invitations', label: 'Invitations & Comms', icon: Bell },
      { id: 'roles', label: 'Job Roles', icon: Briefcase },
      { id: 'organization', label: 'Organization Settings', icon: Building2 },
    ];
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-[#172B45] flex font-sans antialiased">
      {/* Desktop Left Sidebar: Pure White with Crisp Border */}
      <aside
        className={`hidden md:flex flex-col border-r border-[#E2E8F0] bg-white transition-all duration-200 z-40 sticky top-0 h-screen ${collapsed ? 'w-20' : 'w-64'
          }`}
      >
        {/* Brand Header */}
        <div className="h-16 border-b border-[#E2E8F0] flex items-center justify-between px-4">
          {!collapsed ? (
            <GnaniLogo variant="light" size="md" />
          ) : (
            <GnaniLogo variant="mark-only" size="md" className="mx-auto" />
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-md text-[#64748B] hover:text-[#172B45] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Organization / Workspace Selector */}
        {!collapsed && (
          <div className="p-3">
            <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-md bg-[#315C8C]/10 border border-[#315C8C]/20 flex items-center justify-center text-[#315C8C]">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#172B45] truncate">
                    {isCandidate ? (currentUser?.candidate?.full_name || currentUser?.name || 'Candidate Hub') : (currentOrg?.name || 'Recruiter Workspace')}
                  </div>
                  <div className="text-[10px] text-[#64748B] truncate">
                    {isCandidate ? 'AI Practice Studio' : (currentOrg?.industry ? `${currentOrg.industry} Assessment` : 'Talent Assessment Hub')}
                  </div>
                </div>
              </div>
              <span className="w-2 h-2 rounded-full bg-[#167C72]" title="System Online" />
            </div>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavSelect?.(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer group ${isActive
                    ? 'bg-[#315C8C]/10 text-[#315C8C] font-semibold'
                    : 'text-[#64748B] hover:text-[#172B45] hover:bg-[#F8FAFC]'
                  }`}
                title={collapsed ? item.label : undefined}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[#315C8C]' : 'text-[#64748B] group-hover:text-[#172B45]'}`} />
                {!collapsed && (
                  <div className="flex items-center justify-between flex-1 truncate">
                    <span className="truncate">{item.label}</span>
                    {item.badge && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#167C72]/15 text-[#167C72]">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Platform Status Footer */}
        <div className="p-3 border-t border-[#E2E8F0]">
          {!collapsed ? (
            <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#172B45]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#167C72]" />
                  <span>Gnani Engines</span>
                </span>
                <span className="text-[10px] text-[#167C72] font-semibold px-1.5 py-0.2 rounded bg-[#167C72]/10">Online</span>
              </div>
              <div className="text-[10px] text-[#64748B] font-mono">
                Prisma STT  Timbre TTS
              </div>
            </div>
          ) : (
            <div className="flex justify-center" title="Gnani Engines Active">
              <span className="w-2 h-2 rounded-full bg-[#167C72]" />
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar: Clean White with Crisp Border */}
        <header className="h-16 border-b border-[#E2E8F0] bg-white sticky top-0 z-30 flex items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-md text-[#64748B] hover:text-[#172B45] hover:bg-[#F8FAFC]"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div className="flex items-center gap-2.5">
              <span className="text-sm font-bold text-[#172B45] hidden sm:inline">
                {activeNav === 'dashboard' && 'Recruiter Assessment Console'}
                {activeNav === 'analytics' && 'Enterprise Talent Analytics & Insights'}
                {activeNav === 'interview' && (currentSession?.mode === 'company' ? 'Live Proctored Assessment Room' : 'Interactive Interview Room')}
                {activeNav === 'practice' && 'Candidate Coaching Studio'}
                {activeNav === 'candidates' && 'Candidate Evaluation & Reports'}
                {activeNav === 'invitations' && 'Interview Invitations & Telemetry'}
                {activeNav === 'roles' && 'Job Roles & Rubrics'}
                {activeNav === 'organization' && 'Organization & Multi-Tenant Management'}
                {activeNav === 'benchmark' && 'Camera & Vision Diagnostics'}
                {activeNav === 'settings' && 'Workspace Settings'}
                {activeNav === 'setup' && 'Configure Interview Session'}
                {activeNav === 'report' && 'Evaluation Report'}
              </span>
              {currentSession && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#315C8C]/10 text-[#315C8C]">
                  {currentSession.role_name}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavSelect?.('organization')}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-xs text-[#172B45] transition-all"
            >
              <Building2 className="w-3.5 h-3.5 text-[#2563EB]" />
              <span className="font-semibold">{currentOrg?.name || 'Gnani Organization'}</span>
            </button>

            {currentUser ? (
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-sm"
                  style={{ backgroundColor: currentOrg?.branding?.primary_color || '#0A2540' }}
                  title={`${currentUser.name} (${currentUser.role})`}
                >
                  {currentUser.name ? currentUser.name.slice(0, 2).toUpperCase() : 'RC'}
                </div>
                <button
                  onClick={onLogout}
                  title="Sign Out"
                  className="p-1.5 text-[#64748B] hover:text-red-600 rounded-md hover:bg-slate-50 text-xs"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuthModal}
                className="px-3 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-xs font-semibold shadow-xs transition-all"
              >
                Sign In
              </button>
            )}
          </div>
        </header>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-[#E2E8F0] p-4 space-y-1 z-50 shadow-md">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => {
                  onNavSelect?.(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between p-2.5 rounded-md text-xs font-medium ${activeNav === item.id ? 'bg-[#315C8C]/10 text-[#315C8C] font-semibold' : 'text-[#64748B] hover:bg-[#F8FAFC]'
                  }`}
              >
                <span>{item.label}</span>
                {item.badge && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#167C72]/15 text-[#167C72]">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Workspace Dynamic Content Container */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

