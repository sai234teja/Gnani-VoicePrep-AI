import pytest
import time
from fastapi.testclient import TestClient
from app.main import app
from app.services.security_service import secure_assess_db
from app.services.notification_service import notification_service
from app.services.auth_service import create_access_token

client = TestClient(app)

def test_invitation_creation_and_email_rendering():
    # Setup test org and recruiter
    org = secure_assess_db.create_organization({
        "name": "Acme Notification Org",
        "slug": f"acme-notif-{int(time.time())}",
        "contact_email": "admin@acmenotif.io",
        "branding": {
            "primary_color": "#1E293B",
            "accent_color": "#3B82F6",
            "portal_name": "Acme AI Interviewer"
        }
    })
    token = create_access_token("rec_notif", "admin@acmenotif.io", "org_admin", org_id=org["org_id"])
    headers = {"Authorization": f"Bearer {token}"}

    future_time = time.time() + 172800 # 48 hours later
    res = client.post(
        "/api/invitations/create",
        headers=headers,
        json={
            "candidate_name": "John Doe",
            "candidate_email": "john.doe@example.com",
            "role_id": "python-fullstack",
            "role_title": "Full Stack Architect",
            "scheduled_time": future_time,
            "duration_minutes": 25,
            "custom_notes": "Please prepare to discuss microservices.",
            "expires_in_hours": 72
        }
    )
    assert res.status_code == 200
    data = res.json()["invitation"]
    assert data["candidate_name"] == "John Doe"
    assert data["status"] in ("PENDING", "SENT")
    assert "invitation_token" in data
    assert "invitation_link" in data

    # Verify notification log queue entries
    logs_res = client.get("/api/notifications/logs", headers=headers)
    assert logs_res.status_code == 200
    logs = logs_res.json()["logs"]
    inv_logs = [l for l in logs if l["recipient_email"] == "john.doe@example.com"]
    assert len(inv_logs) >= 1
    # Check that invitation email was dispatched
    assert any(l["notification_type"] == "INVITATION" for l in inv_logs)
    # Check that 24h reminder was automatically scheduled
    assert any(l["notification_type"] == "REMINDER_24H" for l in inv_logs)

def test_token_validation_expiry_and_reuse_prevention():
    org = secure_assess_db.create_organization({
        "name": "Token Guard Org",
        "slug": f"token-guard-{int(time.time())}",
        "contact_email": "guard@token.com"
    })
    token = create_access_token("rec_guard", "guard@token.com", "recruiter", org_id=org["org_id"])
    headers = {"Authorization": f"Bearer {token}"}

    # Create invitation
    inv_res = client.post(
        "/api/invitations/create",
        headers=headers,
        json={
            "candidate_name": "Sarah Connor",
            "candidate_email": "sarah@resistance.org",
            "role_id": "frontend-dev",
            "role_title": "Frontend Lead",
            "scheduled_time": time.time() + 3600,
            "duration_minutes": 15
        }
    )
    inv = inv_res.json()["invitation"]
    inv_token = inv["invitation_token"]

    # 1. Candidate validates token
    val_res = client.get(f"/api/invitations/validate/{inv_token}")
    assert val_res.status_code == 200
    assert val_res.json()["valid"] is True
    assert val_res.json()["invitation"]["candidate_name"] == "Sarah Connor"

    # 2. Candidate consumes token by launching session
    start_res = client.post(
        f"/api/session/start?invitation_token={inv_token}",
        json={
            "mode": "company",
            "role_id": "frontend-dev",
            "target_questions": 3
        }
    )
    assert start_res.status_code == 200
    assert "session_id" in start_res.json()

    # 3. Token Reuse Prevention: Attempting to launch second session with same token MUST FAIL
    reuse_res = client.post(
        f"/api/session/start?invitation_token={inv_token}",
        json={
            "mode": "company",
            "role_id": "frontend-dev",
            "target_questions": 3
        }
    )
    assert reuse_res.status_code == 400
    assert "accepted" in reuse_res.json()["detail"].lower()

    # 4. Token validation now reports consumed
    val_after = client.get(f"/api/invitations/validate/{inv_token}")
    assert val_after.status_code == 400
    assert "accepted" in val_after.json()["detail"].lower()

