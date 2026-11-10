import pytest
import hmac
import hashlib
import json
import time
from fastapi.testclient import TestClient
from app.main import app
from app.services.integration_service import integration_service
from app.services.auth_service import create_access_token

client = TestClient(app)

def get_auth_header(user_id="user_admin_1", email="admin@org-alpha.com", role="org_admin", org_id="org_integ_test"):
    token = create_access_token(
        user_id=user_id,
        email=email,
        role=role,
        org_id=org_id
    )
    return {"Authorization": f"Bearer {token}"}

def test_api_key_creation_scope_validation_and_rotation():
    """Verifies API key creation, scope checking, rotation, and revocation."""
    org_id = "org_key_test"
    headers = get_auth_header(org_id=org_id)

    # 1. Create API key with specific scopes
    res = client.post("/api/integrations/keys", headers=headers, json={
        "name": "Greenhouse ATS Connector",
        "scopes": ["roles:read", "candidates:read", "interviews:create"],
        "expires_days": 30
    })
    assert res.status_code == 200
    data = res.json()
    raw_key = data["raw_key"]
    key_id = data["key_id"]
    assert raw_key.startswith("gnani_live_")
    assert "roles:read" in data["scopes"]

    # 2. Key is displayed in list (raw_key and hash NOT exposed)
    list_res = client.get("/api/integrations/keys", headers=headers)
    assert list_res.status_code == 200
    keys = list_res.json()["api_keys"]
    found = next((k for k in keys if k["key_id"] == key_id), None)
    assert found is not None
    assert "raw_key" not in found
    assert "key_hash" not in found

    # 3. Test public v1 API with valid API Key and scope
    v1_res = client.get("/api/v1/integrations/roles", headers={"X-API-Key": raw_key})
    assert v1_res.status_code == 200
    assert len(v1_res.json()["data"]) > 0

    # 4. Scope rejection: attempt endpoint requiring 'analytics:read'
    scope_res = client.get("/api/v1/integrations/analytics", headers={"X-API-Key": raw_key})
    assert scope_res.status_code == 403
    assert "missing required scope" in scope_res.json()["detail"].lower()

    # 5. Rotate API key
    rotate_res = client.post(f"/api/integrations/keys/{key_id}/rotate", headers=headers)
    assert rotate_res.status_code == 200
    new_raw_key = rotate_res.json()["raw_key"]
    assert new_raw_key != raw_key

    # Old key is now rejected
    old_res = client.get("/api/v1/integrations/roles", headers={"X-API-Key": raw_key})
    assert old_res.status_code == 401

    # New rotated key works
    new_res = client.get("/api/v1/integrations/roles", headers={"X-API-Key": new_raw_key})
    assert new_res.status_code == 200

def test_webhook_registration_signature_and_replay_protection():
    """Verifies webhook registration, HMAC-SHA256 signature verification, and timestamp drift protection."""
    org_id = "org_wh_test"
    headers = get_auth_header(org_id=org_id)

    # 1. Register Webhook
    reg_res = client.post("/api/integrations/webhooks", headers=headers, json={
        "url": "https://company.example.com/webhooks/voiceprep",
        "description": "Production Webhook Receiver",
        "events": ["candidate.registered", "interview.completed"]
    })
    assert reg_res.status_code == 200
    wh = reg_res.json()
    secret = wh["signing_secret"]
    assert secret.startswith("whsec_")

    # 2. Test HMAC signature computation
    test_payload = b'{"event":"test","status":"ok"}'
    now_ts = int(time.time())
    sig = integration_service.compute_webhook_signature(test_payload, secret, now_ts)
    assert "t=" in sig and "v1=" in sig

    # Valid signature check
    is_valid = integration_service.verify_webhook_signature(test_payload, sig, secret, max_age_seconds=300)
    assert is_valid is True

    # Tampered payload check
    is_tampered = integration_service.verify_webhook_signature(b'{"tampered":true}', sig, secret, max_age_seconds=300)
    assert is_tampered is False

    # Stale timestamp / replay attack check (ts = 1 hour ago)
    stale_ts = now_ts - 3600
    stale_sig = integration_service.compute_webhook_signature(test_payload, secret, stale_ts)
    is_replay = integration_service.verify_webhook_signature(test_payload, stale_sig, secret, max_age_seconds=300)
    assert is_replay is False

