import React, { useState } from 'react';
import { 
  Building2, 
  Mail, 
  Lock, 
  User, 
  ArrowRight, 
  ShieldCheck, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { GnaniLogo } from './GnaniLogo';

export const MultiTenantAuthModal = ({
  isOpen,
  onClose,
  onLoginSuccess,
  currentOrg
}) => {
  const [tab, setTab] = useState('login'); // 'login' | 'register_org'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Registration Fields
  const [orgName, setOrgName] = useState('');
  const [slug, setSlug] = useState('');
  const [industry, setIndustry] = useState('Technology');
  const [portalName, setPortalName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#0A2540');
  const [regSuccess, setRegSuccess] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/recruiter-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Login failed. Please check your credentials.');
      }
      localStorage.setItem('recruiter_token', data.token);
      localStorage.setItem('recruiter_user', JSON.stringify(data));
      onLoginSuccess?.(data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterOrg = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const computedSlug = (slug || orgName.toLowerCase().replace(/[^a-z0-9]/g, '-')).slice(0, 30);
      const res = await fetch('/api/tenants/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: orgName,
          slug: computedSlug,
          contact_email: email,
          industry,
          branding: {
            primary_color: primaryColor,
            accent_color: '#2563EB',
            logo_url: null,
            portal_name: portalName || `${orgName} Assessment Portal`
          },
          settings: {
            allowed_domains: [],
            default_retention_days: 90,
            enforce_strict_proctoring: true,
            allow_practice_mode: true,
            ai_interviewer_voice: 'Nalini'
          }
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to register organization workspace.');
      }
      setRegSuccess(true);
      setTimeout(() => {
        setTab('login');
        setRegSuccess(false);
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0A2540]/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] max-w-md w-full overflow-hidden">
        {/* Modal Header */}
        <div className="p-6 bg-gradient-to-r from-[#0A2540] to-[#1E3A8A] text-white">
          <div className="flex items-center justify-between">
            <GnaniLogo variant="light" size="sm" />
            <button 
              onClick={onClose}
              className="text-white/70 hover:text-white text-lg font-bold"
            >
              ×
            </button>
          </div>
          <h2 className="text-xl font-bold mt-4">
            {tab === 'login' ? 'Recruiter & Admin Portal' : 'Register Organization Tenant'}
          </h2>
          <p className="text-xs text-white/80 mt-1">
            {tab === 'login' 
              ? 'Multi-tenant secure access with role-based isolation.' 
              : 'Launch your dedicated company interview workspace with custom branding.'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <button
            onClick={() => { setTab('login'); setError(null); }}
            className={`flex-1 py-3 text-xs font-semibold border-b-2 transition-all ${
              tab === 'login'
                ? 'border-[#2563EB] text-[#2563EB] bg-white'
                : 'border-transparent text-[#64748B] hover:text-[#172B45]'
            }`}
          >
            Organization Login
          </button>
          <button
            onClick={() => { setTab('register_org'); setError(null); }}
            className={`flex-1 py-3 text-xs font-semibold border-b-2 transition-all ${
              tab === 'register_org'
                ? 'border-[#2563EB] text-[#2563EB] bg-white'
                : 'border-transparent text-[#64748B] hover:text-[#172B45]'
            }`}
          >
            Onboard New Organization
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {regSuccess && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2.5 text-xs text-emerald-700">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Organization created! Redirecting to login...</span>
            </div>
          )}

          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#172B45] mb-1">Work Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-2.5 text-[#94A3B8]" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="recruiter@company.com"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#172B45] mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-2.5 text-[#94A3B8]" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>
              </div>

              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2.5 text-[11px] text-[#64748B]">
                <span className="font-semibold text-[#172B45]">Default Demo Recruiter:</span> recruiter@gnani.ai (pw: Password123)
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-xs font-semibold shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {loading ? 'Authenticating...' : 'Sign In to Workspace'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegisterOrg} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#172B45] mb-1">Organization Name</label>
                <input
                  type="text"
                  required
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. Acme Technologies"
                  className="w-full px-3 py-2 text-xs border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-[#172B45] mb-1">Domain Slug</label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="acme-tech"
                    className="w-full px-3 py-2 text-xs border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#172B45] mb-1">Industry</label>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full px-2 py-2 text-xs border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  >
                    <option value="Technology">Technology</option>
                    <option value="Financial Services">Financial Services</option>
                    <option value="Healthcare">Healthcare</option>
                    <option value="Retail & E-commerce">Retail & E-commerce</option>
                    <option value="Consulting">Consulting</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#172B45] mb-1">Lead Admin Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@acme.com"
                  className="w-full px-3 py-2 text-xs border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#172B45] mb-1">Branded Portal Name</label>
                <input
                  type="text"
                  value={portalName}
                  onChange={(e) => setPortalName(e.target.value)}
                  placeholder="Acme Talent Assessment Center"
                  className="w-full px-3 py-2 text-xs border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-[#0A2540] hover:bg-[#1E3A8A] text-white rounded-lg text-xs font-semibold shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-2"
              >
                {loading ? 'Creating Workspace...' : 'Launch Organization Tenant'}
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

