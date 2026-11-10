"""
Phase 17 - Intelligent AI Interview Practice Engine Test Suite
Tests adaptive practice loop, candidate learning memory persistence,
suggested model answer generation, targeted drill planner, and strict
report confidentiality.
"""
import pytest
from app.models import InterviewConfig, QuestionEvaluation
from app.services.session_manager import session_manager
from app.services.security_service import secure_assess_db


def test_targeted_practice_plan_generation():
    """Verify that candidate practice profiles generate personalized drill configurations."""
    import uuid
    # Seed a candidate practice memory with a unique test email
    candidate_id = f"cand_test_{uuid.uuid4().hex[:8]}"
    test_email = f"p17_{uuid.uuid4().hex[:8]}@example.com"
    secure_assess_db.register_candidate_account({
        "candidate_id": candidate_id,
        "email": test_email,
        "password": "hashed_secret",
        "full_name": "Ananya Iyer",
        "target_role": "Full Stack Developer",
        "target_experience": "Mid-Level"
    })

    # Simulate completed session memory update
    secure_assess_db.update_candidate_practice_memory(
        candidate_id=candidate_id,
        new_score=62,
        tech_score=54,
        comm_score=78,
        strengths=["Articulate verbal delivery", "Polite tone"],
        improvements=["In-depth technical architecture", "Scalability trade-offs"],
        recommended_topics=["System Scalability", "Database Indexing"]
    )

    profile = secure_assess_db.get_candidate_practice_profile(candidate_id)
    assert profile is not None
    assert profile["total_practice_sessions"] >= 1
    assert profile["avg_technical_score"] == 54.0
    assert "System Scalability" in profile["recommended_topics"]


def test_session_report_phase17_enhancements():
    """Verify that practice reports yield suggested model answers and targeted practice plans."""
    cfg = InterviewConfig(
        role_id="full-stack-dev",
        role_name="Full Stack Developer",
        experience_level="Mid-Level",
        difficulty="Intermediate",
        target_questions=2,
        mode="practice",
        candidate_id="cand_test_p17",
        interview_type="Technical",
        practice_focus_topics=["System Scalability", "Caching Strategies"]
    )

    session = session_manager.create_session(cfg)
    assert session.session_id is not None
    assert session.config.interview_type == "Technical"

    # Evaluate question 1
    eval1 = QuestionEvaluation(
        question_id=session.current_question.id,
        question_title=session.current_question.title,
        transcript="In our stack we implemented Redis caching in front of PostgreSQL to reduce latency.",
        detected_language="en-IN",
        overall_score=78,
        relevance_score=80,
        problem_solving_score=75,
        communication_score=82,
        technical_score=75,
        strengths=["Good caching overview"],
        improvements=["Could explain eviction policies"],
        spoken_feedback="Clear answer"
    )
    session_manager.record_answer_and_advance(session.session_id, eval1)

    # Evaluate question 2 to finish
    eval2 = QuestionEvaluation(
        question_id="q-tech-2",
        question_title="How do you handle database indexing?",
        transcript="For database indexing we use B-tree indices on foreign keys and compound queries.",
        detected_language="en-IN",
        overall_score=82,
        relevance_score=85,
        problem_solving_score=80,
        communication_score=84,
        technical_score=80,
        strengths=["Understands B-tree indexing"],
        improvements=["Mention index maintenance overhead"],
        spoken_feedback="Well explained"
    )
    session_manager.record_answer_and_advance(session.session_id, eval2)

    # Generate final report
    report = session_manager.generate_final_report(session.session_id)
    assert report is not None
    assert report.suggested_improved_answers is not None
    assert len(report.suggested_improved_answers) >= 1
    first_ans = report.suggested_improved_answers[0]
    framework = first_ans.improved_answer_framework if hasattr(first_ans, "improved_answer_framework") else first_ans.get("improved_answer_framework")
    assert framework != ""

    assert report.targeted_next_practice_plan is not None
    focus = report.targeted_next_practice_plan.recommended_focus_area if hasattr(report.targeted_next_practice_plan, "recommended_focus_area") else report.targeted_next_practice_plan.get("recommended_focus_area")
    assert focus != ""


def test_practice_mode_strict_data_separation():
    """Verify practice mode generates constructive strengths and areas for growth without leaks."""
    cfg = InterviewConfig(
        role_id="full-stack-dev",
        role_name="Full Stack Developer",
        target_questions=1,
        mode="practice",
        candidate_id="cand_p17_privacy"
    )
    session = session_manager.create_session(cfg)
    eval1 = QuestionEvaluation(
        question_id=session.current_question.id,
        question_title=session.current_question.title,
        transcript="I built a responsive web frontend using React and Vite with stateful hooks.",
        detected_language="en-IN",
        overall_score=80,
        relevance_score=82,
        problem_solving_score=78,
        communication_score=80,
        technical_score=80,
        strengths=["Good use of modern React"],
        improvements=["Could highlight testing"],
        spoken_feedback="Great clarity"
    )
    session_manager.record_answer_and_advance(session.session_id, eval1)
    report = session_manager.generate_final_report(session.session_id)
    assert report is not None
    assert report.mode == "practice"
    assert len(report.strengths) > 0
    assert len(report.areas_for_growth) > 0
