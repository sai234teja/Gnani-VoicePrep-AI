# GNANI VOICEPREP AI — OFFICIAL HACKATHON DEMO SCRIPT
**Submission Track:** Voice AI, Assessment Intelligence & Autonomous Agentic Workflows  
**Live Target Time:** 3 – 5 Minutes  
**Demonstration Date:** November 10, 2026

---

## 1. Executive Pitch & Problem Statement (0:00 – 0:45)

> *"Good evening, judges! Every year, millions of engineers and job seekers prepare for technical and behavioral interviews, but traditional preparation is either generic text or expensive human coaching. On the employer side, recruiters spend countless hours conducting screening rounds that are vulnerable to bias, inconsistent rubrics, and impersonation.*
> 
> *Introducing **Gnani VoicePrep AI** — a complete dual-sided AI interview practice and recruitment assessment platform powered by **Gnani Prisma STT** and **Gnani Timbre TTS**.*
> 
> *It gives candidates an interactive, natural voice simulation that challenges them with real-time adaptive follow-ups, and empowers companies to run objective, proctored talent assessments with privacy separation."*

---

## 2. Why Gnani Engines Are Essential (0:45 – 1:15)

> *"At the core of VoicePrep AI is deep conversational voice intelligence. Text prompts do not simulate the real pressure of an interview. We integrated:*
> 1. ***Gnani Timbre TTS:** Generates high-definition, low-latency conversational speech with natural Indian-accented inflection (`en-IN`), giving our AI interviewer realistic presence and reactive lip-sync avatar motion.*
> 2. ***Gnani Prisma STT:** State-of-the-art multilingual speech recognition capable of transcribing complex technical jargon—like Kubernetes, G1GC garbage collection, and microservice idempotent keys—with industry-leading accuracy even over imperfect microphone inputs.*
> 3. ***Adaptive Conversation Engine:** Never asks hardcoded static lists. It parses the candidate's actual answer, identifies weaknesses or strengths, and generates realistic follow-up questions in real time."*

---

## 3. Candidate Practice Experience Walkthrough (1:15 – 2:45)

### Step 1: Open Candidate Workspace
- **Action:** Open `http://127.0.0.1:5173`. If logged in as candidate, show the clean **Candidate Portal**.
- **Talking Point:** *"Notice the clean, zero-clutter candidate interface. The candidate sees only their practice metrics, learning insights, and personal history. They cannot see company evaluations, internal scoring rubrics, or other candidates."*

### Step 2: Configure & Start Practice Session
- **Action:** Click **"Start Practice"** -> Select **"Full Stack Developer"** -> Experience **"Mid-Level"** -> Difficulty **"Intermediate"** -> Click **"Begin Practice Session"**.
- **Talking Point:** *"Practice mode is 100% private. No proctoring locks or employer surveillance are enforced here—it's designed to build candidate confidence."*

### Step 3: Real Voice Simulation (The "Wow" Moment)
- **Audio Output:** AI avatar speaks with **Gnani Timbre voice**:
  > *"Hello Priya! Welcome to your technical interview. Could you explain the concept of reconciliation in React and how the Virtual DOM diffing algorithm works?"*
- **Candidate Microphone Input:**
  > *"React uses a virtual DOM to keep a lightweight copy of the UI in memory. When state updates, it compares the new tree with the previous tree using a heuristic O(n) diffing algorithm, applying minimal mutations to the real browser DOM."*
- **Live Transcription & AI Evaluation:**
  - Show Gnani Prisma STT converting the spoken audio into exact text.
  - Show the evaluator analyzing technical depth, communication cadence, and problem-solving.
- **Adaptive Follow-Up Spoken by AI:**
  > *"Great explanation of Virtual DOM diffing. How does React Fiber improve this process when dealing with large component trees and animation frames?"*
- **Talking Point:** *"Notice the AI didn't just ask question two from a static list. It recognized the candidate's explanation and probed deeper into React Fiber!"*

