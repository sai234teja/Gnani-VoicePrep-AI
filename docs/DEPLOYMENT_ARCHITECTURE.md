# Gnani VoicePrep AI — Deployment Architecture

## 1. Architectural Philosophy
Gnani VoicePrep AI is architected as a lightweight, high-performance distributed web application optimized for conversational Speech AI pipelines, low-latency audio processing, and privacy-preserving candidate assessments.

---

## 2. Component Topology

### A. Frontend Layer (Single Page Application)
- **Framework**: React 19 + Tailwind CSS + Lucide Icons.
- **Bundler & Build Pipeline**: Vite 8 with Rolldown / ES2020 tree-shaking and automated vendor chunk splitting:
  - `vendor-react`: React, React-DOM core runtime.
  - `vendor-mediapipe`: Local browser-side vision models (`@mediapipe/tasks-vision`) executing ambient lighting and face detection client-side.
  - `vendor-icons` & `vendor-core`: UI icons and support libraries.
- **Proxying & URL Resolution**: Dynamic `VITE_BACKEND_URL` environment variable support; falls back to reverse-proxy `/api` prefix, eliminating hardcoded `localhost` ties.

### B. Backend Layer (Asynchronous REST API)
- **Framework**: FastAPI (Python 3.11/3.14) on Uvicorn ASGI server with multi-worker concurrency.
- **Audio Conversion Pipeline**: In-memory `ffmpeg` transcoding bridge converting variable browser recordings (`webm/opus`, `ogg`) into standardized 16kHz 16-bit Mono WAV PCM for Gnani Prisma STT.
- **Speech Engines**:
  - Gnani Prisma STT v3 (`https://api.vachana.ai/stt/v3`)
  - Gnani Timbre TTS v2.5 (`https://api.vachana.ai/api/v1/tts/inference`)

### C. Data & Storage Persistence Layer
- **Relational Storage**: SQLite with Write-Ahead Logging (`PRAGMA journal_mode=WAL`), busy timeouts (5000ms), and foreign key integrity.
- **Abstraction Layer**: Encapsulated in `DatabaseManager` with automated schema migrations and online backup API.
- **Encrypted Media Storage**: Candidate recordings encrypted at-rest using AES-128 CBC + HMAC via Fernet.

