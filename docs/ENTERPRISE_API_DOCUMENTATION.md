# ENTERPRISE INTEGRATION & PUBLIC API v1 DOCUMENTATION

**Platform:** Gnani VoicePrep AI  
**Base URL:** `https://<your-instance-domain>/api/v1/integrations` (Local: `http://127.0.0.1:8010/api/v1/integrations`)  
**Version:** `1.0.0` (v1)

---

## 1. Authentication

Every request to the Public Enterprise API requires a scoped API key generated from the **Integrations & API** workspace by an Organization Admin.

### Providing the API Key
You can pass the API key in either of two standard HTTP headers:
1. `X-API-Key: gnani_live_YOUR_KEY`
2. `Authorization: Bearer gnani_live_YOUR_KEY`

> [!IMPORTANT]
> Raw API keys start with `gnani_live_` and are displayed **strictly once** upon generation. The database persists only a non-reversible cryptographic SHA-256 hash.

---

## 2. Available API Scopes

| Scope ID | Purpose |
|---|---|
| `roles:read` | Read available job tracks, default competencies, and custom roles |
| `candidates:read` | Enumerate registered candidates enrolled in the organization |
| `candidates:write` | Ingest and register candidates directly from an ATS |
| `interviews:create` | Schedule interview invitations and generate single-use candidate tokens |
| `interviews:read` | Inspect live session status, attendance, and progress |
| `reports:read` | Retrieve completed evaluation scores, rubrics, and interviewer notes |
| `analytics:read` | Read aggregate talent cohort metrics and score distributions |
| `webhooks:manage` | Register, update, and rotate webhook signing secrets |

---

## 3. Endpoints Catalogue

### 3.1. Get Organization Details
`GET /api/v1/integrations/organization`  
**Requires Scope:** Any valid API key belonging to the tenant.

```json
{
  "status": "success",
  "data": {
    "org_id": "org_default",
    "name": "Gnani Primary Tenant",
    "slug": "primary-tenant",
    "industry": "Technology",
    "branding": {
      "portal_name": "Gnani Technical Screening",
      "primary_color": "#0A2540"
    }
  }
}
```

### 3.2. List Job Roles & Competencies
`GET /api/v1/integrations/roles`  
**Requires Scope:** `roles:read`

```json
{
  "status": "success",
  "count": 12,
  "data": [
    {
      "id": "software-engineer",
      "title": "Software Engineer",
      "department": "Engineering",
      "skills": ["Algorithms", "System Design", "Concurrency"],
      "duration_minutes": 25
    }
  ]
}
```

### 3.3. Enroll Candidate from ATS
`POST /api/v1/integrations/candidates`  
**Requires Scope:** `candidates:write`

**Request Body:**
```json
{
  "name": "David Applicant",
  "email": "david.applicant@example.com",
  "phone": "+1-555-0199",
  "institution": "University of Technology",
  "experience_level": "Mid-Level (2-5 yrs)",
  "target_role": "software-engineer"
}
```

### 3.4. Schedule Interview Invitation
`POST /api/v1/integrations/invitations`  
**Requires Scope:** `interviews:create`

**Request Body:**
```json
{
  "candidate_name": "David Applicant",
  "candidate_email": "david.applicant@example.com",
  "role_id": "software-engineer",
  "duration_minutes": 20,
  "custom_notes": "Please prepare for distributed system design questions."
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "invitation_id": "inv_a83f129c",
    "candidate_name": "David Applicant",
    "candidate_email": "david.applicant@example.com",
    "role_id": "software-engineer",
    "scheduled_time": 1794320000.0,
    "duration_minutes": 20,
    "invitation_link": "http://127.0.0.1:5173/?invitation=tok_54f8...b12",
    "status": "SENT",
    "token_expires_at": 1794579200.0
  }
}
```

### 3.5. Retrieve Session Status & Attendance
`GET /api/v1/integrations/interviews/{session_id}`  
**Requires Scope:** `interviews:read`

