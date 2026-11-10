import pytest
import time
from fastapi.testclient import TestClient
from app.main import app
from app.services.security_service import secure_assess_db
from app.services.auth_service import create_access_token

client = TestClient(app)

def test_organization_registration_and_branding():
    # 1. Register a new tenant organization (e.g. Acme Tech)
    payload = {
        "name": "Acme Technologies",
        "slug": f"acme-tech-{int(time.time())}",
        "contact_email": "admin@acmetech.io",
        "industry": "Fintech & Cloud",
        "branding": {
            "primary_color": "#0F172A",
            "accent_color": "#10B981",
            "logo_url": "https://acme.io/logo.png",
            "portal_name": "Acme Voice Assessment Suite"
        },
        "settings": {
            "allowed_domains": ["acmetech.io"],
            "default_retention_days": 60,
            "enforce_strict_proctoring": True,
            "allow_practice_mode": True,
            "ai_interviewer_voice": "Nalini"
        }
    }

    res = client.post("/api/tenants/register", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "created"
    org = data["organization"]
    assert org["name"] == "Acme Technologies"
    assert org["branding"]["primary_color"] == "#0F172A"
    assert org["branding"]["portal_name"] == "Acme Voice Assessment Suite"

    # Public branding lookup by slug
    pub_res = client.get(f"/api/tenants/public/{payload['slug']}")
    assert pub_res.status_code == 200
    pub_data = pub_res.json()
    assert pub_data["portal_name"] == "Acme Voice Assessment Suite"

def test_multi_tenant_recruiter_auth_and_provisioning():
    # Setup test org
    org_slug = f"globex-{int(time.time())}"
    org = secure_assess_db.create_organization({
        "name": "Globex Corp",
        "slug": org_slug,
        "contact_email": "admin@globex.com"
    })
    org_id = org["org_id"]

    # Provision org admin
    admin_data = secure_assess_db.register_recruiter({
        "email": f"hr.lead@{org_slug}.com",
        "password": "StrongPassword123!",
        "name": "Hank Scorpio",
        "role": "org_admin",
        "org_id": org_id
    })
    assert admin_data["role"] == "org_admin"
    assert admin_data["org_id"] == org_id

    # Recruiter login
    login_res = client.post("/api/auth/recruiter-login", json={
        "email": f"hr.lead@{org_slug}.com",
        "password": "StrongPassword123!"
    })
    assert login_res.status_code == 200
    auth_data = login_res.json()
    assert auth_data["role"] == "org_admin"
    assert auth_data["org_id"] == org_id
    token = auth_data["token"]

    # Admin invites / provisions new recruiter
    recruiter_res = client.post(
        "/api/tenants/recruiters/invite",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "email": f"interviewer@{org_slug}.com",
            "password": "InterviewerPass123!",
            "name": "Junior Recruiter",
            "org_id": org_id,
            "role": "recruiter"
        }
    )
    assert recruiter_res.status_code == 200
    new_rec = recruiter_res.json()["recruiter"]
    assert new_rec["org_id"] == org_id

    # List recruiters
    list_rec = client.get(
        "/api/tenants/recruiters",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert list_rec.status_code == 200
    assert len(list_rec.json()["recruiters"]) >= 2

def test_tenant_data_isolation_cross_tenant_access_blocked():
    # Create Tenant Alpha and Tenant Beta
    alpha_org = secure_assess_db.create_organization({
        "name": "Alpha Corp",
        "slug": f"alpha-{int(time.time())}",
        "contact_email": "alpha@example.com"
    })
    beta_org = secure_assess_db.create_organization({
        "name": "Beta Corp",
        "slug": f"beta-{int(time.time())}",
        "contact_email": "beta@example.com"
    })

    # Register Candidate in Alpha
    alpha_candidate = secure_assess_db.register_candidate({
        "candidate_id": f"cand_alpha_{int(time.time())}",
        "name": "Alice Alpha",
        "email": f"alice@{alpha_org['slug']}.com",
        "phone": "+1999888777",
        "org_id": alpha_org["org_id"]
    })

    # Create Alpha Session with Report
    alpha_session_id = f"sess_alpha_{int(time.time())}"
    secure_assess_db.create_or_update_session_record({
        "session_id": alpha_session_id,
        "candidate_id": alpha_candidate["candidate_id"],
        "candidate_name": "Alice Alpha",
        "candidate_email": f"alice@{alpha_org['slug']}.com",
        "role_id": "python-fullstack",
        "role_title": "Python Architect",
        "mode": "company",
        "attendance_status": "PRESENT",
        "interview_status": "COMPLETED",
        "overall_score": 92,
        "org_id": alpha_org["org_id"],
        "final_report": {
            "session_id": alpha_session_id,
            "mode": "company",
            "role_name": "Python Architect",
            "experience_level": "Mid-Level",
            "overall_score": 92,
            "performance_tier": "Strong Hire",
            "feedback_summary": "Excellent system design and Python internals.",
            "dimension_scores": {"Technical Knowledge": 95, "Problem Solving": 90, "Communication": 90, "Architecture & Scaling": 92},
            "strengths": ["Clear communication", "Deep concurrency knowledge"],
            "areas_for_growth": ["Microservices testing"],
            "learning_roadmap": [],
            "question_evaluations": [],
            "integrity_summary": {
                "total_events": 0,
                "confirmed_technical_events": 0,
                "uncertain_observations": 0
            }
        }
    })

    # Tokens for Alpha Recruiter and Beta Recruiter
    alpha_token = create_access_token("rec_alpha", "rec@alpha.com", "recruiter", org_id=alpha_org["org_id"])
    beta_token = create_access_token("rec_beta", "rec@beta.com", "recruiter", org_id=beta_org["org_id"])

    # 1. Candidate List Isolation
    alpha_cand_res = client.get("/api/candidates", headers={"Authorization": f"Bearer {alpha_token}"})
    assert alpha_cand_res.status_code == 200
    alpha_cands = alpha_cand_res.json()["candidates"]
    assert any(c["candidate_id"] == alpha_candidate["candidate_id"] for c in alpha_cands)

    beta_cand_res = client.get("/api/candidates", headers={"Authorization": f"Bearer {beta_token}"})
    assert beta_cand_res.status_code == 200
    beta_cands = beta_cand_res.json()["candidates"]
    # Alice must NOT appear in Beta's candidate list!
    assert not any(c["candidate_id"] == alpha_candidate["candidate_id"] for c in beta_cands)

    # 2. Candidate Profile IDOR Protection
    beta_profile_res = client.get(
        f"/api/candidate/{alpha_candidate['candidate_id']}",
        headers={"Authorization": f"Bearer {beta_token}"}
    )
    # Beta cannot access Alpha's candidate profile
    assert beta_profile_res.status_code in (403, 404)

    # 3. Candidate Report Cross-Tenant Protection
    beta_report_res = client.get(
        f"/api/session/{alpha_session_id}/report",
        headers={"Authorization": f"Bearer {beta_token}"}
    )
    # Cross-tenant report access must be blocked with 403 Forbidden!
    assert beta_report_res.status_code == 403
    assert "another organization" in beta_report_res.json()["detail"].lower()

    # Alpha CAN access its own candidate's report
    alpha_report_res = client.get(
        f"/api/session/{alpha_session_id}/report",
        headers={"Authorization": f"Bearer {alpha_token}"}
    )
    assert alpha_report_res.status_code == 200
    assert alpha_report_res.json()["overall_score"] == 92

def test_organization_suspension_enforcement():
    # Setup test org
    slug = f"temp-suspend-{int(time.time())}"
    org = secure_assess_db.create_organization({
        "name": "Temporary Org",
        "slug": slug,
        "contact_email": "admin@temporary.io"
    })
    org_id = org["org_id"]

    recruiter = secure_assess_db.register_recruiter({
        "email": f"admin@{slug}.io",
        "password": "ValidPassword999!",
        "name": "Temp Admin",
        "role": "org_admin",
        "org_id": org_id
    })

    # Platform Admin suspends this tenant
    plat_token = create_access_token("super_1", "super@gnani.ai", "platform_admin", org_id="system")
    suspend_res = client.put(
        "/api/platform/organization/status",
        headers={"Authorization": f"Bearer {plat_token}"},
        json={
            "org_id": org_id,
            "is_active": False,
            "reason": "Billing delinquency check"
        }
    )
    assert suspend_res.status_code == 200
    assert suspend_res.json()["organization"]["is_active"] is False

    # Recruiter login attempt must be rejected
    fail_login = client.post("/api/auth/recruiter-login", json={
        "email": f"admin@{slug}.io",
        "password": "ValidPassword999!"
    })
    assert fail_login.status_code == 403
    assert "suspended" in fail_login.json()["detail"].lower()

    # Public branding endpoint rejects inactive tenant
    pub_res = client.get(f"/api/tenants/public/{slug}")
    assert pub_res.status_code == 403

def test_platform_administrator_metrics_and_permissions():
    plat_token = create_access_token("super_1", "super@gnani.ai", "platform_admin", org_id="system")
    rec_token = create_access_token("rec_1", "rec@tenant.com", "recruiter", org_id="org_default")

    # Non-superadmin cannot access platform metrics
    forbidden_res = client.get("/api/platform/metrics", headers={"Authorization": f"Bearer {rec_token}"})
    assert forbidden_res.status_code == 403

    # Platform admin accesses aggregate metrics
    plat_res = client.get("/api/platform/metrics", headers={"Authorization": f"Bearer {plat_token}"})
    assert plat_res.status_code == 200
    data = plat_res.json()
    assert "total_tenants" in data
    assert "active_tenants" in data
    assert data["platform_status"] == "operational"
    # Never exposes candidate names or video URLs in platform metrics
    assert "candidate_name" not in str(data)

def test_tenant_custom_job_roles():
    org = secure_assess_db.create_organization({
        "name": "Custom Roles Org",
        "slug": f"roles-org-{int(time.time())}",
        "contact_email": "hr@roles.org"
    })
    token = create_access_token("rec_roles", "hr@roles.org", "org_admin", org_id=org["org_id"])

    # Create custom role
    create_role_res = client.post(
        "/api/tenants/roles",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "role_id": "ai-ethics-engineer",
            "title": "AI Ethics & Safety Engineer",
            "department": "Trust & Safety",
            "experience_level": "Senior (5+ yrs)",
            "required_skills": ["Model Alignment", "Safety Guardrails", "Bias Auditing"],
            "target_questions": 4,
            "interview_duration_minutes": 20
        }
    )
    assert create_role_res.status_code == 200
    role_out = create_role_res.json()["role"]
    assert role_out["title"] == "AI Ethics & Safety Engineer"
    assert "Model Alignment" in role_out["required_skills"]

    # Retrieve roles for this tenant
    list_roles_res = client.get("/api/tenants/roles", headers={"Authorization": f"Bearer {token}"})
    assert list_roles_res.status_code == 200
    role_titles = [r["title"] for r in list_roles_res.json()["roles"]]
    assert "AI Ethics & Safety Engineer" in role_titles
