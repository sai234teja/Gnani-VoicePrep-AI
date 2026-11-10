# Gnani VoicePrep AI - Live Interview & Practice Studio 🎙️

**Gnani VoicePrep AI** is an AI-powered live interview simulation and practice platform designed for the **Great Indian AI Internship Challenge**.

It provides realistic mock interviews with an adaptive AI voice interviewer, real-time speech transcription via **Gnani Prisma STT (v3.0)**, natural speech synthesis via **Gnani Timbre TTS (v2.5/v3.0)**, webcam/microphone monitoring with ethical, consent-based integrity tracking, and actionable diagnostic reports.

---

## 🌟 Key Modes

### 1. Practice Mode (Candidate-Controlled Studio)
- **Device Preferences**: Camera and microphone are **optional**. Candidates can toggle camera-off and microphone-mute freely.
- **Local Practice Recording**: Instant recording, video replay, re-recording, and candidate-controlled deletion.
- **Learning-Oriented Assessment**: Performance reported as readiness levels (e.g., *Advanced Mastery*, *Proficient Practitioner*) without high-stakes hiring verdicts.

### 2. Company Interview Mode (Structured Assessment)
- **Prerequisites**: Camera and microphone are **required** before the session begins.
- **Hardware Disconnection Handling**: If the camera/mic feed drops, the assessment automatically pauses with a 1-click **Reconnect Hardware** recovery or emergency exit.
- **Emergency Stop**: Accessible emergency exit button available at all times.
- **Consent-Enforced**: Explicit informed consent is required before environment monitoring or optional encrypted recording storage.
- **Encrypted At-Rest Storage**: AES-128 CBC (Fernet) encryption for recordings, restricted to authorized reviewers with candidate-controlled deletion.

---

## 🤖 AI & Speech Technology Stack

- **Speech-to-Text (STT)**: **Gnani Prisma STT (v3.0)** via `https://api.vachana.ai/stt/v3` with multipart audio upload and `X-API-Key-ID`.
- **Text-to-Speech (TTS)**: **Gnani Timbre TTS** via `https://api.vachana.ai/api/v1/tts/inference` returning `audio/wav`.
- **Supported Languages**: English (`en-IN`), Telugu (`te-IN`), and Hinglish/Hindi (`hi-IN`).
- **Zero Mock Policy**: Evaluates only actual transcribed speech; failed STT returns an explicit error (`HTTP 502`) rather than fabricating answers.
- **Lightweight Face & Environment Tracker**:
  - Uses native browser **`window.FaceDetector`** (Shape Detection API) when available.
  - Multi-point facial feature contrast fallback that verifies dual eye-socket luminance valleys, central nose bridge, and mouth line contrast.
  - Transparently labels browser limitations as `uncertaintyNotice` rather than claiming false detection.
  - Peripheral gaze/head shifts logged strictly as **uncertain natural observations**, never as evidence of dishonesty.

---

## 🎯 Supported Interview Job Profiles

1. **Java Developer** (Spring Boot, Hibernate, JVM internals, Microservices, Kafka)
2. **Python Full Stack** (FastAPI, Django, React, Celery, PostgreSQL, Redis)
3. **MERN Stack** (MongoDB, Express, React, Node.js, TypeScript, Docker)
4. **Frontend Developer** (React, Next.js, Core Web Vitals, Performance, Tailwind CSS)
5. **Backend Developer** (Go/Python, Distributed Systems, Caching, Concurrency)
6. **Data Analyst** (SQL, Pandas, Statistical Modeling, A/B Testing, Window Functions)
7. **Software Engineer** (Data Structures, System Design, Algorithms, Clean Code)
*Custom skills can be added on the fly during interview setup.*

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 2. Backend Setup
```powershell
cd backend

# Activate virtual environment
.venv\Scripts\Activate.ps1   # Windows PowerShell
# source .venv/bin/activate  # Linux / macOS

# Install dependencies
pip install -r requirements.txt

# Configure Gnani API Key in backend/.env
# GNANI_API_KEY=your_actual_key_here

# Run backend server
uvicorn app.main:app --host 127.0.0.1 --port 8000
```
Backend Swagger API documentation is available at: `http://127.0.0.1:8000/docs`

### 3. Frontend Setup
```powershell
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 🧪 Automated Testing Suite

All tests run in isolated, mock-safe environments (zero credit consumption, no external API calls, zero secret exposure).

### Backend Pytest Suite (9/9 Tests Passing)
```powershell
$env:PYTHONPATH="backend"
python -m pytest backend/tests -v
```
Verifies:
- Root metadata and `/api/health` configuration.
- Retrieval of 7 job profiles and tech stacks.
- Practice Mode vs. Company Mode session state management.
- Hardware pause on disconnect, stream recovery, and emergency exit.
- At-rest recording encryption (Fernet AES), reviewer RBAC, and instant candidate deletion.
- Consent withdrawal enforcement.
- Real STT pipeline parsing with zero fabricated fallbacks.

### Frontend Browser Journey Suite (9/9 Tests Passing)
```powershell
cd frontend
npx vitest run
```
Verifies:
- Practice Mode setup with custom skills.
- Company Mode setup with consent validation.
- Camera and microphone permissions initialization.
- Persistent `REC 480p/15fps` indicator and preview controls.
- Face detection fallback and uncertainty state reporting.
- Technical question prompt, context, and rubric progression.
- Local recording playback, re-recording, and deletion.
- Blocked submission upon consent withdrawal.
- Final report rendering (readiness levels, dimension scores, separate confirmed vs. uncertain event timeline).

---

## 🔒 Security & Privacy Commitments
1. **No External Video Upload by Default**: Practice recordings remain client-side on candidate devices.
2. **Encrypted Storage**: Uploaded company recordings are encrypted at rest with AES-128 CBC.
3. **No Automated Cheating Verdicts**: Objective metrics (tab visibility, camera continuity) are strictly logged with timestamps and measured durations; cognitive gaze shifts are clearly labeled as non-punitive uncertain observations.
4. **No Training on Candidate Data**: Candidate recordings are never used for machine learning training without separate explicit consent.
