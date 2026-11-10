import pytest
from unittest.mock import patch, AsyncMock
from app.services.audio_converter import generate_dummy_wav
from fastapi.testclient import TestClient
import httpx
from app.main import app
from app.services.evaluator import evaluator
from app.config import settings

client = TestClient(app)

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "service" in data
    assert data["version"] in ["2.0.0", "2.1.0"]

def test_roles_endpoint():
    response = client.get("/api/roles")
    assert response.status_code == 200
    roles = response.json()
    assert len(roles) >= 7
    role_ids = [r["id"] for r in roles]
    assert "java-dev" in role_ids
    assert "python-fullstack" in role_ids
    assert "mern-stack" in role_ids
    assert "frontend-dev" in role_ids
    assert "backend-dev" in role_ids
    assert "data-analyst" in role_ids
    assert "software-eng" in role_ids

def test_session_creation_and_flow():
    config_payload = {
        "role_id": "python-fullstack",
        "role_name": "Python Full Stack",
        "tech_stack": ["FastAPI", "React", "PostgreSQL"],
        "custom_skills": ["Docker"],
        "experience_level": "Mid-Level (2-5 yrs)",
        "difficulty": "Adaptive",
        "target_questions": 2,
        "language": "en-IN",
        "integrity_consent": True
    }

    # Mock Timbre TTS so start_session can synthesize the question prompt
    mock_tts_response = httpx.Response(
        status_code=200,
        content=b"RIFF_TEST_VOICE_PROMPT"
    )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_tts_response

        response = client.post("/api/session/start", json=config_payload)
        assert response.status_code == 200
        data = response.json()
        assert "session_id" in data
        assert data["total_questions"] == 2
        assert "question" in data
        assert data["question"]["id"].startswith("py-")
        session_id = data["session_id"]

        # Log an objective integrity event
        log_res = client.post("/api/session/log-integrity", json={
            "session_id": session_id,
            "event_type": "tab_hidden",
            "detail": "Browser tab switched to background"
        })
        assert log_res.status_code == 200

def test_session_answer_submission_and_report_generation():
    # 1. Create a session
    config_payload = {
        "mode": "practice",
        "role_id": "java-dev",
        "role_name": "Java Developer",
        "tech_stack": ["Java", "Spring Boot"],
        "custom_skills": ["Microservices"],
        "experience_level": "Junior (0-2 yrs)",
        "difficulty": "Easy",
        "target_questions": 1,
        "language": "en-IN",
        "integrity_consent": True
    }

    mock_tts_response = httpx.Response(status_code=200, content=b"RIFF_AUDIO")
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_tts_response
        start_res = client.post("/api/session/start", json=config_payload)
        session_id = start_res.json()["session_id"]
        question_id = start_res.json()["question"]["id"]

    # 2. Answer question with real STT transcript mock
    candidate_speech = (
        "In Java, the JVM splits heap memory into Young Generation and Old Generation. "
        "Minor GC runs on the Young Generation using G1GC, avoiding stop-the-world pauses."
    )
    mock_stt_response = httpx.Response(
        status_code=200,
        json={"success": True, "transcript": candidate_speech, "detected_language_code": "en-IN"}
    )

    dummy_audio = generate_dummy_wav(duration_s=0.5)

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.side_effect = [mock_stt_response, mock_tts_response, mock_tts_response]
        from app.services.gnani_stt import gnani_stt
        from app.services.gnani_tts import gnani_tts
        gnani_stt.api_key = "valid_key"
        gnani_tts.api_key = "valid_key"

        ans_res = client.post(
            "/api/session/answer",
            data={
                "session_id": session_id,
                "question_id": question_id,
                "language": "en-IN"
            },
            files={"audio": ("answer.webm", dummy_audio, "audio/webm")}
        )

        assert ans_res.status_code == 200
        ans_data = ans_res.json()
        assert ans_data["session_status"] == "COMPLETED"
        assert ans_data["evaluation"]["transcript"] == candidate_speech
        assert ans_data["evaluation"]["overall_score"] > 60

    # 3. Retrieve final comprehensive report
    report_res = client.get(f"/api/session/{session_id}/report")
    assert report_res.status_code == 200
    report = report_res.json()
    assert report["session_id"] == session_id
    assert report["overall_score"] > 0
    assert "performance_tier" in report
    assert "dimension_scores" in report
    assert "learning_roadmap" in report
    assert "integrity_summary" in report
    assert len(report["question_evaluations"]) == 1

def test_failed_stt_blocks_evaluation_in_session():
    """Confirms that failed STT prevents progression and throws error."""
    config_payload = {
        "role_id": "mern-stack",
        "role_name": "MERN Stack",
        "tech_stack": ["React", "Node.js"],
        "custom_skills": [],
        "experience_level": "Senior (5+ yrs)",
        "difficulty": "Hard",
        "target_questions": 2,
        "language": "en-IN",
        "integrity_consent": True
    }

    mock_tts = httpx.Response(status_code=200, content=b"RIFF_AUDIO")
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_tts
        start_res = client.post("/api/session/start", json=config_payload)
        session_id = start_res.json()["session_id"]
        question_id = start_res.json()["question"]["id"]

    mock_stt_fail = httpx.Response(status_code=500, text="Internal STT Server Error")
    dummy_audio = generate_dummy_wav(duration_s=0.5)

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_stt_fail
        from app.services.gnani_stt import gnani_stt
        gnani_stt.api_key = "valid_key"

        ans_res = client.post(
            "/api/session/answer",
            data={
                "session_id": session_id,
                "question_id": question_id,
                "language": "en-IN"
            },
            files={"audio": ("answer.webm", dummy_audio, "audio/webm")}
        )
        assert ans_res.status_code == 502
        assert "Gnani Prisma STT transcription failed" in ans_res.json()["detail"]
