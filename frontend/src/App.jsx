import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { EnterpriseShell } from './components/EnterpriseShell';
import { RecruiterDashboard } from './components/RecruiterDashboard';
import { PracticeStudio } from './components/PracticeStudio';
import { CandidateReportView } from './components/CandidateReportView';
import { JobRoleManager } from './components/JobRoleManager';
import { SettingsManager } from './components/SettingsManager';
import { InterviewConfigModal } from './components/InterviewConfigModal';
import { CandidateRegistrationModal } from './components/CandidateRegistrationModal';
import { LiveInterviewRoom } from './components/LiveInterviewRoom';
import { FinalReportModal } from './components/FinalReportModal';
import { WebcamVerificationBench } from './components/WebcamVerificationBench';
import { AnalyticsWorkspace } from './components/AnalyticsWorkspace';
import { OrganizationWorkspace } from './components/OrganizationWorkspace';
import { MultiTenantAuthModal } from './components/MultiTenantAuthModal';
import { ScheduleInterviewModal } from './components/ScheduleInterviewModal';
import { InvitationManager } from './components/InvitationManager';
import BillingWorkspace from './components/BillingWorkspace';
import IntegrationWorkspace from './components/IntegrationWorkspace';
import SystemReadiness from './components/secure_assess/SystemReadiness';
import CandidateWorkspace from './components/CandidateWorkspace';

