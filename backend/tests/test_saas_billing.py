import pytest
import hmac
import hashlib
import json
import time
from fastapi.testclient import TestClient
from app.main import app
from app.services.billing_service import billing_service
from app.services.auth_service import create_access_token

client = TestClient(app)

def get_auth_header(user_id="user_admin_1", email="admin@org-alpha.com", role="org_admin", org_id="org_billing_test"):
    token = create_access_token(
        user_id=user_id,
        email=email,
        role=role,
        org_id=org_id
    )
    return {"Authorization": f"Bearer {token}"}

def test_list_plans_and_platform_plan_upsert():
    """Confirms retrieving plans and superadmin plan upsert."""
    # 1. Public list plans
    res = client.get("/api/billing/plans")
    assert res.status_code == 200
    plans = res.json()["plans"]
    assert len(plans) >= 4
    plan_ids = [p["plan_id"] for p in plans]
    assert "plan_free" in plan_ids
    assert "plan_enterprise" in plan_ids

    # 2. Platform Admin can create a custom plan
    super_headers = get_auth_header(role="platform_admin", org_id="org_default")
    upsert_res = client.post("/api/billing/plans", headers=super_headers, json={
        "plan_id": "plan_custom_growth",
        "name": "Custom Growth Tier",
        "description": "Tailored for scaling unicorn startups",
        "price_cents": 29900,
        "currency": "USD",
        "billing_interval": "month",
        "monthly_interviews_limit": 500,
        "recruiters_limit": 25,
        "active_roles_limit": 50,
        "candidate_registrations_limit": 2000,
        "max_interview_duration_minutes": 60,
        "recording_storage_mb": 25000,
        "analytics_access": True,
        "advanced_intelligence": True,
        "custom_branding": True
    })
    assert upsert_res.status_code == 200
    created = upsert_res.json()["plan"]
    assert created["name"] == "Custom Growth Tier"
    assert created["monthly_interviews_limit"] == 500

    # 3. Non-superadmin is rejected
    recruiter_headers = get_auth_header(role="recruiter", org_id="org_billing_test")
    reject_res = client.post("/api/billing/plans", headers=recruiter_headers, json={"name": "Hacked Plan"})
    assert reject_res.status_code == 403

def test_tenant_subscription_provisioning_and_usage_metering():
    """Confirms auto-provisioning subscription and idempotent usage metering."""
    org_id = "org_meter_test"
    headers = get_auth_header(org_id=org_id)

    # 1. Get subscription (auto-provisions Free/Trial plan)
    sub_res = client.get("/api/billing/subscription", headers=headers)
    assert sub_res.status_code == 200
    sub = sub_res.json()["subscription"]
    assert sub["org_id"] == org_id
    assert sub["status"] in ("trialing", "active")
    assert sub["monthly_interviews_limit"] == 5

    # 2. Record metered usage with idempotency
    success1 = billing_service.record_usage(
        org_id=org_id,
        metric_type="interview_completed",
        quantity=1.0,
        idempotency_key="idemp_interview_001",
        reference_id="sess_001"
    )
    assert success1 is True

    # Duplicate call with same idempotency key must not double-count
    success2 = billing_service.record_usage(
        org_id=org_id,
        metric_type="interview_completed",
        quantity=1.0,
        idempotency_key="idemp_interview_001",
        reference_id="sess_001"
    )
    assert success2 is True

    # 3. Check usage API
    usage_res = client.get("/api/billing/usage", headers=headers)
    assert usage_res.status_code == 200
    usage_data = usage_res.json()
    assert usage_data["metrics"]["completed_interviews"] == 1
    assert usage_data["limits"]["monthly_interviews"] == 5

def test_quota_enforcement_blocks_at_limit_graceful_to_active():
    """Confirms backend blocks starting an interview once quota is exhausted."""
    org_id = "org_quota_block_test"
    headers = get_auth_header(org_id=org_id)

    # Provision Free plan (limit 5)
    billing_service.create_initial_subscription(org_id=org_id, plan_id="plan_free", is_trial=False)

    # Exhaust quota by inserting 5 completed interviews within this active period
    now_ts = time.time()
    for i in range(5):
        billing_service.record_usage(
            org_id=org_id,
            metric_type="interview_completed",
            quantity=1.0,
            idempotency_key=f"exhaust_{org_id}_{now_ts}_{i}"
        )

    # Quota check should fail
    quota = billing_service.check_quota(org_id, "start_interview")
    assert quota["allowed"] is False
    assert "quota reached" in quota["reason"].lower()

    # Attempting to start session returns 402 Payment Required
    sess_res = client.post("/api/session/start", json={
        "mode": "company",
        "role_id": "software-engineer",
        "org_id": org_id,
        "language": "en-IN"
    })
    assert sess_res.status_code == 402
    assert "quota reached" in sess_res.json()["detail"].lower()

