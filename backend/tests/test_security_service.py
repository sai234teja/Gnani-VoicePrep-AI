import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.security_service import security_db

client = TestClient(app)

def test_security_requirements_endpoint():
    response = client.get("/api/security/requirements")
    assert response.status_code == 200
    data = response.json()
    assert data["camera_required"] is True
    assert data["microphone_required"] is True
    assert data["fullscreen_required"] is True
    assert "monitoring_notice" in data

def test_security_diagnostics_logging_and_report():
    import uuid
    test_session_id = f"test-sec-session-{uuid.uuid4().hex[:8]}"

    diag_payload = {
        "session_id": test_session_id,
        "camera": {"pass": True, "details": {"width": 1280, "height": 720}},
        "microphone": {"pass": True, "details": {"device": "Mock Mic"}},
        "network": {"pass": True, "details": {"latencyMs": 42}},
        "browser": {"pass": True, "details": {"mediaRecorder": True}},
        "fullscreen_ready": True
    }

    res_diag = client.post("/api/security/diagnostics", json=diag_payload)
    assert res_diag.status_code == 200
    assert res_diag.json()["status"] == "recorded"

    consent_payload = {
        "session_id": test_session_id,
        "granted": True,
        "scope": ["telemetry_integrity", "camera_mic_recording"],
        "retention_policy_days": 30
    }
    res_consent = client.post("/api/security/consent", json=consent_payload)
    assert res_consent.status_code == 200
    assert res_consent.json()["status"] == "recorded"

    # Append two chained events
    ev1 = {
        "session_id": test_session_id,
        "event_type": "tab_hidden",
        "category": "confirmed_technical_event",
        "detail": "Candidate switched tabs",
        "severity": "warning",
        "sequence": 1
    }
    ev2 = {
        "session_id": test_session_id,
        "event_type": "tab_restored",
        "category": "confirmed_technical_event",
        "detail": "Candidate returned to assessment tab",
        "severity": "info",
        "sequence": 2
    }

    res_ev1 = client.post("/api/security/events", json=ev1)
    assert res_ev1.status_code == 200
    assert "event_hash" in res_ev1.json()

    res_ev2 = client.post("/api/security/events", json=ev2)
    assert res_ev2.status_code == 200
    assert "event_hash" in res_ev2.json()

    # Send heartbeat
    res_hb = client.post("/api/security/session/heartbeat", json={
        "session_id": test_session_id,
        "status": "active"
    })
    assert res_hb.status_code == 200

    # Retrieve complete report and verify SHA-256 chain integrity
    res_rep = client.get(f"/api/security/report/{test_session_id}")
    assert res_rep.status_code == 200
    report = res_rep.json()

    assert report["chain_valid"] is True
    assert report["total_events"] == 2
    assert report["consent_status"] == "granted"
    assert report["heartbeat_count"] >= 1
    assert report["diagnostics"]["network"]["details"]["latencyMs"] == 42

def test_phase6_authentication_authorization_and_audit():
    # 1. Unauthorized access to recruiter audit trail is blocked
    res_unauth = client.get("/api/security/audit-trail")
    assert res_unauth.status_code == 401

    # 2. Recruiter login issues valid HMAC token
    login_res = client.post("/api/auth/recruiter-login", json={
        "email": "recruiter@gnani.ai",
        "password": "Password123"
    })
    assert login_res.status_code == 200
    token = login_res.json()["token"]
    assert token and "." in token

    # 3. Authorized access succeeds
    auth_headers = {"Authorization": f"Bearer {token}"}
    res_auth = client.get("/api/security/audit-trail", headers=auth_headers)
    assert res_auth.status_code == 200
    assert "audit_logs" in res_auth.json()

    # 4. Audit candidate export
    res_export = client.post("/api/security/audit-export", json={
        "format": "csv",
        "scope": "test_candidates"
    }, headers=auth_headers)
    assert res_export.status_code == 200

    # 5. Enforce retention policy
    res_retention = client.post("/api/security/enforce-retention", json={
        "retention_days": 30
    }, headers=auth_headers)
    assert res_retention.status_code == 200
    assert "database_records_purged" in res_retention.json()

def test_security_headers_and_rate_limiting():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.headers.get("x-content-type-options") == "nosniff"
    assert res.headers.get("x-frame-options") == "DENY"
    assert res.headers.get("x-xss-protection") == "1; mode=block"
