# Gnani VoicePrep AI — Production Deployment Guide

## 1. Overview
This document specifies the deployment topology, runtime configurations, and lifecycle operations for deploying Gnani VoicePrep AI in an enterprise cloud or on-premise container cluster.

---

## 2. Infrastructure Architecture & Services

```
                   [ Internet / Client Browser ]
                                │ (HTTPS :443)
                                ▼
                   [ Reverse Proxy / Ingress ]
                   (Nginx / Traefik / AWS ALB)
                    │                       │
     / (Frontend Static)                    │ /api/* (FastAPI ASGI)
                    ▼                       ▼
      [ gnani-voiceprep-frontend ]     [ gnani-voiceprep-backend ]
          (Nginx Container :80)           (Uvicorn ASGI :8010)
                                                    │
                                                    ▼
                                        [ Persistent Volumes ]
                                        - SQLite DB (WAL Mode)
                                        - Encrypted Recordings
                                        - System Audit Trail
```

---

## 3. Environment Separation & Secret Provisioning

Production configurations are loaded from secure container environment variables or cloud secret managers (e.g., AWS Secrets Manager, HashiCorp Vault).

### Key Variables Required in Production:
| Environment Variable | Description | Example / Requirement |
| :--- | :--- | :--- |
| `ENVIRONMENT` | Target tier environment | `production` |
| `PORT` | ASGI listening port | `8010` |
| `HOST` | Interface bind address | `0.0.0.0` |
| `CORS_ORIGINS` | Permitted origins (no wildcards) | `https://voiceprep.company.com` |
| `AUTH_SECRET_KEY` | Cryptographic secret for HMAC token signing | 32-byte hex secret (`openssl rand -hex 32`) |
| `RECORDING_ENCRYPTION_KEY` | Symmetric Fernet key for at-rest encryption | Fernet base64 URL-safe key |
| `GNANI_API_KEY` | Production API credentials for Speech AI | Enterprise Gnani Developer key |
| `GNANI_STT_URL` | Gnani Prisma STT inference endpoint | `https://api.vachana.ai/stt/v3` |
| `GNANI_TTS_URL` | Gnani Timbre TTS inference endpoint | `https://api.vachana.ai/api/v1/tts/inference` |
| `DATABASE_URL` | Persistent database storage path | `sqlite:///./storage/secure_assess.db` |
| `DATA_RETENTION_DAYS` | Compliance retention window | `30` |

---

## 4. Container Deployment via Docker Compose

### Prerequisites
- Docker Engine $\ge 24.0$
- Docker Compose $\ge v2.20$
- Valid Gnani API Key

### Deployment Execution
```bash
# 1. Copy sample environment file and configure production secrets
cp .env.example .env
nano .env

# 2. Build and launch container services in detached mode
docker compose up -d --build

# 3. Check health and service statuses
docker compose ps
docker compose logs -f backend
```

---

## 5. Health Checks & Reverse Proxy Configuration

### Endpoint Verification
- **Backend Healthcheck**: `GET http://127.0.0.1:8010/api/health`
- **Reverse Proxy Verification**: `GET https://voiceprep.company.com/api/health`
- **Frontend Assets**: `GET https://voiceprep.company.com/`

### Nginx Configuration Template
See [`nginx/frontend.conf`](../nginx/frontend.conf) for production reverse-proxy rules, rate limits, client upload maximums (`50M`), and security headers.