def test_invitation_cancellation_and_reminder_suppression():
    org = secure_assess_db.create_organization({
        "name": "Cancel Org",
        "slug": f"cancel-org-{int(time.time())}",
        "contact_email": "cancel@org.com"
    })
    token = create_access_token("rec_cancel", "cancel@org.com", "recruiter", org_id=org["org_id"])
    headers = {"Authorization": f"Bearer {token}"}

    # Create invitation with future reminder
    inv_res = client.post(
        "/api/invitations/create",
        headers=headers,
        json={
            "candidate_name": "Bruce Wayne",
            "candidate_email": "bruce@waynecorp.com",
            "role_id": "python-fullstack",
            "role_title": "Security Architect",
            "scheduled_time": time.time() + 100000
        }
    )
    inv_id = inv_res.json()["invitation"]["invitation_id"]

    # Cancel invitation
    cancel_res = client.post(f"/api/invitations/{inv_id}/cancel", headers=headers)
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "cancelled"

    # Verify invitation status
    val_cancelled = client.get(f"/api/invitations/validate/{inv_res.json()['invitation']['invitation_token']}")
    assert val_cancelled.status_code == 400
    assert "cancelled" in val_cancelled.json()["detail"].lower()

    # Verify scheduled reminders are CANCELLED in database queue
    logs_res = client.get("/api/notifications/logs", headers=headers)
    logs = logs_res.json()["logs"]
    bruce_logs = [l for l in logs if l["recipient_email"] == "bruce@waynecorp.com"]
    # All pending jobs for Bruce must now be cancelled
    assert all(l["status"] in ("SENT", "CANCELLED") for l in bruce_logs)

def test_in_app_recruiter_notification_center():
    org = secure_assess_db.create_organization({
        "name": "InApp Org",
        "slug": f"inapp-org-{int(time.time())}",
        "contact_email": "inapp@org.com"
    })
    token = create_access_token("rec_inapp", "inapp@org.com", "recruiter", org_id=org["org_id"])
    headers = {"Authorization": f"Bearer {token}"}

    # Create invitation (which automatically generates in-app notification)
    client.post(
        "/api/invitations/create",
        headers=headers,
        json={
            "candidate_name": "Diana Prince",
            "candidate_email": "diana@themyscira.gov",
            "role_id": "mern-stack",
            "role_title": "Full Stack Lead",
            "scheduled_time": time.time() + 7200
        }
    )

    # Fetch in-app notifications
    notif_res = client.get("/api/notifications/in-app", headers=headers)
    assert notif_res.status_code == 200
    notif_data = notif_res.json()
    assert notif_data["unread_count"] >= 1
    assert len(notif_data["notifications"]) >= 1

    first_notif = notif_data["notifications"][0]
    assert "Diana Prince" in first_notif["title"]

    # Mark as read
    mark_res = client.post(
        "/api/notifications/in-app/mark-read",
        headers=headers,
        json={"mark_all": True}
    )
    assert mark_res.status_code == 200
    assert mark_res.json()["status"] == "success"

    # Verify unread count is 0
    notif_res2 = client.get("/api/notifications/in-app", headers=headers)
    assert notif_res2.json()["unread_count"] == 0

def test_tenant_isolation_on_invitations_and_notifications():
    # Tenant Alpha and Tenant Beta
    alpha_org = secure_assess_db.create_organization({
        "name": "Alpha Notif",
        "slug": f"alpha-notif-{int(time.time())}",
        "contact_email": "alpha@notif.com"
    })
    beta_org = secure_assess_db.create_organization({
        "name": "Beta Notif",
        "slug": f"beta-notif-{int(time.time())}",
        "contact_email": "beta@notif.com"
    })

    alpha_token = create_access_token("rec_alpha", "alpha@notif.com", "recruiter", org_id=alpha_org["org_id"])
    beta_token = create_access_token("rec_beta", "beta@notif.com", "recruiter", org_id=beta_org["org_id"])

    # Create Alpha invitation
    alpha_inv = client.post(
        "/api/invitations/create",
        headers={"Authorization": f"Bearer {alpha_token}"},
        json={
            "candidate_name": "Alpha Candidate",
            "candidate_email": "alpha.cand@example.com",
            "role_id": "java-dev",
            "role_title": "Java Architect",
            "scheduled_time": time.time() + 3600
        }
    ).json()["invitation"]

    # 1. Beta recruiter lists invitations -> Alpha Candidate must NOT be visible
    beta_list = client.get("/api/invitations", headers={"Authorization": f"Bearer {beta_token}"})
    assert beta_list.status_code == 200
    assert not any(i["invitation_id"] == alpha_inv["invitation_id"] for i in beta_list.json()["invitations"])

    # 2. Beta recruiter tries to cancel Alpha's invitation -> 404 forbidden
    beta_cancel = client.post(f"/api/invitations/{alpha_inv['invitation_id']}/cancel", headers={"Authorization": f"Bearer {beta_token}"})
    assert beta_cancel.status_code == 404

    # 3. Beta recruiter tries to read Alpha's notification logs -> isolated
    beta_logs = client.get("/api/notifications/logs", headers={"Authorization": f"Bearer {beta_token}"})
    assert not any(l["recipient_email"] == "alpha.cand@example.com" for l in beta_logs.json()["logs"])