```json
{
  "status": "success",
  "data": {
    "session_id": "sess_8192ca",
    "interview_status": "COMPLETED",
    "attendance_status": "PRESENT",
    "overall_score": 88,
    "started_at": 1794318000.0,
    "completed_at": 1794319200.0
  }
}
```

### 3.6. Retrieve Completed Evaluation Report
`GET /api/v1/integrations/reports/{session_id}`  
**Requires Scope:** `reports:read`

```json
{
  "status": "success",
  "data": {
    "session_id": "sess_8192ca",
    "overall_score": 88,
    "technical_score": 90,
    "communication_score": 85,
    "problem_solving_score": 89,
    "strengths": ["Clear explanation of database locking modes", "Articulate trade-offs"],
    "areas_for_growth": ["Quantify distributed latency impact"],
    "evaluator_comments": "Strong candidate. Demonstrates clear engineering fundamentals.",
    "confidence": "High (Grounded in Candidate Transcripts)"
  }
}
```

---

## 4. Webhooks Architecture

VoicePrep AI pushes asynchronous JSON event notifications to registered HTTPS endpoints upon key interview milestones.

### 4.1. Event Catalogue
- `candidate.registered`: Candidate enrolled into the talent cohort.
- `interview.invited`: Single-use assessment token link dispatched.
- `interview.started`: Candidate confirmed mic/camera readiness and began interview.
- `interview.completed`: Candidate answered all questions; AI evaluation finalized.
- `report.generated`: Assessment rubric and evidence notes scored and persisted.
- `candidate.absent`: Candidate failed to attend before invitation expiry.
- `subscription.updated`: Tenant upgraded, renewed, or altered plan limits.

### 4.2. Webhook Signatures & Replay Attack Defense
Every outbound webhook includes the `X-Gnani-Signature` header:
`X-Gnani-Signature: t=1794320400,v1=9a2b8...`

Where:
- `t`: The UNIX epoch timestamp of dispatch.
- `v1`: The HMAC-SHA256 digest computed over `f"{t}.".encode() + raw_json_payload`.

#### Signature Verification (Node.js / Express)
```javascript
const crypto = require('crypto');

function verifyVoicePrepWebhook(rawBodyBuffer, signatureHeader, signingSecret) {
  const parts = Object.fromEntries(signatureHeader.split(',').map(s => s.split('=')));
  const timestamp = parseInt(parts['t'], 10);
  const signature = parts['v1'];

  // 1. Replay attack check: reject events older than 5 minutes
  if (Math.abs(Date.now() / 1000 - timestamp) > 300) {
    throw new Error('Webhook timestamp drift exceeds tolerance');
  }

  // 2. Compute HMAC digest
  const expected = crypto
    .createHmac('sha256', signingSecret)
    .update(`${timestamp}.`)
    .update(rawBodyBuffer)
    .digest('hex');

  // 3. Constant-time comparison
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
```

#### Signature Verification (Python / FastAPI)
```python
import time
import hmac
import hashlib

def verify_voiceprep_webhook(raw_body_bytes: bytes, signature_header: str, signing_secret: str) -> bool:
    parts = dict(p.split("=", 1) for p in signature_header.split(","))
    ts = int(parts.get("t", 0))
    v1 = parts.get("v1", "")

    if abs(time.time() - ts) > 300:
        return False

    signed_data = f"{ts}.".encode("utf-8") + raw_body_bytes
    expected = hmac.new(signing_secret.encode("utf-8"), signed_data, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, v1)
```

---

## 5. Reliable Delivery & Retry Policy

- Webhooks are stored in the database queue (`webhook_deliveries`).
- **Exponential Backoff:** If the receiving server returns non-2xx or times out:
  - Attempt 1: Immediate.
  - Attempt 2: After 30 seconds.
  - Attempt 3: After 2 minutes.
  - Attempt 4: After 10 minutes.
  - Attempt 5: After 30 minutes.
- After 5 failed attempts, the event transitions to `dead_letter` status, where it can be inspected and manually re-enqueued from the **Integrations & API** workspace.

