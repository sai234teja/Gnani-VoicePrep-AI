from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class QuestionItem(BaseModel):
    id: str
    role_id: str
    category: str = "technical_knowledge"  # self_introduction, technical_knowledge, problem_solving, project_experience, scenario_based, behavioural, hr, conversation
    difficulty: str  # easy, medium, hard
    title: str
    title_te: Optional[str] = None
    title_hi: Optional[str] = None
    context: str
    key_points: List[str]
    follow_up_guidance: Optional[str] = None
    stage: Optional[str] = None

class InterviewConfig(BaseModel):
    mode: str = "practice"  # "practice" or "company"
    role_id: str
    role_name: Optional[str] = None
    role: Optional[Dict[str, Any]] = None
    tech_stack: Optional[List[str]] = None
    techStack: Optional[List[str]] = None
    custom_skills: List[str] = []
    experience_level: Optional[str] = None
    experienceLevel: Optional[str] = None
    difficulty: str = "Adaptive"
    target_questions: Optional[int] = None
    targetQuestions: Optional[int] = None
    interview_duration_minutes: Optional[int] = None
    interviewDurationMinutes: Optional[int] = None
    distribution_ratio: Optional[str] = None
    distributionRatio: Optional[str] = None
    language: str = "en-IN"
    
    # Permissions and Integrity controls
    camera_enabled: bool = True
    microphone_enabled: bool = True
    record_session: bool = False
    integrity_consent: bool = True
    store_recording_consent: bool = False

    # Personalized Practice Configuration (Phase 17)
    interview_type: Optional[str] = "technical"  # "technical", "hr", "behavioral", "project_based", "coding_concepts", "company_specific"
    practice_focus_topics: List[str] = []  # targeted topics to practice
    company_target: Optional[str] = None  # e.g. "Google", "Amazon", "Fintech Startup"

    # Multi-tenant Organization context
    org_id: Optional[str] = "org_default"

    # Candidate Profile Association
    candidate_id: Optional[str] = None
    candidate_name: Optional[str] = None
    candidate_email: Optional[str] = None
    candidate_phone: Optional[str] = None
    institution: Optional[str] = None

class IntegrityEvent(BaseModel):
    timestamp_seconds: float
    duration_seconds: float = 0.0
    category: str  # "confirmed_technical_event" or "uncertain_observation"
    event_type: str  # "tab_hidden", "tab_visible", "window_blur", "face_missing", "multiple_faces", "camera_disconnected", "gaze_offset"
    detail: str
    evidence_level: str = "objective_metric"  # "objective_metric" vs "uncertain_observation"

class QuestionEvaluation(BaseModel):
    question_id: str
    question_title: str
    category: Optional[str] = "technical_knowledge"
    transcript: str
    detected_language: str
    overall_score: int
    relevance_score: int
    problem_solving_score: int
    communication_score: int
    technical_score: int
    project_explanation_score: int = 75
    strengths: List[str]
    improvements: List[str]
    spoken_feedback: str
    interviewer_audio_b64: Optional[str] = None
    extracted_concepts: List[str] = []
    evidence_notes: Optional[str] = None
    evaluated_competency: Optional[str] = None
    rubric_criteria_matched: List[str] = []

class SessionState(BaseModel):
    session_id: str
    config: InterviewConfig
    status: str = "IN_PROGRESS"  # IN_PROGRESS, PAUSED_DISCONNECTED, COMPLETED, EMERGENCY_EXIT
    stage: str = "GREETING"  # GREETING, READINESS_CHECK, SELF_INTRODUCTION, TECHNICAL_INTERVIEW, ADAPTIVE_FOLLOW_UP, SCENARIO_INTERVIEW, HR_INTERVIEW, CLOSING, FINAL_REPORT
    current_index: int = 0
    total_questions: int = 3
    current_question: QuestionItem
    history: List[QuestionEvaluation] = []
    integrity_events: List[IntegrityEvent] = []
    asked_question_ids: List[str] = []
    topics_covered: List[str] = []
    follow_up_count: int = 0
    created_at: float

class FinalReport(BaseModel):
    session_id: str
    mode: str
    role_name: str
    experience_level: str
    overall_score: int
    performance_tier: str  # Learning/Mastery oriented tier
    dimension_scores: Dict[str, int]
    strengths: List[str]
    areas_for_growth: List[str]
    learning_roadmap: List[Dict[str, str]]
    question_evaluations: List[QuestionEvaluation]
    integrity_summary: Dict[str, Any]
    candidate_intro_summary: Optional[str] = None
    evaluator_comments: Optional[str] = None
    evidence_breakdown: Optional[Dict[str, Any]] = None
    unassessed_competencies: Optional[List[str]] = None
    recommended_next_topics: Optional[List[str]] = None
    targeted_next_practice_plan: Optional[Dict[str, Any]] = None
    suggested_improved_answers: Optional[List[Dict[str, str]]] = None
    evaluation_confidence: Optional[str] = "High (Multi-question grounded transcript evaluation)"

