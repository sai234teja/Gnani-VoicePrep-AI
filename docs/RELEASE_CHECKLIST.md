# Gnani VoicePrep AI — Release Verification Checklist

## Pre-Deployment Verification

- [x] **Repository Cleanliness**: `.env` and `.key` files excluded in `.gitignore`.
- [x] **Safe Defaults**: `.env.example` verified with non-sensitive placeholder credentials.
- [x] **Configuration Validation**: `Settings.validate_production_readiness()` checks production environment secrets.
- [x] **Backend Integration Suite**: 28/28 tests passing (`pytest backend/tests -v`).
- [x] **Frontend Unit & Component Suite**: 40/40 tests passing (`npx vitest run`).
- [x] **Production Bundle**: Vite production compilation completes cleanly without chunk size warnings (`npm run build`).
- [x] **Database Durability**: SQLite WAL mode enabled; migrations verified at version 1.
- [x] **Online Backup & Restore**: Backup snapshot generation and restoration verified.
- [x] **Credit Conservation Guard**: Zero live credits consumed during automated test executions.

---

## Post-Deployment Smoke Test Checklist

- [ ] `GET /api/health` returns `200 OK` with `healthy` status.
- [ ] Recruiter login (`POST /api/auth/recruiter-login`) succeeds with demo credentials.
- [ ] Candidate registration modal accepts valid inputs and creates record in SQLite.
- [ ] Camera diagnostics and audio loopback complete without browser permission errors.
- [ ] Live interview launches and initial question prompt renders.
- [ ] Answer recording uploads, evaluates, and progresses to follow-up question.
- [ ] Final report generates with multi-dimensional scores and rubric strengths.
- [ ] Recruiter console lists candidate cohort and allows CSV export.
- [ ] Audit trail verifies entry for login, report access, and CSV export.

