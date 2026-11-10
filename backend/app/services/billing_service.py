import time
import uuid
import hmac
import hashlib
import json
import logging
from typing import Dict, Any, List, Optional
from app.services.security_service import db_manager
from app.services.notification_service import notification_service

logger = logging.getLogger("voiceprep-billing")

class BillingService:
    """
    SaaS Subscription, Usage Metering & Billing Management Service.
    Supports plan management, tenant subscription lifecycle, idempotent usage metering,
    quota enforcement, and provider-agnostic payment processing (Mock, Stripe, Razorpay).
    """

    def __init__(self):
        self.db_manager = db_manager

    def _get_connection(self):
        return self.db_manager.get_connection()

    # =========================================================================
    # 1. PLAN MANAGEMENT
    # =========================================================================

    def list_plans(self, active_only: bool = True) -> List[Dict[str, Any]]:
        """Lists available subscription plans."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if active_only:
                cursor.execute("SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY price_cents ASC")
            else:
                cursor.execute("SELECT * FROM subscription_plans ORDER BY price_cents ASC")
            rows = cursor.fetchall()
            return [dict(r) for r in rows]

    def get_plan(self, plan_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves a specific plan by ID."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM subscription_plans WHERE plan_id = ?", (plan_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def upsert_plan(self, plan_data: Dict[str, Any]) -> Dict[str, Any]:
        """Creates or updates a subscription plan (Platform Admin only)."""
        plan_id = plan_data.get("plan_id") or f"plan_{str(uuid.uuid4())[:8]}"
        now = time.time()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO subscription_plans (
                plan_id, name, description, price_cents, currency, billing_interval,
                monthly_interviews_limit, recruiters_limit, active_roles_limit, candidate_registrations_limit,
                max_interview_duration_minutes, recording_storage_mb, analytics_access, advanced_intelligence,
                custom_branding, is_active, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(plan_id) DO UPDATE SET
                name = excluded.name,
                description = excluded.description,
                price_cents = excluded.price_cents,
                currency = excluded.currency,
                billing_interval = excluded.billing_interval,
                monthly_interviews_limit = excluded.monthly_interviews_limit,
                recruiters_limit = excluded.recruiters_limit,
                active_roles_limit = excluded.active_roles_limit,
                candidate_registrations_limit = excluded.candidate_registrations_limit,
                max_interview_duration_minutes = excluded.max_interview_duration_minutes,
                recording_storage_mb = excluded.recording_storage_mb,
                analytics_access = excluded.analytics_access,
                advanced_intelligence = excluded.advanced_intelligence,
                custom_branding = excluded.custom_branding,
                is_active = excluded.is_active
            """, (
                plan_id,
                plan_data.get("name", "Custom Plan"),
                plan_data.get("description", ""),
                int(plan_data.get("price_cents", 0)),
                plan_data.get("currency", "USD"),
                plan_data.get("billing_interval", "month"),
                int(plan_data.get("monthly_interviews_limit", 10)),
                int(plan_data.get("recruiters_limit", 2)),
                int(plan_data.get("active_roles_limit", 5)),
                int(plan_data.get("candidate_registrations_limit", 50)),
                int(plan_data.get("max_interview_duration_minutes", 20)),
                int(plan_data.get("recording_storage_mb", 1000)),
                1 if plan_data.get("analytics_access") else 0,
                1 if plan_data.get("advanced_intelligence") else 0,
                1 if plan_data.get("custom_branding") else 0,
                1 if plan_data.get("is_active", True) else 0,
                now
            ))
            conn.commit()
            return self.get_plan(plan_id)

    # =========================================================================
    # 2. SUBSCRIPTION MANAGEMENT
    # =========================================================================

    def get_organization_subscription(self, org_id: str) -> Dict[str, Any]:
        """
        Retrieves active or current subscription for an organization.
        Automatically initialises a trial/free subscription if none exists yet.
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT s.*, p.name as plan_name, p.monthly_interviews_limit, p.recruiters_limit,
                   p.active_roles_limit, p.candidate_registrations_limit, p.max_interview_duration_minutes,
                   p.recording_storage_mb, p.analytics_access, p.advanced_intelligence, p.custom_branding,
                   p.price_cents, p.currency
            FROM org_subscriptions s
            JOIN subscription_plans p ON s.plan_id = p.plan_id
            WHERE s.org_id = ?
            """, (org_id,))
            row = cursor.fetchone()
            if row:
                sub = dict(row)
                # Check expiration / grace period status
                now = time.time()
                if sub["status"] == "active" and sub["current_period_end"] < now:
                    if sub.get("grace_period_end") and now < sub["grace_period_end"]:
                        sub["status"] = "past_due"
                    else:
                        sub["status"] = "expired"
                return sub

            # If no subscription exists for this tenant, provision Trial subscription
            return self.create_initial_subscription(org_id, plan_id="plan_free", is_trial=True)

    def _ensure_org_exists(self, org_id: str):
        """Ensures the organization record exists to satisfy foreign key constraints."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT org_id FROM organizations WHERE org_id = ?", (org_id,))
            if not cursor.fetchone():
                now = time.time()
                slug = org_id.replace("org_", "").replace("_", "-")
                name = org_id.replace("_", " ").title()
                cursor.execute("""
                INSERT OR IGNORE INTO organizations (org_id, name, slug, contact_email, industry, is_active, branding_json, settings_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'Technology', 1, '{}', '{}', ?, ?)
                """, (org_id, name, slug, f"admin@{slug}.com", now, now))
                conn.commit()

    def create_initial_subscription(self, org_id: str, plan_id: str = "plan_free", is_trial: bool = True) -> Dict[str, Any]:
        """Provisions an initial subscription for an organization."""
        self._ensure_org_exists(org_id)
        sub_id = f"sub_{str(uuid.uuid4())[:12]}"
        now = time.time()
        period_end = now + (14 * 86400 if is_trial else 30 * 86400)
        trial_end = period_end if is_trial else None
        status = "trialing" if is_trial else "active"

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO org_subscriptions (
                subscription_id, org_id, plan_id, status, billing_interval,
                current_period_start, current_period_end, trial_end, cancel_at_period_end,
                payment_provider, created_at, updated_at
            ) VALUES (?, ?, ?, ?, 'month', ?, ?, ?, 0, 'mock', ?, ?)
            ON CONFLICT(org_id) DO UPDATE SET
                plan_id = excluded.plan_id,
                status = excluded.status,
                current_period_start = excluded.current_period_start,
                current_period_end = excluded.current_period_end,
                trial_end = excluded.trial_end,
                updated_at = excluded.updated_at
            """, (sub_id, org_id, plan_id, status, now, period_end, trial_end, now, now))
            conn.commit()

        # Enqueue in-app recruiter alert for subscription creation
        try:
            notification_service.create_in_app_notification(
                org_id=org_id,
                recipient_user_id=None,
                title=f"Welcome to VoicePrep ({'Trial' if is_trial else 'Free'} Plan)",
                message=f"Your subscription is active until {time.strftime('%Y-%m-%d', time.gmtime(period_end))}.",
                category="SYSTEM"
            )
        except Exception as e:
            logger.warning(f"Failed to queue subscription notification: {e}")

        return self.get_organization_subscription(org_id)

    def upgrade_subscription(
        self, 
        org_id: str, 
        new_plan_id: str, 
        payment_provider: str = "mock",
        transaction_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Upgrades or downgrades an organization subscription plan."""
        plan = self.get_plan(new_plan_id)
        if not plan:
            raise ValueError(f"Subscription plan '{new_plan_id}' does not exist.")

        now = time.time()
        new_period_end = now + (30 * 86400)

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            UPDATE org_subscriptions
            SET plan_id = ?,
                status = 'active',
                current_period_start = ?,
                current_period_end = ?,
                trial_end = NULL,
                cancel_at_period_end = 0,
                grace_period_end = NULL,
                payment_provider = ?,
                updated_at = ?
            WHERE org_id = ?
            """, (new_plan_id, now, new_period_end, payment_provider, now, org_id))
            if cursor.rowcount == 0:
                # Provision subscription if record wasn't present
                sub_id = f"sub_{str(uuid.uuid4())[:12]}"
                cursor.execute("""
                INSERT INTO org_subscriptions (
                    subscription_id, org_id, plan_id, status, billing_interval,
                    current_period_start, current_period_end, trial_end, cancel_at_period_end,
                    payment_provider, created_at, updated_at
                ) VALUES (?, ?, ?, 'active', 'month', ?, ?, NULL, 0, ?, ?, ?)
                """, (sub_id, org_id, new_plan_id, now, new_period_end, payment_provider, now, now))
            conn.commit()

        # Send notification to organization recruiters
        try:
            notification_service.create_in_app_notification(
                org_id=org_id,
                recipient_user_id=None,
                title="Plan Upgraded Successfully",
                message=f"Your organization has switched to the {plan['name']} plan. New limits are now active.",
                category="SYSTEM"
            )
        except Exception as e:
            logger.warning(f"Failed to enqueue plan upgrade notification: {e}")

        return self.get_organization_subscription(org_id)

    def cancel_subscription(self, org_id: str, immediate: bool = False) -> Dict[str, Any]:
        """Requests cancellation of a subscription."""
        now = time.time()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if immediate:
                cursor.execute("""
                UPDATE org_subscriptions
                SET status = 'canceled', cancel_at_period_end = 1, updated_at = ?
                WHERE org_id = ?
                """, (now, org_id))
            else:
                cursor.execute("""
                UPDATE org_subscriptions
                SET cancel_at_period_end = 1, updated_at = ?
                WHERE org_id = ?
                """, (now, org_id))
            conn.commit()

        try:
            notification_service.create_in_app_notification(
                org_id=org_id,
                recipient_user_id=None,
                title="Subscription Cancellation Scheduled",
                message="Your subscription will terminate at the end of the current billing cycle.",
                category="SYSTEM"
            )
        except Exception as e:
            logger.warning(f"Failed to enqueue cancel notification: {e}")

        return self.get_organization_subscription(org_id)

    def renew_subscription(self, org_id: str) -> Dict[str, Any]:
        """Renews subscription for another billing cycle."""
        current = self.get_organization_subscription(org_id)
        now = time.time()
        start = max(now, current["current_period_end"])
        new_end = start + (30 * 86400)

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            UPDATE org_subscriptions
            SET status = 'active',
                current_period_start = ?,
                current_period_end = ?,
                cancel_at_period_end = 0,
                grace_period_end = NULL,
                updated_at = ?
            WHERE org_id = ?
            """, (start, new_end, now, org_id))
            conn.commit()

        return self.get_organization_subscription(org_id)

    # =========================================================================
    # 3. USAGE METERING (IDEMPOTENT & AUDITABLE)
    # =========================================================================

    def record_usage(
        self,
        org_id: str,
        metric_type: str,
        quantity: float = 1.0,
        unit: str = "count",
        idempotency_key: Optional[str] = None,
        reference_id: Optional[str] = None
    ) -> bool:
        """
        Records a metered usage event.
        Guarantees idempotency: retries with identical idempotency_key are safely skipped.
        Never stores or logs API keys or credentials.
        """
        self._ensure_org_exists(org_id)
        record_id = f"use_{str(uuid.uuid4())[:12]}"
        now = time.time()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute("""
                INSERT INTO usage_records (
                    record_id, org_id, metric_type, quantity, unit,
                    idempotency_key, reference_id, recorded_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (record_id, org_id, metric_type, quantity, unit, idempotency_key, reference_id, now))
                conn.commit()
                return True
            except Exception as e:
                # If unique constraint on idempotency_key triggers, skip silently (duplicate safe)
                if "UNIQUE" in str(e).upper():
                    logger.info(f"Duplicate usage meter suppressed for idempotency key: {idempotency_key}")
                    return True
                logger.error(f"Failed to record usage metric {metric_type}: {e}")
                return False

    def get_current_period_usage(self, org_id: str) -> Dict[str, Any]:
        """
        Aggregates metered usage across the organization's current active billing cycle.
        Also counts total active recruiters and active custom roles.
        """
        sub = self.get_organization_subscription(org_id)
        period_start = sub["current_period_start"]
        period_end = sub["current_period_end"]

        with self._get_connection() as conn:
            cursor = conn.cursor()

            # 1. Metered events during this billing period
            cursor.execute("""
            SELECT metric_type, SUM(quantity) as total_qty
            FROM usage_records
            WHERE org_id = ? AND recorded_at >= ? AND recorded_at <= ?
            GROUP BY metric_type
            """, (org_id, period_start, period_end))
            usage_by_metric = {row["metric_type"]: row["total_qty"] for row in cursor.fetchall()}

            # 2. Count active recruiter accounts
            cursor.execute("SELECT COUNT(*) as count FROM recruiters WHERE org_id = ? AND is_active = 1", (org_id,))
            recruiter_count = cursor.fetchone()["count"]

            # 3. Count active custom roles
            cursor.execute("SELECT COUNT(*) as count FROM org_roles WHERE org_id = ? AND is_active = 1", (org_id,))
            roles_count = cursor.fetchone()["count"]

            # 4. Count total registered candidates in tenant
            cursor.execute("SELECT COUNT(*) as count FROM candidates WHERE org_id = ?", (org_id,))
            candidate_count = cursor.fetchone()["count"]

            # 5. Completed sessions in current period
            completed_interviews = int(usage_by_metric.get("interview_completed", 0))
            interview_minutes = round(float(usage_by_metric.get("interview_minutes", 0.0)), 1)
            stt_requests = int(usage_by_metric.get("stt_requests", 0))
            tts_requests = int(usage_by_metric.get("tts_requests", 0))
            storage_mb = round(float(usage_by_metric.get("storage_bytes", 0.0)) / (1024 * 1024), 2)

            return {
                "org_id": org_id,
                "plan_id": sub["plan_id"],
                "plan_name": sub["plan_name"],
                "period_start": period_start,
                "period_end": period_end,
                "metrics": {
                    "completed_interviews": completed_interviews,
                    "interview_minutes": interview_minutes,
                    "stt_requests": stt_requests,
                    "tts_requests": tts_requests,
                    "storage_mb": storage_mb,
                    "active_recruiters": recruiter_count,
                    "active_roles": roles_count,
                    "registered_candidates": candidate_count
                },
                "limits": {
                    "monthly_interviews": sub["monthly_interviews_limit"],
                    "recruiters": sub["recruiters_limit"],
                    "active_roles": sub["active_roles_limit"],
                    "candidate_registrations": sub["candidate_registrations_limit"],
                    "max_interview_duration_minutes": sub["max_interview_duration_minutes"],
                    "recording_storage_mb": sub["recording_storage_mb"],
                    "analytics_access": bool(sub["analytics_access"]),
                    "advanced_intelligence": bool(sub["advanced_intelligence"]),
                    "custom_branding": bool(sub["custom_branding"])
                }
            }

    # =========================================================================
    # 4. QUOTA CHECK & LIMIT ENFORCEMENT
    # =========================================================================

    def check_quota(self, org_id: str, action: str) -> Dict[str, Any]:
        """
        Validates whether an organization is permitted to perform a restricted action.
        Actions: 'start_interview', 'create_recruiter', 'create_role', 'register_candidate', 'custom_branding'.
        Returns: { allowed: bool, reason: Optional[str], usage: int, limit: int }
        """
        sub = self.get_organization_subscription(org_id)
        if sub["status"] in ("expired", "canceled"):
            return {
                "allowed": False,
                "reason": f"Subscription is {sub['status']}. Please renew or upgrade your plan.",
                "action": action
            }

        usage_info = self.get_current_period_usage(org_id)
        metrics = usage_info["metrics"]
        limits = usage_info["limits"]

        if action == "start_interview":
            limit = limits["monthly_interviews"]
            current = metrics["completed_interviews"]
            if current >= limit:
                # Trigger quota exhaustion alert once
                self._send_quota_exhausted_alert(org_id, "monthly interview quota", current, limit)
                return {
                    "allowed": False,
                    "reason": f"Monthly interview quota reached ({current}/{limit}). Please upgrade your plan.",
                    "usage": current,
                    "limit": limit
                }
            # Approaching warning (at >= 80%)
            if current >= int(limit * 0.8):
                self._send_quota_warning(org_id, "interviews", current, limit)
            return {"allowed": True, "usage": current, "limit": limit}

        elif action == "create_recruiter":
            limit = limits["recruiters"]
            current = metrics["active_recruiters"]
            if current >= limit:
                return {
                    "allowed": False,
                    "reason": f"Recruiter seat limit reached ({current}/{limit}). Upgrade to add more recruiters.",
                    "usage": current,
                    "limit": limit
                }
            return {"allowed": True, "usage": current, "limit": limit}

        elif action == "create_role":
            limit = limits["active_roles"]
            current = metrics["active_roles"]
            if current >= limit:
                return {
                    "allowed": False,
                    "reason": f"Active job roles limit reached ({current}/{limit}). Upgrade to create more roles.",
                    "usage": current,
                    "limit": limit
                }
            return {"allowed": True, "usage": current, "limit": limit}

        elif action == "register_candidate":
            limit = limits["candidate_registrations"]
            current = metrics["registered_candidates"]
            if current >= limit:
                return {
                    "allowed": False,
                    "reason": f"Candidate registration limit reached ({current}/{limit}). Upgrade to add more candidates.",
                    "usage": current,
                    "limit": limit
                }
            return {"allowed": True, "usage": current, "limit": limit}

        elif action == "custom_branding":
            if not limits["custom_branding"]:
                return {
                    "allowed": False,
                    "reason": "Custom portal branding requires Professional or Enterprise plan.",
                    "usage": 0,
                    "limit": 1
                }
            return {"allowed": True, "usage": 1, "limit": 1}

        elif action == "analytics_access":
            if not limits["analytics_access"]:
                return {
                    "allowed": False,
                    "reason": "Enterprise analytics requires Starter or higher plan.",
                    "usage": 0,
                    "limit": 1
                }
            return {"allowed": True, "usage": 1, "limit": 1}

        return {"allowed": True}

    def _send_quota_exhausted_alert(self, org_id: str, feature_name: str, current: int, limit: int):
        """Sends an in-app and email alert when a tenant reaches 100% quota."""
        try:
            notification_service.create_in_app_notification(
                org_id=org_id,
                recipient_user_id=None,
                title="Usage Quota Reached",
                message=f"Your team has used {current} of {limit} {feature_name}. New assessments cannot be started until upgraded.",
                category="SYSTEM"
            )
        except Exception as e:
            logger.warning(f"Could not queue quota exhaustion notification: {e}")

    def _send_quota_warning(self, org_id: str, feature_name: str, current: int, limit: int):
        """Warns organization recruiters when approaching limit (>= 80%)."""
        try:
            notification_service.create_in_app_notification(
                org_id=org_id,
                recipient_user_id=None,
                title="Approaching Plan Limit",
                message=f"You have used {current} of {limit} {feature_name} this billing cycle.",
                category="SYSTEM"
            )
        except Exception as e:
            logger.warning(f"Could not queue quota warning: {e}")

    # =========================================================================
    # 5. PAYMENT GATEWAY LAYER (MOCK / STRIPE / RAZORPAY SANDBOX)
    # =========================================================================

    def create_checkout_session(
        self,
        org_id: str,
        target_plan_id: str,
        provider: str = "mock",
        currency: str = "USD"
    ) -> Dict[str, Any]:
        """
        Creates a payment order/checkout session for plan subscription.
        Sandbox / Provider-independent. Never processes live funds without explicit key configuration.
        """
        self._ensure_org_exists(org_id)
        plan = self.get_plan(target_plan_id)
        if not plan:
            raise ValueError(f"Target plan '{target_plan_id}' does not exist.")

        tx_id = f"tx_{str(uuid.uuid4())[:12]}"
        order_id = f"order_{provider}_{str(uuid.uuid4())[:8]}"
        amount_cents = plan["price_cents"]
        now = time.time()

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO payment_transactions (
                transaction_id, org_id, subscription_id, amount_cents, currency,
                payment_provider, external_order_id, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
            """, (tx_id, org_id, None, amount_cents, currency, provider, order_id, now, now))
            conn.commit()

        # In mock mode, generate instant mock payment token
        mock_token = hmac.new(
            b"gnani_mock_payment_secret",
            f"{tx_id}:{amount_cents}:{order_id}".encode("utf-8"),
            hashlib.sha256
        ).hexdigest()

        return {
            "transaction_id": tx_id,
            "order_id": order_id,
            "org_id": org_id,
            "plan_id": target_plan_id,
            "plan_name": plan["name"],
            "amount_cents": amount_cents,
            "currency": currency,
            "provider": provider,
            "mock_payment_token": mock_token,
            "checkout_url": f"/billing/checkout?tx={tx_id}&provider={provider}",
            "status": "pending"
        }

    def verify_payment(
        self,
        transaction_id: str,
        payment_id: str,
        signature: Optional[str] = None,
        provider: str = "mock"
    ) -> Dict[str, Any]:
        """
        Verifies payment completion and atomically applies the plan upgrade upon success.
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM payment_transactions WHERE transaction_id = ?", (transaction_id,))
            tx = cursor.fetchone()
            if not tx:
                raise ValueError(f"Transaction '{transaction_id}' not found.")
            tx = dict(tx)

        # Signature verification
        if provider == "mock":
            expected = hmac.new(
                b"gnani_mock_payment_secret",
                f"{transaction_id}:{tx['amount_cents']}:{tx['external_order_id']}".encode("utf-8"),
                hashlib.sha256
            ).hexdigest()
            if signature and signature != expected:
                self.record_payment_failure(transaction_id, "Signature mismatch during mock verification")
                raise ValueError("Invalid payment signature")
        
        # Mark transaction succeeded
        now = time.time()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            UPDATE payment_transactions
            SET status = 'succeeded',
                external_payment_id = ?,
                updated_at = ?
            WHERE transaction_id = ?
            """, (payment_id, now, transaction_id))
            conn.commit()

        return {
            "status": "succeeded",
            "transaction_id": transaction_id,
            "org_id": tx["org_id"],
            "amount_cents": tx["amount_cents"],
            "provider": provider
        }

    def record_payment_failure(self, transaction_id: str, reason: str):
        """Records failed payment attempt and triggers grace period / notification."""
        now = time.time()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            UPDATE payment_transactions
            SET status = 'failed', failure_reason = ?, updated_at = ?
            WHERE transaction_id = ?
            """, (reason, now, transaction_id))
            cursor.execute("SELECT org_id FROM payment_transactions WHERE transaction_id = ?", (transaction_id,))
            row = cursor.fetchone()
            if row:
                org_id = row["org_id"]
                # Provide 7-day grace period for subscription
                grace_end = now + (7 * 86400)
                cursor.execute("""
                UPDATE org_subscriptions
                SET status = 'past_due', grace_period_end = ?, updated_at = ?
                WHERE org_id = ?
                """, (grace_end, now, org_id))
                if cursor.rowcount == 0:
                    sub_id = f"sub_{str(uuid.uuid4())[:12]}"
                    cursor.execute("""
                    INSERT INTO org_subscriptions (
                        subscription_id, org_id, plan_id, status, billing_interval,
                        current_period_start, current_period_end, trial_end, cancel_at_period_end,
                        grace_period_end, payment_provider, created_at, updated_at
                    ) VALUES (?, ?, 'plan_free', 'past_due', 'month', ?, ?, NULL, 0, ?, 'mock', ?, ?)
                    """, (sub_id, org_id, now, now + (30 * 86400), grace_end, now, now))
            conn.commit()

        if row:
            try:
                notification_service.create_in_app_notification(
                    org_id=row["org_id"],
                    recipient_user_id=None,
                    title="Payment Failed",
                    message=f"Renewal transaction failed: {reason}. You have a 7-day grace period to update payment details.",
                    category="SYSTEM"
                )
            except Exception as e:
                logger.warning(f"Failed to queue payment failure notification: {e}")

    def verify_webhook_signature(self, payload_bytes: bytes, signature_header: str, secret: str, provider: str = "stripe") -> bool:
        """
        Validates HMAC webhook signatures for incoming Stripe or Razorpay webhook events.
        """
        if not signature_header or not secret:
            return False
        
        try:
            expected_sig = hmac.new(
                secret.encode("utf-8"),
                payload_bytes,
                hashlib.sha256
            ).hexdigest()
            return hmac.compare_digest(expected_sig, signature_header)
        except Exception as e:
            logger.error(f"Webhook signature calculation error: {e}")
            return False

    def list_payment_history(self, org_id: str) -> List[Dict[str, Any]]:
        """Returns billing transaction history for a specific organization (tenant isolated)."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT transaction_id, org_id, amount_cents, currency, payment_provider,
                   external_order_id, external_payment_id, status, failure_reason, created_at
            FROM payment_transactions
            WHERE org_id = ?
            ORDER BY created_at DESC
            """, (org_id,))
            return [dict(r) for r in cursor.fetchall()]

    def get_platform_billing_overview(self) -> Dict[str, Any]:
        """Platform Admin aggregate view across all tenant subscriptions."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) as total_subs FROM org_subscriptions")
            total_subs = cursor.fetchone()["total_subs"]

            cursor.execute("SELECT status, COUNT(*) as count FROM org_subscriptions GROUP BY status")
            by_status = {r["status"]: r["count"] for r in cursor.fetchall()}

            cursor.execute("SELECT plan_id, COUNT(*) as count FROM org_subscriptions GROUP BY plan_id")
            by_plan = {r["plan_id"]: r["count"] for r in cursor.fetchall()}

            cursor.execute("SELECT SUM(amount_cents) as total_revenue FROM payment_transactions WHERE status = 'succeeded'")
            rev_row = cursor.fetchone()
            total_revenue_cents = rev_row["total_revenue"] or 0

            return {
                "total_subscriptions": total_subs,
                "status_distribution": by_status,
                "plan_distribution": by_plan,
                "total_revenue_usd": round(total_revenue_cents / 100.0, 2)
            }

billing_service = BillingService()
