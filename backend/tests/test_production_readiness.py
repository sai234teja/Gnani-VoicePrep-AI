import pytest
import os
import time
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings
from app.services.db_manager import DatabaseManager

client = TestClient(app)

def test_production_config_validation():
    # When ENVIRONMENT is development, no strict prod failures are raised
    dev_errors = settings.validate_production_readiness()
    assert isinstance(dev_errors, list)

    # Simulated production check with invalid keys
    original_env = settings.ENVIRONMENT
    original_auth = settings.AUTH_SECRET_KEY
    try:
        settings.ENVIRONMENT = "production"
        settings.AUTH_SECRET_KEY = "change_me"
        errors = settings.validate_production_readiness()
        assert any("AUTH_SECRET_KEY" in e for e in errors)
    finally:
        settings.ENVIRONMENT = original_env
        settings.AUTH_SECRET_KEY = original_auth

def test_database_backup_and_restore_operations():
    # Login as recruiter
    login_res = client.post("/api/auth/recruiter-login", json={
        "email": "recruiter@gnani.ai",
        "password": "Password123"
    })
    assert login_res.status_code == 200
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Trigger backup
    bk_res = client.post("/api/admin/database/backup", headers=headers)
    assert bk_res.status_code == 200
    bk_data = bk_res.json()
    assert bk_data["status"] == "success"
    assert "backup_filename" in bk_data
    assert bk_data["byte_size"] > 0
    bk_filename = bk_data["backup_filename"]

    # 2. List backups
    list_res = client.get("/api/admin/database/backups", headers=headers)
    assert list_res.status_code == 200
    assert list_res.json()["count"] >= 1

    # 3. Restore backup
    restore_res = client.post("/api/admin/database/restore", json={
        "backup_filename": bk_filename
    }, headers=headers)
    assert restore_res.status_code == 200
    assert restore_res.json()["status"] == "restored"

def test_database_persistence_across_manager_reinstantiation(tmp_path):
    test_db_path = str(tmp_path / "test_persist.db")
    mgr1 = DatabaseManager(test_db_path)
    with mgr1.get_connection() as conn:
        conn.execute("INSERT INTO candidates (candidate_id, name, email, phone, role_id, role_title, experience_level, interview_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                     ("persist_c1", "Persist Test", "persist@example.com", "1234567890", "java-dev", "Java Dev", "Senior", "company", time.time()))
        conn.commit()

    # Re-instantiate manager on same file (simulating service restart)
    mgr2 = DatabaseManager(test_db_path)
    with mgr2.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT name, email FROM candidates WHERE candidate_id = 'persist_c1'")
        row = cursor.fetchone()
        assert row is not None
        assert row[0] == "Persist Test"
        assert row[1] == "persist@example.com"

def test_request_id_and_security_headers_present():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert "x-request-id" in res.headers
    assert res.headers.get("x-frame-options") == "DENY"
    assert res.headers.get("x-content-type-options") == "nosniff"

def test_upload_body_size_protection():
    # Attempt oversized body (exceeding 50MB content-length check)
    headers = {"Content-Length": str(60 * 1024 * 1024)}
    res = client.post("/api/security/events", headers=headers, json={"session_id": "test", "event_type": "tab_hidden", "detail": "test"})
    assert res.status_code == 413
    assert "Payload too large" in res.json().get("detail", "")

