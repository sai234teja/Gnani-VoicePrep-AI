import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ShieldAlert, Eye, VolumeX, Maximize2, AlertTriangle, CheckCircle2 } from 'lucide-react';

/**
 * IntegrityMonitor Hook and Overlay component
 * Non-accusatory telemetry logger for Company Assessment Mode
 */
export default function IntegrityMonitor({
  sessionId,
  isActive = true,
  currentQuestionId = null,
  onCriticalEvent = null,
  onEmergencyExit = null
}) {
  const [recentEvents, setRecentEvents] = useState([]);
  const [warningBanner, setWarningBanner] = useState(null);
  const [violationCount, setViolationCount] = useState(0);
  const seqRef = useRef(1);
  const heartbeatIntervalRef = useRef(null);
  const violationCountRef = useRef(0);

  const registerViolation = useCallback((reason) => {
    violationCountRef.current += 1;
    const current = violationCountRef.current;
    setViolationCount(current);

    if (current >= 4) {
      setWarningBanner("Session terminated due to multiple policy violations.");
      onEmergencyExit?.("Session automatically terminated after exceeding 3 confirmed policy violations.");
    } else {
      setWarningBanner(`Warning (${current}/3): ${reason}. Please remain focused on the assessment.`);
      setTimeout(() => setWarningBanner(null), 5000);
    }
  }, [onEmergencyExit]);

  const postEvent = useCallback(async (eventType, category, detail, severity = 'info') => {
    if (!sessionId || !isActive) return;

    // Track confirmed technical violations (e.g. leaving tab or exiting fullscreen)
    if (category === 'confirmed_technical_event' && (eventType === 'tab_hidden' || eventType === 'fullscreen_exited')) {
      registerViolation(eventType === 'tab_hidden' ? 'Interview tab switched' : 'Fullscreen exited');
    }

    const payload = {
      session_id: sessionId,
      event_type: eventType,
      category: category, // 'confirmed_technical_event' or 'uncertain_observation'
      detail: detail,
      question_id: currentQuestionId,
      severity: severity,
      sequence: seqRef.current++,
      client_timestamp: new Date().toISOString()
    };

    setRecentEvents(prev => [payload, ...prev.slice(0, 8)]);

    try {
      await fetch('/api/security/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.warn('[IntegrityMonitor] Failed to transmit event:', e);
    }
  }, [sessionId, isActive, currentQuestionId, registerViolation]);

  // Periodic heartbeat every 15 seconds
  useEffect(() => {
    if (!sessionId || !isActive) return;

    const sendHeartbeat = async () => {
      try {
        await fetch('/api/security/session/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            client_timestamp: new Date().toISOString(),
            status: 'active'
          })
        });
      } catch (err) {
        console.warn('[IntegrityMonitor] Heartbeat error:', err);
      }
    };

    sendHeartbeat();
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, 15000);

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [sessionId, isActive]);

  // Listeners for Tab Visibility and Window Blur
  useEffect(() => {
    if (!sessionId || !isActive) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        postEvent(
          'tab_hidden',
          'confirmed_technical_event',
          'Browser tab was placed into the background or minimized',
          'warning'
        );
        setWarningBanner('Notice: Please keep the assessment tab active.');
      } else {
        postEvent(
          'tab_restored',
          'confirmed_technical_event',
          'Browser tab returned to foreground',
          'info'
        );
        setTimeout(() => setWarningBanner(null), 3000);
      }
    };

    const handleWindowBlur = () => {
      postEvent(
        'window_blur',
        'confirmed_technical_event',
        'Window lost focus (another application or display clicked)',
        'info'
      );
    };

    const handleWindowFocus = () => {
      postEvent(
        'window_focus',
        'confirmed_technical_event',
        'Window regained focus',
        'info'
      );
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        postEvent(
          'fullscreen_exited',
          'confirmed_technical_event',
          'Candidate exited fullscreen view',
          'warning'
        );
      } else {
        postEvent(
          'fullscreen_entered',
          'confirmed_technical_event',
          'Candidate restored fullscreen view',
          'info'
        );
      }
    };

    const handleOffline = () => {
      postEvent(
        'network_offline',
        'confirmed_technical_event',
        'Browser network connection dropped',
        'error'
      );
      setWarningBanner('Network connection interrupted. Reconnecting...');
    };

    const handleOnline = () => {
      postEvent(
        'network_online',
        'confirmed_technical_event',
        'Browser network connection restored',
        'info'
      );
      setTimeout(() => setWarningBanner(null), 3000);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [sessionId, isActive, postEvent]);

  if (!warningBanner) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-bounce">
      <div className={`px-4 py-2 rounded-xl text-xs font-semibold shadow-xl flex items-center gap-2 backdrop-blur-md ${
        violationCount >= 3 ? 'bg-red-600/95 text-white' : 'bg-amber-500/90 text-slate-950'
      }`}>
        <AlertTriangle className="w-4 h-4" />
        <span>{warningBanner}</span>
        {violationCount > 0 && (
          <span className="ml-1 px-1.5 py-0.5 rounded bg-black/30 text-[10px] font-mono font-bold">
            Policy Warning: {Math.min(3, violationCount)}/3
          </span>
        )}
      </div>
    </div>
  );
}

