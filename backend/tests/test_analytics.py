import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_analytics_endpoints_require_recruiter_auth():
    # 1. Unauthenticated requests should receive 401 Unauthorized
    assert client.get("/api/analytics/dashboard-summary").status_code == 401
    assert client.get("/api/analytics/roles").status_code == 401
    assert client.post("/api/analytics/compare", json={"session_ids": []}).status_code == 401
    assert client.get("/api/analytics/intelligent-insights").status_code == 401

def test_analytics_dashboard_summary_and_aggregation():
    # Login as recruiter
    login_res = client.post("/api/auth/recruiter-login", json={
        "email": "recruiter@gnani.ai",
        "password": "Password123"
    })
    assert login_res.status_code == 200
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Dashboard Summary
    res = client.get("/api/analytics/dashboard-summary", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "total_registered" in data
    assert "total_sessions" in data
    assert "completed" in data
    assert "average_score" in data
    assert "role_distribution" in data
    assert "performance_distribution" in data
    assert isinstance(data["role_distribution"], list)

def test_analytics_role_breakdown_and_filtering():
    login_res = client.post("/api/auth/recruiter-login", json={
        "email": "recruiter@gnani.ai",
        "password": "Password123"
    })
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # All roles
    res = client.get("/api/analytics/roles", headers=headers)
    assert res.status_code == 200
    roles_data = res.json().get("role_analytics", [])
    assert isinstance(roles_data, list)
    if roles_data:
        first_role = roles_data[0]
        assert "role_id" in first_role
        assert "average_score" in first_role
        assert "dimension_averages" in first_role

    # Filtered by specific role
    res_filtered = client.get("/api/analytics/roles?role_id=java-developer", headers=headers)
    assert res_filtered.status_code == 200

def test_candidate_comparison_endpoint():
    login_res = client.post("/api/auth/recruiter-login", json={
        "email": "recruiter@gnani.ai",
        "password": "Password123"
    })
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Empty payload handling
    res_empty = client.post("/api/analytics/compare", json={"session_ids": []}, headers=headers)
    assert res_empty.status_code == 200
    assert res_empty.json()["comparison"] == []

    # Get sample session from candidates endpoint with auth headers
    c_res = client.get("/api/candidates", headers=headers)
    c_data = c_res.json().get("candidates", [])
    s_ids = []
    for c in c_data:
        for s in c.get("sessions", []):
            s_ids.append(s["session_id"])
            if len(s_ids) >= 2:
                break
        if len(s_ids) >= 2:
            break

    if s_ids:
        res_comp = client.post("/api/analytics/compare", json={"session_ids": s_ids}, headers=headers)
        assert res_comp.status_code == 200
        comp_data = res_comp.json().get("comparison", [])
        assert len(comp_data) >= 1
        first = comp_data[0]
        assert "name" in first
        assert "dimension_scores" in first
        assert "strengths" in first

def test_intelligent_insights_generation():
    login_res = client.post("/api/auth/recruiter-login", json={
        "email": "recruiter@gnani.ai",
        "password": "Password123"
    })
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/analytics/intelligent-insights", headers=headers)
    assert res.status_code == 200
    insights = res.json()
    assert "top_candidate_strengths" in insights
    assert "top_observed_skill_gaps" in insights
    assert "actionable_curriculum_recommendations" in insights
    assert isinstance(insights["top_candidate_strengths"], list)
    assert isinstance(insights["actionable_curriculum_recommendations"], list)