export function App() {
  const [roles, setRoles] = useState([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  const [serviceStatus, setServiceStatus] = useState(null);

  // Enterprise navigation views: 
  // 'dashboard' | 'interview' | 'practice' | 'candidates' | 'roles' | 'benchmark' | 'settings' | 'setup' | 'registration' | 'readiness' | 'report'
  const [activeNav, setActiveNav] = useState('dashboard');
  const [setupMode, setSetupMode] = useState('company');
  const [selectedRoleForRegistration, setSelectedRoleForRegistration] = useState(null);
  const [registeredCandidate, setRegisteredCandidate] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);
  const [finalReport, setFinalReport] = useState(null);

  // Multi-Tenant SaaS State
  const [currentOrg, setCurrentOrg] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [invitationCandidate, setInvitationCandidate] = useState(null);

  const [isStarting, setIsStarting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [appError, setAppError] = useState(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setIsLoadingRoles(true);
    setAppError(null);
    try {
      const [rolesRes, healthRes] = await Promise.all([
        fetch('/api/roles'),
        fetch('/api/health')
      ]);

      if (!rolesRes.ok) throw new Error("Could not load roles from backend.");
      const rolesData = await rolesRes.json();
      setRoles(rolesData);

      if (healthRes.ok) {
        const healthData = await healthRes.json();
        setServiceStatus(healthData);
      }

      // Ensure active recruiter session token and tenant profile is initialized
      let token = localStorage.getItem('recruiter_token') || localStorage.getItem('gnani_recruiter_token');
      if (!token) {
        try {
          const authRes = await fetch('/api/auth/recruiter-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'recruiter@gnani.ai', password: 'Password123' })
          });
          if (authRes.ok) {
            const authData = await authRes.json();
            if (authData.token) {
              localStorage.setItem('recruiter_token', authData.token);
              localStorage.setItem('recruiter_user', JSON.stringify(authData));
              token = authData.token;
              setCurrentUser(authData);
              if (authData.org) setCurrentOrg(authData.org);
            }
          }
        } catch (_) { }
      }

      if (token) {
        try {
          const meRes = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (meRes.ok) {
            const meData = await meRes.json();
            setCurrentUser(meData);
            if (meData.org) setCurrentOrg(meData.org);
          }
        } catch (_) { }
      }
    } catch (err) {
      console.error("Initialization error:", err);
      setAppError("Backend unreachable on port 8010. Ensure FastAPI server is running.");
    } finally {
      setIsLoadingRoles(false);
    }
  };

  const handleStartInterview = async (config) => {
    if (isStarting) return; // Prevent duplicate clicks
    setIsStarting(true);
    setAppError(null);

    try {
      const mergedConfig = {
        ...config,
        candidate_id: registeredCandidate?.candidate_id || config.candidate_id || `candidate_${Date.now()}`,
        candidate_name: registeredCandidate?.candidate_name || config.candidate_name || 'Candidate',
        candidate_email: registeredCandidate?.candidate_email || config.candidate_email || 'candidate@example.com'
      };

      const response = await fetch('/api/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mergedConfig)
      });

      if (!response.ok) {
        let errorDetail = `Session startup failed (${response.status})`;
        try {
          const errorData = await response.json();
          if (errorData.detail) {
            errorDetail = typeof errorData.detail === 'string'
              ? errorData.detail
              : Array.isArray(errorData.detail)
                ? errorData.detail.map(d => d.msg || JSON.stringify(d)).join(', ')
                : JSON.stringify(errorData.detail);
          }
        } catch (_) { }
        throw new Error(errorDetail);
      }

      const sessionData = await response.json();
      if (!sessionData?.session_id) {
        throw new Error("Invalid response from server: Missing session identifier.");
      }

      setCurrentSession(sessionData);
      // Route Company Assessment mode through SecureAssess System Readiness diagnostics
      if (sessionData.mode === 'company') {
        setActiveNav('readiness');
      } else {
        setActiveNav('interview');
      }
    } catch (err) {
      console.error("Start interview error:", err);
      setAppError(err.message || "Failed to start interview session.");
    } finally {
      setIsStarting(false);
    }
  };

  const handleAnswerSubmit = async (audioBlob, mimeType) => {
    if (!currentSession) return;

    setIsSubmitting(true);
    setAppError(null);

    const extension = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('wav') ? 'wav' : 'webm';
    const uploadFilename = `answer.${extension}`;

    const formData = new FormData();
    formData.append('session_id', currentSession.session_id);
    formData.append('question_id', currentSession.question.id);
    formData.append('language', 'en-IN');
    formData.append('audio', audioBlob, uploadFilename);

    try {
      const response = await fetch('/api/session/answer', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Answer evaluation error (${response.status})`);
      }

      const result = await response.json();

      if (result.session_status === 'COMPLETED') {
        await fetchFinalReport(currentSession.session_id);
      } else {
        setCurrentSession(prev => ({
          ...prev,
          current_index: result.current_index,
          total_questions: result.total_questions,
          question: result.next_question,
          question_audio_b64: result.next_question_audio_b64,
          last_evaluation: result.evaluation
        }));
      }
    } catch (err) {
      console.error("Submit answer error:", err);
      setAppError(err.message || "Failed to transcribe and evaluate response.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleIntegrityEvent = async (eventObj) => {
    if (!currentSession?.session_id) return;
    try {
      await fetch('/api/session/log-integrity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: currentSession.session_id,
          category: eventObj.category || "confirmed_technical_event",
          event_type: eventObj.event_type,
          detail: eventObj.detail,
          duration_seconds: eventObj.duration_seconds || 0.0
        })
      });
    } catch (e) {
      console.warn("Could not log integrity event:", e);
    }
  };

  const handleEmergencyExit = async (reason) => {
    if (!currentSession?.session_id) return;
    try {
      await fetch('/api/session/emergency-exit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(typeof reason === 'string' ? { session_id: currentSession.session_id, reason } : reason)
      });
      await fetchFinalReport(currentSession.session_id);
    } catch (e) {
      console.warn("Emergency exit failed:", e);
    }
  };

  const handleStreamPause = async (reason) => {
    if (!currentSession?.session_id) return;
    try {
      await fetch('/api/session/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: currentSession.session_id,
          reason: reason || "Camera disconnect event"
        })
      });
    } catch (e) {
      console.warn("Session pause request note:", e);
    }
  };

  const handleStreamResume = async () => {
    if (!currentSession?.session_id) return;
    try {
      await fetch('/api/session/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: currentSession.session_id
        })
      });
    } catch (e) {
      console.warn("Session resume request note:", e);
    }
  };

  const fetchFinalReport = async (sessionId) => {
    try {
      const token = localStorage.getItem('gnani_recruiter_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const response = await fetch(`/api/session/${sessionId}/report`, { headers });
      if (!response.ok) throw new Error("Could not retrieve final evaluation.");
      const data = await response.json();
      setFinalReport(data);
      setActiveNav('report');
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (e) {
      console.error("Report fetch error:", e);
      setAppError(e.message || "Error generating final assessment report.");
    }
  };

  const handleRestart = () => {
    setCurrentSession(null);
    setFinalReport(null);
    setAppError(null);
    setActiveNav('dashboard');
  };

  const handleNavSelect = (navId) => {
    if (navId === 'interview' && !currentSession) {
      setActiveNav('setup');
      return;
    }
    setActiveNav(navId);
  };

  // In live interview mode, render the dedicated distraction-free proctored stage
  if (activeNav === 'interview' && currentSession) {
    return (
      <LiveInterviewRoom
        session={currentSession}
        onAnswerSubmit={handleAnswerSubmit}
        onIntegrityEvent={handleIntegrityEvent}
        onEmergencyExit={handleEmergencyExit}
        onStreamPause={handleStreamPause}
        onStreamResume={handleStreamResume}
        isSubmitting={isSubmitting}
        errorMessage={appError}
      />
    );
  }

  return (
    <EnterpriseShell
      activeNav={activeNav}
      onNavSelect={handleNavSelect}
      serviceStatus={serviceStatus}
      currentSession={currentSession}
      currentOrg={currentOrg}
      currentUser={currentUser}
      onOpenAuthModal={() => setShowAuthModal(true)}
      onLogout={() => {
        localStorage.removeItem('recruiter_token');
        localStorage.removeItem('recruiter_user');
        setCurrentUser(null);
        setCurrentOrg(null);
      }}
    >
      {isLoadingRoles ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-3">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs">Connecting to Gnani Enterprise Workspace...</span>
        </div>
      ) : (
        <>
          {/* Candidate Workspace Views */}
          {currentUser?.role === 'candidate' && (
            <CandidateWorkspace
              candidateUser={currentUser}
              roles={roles}
              activeSubTab={
                activeNav === 'candidate_practice' ? 'practice' :
                activeNav === 'candidate_interviews' ? 'interviews' :
                activeNav === 'candidate_insights' ? 'insights' :
                activeNav === 'candidate_profile' ? 'profile' : 'home'
              }
              onSubTabChange={(sub) => setActiveNav(`candidate_${sub}`)}
              onStartPractice={(config) => {
                setSetupMode('practice');
                handleStartInterview(config);
              }}
              onOpenLiveSession={async (sessionId) => {
                await fetchFinalReport(sessionId);
              }}
            />
          )}

          {/* Recruiter Workspace Views */}
          {currentUser?.role !== 'candidate' && (activeNav === 'dashboard' || activeNav === 'overview') && (
            <RecruiterDashboard
              roles={roles}
              onLaunchInterview={() => {
                setSetupMode('company');
                setActiveNav('registration');
              }}
              onViewReport={async (reportOrSessionId) => {
                if (typeof reportOrSessionId === 'object' && reportOrSessionId !== null) {
                  setFinalReport(reportOrSessionId);
                  setActiveNav('report');
                } else if (reportOrSessionId) {
                  await fetchFinalReport(reportOrSessionId);
                }
              }}
              onSwitchToPractice={() => {
                setSetupMode('practice');
                setActiveNav('setup');
              }}
              onOpenBenchmark={() => setActiveNav('benchmark')}
            />
          )}

          {currentUser?.role !== 'candidate' && activeNav === 'assessments' && (
            <CandidateReportView
              onLaunchAssessment={() => {
                setSetupMode('company');
                setActiveNav('registration');
              }}
              onViewReport={async (sessionId) => {
                if (sessionId) {
                  await fetchFinalReport(sessionId);
                }
              }}
            />
          )}

          {activeNav === 'analytics' && (
            <AnalyticsWorkspace
              onViewReport={async (sessionId) => {
                if (sessionId) {
                  await fetchFinalReport(sessionId);
                }
              }}
            />
          )}

          {activeNav === 'practice' && (
            <PracticeStudio
              roles={roles}
              onStartPracticeSession={(role) => {
                setSetupMode('practice');
                setActiveNav('setup');
              }}
            />
          )}

          {activeNav === 'candidates' && (
            <CandidateReportView
              onLaunchAssessment={() => {
                setSetupMode('company');
                setActiveNav('registration');
              }}
              onViewReport={async (sessionId) => {
                if (sessionId) {
                  await fetchFinalReport(sessionId);
                }
              }}
            />
          )}

          {activeNav === 'roles' && (
            <JobRoleManager
              roles={roles}
              onConfigureRole={(role) => {
                setSelectedRoleForRegistration(role);
                setSetupMode('company');
                setActiveNav('registration');
              }}
            />
          )}

          {activeNav === 'invitations' && (
            <InvitationManager
              roles={roles}
              onOpenScheduleModal={() => {
                setInvitationCandidate(null);
                setShowScheduleModal(true);
              }}
            />
          )}

          {activeNav === 'organization' && (
            <OrganizationWorkspace
              currentOrg={currentOrg}
              userProfile={currentUser}
              onOrgUpdated={(updated) => setCurrentOrg(updated)}
            />
          )}

          {activeNav === 'billing' && (
            <BillingWorkspace
              authUser={currentUser}
              orgBranding={currentOrg?.branding}
              onUpgradeSuccess={fetchInitialData}
            />
          )}

          {activeNav === 'integrations' && (
            <IntegrationWorkspace
              authUser={currentUser}
              orgBranding={currentOrg?.branding}
            />
          )}

          {activeNav === 'settings' && (
            <SettingsManager
              serviceStatus={serviceStatus}
            />
          )}

          {activeNav === 'registration' && (
            <CandidateRegistrationModal
              selectedRole={selectedRoleForRegistration || roles[0]}
              initialMode={setupMode}
              onRegisterComplete={(candidateInfo) => {
                setRegisteredCandidate(candidateInfo);
                setActiveNav('setup');
              }}
              onCancel={() => setActiveNav('dashboard')}
            />
          )}

          {activeNav === 'setup' && (
            <InterviewConfigModal
              roles={roles}
              initialMode={setupMode}
              onStart={handleStartInterview}
              isStarting={isStarting}
              errorMessage={appError}
            />
          )}

          {activeNav === 'readiness' && currentSession && (
            <SystemReadiness
              sessionId={currentSession.session_id}
              roleTitle={currentSession.role_name}
              onReadinessPassed={() => setActiveNav('interview')}
              onExit={handleRestart}
            />
          )}

          {activeNav === 'interview' && currentSession && (
            <LiveInterviewRoom
              session={currentSession}
              onAnswerSubmit={handleAnswerSubmit}
              onIntegrityEvent={handleIntegrityEvent}
              onEmergencyExit={handleEmergencyExit}
              onStreamPause={handleStreamPause}
              onStreamResume={handleStreamResume}
              isSubmitting={isSubmitting}
              errorMessage={appError}
            />
          )}

          {activeNav === 'report' && finalReport && (
            <FinalReportModal
              report={finalReport}
              onRestart={handleRestart}
            />
          )}

          {activeNav === 'benchmark' && (
            <WebcamVerificationBench
              onBack={() => setActiveNav('dashboard')}
            />
          )}
        </>
      )}

      {/* Multi-Tenant Authentication & Onboarding Modal */}
      <MultiTenantAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        currentOrg={currentOrg}
        onLoginSuccess={(userData) => {
          setCurrentUser(userData);
          if (userData.org) setCurrentOrg(userData.org);
        }}
      />

      {/* Schedule Assessment Invitation Modal */}
      <ScheduleInterviewModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        roles={roles}
        initialCandidate={invitationCandidate}
        onInvitationCreated={() => {
          setActiveNav('invitations');
        }}
      />
    </EnterpriseShell>
  );
}

export default App;