# -------------------------------------------------------------
# Enterprise Multi-Tenant SaaS Models (Phase 11)
# -------------------------------------------------------------

class OrganizationBranding(BaseModel):
    primary_color: str = "#0A2540"
    accent_color: str = "#2563EB"
    logo_url: Optional[str] = None
    portal_name: str = "Gnani VoicePrep AI"

class OrganizationSettings(BaseModel):
    allowed_domains: List[str] = []
    default_retention_days: int = 90
    enforce_strict_proctoring: bool = True
    allow_practice_mode: bool = True
    ai_interviewer_voice: str = "Nalini"

class OrganizationCreate(BaseModel):
    org_id: Optional[str] = None
    name: str
    slug: str
    contact_email: str
    industry: Optional[str] = "Technology"
    branding: Optional[OrganizationBranding] = None
    settings: Optional[OrganizationSettings] = None

class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    contact_email: Optional[str] = None
    industry: Optional[str] = None
    branding: Optional[OrganizationBranding] = None
    settings: Optional[OrganizationSettings] = None
    is_active: Optional[bool] = None

class OrganizationOut(BaseModel):
    org_id: str
    name: str
    slug: str
    contact_email: str
    industry: str
    is_active: bool
    branding: OrganizationBranding
    settings: OrganizationSettings
    created_at: float

class RecruiterInvite(BaseModel):
    email: str
    name: str
    role: str = "recruiter"  # "org_admin" | "recruiter"

class RecruiterRegister(BaseModel):
    email: str
    password: str
    name: str
    org_id: str
    role: str = "recruiter"

class RecruiterLogin(BaseModel):
    email: str
    password: str
    org_id: Optional[str] = None

class OrgJobRoleCreate(BaseModel):
    role_id: str
    title: str
    department: Optional[str] = "Engineering"
    experience_level: Optional[str] = "Mid-Level"
    required_skills: List[str] = []
    description: Optional[str] = ""
    target_questions: int = 3
    interview_duration_minutes: int = 15

class TTSRequest(BaseModel):
    text: str
    language: Optional[str] = "en-IN"
    voice: Optional[str] = None

class LogIntegrityRequest(BaseModel):
    session_id: str
    category: str = "confirmed_technical_event"  # or "uncertain_observation"
    event_type: str
    detail: str
    duration_seconds: float = 0.0

# -------------------------------------------------------------
# Enterprise Notifications & Invitations Models (Phase 12)
# -------------------------------------------------------------

class InvitationCreate(BaseModel):
    candidate_id: Optional[str] = None
    candidate_name: str
    candidate_email: str
    role_id: str
    role_title: Optional[str] = None
    scheduled_time: float # Unix timestamp
    duration_minutes: int = 15
    custom_notes: Optional[str] = None
    expires_in_hours: int = 72

class InvitationOut(BaseModel):
    invitation_id: str
    org_id: str
    candidate_id: str
    candidate_name: str
    candidate_email: str
    role_id: str
    role_title: str
    scheduled_time: float
    duration_minutes: int
    invitation_token: str
    invitation_link: str
    status: str
    token_expires_at: float
    token_used_at: Optional[float] = None
    custom_notes: Optional[str] = None
    created_at: float

class NotificationLogOut(BaseModel):
    notification_id: str
    org_id: str
    recipient_email: str
    recipient_name: Optional[str] = None
    notification_type: str
    subject: str
    status: str
    scheduled_send_time: float
    sent_at: Optional[float] = None
    delivered_at: Optional[float] = None
    failure_reason: Optional[str] = None
    retry_count: int
    created_at: float

class InAppNotificationOut(BaseModel):
    id: int
    org_id: str
    recipient_user_id: Optional[str] = None
    title: str
    message: str
    category: str
    is_read: bool
    link_url: Optional[str] = None
    created_at: float

class InAppNotificationMarkRead(BaseModel):
    notification_ids: Optional[List[int]] = None
    mark_all: bool = False

# =============================================================================
# Phase 13: SaaS Subscription, Billing & Usage Models
# =============================================================================

