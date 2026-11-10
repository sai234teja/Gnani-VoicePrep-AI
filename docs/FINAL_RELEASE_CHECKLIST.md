# FINAL RELEASE & BROWSER ACCEPTANCE CHECKLIST

**Project:** Gnani VoicePrep AI  
**Version:** 1.0.0 (Production Candidate)  
**Date:** 2026-11-10

---

## 1. Environment & Pre-Flight Verification

- [x] Backend running on `http://127.0.0.1:8010` (`/api/health` confirmed healthy).
- [x] Frontend running on `http://127.0.0.1:5173`.
- [x] Pre-flight database backup verified (`secure_assess_backup_20261110_203144_pre_phase15_hardening_backup.db`).
- [x] SQLite database integrity check returned `ok`.
- [x] SQLite foreign key check returned `0 violations`.
- [x] All 60 backend unit & integration tests passing (`pytest backend/tests`).
- [x] All 40 frontend component and diagnostic tests passing (`npx vitest run`).
- [x] Production build passes cleanly (`npm run build`).

---

## 2. Chrome Manual Browser Acceptance Steps

Perform the following manual acceptance sequence with a real or virtual browser session:

### A. Candidate Experience Flow
1. **Candidate Registration:**
   - [ ] Navigate to `http://127.0.0.1:5173`.
   - [ ] Enter candidate name, valid email, institution, and select a job role (e.g. *Software Engineer*).
   - [ ] Verify validation triggers on invalid email or empty required fields.
2. **Consent & Pre-Interview Readiness:**
   - [ ] Confirm consent notice for audio/video processing is displayed.
   - [ ] Verify Camera Diagnostics bench: camera preview active, microphone input meter moving, network throughput passing.
3. **Live AI Interview Loop:**
   - [ ] Click **Start Interview**.
   - [ ] Verify AI Avatar renders and status transitions to *Speaking*.
   - [ ] **Audible Playback Check:** Verify audible voice prompt is heard in Chrome without delay.
   - [ ] If browser autoplay policy blocks unmuted audio, verify the "Click to Listen" fallback pill appears and plays voice upon click.
   - [ ] Record a 15-second microphone answer and click **Submit Answer**.
   - [ ] Verify status indicates *Evaluating Rubric* -> *Synthesizing Feedback*.
   - [ ] Confirm spoken feedback from AI plays audibly.
   - [ ] Verify interview advances to next adaptive question without repeating previously answered questions.
4. **Interview Completion:**
   - [ ] Complete question sequence and verify final congratulatory completion screen.
   - [ ] Confirm candidate report modal displays categorized scores (Technical, Communication, Problem Solving) and personalized growth roadmaps.

### B. Recruiter & Multi-Tenant SaaS Operations
1. **Recruiter Sign-In:**
   - [ ] Open recruiter portal (`/api/auth/recruiter-login`).
   - [ ] Verify dashboard shows registered test candidate, attendance status (`PRESENT`), and completed interview score.
2. **Talent Analytics:**
   - [ ] Open **Talent Analytics** tab.
   - [ ] Verify role breakdown chart, cohort score distributions, and intelligent skill gap recommendations render with real SQLite data.
3. **Interview Invitations & Scheduling:**
   - [ ] Open **Invitations & Comms** tab.
   - [ ] Schedule an interview for a new candidate.
   - [ ] Verify 32-byte single-use token link is generated (`?invitation=tok_...`).
   - [ ] Open link in an incognito window and verify candidate details pre-populate.
4. **Billing & SaaS Metering:**
   - [ ] Open **Billing & Plans** tab.
   - [ ] Verify metered usage cards reflect completed sessions, interview minutes, and STT/TTS requests.
   - [ ] Perform a test sandbox upgrade from Free to Starter plan and confirm instant quota refresh.
5. **Enterprise API & Webhook Integrations:**
   - [ ] Open **Integrations & API** tab.
   - [ ] Generate a new API key with `interviews:read` and `reports:read` scopes.
   - [ ] Copy raw key and test curl request against `/api/v1/integrations/roles`.
   - [ ] Verify delivery log records webhook dispatch telemetry.

---

## 3. Security & Boundary Verification

- [x] Multi-tenant isolation verified: cross-tenant access to candidate reports or recordings returns `403 Forbidden`.
- [x] API key hashes verified: raw keys never stored in SQLite or exposed in logs.
- [x] Webhook replay protection verified: requests older than 300 seconds are rejected.
- [x] Audio recording encryption verified: AES-128 Fernet encryption enforced on stored audio.
- [x] Rate limiting and security headers (`X-Content-Type-Options`, `X-Frame-Options`) verified.

---

## 4. Final Sign-Off

- **Development Phase 1–15:** Complete.
- **Architectural Status:** Production Ready.
- **Recommended Action:** Proceed with manual Chrome acceptance testing as outlined in Section 2.

