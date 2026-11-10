# GNANI VOICEPREP AI — PRODUCT ARCHITECTURE AUDIT
**Phase 16 Deliverable: Product Architecture, Role Separation & Workflow Consolidation**
*Date: 2026-11-10 | Status: Completed Audit & Strategy Roadmap*

---

## 1. Executive Summary

Gnani VoicePrep AI was built across 15 intensive engineering phases, creating rich capabilities including real-time voice AI (Prisma STT, Timbre TTS), face and integrity monitoring, adaptive interview intelligence, multi-tenant organization workspaces, notifications, subscription billing, and external ATS/HR webhooks.

However, as the application evolved, the interface and route layer accumulated architectural entanglement:
1. **Candidate and Recruiter Workflows Were Intermingled:** Candidates and recruiters shared the same navigation shell (`EnterpriseShell.jsx`), presenting candidates with links to recruiter tools, talent analytics, billing, and API integrations.
2. **Missing First-Class Candidate Authentication:** Candidates registered transiently per session or had loose IDs without persistent accounts, practice history aggregation, or role-based authentication tokens.
3. **Data Exposure Vulnerabilities in Reporting:** While company-mode evaluation rubrics and flags were stored internally, `get_session_report` returned the full internal evaluation structure to anyone querying the session endpoint if not strictly bounded.
4. **Scattered Organization Settings:** Organization profile, subscription billing, API keys, and team invitations were distributed across separate top-level sidebar items rather than grouped into a coherent enterprise administrative console.

This audit establishes the blueprint for **Phase 16**: creating three cleanly separated workspaces (**Candidate Workspace**, **Recruiter Workspace**, and **Platform Administrator Workspace**), introducing explicit candidate authentication, isolating candidate practice data from company assessments, and hardening server-side role authorization.

---

## 2. Comprehensive Inventory of Existing Modules (Phases 1–15)

| Subsystem | Backend Modules / Tables | Frontend Components | Current State & Gaps |
| :--- | :--- | :--- | :--- |
| **Voice AI & STT/TTS** | `gnani_stt.py`, `gnani_tts.py`, `audio_converter.py` | `AIAvatar.jsx`, `AudioRecorder.jsx`, `AudioPlayer.jsx` | Fully functional. Needs practice-mode conversational support vs. assessment-mode strict silence. |
| **Interview Engine & Adaptive Intelligence** | `session_manager.py`, `evaluator.py`, `conversation_engine.py` | `LiveInterviewRoom.jsx`, `InterviewConfigModal.jsx`, `EvaluationCard.jsx` | Supports `mode="practice"` and `mode="company"`. Practice mode needs continuous feedback; company mode needs recruiter rubric secrecy. |
| **Integrity & Diagnostics** | `diagnostics`, `consent`, `integrity_events`, `candidate_identity_photos` | `SystemReadiness.jsx`, `CameraMonitor.jsx`, `IntegrityTimeline.jsx` | Enterprise-grade proctoring. Only relevant to company assessments; practice sessions should allow quick-start without proctoring burden. |
| **Multi-Tenant SaaS** | `organizations`, `recruiters`, `tenant_job_roles` in `db_manager.py` | `OrganizationWorkspace.jsx`, `MultiTenantAuthModal.jsx`, `JobRoleManager.jsx` | Multi-tenancy is solid. Needs grouping under unified "Organization Settings". |
| **Notifications & Invitations** | `interview_invitations`, `in_app_notifications` | `InvitationManager.jsx`, `ScheduleInterviewModal.jsx` | Fully working. Recruiter sends invitations; candidate accepts via token. |
| **SaaS Billing & Plans** | `subscription_plans`, `organization_subscriptions`, `usage_records` | `BillingWorkspace.jsx` | Fully functioning. Currently visible in primary recruiter sidebar; belongs in Org Settings. |
| **Enterprise API & Webhooks** | `api_keys`, `webhook_endpoints`, `integration_audit_logs` | `IntegrationWorkspace.jsx` | High-security HMAC webhooks and SHA-256 keys. Belongs in Org Settings for org admins. |
| **Candidate Experience & Practice** | In-memory session state | `PracticeStudio.jsx`, `CandidateRegistrationModal.jsx` | Practice was an isolated modal tab; needs to be a dedicated Candidate Workspace. |

---

## 3. Critical Architectural Problems & Analysis

### A. Role Confusion and Navigation Clutter
Currently, `EnterpriseShell.jsx` renders a 12-item navigation list:
- Dashboard, Talent Analytics, Invitations & Comms, Billing & Plans, Integrations & API, Organization & SaaS, Live Interview, Practice Studio, Candidates & Reports, Job Roles, Camera Diagnostics, Settings.
- **Problem:** If a candidate opens the app or logs in, they see recruiter analytics, team billing, and integrations. Candidates have no business seeing recruiter recruitment tools, and recruiters do not need candidate practice tools in their primary hiring flow.

### B. Candidate Identity and Session Persistence
- Candidates previously had no persistent candidate authentication table. They registered ephemeral names/emails before starting an interview.
- **Problem:** Candidates could not log back in to review their practice progress over time, view their learning roadmap, or check past practice sessions.
- **Solution:** Add `candidate_accounts` and `candidate_practice_profiles` with secure candidate login tokens (`role = "candidate"`).

### C. Information Secrecy: Practice Feedback vs. Recruiter Hiring Rubrics
- In **Practice Mode**, candidates *must* see full diagnostic feedback, grammatical improvements, vocabulary suggestions, and learning paths to prepare for real jobs.
- In **Company Assessment Mode**, the evaluation represents an employer's internal hiring assessment. The candidate should see an interview completion confirmation, but *never* internal recruiter scoring rubrics, hiring recommendations, or proctor integrity violation timestamps.
- **Problem:** `get_session_report` returned the complete `FinalReport` object indiscriminately.
- **Solution:** Partition report serialization: Candidates accessing company sessions receive a sanitized candidate receipt; recruiters and org admins receive the full evaluation and proctoring report.

