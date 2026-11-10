import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InterviewConfigModal } from '../components/InterviewConfigModal';
import { CameraMonitor } from '../components/CameraMonitor';
import { LiveInterviewRoom } from '../components/LiveInterviewRoom';
import { FinalReportModal } from '../components/FinalReportModal';
import { RobustFaceTracker } from '../utils/faceTracker';

const mockRoles = [
  {
    id: "python-fullstack",
    name: "Python Full Stack",
    default_tech: ["FastAPI", "React", "PostgreSQL", "Redis"],
    description: "End-to-end applications and distributed systems."
  },
  {
    id: "java-dev",
    name: "Java Developer",
    default_tech: ["Java", "Spring Boot"],
    description: "Enterprise backend services."
  }
];

describe('Browser-Based User Journey Verification (Demo / Mock-Safe Mode)', () => {

  // 1. Practice Mode setup
  it('1. Practice Mode setup: initializes with candidate controls and optional toggles', () => {
    const onStart = vi.fn();
    render(<InterviewConfigModal roles={mockRoles} onStart={onStart} isStarting={false} />);

    // Assert Practice Mode is active by default
    expect(screen.getByText(/Practice Mode \(Candidate Controlled, Replay & Delete\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Device & Privacy Preferences \(Practice Mode\)/i)).toBeInTheDocument();

    // Verify skills can be added
    const customInput = screen.getByPlaceholderText(/Add skill/i);
    fireEvent.change(customInput, { target: { value: 'Docker' } });
    fireEvent.click(screen.getByText('Add'));
    expect(screen.getByText('Docker')).toBeInTheDocument();

    // Submit practice form
    fireEvent.click(screen.getByText('Start Practice Session'));
    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'practice',
      role_id: 'python-fullstack',
      tech_stack: expect.arrayContaining(['Docker', 'FastAPI'])
    }));
  });

  // 2. Company Mode setup
  it('2. Company Mode setup: enforces camera, mic, and informed consent', () => {
    const onStart = vi.fn();
    render(<InterviewConfigModal roles={mockRoles} onStart={onStart} isStarting={false} />);

    // Switch to Company Mode
    const companyTab = screen.getByText(/Company Interview Mode/i);
    fireEvent.click(companyTab);

    expect(screen.getByText(/Structured Company Assessment/i)).toBeInTheDocument();
    expect(screen.getByText(/Begin Company Interview/i)).toBeInTheDocument();

    // Submit company mode form
    fireEvent.click(screen.getByText('Begin Company Interview'));
    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'company',
      camera_enabled: true,
      microphone_enabled: true,
      integrity_consent: true
    }));
  });

  // 3. Camera and microphone permissions
  it('3. Camera and microphone permissions: initializes media streams without throwing errors', async () => {
    render(<CameraMonitor mode="practice" sessionId="test-sess-1" />);

    // Verify media preview renders
    await waitFor(() => {
      expect(screen.getByText(/REC 480p\/15fps/i)).toBeInTheDocument();
    });
  });

  // 4. Camera preview and recording
  it('4. Camera preview and recording: provides persistent recording status and local recording controls in Practice Mode', async () => {
    render(<CameraMonitor mode="practice" sessionId="test-sess-1" />);

    // Check persistent 480p/15fps indicator
    await waitFor(() => {
      expect(screen.getByText(/REC 480p\/15fps/i)).toBeInTheDocument();
    });

    // Check practice record button exists
    expect(screen.getByText('Record Video')).toBeInTheDocument();
  });

  // 5. Face detection availability and uncertainty state
  it('5. Face detection availability and uncertainty state: reports one of exact 4 states cleanly', async () => {
    const tracker = new RobustFaceTracker();

    // Verify exact states:
    expect(tracker._formatStateResult(0, [], true).state).toBe('No face detected');
    expect(tracker._formatStateResult(1, [{ x: 10, y: 10, width: 60, height: 60 }], true).state).toBe('One face detected');
    expect(tracker._formatStateResult(2, [{}, {}], true).state).toBe('Multiple faces detected');
    expect(tracker._formatStateResult(0, [], false).state).toBe('Face detection unavailable');
  });

  // 6. Interview question progression
  it('6. Interview question progression: displays question prompt, context, rubric tags, and timer', () => {
    const mockSession = {
      session_id: "test-sess-progression",
      mode: "practice",
      role_name: "Python Full Stack",
      current_index: 2,
      total_questions: 3,
      question: {
        id: "py-2",
        title: "How do you execute long-running asynchronous tasks in Python?",
        context: "Explain Celery, Redis, and message queues.",
        difficulty: "medium",
        key_points: ["celery", "redis", "asyncio"]
      },
      question_audio_b64: null,
      last_evaluation: {
        overall_score: 82,
        transcript: "I used FastAPI with Celery and Redis to handle asynchronous background processing.",
        spoken_feedback: "Solid explanation of worker decoupling."
      }
    };

    render(
      <LiveInterviewRoom
        session={mockSession}
        onAnswerSubmit={vi.fn()}
        onIntegrityEvent={vi.fn()}
        isSubmitting={false}
      />
    );

    expect(screen.getByText(/Question 2 of 3/i)).toBeInTheDocument();
    expect(screen.getAllByText(/How do you execute long-running asynchronous tasks in Python\?/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/#celery/i)).toBeInTheDocument();
    expect(screen.getByText(/Prior Response Score: 82\/100/i)).toBeInTheDocument();
  });

  // 7. Recording playback and deletion
  it('7. Recording playback and deletion: allows candidate-controlled preview, playback and deletion', async () => {
    render(<CameraMonitor mode="practice" sessionId="test-sess-1" />);

    await waitFor(() => {
      expect(screen.getByText('Record Video')).toBeInTheDocument();
    });

    // Start local recording
    const recBtn = screen.getByText('Record Video');
    fireEvent.click(recBtn);

    // Stop recording
    await waitFor(() => {
      expect(screen.getByText('Stop Local Rec')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Stop Local Rec'));

    // Check preview and delete control
    await waitFor(() => {
      expect(screen.getByText(/Local Practice Recording \(Candidate Controlled\)/i)).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    // Delete recording
    fireEvent.click(screen.getByText('Delete'));
    expect(screen.queryByText(/Local Practice Recording \(Candidate Controlled\)/i)).not.toBeInTheDocument();
  });

  // 8. Consent withdrawal
  it('8. Consent withdrawal: prevents session start when required consent is unchecked in Company Mode', () => {
    const onStart = vi.fn();
    render(<InterviewConfigModal roles={mockRoles} onStart={onStart} isStarting={false} />);

    // Switch to Company Mode
    fireEvent.click(screen.getByText(/Company Interview Mode/i));

    // Uncheck informed consent
    const consentCheckbox = screen.getByRole('checkbox', { name: /Informed Consent/i });
    fireEvent.click(consentCheckbox);

    // Attempt submit
    fireEvent.click(screen.getByText('Begin Company Interview'));

    // Verify start was blocked with error message
    expect(onStart).not.toHaveBeenCalled();
    expect(screen.getByText(/Company Interview Mode requires explicit consent/i)).toBeInTheDocument();
  });

  // 9. Final report display
  it('9. Final report display: renders learning-oriented readiness level, dimensions, and separate confirmed vs uncertain events', () => {
    const mockReport = {
      session_id: "report-sess-123",
      mode: "company",
      role_name: "Python Full Stack",
      experience_level: "Mid-Level (2-5 yrs)",
      overall_score: 84,
      performance_tier: "Advanced Mastery - Outstanding conceptual depth and articulation",
      dimension_scores: {
        "Technical Knowledge": 88,
        "Problem Solving": 85,
        "Communication & Cadence": 82,
        "Relevance & STAR Depth": 81
      },
      strengths: ["Clear architectural decoupling", "Effective database index explanation"],
      areas_for_growth: ["Elaborate on multi-region failovers"],
      learning_roadmap: [
        { stage: "Phase 1: Delivery", action: "Practice STAR formatting" }
      ],
      question_evaluations: [
        {
          question_id: "py-1",
          question_title: "Compare FastAPI and Django",
          overall_score: 84,
          transcript: "FastAPI is async-first with Pydantic validation.",
          spoken_feedback: "Very accurate comparison."
        }
      ],
      integrity_summary: {
        mode: "company",
        confirmed_technical_events: {
          tab_switches_count: 1,
          total_tab_switch_duration_seconds: 3.5,
          camera_disconnects: 0,
          face_not_detected_intervals: 0,
          multiple_faces_detected_count: 0
        },
        uncertain_observations: {
          gaze_or_head_direction_shifts: 2
        },
        neutral_disclaimer: "All logged items represent environment stability metrics with candidate consent."
      }
    };

    render(<FinalReportModal report={mockReport} onRestart={vi.fn()} />);

    expect(screen.getByText(/Advanced Mastery - Outstanding conceptual depth and articulation/i)).toBeInTheDocument();
    expect(screen.getByText(/Technical Knowledge/i)).toBeInTheDocument();
    expect(screen.getByText('88%')).toBeInTheDocument();
    expect(screen.getByText(/Confirmed Technical Events/i)).toBeInTheDocument();
    expect(screen.getByText(/Uncertain Observations \(Natural Cognitive Shifts\)/i)).toBeInTheDocument();
    expect(screen.getByText(/2 occurrences/i)).toBeInTheDocument();
  });

});
