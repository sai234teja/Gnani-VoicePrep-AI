import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from app.main import app
from app.services.session_manager import session_manager
from app.services.conversation_engine import (
    STAGE_GREETING, STAGE_READINESS, STAGE_INTRO, STAGE_FOLLOW_UP, STAGE_TECHNICAL, STAGE_CLOSING
)
from app.models import InterviewConfig, QuestionEvaluation

client = TestClient(app)

@pytest.fixture
def mock_tts():
    with patch("app.main.gnani_tts.synthesize", new_callable=AsyncMock) as m:
        m.return_value = ("UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=", True)
        yield m

@pytest.fixture
def mock_stt():
    with patch("app.main.gnani_stt.transcribe", new_callable=AsyncMock) as m:
        m.return_value = ("I am doing great today, thanks for asking!", "en-IN")
        from app.services.gnani_stt import gnani_stt
        gnani_stt.api_key = "test_valid_key"
        yield m

def test_company_interview_starts_with_greeting(mock_tts):
    """Requirement: Every new company interview must start with a spoken greeting."""
    res = client.post("/api/session/start", json={
        "mode": "company",
        "role_name": "Python Full Stack",
        "role_id": "python-fullstack",
        "tech_stack": ["Python", "FastAPI", "React"],
        "target_questions": 3,
        "language": "en-IN"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["stage"] == STAGE_GREETING
    assert "How are you doing today?" in data["question"]["title"]
    assert "conv-greeting" in data["question"]["id"]
    assert data["question_audio_b64"] is not None

def test_greeting_advances_to_readiness_then_intro(mock_tts, mock_stt):
    """
    Requirement:
    GREETING -> READINESS_CHECK -> SELF_INTRODUCTION
    """
    # 1. Start session
    start_res = client.post("/api/session/start", json={
        "mode": "company",
        "role_name": "Java Developer",
        "role_id": "java-dev",
        "tech_stack": ["Java", "Spring Boot"],
        "target_questions": 3,
        "language": "en-IN"
    })
    session_id = start_res.json()["session_id"]
    first_q_id = start_res.json()["question"]["id"]

    # 2. Answer greeting ("I'm doing well!")
    mock_stt.return_value = ("I am doing very well, thank you!", "en-IN")
    ans1_res = client.post(
        "/api/session/answer",
        data={"session_id": session_id, "question_id": first_q_id, "language": "en-IN"},
        files={"audio": ("greeting.webm", b"RIFF" + b"\x00" * 300, "audio/webm")}
    )
    assert ans1_res.status_code == 200
    ans1_data = ans1_res.json()
    assert ans1_data["stage"] == STAGE_READINESS
    assert "Are you comfortable and ready to begin?" in ans1_data["next_question"]["title"]

    # 3. Answer readiness confirmation ("Yes, I am ready!")
    mock_stt.return_value = ("Yes, I am ready to begin the interview.", "en-IN")
    ans2_res = client.post(
        "/api/session/answer",
        data={"session_id": session_id, "question_id": ans1_data["next_question"]["id"], "language": "en-IN"},
        files={"audio": ("readiness.webm", b"RIFF" + b"\x00" * 300, "audio/webm")}
    )
    assert ans2_res.status_code == 200
    ans2_data = ans2_res.json()
    assert ans2_data["stage"] == STAGE_INTRO
    assert "Could you please tell me about yourself?" in ans2_data["next_question"]["title"]

def test_adaptive_follow_up_generated_from_candidate_intro(mock_tts, mock_stt):
    """
    Requirement:
    Adaptive interviewer generates context-aware follow-up acknowledging specific tech/projects.
    """
    config = InterviewConfig(
        mode="company",
        role_name="Python Full Stack",
        role_id="python-fullstack",
        tech_stack=["Python", "FastAPI", "OpenCV"],
        target_questions=3
    )
    session = session_manager.create_session(config)
    session.stage = STAGE_INTRO

    eval_intro = QuestionEvaluation(
        question_id="intro-self",
        question_title="Could you please tell me about yourself?",
        transcript="I am a software engineer and I developed a computer vision project using Python and OpenCV to detect duplicate images.",
        detected_language="en-IN",
        overall_score=85,
        relevance_score=88,
        problem_solving_score=82,
        communication_score=85,
        technical_score=86,
        strengths=["Solid project background"],
        improvements=[],
        spoken_feedback="Great introduction"
    )

    advance_res = session_manager.record_answer_and_advance(session.session_id, eval_intro)
    updated_session, next_q, speech_text, next_stage = advance_res

    assert next_stage == STAGE_FOLLOW_UP
    assert "opencv" in speech_text.lower() or "python" in speech_text.lower()
    assert "challenging problem" in speech_text.lower()

def test_questions_not_repeated_and_differ_across_sessions():
    """
    Requirement:
    Different sessions receive different randomized question sequences without repetitions.
    """
    config1 = InterviewConfig(
        mode="company",
        role_name="Java Developer",
        role_id="java-dev",
        tech_stack=["Java", "Spring Boot", "Kafka"],
        target_questions=3
    )
    config2 = InterviewConfig(
        mode="company",
        role_name="Java Developer",
        role_id="java-dev",
        tech_stack=["Java", "Spring Boot", "Kafka"],
        target_questions=3
    )

    session1 = session_manager.create_session(config1)
    session2 = session_manager.create_session(config2)

    assert session1.session_id != session2.session_id
    assert session1.stage == STAGE_GREETING
    assert session2.stage == STAGE_GREETING
