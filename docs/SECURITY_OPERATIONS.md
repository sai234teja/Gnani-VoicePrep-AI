# Gnani VoicePrep AI — Security Operations & Threat Model

## 1. Authentication & Session Security
- **HMAC-SHA256 Token Signing**: Stateless cryptographic tokens signed with server-side `AUTH_SECRET_KEY`.
- **Role-Based Access Control (RBAC)**: All administrative, candidate cohort exports, retention triggers, and audit logs are restricted to authenticated recruiters.
- **Credential Protection**: Passwords and secrets are never committed to git repositories; `.gitignore` strictly blocks `.env` and `*.key` files.

---

## 2. Candidate Data Privacy & Safeguards
- **Informed Consent**: Telemetry and recordings require affirmative candidate consent before capture.
- **Client-Side Ambient Analysis**: Video lighting and multi-face checks execute locally in the candidate's browser via MediaPipe; camera frames are not continuously streamed to cloud servers.
- **Objective Telemetry Only**: Telemetry logs record objective hardware status (disconnects, reconnects, tab visibility changes). The platform explicitly prohibits automated cheating or dishonesty verdicts based on facial expressions or gaze.
- **At-Rest Media Encryption**: Candidate audio and video recordings are encrypted with Fernet (AES-128 CBC + HMAC) prior to file write.
- **Candidate Right to Erasure**: Candidates and recruiters can delete recordings on demand via `DELETE /api/session/recording/{id}`.

---

## 3. Network & Transport Security
- **Strict Rate Limiting**: 180 requests per minute sliding window per IP.
- **Payload Limits**: Max body size capped at 50MB to prevent denial-of-service via malformed uploads.
- **HTTP Security Headers**:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`

---

## 4. Immutable Audit Trail
The `audit_logs` SQLite table immutably tracks:
- Recruiter logins.
- Candidate cohort data exports (CSV downloads).
- Assessment report views.
- Recording downloads and deletions.
- System retention purges and database backups.

