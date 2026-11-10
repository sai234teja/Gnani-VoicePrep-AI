import React, { useState, useEffect } from 'react';
import { 
  CreditCard, CheckCircle2, AlertCircle, ArrowUpRight, Zap, Shield, 
  BarChart3, Users, Clock, Database, RefreshCw, X, ChevronRight, FileText, Check
} from 'lucide-react';

export default function BillingWorkspace({ authUser, orgBranding, onUpgradeSuccess }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'plans', 'history', 'platform'
  const [subscription, setSubscription] = useState(null);
  const [usage, setUsage] = useState(null);
  const [plans, setPlans] = useState([]);
  const [history, setHistory] = useState([]);
  const [platformOverview, setPlatformOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState(null);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState('mock');

  const isOrgAdmin = authUser?.role === 'org_admin' || authUser?.role === 'platform_admin';
  const isPlatformAdmin = authUser?.role === 'platform_admin';
  const orgId = authUser?.org_id || 'org_default';

  const fetchBillingData = async () => {
    setLoading(true);
    const token = localStorage.getItem('voiceprep_recruiter_token') || sessionStorage.getItem('voiceprep_recruiter_token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    try {
      // 1. Fetch Subscription
      const subRes = await fetch('/api/billing/subscription', { credentials: 'include', headers });
      if (subRes.ok) {
        const subData = await subRes.json();
        setSubscription(subData.subscription);
      }

      // 2. Fetch Metered Usage
      const useRes = await fetch('/api/billing/usage', { credentials: 'include', headers });
      if (useRes.ok) {
        const useData = await useRes.json();
        setUsage(useData);
      }

      // 3. Fetch Public Plans
      const plansRes = await fetch('/api/billing/plans');
      if (plansRes.ok) {
        const pData = await plansRes.json();
        setPlans(pData.plans || []);
      }

      // 4. Fetch Payment History
      const histRes = await fetch('/api/billing/history', { credentials: 'include', headers });
      if (histRes.ok) {
        const hData = await histRes.json();
        setHistory(hData.history || []);
      }

      // 5. If Platform Superadmin, fetch platform-wide metrics
      if (isPlatformAdmin) {
        const platRes = await fetch('/api/billing/platform/overview', { credentials: 'include', headers });
        if (platRes.ok) {
          const platData = await platRes.json();
          setPlatformOverview(platData);
        }
      }
    } catch (err) {
      console.error('Failed to load billing metrics:', err);
      setFeedback({ type: 'error', message: 'Network error retrieving subscription details.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingData();
  }, [authUser]);

  const handleStartCheckout = (plan) => {
    setSelectedPlanForCheckout(plan);
    setCheckoutModalOpen(true);
  };

  const handleConfirmMockPayment = async () => {
    if (!selectedPlanForCheckout) return;
    setActionLoading(true);
    setFeedback(null);
    const token = localStorage.getItem('voiceprep_recruiter_token') || sessionStorage.getItem('voiceprep_recruiter_token');
    const headers = { 
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    try {
      // Step 1: Create checkout session
      const chkRes = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          plan_id: selectedPlanForCheckout.plan_id,
          provider: paymentProvider,
          currency: selectedPlanForCheckout.currency || 'USD'
        })
      });

      if (!chkRes.ok) {
        const err = await chkRes.json();
        throw new Error(err.detail || 'Could not initiate checkout.');
      }
      const chkData = await chkRes.json();
      const tx = chkData.checkout;

      // Step 2: In Sandbox/Mock mode, execute instant verification with signature
      const verifyRes = await fetch('/api/billing/verify-payment', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          transaction_id: tx.transaction_id,
          payment_id: `pay_sandbox_${Date.now().toString(36)}`,
          signature: tx.mock_payment_token,
          provider: paymentProvider
        })
      });

      if (!verifyRes.ok) {
        const vErr = await verifyRes.json();
        throw new Error(vErr.detail || 'Payment verification failed.');
      }

      setFeedback({ 
        type: 'success', 
        message: `Plan upgraded successfully to ${selectedPlanForCheckout.name}! Limits have been updated.` 
      });
      setCheckoutModalOpen(false);
      setSelectedPlanForCheckout(null);
      await fetchBillingData();
      if (onUpgradeSuccess) onUpgradeSuccess();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? It will remain active until the end of the billing cycle.')) return;
    setActionLoading(true);
    const token = localStorage.getItem('voiceprep_recruiter_token') || sessionStorage.getItem('voiceprep_recruiter_token');
    try {
      const res = await fetch('/api/billing/cancel', {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        setFeedback({ type: 'success', message: 'Cancellation scheduled for period end.' });
        await fetchBillingData();
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Could not process cancellation.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRenewSubscription = async () => {
    setActionLoading(true);
    const token = localStorage.getItem('voiceprep_recruiter_token') || sessionStorage.getItem('voiceprep_recruiter_token');
    try {
      const res = await fetch('/api/billing/renew', {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        setFeedback({ type: 'success', message: 'Subscription successfully renewed for another cycle!' });
        await fetchBillingData();
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to renew subscription.' });
    } finally {
      setActionLoading(false);
    }
  };

  const calculateUsagePercent = (used, max) => {
    if (!max || max <= 0) return 0;
    return Math.min(100, Math.round((used / max) * 100));
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                Phase 13 • SaaS Subscriptions
              </span>
              {subscription && (
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                  subscription.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                  subscription.status === 'trialing' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                  subscription.status === 'past_due' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                  'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}>
                  {subscription.status}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-indigo-400" />
              SaaS Subscription & Usage Billing
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Real-time quota metering, tenant subscription limits, and sandbox billing controls for <span className="text-white font-medium">{orgBranding?.portal_name || orgId}</span>.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchBillingData}
              disabled={loading}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition flex items-center gap-2 border border-slate-700"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Sync Usage
            </button>
            {isOrgAdmin && (
              <button
                onClick={() => setActiveTab('plans')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition flex items-center gap-2 shadow-lg shadow-indigo-600/30"
              >
                <Zap className="w-4 h-4" />
                Change Plan
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-800">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              activeTab === 'overview'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Overview & Metering
          </button>
          <button
            onClick={() => setActiveTab('plans')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              activeTab === 'plans'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Compare Plans & Upgrade
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              activeTab === 'history'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Payment History ({history.length})
          </button>
          {isPlatformAdmin && (
            <button
              onClick={() => setActiveTab('platform')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                activeTab === 'platform'
                  ? 'bg-indigo-900/40 text-indigo-300 border border-indigo-700/50'
                  : 'text-indigo-400 hover:text-indigo-200'
              }`}
            >
              Superadmin Overview
            </button>
          )}
        </div>
      </div>

      {/* Notifications / Feedback */}
      {feedback && (
        <div className={`p-4 rounded-xl flex items-center justify-between gap-3 ${
          feedback.type === 'success' 
            ? 'bg-emerald-950/40 border border-emerald-800/60 text-emerald-300' 
            : 'bg-rose-950/40 border border-rose-800/60 text-rose-300'
        }`}>
          <div className="flex items-center gap-2 text-sm font-medium">
            {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            {feedback.message}
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB 1: OVERVIEW & USAGE METERING */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Current Subscription Card */}
          {subscription && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                <div>
                  <div className="text-xs uppercase text-slate-400 font-semibold tracking-wider">Active Plan</div>
                  <h2 className="text-2xl font-bold text-white mt-1 flex items-center gap-2">
                    {subscription.plan_name}
                    <span className="text-sm font-normal text-slate-400">
                      (${subscription.price_cents ? (subscription.price_cents / 100).toFixed(2) : '0'}/mo)
                    </span>
                  </h2>
                  <div className="text-xs text-slate-400 mt-1">
                    Cycle renewal date:{' '}
                    <span className="text-slate-200 font-medium">
                      {new Date(subscription.current_period_end * 1000).toLocaleDateString()}
                    </span>
                    {subscription.trial_end && (
                      <span className="ml-2 text-blue-400">
                        (Trial concludes {new Date(subscription.trial_end * 1000).toLocaleDateString()})
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {subscription.status === 'past_due' && isOrgAdmin && (
                    <button
                      onClick={handleRenewSubscription}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium"
                    >
                      Pay & Renew Past Due
                    </button>
                  )}
                  {subscription.cancel_at_period_end === 0 && isOrgAdmin && subscription.price_cents > 0 && (
                    <button
                      onClick={handleCancelSubscription}
                      disabled={actionLoading}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-rose-400 hover:text-rose-300 rounded-lg text-sm font-medium border border-slate-700"
                    >
                      Cancel at Period End
                    </button>
                  )}
                  {isOrgAdmin && (
                    <button
                      onClick={() => setActiveTab('plans')}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 shadow"
                    >
                      Upgrade Plan <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Usage Meter Cards */}
              {usage && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                  {/* Metric 1: Monthly Interviews */}
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                      <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-indigo-400" /> Monthly Interviews</span>
                      <span className="font-semibold text-white">
                        {usage.metrics.completed_interviews} / {usage.limits.monthly_interviews}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 mb-2 overflow-hidden">
                      <div 
                        className={`h-2 rounded-full transition-all ${
                          calculateUsagePercent(usage.metrics.completed_interviews, usage.limits.monthly_interviews) >= 90
                            ? 'bg-rose-500' : 'bg-indigo-500'
                        }`}
                        style={{ width: `${calculateUsagePercent(usage.metrics.completed_interviews, usage.limits.monthly_interviews)}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-slate-500 flex justify-between">
                      <span>{calculateUsagePercent(usage.metrics.completed_interviews, usage.limits.monthly_interviews)}% consumed</span>
                      <span>{usage.metrics.interview_minutes} mins evaluated</span>
                    </div>
                  </div>

                  {/* Metric 2: Recruiter Seats */}
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                      <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-sky-400" /> Recruiter Seats</span>
                      <span className="font-semibold text-white">
                        {usage.metrics.active_recruiters} / {usage.limits.recruiters}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 mb-2 overflow-hidden">
                      <div 
                        className="bg-sky-500 h-2 rounded-full transition-all"
                        style={{ width: `${calculateUsagePercent(usage.metrics.active_recruiters, usage.limits.recruiters)}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {usage.limits.recruiters - usage.metrics.active_recruiters} seats remaining
                    </div>
                  </div>

                  {/* Metric 3: Active Job Roles */}
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                      <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-emerald-400" /> Custom Roles</span>
                      <span className="font-semibold text-white">
                        {usage.metrics.active_roles} / {usage.limits.active_roles}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 mb-2 overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-2 rounded-full transition-all"
                        style={{ width: `${calculateUsagePercent(usage.metrics.active_roles, usage.limits.active_roles)}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {usage.limits.active_roles - usage.metrics.active_roles} slots free
                    </div>
                  </div>

                  {/* Metric 4: Recording Storage */}
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                      <span className="flex items-center gap-1.5"><Database className="w-3.5 h-3.5 text-purple-400" /> Recording Storage</span>
                      <span className="font-semibold text-white">
                        {usage.metrics.storage_mb} MB / {usage.limits.recording_storage_mb} MB
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 mb-2 overflow-hidden">
                      <div 
                        className="bg-purple-500 h-2 rounded-full transition-all"
                        style={{ width: `${calculateUsagePercent(usage.metrics.storage_mb, usage.limits.recording_storage_mb)}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Encrypted at rest (AES-GCM)
                    </div>
                  </div>
                </div>
              )}

              {/* Service Voice Telemetry */}
              {usage && (
                <div className="mt-6 pt-6 border-t border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800/60">
                    <div className="text-xs text-slate-500">Gnani STT Requests</div>
                    <div className="text-lg font-bold text-white mt-1">{usage.metrics.stt_requests}</div>
                  </div>
                  <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800/60">
                    <div className="text-xs text-slate-500">Gnani TTS Requests</div>
                    <div className="text-lg font-bold text-white mt-1">{usage.metrics.tts_requests}</div>
                  </div>
                  <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800/60">
                    <div className="text-xs text-slate-500">Registered Candidates</div>
                    <div className="text-lg font-bold text-white mt-1">{usage.metrics.registered_candidates}</div>
                  </div>
                  <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800/60">
                    <div className="text-xs text-slate-500">Max Session Duration</div>
                    <div className="text-lg font-bold text-white mt-1">{usage.limits.max_interview_duration_minutes}m</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PLANS COMPARISON & UPGRADE */}
      {activeTab === 'plans' && (
        <div className="space-y-6">
          <div className="text-center max-w-xl mx-auto mb-8">
            <h2 className="text-2xl font-bold text-white">Choose the plan that fits your recruiting scale</h2>
            <p className="text-slate-400 text-sm mt-1">
              Switch anytime. Quotas update immediately upon successful sandbox or provider checkout.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((p) => {
              const isCurrent = subscription?.plan_id === p.plan_id;
              const isEnterprise = p.plan_id === 'plan_enterprise';

              return (
                <div 
                  key={p.plan_id}
                  className={`bg-slate-900 rounded-2xl p-6 flex flex-col justify-between transition-all border ${
                    isCurrent 
                      ? 'border-indigo-500 shadow-xl shadow-indigo-500/10 ring-1 ring-indigo-500' 
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        {p.name}
                      </span>
                      {isCurrent && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-500/20 text-indigo-400 border border-indigo-500/40">
                          Current
                        </span>
                      )}
                    </div>

                    <div className="mb-4">
                      <span className="text-3xl font-extrabold text-white">
                        ${(p.price_cents / 100).toFixed(0)}
                      </span>
                      <span className="text-slate-400 text-xs ml-1">/ month</span>
                      <p className="text-xs text-slate-400 mt-2 min-h-[32px]">{p.description}</p>
                    </div>

                    <div className="space-y-2.5 pt-4 border-t border-slate-800 text-xs text-slate-300">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span><strong>{p.monthly_interviews_limit}</strong> interviews / mo</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span><strong>{p.recruiters_limit}</strong> recruiter account(s)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span><strong>{p.active_roles_limit}</strong> active custom roles</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Up to <strong>{p.max_interview_duration_minutes}m</strong> interview time</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span><strong>{(p.recording_storage_mb / 1024).toFixed(1)} GB</strong> recording storage</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.analytics_access ? (
                          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <X className="w-4 h-4 text-slate-600 shrink-0" />
                        )}
                        <span className={p.analytics_access ? '' : 'text-slate-500 line-through'}>
                          Advanced Analytics & Insights
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.custom_branding ? (
                          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <X className="w-4 h-4 text-slate-600 shrink-0" />
                        )}
                        <span className={p.custom_branding ? '' : 'text-slate-500 line-through'}>
                          Tenant Branding & Whitelabel
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 pt-4">
                    {isCurrent ? (
                      <button
                        disabled
                        className="w-full py-2.5 px-4 rounded-xl bg-slate-800 text-slate-400 text-xs font-semibold cursor-not-allowed text-center"
                      >
                        Active Plan
                      </button>
                    ) : isOrgAdmin ? (
                      <button
                        onClick={() => handleStartCheckout(p)}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-center transition flex items-center justify-center gap-1.5 ${
                          isEnterprise
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-600/30'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                        }`}
                      >
                        Select {p.name} <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <div className="text-[11px] text-slate-500 text-center">Contact Org Admin to change plan</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: PAYMENT & INVOICE HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" /> Payment & Billing Audit
              </h3>
              <p className="text-xs text-slate-400">Strictly tenant-isolated invoice and transaction ledger.</p>
            </div>
          </div>

          {history.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              No payment transactions recorded for this organization yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Transaction ID</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Provider</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {history.map((tx) => (
                    <tr key={tx.transaction_id} className="hover:bg-slate-800/30 transition">
                      <td className="px-4 py-3 font-medium text-slate-200">{tx.transaction_id}</td>
                      <td className="px-4 py-3 font-sans text-white font-semibold">
                        ${(tx.amount_cents / 100).toFixed(2)} {tx.currency}
                      </td>
                      <td className="px-4 py-3 font-sans uppercase text-slate-400">{tx.payment_provider}</td>
                      <td className="px-4 py-3 font-sans">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          tx.status === 'succeeded' ? 'bg-emerald-500/20 text-emerald-400' :
                          tx.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-rose-500/20 text-rose-400'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-sans text-slate-400">
                        {new Date(tx.created_at * 1000).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PLATFORM SUPERADMIN OVERVIEW */}
      {activeTab === 'platform' && isPlatformAdmin && platformOverview && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="text-xs uppercase text-slate-400 font-semibold tracking-wider">Total SaaS Tenants</div>
              <div className="text-3xl font-extrabold text-white mt-2">{platformOverview.total_subscriptions}</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="text-xs uppercase text-slate-400 font-semibold tracking-wider">Total Mock Revenue</div>
              <div className="text-3xl font-extrabold text-emerald-400 mt-2">${platformOverview.total_revenue_usd}</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="text-xs uppercase text-slate-400 font-semibold tracking-wider">Subscriptions by Status</div>
              <div className="text-xs text-slate-300 mt-2 space-y-1">
                {Object.entries(platformOverview.status_distribution || {}).map(([st, cnt]) => (
                  <div key={st} className="flex justify-between">
                    <span className="capitalize">{st}:</span>
                    <span className="font-semibold text-white">{cnt}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CHECKOUT MODAL (SANDBOX MODE) */}
      {checkoutModalOpen && selectedPlanForCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-400" />
                Sandbox Payment Checkout
              </h3>
              <button 
                onClick={() => setCheckoutModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Target Plan:</span>
                <span className="text-white font-semibold">{selectedPlanForCheckout.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Billing Interval:</span>
                <span className="text-white font-semibold">Monthly</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-slate-800">
                <span className="text-slate-300 font-medium">Total Charge:</span>
                <span className="text-xl font-bold text-emerald-400">
                  ${(selectedPlanForCheckout.price_cents / 100).toFixed(2)} USD
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Payment Gateway Sandbox</label>
              <div className="grid grid-cols-3 gap-2">
                {['mock', 'stripe', 'razorpay'].map((prov) => (
                  <button
                    key={prov}
                    type="button"
                    onClick={() => setPaymentProvider(prov)}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold uppercase border transition ${
                      paymentProvider === prov
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {prov}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Notice: Sandbox mode active. No actual credit card transactions or live payment charges will take place.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCheckoutModalOpen(false)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmMockPayment}
                disabled={actionLoading}
                className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30"
              >
                {actionLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>Authorize & Activate</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