class SubscriptionPlanOut(BaseModel):
    plan_id: str
    name: str
    description: Optional[str] = None
    price_cents: int
    currency: str
    billing_interval: str
    monthly_interviews_limit: int
    recruiters_limit: int
    active_roles_limit: int
    candidate_registrations_limit: int
    max_interview_duration_minutes: int
    recording_storage_mb: int
    analytics_access: bool
    advanced_intelligence: bool
    custom_branding: bool
    is_active: bool
    created_at: float

class SubscriptionPlanUpsert(BaseModel):
    plan_id: Optional[str] = None
    name: str
    description: Optional[str] = None
    price_cents: int = 0
    currency: str = "USD"
    billing_interval: str = "month"
    monthly_interviews_limit: int = 10
    recruiters_limit: int = 2
    active_roles_limit: int = 5
    candidate_registrations_limit: int = 50
    max_interview_duration_minutes: int = 20
    recording_storage_mb: int = 1000
    analytics_access: bool = False
    advanced_intelligence: bool = False
    custom_branding: bool = False
    is_active: bool = True

class OrganizationSubscriptionOut(BaseModel):
    subscription_id: str
    org_id: str
    plan_id: str
    plan_name: str
    status: str
    billing_interval: str
    current_period_start: float
    current_period_end: float
    trial_end: Optional[float] = None
    cancel_at_period_end: bool
    payment_provider: Optional[str] = None
    monthly_interviews_limit: int
    recruiters_limit: int
    active_roles_limit: int
    candidate_registrations_limit: int
    max_interview_duration_minutes: int
    recording_storage_mb: int
    analytics_access: bool
    advanced_intelligence: bool
    custom_branding: bool

class UsageRecordPayload(BaseModel):
    metric_type: str  # interview_completed, interview_minutes, stt_requests, tts_requests, storage_bytes
    quantity: float = 1.0
    unit: str = "count"
    idempotency_key: Optional[str] = None
    reference_id: Optional[str] = None

class CheckoutSessionCreate(BaseModel):
    plan_id: str
    provider: str = "mock"  # mock, stripe, razorpay
    currency: str = "USD"

class PaymentVerifyPayload(BaseModel):
    transaction_id: str
    payment_id: str
    signature: Optional[str] = None
    provider: str = "mock"

class PaymentTransactionOut(BaseModel):
    transaction_id: str
    org_id: str
    amount_cents: int
    currency: str
    payment_provider: str
    external_order_id: Optional[str] = None
    external_payment_id: Optional[str] = None
    status: str
    failure_reason: Optional[str] = None
    created_at: float

# =============================================================================
# Phase 14: Enterprise API, Webhooks & Integrations Models
# =============================================================================

class APIKeyCreate(BaseModel):
    name: str
    scopes: List[str] = ["roles:read", "candidates:read", "interviews:read"]
    expires_days: Optional[int] = 90

class APIKeyOut(BaseModel):
    key_id: str
    org_id: str
    name: str
    key_prefix: str
    scopes: List[str]
    is_active: bool
    expires_at: Optional[float] = None
    last_used_at: Optional[float] = None
    created_at: float

class APIKeyCreatedResponse(APIKeyOut):
    raw_key: str # Exposed strictly once upon creation

class WebhookEndpointCreate(BaseModel):
    url: str
    description: Optional[str] = ""
    events: List[str] = ["interview.completed", "report.generated"]

class WebhookEndpointUpdate(BaseModel):
    url: Optional[str] = None
    description: Optional[str] = None
    events: Optional[List[str]] = None
    is_active: Optional[bool] = None

class WebhookEndpointOut(BaseModel):
    endpoint_id: str
    org_id: str
    url: str
    description: Optional[str] = None
    secret_preview: Optional[str] = None
    events: List[str]
    is_active: bool
    created_at: float
    updated_at: float

class WebhookEndpointCreatedResponse(WebhookEndpointOut):
    signing_secret: str # Returned strictly once upon creation

class WebhookDeliveryOut(BaseModel):
    delivery_id: str
    org_id: str
    endpoint_id: str
    url: Optional[str] = None
    event_type: str
    event_id: str
    status: str
    status_code: Optional[int] = None
    attempts: int
    max_attempts: int
    next_retry_at: Optional[float] = None
    delivered_at: Optional[float] = None
    error_message: Optional[str] = None
    created_at: float

class PublicCandidateCreate(BaseModel):
    name: str
    email: str
    phone: Optional[str] = ""
    institution: Optional[str] = ""
    experience_level: Optional[str] = "Entry-Level (0-2 yrs)"
    target_role: Optional[str] = "software-engineer"

class PublicInvitationCreate(BaseModel):
    candidate_email: str
    candidate_name: str
    role_id: str
    scheduled_time: Optional[float] = None
    duration_minutes: Optional[int] = 15
    custom_notes: Optional[str] = None



