# Gnani VoicePrep AI — Database Backup & Recovery Guide

## 1. Storage Architecture
The primary database is stored at `backend/storage/secure_assess.db`. In containerized deployments, this directory is mounted as a persistent Docker volume (`backend-storage:/app/storage`).

---

## 2. Live Online Backups
Because the database runs in **Write-Ahead Logging (WAL)** mode, online backups can be executed non-blockingly without taking the application offline or interrupting active interview sessions.

### Triggering a Backup via API (Authenticated Recruiters)
```bash
curl -X POST "http://localhost:8010/api/admin/database/backup" \
  -H "Authorization: Bearer <RECRUITER_HMAC_TOKEN>" \
  -H "Content-Type: application/json"
```

### Listing Available Backups
```bash
curl -X GET "http://localhost:8010/api/admin/database/backups" \
  -H "Authorization: Bearer <RECRUITER_HMAC_TOKEN>"
```

---

## 3. Disaster Recovery & Restoration

### Restoration via API
Restores the database state from a specified verified snapshot. A safety copy (`pre_restore_safety`) is automatically created before applying the snapshot.
```bash
curl -X POST "http://localhost:8010/api/admin/database/restore" \
  -H "Authorization: Bearer <RECRUITER_HMAC_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"backup_filename": "secure_assess_backup_20261110_162832_recruiter_manual.db"}'
```

### Manual Command-Line Recovery
If the server container is inaccessible:
```bash
# 1. Stop the application services
docker compose down

# 2. Locate backup directory
cd backend/storage/backups/

# 3. Copy target backup over active database
cp secure_assess_backup_YYYYMMDD_HHMMSS.db ../secure_assess.db
rm -f ../secure_assess.db-wal ../secure_assess.db-shm

# 4. Restart containers
docker compose up -d
```