### Step 4: Instant Learning Insights & Roadmap
- **Action:** View the completed Practice Report.
- **Talking Point:** *"Candidates receive actionable diagnostic roadmaps: vocabulary calibration, pacing analysis, and targeted topic recommendations—like distributed caching patterns—to prepare for their next attempt."*

---

## 4. Recruiter Talent Assessment Walkthrough (2:45 – 4:00)

### Step 1: Switch to Recruiter Workspace
- **Action:** Sign in with Recruiter credentials (`recruiter@gnani.ai`).
- **Talking Point:** *"Now let's switch to the employer experience. As a recruiter, the workspace transforms immediately into a centralized hiring control center."*

### Step 2: Recruiter Pipeline & Attendance
- **Action:** Click **"Candidates & Pipeline"**.
- **Talking Point:** *"Recruiters manage candidate attendance (`PRESENT`, `ABSENT`), view proctored verification status, and review scheduled invitations. Notice the strict data isolation—recruiters only see candidates from their authorized tenant."*

### Step 3: Private Assessment Report & Scoring Rubric
- **Action:** Open a completed Candidate Assessment.
- **Showcase:**
  - **4-Dimensional Competency Breakdown:** Technical Proficiency, Problem Solving, Communication, and Project Execution.
  - **Question-by-Question Transcript & Evaluator Notes:** Full question audio recordings, timestamps, and model feedback.
  - **Proctor Integrity Summary:** Camera status, verified technical events (tab switches), and uncertain observations with neutral disclaimers.
- **Privacy Demonstration:** *"If the candidate opens their receipt, employer rubric details and evaluator notes are sanitized. Recruiters retain full evidence-based assessment data to make unbiased hiring decisions."*

---

## 5. Innovation, Tech Stack & Differentiators (4:00 – 4:45)

- **Speech & AI:** Gnani Prisma v3.0 STT, Gnani Timbre v2.5 TTS, Adaptive Prompt Engineering with Starlette/FastAPI.
- **Computer Vision & Proctoring:** Lightweight client-side MediaPipe face tracking, multi-face and device detection with Non-Maximum Suppression (NMS).
- **Architecture & Reliability:** Full-duplex Web Audio API analyzer graph, resilient SQLite Write-Ahead Logging (WAL) with point-in-time backup snapshots.
- **Multi-Tenant Security:** Cryptographic HMAC-SHA256 bearer tokens, AES-256 recording encryption, and strict role gates (`candidate`, `recruiter`, `org_admin`, `platform_admin`).

---

## 6. Closing & Submission Summary (4:45 – 5:00)

> *"Gnani VoicePrep AI bridges the gap between candidate preparation and employer evaluation. It empowers candidates to master their communication skills and gives enterprises an objective, voice-first assessment engine.*
> 
> *Everything shown today is fully functional, verified with 65 backend automated tests and 40 frontend tests. Thank you!"*

---

## 7. Pre-Demo Verification Checklist

- [x] **Backend Server Running:** `http://127.0.0.1:8010` (Uvicorn FastAPI)
- [x] **Frontend Server Running:** `http://127.0.0.1:5173` (Vite React)
- [x] **Gnani Timbre TTS:** Verified live synthesis (122,940 bytes audio synthesized in 890ms)
- [x] **Gnani Prisma STT:** Configured on `https://api.vachana.ai/stt/v3`
- [x] **Audio Playback:** Dedicated DOM player mounted with AudioContext resume triggers and manual click-to-play fallback banner
- [x] **Database & Migrations:** SQLite integrity verified (`['ok']`), Foreign keys verified (`[]`), Migration 6 active
- [x] **Candidate Demo Account:** `candidate@example.com` / `CandidatePass123!`
- [x] **Recruiter Demo Account:** `recruiter@gnani.ai` / `Password123`
- [x] **Automated Tests:** 65/65 backend pytest tests passing, 40/40 frontend vitest tests passing
- [x] **Production Bundle:** Vite clean build (`dist/`) in 796ms