def test_checkout_and_mock_payment_verification_and_upgrade():
    """Confirms checkout session creation, mock HMAC verification, and plan upgrade."""
    org_id = "org_checkout_test"
    admin_headers = get_auth_header(role="org_admin", org_id=org_id)

    # 1. Create checkout session for Starter plan
    checkout_res = client.post("/api/billing/checkout", headers=admin_headers, json={
        "plan_id": "plan_starter",
        "provider": "mock",
        "currency": "USD"
    })
    assert checkout_res.status_code == 200
    chk = checkout_res.json()["checkout"]
    tx_id = chk["transaction_id"]
    token = chk["mock_payment_token"]
    assert chk["amount_cents"] == 4900

    # 2. Verify payment with valid signature
    verify_res = client.post("/api/billing/verify-payment", headers=admin_headers, json={
        "transaction_id": tx_id,
        "payment_id": "pay_mock_12345",
        "signature": token,
        "provider": "mock"
    })
    assert verify_res.status_code == 200
    upgraded_sub = verify_res.json()["subscription"]
    assert upgraded_sub["plan_id"] == "plan_starter"
    assert upgraded_sub["status"] == "active"
    assert upgraded_sub["monthly_interviews_limit"] == 30

    # 3. Verify payment history is recorded
    hist_res = client.get("/api/billing/history", headers=admin_headers)
    assert hist_res.status_code == 200
    history = hist_res.json()["history"]
    assert len(history) >= 1
    assert history[0]["transaction_id"] == tx_id
    assert history[0]["status"] == "succeeded"

def test_cross_tenant_billing_isolation():
    """Confirms Tenant Beta cannot view or tamper with Tenant Alpha's billing or payment records."""
    org_alpha = "org_tenant_alpha_billing"
    org_beta = "org_tenant_beta_billing"

    alpha_headers = get_auth_header(org_id=org_alpha, email="alice@alpha.com")
    beta_headers = get_auth_header(org_id=org_beta, email="bob@beta.com")

    # Alpha creates a checkout order
    chk = client.post("/api/billing/checkout", headers=alpha_headers, json={
        "plan_id": "plan_professional",
        "provider": "mock"
    }).json()["checkout"]
    alpha_tx_id = chk["transaction_id"]

    # Beta attempts to verify Alpha's payment -> blocked
    tamper_res = client.post("/api/billing/verify-payment", headers=beta_headers, json={
        "transaction_id": alpha_tx_id,
        "payment_id": "pay_tamper",
        "signature": chk["mock_payment_token"],
        "provider": "mock"
    })
    assert tamper_res.status_code == 403
    assert "Cross-tenant" in tamper_res.json()["detail"]

    # Beta views billing history -> Alpha's transaction not present
    beta_hist = client.get("/api/billing/history", headers=beta_headers).json()["history"]
    tx_ids = [tx["transaction_id"] for tx in beta_hist]
    assert alpha_tx_id not in tx_ids

def test_webhook_signature_verification_and_failed_payment_grace_period():
    """Confirms webhook HMAC signature check, failure recording, and 7-day grace period."""
    org_id = "org_webhook_test"
    admin_headers = get_auth_header(org_id=org_id)

    # 1. Create a transaction
    chk = client.post("/api/billing/checkout", headers=admin_headers, json={
        "plan_id": "plan_starter",
        "provider": "mock"
    }).json()["checkout"]
    tx_id = chk["transaction_id"]

    # 2. Send webhook with invalid signature -> rejected 400
    invalid_res = client.post(
        "/api/billing/webhook/mock",
        headers={"x-signature": "bogus_signature"},
        content=b'{"event":"payment.failed"}'
    )
    assert invalid_res.status_code == 400

    # 3. Send valid webhook for payment.failed
    webhook_secret = "mock_webhook_secret_key"
    payload_dict = {
        "event": "payment.failed",
        "transaction_id": tx_id,
        "reason": "Card expired / insufficient funds"
    }
    payload_bytes = json.dumps(payload_dict).encode("utf-8")
    valid_sig = hmac.new(webhook_secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()

    valid_res = client.post(
        "/api/billing/webhook/mock",
        headers={"x-signature": valid_sig},
        content=payload_bytes
    )
    assert valid_res.status_code == 200
    assert valid_res.json()["status"] == "recorded_failure"

    # 4. Confirm org subscription transitioned to past_due with grace period
    sub = client.get("/api/billing/subscription", headers=admin_headers).json()["subscription"]
    assert sub["status"] == "past_due"
    assert sub["grace_period_end"] is not None
    assert sub["grace_period_end"] > time.time()
