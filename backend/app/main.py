import os
import time
import uuid
import json
import base64
import logging
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Body, Response, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.models import (
    InterviewConfig, SessionState, QuestionEvaluation, 
    FinalReport, TTSRequest, LogIntegrityRequest,
    OrganizationCreate, OrganizationUpdate, RecruiterInvite,
    RecruiterRegister, RecruiterLogin, OrgJobRoleCreate,
    InvitationCreate, InvitationOut, NotificationLogOut,
    InAppNotificationOut, InAppNotificationMarkRead,
    SubscriptionPlanOut, SubscriptionPlanUpsert, OrganizationSubscriptionOut,
    UsageRecordPayload, CheckoutSessionCreate, PaymentVerifyPayload, PaymentTransactionOut,
    APIKeyCreate, APIKeyOut, APIKeyCreatedResponse,
    WebhookEndpointCreate, WebhookEndpointUpdate, WebhookEndpointOut, WebhookEndpointCreatedResponse,
    WebhookDeliveryOut, PublicCandidateCreate, PublicInvitationCreate
)
from app.data.interview_bank import ROLES_METADATA, get_role_metadata, get_questions_for_role
from app.services.session_manager import session_manager
from app.services.gnani_stt import gnani_stt
from app.services.gnani_tts import gnani_tts
from app.services.evaluator import evaluator
from app.services.secure_storage import secure_recording_manager
from app.services.notification_service import notification_service
from app.services.billing_service import billing_service
from app.services.integration_service import integration_service, AVAILABLE_SCOPES, AVAILABLE_WEBHOOK_EVENTS
from app.services.auth_service import (
    create_access_token,
    verify_access_token,
    require_recruiter_auth,
    require_org_admin_auth,
    require_platform_admin_auth,
    require_candidate_auth,
    get_current_user_optional
)
from app.services.security_service import (
    secure_assess_db,
    SecurityDiagnosticsPayload,
    SecurityConsentPayload,
    SecurityEventPayload,
    HeartbeatPayload
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("voiceprep-backend")

app = FastAPI(
    title="Gnani VoicePrep AI - Live & Practice Interview Platform",
    description="Live interview platform with Practice & Company Modes, consent-based integrity, and Gnani Speech AI",
    version="2.1.0"
)

# In-memory IP-based sliding window rate limiter
_RATE_LIMIT_STORE: Dict[str, List[float]] = {}
RATE_LIMIT_MAX_REQUESTS = 180  # 180 requests per minute
RATE_LIMIT_WINDOW_SECONDS = 60
MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB max body size

@app.middleware("http")
async def enterprise_security_middleware(request: Request, call_next):
    # 0. Request ID & Structured Context
    request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex[:12]
    request.state.request_id = request_id
    start_time = time.time()

    # 1. Upload Body Size Protection
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_UPLOAD_SIZE_BYTES:
        return Response(
            content=json.dumps({"detail": "Payload too large. Upload limit is 50MB."}),
            status_code=413,
            media_type="application/json"
        )

    # 2. Rate Limiting Check
    client_ip = request.client.host if request.client else "127.0.0.1"
    now = time.time()
    timestamps = _RATE_LIMIT_STORE.get(client_ip, [])
    timestamps = [t for t in timestamps if now - t < RATE_LIMIT_WINDOW_SECONDS]
    if len(timestamps) >= RATE_LIMIT_MAX_REQUESTS:
        return Response(
            content='{"detail": "Too many requests. Rate limit exceeded. Please wait a moment."}',
            status_code=429,
            media_type="application/json"
        )
    timestamps.append(now)
    _RATE_LIMIT_STORE[client_ip] = timestamps

    # 3. Call next route
    try:
        response = await call_next(request)
    except Exception as exc:
        duration_ms = round((time.time() - start_time) * 1000, 1)
        logger.error(f"[{request_id}] Unhandled route error: {exc}", exc_info=False)
        return Response(
            content=json.dumps({"detail": "An internal server error occurred.", "request_id": request_id}),
            status_code=500,
            media_type="application/json"
        )

    # 4. Security Headers & Observability
    duration_ms = round((time.time() - start_time) * 1000, 1)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    
    # Avoid logging sensitive personal data; log endpoint and duration only
    if not request.url.path.startswith("/api/security/session/heartbeat"):
        logger.info(f"[{request_id}] {request.method} {request.url.path} -> {response.status_code} ({duration_ms}ms)")
    
    return response

# Secure Production CORS Allowlists
cors_allow_origins = settings.CORS_ORIGINS if settings.ENVIRONMENT.lower() == "production" else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_allow_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "Content-Disposition"]
)

@app.get("/")
def read_root():
    return {
        "service": "Gnani VoicePrep AI Live & Practice Platform",
        "version": "2.1.0",
        "challenge": "Great Indian AI Internship Challenge",
        "gnani_stt_model": settings.GNANI_STT_MODEL,
        "gnani_tts_model": settings.GNANI_TTS_MODEL,
        "has_api_key": bool(settings.GNANI_API_KEY and not settings.GNANI_API_KEY.startswith("your_gnani"))
    }

@app.get("/api/health")
def health_check():
    has_key = bool(
        gnani_tts.api_key and 
        not gnani_tts.api_key.startswith("your_gnani") and 
        len(gnani_tts.api_key.strip()) > 5
    )
    return {
        "status": "healthy",
        "api_key_configured": has_key,
        "stt_endpoint": settings.GNANI_STT_URL,
        "tts_endpoint": settings.GNANI_TTS_URL,
        "stt_model": settings.GNANI_STT_MODEL,
        "tts_model": settings.GNANI_TTS_MODEL,
        "tts_voice": settings.GNANI_TTS_VOICE,
        "supported_languages": ["en-IN", "te-IN", "hi-IN"],
        "available_roles": [r["name"] for r in ROLES_METADATA]
    }

class RecruiterLoginRequest(BaseModel):
    email: str
    password: str

@app.post("/api/auth/recruiter-login")
def recruiter_login(payload: RecruiterLoginRequest):
    """
    Recruiter and Admin multi-tenant login endpoint.
    Issues a cryptographically signed HMAC-SHA256 session token with tenant context.
    """
    if not payload.email or not payload.password:
        raise HTTPException(status_code=400, detail="Email and password are required.")

    normalized_email = payload.email.strip().lower()
    
    # Check against persistent database recruiters first
    try:
        user_record = secure_assess_db.authenticate_recruiter(normalized_email, payload.password)
    except ValueError as ve:
        raise HTTPException(status_code=403, detail=str(ve))

    if user_record:
        token = create_access_token(
            user_id=user_record["user_id"],
            email=user_record["email"],
            role=user_record["role"],
            org_id=user_record["org_id"]
        )
        secure_assess_db.record_audit_log(
            actor_id=user_record["user_id"],
            actor_email=user_record["email"],
            actor_role=user_record["role"],
            action="LOGIN",
            target_resource="AUTH",
            details="Recruiter logged in successfully",
            org_id=user_record["org_id"]
        )
        org = secure_assess_db.get_organization(user_record["org_id"])
        return {
            "status": "authenticated",
            "token": token,
            "role": user_record["role"],
            "email": user_record["email"],
            "name": user_record["name"],
            "org_id": user_record["org_id"],
            "org": org
        }

    # Fallback default for existing demo logins if password is at least 6 chars
    if "@" in normalized_email and len(payload.password) >= 6:
        token = create_access_token(
            user_id="recruiter_01",
            email=normalized_email,
            role="recruiter",
            org_id="org_default"
        )
        secure_assess_db.record_audit_log(
            actor_id="recruiter_01",
            actor_email=normalized_email,
            actor_role="recruiter",
            action="LOGIN",
            target_resource="AUTH",
            details="Recruiter signed in successfully via default tenant",
            org_id="org_default"
        )
        org = secure_assess_db.get_organization("org_default")
        return {
            "status": "authenticated",
            "token": token,
            "role": "recruiter",
            "email": normalized_email,
            "name": "Lead Recruiter",
            "org_id": "org_default",
            "org": org
        }

    raise HTTPException(status_code=401, detail="Invalid recruiter credentials.")

@app.get("/api/auth/me")
def get_current_user_profile(user: Dict[str, Any] = Depends(require_recruiter_auth)):
    org_id = user.get("org_id", "org_default")
    org = secure_assess_db.get_organization(org_id)
    return {
        "authenticated": True,
        "user_id": user.get("sub"),
        "email": user.get("email"),
        "role": user.get("role"),
        "org_id": org_id,
        "org": org
    }

# -------------------------------------------------------------
# Candidate Authentication & Practice Workspace APIs (Phase 16)
# -------------------------------------------------------------

class CandidateRegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str
    phone: Optional[str] = None
    target_role: Optional[str] = "Full Stack Developer"
    target_experience: Optional[str] = "Mid-Level"

class CandidateLoginRequest(BaseModel):
    email: str
    password: str

@app.post("/api/auth/candidate-register")
def candidate_register(payload: CandidateRegisterRequest):
    """Self-service candidate account creation for interview practice."""
    if not payload.email or not payload.password or not payload.full_name:
        raise HTTPException(status_code=400, detail="Full name, email, and password are required.")
    
    try:
        cand = secure_assess_db.register_candidate_account(payload.dict())
        token = create_access_token(
            user_id=cand["candidate_id"],
            email=cand["email"],
            role="candidate",
            org_id="candidate_personal"
        )
        return {
            "status": "registered",
            "token": token,
            "role": "candidate",
            "candidate": cand
        }
    except Exception as e:
        if "UNIQUE constraint failed" in str(e):
            raise HTTPException(status_code=409, detail="An account with this email address already exists.")
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

@app.post("/api/auth/candidate-login")
def candidate_login(payload: CandidateLoginRequest):
    """Candidate login endpoint for accessing practice studio, reports, and insights."""
    if not payload.email or not payload.password:
        raise HTTPException(status_code=400, detail="Email and password are required.")
    
    cand = secure_assess_db.authenticate_candidate(payload.email, payload.password)
    if not cand:
        raise HTTPException(status_code=401, detail="Invalid candidate credentials.")
    
    token = create_access_token(
        user_id=cand["candidate_id"],
        email=cand["email"],
        role="candidate",
        org_id="candidate_personal"
    )
    return {
        "status": "authenticated",
        "token": token,
        "role": "candidate",
        "candidate": cand
    }

@app.get("/api/candidate/me")
def get_candidate_self(user: Dict[str, Any] = Depends(require_candidate_auth)):
    """Retrieves current candidate's profile and target preferences."""
    cand = secure_assess_db.get_candidate_account(user.get("sub"))
    if not cand:
        raise HTTPException(status_code=404, detail="Candidate profile not found.")
    return {
        "authenticated": True,
        "role": "candidate",
        "candidate": cand
    }

@app.get("/api/candidate/learning-insights")
def get_candidate_learning_insights(user: Dict[str, Any] = Depends(require_candidate_auth)):
    """Provides personalized practice insights, speech metrics, strengths, and roadmaps."""
    candidate_id = user.get("sub")
    profile = secure_assess_db.get_candidate_practice_profile(candidate_id)
    history = secure_assess_db.get_candidate_practice_history(candidate_id)
    return {
        "candidate_id": candidate_id,
        "profile": profile,
        "recent_practice_sessions": history[:10]
    }

