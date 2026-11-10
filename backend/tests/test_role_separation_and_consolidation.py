import pytest
import time
from fastapi.testclient import TestClient
from app.main import app
from app.services.auth_service import create_access_token

client = TestClient(app)

def test_candidate_registration_and_login():
    """Verify self-service candidate registration, token issuance, and authenticated profile access."""
    import time
    ts = int(time.time() * 1000)
    email = f"priya.candidate_{ts}@test.com"
    reg_payload = {
        "email": email,
        "password": "SecurePassword123!",
        "full_name": "Priya Test Candidate",
        "phone": "+91 9998887777",
        "target_role": "Full Stack Developer",
        "target_experience": "Mid-Level"
    }

    # Register candidate
    reg_res = client.post("/api/auth/candidate-register", json=reg_payload)
    assert reg_res.status_code == 200, reg_res.text
    reg_data = reg_res.json()
    assert reg_data["status"] == "registered"
    assert reg_data["role"] == "candidate"
    token = reg_data["token"]
    assert token is not None

    # Retrieve candidate self profile
    me_res = client.get("/api/candidate/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["candidate"]["email"] == email
    assert me_data["candidate"]["full_name"] == "Priya Test Candidate"

    # Login candidate
    login_res = client.post("/api/auth/candidate-login", json={
        "email": email,
        "password": "SecurePassword123!"
    })
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert login_data["role"] == "candidate"

def test_candidate_learning_insights_and_practice_history():
    """Verify candidate learning insights and practice history endpoints."""
    # Seeded demo candidate
    cand_token = create_access_token(
        user_id="cand_demo_01",
        email="candidate@example.com",
        role="candidate",
        org_id="candidate_personal"
    )

    insights_res = client.get("/api/candidate/learning-insights", headers={"Authorization": f"Bearer {cand_token}"})
    assert insights_res.status_code == 200
    insights = insights_res.json()
    assert "profile" in insights
    assert "strengths" in insights["profile"]
    assert len(insights["profile"]["strengths"]) > 0

    history_res = client.get("/api/candidate/practice-history", headers={"Authorization": f"Bearer {cand_token}"})
    assert history_res.status_code == 200
    assert "history" in history_res.json()

def test_role_enforcement_candidate_cannot_access_recruiter_endpoints():
    """Verify that candidates are strictly blocked (403) from accessing recruiter dashboards and candidate directories."""
    cand_token = create_access_token(
        user_id="cand_demo_01",
        email="candidate@example.com",
        role="candidate",
        org_id="candidate_personal"
    )

    headers = {"Authorization": f"Bearer {cand_token}"}

    # 1. Candidate accessing talent dashboard metrics
    metrics_res = client.get("/api/dashboard/metrics", headers=headers)
    assert metrics_res.status_code == 403
    assert "Recruiter credentials required" in metrics_res.json()["detail"]

    # 2. Candidate accessing candidate list
    candidates_res = client.get("/api/candidates", headers=headers)
    assert candidates_res.status_code == 403
    assert "Recruiter credentials required" in candidates_res.json()["detail"]

    # 3. Candidate accessing audit trail
    audit_res = client.get("/api/security/audit-trail", headers=headers)
    assert audit_res.status_code == 403

def test_role_enforcement_recruiter_cannot_access_org_admin_or_candidate_endpoints():
    """Verify that standard recruiters cannot access org admin settings or candidate-specific practice portals."""
    recruiter_token = create_access_token(
        user_id="recruiter_02",
        email="staff.recruiter@example.com",
        role="recruiter",
        org_id="org_default"
    )
    headers = {"Authorization": f"Bearer {recruiter_token}"}

    # Recruiter attempting candidate-only practice self profile
    cand_me_res = client.get("/api/candidate/me", headers=headers)
    assert cand_me_res.status_code == 403
    assert "Candidate account required" in cand_me_res.json()["detail"]

    # Recruiter attempting org-admin recruiter provisioning
    invite_res = client.post("/api/tenants/recruiters/invite", json={
        "name": "New Staff",
        "email": "new.staff@example.com",
        "role": "recruiter"
    }, headers=headers)
    assert invite_res.status_code == 403
    assert "Organization administrator role required" in invite_res.json()["detail"]

def test_company_assessment_report_sanitization_for_candidates():
    """Verify that company-mode reports viewed by candidates sanitize recruiter rubrics and evaluator notes."""
    # Start a mock session in company mode
    cand_token = create_access_token(
        user_id="cand_demo_01",
        email="candidate@example.com",
        role="candidate",
        org_id="candidate_personal"
    )
    cand_headers = {"Authorization": f"Bearer {cand_token}"}

    recruiter_token = create_access_token(
        user_id="recruiter_01",
        email="lead.recruiter@example.com",
        role="recruiter",
        org_id="org_default"
    )
    recruiter_headers = {"Authorization": f"Bearer {recruiter_token}"}

    # Start session via existing session manager API
    from app.services.session_manager import session_manager
    from app.models import InterviewConfig

    dummy_session_id = f"sess_priv_{int(time.time() * 1000)}"
    cfg = InterviewConfig(
        mode="company",
        role_id="frontend-dev",
        role_name="Frontend Developer",
        tech_stack=["React", "TypeScript"],
        experience_level="Mid-Level",
        difficulty="Intermediate",
        target_questions=1,
        language="en-IN",
        candidate_id="cand_demo_01",
        candidate_name="Priya Sharma"
    )
    sess = session_manager.create_session(cfg)
    dummy_session_id = sess.session_id
    # Add dummy evaluation to session history
    from app.models import QuestionEvaluation
    sess.history.append(
        QuestionEvaluation(
            question_id="q1",
            question_title="Explain React reconciliation",
            category="technical_knowledge",
            transcript="Reconciliation uses a virtual DOM diff algorithm.",
            detected_language="en-IN",
            overall_score=85,
            relevance_score=85,
            problem_solving_score=80,
            communication_score=85,
            technical_score=90,
            strengths=["Accurate Virtual DOM definition"],
            improvements=["Mention fiber architecture"],
            spoken_feedback="Internal recruiter scoring: Candidate showed 90% technical accuracy on fiber."
        )
    )

    # 1. Candidate fetches company report -> spoken_feedback sanitized, evaluator_comments sanitized
    cand_report_res = client.get(f"/api/session/{dummy_session_id}/report", headers=cand_headers)
    assert cand_report_res.status_code == 200
    cand_report = cand_report_res.json()
    assert "submitted to the recruitment team" in cand_report["evaluator_comments"]
    assert "Internal recruiter scoring" not in cand_report["question_evaluations"][0]["spoken_feedback"]

    # 2. Recruiter fetches company report -> full internal feedback and evaluation visible
    rec_report_res = client.get(f"/api/session/{dummy_session_id}/report", headers=recruiter_headers)
    assert rec_report_res.status_code == 200
    rec_report = rec_report_res.json()
    assert "Internal recruiter scoring" in rec_report["question_evaluations"][0]["spoken_feedback"]
