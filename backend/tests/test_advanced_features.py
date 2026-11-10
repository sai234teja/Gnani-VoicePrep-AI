import pytest
from unittest.mock import patch, AsyncMock
from app.services.audio_converter import generate_dummy_wav
from fastapi.testclient import TestClient
import httpx
from app.main import app
from app.services.secure_storage import secure_recording_manager

client = TestClient(app)

def test_practice_mode_session_creation():
    payload = {
        "mode": "practice",
        "role_id": "python-fullstack",
        "role_name": "Python Full Stack",
        "tech_stack": ["FastAPI", "React"],
        "custom_skills": ["Docker"],
        "experience_level": "Junior (0-2 yrs)",
        "difficulty": "Easy",
        "target_questions": 2,
        "language": "en-IN",
        "camera_enabled": False,
        "microphone_enabled": True,
        "integrity_consent": False
    }

    mock_tts = httpx.Response(status_code=200, content=b"RIFF_AUDIO")
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_tts
        res = client.post("/api/session/start", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["mode"] == "practice"
        assert "session_id" in data

def test_company_mode_session_pause_resume_emergency_exit():
    payload = {
        "mode": "company",
        "role_id": "backend-dev",
        "role_name": "Backend Developer",
        "tech_stack": ["SQL", "Redis"],
        "custom_skills": [],
        "experience_level": "Mid-Level (2-5 yrs)",
        "difficulty": "Medium",
        "target_questions": 2,
        "language": "en-IN",
        "camera_enabled": True,
        "microphone_enabled": True,
        "integrity_consent": True,
        "store_recording_consent": True
    }

    mock_tts = httpx.Response(status_code=200, content=b"RIFF_AUDIO")
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_tts
        start_res = client.post("/api/session/start", json=payload)
        assert start_res.status_code == 200
        start_data = start_res.json()
        session_id = start_data["session_id"]
        # Verify first question in Company Mode is conversational greeting
        assert start_data["question"]["id"] == "conv-greeting"
        assert "how are you doing today" in start_data["question"]["title"].lower()

        # Pause on hardware disconnect
        pause_res = client.post("/api/session/pause", json={"session_id": session_id})
        assert pause_res.status_code == 200
        assert pause_res.json()["status"] == "paused"

        # Resume stream
        resume_res = client.post("/api/session/resume", json={"session_id": session_id})
        assert resume_res.status_code == 200
        assert resume_res.json()["status"] == "resumed"

        # Emergency exit
        exit_res = client.post("/api/session/emergency-exit", json={"session_id": session_id, "reason": "Test exit"})
        assert exit_res.status_code == 200
        assert exit_res.json()["status"] == "exited"

def test_integrity_logging_confirmed_vs_uncertain():
    payload = {
        "mode": "company",
        "role_id": "java-dev",
        "role_name": "Java Developer",
        "tech_stack": ["Java"],
        "experience_level": "Junior (0-2 yrs)",
        "difficulty": "Easy",
        "target_questions": 1,
        "language": "en-IN",
        "integrity_consent": True
    }

    mock_tts = httpx.Response(status_code=200, content=b"RIFF_AUDIO")
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_tts
        start_res = client.post("/api/session/start", json=payload)
        session_id = start_res.json()["session_id"]
        q_id = start_res.json()["question"]["id"]

        # 1. Log confirmed technical event (tab switch)
        res1 = client.post("/api/session/log-integrity", json={
            "session_id": session_id,
            "category": "confirmed_technical_event",
            "event_type": "tab_hidden",
            "detail": "Tab switched",
            "duration_seconds": 4.5
        })
        assert res1.status_code == 200

        # 2. Log uncertain observation (gaze shift)
        res2 = client.post("/api/session/log-integrity", json={
            "session_id": session_id,
            "category": "uncertain_observation",
            "event_type": "gaze_offset",
            "detail": "Gaze shifted right",
            "duration_seconds": 0.0
        })
        assert res2.status_code == 200

        # Submit answer
        dummy_audio = generate_dummy_wav(duration_s=0.5)
        mock_stt = httpx.Response(status_code=200, json={
            "success": True,
            "transcript": "In Java we use garbage collection with G1GC to manage heap memory.",
            "detected_language_code": "en-IN"
        })
        mock_post.side_effect = [mock_stt, mock_tts]
        from app.services.gnani_stt import gnani_stt
        from app.services.gnani_tts import gnani_tts
        gnani_stt.api_key = "valid_test_key"
        gnani_tts.api_key = "valid_test_key"

        ans_res = client.post(
            "/api/session/answer",
            data={"session_id": session_id, "question_id": q_id, "language": "en-IN"},
            files={"audio": ("ans.webm", dummy_audio, "audio/webm")}
        )
        assert ans_res.status_code == 200

        # Fetch report
        rep_res = client.get(f"/api/session/{session_id}/report")
        assert rep_res.status_code == 200
        summary = rep_res.json()["integrity_summary"]
        assert summary["confirmed_technical_events"]["tab_switches_count"] == 1
        assert summary["confirmed_technical_events"]["total_tab_switch_duration_seconds"] == 4.5
        assert summary["uncertain_observations"]["gaze_or_head_direction_shifts"] == 1
        assert "neutral_disclaimer" in summary

def test_encrypted_recording_storage_and_deletion():
    dummy_video_bytes = b"RIFF_FAKE_WEBM_VIDEO_DATA" * 50

    # 1. Save encrypted recording with consent
    meta = secure_recording_manager.save_recording(
        session_id="session_test_123",
        raw_bytes=dummy_video_bytes,
        interview_mode="company",
        consent_given=True
    )
    assert meta.is_encrypted is True
    assert meta.byte_size > 0

    # 2. Decrypt as authorized reviewer
    decrypted = secure_recording_manager.read_decrypted_recording(meta.recording_id, requester_role="assigned_recruiter")
    assert decrypted == dummy_video_bytes

    # 3. Access denied for unauthorized role
    with pytest.raises(PermissionError):
        secure_recording_manager.read_decrypted_recording(meta.recording_id, requester_role="unauthorized_guest")

    # 4. Candidate delete
    deleted = secure_recording_manager.delete_recording(meta.recording_id, candidate_or_admin_id="candidate_self")
    assert deleted is True

    # 5. Without consent should raise ValueError
    with pytest.raises(ValueError):
        secure_recording_manager.save_recording(
            session_id="session_test_123",
            raw_bytes=dummy_video_bytes,
            consent_given=False
        )

def test_controlled_live_test_safeguards():
    # 1. Unconfirmed request rejected
    res = client.post("/api/admin/controlled-live-test", json={"confirm_live_api_call": False})
    assert res.status_code == 400
    assert "confirm_live_api_call must be set to true" in res.json()["detail"]

    # 2. Confirmed request with no key skips gracefully without fabricating data
    from app.services.gnani_tts import gnani_tts
    old_key = gnani_tts.api_key
    gnani_tts.api_key = ""
    res = client.post("/api/admin/controlled-live-test", json={"confirm_live_api_call": True, "service": "tts"})
    assert res.status_code == 200
    data = res.json()
    assert data["live_test_executed"] is False
    assert data["status"] == "skipped_no_key"
    gnani_tts.api_key = old_key