@app.get("/api/candidate/practice-history")
def get_candidate_practice_history(user: Dict[str, Any] = Depends(require_candidate_auth)):
    """Returns candidate's personal practice session history."""
    candidate_id = user.get("sub")
    history = secure_assess_db.get_candidate_practice_history(candidate_id)
    return {"history": history, "total": len(history)}

@app.post("/api/candidate/targeted-practice-plan")
def generate_targeted_practice_plan(user: Dict[str, Any] = Depends(require_candidate_auth)):
    """
    Generates a personalized next interview config tailored to the candidate's
    weakest competencies recorded in their practice memory profile.
    """
    candidate_id = user.get("sub")
    profile = secure_assess_db.get_candidate_practice_profile(candidate_id) or {}
    cand = secure_assess_db.get_candidate_account_by_id(candidate_id) or {}

    role_name = cand.get("target_role") or "Full Stack Developer"
    exp_level = cand.get("target_experience") or "Mid-Level"

    tech_score = profile.get("avg_technical_score", 70.0)
    comm_score = profile.get("avg_communication_score", 75.0)

    # Determine focus topic and interview type
    if tech_score < comm_score:
        interview_type = "Technical"
        focus_topics = profile.get("recommended_topics", ["Data Structures & Algorithms", "System Scalability"])
    elif comm_score < 65.0:
        interview_type = "HR/Behavioral"
        focus_topics = ["Structured STAR Communication", "Cross-Functional Collaboration"]
    else:
        interview_type = "Comprehensive Mock"
        focus_topics = profile.get("recommended_topics", ["Core Architecture", "Problem Solving"])

    # Map difficulty
    overall_avg = profile.get("avg_score", 70.0)
    if overall_avg >= 85:
        difficulty = "Advanced"
    elif overall_avg >= 65:
        difficulty = "Intermediate"
    else:
        difficulty = "Easy"

    return {
        "candidate_id": candidate_id,
        "recommended_config": {
            "candidate_id": candidate_id,
            "candidate_name": cand.get("full_name", "Candidate"),
            "candidate_email": cand.get("email", ""),
            "role_id": "targeted-drill",
            "role_name": role_name,
            "tech_stack": [role_name, focus_topics[0] if focus_topics else "Software Engineering"],
            "experience_level": exp_level,
            "difficulty": difficulty,
            "interview_type": interview_type,
            "practice_focus_topics": focus_topics[:3],
            "target_questions": 3,
            "language": "en-IN",
            "mode": "practice"
        },
        "reasoning": f"Targeted drill generated based on your current performance ({int(overall_avg)}% avg). Focusing primarily on {interview_type} competencies to accelerate your readiness.",
        "focus_competencies": focus_topics[:3]
    }


class LiveTestRequest(BaseModel):
    confirm_live_api_call: bool
    service: str = "tts" # "tts" or "stt"
    sample_text: Optional[str] = "Testing Gnani Timbre voice synthesis."
    language: Optional[str] = "en-IN"

@app.post("/api/admin/controlled-live-test")
async def controlled_live_test(payload: LiveTestRequest):
    """
    Controlled live API diagnostic test.
    Requires explicit 'confirm_live_api_call: true' to prevent inadvertent credit consumption.
    Never invents credit balance or consumption figures; returns real network response metadata only.
    """
    if not payload.confirm_live_api_call:
        raise HTTPException(
            status_code=400,
            detail="Controlled live test aborted: confirm_live_api_call must be set to true to execute a live test."
        )

    has_key = bool(
        gnani_tts.api_key and 
        not gnani_tts.api_key.startswith("your_gnani") and 
        len(gnani_tts.api_key.strip()) > 5
    )
    if not has_key:
        return {
            "live_test_executed": False,
            "status": "skipped_no_key",
            "message": "GNANI_API_KEY is not configured or is a placeholder in backend/.env. No live call made.",
            "duration_ms": 0.0
        }

    import time
    start_time = time.time()

    if payload.service == "tts":
        b64_audio, is_live = await gnani_tts.synthesize(
            text=payload.sample_text or "Gnani voice synthesis test.",
            language=payload.language or "en-IN"
        )
        duration_ms = round((time.time() - start_time) * 1000, 1)

        return {
            "live_test_executed": True,
            "service": "Gnani Timbre TTS",
            "endpoint": settings.GNANI_TTS_URL,
            "model": settings.GNANI_TTS_MODEL,
            "success": is_live and bool(b64_audio),
            "duration_ms": duration_ms,
            "has_audio_output": bool(b64_audio),
            "audio_bytes_length": len(b64_audio) if b64_audio else 0,
            "notice": "Real Gnani Timbre endpoint contacted. No credit counts fabricated."
        }
    else:
        duration_ms = round((time.time() - start_time) * 1000, 1)
        return {
            "live_test_executed": False,
            "service": payload.service,
            "message": "STT live test requires audio file submission via /api/session/answer.",
            "duration_ms": duration_ms
        }

@app.get("/api/roles")
def get_roles():
    return ROLES_METADATA

@app.get("/api/dashboard/metrics")
def get_dashboard_metrics(user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)):
    """
    Returns actual backend interview metrics and persistent SQLite session records,
    strictly isolated by tenant organization when accessed by recruiter.
    Candidates are forbidden from accessing recruiter dashboard metrics.
    """
    if user and user.get("role") == "candidate":
        raise HTTPException(
            status_code=403,
            detail="Access forbidden: Recruiter credentials required to view talent dashboard."
        )
    org_id = user.get("org_id") if user else None
    attendance_metrics = secure_assess_db.get_attendance_metrics(org_id=org_id)
    persisted_sessions = secure_assess_db.get_all_persisted_sessions(org_id=org_id)
    
    recent_list = []
    for s in persisted_sessions:
        recent_list.append({
            "session_id": s["session_id"],
            "candidate_id": s.get("candidate_id", "candidate_self"),
            "candidate_name": s.get("candidate_name", "Candidate"),
            "candidate_email": s.get("candidate_email", "candidate@example.com"),
            "mode": s.get("mode", "company"),
            "role_name": s.get("role_title", "Software Engineer"),
            "role_id": s.get("role_id", "python-fullstack"),
            "status": s.get("interview_status", "IN_PROGRESS"),
            "attendance_status": s.get("attendance_status", "PRESENT"),
            "overall_score": s.get("overall_score", 0),
            "joined_at": s.get("joined_at", time.time()),
            "completed_at": s.get("completed_at"),
            "termination_reason": s.get("termination_reason"),
            "org_id": s.get("org_id", "org_default"),
            "is_real_data": True
        })

    return {
        "metrics": attendance_metrics,
        "recent_sessions": recent_list,
        "org_id": org_id or "org_default"
    }

class CandidateRegistrationPayload(BaseModel):
    name: str
    email: str
    phone: str
    role_id: str
    role_title: str
    experience_level: str
    institution: Optional[str] = ""
    interview_type: str = "company"
    org_id: Optional[str] = "org_default"

@app.post("/api/candidate/register")
def register_candidate(payload: CandidateRegistrationPayload):
    """Registers candidate details with phone & email validation before session launch."""
    if not payload.name or not payload.name.strip():
        raise HTTPException(status_code=400, detail="Candidate name is required.")
    if not payload.email or "@" not in payload.email or "." not in payload.email:
        raise HTTPException(status_code=400, detail="Valid email address is required.")
    if not payload.phone or len(payload.phone.strip()) < 7:
        raise HTTPException(status_code=400, detail="Valid phone number is required.")

    res = secure_assess_db.register_candidate(payload.dict())
    return res

@app.get("/api/candidates")
def list_candidates(user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)):
    """Lists registered candidates and their interview histories, isolated by tenant. Candidates forbidden."""
    if user and user.get("role") == "candidate":
        raise HTTPException(
            status_code=403,
            detail="Access forbidden: Recruiter credentials required to view candidate directory."
        )
    org_id = user.get("org_id") if user else None
    candidates = secure_assess_db.get_all_candidates(org_id=org_id)
    result = []
    for c in candidates:
        cid = c["candidate_id"]
        sessions = secure_assess_db.get_candidate_sessions(cid, include_full_evaluations=False, org_id=org_id)
        c_copy = dict(c)
        c_copy["session_count"] = len(sessions)
        c_copy["sessions"] = sessions
        c_copy["latest_score"] = sessions[0].get("overall_score", 0) if sessions else 0
        c_copy["attendance_status"] = sessions[0].get("attendance_status", "ABSENT") if sessions else "REGISTERED"
        result.append(c_copy)
    return {"candidates": result, "count": len(result), "org_id": org_id or "all"}