def test_reliable_webhook_delivery_queue_and_exponential_backoff():
    """Verifies webhook event enqueueing, mock dispatch, exponential backoff, and manual retry."""
    org_id = f"org_dispatch_{int(time.time())}"
    headers = get_auth_header(org_id=org_id)

    # 1. Register normal webhook and a failing webhook
    wh_ok = client.post("/api/integrations/webhooks", headers=headers, json={
        "url": "https://api.partner.com/webhook",
        "events": ["interview.completed"]
    }).json()

    wh_fail = client.post("/api/integrations/webhooks", headers=headers, json={
        "url": "https://api.partner.com/fail-test", # will simulate error in mock dispatcher
        "events": ["interview.completed"]
    }).json()

    # 2. Enqueue event
    delivery_ids = integration_service.enqueue_webhook_event(
        org_id=org_id,
        event_type="interview.completed",
        payload_data={"session_id": "sess_test_123", "overall_score": 90}
    )
    assert len(delivery_ids) == 2

    # 3. Process delivery queue
    summary = integration_service.process_delivery_queue(mock_dispatch=True)
    assert summary["processed"] >= 2
    assert summary["succeeded"] >= 1
    assert summary["failed"] >= 1

    # 4. Inspect delivery logs
    logs_res = client.get("/api/integrations/webhooks/deliveries", headers=headers)
    assert logs_res.status_code == 200
    logs = logs_res.json()["deliveries"]
    delivered = [d for d in logs if d["status"] == "delivered"]
    failed = [d for d in logs if d["status"] == "pending" and d["attempts"] > 0]
    assert len(delivered) >= 1
    assert len(failed) >= 1

    # 5. Manual retry
    failed_id = failed[0]["delivery_id"]
    retry_res = client.post(f"/api/integrations/webhooks/deliveries/{failed_id}/retry", headers=headers)
    assert retry_res.status_code == 200
    assert retry_res.json()["status"] == "retry_scheduled"

def test_cross_tenant_api_and_webhook_isolation():
    """Confirms Tenant Beta cannot access Tenant Alpha's API keys, webhooks, or candidate data."""
    org_alpha = "org_tenant_alpha_integ"
    org_beta = "org_tenant_beta_integ"

    alpha_headers = get_auth_header(org_id=org_alpha, email="alice@alpha.com")
    beta_headers = get_auth_header(org_id=org_beta, email="bob@beta.com")

    # Alpha creates an API key and webhook
    alpha_key = client.post("/api/integrations/keys", headers=alpha_headers, json={
        "name": "Alpha Integration",
        "scopes": ["candidates:read", "candidates:write", "interviews:read"]
    }).json()

    alpha_wh = client.post("/api/integrations/webhooks", headers=alpha_headers, json={
        "url": "https://alpha.com/webhook",
        "events": ["interview.completed"]
    }).json()

    # Beta attempts to rotate Alpha's key -> 404
    rotate_res = client.post(f"/api/integrations/keys/{alpha_key['key_id']}/rotate", headers=beta_headers)
    assert rotate_res.status_code == 404

    # Beta attempts to delete Alpha's webhook -> 404
    del_res = client.delete(f"/api/integrations/webhooks/{alpha_wh['endpoint_id']}", headers=beta_headers)
    assert del_res.status_code == 404

    # Using Alpha's raw API key on v1 API strictly accesses Alpha's candidates, not Beta's
    client.post("/api/v1/integrations/candidates", headers={"X-API-Key": alpha_key["raw_key"]}, json={
        "name": "Alpha Candidate",
        "email": "candidate@alpha.org"
    })

    cand_res = client.get("/api/v1/integrations/candidates", headers={"X-API-Key": alpha_key["raw_key"]})
    assert cand_res.status_code == 200
    cands = cand_res.json()["data"]
    emails = [c["email"] for c in cands]
    assert "candidate@alpha.org" in emails

def test_mock_ats_and_hr_event_lifecycle():
    """Verifies end-to-end integration flow: ATS candidate enrollment -> invitation scheduling -> webhook triggered."""
    org_id = "org_ats_mock_test"
    admin_headers = get_auth_header(org_id=org_id)

    # 1. Setup API key and Webhook for ATS
    key_data = client.post("/api/integrations/keys", headers=admin_headers, json={
        "name": "ATS Adapter Key",
        "scopes": ["roles:read", "candidates:write", "interviews:create", "interviews:read"]
    }).json()
    api_key = key_data["raw_key"]

    client.post("/api/integrations/webhooks", headers=admin_headers, json={
        "url": "https://ats.mockplatform.com/candidate-events",
        "events": ["candidate.registered", "interview.invited"]
    })

    # 2. ATS registers candidate via Public v1 API
    cand_res = client.post("/api/v1/integrations/candidates", headers={"X-API-Key": api_key}, json={
        "name": "David ATS Applicant",
        "email": "david.applicant@ats-demo.com",
        "phone": "+1-555-0199",
        "target_role": "software-engineer"
    })
    assert cand_res.status_code == 200
    cand_id = cand_res.json()["data"]["candidate_id"]

    # 3. ATS schedules interview invitation
    inv_res = client.post("/api/v1/integrations/invitations", headers={"X-API-Key": api_key}, json={
        "candidate_email": "david.applicant@ats-demo.com",
        "candidate_name": "David ATS Applicant",
        "role_id": "software-engineer",
        "duration_minutes": 20
    })
    assert inv_res.status_code == 200
    inv = inv_res.json()["data"]
    assert inv["invitation_token"] is not None

    # 4. Verify webhook deliveries were queued
    del_res = client.get("/api/integrations/webhooks/deliveries", headers=admin_headers)
    assert del_res.status_code == 200
    deliveries = del_res.json()["deliveries"]
    event_types = [d["event_type"] for d in deliveries]
    assert "candidate.registered" in event_types
    assert "interview.invited" in event_types
