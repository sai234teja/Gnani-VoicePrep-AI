import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Calendar, 
  Clock, 
  Send, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Plus, 
  Copy, 
  Check, 
  Trash2,
  Bell,
  Search,
  Filter
} from 'lucide-react';

export const InvitationManager = ({ roles = [], onOpenScheduleModal }) => {
  const [activeSubTab, setActiveSubTab] = useState('invitations'); // 'invitations' | 'queue' | 'in_app'
  const [invitations, setInvitations] = useState([]);
  const [notificationLogs, setNotificationLogs] = useState([]);
  const [inAppNotifs, setInAppNotifs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState(null);
  const [copiedToken, setCopiedToken] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    fetchData();
  }, [activeSubTab]);

  const fetchData = async () => {
    setIsLoading(true);
    const token = localStorage.getItem('recruiter_token');
    try {
      if (activeSubTab === 'invitations') {
        const res = await fetch('/api/invitations', { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) setInvitations((await res.json()).invitations || []);
      } else if (activeSubTab === 'queue') {
        const res = await fetch('/api/notifications/logs', { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) setNotificationLogs((await res.json()).logs || []);
      } else if (activeSubTab === 'in_app') {
        const res = await fetch('/api/notifications/in-app', { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) setInAppNotifs((await res.json()).notifications || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = (link, id) => {
    navigator.clipboard.writeText(link);
    setCopiedToken(id);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleResend = async (invitationId) => {
    const token = localStorage.getItem('recruiter_token');
    try {
      const res = await fetch(`/api/invitations/${invitationId}/resend`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setActionMsg({ type: 'success', text: 'Invitation notification resent successfully.' });
        fetchData();
      } else {
        const data = await res.json();
        setActionMsg({ type: 'error', text: data.detail || 'Could not resend invitation.' });
      }
    } catch (e) {
      setActionMsg({ type: 'error', text: e.message });
    }
  };

  const handleCancel = async (invitationId) => {
    const token = localStorage.getItem('recruiter_token');
    try {
      const res = await fetch(`/api/invitations/${invitationId}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setActionMsg({ type: 'success', text: 'Invitation cancelled and scheduled reminders stopped.' });
        fetchData();
      }
    } catch (e) {
      setActionMsg({ type: 'error', text: e.message });
    }
  };

  const handleMarkAllRead = async () => {
    const token = localStorage.getItem('recruiter_token');
    try {
      const res = await fetch('/api/notifications/in-app/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ mark_all: true })
      });
      if (res.ok) fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const filteredInvitations = invitations.filter(i => 
    i.candidate_name?.toLowerCase().includes(searchFilter.toLowerCase()) ||
    i.candidate_email?.toLowerCase().includes(searchFilter.toLowerCase()) ||
    i.role_title?.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#172B45] flex items-center gap-2">
            <Mail className="w-5 h-5 text-[#2563EB]" />
            <span>Interview Invitations & Communication Center</span>
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Schedule candidate assessments, track email delivery telemetry, and manage in-app alerts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-[#F8FAFC] border border-[#E2E8F0] p-1 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setActiveSubTab('invitations')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                activeSubTab === 'invitations' ? 'bg-white text-[#172B45] shadow-xs' : 'text-[#64748B] hover:text-[#172B45]'
              }`}
            >
              Invitations
            </button>
            <button
              onClick={() => setActiveSubTab('queue')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                activeSubTab === 'queue' ? 'bg-white text-[#172B45] shadow-xs' : 'text-[#64748B] hover:text-[#172B45]'
              }`}
            >
              Delivery Queue & Telemetry
            </button>
            <button
              onClick={() => setActiveSubTab('in_app')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                activeSubTab === 'in_app' ? 'bg-white text-[#172B45] shadow-xs' : 'text-[#64748B] hover:text-[#172B45]'
              }`}
            >
              Recruiter Alerts
            </button>
          </div>

          <button
            onClick={onOpenScheduleModal}
            className="px-3.5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Assessment</span>
          </button>
        </div>
      </div>

      {actionMsg && (
        <div className={`p-4 rounded-xl border text-xs flex items-center gap-2 ${
          actionMsg.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {actionMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{actionMsg.text}</span>
        </div>
      )}

      {/* SUBTAB 1: INVITATIONS */}
      {activeSubTab === 'invitations' && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search candidates or job roles..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#CBD5E1] rounded-lg focus:outline-none"
              />
            </div>
            <button onClick={fetchData} className="p-1.5 text-[#64748B] hover:text-[#172B45] rounded-md hover:bg-slate-50">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] font-semibold">
                <tr>
                  <th className="py-3 px-4">Candidate</th>
                  <th className="py-3 px-4">Job Role</th>
                  <th className="py-3 px-4">Scheduled Slot</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Access Link</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {filteredInvitations.map(inv => (
                  <tr key={inv.invitation_id} className="hover:bg-[#F8FAFC]">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#172B45]">{inv.candidate_name}</div>
                      <div className="text-[11px] text-[#64748B]">{inv.candidate_email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-[#172B45]">{inv.role_title}</span>
                      <div className="text-[10px] text-[#64748B]">{inv.duration_minutes} Minutes</div>
                    </td>
                    <td className="py-3 px-4 text-[11px] text-[#172B45]">
                      {new Date(inv.scheduled_time * 1000).toLocaleString(undefined, {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        inv.status === 'ACCEPTED' ? 'bg-emerald-50 text-emerald-700' :
                        inv.status === 'SENT' ? 'bg-blue-50 text-blue-700' :
                        inv.status === 'CANCELLED' ? 'bg-red-50 text-red-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleCopyLink(inv.invitation_link, inv.invitation_id)}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[11px] font-mono text-[#334155] transition-all"
                        title="Copy secure link"
                      >
                        {copiedToken === inv.invitation_id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedToken === inv.invitation_id ? 'Copied!' : 'Copy Link'}</span>
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      {inv.status !== 'CANCELLED' && inv.status !== 'ACCEPTED' && (
                        <>
                          <button
                            onClick={() => handleResend(inv.invitation_id)}
                            className="text-[11px] font-semibold text-blue-600 hover:text-blue-800"
                          >
                            Resend
                          </button>
                          <button
                            onClick={() => handleCancel(inv.invitation_id)}
                            className="text-[11px] font-semibold text-red-600 hover:text-red-800"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredInvitations.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-[#94A3B8]">
                      No scheduled interview invitations found. Click "Schedule Assessment" above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 2: DELIVERY QUEUE & TELEMETRY */}
      {activeSubTab === 'queue' && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#172B45]">Notification Dispatch Queue & Telemetry</h2>
              <p className="text-xs text-[#64748B]">Persistent job queue tracking sent, pending, and scheduled reminder emails.</p>
            </div>
            <button onClick={fetchData} className="p-1.5 text-[#64748B] hover:text-[#172B45] rounded-md hover:bg-slate-50">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] font-semibold">
                <tr>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Delivery Status</th>
                  <th className="py-3 px-4">Scheduled / Sent Time</th>
                  <th className="py-3 px-4 text-right">Retries</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {notificationLogs.map(log => (
                  <tr key={log.notification_id} className="hover:bg-[#F8FAFC]">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#172B45]">{log.recipient_name || 'Candidate'}</div>
                      <div className="text-[11px] text-[#64748B]">{log.recipient_email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {log.notification_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#172B45] max-w-xs truncate">{log.subject}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        log.status === 'SENT' || log.status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-700' :
                        log.status === 'PENDING' ? 'bg-amber-50 text-amber-700' :
                        log.status === 'CANCELLED' ? 'bg-slate-100 text-slate-600' :
                        'bg-red-50 text-red-700'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[11px] text-[#64748B]">
                      {log.sent_at 
                        ? new Date(log.sent_at * 1000).toLocaleString() 
                        : `Scheduled: ${new Date(log.scheduled_send_time * 1000).toLocaleString()}`}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-[11px]">{log.retry_count}</td>
                  </tr>
                ))}
                {notificationLogs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-[#94A3B8]">
                      No notification logs in the dispatch queue.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 3: RECRUITER IN-APP NOTIFICATIONS */}
      {activeSubTab === 'in_app' && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4">
            <div>
              <h2 className="text-sm font-bold text-[#172B45]">Recruiter In-App Notification Center</h2>
              <p className="text-xs text-[#64748B]">Real-time operational alerts for candidate invitations and interview milestones.</p>
            </div>
            <button
              onClick={handleMarkAllRead}
              className="text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8]"
            >
              Mark all as read
            </button>
          </div>

          <div className="space-y-3">
            {inAppNotifs.map(n => (
              <div
                key={n.id}
                className={`p-4 rounded-xl border transition-all ${
                  n.is_read ? 'bg-[#F8FAFC] border-[#E2E8F0]' : 'bg-blue-50/40 border-blue-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#172B45]">{n.title}</h4>
                      <p className="text-xs text-[#475569] mt-0.5">{n.message}</p>
                      <span className="text-[10px] text-[#94A3B8] mt-1 block">
                        {new Date(n.created_at * 1000).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  {!n.is_read && (
                    <span className="w-2 h-2 rounded-full bg-[#2563EB] flex-shrink-0 mt-2" />
                  )}
                </div>
              </div>
            ))}
            {inAppNotifs.length === 0 && (
              <div className="py-8 text-center text-xs text-[#94A3B8]">
                No in-app alerts at this time.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