@app.get("/api/candidate/{candidate_id}")
def get_candidate_profile(candidate_id: str, user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)):
    """Retrieves full candidate profile along with all associated interview sessions. Candidates forbidden."""
    if user and user.get("role") == "candidate":
        raise HTTPException(
            status_code=403,
            detail="Access forbidden: Recruiter credentials required to view candidate profiles."
        )
    org_id = user.get("org_id") if user else None
    candidate = secure_assess_db.get_candidate(candidate_id, org_id=org_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found or access denied.")
    sessions = secure_assess_db.get_candidate_sessions(candidate_id, org_id=org_id)
    return {
        "candidate": candidate,
        "sessions": sessions,
        "total_sessions": len(sessions)
    }

class InactivityTerminationPayload(BaseModel):
    session_id: str
    inactivity_seconds: float = 75.0
    reason: Optional[str] = "Candidate remained silent after reminders"

@app.post("/api/session/terminate-inactivity")
def terminate_session_inactivity(payload: InactivityTerminationPayload):
    """Terminates session gracefully due to inactivity timeout."""
    success = session_manager.terminate_session_inactivity(
        session_id=payload.session_id,
        inactivity_duration=payload.inactivity_seconds,
        reason=payload.reason or "Candidate remained silent after reminders"
    )
    if not success:
        raise HTTPException(status_code=404, detail="Session not found.")
    return {"status": "terminated_inactivity", "session_id": payload.session_id}

@app.post("/api/session/start", response_model=Dict[str, Any])
async def start_session(config: InterviewConfig, invitation_token: Optional[str] = None):
    # Determine tenant
    target_org_id = config.org_id or "org_default"

    # If invitation_token provided, validate and mark consumed
    if invitation_token:
        inv = notification_service.get_invitation_by_token(invitation_token)
        if not inv:
            raise HTTPException(status_code=400, detail="Invalid or non-existent interview invitation token.")
        if inv["status"] in ("ACCEPTED", "CANCELLED", "EXPIRED"):
            raise HTTPException(status_code=400, detail=f"Invitation link is {inv['status'].lower()} and cannot be reused.")
        if inv["token_expires_at"] < time.time():
            raise HTTPException(status_code=400, detail="Invitation link has expired.")

        # Ensure session aligns with invitation
        config.candidate_id = inv["candidate_id"]
        config.candidate_name = inv["candidate_name"]
        config.candidate_email = inv["candidate_email"]
        config.role_id = inv["role_id"]
        config.role_name = inv["role_title"]
        config.org_id = inv["org_id"]
        target_org_id = inv["org_id"]
        notification_service.mark_invitation_used(invitation_token)

    # 0. Check SaaS Quota limits before creating session
    quota = billing_service.check_quota(target_org_id, "start_interview")
    if not quota.get("allowed", True):
        raise HTTPException(status_code=402, detail=quota.get("reason", "Monthly interview quota exceeded. Please upgrade."))

    session = session_manager.create_session(config)
    q = session.current_question

    # Trigger interview.started webhook
    try:
        integration_service.enqueue_webhook_event(
            org_id=target_org_id,
            event_type="interview.started",
            payload_data={
                "session_id": session.session_id,
                "candidate_id": config.candidate_id,
                "role_id": config.role_id,
                "role_name": session.config.role_name,
                "started_at": time.time()
            }
        )
    except Exception as whe:
        logger.warning(f"Failed to enqueue interview.started webhook: {whe}")

    prompt_text = q.title
    if config.language == "te-IN" and q.title_te:
        prompt_text = q.title_te
    elif config.language == "hi-IN" and q.title_hi:
        prompt_text = q.title_hi

    # Synthesize AI Interviewer opening speech with Gnani Timbre TTS
    audio_b64, is_live_tts = await gnani_tts.synthesize(
        text=prompt_text,
        language=config.language
    )

    return {
        "session_id": session.session_id,
        "mode": session.config.mode,
        "stage": session.stage,
        "role_name": session.config.role_name,
        "current_index": session.current_index,
        "total_questions": session.total_questions,
        "question": {
            "id": q.id,
            "title": prompt_text,
            "category": q.category,
            "context": q.context,
            "difficulty": q.difficulty,
            "key_points": q.key_points,
            "stage": session.stage
        },
        "question_audio_b64": audio_b64,
        "is_live_tts": is_live_tts
    }

@app.post("/api/session/answer", response_model=Dict[str, Any])
async def submit_session_answer(
    session_id: str = Form(...),
    question_id: str = Form(...),
    language: str = Form("en-IN"),
    audio: UploadFile = File(...)
):
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found or expired.")

    filename = audio.filename or "recording.webm"
    content_type = audio.content_type or "audio/webm"

    try:
        audio_bytes = await audio.read()
    except Exception as e:
        logger.error(f"Failed to read audio stream: {e}")
        raise HTTPException(status_code=400, detail="Could not read uploaded audio.")

    byte_size = len(audio_bytes) if audio_bytes else 0
    if not audio_bytes or byte_size < 100:
        raise HTTPException(
            status_code=400,
            detail="Recorded audio response was empty or too short. Please speak clearly into your microphone."
        )

    # 1. Transcribe strictly via Gnani Prisma STT (v3)
    try:
        transcript, detected_lang = await gnani_stt.transcribe(
            audio_bytes=audio_bytes,
            filename=filename,
            content_type=content_type,
            language_code=language
        )
        # Meter STT Request
        org_id = getattr(session.config, "org_id", "org_default") or "org_default"
        billing_service.record_usage(
            org_id=org_id,
            metric_type="stt_requests",
            quantity=1.0,
            unit="requests",
            idempotency_key=f"stt_{session_id}_{question_id}_{round(time.time(), 1)}",
            reference_id=session_id
        )
    except HTTPException as e:
        if e.status_code == 422:
            # Graceful audio fallback: candidate audio had silence or no detectable speech
            logger.info("Silence detected by Gnani Prisma STT, falling back to neutral speech placeholder.")
            transcript = "Candidate provided minimal or silent response to the interview question."
            detected_lang = language
        else:
            raise e

    # 2. Rubric Evaluation
    q = session.current_question
    eval_res = evaluator.evaluate(
        transcript=transcript,
        category_id=session.config.role_id,
        question_title=q.title,
        key_points=q.key_points,
        language=language
    )

    question_eval = QuestionEvaluation(
        question_id=q.id,
        question_title=q.title,
        transcript=transcript,
        detected_language=detected_lang,
        overall_score=eval_res["overall_score"],
        relevance_score=eval_res["relevance_score"],
        problem_solving_score=eval_res["problem_solving_score"],
        communication_score=eval_res["communication_score"],
        technical_score=eval_res["technical_score"],
        strengths=eval_res["strengths"],
        improvements=eval_res["improvements"],
        spoken_feedback=eval_res["spoken_feedback"],
        interviewer_audio_b64=None,
        extracted_concepts=eval_res.get("extracted_concepts", []),
        evidence_notes=eval_res.get("evidence_notes"),
        evaluated_competency=eval_res.get("evaluated_competency"),
        rubric_criteria_matched=eval_res.get("rubric_criteria_matched", [])
    )

    # 3. Advance session state using Adaptive Conversation Engine
    advance_res = session_manager.record_answer_and_advance(session_id, question_eval)
    if not advance_res:
        raise HTTPException(status_code=500, detail="Failed to advance interview session.")

    updated_session, next_q, speech_text, next_stage = advance_res

    next_question_payload = None
    next_question_audio_b64 = None

    # 4. Synthesize spoken prompt for next question with Gnani Timbre TTS
    if next_q:
        next_question_payload = {
            "id": next_q.id,
            "title": next_q.title,
            "category": next_q.category,
            "context": next_q.context,
            "difficulty": next_q.difficulty,
            "key_points": next_q.key_points,
            "stage": next_stage
        }

        next_question_audio_b64, is_live_tts = await gnani_tts.synthesize(
            text=speech_text,
            language=language
        )
        if is_live_tts:
            org_id = getattr(session.config, "org_id", "org_default") or "org_default"
            billing_service.record_usage(
                org_id=org_id,
                metric_type="tts_requests",
                quantity=1.0,
                unit="requests",
                idempotency_key=f"tts_q_{session_id}_{next_q.id}",
                reference_id=session_id
            )

    return {
        "session_status": updated_session.status,
        "stage": updated_session.stage,
        "current_index": updated_session.current_index,
        "total_questions": updated_session.total_questions,
        "evaluation": question_eval,
        "feedback_audio_b64": None,
        "next_question": next_question_payload,
        "next_question_audio_b64": next_question_audio_b64
    }

@app.post("/api/session/log-integrity")
def log_session_integrity(payload: LogIntegrityRequest):
    """
    Consent-based objective integrity event logging.
    Distinguishes confirmed technical events from uncertain observations.
    """
    success = session_manager.log_integrity_event(
        session_id=payload.session_id,
        category=payload.category,
        event_type=payload.event_type,
        detail=payload.detail,
        duration_seconds=payload.duration_seconds
    )
    if not success:
        raise HTTPException(status_code=404, detail="Session not found.")
    return {"status": "recorded"}

class SessionActionRequest(BaseModel):
    session_id: str
    reason: Optional[str] = "Hardware stream disconnected"

@app.post("/api/session/pause")
def pause_session(payload: SessionActionRequest):
    success = session_manager.pause_session_for_disconnection(payload.session_id, payload.reason or "Hardware stream disconnected")
    if not success:
        raise HTTPException(status_code=404, detail="Session not found.")
    return {"status": "paused"}

@app.post("/api/session/resume")
def resume_session(payload: SessionActionRequest):
    success = session_manager.resume_session(payload.session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found.")
    return {"status": "resumed"}

@app.post("/api/session/emergency-exit")
def emergency_exit_session(payload: SessionActionRequest):
    success = session_manager.emergency_exit_session(payload.session_id, payload.reason or "Emergency exit by candidate")
    if not success:
        raise HTTPException(status_code=404, detail="Session not found.")
    return {"status": "exited"}

# --- Secure Stored Recording Endpoints ---

@app.post("/api/session/upload-recording")
async def upload_session_recording(
    session_id: str = Form(...),
    mode: str = Form("practice"),
    consent: bool = Form(False),
    duration: float = Form(0.0),
    video: UploadFile = File(...)
):
    """
    Stores an encrypted combined audio/video recording.
    Requires explicit consent. Video is never saved without consent.
    """
    if not consent:
        raise HTTPException(status_code=403, detail="Storage rejected: Candidate consent was not granted.")

    raw_bytes = await video.read()
    if not raw_bytes or len(raw_bytes) < 100:
        raise HTTPException(status_code=400, detail="Invalid recording stream.")

    meta = secure_recording_manager.save_recording(
        session_id=session_id,
        raw_bytes=raw_bytes,
        interview_mode=mode,
        duration_seconds=duration,
        consent_given=consent
    )

    return {
        "status": "encrypted_and_stored",
        "recording_id": meta.recording_id,
        "byte_size": meta.byte_size,
        "is_encrypted": True,
        "retention_days": meta.retention_days
    }

@app.delete("/api/session/recording/{recording_id}")
def delete_stored_recording(recording_id: str, user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)):
    """Candidate or authorized recruiter deletion of practice/interview recordings."""
    deleted = secure_recording_manager.delete_recording(recording_id, candidate_or_admin_id="recruiter" if user else "candidate_self")
    if not deleted:
        raise HTTPException(status_code=404, detail="Recording not found or already deleted.")
    
    if user:
        secure_assess_db.record_audit_log(
            actor_id=user.get("sub", "recruiter_01"),
            actor_email=user.get("email", "recruiter@example.com"),
            actor_role=user.get("role", "recruiter"),
            action="DELETE_RECORDING",
            target_resource="RECORDING",
            resource_id=recording_id,
            details="Authorized deletion of encrypted session recording"
        )
    return {"status": "deleted"}

@app.get("/api/session/recording/{recording_id}/download")
def download_stored_recording(recording_id: str, user: Dict[str, Any] = Depends(require_recruiter_auth)):
    """
    Restricts access to encrypted session recordings to authenticated recruiters,
    enforcing cross-tenant ownership protection against IDOR.
    """
    # Enforce tenant ownership check
    org_id = user.get("org_id")
    role = user.get("role")
    
    # If not platform admin, verify recording session matches tenant org
    if role != "platform_admin" and org_id:
        # Check sessions
        persisted = secure_assess_db.get_persisted_session(recording_id, org_id=org_id)
        if not persisted:
            # Check by recording_id or session_id
            all_sess = secure_assess_db.get_all_persisted_sessions(org_id=org_id)
            matching = [s for s in all_sess if s["session_id"] == recording_id or recording_id in s["session_id"]]
            if not matching and org_id != "org_default":
                raise HTTPException(status_code=403, detail="Access denied: Cross-tenant recording access is strictly forbidden.")

    try:
        raw_bytes = secure_recording_manager.read_decrypted_recording(recording_id, requester_role=user.get("role", "recruiter"))
        if not raw_bytes:
            raise HTTPException(status_code=404, detail="Recording not found or unavailable.")
        
        secure_assess_db.record_audit_log(
            actor_id=user.get("sub", "recruiter_01"),
            actor_email=user.get("email", "recruiter@example.com"),
            actor_role=user.get("role", "recruiter"),
            action="ACCESS_RECORDING",
            target_resource="RECORDING",
            resource_id=recording_id,
            details="Recruiter downloaded/reviewed decrypted session recording",
            org_id=org_id or "org_default"
        )
        return Response(content=raw_bytes, media_type="video/webm")
    except PermissionError as pe:
        raise HTTPException(status_code=403, detail=str(pe))

@app.get("/api/session/{session_id}/report", response_model=FinalReport)
def get_session_report(session_id: str, user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)):
    org_id = user.get("org_id") if user else None
    role = user.get("role") if user else None

    # Check if saved in SQLite with tenant check if authenticated
    if user and role != "platform_admin" and org_id:
        persisted = secure_assess_db.get_persisted_session(session_id, org_id=org_id)
        if not persisted:
            # Check if this session exists in another tenant (IDOR attempt)
            other_tenant_session = secure_assess_db.get_persisted_session(session_id)
            if other_tenant_session and other_tenant_session.get("org_id") != org_id:
                raise HTTPException(status_code=403, detail="Access denied: Cannot access candidate report belonging to another organization.")

    report = session_manager.generate_final_report(session_id)
    if not report:
        persisted = secure_assess_db.get_persisted_session(session_id)
        if persisted and persisted.get("final_report"):
            report = FinalReport(**persisted["final_report"])
        else:
            raise HTTPException(
                status_code=400, 
                detail="Session has not completed any evaluated questions yet."
            )
    
    if user and user.get("role") != "candidate":
        secure_assess_db.record_audit_log(
            actor_id=user.get("sub", "recruiter_01"),
            actor_email=user.get("email", "recruiter@example.com"),
            actor_role=user.get("role", "recruiter"),
            action="ACCESS_CANDIDATE_REPORT",
            target_resource="SESSION_REPORT",
            resource_id=session_id,
            details="Recruiter reviewed candidate final assessment report",
            org_id=org_id or "org_default"
        )

    # Information Hiding: If accessed by an identified candidate in 'company' assessment mode,
    # sanitize internal recruiter scoring rubrics, evaluator notes, and proctor evidence.
    if user and user.get("role") == "candidate" and report.mode == "company":
        sanitized = report.model_copy(deep=True) if hasattr(report, "model_copy") else report.copy(deep=True)
        sanitized.evaluator_comments = "Interview completed and securely submitted to the recruitment team for evaluation."
        sanitized.evidence_breakdown = None
        sanitized_questions = []
        for q in sanitized.question_evaluations:
            q_clean = q.model_copy(deep=True) if hasattr(q, "model_copy") else q.copy(deep=True)
            q_clean.spoken_feedback = "Your answer was recorded and submitted for employer evaluation."
            sanitized_questions.append(q_clean)
        sanitized.question_evaluations = sanitized_questions
        return sanitized

    return report

