import React, { useState, useEffect } from 'react';
import {
  Key, Webhook, Code, RefreshCw, Plus, Trash2, RotateCw, Copy, Check,
  ExternalLink, AlertCircle, CheckCircle2, Shield, Activity, Send, X, Terminal, BookOpen
} from 'lucide-react';

export default function IntegrationWorkspace({ authUser, orgBranding }) {
  const [activeTab, setActiveTab] = useState('keys'); // 'keys', 'webhooks', 'deliveries', 'docs'
  const [apiKeys, setApiKeys] = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);

  // New API Key Modal State
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState(['roles:read', 'candidates:read', 'interviews:create', 'interviews:read']);
  const [createdKeySecret, setCreatedKeySecret] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // New Webhook Modal State
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookDesc, setWebhookDesc] = useState('');
  const [webhookEvents, setWebhookEvents] = useState(['interview.completed', 'report.generated']);
  const [createdWebhookSecret, setCreatedWebhookSecret] = useState(null);

  const isOrgAdmin = authUser?.role === 'org_admin' || authUser?.role === 'platform_admin';
  const orgId = authUser?.org_id || 'org_default';

  const allAvailableScopes = [
    { id: 'roles:read', label: 'View Job Roles', desc: 'Read available technical interview tracks and skills' },
    { id: 'candidates:read', label: 'Read Candidates', desc: 'List candidate profiles and registrations' },
    { id: 'candidates:write', label: 'Create Candidates', desc: 'Enroll new candidates directly from ATS' },
    { id: 'interviews:create', label: 'Schedule Interviews', desc: 'Generate single-use candidate interview invitations' },
    { id: 'interviews:read', label: 'Read Sessions', desc: 'Inspect session progression and attendance' },
    { id: 'reports:read', label: 'Read Assessment Reports', desc: 'Retrieve rubrics, transcripts, and scores' },
    { id: 'analytics:read', label: 'Talent Analytics', desc: 'Read aggregate talent and score distribution metrics' },
  ];

  const allAvailableEvents = [
    { id: 'candidate.registered', label: 'Candidate Registered' },
    { id: 'interview.invited', label: 'Interview Invitation Created' },
    { id: 'interview.scheduled', label: 'Interview Scheduled' },
    { id: 'interview.started', label: 'Candidate Started Interview' },
    { id: 'interview.completed', label: 'Assessment Completed' },
    { id: 'report.generated', label: 'Final Report Generated' },
    { id: 'candidate.absent', label: 'Candidate Absent / Expired' },
    { id: 'subscription.updated', label: 'Subscription Updated' }
  ];

  const fetchData = async () => {
    setLoading(true);
    const token = localStorage.getItem('voiceprep_recruiter_token') || sessionStorage.getItem('voiceprep_recruiter_token');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    try {
      const [keysRes, whRes, delRes] = await Promise.all([
        fetch('/api/integrations/keys', { headers }),
        fetch('/api/integrations/webhooks', { headers }),
        fetch('/api/integrations/webhooks/deliveries', { headers })
      ]);

      if (keysRes.ok) {
        const kd = await keysRes.json();
        setApiKeys(kd.api_keys || []);
      }
      if (whRes.ok) {
        const wd = await whRes.json();
        setWebhooks(wd.endpoints || []);
      }
      if (delRes.ok) {
        const dd = await delRes.json();
        setDeliveries(dd.deliveries || []);
      }
    } catch (err) {
      console.error('Failed to load integration data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [authUser]);

  const handleCreateKey = async (e) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    const token = localStorage.getItem('voiceprep_recruiter_token') || sessionStorage.getItem('voiceprep_recruiter_token');
    try {
      const res = await fetch('/api/integrations/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          name: newKeyName,
          scopes: newKeyScopes,
          expires_days: 90
        })
      });

      if (!res.ok) throw new Error('Failed to create API key');
      const data = await res.json();
      setCreatedKeySecret(data.raw_key);
      await fetchData();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleRevokeKey = async (keyId) => {
    if (!confirm('Are you sure you want to revoke this API key? External systems using it will be blocked immediately.')) return;
    const token = localStorage.getItem('voiceprep_recruiter_token') || sessionStorage.getItem('voiceprep_recruiter_token');
    try {
      const res = await fetch(`/api/integrations/keys/${keyId}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        setFeedback({ type: 'success', message: 'API key revoked.' });
        await fetchData();
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Could not revoke API key.' });
    }
  };

  const handleRegisterWebhook = async (e) => {
    e.preventDefault();
    if (!webhookUrl.trim()) return;

    const token = localStorage.getItem('voiceprep_recruiter_token') || sessionStorage.getItem('voiceprep_recruiter_token');
    try {
      const res = await fetch('/api/integrations/webhooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          url: webhookUrl,
          description: webhookDesc,
          events: webhookEvents
        })
      });

      if (!res.ok) throw new Error('Failed to register webhook endpoint');
      const data = await res.json();
      setCreatedWebhookSecret(data.signing_secret);
      await fetchData();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleDeleteWebhook = async (endpointId) => {
    if (!confirm('Are you sure you want to delete this webhook endpoint?')) return;
    const token = localStorage.getItem('voiceprep_recruiter_token') || sessionStorage.getItem('voiceprep_recruiter_token');
    try {
      const res = await fetch(`/api/integrations/webhooks/${endpointId}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        setFeedback({ type: 'success', message: 'Webhook endpoint removed.' });
        await fetchData();
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Could not remove webhook.' });
    }
  };

  const handleRetryDelivery = async (deliveryId) => {
    const token = localStorage.getItem('voiceprep_recruiter_token') || sessionStorage.getItem('voiceprep_recruiter_token');
    try {
      const res = await fetch(`/api/integrations/webhooks/deliveries/${deliveryId}/retry`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        setFeedback({ type: 'success', message: 'Webhook re-delivery enqueued.' });
        await fetchData();
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to trigger retry.' });
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Container */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-[#315C8C]/10 text-[#315C8C]">
                Phase 14 • Enterprise Integration Engine
              </span>
              <span className="px-2.5 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-[#167C72]/10 text-[#167C72]">
                REST API v1 & Webhooks
              </span>
            </div>
            <h1 className="text-2xl font-bold text-[#172B45] flex items-center gap-2">
              <Code className="w-6 h-6 text-[#315C8C]" />
              Enterprise APIs, Webhooks & ATS Integrations
            </h1>
            <p className="text-[#64748B] text-sm mt-1">
              Connect external recruiting workflows (Greenhouse, Lever, Workday) to{' '}
              <span className="font-semibold text-[#172B45]">{orgBranding?.portal_name || orgId}</span>.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchData}
              disabled={loading}
              className="px-3.5 py-2 bg-white hover:bg-[#F5F7FA] text-[#172B45] border border-[#E2E8F0] rounded-lg text-xs font-semibold transition flex items-center gap-2 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {isOrgAdmin && (
              <button
                onClick={() => {
                  setCreatedKeySecret(null);
                  setNewKeyName('');
                  setShowKeyModal(true);
                }}
                className="px-4 py-2 bg-[#315C8C] hover:bg-[#25466b] text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Generate API Key
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 mt-6 pt-4 border-t border-[#E2E8F0]">
          <button
            onClick={() => setActiveTab('keys')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${activeTab === 'keys'
                ? 'bg-[#172B45] text-white'
                : 'text-[#64748B] hover:text-[#172B45] hover:bg-[#F5F7FA]'
              }`}
          >
            API Keys ({apiKeys.length})
          </button>
          <button
            onClick={() => setActiveTab('webhooks')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${activeTab === 'webhooks'
                ? 'bg-[#172B45] text-white'
                : 'text-[#64748B] hover:text-[#172B45] hover:bg-[#F5F7FA]'
              }`}
          >
            Webhook Endpoints ({webhooks.length})
          </button>
          <button
            onClick={() => setActiveTab('deliveries')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${activeTab === 'deliveries'
                ? 'bg-[#172B45] text-white'
                : 'text-[#64748B] hover:text-[#172B45] hover:bg-[#F5F7FA]'
              }`}
          >
            Delivery Telemetry ({deliveries.length})
          </button>
          <button
            onClick={() => setActiveTab('docs')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${activeTab === 'docs'
                ? 'bg-[#172B45] text-white'
                : 'text-[#64748B] hover:text-[#172B45] hover:bg-[#F5F7FA]'
              }`}
          >
            API & Webhook Documentation
          </button>
        </div>
      </div>

      {/* Notifications / Feedback */}
      {feedback && (
        <div className={`p-4 rounded-xl flex items-center justify-between gap-3 text-xs font-medium border ${feedback.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
            {feedback.message}
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* TAB 1: API KEYS */}
      {activeTab === 'keys' && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-[#172B45] flex items-center gap-2">
                <Key className="w-4 h-4 text-[#315C8C]" /> Active Enterprise Credentials
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                API keys authenticate external requests via <code className="text-[#315C8C] bg-slate-100 px-1 py-0.5 rounded">X-API-Key: gnani_live_...</code>. Only hashes are stored.
              </p>
            </div>
          </div>

          {apiKeys.length === 0 ? (
            <div className="text-center py-12 text-[#64748B] text-xs">
              No API keys generated yet. Click "Generate API Key" to provision credentials for your ATS.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#172B45]">
                <thead className="bg-[#F5F7FA] text-[#64748B] uppercase tracking-wider text-[11px] border-b border-[#E2E8F0]">
                  <tr>
                    <th className="px-4 py-3">Name / Label</th>
                    <th className="px-4 py-3">Token Prefix</th>
                    <th className="px-4 py-3">Granted Scopes</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Last Active</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {apiKeys.map((k) => (
                    <tr key={k.key_id} className="hover:bg-[#F5F7FA]/50 transition">
                      <td className="px-4 py-3 font-semibold text-[#172B45]">{k.name}</td>
                      <td className="px-4 py-3 font-mono text-[#315C8C] text-[11px]">{k.key_prefix}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {k.scopes.map((s) => (
                            <span key={s} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-[#475569] border border-slate-200">
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${k.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                          }`}>
                          {k.is_active ? 'Active' : 'Revoked'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#64748B]">
                        {k.last_used_at ? new Date(k.last_used_at * 1000).toLocaleString() : 'Never'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isOrgAdmin && k.is_active && (
                          <button
                            onClick={() => handleRevokeKey(k.key_id)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition"
                            title="Revoke Key"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: WEBHOOK ENDPOINTS */}
      {activeTab === 'webhooks' && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-[#172B45] flex items-center gap-2">
                <Webhook className="w-4 h-4 text-[#167C72]" /> Subscribed Webhook Receivers
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Real-time event push with HMAC-SHA256 signatures and timestamp validation.
              </p>
            </div>
            {isOrgAdmin && (
              <button
                onClick={() => {
                  setCreatedWebhookSecret(null);
                  setWebhookUrl('');
                  setShowWebhookModal(true);
                }}
                className="px-3 py-1.5 bg-[#167C72] hover:bg-[#12625a] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Endpoint
              </button>
            )}
          </div>

          {webhooks.length === 0 ? (
            <div className="text-center py-12 text-[#64748B] text-xs">
              No webhook endpoints registered. Add an endpoint to receive live interview completion and assessment events.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#172B45]">
                <thead className="bg-[#F5F7FA] text-[#64748B] uppercase tracking-wider text-[11px] border-b border-[#E2E8F0]">
                  <tr>
                    <th className="px-4 py-3">Endpoint URL</th>
                    <th className="px-4 py-3">Signing Secret</th>
                    <th className="px-4 py-3">Subscribed Events</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {webhooks.map((wh) => (
                    <tr key={wh.endpoint_id} className="hover:bg-[#F5F7FA]/50 transition">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#172B45]">{wh.url}</div>
                        {wh.description && <div className="text-[11px] text-[#64748B]">{wh.description}</div>}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                        {wh.secret_preview}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {wh.events.map((e) => (
                            <span key={e} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-teal-50 text-teal-800 border border-teal-200">
                              {e}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${wh.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                          }`}>
                          {wh.is_active ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isOrgAdmin && (
                          <button
                            onClick={() => handleDeleteWebhook(wh.endpoint_id)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition"
                            title="Delete Endpoint"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: WEBHOOK DELIVERY TELEMETRY */}
      {activeTab === 'deliveries' && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-[#172B45] flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#315C8C]" /> Webhook Queue & Delivery Audit
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Database-backed delivery queue with exponential backoff and replay defense.
              </p>
            </div>
          </div>

          {deliveries.length === 0 ? (
            <div className="text-center py-12 text-[#64748B] text-xs">
              No webhook events dispatched for this organization yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#172B45]">
                <thead className="bg-[#F5F7FA] text-[#64748B] uppercase tracking-wider text-[11px] border-b border-[#E2E8F0]">
                  <tr>
                    <th className="px-4 py-3">Event Type</th>
                    <th className="px-4 py-3">Destination URL</th>
                    <th className="px-4 py-3">HTTP Status</th>
                    <th className="px-4 py-3">Attempts</th>
                    <th className="px-4 py-3">Delivery State</th>
                    <th className="px-4 py-3">Dispatched At</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {deliveries.map((del) => (
                    <tr key={del.delivery_id} className="hover:bg-[#F5F7FA]/50 transition font-mono text-[11px]">
                      <td className="px-4 py-3 font-semibold text-[#172B45] font-sans">{del.event_type}</td>
                      <td className="px-4 py-3 text-slate-600 truncate max-w-xs">{del.url}</td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${del.status_code === 200 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {del.status_code || 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-sans">{del.attempts} / {del.max_attempts}</td>
                      <td className="px-4 py-3 font-sans">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${del.status === 'delivered' ? 'bg-emerald-50 text-emerald-700' :
                            del.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                              'bg-rose-50 text-rose-700'
                          }`}>
                          {del.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 font-sans">
                        {new Date(del.created_at * 1000).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-3 text-right font-sans">
                        {del.status !== 'delivered' && (
                          <button
                            onClick={() => handleRetryDelivery(del.delivery_id)}
                            className="text-[#315C8C] hover:underline flex items-center gap-1 ml-auto text-xs font-semibold"
                          >
                            <Send className="w-3 h-3" /> Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: API & WEBHOOK DOCUMENTATION */}
      {activeTab === 'docs' && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm space-y-6">
          <div className="border-b border-[#E2E8F0] pb-4">
            <h3 className="text-base font-bold text-[#172B45] flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#315C8C]" /> Public Enterprise API v1 Guide
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              Reference implementation for ATS systems (Greenhouse, Lever, Workday) and HR platforms.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-bold uppercase text-[#172B45] tracking-wider mb-2">1. Authentication</h4>
              <p className="text-xs text-slate-600 mb-2">
                Supply your API key in either the <code className="bg-slate-100 text-[#315C8C] px-1 py-0.5 rounded">Authorization: Bearer gnani_live_...</code> header or the <code className="bg-slate-100 text-[#315C8C] px-1 py-0.5 rounded">X-API-Key</code> request header.
              </p>
              <pre className="p-3 bg-slate-900 text-slate-200 rounded-lg text-xs font-mono overflow-x-auto">
                {`curl -X GET "https://voiceprep.gnani.ai/api/v1/integrations/roles" \\
  -H "X-API-Key: gnani_live_YOUR_API_KEY"`}
              </pre>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase text-[#172B45] tracking-wider mb-2">2. Scheduling an Interview via ATS</h4>
              <pre className="p-3 bg-slate-900 text-slate-200 rounded-lg text-xs font-mono overflow-x-auto">
                {`curl -X POST "https://voiceprep.gnani.ai/api/v1/integrations/invitations" \\
  -H "X-API-Key: gnani_live_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "candidate_name": "Jane Doe",
    "candidate_email": "jane.doe@example.com",
    "role_id": "software-engineer",
    "duration_minutes": 20
  }'`}
              </pre>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase text-[#172B45] tracking-wider mb-2">3. Webhook Signature Verification (Node.js Example)</h4>
              <pre className="p-3 bg-slate-900 text-slate-200 rounded-lg text-xs font-mono overflow-x-auto">
                {`const crypto = require('crypto');

function verifyGnaniWebhook(payloadBuffer, headerSignature, webhookSecret) {
  const parts = Object.fromEntries(headerSignature.split(',').map(s => s.split('=')));
  const timestamp = parts['t'];
  const expectedSig = crypto
    .createHmac('sha256', webhookSecret)
    .update(\`\${timestamp}.\` + payloadBuffer)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(parts['v1']));
}`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* CREATE API KEY MODAL */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-[#E2E8F0] rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <h3 className="text-base font-bold text-[#172B45] flex items-center gap-2">
                <Key className="w-4 h-4 text-[#315C8C]" />
                {createdKeySecret ? 'API Key Generated' : 'Create New API Key'}
              </h3>
              <button onClick={() => setShowKeyModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {createdKeySecret ? (
              <div className="space-y-4">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  <strong>Important:</strong> Copy your API key now. For security purposes, it will never be displayed again.
                </div>
                <div className="p-3 bg-slate-900 rounded-lg flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-emerald-400 truncate">{createdKeySecret}</span>
                  <button
                    onClick={() => copyToClipboard(createdKeySecret)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded transition shrink-0"
                    title="Copy Key"
                  >
                    {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  onClick={() => setShowKeyModal(false)}
                  className="w-full py-2 bg-[#172B45] text-white rounded-lg text-xs font-semibold"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateKey} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-[#172B45]">Key Name / Integration Label</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Greenhouse Connector"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-[#E2E8F0] rounded-lg text-xs text-[#172B45] focus:outline-none focus:ring-1 focus:ring-[#315C8C]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#172B45] mb-1.5 block">Granted Scopes</label>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto p-2 border border-[#E2E8F0] rounded-lg">
                    {allAvailableScopes.map((scope) => {
                      const checked = newKeyScopes.includes(scope.id);
                      return (
                        <label key={scope.id} className="flex items-start gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewKeyScopes([...newKeyScopes, scope.id]);
                              } else {
                                setNewKeyScopes(newKeyScopes.filter((s) => s !== scope.id));
                              }
                            }}
                            className="mt-0.5 rounded text-[#315C8C]"
                          />
                          <div>
                            <div className="text-xs font-medium text-[#172B45]">{scope.label} <code className="text-[10px] text-slate-500 font-mono">({scope.id})</code></div>
                            <div className="text-[11px] text-slate-500">{scope.desc}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowKeyModal(false)}
                    className="flex-1 py-2 px-3 border border-[#E2E8F0] rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 px-3 bg-[#315C8C] hover:bg-[#25466b] text-white rounded-lg text-xs font-semibold"
                  >
                    Generate Credentials
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* CREATE WEBHOOK MODAL */}
      {showWebhookModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-[#E2E8F0] rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <h3 className="text-base font-bold text-[#172B45] flex items-center gap-2">
                <Webhook className="w-4 h-4 text-[#167C72]" />
                {createdWebhookSecret ? 'Webhook Registered' : 'Register Webhook Endpoint'}
              </h3>
              <button onClick={() => setShowWebhookModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {createdWebhookSecret ? (
              <div className="space-y-4">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
                  Webhook registered! Store this signing secret securely to verify incoming payloads.
                </div>
                <div className="p-3 bg-slate-900 rounded-lg flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-emerald-400 truncate">{createdWebhookSecret}</span>
                  <button
                    onClick={() => copyToClipboard(createdWebhookSecret)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded transition shrink-0"
                    title="Copy Secret"
                  >
                    {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  onClick={() => setShowWebhookModal(false)}
                  className="w-full py-2 bg-[#172B45] text-white rounded-lg text-xs font-semibold"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleRegisterWebhook} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-[#172B45]">Endpoint HTTPS URL</label>
                  <input
                    type="url"
                    required
                    placeholder="https://your-ats.com/webhooks/voiceprep"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-[#E2E8F0] rounded-lg text-xs text-[#172B45] focus:outline-none focus:ring-1 focus:ring-[#167C72]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#172B45]">Description</label>
                  <input
                    type="text"
                    placeholder="e.g. ATS candidate status sync"
                    value={webhookDesc}
                    onChange={(e) => setWebhookDesc(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-[#E2E8F0] rounded-lg text-xs text-[#172B45] focus:outline-none focus:ring-1 focus:ring-[#167C72]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#172B45] mb-1.5 block">Subscribed Events</label>
                  <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto p-2 border border-[#E2E8F0] rounded-lg">
                    {allAvailableEvents.map((evt) => {
                      const checked = webhookEvents.includes(evt.id);
                      return (
                        <label key={evt.id} className="flex items-center gap-2 p-1 text-xs hover:bg-slate-50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setWebhookEvents([...webhookEvents, evt.id]);
                              } else {
                                setWebhookEvents(webhookEvents.filter((id) => id !== evt.id));
                              }
                            }}
                            className="rounded text-[#167C72]"
                          />
                          <span className="text-[11px] font-mono text-[#172B45]">{evt.id}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowWebhookModal(false)}
                    className="flex-1 py-2 px-3 border border-[#E2E8F0] rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 px-3 bg-[#167C72] hover:bg-[#12625a] text-white rounded-lg text-xs font-semibold"
                  >
                    Register Endpoint
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

