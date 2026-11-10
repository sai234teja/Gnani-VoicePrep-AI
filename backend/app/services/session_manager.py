import time
import uuid
import random
from typing import Dict, Optional, List
from app.models import (
    InterviewConfig, SessionState, QuestionItem, QuestionEvaluation, 
    FinalReport, IntegrityEvent
)
from app.data.interview_bank import get_questions_for_role, get_role_metadata, get_intro_question, QUESTION_BANK
from app.services.conversation_engine import (
    conversation_engine, STAGE_GREETING, STAGE_TECHNICAL, STAGE_CLOSING
)

class SessionManager:
    """
    Manages live interview sessions with distinct:
    - PRACTICE MODE: camera/mic optional, local replay/delete, learning labels.
    - COMPANY INTERVIEW MODE: automated hands-free flow, mandatory self-introduction first,
      randomized role question bank without repetition, adaptive follow-ups, pause on disconnect,
      evidence-based candidate evaluation.
    """
    def __init__(self):
        self._sessions: Dict[str, SessionState] = {}

    def create_session(self, config: InterviewConfig) -> SessionState:
        session_id = str(uuid.uuid4())

        # Normalize config fields across camelCase / snake_case
        if not config.role_name:
            if config.role and isinstance(config.role, dict):
                config.role_name = config.role.get("title") or config.role.get("name") or "Software Engineer"
            else:
                meta = get_role_metadata(config.role_id)
                config.role_name = (meta.get("title") or meta.get("name")) if meta else "Software Engineer"

        if not config.tech_stack:
            config.tech_stack = config.techStack or []

        if not config.experience_level:
            config.experience_level = config.experienceLevel or "Mid-Level (2-5 yrs)"

        if not config.target_questions:
            config.target_questions = config.targetQuestions or 3

        if not config.interview_duration_minutes:
            config.interview_duration_minutes = config.interviewDurationMinutes or 15

        if not config.distribution_ratio:
            config.distribution_ratio = config.distributionRatio or "balanced"

        # Create session state with Adaptive Conversation Engine opening stage
        initial_stage = STAGE_GREETING if config.mode == "company" else STAGE_TECHNICAL
        
        # Temporary placeholder question to instantiate state
        dummy_q = QuestionItem(
            id="temp-init",
            role_id=config.role_id,
            category="conversation",
            difficulty="easy",
            title="Initializing interview...",
            context="System initializing",
            key_points=[]
        )

        state = SessionState(
            session_id=session_id,
            config=config,
            status="IN_PROGRESS",
            stage=initial_stage,
            current_index=1,
            total_questions=config.target_questions,
            current_question=dummy_q,
            history=[],
            integrity_events=[],
            asked_question_ids=[],
            topics_covered=[],
            follow_up_count=0,
            created_at=time.time()
        )

        initial_q, initial_speech = conversation_engine.create_initial_item(state)
        state.current_question = initial_q
        state.asked_question_ids.append(initial_q.id)

        self._sessions[session_id] = state

        # Persist session and attendance in SQLite
        try:
            from app.services.security_service import secure_assess_db
            secure_assess_db.create_or_update_session_record({
                "session_id": session_id,
                "candidate_id": config.candidate_id or "candidate_self",
                "candidate_name": config.candidate_name or "Anonymous Candidate",
                "candidate_email": config.candidate_email or "candidate@example.com",
                "role_id": config.role_id,
                "role_title": config.role_name,
                "mode": config.mode,
                "attendance_status": "PRESENT",
                "interview_status": "IN_PROGRESS",
                "org_id": config.org_id or "org_default"
            })
        except Exception as e:
            print(f"[SessionManager] SQLite persistence warning: {e}")

        return state

    def get_session(self, session_id: str) -> Optional[SessionState]:
        return self._sessions.get(session_id)

    def get_all_sessions(self) -> List[SessionState]:
        return list(self._sessions.values())

    def get_dashboard_metrics(self) -> Dict[str, Any]:
        sessions = list(self._sessions.values())
        total_sessions = len(sessions)
        completed = [s for s in sessions if s.status == "COMPLETED"]
        in_progress = [s for s in sessions if s.status == "IN_PROGRESS"]

        scores = []
        for s in completed:
            if s.history:
                avg_s = sum(e.overall_score for e in s.history) / len(s.history)
                scores.append(avg_s)

        avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0

        return {
            "total_candidates": total_sessions,
            "completed_interviews": len(completed),
            "pending_interviews": len(in_progress),
            "average_benchmark_score": avg_score,
            "has_real_sessions": total_sessions > 0
        }

    def pause_session_for_disconnection(self, session_id: str, reason: str = "Hardware stream disconnected") -> bool:
        session = self.get_session(session_id)
        if not session:
            return False
        session.status = "PAUSED_DISCONNECTED"
        self.log_integrity_event(
            session_id=session_id,
            category="confirmed_technical_event",
            event_type="camera_disconnected",
            detail=f"Interview paused: {reason}",
            duration_seconds=0.0
        )
        return True

    def resume_session(self, session_id: str) -> bool:
        session = self.get_session(session_id)
        if not session:
            return False
        session.status = "IN_PROGRESS"
        self.log_integrity_event(
            session_id=session_id,
            category="confirmed_technical_event",
            event_type="stream_resumed",
            detail="Media stream restored. Candidate resumed assessment.",
            duration_seconds=0.0
        )
        return True

    def emergency_exit_session(self, session_id: str, reason: str = "Candidate activated emergency stop") -> bool:
        session = self.get_session(session_id)
        if not session:
            return False
        session.status = "EMERGENCY_EXIT"
        self.log_integrity_event(
            session_id=session_id,
            category="confirmed_technical_event",
            event_type="emergency_exit",
            detail=reason,
            duration_seconds=0.0
        )
        return True

    def log_integrity_event(
        self, 
        session_id: str, 
        category: str,
        event_type: str, 
        detail: str,
        duration_seconds: float = 0.0
    ) -> bool:
        session = self.get_session(session_id)
        if not session:
            return False
        
        elapsed = round(time.time() - session.created_at, 1)
        evidence_level = "objective_metric" if category == "confirmed_technical_event" else "uncertain_observation"

        event = IntegrityEvent(
            timestamp_seconds=elapsed,
            duration_seconds=duration_seconds,
            category=category,
            event_type=event_type,
            detail=detail,
            evidence_level=evidence_level
        )
        session.integrity_events.append(event)
        return True

    def record_answer_and_advance(
        self, 
        session_id: str, 
        evaluation: QuestionEvaluation
    ) -> Optional[Tuple[SessionState, Optional[QuestionItem], str, str]]:
        session = self.get_session(session_id)
        if not session:
            return None

        session.history.append(evaluation)

        # Advance through Adaptive Conversation Engine
        next_item, speech_text, next_stage = conversation_engine.process_and_get_next(
            session=session,
            latest_transcript=evaluation.transcript,
            evaluation=evaluation
        )

        # Count evaluative questions
        eval_count = len([e for e in session.history if e.category != "conversation"])
        session.current_index = eval_count + 1

        if next_stage == STAGE_CLOSING or (session.config.mode == "practice" and eval_count >= session.total_questions):
            session.status = "COMPLETED"

        return session, next_item, speech_text, next_stage

    def generate_final_report(self, session_id: str) -> Optional[FinalReport]:
        session = self.get_session(session_id)
        if not session or not session.history:
            return None

        evals = session.history
        count = len(evals)

        avg_overall = int(sum(e.overall_score for e in evals) / count)
        avg_tech = int(sum(e.technical_score for e in evals) / count)
        avg_problem = int(sum(e.problem_solving_score for e in evals) / count)
        avg_comm = int(sum(e.communication_score for e in evals) / count)
        avg_relevance = int(sum(e.relevance_score for e in evals) / count)
        avg_project = int(sum(getattr(e, "project_explanation_score", 75) for e in evals) / count)

        # Learning & mastery tiers (No automatic cheating or hiring verdict)
        if avg_overall >= 85:
            tier = "Advanced Mastery - Outstanding conceptual depth and articulation"
        elif avg_overall >= 70:
            tier = "Proficient Practitioner - Strong foundational grasp with minor refinements"
        elif avg_overall >= 55:
            tier = "Developing Competency - Good progress; focus on structured technical examples"
        else:
            tier = "Foundational Stage - Needs targeted practice on core concepts and clarity"

        all_strengths = []
        for e in evals:
            all_strengths.extend(e.strengths)
        unique_strengths = list(dict.fromkeys(all_strengths))[:4]

        all_improvements = []
        for e in evals:
            all_improvements.extend(e.improvements)
        unique_improvements = list(dict.fromkeys(all_improvements))[:4]

        roadmap = self._generate_roadmap(session.config.role_id, unique_improvements)

        # Candidate introduction summary from question 1 (if available)
        candidate_intro = None
        first_eval = evals[0] if evals else None
        if first_eval and ("intro" in first_eval.question_id or "introduction" in first_eval.question_title.lower()):
            candidate_intro = first_eval.transcript
        elif first_eval:
            candidate_intro = f"Candidate commenced assessment with initial response: '{first_eval.transcript[:150]}...'"

        evaluator_comments = (
            f"Candidate completed {count} structured interview rounds for {session.config.role_name} "
            f"({session.config.experience_level}). Demonstrated strong responsiveness with an overall benchmark "
            f"of {avg_overall}/100. Core technical and problem-solving evaluations are grounded in candidate transcripts."
        )

        # Separate Confirmed Technical Events from Uncertain Observations
        confirmed_events = [ev for ev in session.integrity_events if ev.category == "confirmed_technical_event"]
        uncertain_obs = [ev for ev in session.integrity_events if ev.category == "uncertain_observation"]

        total_tab_time = sum(ev.duration_seconds for ev in confirmed_events if ev.event_type == "tab_hidden")
        total_face_loss_time = sum(ev.duration_seconds for ev in confirmed_events if ev.event_type == "face_missing")

        integrity_summary = {
            "mode": session.config.mode,
            "integrity_monitoring_enabled": session.config.integrity_consent,
            "recording_stored_remotely": session.config.store_recording_consent,
            "confirmed_technical_events": {
                "tab_switches_count": sum(1 for ev in confirmed_events if ev.event_type == "tab_hidden"),
                "total_tab_switch_duration_seconds": round(total_tab_time, 1),
                "camera_disconnects": sum(1 for ev in confirmed_events if ev.event_type == "camera_disconnected"),
                "face_not_detected_intervals": sum(1 for ev in confirmed_events if ev.event_type == "face_missing"),
                "total_face_missing_duration_seconds": round(total_face_loss_time, 1),
                "multiple_faces_detected_count": sum(1 for ev in confirmed_events if ev.event_type == "multiple_faces")
            },
            "uncertain_observations": {
                "gaze_or_head_direction_shifts": sum(1 for ev in uncertain_obs if ev.event_type == "gaze_offset"),
                "interpretation_note": "Gaze and head shifts are natural cognitive actions and are NEVER treated as proof of dishonesty."
            },
            "neutral_disclaimer": "All logged items represent environment stability metrics with candidate consent. No automated cheating verdicts or external device detections are claimed.",
            "detailed_timeline": [
                {
                    "time": f"{int(ev.timestamp_seconds // 60):02d}:{int(ev.timestamp_seconds % 60):02d}",
                    "category": "Confirmed Technical Event" if ev.category == "confirmed_technical_event" else "Uncertain Observation",
                    "event_type": ev.event_type,
                    "duration": f"{round(ev.duration_seconds, 1)}s" if ev.duration_seconds > 0 else "Instant",
                    "detail": ev.detail
                } for ev in session.integrity_events
            ]
        }

        # Synthesize Evidence Breakdown for Phase 10
        all_matched_concepts = []
        for e in session.history:
            all_matched_concepts.extend(getattr(e, "extracted_concepts", []))
        unique_concepts = list(dict.fromkeys(all_matched_concepts))

        evidence_breakdown = {
            "verified_concepts": unique_concepts,
            "transcripts_evaluated_count": len(session.history),
            "scoring_rationale": "Evaluated with role-calibrated rubric. Technical ability is weighted independently of conversational cadence."
        }

        unassessed = []
        assessed_categories = {e.category for e in session.history}
        if "problem_solving" not in assessed_categories:
            unassessed.append("Deep Algorithmic / Distributed Concurrency Trade-offs")
        if "behavioural" not in assessed_categories:
            unassessed.append("Cross-functional Stakeholder Conflict Resolution")

        recommended_topics = [
            f"Next round recommendation: Explore {session.config.role_name} system reliability under high load.",
            f"Probe candidate's practical experience with {unique_concepts[0] if unique_concepts else 'framework fundamentals'} in enterprise microservices."
        ]

        # Build Evidence-based suggested improved answers
        suggested_improved_answers = []
        for e in evals:
            if e.category != "conversation":
                model_ans = (
                    f"For '{e.question_title}', a high-scoring answer starts with a crisp definition, "
                    f"quantifies trade-offs (e.g. latency, throughput), and explains failure recovery."
                )
                suggested_improved_answers.append({
                    "question_title": e.question_title,
                    "what_went_well": e.strengths[0] if e.strengths else "Direct prompt address",
                    "what_was_missing": e.improvements[0] if e.improvements else "Detailed metric quantification",
                    "suggested_structure": model_ans
                })

        # Targeted Next Practice Plan derived from lowest-scoring competency
        lowest_dimension = "Technical Architecture"
        if avg_tech < avg_comm and avg_tech < avg_problem:
            lowest_dimension = f"Core Technical Concepts ({session.config.role_name})"
        elif avg_comm < avg_tech and avg_comm < avg_problem:
            lowest_dimension = "Executive Presence & Cadence"
        else:
            lowest_dimension = "Problem-Solving Trade-Offs"

        targeted_plan = {
            "recommended_focus": lowest_dimension,
            "target_role": session.config.role_name,
            "recommended_topics": unique_improvements[:3] if unique_improvements else ["System Trade-Offs"],
            "recommended_difficulty": "Intermediate" if avg_overall >= 65 else "Foundational",
            "suggested_duration_minutes": 15
        }

        report = FinalReport(
            session_id=session.session_id,
            mode=session.config.mode,
            role_name=session.config.role_name,
            experience_level=session.config.experience_level,
            overall_score=avg_overall,
            performance_tier=tier,
            dimension_scores={
                "Technical Knowledge": avg_tech,
                "Problem Solving": avg_problem,
                "Communication & Cadence": avg_comm,
                "Relevance & STAR Depth": avg_relevance,
                "Project Explanation": avg_project
            },
            strengths=unique_strengths,
            areas_for_growth=unique_improvements,
            learning_roadmap=roadmap,
            question_evaluations=session.history,
            integrity_summary=integrity_summary,
            candidate_intro_summary=candidate_intro,
            evaluator_comments=evaluator_comments,
            evidence_breakdown=evidence_breakdown,
            unassessed_competencies=unassessed,
            recommended_next_topics=recommended_topics,
            targeted_next_practice_plan=targeted_plan,
            suggested_improved_answers=suggested_improved_answers,
            evaluation_confidence="High (Grounded in Candidate Transcripts)"
        )

        # Update candidate practice memory in SQLite if candidate session
        if session.config.candidate_id and session.config.mode == "practice":
            try:
                from app.services.security_service import secure_assess_db
                secure_assess_db.update_candidate_practice_memory(
                    candidate_id=session.config.candidate_id,
                    new_score=avg_overall,
                    tech_score=avg_tech,
                    comm_score=avg_comm,
                    strengths=unique_strengths,
                    improvements=unique_improvements,
                    recommended_topics=targeted_plan["recommended_topics"]
                )
            except Exception as mem_err:
                print(f"[SessionManager] Practice memory update note: {mem_err}")

        # Persist completion and report to SQLite
        try:
            from app.services.security_service import secure_assess_db
            secure_assess_db.create_or_update_session_record({
                "session_id": session.session_id,
                "interview_status": "COMPLETED",
                "attendance_status": "PRESENT",
                "overall_score": avg_overall,
                "completed_at": time.time(),
                "evaluations": [e.dict() for e in session.history],
                "final_report": report.dict(),
                "org_id": session.config.org_id or "org_default"
            })

            # Meter completed interview and duration
            try:
                from app.services.billing_service import billing_service
                org_id = session.config.org_id or "org_default"
                duration_mins = max(1.0, round((time.time() - session.start_time) / 60.0, 1))
                
                # 1. Completed interview count
                billing_service.record_usage(
                    org_id=org_id,
                    metric_type="interview_completed",
                    quantity=1.0,
                    unit="count",
                    idempotency_key=f"interview_completed_{session.session_id}",
                    reference_id=session.session_id
                )
                # 2. Interview minutes
                billing_service.record_usage(
                    org_id=org_id,
                    metric_type="interview_minutes",
                    quantity=duration_mins,
                    unit="minutes",
                    idempotency_key=f"interview_minutes_{session.session_id}",
                    reference_id=session.session_id
                )
            except Exception as be:
                print(f"[SessionManager] Billing meter warning: {be}")

            # Trigger interview.completed & report.generated webhooks
            try:
                from app.services.integration_service import integration_service
                org_id = session.config.org_id or "org_default"
                integration_service.enqueue_webhook_event(
                    org_id=org_id,
                    event_type="interview.completed",
                    payload_data={
                        "session_id": session.session_id,
                        "candidate_id": session.config.candidate_id,
                        "overall_score": avg_overall,
                        "completed_at": time.time()
                    }
                )
                integration_service.enqueue_webhook_event(
                    org_id=org_id,
                    event_type="report.generated",
                    payload_data={
                        "session_id": session.session_id,
                        "candidate_id": session.config.candidate_id,
                        "overall_score": avg_overall,
                        "technical_score": report.technical_score,
                        "communication_score": report.communication_score,
                        "problem_solving_score": report.problem_solving_score
                    }
                )
            except Exception as whe:
                print(f"[SessionManager] Webhook enqueue warning: {whe}")
        except Exception as e:
            print(f"[SessionManager] Completion persistence warning: {e}")

        return report

    def _select_initial_question(self, pool: List[QuestionItem], difficulty_pref: str) -> QuestionItem:
        if difficulty_pref.lower() == "easy":
            candidates = [q for q in pool if q.difficulty == "easy"]
        elif difficulty_pref.lower() == "hard":
            candidates = [q for q in pool if q.difficulty == "hard"]
        else:
            candidates = [q for q in pool if q.difficulty == "medium"]

        return candidates[0] if candidates else pool[0]

    def _select_next_adaptive_question(self, session: SessionState, previous_score: int) -> QuestionItem:
        asked_ids = {e.question_id for e in session.history}
        pool = get_questions_for_role(session.config.role_id)
        remaining = [q for q in pool if q.id not in asked_ids]

        if not remaining:
            remaining = [q for q in QUESTION_BANK if q.id not in asked_ids and q.category != "self_introduction"]

        # Deterministic fallback if entire bank exhausted
        if not remaining:
            return pool[0]

        # Respect distribution preference if set
        dist = getattr(session.config, "distribution_ratio", "balanced")
        if dist == "technical_heavy":
            tech_candidates = [q for q in remaining if q.category in ("technical_knowledge", "problem_solving", "project_experience")]
            if tech_candidates:
                remaining = tech_candidates
        elif dist == "hr_heavy":
            hr_candidates = [q for q in remaining if q.category in ("behavioural", "hr", "scenario_based")]
            if hr_candidates:
                remaining = hr_candidates

        # Adaptive difficulty filtering
        if session.config.difficulty.lower() == "adaptive":
            if previous_score >= 80:
                preferred = [q for q in remaining if q.difficulty == "hard"]
            elif previous_score <= 60:
                preferred = [q for q in remaining if q.difficulty == "easy"]
            else:
                preferred = [q for q in remaining if q.difficulty == "medium"]

            if preferred:
                # Randomize among suitable candidates to avoid predictable sequence
                return random.choice(preferred)

        # Randomize selection among remaining without repetition
        return random.choice(remaining)

    def _generate_roadmap(self, role_id: str, improvements: List[str]) -> List[Dict[str, str]]:
        roadmap = [
            {
                "stage": "Phase 1: Delivery & Structure (Week 1)",
                "action": "Practice STAR framing (Situation, Task, Action, Result) aloud. Record 60-second summaries without placeholder filler words."
            },
            {
                "stage": "Phase 2: Architectural & Engineering Depth (Weeks 2-3)",
                "action": f"Deep dive into high-availability trade-offs for {role_id.replace('-', ' ').title()}. Quantify throughput, latency reductions, and edge failure modes."
            },
            {
                "stage": "Phase 3: Live Mock Interview Loops (Week 4)",
                "action": "Complete timed 20-minute simulations with rapid-fire follow-ups to sharpen pacing and clarity."
            }
        ]
        return roadmap

    def terminate_session_inactivity(self, session_id: str, inactivity_duration: float, reason: str = "Inactivity timeout exceeded") -> bool:
        """Terminates session when candidate remains silent after reminders."""
        session = self.get_session(session_id)
        if not session:
            return False
        session.status = "TERMINATED_INACTIVITY"
        try:
            from app.services.security_service import secure_assess_db
            secure_assess_db.create_or_update_session_record({
                "session_id": session_id,
                "interview_status": "TERMINATED_INACTIVITY",
                "termination_reason": reason,
                "inactivity_duration_seconds": inactivity_duration,
                "completed_at": time.time()
            })
        except Exception as e:
            print(f"[SessionManager] Inactivity termination persistence warning: {e}")
        return True

session_manager = SessionManager()