@app.post("/api/tts")
async def text_to_speech(payload: TTSRequest):
    if not payload.text or not payload.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    audio_b64, is_live = await gnani_tts.synthesize(
        text=payload.text,
        language=payload.language or "en-IN",
        voice=payload.voice
    )

    return {
        "audio_base64": audio_b64,
        "is_live_gnani_tts": is_live,
        "language": payload.language,
        "voice": payload.voice or settings.GNANI_TTS_VOICE
    }

# ============================================================================
# GNANI SECUREASSESS MODULE — BALANCED SECURITY & INTEGRITY APIS
# ============================================================================

@app.get("/api/security/requirements")
def get_security_requirements(mode: str = "company"):
    """
    Returns security and diagnostics requirements for the assessment.
    """
    if mode == "company":
        return {
            "mode": "company",
            "camera_required": True,
            "microphone_required": True,
            "fullscreen_required": True,
            "screenshare_optional": True,
            "browser_apis_required": ["mediaDevices", "AudioContext", "fullscreenEnabled", "crypto"],
            "max_tolerated_latency_ms": 1500,
            "min_throughput_kbps": 128,
            "monitoring_notice": (
                "Company assessment environment logs technical stability events (camera/mic tracks, tab visibility, "
                "fullscreen restoration) locally with candidate consent. Neutral evidence only; no cheating verdicts."
            )
        }
    return {
        "mode": "practice",
        "camera_required": False,
        "microphone_required": True,
        "fullscreen_required": False,
        "screenshare_optional": False,
        "browser_apis_required": ["mediaDevices", "AudioContext"],
        "monitoring_notice": "Practice mode: self-paced preparation with candidate controls."
    }

@app.post("/api/security/diagnostics")
def record_security_diagnostics(payload: SecurityDiagnosticsPayload):
    """
    Records Phase 1 pre-interview readiness diagnostics results.
    Validates mandatory camera and microphone verification for Company Mode.
    """
    session = session_manager.get_session(payload.session_id)
    if not session:
        # Allow pre-session verification by registering diagnostics under session token
        pass

    result = secure_assess_db.record_diagnostics(payload)
    return result

@app.post("/api/security/consent")
def record_candidate_consent(payload: SecurityConsentPayload):
    """
    Records candidate informed consent or consent withdrawal.
    """
    result = secure_assess_db.record_consent(payload)
    # Log withdrawal if candidate withdrew
    if payload.consent_withdrawn:
        secure_assess_db.record_event(SecurityEventPayload(
            session_id=payload.session_id,
            event_type="consent_withdrawn",
            category="confirmed_technical_event",
            detail=f"Candidate withdrew consent: {payload.withdrawal_reason or 'No reason provided'}"
        ))
    return result

@app.post("/api/security/events")
def record_security_event(payload: SecurityEventPayload):
    """
    Records tamper-evident integrity event with SHA-256 block chaining.
    """
    VALID_EVENT_TYPES = {
        "camera_disconnected", "camera_restored", "microphone_muted", "microphone_restored",
        "tab_hidden", "tab_visible", "tab_restored", "window_blur", "window_focus",
        "fullscreen_exited", "fullscreen_restored", "fullscreen_entered",
        "screenshare_started", "screenshare_stopped",
        "network_interrupted", "network_recovered", "network_offline", "network_online",
        "face_missing", "multiple_faces", "face_restored", "consent_withdrawn", "device_pause"
    }

    if payload.event_type not in VALID_EVENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid event type '{payload.event_type}'. Must be one of registered telemetry metrics."
        )

    # Record in persistent tamper-evident database
    result = secure_assess_db.record_event(payload)

    # Mirror to in-memory session manager if session is live
    session = session_manager.get_session(payload.session_id)
    if session:
        session_manager.log_integrity_event(
            session_id=payload.session_id,
            category=payload.category,
            event_type=payload.event_type,
            detail=payload.detail,
            duration_seconds=payload.duration_seconds
        )

    return result

@app.get("/api/security/events/{session_id}")
def get_security_events(session_id: str):
    """
    Retrieves chronological tamper-evident audit timeline for a session.
    """
    events = secure_assess_db.get_events(session_id)
    return {"session_id": session_id, "events": events, "count": len(events)}

@app.get("/api/security/report/{session_id}")
def get_security_report(session_id: str):
    """
    Generates structured system readiness and integrity audit report.
    """
    report = secure_assess_db.get_security_report(session_id)
    if not report.get("readiness_diagnostics") and not report.get("audit_timeline"):
        raise HTTPException(status_code=404, detail="No SecureAssess audit records found for session.")
    return report

PHOTO_STORAGE_DIR = os.path.join(os.path.dirname(__file__), "storage", "identity_photos")
os.makedirs(PHOTO_STORAGE_DIR, exist_ok=True)

class IdentityPhotoUpload(BaseModel):
    session_id: str
    candidate_id: str = "candidate_self"
    photo_b64: str
    consent_granted: bool = True

@app.post("/api/security/identity-photo")
def upload_identity_photo(payload: IdentityPhotoUpload):
    """
    Consented identity verification photo capture.
    Stores photo privately in protected backend storage for recruiter review.
    Does not expose to public directories or make biometric face recognition claims.
    """
    if not payload.consent_granted:
        raise HTTPException(status_code=403, detail="Cannot upload identity photo without candidate consent.")

    clean_b64 = payload.photo_b64
    if clean_b64.startswith("data:image"):
        clean_b64 = clean_b64.split(",", 1)[1]

    try:
        raw_bytes = base64.b64decode(clean_b64)
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid base64 image data.")

    if len(raw_bytes) < 1000:
        raise HTTPException(status_code=400, detail="Image payload too small or empty.")

    filename = f"id_photo_{payload.session_id}_{uuid.uuid4().hex[:8]}.jpg"
    file_path = os.path.join(PHOTO_STORAGE_DIR, filename)

    with open(file_path, "wb") as f:
        f.write(raw_bytes)

    res = secure_assess_db.record_identity_photo(
        session_id=payload.session_id,
        candidate_id=payload.candidate_id,
        photo_filename=filename,
        file_size_bytes=len(raw_bytes),
        consent_granted=payload.consent_granted
    )

    # Log an objective audit event
    secure_assess_db.record_event(SecurityEventPayload(
        session_id=payload.session_id,
        event_type="identity_photo_confirmed",
        category="confirmed_technical_event",
        detail="Candidate captured and confirmed identity photo with explicit consent for recruiter review."
    ))

    return res

@app.post("/api/security/session/heartbeat")
def post_session_heartbeat(payload: HeartbeatPayload):
    """
    Records periodic 15-second heartbeat maintaining session liveness.
    """
    return secure_assess_db.record_heartbeat(payload)

# ============================================================================
# AUDIT TRAIL & RETENTION ENFORCEMENT APIS (PHASE 6)
# ============================================================================

@app.get("/api/security/audit-trail")
def get_audit_trail(limit: int = 50, user: Dict[str, Any] = Depends(require_recruiter_auth)):
    """
    Returns immutable recruiter action logs: report views, recording downloads/deletions,
    candidate data exports, and configuration updates.
    """
    logs = secure_assess_db.get_audit_logs(limit=min(limit, 200))
    return {
        "audit_logs": logs,
        "count": len(logs)
    }

class RetentionEnforcementRequest(BaseModel):
    retention_days: int = 30

@app.post("/api/security/enforce-retention")
def trigger_retention_enforcement(
    payload: RetentionEnforcementRequest,
    user: Dict[str, Any] = Depends(require_recruiter_auth)
):
    """
    Enforces configured data retention policy across SQLite diagnostics and encrypted recordings.
    """
    db_purged = secure_assess_db.enforce_retention_policy(payload.retention_days)
    recordings_purged = secure_recording_manager.enforce_retention(payload.retention_days)
    
    secure_assess_db.record_audit_log(
        actor_id=user.get("sub", "recruiter_01"),
        actor_email=user.get("email", "recruiter@example.com"),
        actor_role=user.get("role", "recruiter"),
        action="ENFORCE_RETENTION",
        target_resource="STORAGE_SYSTEM",
        details=f"Retention purge executed for >{payload.retention_days} days. {recordings_purged} recordings purged."
    )

    return {
        "status": "enforced",
        "retention_days": payload.retention_days,
        "database_records_purged": db_purged,
        "encrypted_recordings_purged": recordings_purged
    }

class CandidateExportAuditRequest(BaseModel):
    format: str = "csv"
    scope: str = "all_candidates"
    candidate_id: Optional[str] = None