### D. Organization Settings Fragmentation
- Organization Profile, Team Members, Subscription Billing, and Integrations & Webhooks were four separate root items.
- **Solution:** Consolidate into a unified **Organization Settings Hub** with sub-tabs:
  1. *Profile & Branding*
  2. *Team Management & Recruiters*
  3. *Billing & Plan Quotas*
  4. *API Keys & ATS Webhooks*

---

## 4. Phase 16 Consolidated Architecture Plan

```
                                  [ Gnani VoicePrep AI Gateway ]
                                                |
                      +-------------------------+-------------------------+
                      |                                                   |
           [ Candidate Workspace ]                             [ Recruiter Workspace ]
           Role: candidate                                     Role: recruiter / org_admin
                      |                                                   |
        +-------------+-------------+                       +-------------+-------------+
        |             |             |                       |             |             |
     [ Home ]   [ Start Practice ] [ History ]          [ Overview ]   [ Candidates ] [ Interviews ]
                      |                                     |             |             |
            [ Learning Insights ]                       [ Assessments ] [ Analytics ] [ Org Settings ]
                                                                                            |
                                                                                +-----------+-----------+
                                                                                |           |           |
                                                                             [ Profile ] [ Billing ] [ Integrations ]
```

### 1. Candidate Workspace (Candidate Focus)
- **Home:** Overview of practice readiness, upcoming scheduled company interviews, and recent performance trend.
- **Start Practice:** Select target role, experience level, and competencies; launch low-stress practice interview with real-time feedback.
- **My Interviews:** History of completed practice sessions and status of invited company assessments.
- **Learning Insights:** Aggregated score trends, recurring speech patterns, strengths, and recommended practice roadmaps.
- **Candidate Profile:** Target career role, skills, audio/mic preferences, and account credentials.

### 2. Recruiter Workspace (Employer & Hiring Team Focus)
- **Overview:** Recruiter dashboard metrics, active pipeline, recent interviews, quick links.
- **Candidates:** Candidate directory, invitation links, resume/profile summaries.
- **Interviews:** Live assessment scheduling, proctored session monitoring, invitation tracking.
- **Assessments:** Completed interview scoring, proctoring integrity audit, detailed rubric reports.
- **Analytics:** Role-based cohort analytics, competency comparisons, hiring funnel insights.
- **Organization Settings:** Unified hub for Company Branding, Team Members, Subscription & Usage, and ATS Webhooks.

### 3. Platform Administrator Workspace (Superadmin Focus)
- Accessible only to `role === "platform_admin"`.
- System-wide tenant directory, cross-organization health, global plan tier editing, and audit logging.

---

## 5. Security & Permission Matrix

| Endpoint Group | `candidate` | `recruiter` | `org_admin` | `platform_admin` | Unauthenticated |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `/api/auth/candidate-login`, `/api/auth/candidate-register` | Allow | Block | Block | Block | Allow |
| `/api/candidate/me`, `/api/candidate/practice-history` | Allow (Own) | Block | Block | Block | Block (401) |
| `/api/candidate/learning-insights` | Allow (Own) | Block | Block | Block | Block (401) |
| `/api/dashboard/metrics`, `/api/candidates`, `/api/analytics/*` | **Block (403)** | Allow (Own Org)| Allow (Own Org)| Allow (All) | Block (401) |
| `/api/session/{id}/report` (Company Mode) | **Sanitized Only** | Full Report | Full Report | Full Report | Block/Sanitized |
| `/api/invitations/*` | **Block (403)** | Allow (Own Org)| Allow (Own Org)| Allow (All) | Read with Token |
| `/api/billing/*`, `/api/v1/integrations/*` | **Block (403)** | Read Only | Allow (Own Org)| Allow (All) | Block (401) |
| `/api/admin/tenants`, `/api/billing/plans` (POST) | **Block (403)** | **Block (403)** | **Block (403)** | Allow | Block (401) |

---

## 6. Implementation Action Plan

1. **Database Migration (Migration 6):**
   - Take point-in-time database backup.
   - Add `candidate_accounts` table (email, password_hash, full_name, phone, target_role, created_at).
   - Ensure foreign-key and indexing safety.
2. **Backend Auth & Access Control Updates:**
   - Add candidate authentication endpoints in `main.py` & `auth_service.py` (`POST /api/auth/candidate-register`, `POST /api/auth/candidate-login`).
   - Add `require_candidate_auth` dependency.
   - Enforce report sanitization in `get_session_report` for candidate-accessed company interviews.
   - Add candidate learning insights and practice history endpoints (`GET /api/candidate/practice-history`, `GET /api/candidate/insights`).
3. **Frontend Consolidation & Shell Restructuring:**
   - Create `CandidateWorkspace.jsx` containing Home, Start Practice, My Interviews, Learning Insights, and Profile tabs.
   - Refactor `EnterpriseShell.jsx` to dynamically render candidate navigation when logged in as a candidate, and recruiter navigation when logged in as a recruiter/admin.
   - Consolidate Recruiter Navigation into: Overview, Candidates, Interviews, Assessments, Analytics, and Organization Settings.
   - Consolidate Billing, Integrations, Team, and Org into unified `OrganizationWorkspace.jsx`.
4. **Verification & Testing:**
   - Implement `test_role_separation_and_consolidation.py` verifying candidate auth, recruiter isolation, sanitized candidate reports, and org admin protection.
   - Run vitest frontend tests and verify clean production build.