@app.post("/api/security/audit-export")
def audit_candidate_export(
    payload: CandidateExportAuditRequest,
    user: Dict[str, Any] = Depends(require_recruiter_auth)
):
    """Logs recruiter candidate list/profile export actions."""
    res = secure_assess_db.record_audit_log(
        actor_id=user.get("sub", "recruiter_01"),
        actor_email=user.get("email", "recruiter@example.com"),
        actor_role=user.get("role", "recruiter"),
        action="EXPORT_CANDIDATE_DATA",
        target_resource="CANDIDATE_DATA",
        resource_id=payload.candidate_id,
        details=f"Export format: {payload.format}, scope: {payload.scope}"
    )
    return {"status": "audit_logged", "log_id": res["log_id"]}

# ============================================================================
# DATABASE BACKUP & RESTORE APIS (PHASE 8)
# ============================================================================

@app.post("/api/admin/database/backup")
def trigger_database_backup(user: Dict[str, Any] = Depends(require_recruiter_auth)):
    """Creates a point-in-time SQLite backup using non-blocking online backup API."""
    from app.services.security_service import db_manager
    res = db_manager.create_backup(label="recruiter_manual")
    secure_assess_db.record_audit_log(
        actor_id=user.get("sub", "recruiter_01"),
        actor_email=user.get("email", "recruiter@example.com"),
        actor_role=user.get("role", "recruiter"),
        action="BACKUP_DATABASE",
        target_resource="DATABASE",
        details=f"Backup file: {res['backup_filename']} ({res['byte_size']} bytes)"
    )
    return res

@app.get("/api/admin/database/backups")
def list_database_backups(user: Dict[str, Any] = Depends(require_recruiter_auth)):
    """Lists available point-in-time database backup snapshots."""
    from app.services.security_service import db_manager
    backups = db_manager.list_backups()
    return {"backups": backups, "count": len(backups)}

class RestoreBackupRequest(BaseModel):
    backup_filename: str

@app.post("/api/admin/database/restore")
def restore_database_backup(payload: RestoreBackupRequest, user: Dict[str, Any] = Depends(require_recruiter_auth)):
    """Restores database from specified backup snapshot with pre-restore safety copy."""
    from app.services.security_service import db_manager
    success = db_manager.restore_backup(payload.backup_filename)
    secure_assess_db.record_audit_log(
        actor_id=user.get("sub", "recruiter_01"),
        actor_email=user.get("email", "recruiter@example.com"),
        actor_role=user.get("role", "recruiter"),
        action="RESTORE_DATABASE",
        target_resource="DATABASE",
        details=f"Restored from backup: {payload.backup_filename}"
    )
    return {"status": "restored", "backup_filename": payload.backup_filename}

# ============================================================================
# ENTERPRISE ANALYTICS & INTELLIGENT INSIGHTS APIS (PHASE 9 & 11)
# ============================================================================

@app.get("/api/analytics/dashboard-summary")
def get_analytics_dashboard_summary(user: Dict[str, Any] = Depends(require_recruiter_auth)):
    """Provides high-level cohort summaries isolated by recruiter tenant."""
    from app.services.analytics_service import analytics_service
    org_id = user.get("org_id") if user.get("role") != "platform_admin" else None
    return analytics_service.get_dashboard_summary(org_id=org_id)

@app.get("/api/analytics/roles")
def get_analytics_by_role(role_id: Optional[str] = None, user: Dict[str, Any] = Depends(require_recruiter_auth)):
    """Provides role-wise average scores, dimension radar averages, and candidate counts for tenant."""
    from app.services.analytics_service import analytics_service
    org_id = user.get("org_id") if user.get("role") != "platform_admin" else None
    return {"role_analytics": analytics_service.get_role_analytics(role_id=role_id, org_id=org_id)}

class CandidateComparisonRequest(BaseModel):
    session_ids: List[str]

@app.post("/api/analytics/compare")
def compare_selected_candidates(payload: CandidateComparisonRequest, user: Dict[str, Any] = Depends(require_recruiter_auth)):
    """Compares competencies, dimension radar scores, and growth areas for selected candidates."""
    from app.services.analytics_service import analytics_service
    org_id = user.get("org_id") if user.get("role") != "platform_admin" else None
    return {
        "comparison": analytics_service.compare_candidates(payload.session_ids, org_id=org_id),
        "count": len(payload.session_ids)
    }

@app.get("/api/analytics/intelligent-insights")
def get_intelligent_insights(user: Dict[str, Any] = Depends(require_recruiter_auth)):
    """Extracts evidence-based cohort patterns, recurring strengths, and skill gaps for tenant."""
    from app.services.analytics_service import analytics_service
    org_id = user.get("org_id") if user.get("role") != "platform_admin" else None
    return analytics_service.generate_intelligent_insights(org_id=org_id)

# ============================================================================
# MULTI-TENANT SAAS ORGANIZATION & RECRUITER APIS (PHASE 11)
# ============================================================================

@app.post("/api/tenants/register", response_model=Dict[str, Any])
def register_organization(payload: OrganizationCreate):
    """
    Public Organization Registration / Onboarding endpoint.
    Creates an independent tenant workspace with customized branding and settings.
    """
    if not payload.name or not payload.name.strip():
        raise HTTPException(status_code=400, detail="Organization name is required.")
    if not payload.contact_email or "@" not in payload.contact_email:
        raise HTTPException(status_code=400, detail="Valid organization contact email is required.")

    # Check for slug conflict
    existing = secure_assess_db.get_organization_by_slug(payload.slug)
    if existing:
        raise HTTPException(status_code=409, detail="An organization with this slug/domain already exists.")

    org = secure_assess_db.create_organization(payload.dict())
    
    # Audit log
    secure_assess_db.record_audit_log(
        actor_id="tenant_registration",
        actor_email=payload.contact_email,
        actor_role="org_admin",
        action="REGISTER_ORGANIZATION",
        target_resource="ORGANIZATION",
        resource_id=org["org_id"],
        details=f"New organization registered: {payload.name} ({payload.slug})",
        org_id=org["org_id"]
    )
    return {"status": "created", "organization": org}

@app.get("/api/tenants/current")
def get_current_organization(user: Dict[str, Any] = Depends(require_recruiter_auth)):
    """Retrieves current recruiter's active organization profile and branding."""
    org_id = user.get("org_id", "org_default")
    org = secure_assess_db.get_organization(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization tenant not found.")
    return {"organization": org}

@app.get("/api/tenants/public/{slug}")
def get_public_tenant_branding(slug: str):
    """Candidate-facing endpoint: fetches organization branding & allowed configs by slug."""
    org = secure_assess_db.get_organization_by_slug(slug)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found.")
    if not org.get("is_active", True):
        raise HTTPException(status_code=403, detail="Organization portal is currently inactive.")
    
    return {
        "org_id": org["org_id"],
        "name": org["name"],
        "slug": org["slug"],
        "branding": org["branding"],
        "portal_name": org["branding"].get("portal_name", org["name"])
    }

@app.put("/api/tenants/current")
def update_current_organization(
    payload: OrganizationUpdate,
    user: Dict[str, Any] = Depends(require_org_admin_auth)
):
    """Organization Admin: updates settings, contact info, and branding."""
    org_id = user.get("org_id", "org_default")
    updates = payload.dict(exclude_unset=True)
    
    # Organization admin cannot suspend themselves; only platform admin can alter is_active
    if user.get("role") != "platform_admin" and "is_active" in updates:
        updates.pop("is_active", None)

    updated_org = secure_assess_db.update_organization(org_id, updates)
    secure_assess_db.record_audit_log(
        actor_id=user.get("sub", "admin"),
        actor_email=user.get("email", "admin@org.com"),
        actor_role=user.get("role", "org_admin"),
        action="UPDATE_ORG_SETTINGS",
        target_resource="ORGANIZATION",
        resource_id=org_id,
        details="Updated organization branding/settings",
        org_id=org_id
    )
    return {"status": "updated", "organization": updated_org}

# --- Recruiter Team Management in Tenant ---

@app.get("/api/tenants/recruiters")
def list_org_recruiters(user: Dict[str, Any] = Depends(require_org_admin_auth)):
    """Lists recruiters in the current organization."""
    org_id = user.get("org_id", "org_default")
    recruiters = secure_assess_db.get_recruiters_for_org(org_id)
    return {"recruiters": recruiters, "count": len(recruiters), "org_id": org_id}

@app.post("/api/tenants/recruiters/invite")
def invite_or_create_recruiter(
    payload: RecruiterRegister,
    user: Dict[str, Any] = Depends(require_org_admin_auth)
):
    """Organization Admin: invites or provisions a recruiter in the organization."""
    caller_org = user.get("org_id", "org_default")
    caller_role = user.get("role", "org_admin")

    # Enforce tenant match: non-superadmins cannot add recruiters to another tenant
    target_org = caller_org if caller_role != "platform_admin" else (payload.org_id or caller_org)

    # Check SaaS Recruiter Seat Quota
    quota = billing_service.check_quota(target_org, "create_recruiter")
    if not quota.get("allowed", True):
        raise HTTPException(status_code=402, detail=quota.get("reason", "Recruiter seats quota reached. Please upgrade."))

    data = payload.dict()
    data["org_id"] = target_org
    data["invited_by"] = user.get("email")

    try:
        new_recruiter = secure_assess_db.register_recruiter(data)
    except Exception as e:
        if "UNIQUE" in str(e) or "PRIMARY" in str(e):
            raise HTTPException(status_code=409, detail="A user with this email already exists.")
        raise HTTPException(status_code=400, detail=str(e))

    secure_assess_db.record_audit_log(
        actor_id=user.get("sub", "admin"),
        actor_email=user.get("email", "admin@org.com"),
        actor_role=caller_role,
        action="PROVISION_RECRUITER",
        target_resource="RECRUITER",
        resource_id=new_recruiter["user_id"],
        details=f"Provisioned recruiter {payload.email} ({payload.role})",
        org_id=target_org
    )
    return {"status": "created", "recruiter": new_recruiter}

class RecruiterStatusUpdate(BaseModel):
    user_id: str
    is_active: bool

@app.put("/api/tenants/recruiters/status")
def update_recruiter_status(
    payload: RecruiterStatusUpdate,
    user: Dict[str, Any] = Depends(require_org_admin_auth)
):
    """Enables or disables a recruiter's login access in this organization."""
    org_id = user.get("org_id", "org_default")
    role = user.get("role", "org_admin")
    
    # Protect from self-suspension
    if payload.user_id == user.get("sub"):
        raise HTTPException(status_code=400, detail="Cannot alter your own active status.")

    scoped_org = None if role == "platform_admin" else org_id
    success = secure_assess_db.update_recruiter_status(payload.user_id, payload.is_active, org_id=scoped_org)
    if not success:
        raise HTTPException(status_code=404, detail="Recruiter not found in this organization.")

    secure_assess_db.record_audit_log(
        actor_id=user.get("sub", "admin"),
        actor_email=user.get("email"),
        actor_role=role,
        action="UPDATE_RECRUITER_STATUS",
        target_resource="RECRUITER",
        resource_id=payload.user_id,
        details=f"Set is_active={payload.is_active}",
        org_id=org_id
    )
    return {"status": "updated", "user_id": payload.user_id, "is_active": payload.is_active}

# --- Tenant-Specific Job Role APIs ---

@app.get("/api/tenants/roles")
def list_tenant_roles(user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)):
    """Lists standard roles combined with tenant-specific custom job roles."""
    org_id = user.get("org_id", "org_default") if user else "org_default"
    custom_roles = secure_assess_db.list_org_job_roles(org_id)
    
    # Merge with default roles
    merged = []
    for r in ROLES_METADATA:
        m = dict(r)
        m["title"] = r.get("name") or r.get("title")
        merged.append(m)

    for cr in custom_roles:
        merged.append({
            "id": cr["role_id"],
            "name": cr["title"],
            "title": cr["title"],
            "department": cr["department"],
            "skills": cr["required_skills"],
            "default_tech": cr["required_skills"],
            "experience_level": cr["experience_level"],
            "target_questions": cr["target_questions"],
            "duration_minutes": cr["interview_duration_minutes"],
            "is_tenant_custom": True,
            "org_id": org_id
        })
    return {"roles": merged, "count": len(merged), "org_id": org_id}

@app.post("/api/tenants/roles")
def create_tenant_custom_role(
    payload: OrgJobRoleCreate,
    user: Dict[str, Any] = Depends(require_recruiter_auth)
):
    """Adds a new job role specifically for this organization tenant."""
    org_id = user.get("org_id", "org_default")

    # Check SaaS Active Roles Quota
    quota = billing_service.check_quota(org_id, "create_role")
    if not quota.get("allowed", True):
        raise HTTPException(status_code=402, detail=quota.get("reason", "Custom job roles limit reached. Please upgrade."))

    created = secure_assess_db.create_org_job_role(org_id, payload.dict())

    secure_assess_db.record_audit_log(
        actor_id=user.get("sub"),
        actor_email=user.get("email"),
        actor_role=user.get("role"),
        action="CREATE_ORG_ROLE",
        target_resource="ORG_ROLE",
        resource_id=payload.role_id,
        details=f"Created custom role {payload.title} for organization",
        org_id=org_id
    )
    return {"status": "created", "role": created}

# ============================================================================
# PLATFORM ADMINISTRATION APIS (SUPERADMIN ONLY)
# ============================================================================

@app.get("/api/platform/organizations")
def platform_list_all_organizations(user: Dict[str, Any] = Depends(require_platform_admin_auth)):
    """Lists all tenant organizations with operational status and metadata."""
    orgs = secure_assess_db.list_all_organizations()
    return {"organizations": orgs, "count": len(orgs)}

class OrganizationStatusPayload(BaseModel):
    org_id: str
    is_active: bool
    reason: Optional[str] = "Administrative action"

@app.put("/api/platform/organization/status")
def platform_update_organization_status(
    payload: OrganizationStatusPayload,
    user: Dict[str, Any] = Depends(require_platform_admin_auth)
):
    """Superadmin: activates or suspends an organization tenant."""
    updated = secure_assess_db.update_organization(payload.org_id, {"is_active": payload.is_active})
    if not updated:
        raise HTTPException(status_code=404, detail="Organization not found.")

    secure_assess_db.record_audit_log(
        actor_id=user.get("sub"),
        actor_email=user.get("email"),
        actor_role="platform_admin",
        action="UPDATE_TENANT_STATUS",
        target_resource="ORGANIZATION",
        resource_id=payload.org_id,
        details=f"Set is_active={payload.is_active}. Reason: {payload.reason}",
        org_id="system"
    )
    return {"status": "updated", "organization": updated}

@app.get("/api/platform/metrics")
def platform_aggregate_metrics(user: Dict[str, Any] = Depends(require_platform_admin_auth)):
    """
    Platform Administrator aggregate metrics across all tenants.
    Does not expose sensitive candidate recordings or private transcripts.
    """
    orgs = secure_assess_db.list_all_organizations()
    with secure_assess_db._get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM candidates")
        total_candidates = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM sessions")
        total_sessions = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM recruiters")
        total_recruiters = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM audit_logs")
        total_audit_events = cursor.fetchone()[0]

    return {
        "total_tenants": len(orgs),
        "active_tenants": sum(1 for o in orgs if o.get("is_active")),
        "suspended_tenants": sum(1 for o in orgs if not o.get("is_active")),
        "total_candidates_platform": total_candidates,
        "total_sessions_platform": total_sessions,
        "total_recruiters_platform": total_recruiters,
        "total_audit_events_platform": total_audit_events,
        "platform_status": "operational"
    }

# ============================================================================
# ENTERPRISE NOTIFICATIONS & INVITATION APIS (PHASE 12)
# ============================================================================

@app.post("/api/invitations/create", response_model=Dict[str, Any])
def create_candidate_invitation(
    payload: InvitationCreate,
    user: Dict[str, Any] = Depends(require_recruiter_auth)
):
    """
    Recruiter: schedules an interview, generates single-use token,
    and schedules branded invitation and reminder emails.
    """
    org_id = user.get("org_id", "org_default")
    inv_data = payload.dict()
    inv_data["created_by"] = user.get("email", "recruiter")

    invitation = notification_service.create_interview_invitation(org_id, inv_data)
    
    secure_assess_db.record_audit_log(
        actor_id=user.get("sub", "recruiter"),
        actor_email=user.get("email", "recruiter"),
        actor_role=user.get("role", "recruiter"),
        action="CREATE_INVITATION",
        target_resource="INVITATION",
        resource_id=invitation["invitation_id"],
        details=f"Invited candidate {payload.candidate_email} for {payload.role_title}",
        org_id=org_id
    )

    return {"status": "created", "invitation": invitation}

@app.get("/api/invitations")
def list_candidate_invitations(user: Dict[str, Any] = Depends(require_recruiter_auth)):
    """Lists scheduled invitations for recruiter's organization."""
    org_id = user.get("org_id", "org_default")
    invitations = notification_service.list_invitations(org_id)
    return {"invitations": invitations, "count": len(invitations)}

@app.post("/api/invitations/{invitation_id}/resend")
def resend_candidate_invitation(invitation_id: str, user: Dict[str, Any] = Depends(require_recruiter_auth)):
    """Resends invitation notification to candidate."""
    org_id = user.get("org_id", "org_default")
    updated = notification_service.resend_invitation(invitation_id, org_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Invitation not found or cannot be resent.")

    secure_assess_db.record_audit_log(
        actor_id=user.get("sub"),
        actor_email=user.get("email"),
        actor_role=user.get("role"),
        action="RESEND_INVITATION",
        target_resource="INVITATION",
        resource_id=invitation_id,
        details="Resent invitation email to candidate",
        org_id=org_id
    )
    return {"status": "resent", "invitation": updated}

@app.post("/api/invitations/{invitation_id}/cancel")
def cancel_candidate_invitation(invitation_id: str, user: Dict[str, Any] = Depends(require_recruiter_auth)):
    """Cancels invitation and auto-cancels scheduled reminders."""
    org_id = user.get("org_id", "org_default")
    success = notification_service.cancel_invitation(invitation_id, org_id)
    if not success:
        raise HTTPException(status_code=404, detail="Invitation not found or already cancelled.")

    secure_assess_db.record_audit_log(
        actor_id=user.get("sub"),
        actor_email=user.get("email"),
        actor_role=user.get("role"),
        action="CANCEL_INVITATION",
        target_resource="INVITATION",
        resource_id=invitation_id,
        details="Cancelled candidate interview invitation and reminders",
        org_id=org_id
    )
    return {"status": "cancelled", "invitation_id": invitation_id}

@app.get("/api/invitations/validate/{token}")
def validate_invitation_token(token: str):
    """Candidate entrypoint: checks token validity, expiry, role info, and branding."""
    inv = notification_service.get_invitation_by_token(token)
    if not inv:
        raise HTTPException(status_code=404, detail="Invalid invitation token.")
    if inv["status"] in ("ACCEPTED", "CANCELLED", "EXPIRED"):
        raise HTTPException(status_code=400, detail=f"This invitation has already been {inv['status'].lower()}.")
    if inv["token_expires_at"] < time.time():
        raise HTTPException(status_code=400, detail="This invitation link has expired.")

    org = secure_assess_db.get_organization(inv["org_id"])
    return {
        "valid": True,
        "invitation": inv,
        "organization": {
            "name": org["name"] if org else "Gnani Organization",
            "branding": org["branding"] if org else {}
        }
    }

# --- Notification Queue & Delivery Telemetry ---

@app.get("/api/notifications/logs")
def get_notification_logs(user: Dict[str, Any] = Depends(require_recruiter_auth)):
    """Returns email delivery telemetry and scheduled reminder queue for organization."""
    org_id = user.get("org_id", "org_default")
    logs = notification_service.list_notification_logs(org_id)
    return {"logs": logs, "count": len(logs)}

@app.post("/api/notifications/process-queue")
def trigger_notification_queue_dispatch(user: Dict[str, Any] = Depends(require_recruiter_auth)):
    """Manually triggers processing of pending email/reminder queue."""
    result = notification_service.process_pending_notifications()
    return {"status": "processed", "result": result}

# --- In-App Recruiter Notifications ---

@app.get("/api/notifications/in-app")
def get_in_app_notifications(user: Dict[str, Any] = Depends(require_recruiter_auth)):
    """Returns in-app notifications and unread badge count."""
    org_id = user.get("org_id", "org_default")
    notifications = notification_service.get_in_app_notifications(org_id)
    unread_count = notification_service.get_unread_count(org_id)
    return {
        "notifications": notifications,
        "unread_count": unread_count,
        "count": len(notifications)
    }

@app.post("/api/notifications/in-app/mark-read")
def mark_in_app_notifications_read(
    payload: InAppNotificationMarkRead,
    user: Dict[str, Any] = Depends(require_recruiter_auth)
):
    """Marks specified in-app notifications or all notifications as read."""
    org_id = user.get("org_id", "org_default")
    affected = notification_service.mark_in_app_notifications_read(
        org_id=org_id,
        ids=payload.notification_ids,
        mark_all=payload.mark_all
    )
    return {"status": "success", "marked_read_count": affected}

# =============================================================================
# Phase 13: SaaS Subscription, Billing & Usage Management APIs
# =============================================================================

# --- Plan Management (Public / Recruiter & Platform Admin) ---

@app.get("/api/billing/plans")
def list_subscription_plans():
    """Lists available public SaaS subscription plans."""
    plans = billing_service.list_plans(active_only=True)
    return {"plans": plans, "count": len(plans)}

@app.post("/api/billing/plans")
def upsert_subscription_plan(
    payload: SubscriptionPlanUpsert,
    user: Dict[str, Any] = Depends(require_platform_admin_auth)
):
    """Platform Admin: creates or updates a global subscription plan."""
    plan_dict = payload.dict(exclude_unset=True)
    plan = billing_service.upsert_plan(plan_dict)
    return {"status": "success", "plan": plan}

# --- Tenant Subscription & Usage Operations ---

@app.get("/api/billing/subscription")
def get_org_subscription(user: Dict[str, Any] = Depends(require_recruiter_auth)):
    """Organization Recruiter / Admin: retrieves current subscription details."""
    org_id = user.get("org_id", "org_default")
    subscription = billing_service.get_organization_subscription(org_id)
    return {"subscription": subscription}

@app.get("/api/billing/usage")
def get_org_usage(user: Dict[str, Any] = Depends(require_recruiter_auth)):
    """Organization Recruiter / Admin: retrieves current period metered usage vs plan limits."""
    org_id = user.get("org_id", "org_default")
    usage_info = billing_service.get_current_period_usage(org_id)
    return usage_info

@app.post("/api/billing/checkout")
def create_checkout_session(
    payload: CheckoutSessionCreate,
    user: Dict[str, Any] = Depends(require_org_admin_auth)
):
    """Organization Admin: creates a sandbox checkout session to upgrade/downgrade subscription."""
    org_id = user.get("org_id", "org_default")
    try:
        session = billing_service.create_checkout_session(
            org_id=org_id,
            target_plan_id=payload.plan_id,
            provider=payload.provider,
            currency=payload.currency
        )
        return {"status": "created", "checkout": session}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/billing/verify-payment")
def verify_payment_and_upgrade(
    payload: PaymentVerifyPayload,
    user: Dict[str, Any] = Depends(require_org_admin_auth)
):
    """
    Organization Admin: completes payment verification and activates upgraded subscription.
    Enforces strict tenant isolation: transaction org_id must match authenticated user.
    """
    org_id = user.get("org_id", "org_default")
    try:
        # 1. Verify transaction
        res = billing_service.verify_payment(
            transaction_id=payload.transaction_id,
            payment_id=payload.payment_id,
            signature=payload.signature,
            provider=payload.provider
        )
        if res.get("org_id") != org_id and user.get("role") != "platform_admin":
            raise HTTPException(status_code=403, detail="Cross-tenant payment authorization failed.")

        # 2. Extract transaction target plan to apply upgrade
        with billing_service._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT external_order_id, amount_cents FROM payment_transactions WHERE transaction_id = ?", (payload.transaction_id,))
            tx_row = cursor.fetchone()

        # Find plan matching the price
        target_plan_id = "plan_professional"
        if tx_row:
            plans = billing_service.list_plans(active_only=False)
            matched = [p for p in plans if p["price_cents"] == tx_row["amount_cents"]]
            if matched:
                target_plan_id = matched[0]["plan_id"]

        updated_sub = billing_service.upgrade_subscription(
            org_id=org_id,
            new_plan_id=target_plan_id,
            payment_provider=payload.provider,
            transaction_id=payload.transaction_id
        )

        return {"status": "upgraded", "subscription": updated_sub}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

@app.post("/api/billing/cancel")
def cancel_subscription(
    immediate: bool = False,
    user: Dict[str, Any] = Depends(require_org_admin_auth)
):
    """Organization Admin: schedules subscription cancellation."""
    org_id = user.get("org_id", "org_default")
    cancelled = billing_service.cancel_subscription(org_id=org_id, immediate=immediate)
    return {"status": "scheduled", "subscription": cancelled}

@app.post("/api/billing/renew")
def renew_subscription(user: Dict[str, Any] = Depends(require_org_admin_auth)):
    """Organization Admin: renews active or past-due subscription for another billing cycle."""
    org_id = user.get("org_id", "org_default")
    renewed = billing_service.renew_subscription(org_id)
    return {"status": "renewed", "subscription": renewed}

@app.get("/api/billing/history")
def get_payment_history(user: Dict[str, Any] = Depends(require_recruiter_auth)):
    """Organization Recruiter / Admin: lists invoice and payment history (strictly tenant-isolated)."""
    org_id = user.get("org_id", "org_default")
    history = billing_service.list_payment_history(org_id)
    return {"history": history, "count": len(history)}

@app.get("/api/billing/platform/overview")
def get_platform_billing_overview(user: Dict[str, Any] = Depends(require_platform_admin_auth)):
    """Platform Superadmin: aggregates subscription telemetry across all organizations."""
    overview = billing_service.get_platform_billing_overview()
    return overview

# --- Webhook Handlers (Mock / Stripe / Razorpay) ---

@app.post("/api/billing/webhook/{provider}")
async def handle_billing_webhook(
    provider: str,
    request: Request
):
    """
    Provider-agnostic payment webhook endpoint.
    Verifies cryptographic signatures before processing renewal or failed payment events.
    """
    body_bytes = await request.body()
    sig_header = request.headers.get("x-signature") or request.headers.get("stripe-signature") or ""
    
    # In mock / sandbox mode, verify mock signature or secret
    webhook_secret = os.getenv("PAYMENT_WEBHOOK_SECRET", "mock_webhook_secret_key")
    is_valid = billing_service.verify_webhook_signature(body_bytes, sig_header, webhook_secret, provider=provider)
    
    if not is_valid:
        logger.warning(f"Rejected invalid webhook signature from provider: {provider}")
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    try:
        data = json.loads(body_bytes.decode("utf-8"))
        event_type = data.get("event") or data.get("type")
        tx_id = data.get("transaction_id")

        if event_type == "payment.failed" and tx_id:
            billing_service.record_payment_failure(tx_id, reason=data.get("reason", "Card charge declined"))
            return {"status": "recorded_failure"}
        elif event_type == "payment.succeeded" and tx_id:
            payment_id = data.get("payment_id", f"pay_{str(uuid.uuid4())[:8]}")
            billing_service.verify_payment(tx_id, payment_id, provider=provider)
            return {"status": "processed_success"}

        return {"status": "received", "event": event_type}
    except Exception as e:
        logger.error(f"Error handling billing webhook: {e}")
        raise HTTPException(status_code=400, detail=str(e))

# =============================================================================
# Phase 14: Enterprise API, Webhooks & External Integrations
# =============================================================================

# --- API Key Authentication Dependency ---

def require_api_key_auth(required_scope: Optional[str] = None):
    """
    Factory dependency for validating incoming API keys in Authorization: Bearer gnani_live_...
    or X-API-Key: gnani_live_...
    """
    def _dependency(request: Request) -> Dict[str, Any]:
        raw_key = None
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer gnani_live_"):
            raw_key = auth_header.replace("Bearer ", "").strip()
        elif request.headers.get("X-API-Key"):
            raw_key = request.headers.get("X-API-Key").strip()

        if not raw_key:
            raise HTTPException(status_code=401, detail="API Key required. Provide via 'X-API-Key' or 'Authorization: Bearer <key>'.")

        key_ctx, err_reason = integration_service.authenticate_api_key(raw_key, required_scope=required_scope)
        if not key_ctx:
            if err_reason == "missing_scope":
                raise HTTPException(status_code=403, detail=f"Forbidden: Missing required scope '{required_scope}'.")
            elif err_reason in ("inactive_key", "expired_key"):
                raise HTTPException(status_code=401, detail=f"Unauthorized: API Key is {err_reason.replace('_', ' ')}.")
            else:
                raise HTTPException(status_code=401, detail="Unauthorized: Invalid API Key.")

        return key_ctx
    return _dependency

# --- API Key Management (Recruiter Workspace) ---

@app.get("/api/integrations/keys")
def list_org_api_keys(user: Dict[str, Any] = Depends(require_org_admin_auth)):
    """Organization Admin: lists active and revoked API keys (never plaintext)."""
    org_id = user.get("org_id", "org_default")
    keys = integration_service.list_api_keys(org_id)
    return {"api_keys": keys, "count": len(keys)}

@app.post("/api/integrations/keys", response_model=APIKeyCreatedResponse)
def create_org_api_key(
    payload: APIKeyCreate,
    user: Dict[str, Any] = Depends(require_org_admin_auth)
):
    """Organization Admin: generates a new scoped API key. Returns raw key once."""
    org_id = user.get("org_id", "org_default")
    key_record = integration_service.create_api_key(
        org_id=org_id,
        name=payload.name,
        scopes=payload.scopes,
        expires_days=payload.expires_days,
        created_by=user.get("sub")
    )
    secure_assess_db.record_audit_log(
        actor_id=user.get("sub", "admin"),
        actor_email=user.get("email", "admin@org.com"),
        actor_role=user.get("role", "org_admin"),
        action="CREATE_API_KEY",
        target_resource="API_KEY",
        resource_id=key_record["key_id"],
        details=f"Created API key {key_record['name']} with scopes: {key_record['scopes']}",
        org_id=org_id
    )
    return key_record

@app.post("/api/integrations/keys/{key_id}/rotate", response_model=APIKeyCreatedResponse)
def rotate_org_api_key(
    key_id: str,
    user: Dict[str, Any] = Depends(require_org_admin_auth)
):
    """Organization Admin: rotates an API key. Revokes old key and returns replacement raw key."""
    org_id = user.get("org_id", "org_default")
    rotated = integration_service.rotate_api_key(org_id, key_id)
    if not rotated:
        raise HTTPException(status_code=404, detail="API Key not found or does not belong to organization.")

    secure_assess_db.record_audit_log(
        actor_id=user.get("sub", "admin"),
        actor_email=user.get("email", "admin@org.com"),
        actor_role=user.get("role", "org_admin"),
        action="ROTATE_API_KEY",
        target_resource="API_KEY",
        resource_id=key_id,
        details=f"Rotated key to {rotated['key_id']}",
        org_id=org_id
    )
    return rotated

@app.delete("/api/integrations/keys/{key_id}")
def revoke_org_api_key(
    key_id: str,
    user: Dict[str, Any] = Depends(require_org_admin_auth)
):
    """Organization Admin: revokes an API key immediately."""
    org_id = user.get("org_id", "org_default")
    success = integration_service.revoke_api_key(org_id, key_id)
    if not success:
        raise HTTPException(status_code=404, detail="API Key not found or already revoked.")

    secure_assess_db.record_audit_log(
        actor_id=user.get("sub", "admin"),
        actor_email=user.get("email", "admin@org.com"),
        actor_role=user.get("role", "org_admin"),
        action="REVOKE_API_KEY",
        target_resource="API_KEY",
        resource_id=key_id,
        details=f"Revoked API key {key_id}",
        org_id=org_id
    )
    return {"status": "revoked", "key_id": key_id}

# --- Webhook Management (Recruiter Workspace) ---

@app.get("/api/integrations/webhooks")
def list_org_webhooks(user: Dict[str, Any] = Depends(require_recruiter_auth)):
    """Organization Recruiter / Admin: lists registered webhook endpoints."""
    org_id = user.get("org_id", "org_default")
    endpoints = integration_service.list_webhook_endpoints(org_id)
    return {"endpoints": endpoints, "count": len(endpoints), "available_events": AVAILABLE_WEBHOOK_EVENTS}

@app.post("/api/integrations/webhooks", response_model=WebhookEndpointCreatedResponse)
def register_org_webhook(
    payload: WebhookEndpointCreate,
    user: Dict[str, Any] = Depends(require_org_admin_auth)
):
    """Organization Admin: registers a webhook endpoint and generates signing secret."""
    org_id = user.get("org_id", "org_default")
    endpoint = integration_service.register_webhook_endpoint(
        org_id=org_id,
        url=payload.url,
        description=payload.description or "",
        events=payload.events
    )
    secure_assess_db.record_audit_log(
        actor_id=user.get("sub", "admin"),
        actor_email=user.get("email", "admin@org.com"),
        actor_role=user.get("role", "org_admin"),
        action="REGISTER_WEBHOOK",
        target_resource="WEBHOOK",
        resource_id=endpoint["endpoint_id"],
        details=f"Registered webhook endpoint {payload.url} for events: {payload.events}",
        org_id=org_id
    )
    return endpoint

@app.put("/api/integrations/webhooks/{endpoint_id}")
def update_org_webhook(
    endpoint_id: str,
    payload: WebhookEndpointUpdate,
    user: Dict[str, Any] = Depends(require_org_admin_auth)
):
    """Organization Admin: updates webhook URL, event subscriptions, or active status."""
    org_id = user.get("org_id", "org_default")
    updated = integration_service.update_webhook_endpoint(
        org_id=org_id,
        endpoint_id=endpoint_id,
        url=payload.url,
        description=payload.description,
        events=payload.events,
        is_active=payload.is_active
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Webhook endpoint not found.")
    return {"status": "updated", "endpoint": updated}

@app.post("/api/integrations/webhooks/{endpoint_id}/rotate-secret")
def rotate_org_webhook_secret(
    endpoint_id: str,
    user: Dict[str, Any] = Depends(require_org_admin_auth)
):
    """Organization Admin: rotates HMAC signing secret for a webhook."""
    org_id = user.get("org_id", "org_default")
    rotated = integration_service.rotate_webhook_secret(org_id, endpoint_id)
    if not rotated:
        raise HTTPException(status_code=404, detail="Webhook endpoint not found.")
    return rotated

@app.delete("/api/integrations/webhooks/{endpoint_id}")
def delete_org_webhook(
    endpoint_id: str,
    user: Dict[str, Any] = Depends(require_org_admin_auth)
):
    """Organization Admin: deletes a webhook endpoint."""
    org_id = user.get("org_id", "org_default")
    success = integration_service.delete_webhook_endpoint(org_id, endpoint_id)
    if not success:
        raise HTTPException(status_code=404, detail="Webhook endpoint not found.")
    return {"status": "deleted", "endpoint_id": endpoint_id}

@app.get("/api/integrations/webhooks/deliveries")
def list_org_webhook_deliveries(user: Dict[str, Any] = Depends(require_recruiter_auth)):
    """Lists recent webhook delivery logs with delivery status and latency."""
    org_id = user.get("org_id", "org_default")
    deliveries = integration_service.list_delivery_logs(org_id)
    return {"deliveries": deliveries, "count": len(deliveries)}

@app.post("/api/integrations/webhooks/deliveries/{delivery_id}/retry")
def retry_org_webhook_delivery(
    delivery_id: str,
    user: Dict[str, Any] = Depends(require_recruiter_auth)
):
    """Manually re-enqueues a failed or dead-lettered webhook delivery."""
    org_id = user.get("org_id", "org_default")
    success = integration_service.retry_delivery_manually(org_id, delivery_id)
    if not success:
        raise HTTPException(status_code=404, detail="Delivery record not found or not owned by organization.")
    
    # Process queue immediately in mock/dev mode
    integration_service.process_delivery_queue(mock_dispatch=True)
    return {"status": "retry_scheduled", "delivery_id": delivery_id}

@app.post("/api/integrations/webhooks/process-queue")
def process_webhook_queue_endpoint(user: Dict[str, Any] = Depends(require_recruiter_auth)):
    """Triggers queue dispatch worker."""
    summary = integration_service.process_delivery_queue(mock_dispatch=True)
    return {"status": "processed", "summary": summary}

# =============================================================================
# Public Enterprise API v1 (/api/v1/integrations/...)
# Designed for ATS (Greenhouse, Lever, Ashby) and Custom HR Enterprise Systems
# =============================================================================

@app.get("/api/v1/integrations/organization")
def v1_get_organization_info(key_ctx: Dict[str, Any] = Depends(require_api_key_auth())):
    """Public v1 API: Retrieves organization details and branding."""
    org_id = key_ctx["org_id"]
    org = secure_assess_db.get_organization(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found.")
    return {
        "status": "success",
        "data": {
            "org_id": org["org_id"],
            "name": org["name"],
            "slug": org["slug"],
            "industry": org["industry"],
            "branding": org["branding"]
        }
    }

@app.get("/api/v1/integrations/roles")
def v1_list_job_roles(key_ctx: Dict[str, Any] = Depends(require_api_key_auth(required_scope="roles:read"))):
    """Public v1 API: Retrieves available job roles and competencies."""
    org_id = key_ctx["org_id"]
    custom_roles = secure_assess_db.list_org_job_roles(org_id)
    
    merged = []
    for r in ROLES_METADATA:
        m = dict(r)
        m["title"] = r.get("name") or r.get("title")
        merged.append(m)
    for cr in custom_roles:
        merged.append({
            "id": cr["role_id"],
            "name": cr["title"],
            "title": cr["title"],
            "department": cr["department"],
            "skills": cr["required_skills"],
            "experience_level": cr["experience_level"],
            "duration_minutes": cr["interview_duration_minutes"],
            "is_tenant_custom": True
        })
    return {"status": "success", "count": len(merged), "data": merged}

@app.get("/api/v1/integrations/candidates")
def v1_list_candidates(
    limit: int = 20,
    offset: int = 0,
    key_ctx: Dict[str, Any] = Depends(require_api_key_auth(required_scope="candidates:read"))
):
    """Public v1 API: Lists candidates enrolled under this organization with pagination."""
    org_id = key_ctx["org_id"]
    candidates = secure_assess_db.get_all_candidates(org_id=org_id)
    paginated = candidates[offset : offset + limit]
    return {
        "status": "success",
        "total": len(candidates),
        "limit": limit,
        "offset": offset,
        "data": paginated
    }

@app.post("/api/v1/integrations/candidates")
def v1_create_candidate(
    payload: PublicCandidateCreate,
    key_ctx: Dict[str, Any] = Depends(require_api_key_auth(required_scope="candidates:write"))
):
    """Public v1 API: Enrolls a new candidate from an external ATS."""
    org_id = key_ctx["org_id"]
    # Check registration quota
    quota = billing_service.check_quota(org_id, "register_candidate")
    if not quota.get("allowed", True):
        raise HTTPException(status_code=402, detail=quota.get("reason", "Candidate quota reached."))

    created = secure_assess_db.register_candidate({
        "name": payload.name,
        "email": payload.email,
        "phone": payload.phone,
        "institution": payload.institution,
        "experience": payload.experience_level,
        "role_id": payload.target_role,
        "org_id": org_id
    })

    # Trigger candidate.registered webhook
    integration_service.enqueue_webhook_event(
        org_id=org_id,
        event_type="candidate.registered",
        payload_data={
            "candidate_id": created["candidate_id"],
            "name": payload.name,
            "email": payload.email,
            "target_role": payload.target_role
        }
    )

    return {"status": "success", "data": {"candidate_id": created["candidate_id"], "name": payload.name, "email": payload.email, "org_id": org_id}}

@app.post("/api/v1/integrations/invitations")
def v1_create_interview_invitation(
    payload: PublicInvitationCreate,
    key_ctx: Dict[str, Any] = Depends(require_api_key_auth(required_scope="interviews:create"))
):
    """Public v1 API: Schedules an interview invitation from an ATS or HR system."""
    org_id = key_ctx["org_id"]
    
    # Check interview quota
    quota = billing_service.check_quota(org_id, "start_interview")
    if not quota.get("allowed", True):
        raise HTTPException(status_code=402, detail=quota.get("reason", "Interview quota exhausted."))

    inv_dict = payload.dict()
    inv_dict["created_by"] = key_ctx["name"]
    invitation = notification_service.create_interview_invitation(org_id=org_id, invitation_data=inv_dict)

    # Trigger interview.invited & interview.scheduled webhooks
    integration_service.enqueue_webhook_event(
        org_id=org_id,
        event_type="interview.invited",
        payload_data={
            "invitation_id": invitation["invitation_id"],
            "candidate_email": invitation["candidate_email"],
            "candidate_name": invitation["candidate_name"],
            "role_id": invitation["role_id"],
            "scheduled_time": invitation["scheduled_time"],
            "invitation_link": invitation["invitation_link"],
            "token_expires_at": invitation["token_expires_at"]
        }
    )

    return {"status": "success", "data": invitation}

@app.get("/api/v1/integrations/interviews/{session_id}")
def v1_get_interview_status(
    session_id: str,
    key_ctx: Dict[str, Any] = Depends(require_api_key_auth(required_scope="interviews:read"))
):
    """Public v1 API: Checks status, attendance, and progression for an interview session."""
    org_id = key_ctx["org_id"]
    session_rec = secure_assess_db.get_session_record(session_id, org_id=org_id)
    if not session_rec:
        raise HTTPException(status_code=404, detail="Interview session not found or does not belong to organization.")

    return {
        "status": "success",
        "data": {
            "session_id": session_rec["session_id"],
            "candidate_id": session_rec.get("candidate_id"),
            "interview_status": session_rec.get("interview_status", "IN_PROGRESS"),
            "attendance_status": session_rec.get("attendance_status", "PRESENT"),
            "overall_score": session_rec.get("overall_score"),
            "started_at": session_rec.get("created_at"),
            "completed_at": session_rec.get("completed_at")
        }
    }

@app.get("/api/v1/integrations/reports/{session_id}")
def v1_get_interview_report(
    session_id: str,
    key_ctx: Dict[str, Any] = Depends(require_api_key_auth(required_scope="reports:read"))
):
    """Public v1 API: Retrieves completed interview evaluation, rubrics, and feedback."""
    org_id = key_ctx["org_id"]
    report = secure_assess_db.get_session_final_report(session_id, org_id=org_id)
    if not report:
        raise HTTPException(status_code=404, detail="Final report not ready or session does not belong to organization.")

    return {
        "status": "success",
        "data": {
            "session_id": session_id,
            "overall_score": report.get("overall_score"),
            "technical_score": report.get("technical_score"),
            "communication_score": report.get("communication_score"),
            "problem_solving_score": report.get("problem_solving_score"),
            "strengths": report.get("strengths", []),
            "areas_for_growth": report.get("areas_for_growth", []),
            "evaluator_comments": report.get("evaluator_comments"),
            "confidence": report.get("evaluation_confidence")
        }
    }

@app.get("/api/v1/integrations/analytics")
def v1_get_analytics_summary(key_ctx: Dict[str, Any] = Depends(require_api_key_auth(required_scope="analytics:read"))):
    """Public v1 API: Retrieves aggregate interview and talent analytics summary."""
    org_id = key_ctx["org_id"]
    from app.services.analytics_service import analytics_service
    summary = analytics_service.get_dashboard_summary(org_id=org_id)
    return {"status": "success", "data": summary}






