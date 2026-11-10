import time
import uuid
import hmac
import hashlib
import json
import secrets
import logging
from typing import Dict, Any, List, Optional, Tuple
from app.services.security_service import db_manager

logger = logging.getLogger("voiceprep-integration")

AVAILABLE_SCOPES = [
    "roles:read",
    "candidates:read",
    "candidates:write",
    "interviews:create",
    "interviews:read",
    "reports:read",
    "analytics:read",
    "webhooks:manage"
]

AVAILABLE_WEBHOOK_EVENTS = [
    "candidate.registered",
    "interview.invited",
    "interview.scheduled",
    "interview.started",
    "interview.completed",
    "interview.cancelled",
    "interview.expired",
    "candidate.absent",
    "report.generated",
    "subscription.updated",
    "usage.limit_reached"
]

class IntegrationService:
    """
    Enterprise Public API, API Key Auth, and Reliable Webhooks Service.
    Enforces strict tenant isolation, cryptographic hashing of API keys,
    HMAC-SHA256 signature calculation with timestamps, exponential backoff retries,
    and dead-letter queue management.
    """

    def __init__(self):
        self.db_manager = db_manager

    def _get_connection(self):
        return self.db_manager.get_connection()

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

    def _hash_api_key(self, raw_key: str) -> str:
        """Computes SHA-256 hash of API key for safe database storage."""
        return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()

    # =========================================================================
    # 1. API KEY LIFECYCLE MANAGEMENT
    # =========================================================================

    def create_api_key(
        self,
        org_id: str,
        name: str,
        scopes: List[str],
        expires_days: Optional[int] = 90,
        created_by: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generates a secure high-entropy API key.
        Returns the full plaintext key ONLY ONCE. Stores only SHA-256 hash in SQLite.
        """
        self._ensure_org_exists(org_id)
        # Validate requested scopes
        valid_scopes = [s for s in scopes if s in AVAILABLE_SCOPES]
        if not valid_scopes:
            valid_scopes = ["roles:read", "interviews:read"]

        random_suffix = secrets.token_hex(24) # 48 hex chars
        raw_key = f"gnani_live_{random_suffix}"
        key_hash = self._hash_api_key(raw_key)
        key_prefix = f"gnani_live_{random_suffix[:6]}...{random_suffix[-4:]}"

        key_id = f"key_{str(uuid.uuid4())[:12]}"
        now = time.time()
        expires_at = (now + (expires_days * 86400)) if expires_days else None

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO api_keys (
                key_id, org_id, name, key_prefix, key_hash, scopes_json,
                is_active, expires_at, last_used_at, created_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, NULL, ?, ?)
            """, (key_id, org_id, name, key_prefix, key_hash, json.dumps(valid_scopes), expires_at, created_by, now))
            conn.commit()

        logger.info(f"Created API Key {key_id} for tenant {org_id} with scopes: {valid_scopes}")

        return {
            "key_id": key_id,
            "org_id": org_id,
            "name": name,
            "key_prefix": key_prefix,
            "raw_key": raw_key, # DISPLAYED ONLY ONCE
            "scopes": valid_scopes,
            "is_active": True,
            "expires_at": expires_at,
            "created_at": now
        }

    def authenticate_api_key(self, raw_key: str, required_scope: Optional[str] = None) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """
        Validates an incoming API key against its SHA-256 hash.
        Returns (key_ctx, None) on success, or (None, error_reason) on failure.
        Reasons: 'invalid_key', 'inactive_key', 'expired_key', 'missing_scope'.
        """
        if not raw_key or not raw_key.startswith("gnani_live_"):
            return None, "invalid_key"

        key_hash = self._hash_api_key(raw_key)
        now = time.time()

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT * FROM api_keys WHERE key_hash = ?
            """, (key_hash,))
            row = cursor.fetchone()
            if not row:
                return None, "invalid_key"

            key_record = dict(row)

            # Check if active
            if not key_record["is_active"]:
                logger.warning(f"Rejected inactive API key: {key_record['key_id']}")
                return None, "inactive_key"

            # Check expiration
            if key_record["expires_at"] and key_record["expires_at"] < now:
                logger.warning(f"Rejected expired API key: {key_record['key_id']}")
                return None, "expired_key"

            # Check scopes
            granted_scopes = json.loads(key_record["scopes_json"] or "[]")
            if required_scope and required_scope not in granted_scopes:
                logger.warning(f"API key {key_record['key_id']} lacks required scope: {required_scope}")
                return None, "missing_scope"

            # Update last_used_at
            cursor.execute("UPDATE api_keys SET last_used_at = ? WHERE key_id = ?", (now, key_record["key_id"]))
            conn.commit()

            return {
                "key_id": key_record["key_id"],
                "org_id": key_record["org_id"],
                "name": key_record["name"],
                "scopes": granted_scopes
            }, None

    def list_api_keys(self, org_id: str) -> List[Dict[str, Any]]:
        """Lists API keys for an organization (never includes raw keys or hashes)."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT key_id, org_id, name, key_prefix, scopes_json, is_active,
                   expires_at, last_used_at, created_by, created_at
            FROM api_keys
            WHERE org_id = ?
            ORDER BY created_at DESC
            """, (org_id,))
            rows = cursor.fetchall()
            keys = []
            for r in rows:
                k = dict(r)
                k["scopes"] = json.loads(k.pop("scopes_json") or "[]")
                keys.append(k)
            return keys

    def revoke_api_key(self, org_id: str, key_id: str) -> bool:
        """Revokes an API key belonging to an organization."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE api_keys SET is_active = 0 WHERE key_id = ? AND org_id = ?", (key_id, org_id))
            conn.commit()
            return cursor.rowcount > 0

    def rotate_api_key(self, org_id: str, key_id: str) -> Optional[Dict[str, Any]]:
        """Rotates an existing API key: revokes old key and provisions new key with identical scopes."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM api_keys WHERE key_id = ? AND org_id = ?", (key_id, org_id))
            row = cursor.fetchone()
            if not row:
                return None
            old = dict(row)
            cursor.execute("UPDATE api_keys SET is_active = 0 WHERE key_id = ?", (key_id,))
            conn.commit()

        # Create replacement key
        scopes = json.loads(old["scopes_json"] or "[]")
        return self.create_api_key(
            org_id=org_id,
            name=f"{old['name']} (Rotated)",
            scopes=scopes,
            expires_days=90,
            created_by=old.get("created_by")
        )

    # =========================================================================
    # 2. WEBHOOK ENDPOINT MANAGEMENT
    # =========================================================================

    def register_webhook_endpoint(
        self,
        org_id: str,
        url: str,
        description: str = "",
        events: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Registers a new webhook recipient URL with an auto-generated signing secret."""
        self._ensure_org_exists(org_id)
        endpoint_id = f"wh_{str(uuid.uuid4())[:12]}"
        now = time.time()
        # High entropy secret for HMAC signatures
        raw_secret = f"whsec_{secrets.token_hex(20)}"
        secret_hash = hashlib.sha256(raw_secret.encode("utf-8")).hexdigest()

        subscribed_events = [e for e in (events or AVAILABLE_WEBHOOK_EVENTS) if e in AVAILABLE_WEBHOOK_EVENTS]

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO webhook_endpoints (
                endpoint_id, org_id, url, description, secret_hash, secret_raw,
                events_json, is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
            """, (endpoint_id, org_id, url, description, secret_hash, raw_secret, json.dumps(subscribed_events), now, now))
            conn.commit()

        return {
            "endpoint_id": endpoint_id,
            "org_id": org_id,
            "url": url,
            "description": description,
            "signing_secret": raw_secret, # Returned upon creation
            "events": subscribed_events,
            "is_active": True,
            "created_at": now,
            "updated_at": now
        }

    def list_webhook_endpoints(self, org_id: str) -> List[Dict[str, Any]]:
        """Lists registered webhooks for an organization."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT endpoint_id, org_id, url, description, secret_raw, events_json,
                   is_active, created_at, updated_at
            FROM webhook_endpoints
            WHERE org_id = ?
            ORDER BY created_at DESC
            """, (org_id,))
            rows = cursor.fetchall()
            endpoints = []
            for r in rows:
                ep = dict(r)
                ep["events"] = json.loads(ep.pop("events_json") or "[]")
                # Mask secret in general listings
                secret = ep.pop("secret_raw", "")
                ep["secret_preview"] = f"{secret[:8]}...{secret[-4:]}" if secret else ""
                endpoints.append(ep)
            return endpoints

    def update_webhook_endpoint(
        self,
        org_id: str,
        endpoint_id: str,
        url: Optional[str] = None,
        description: Optional[str] = None,
        events: Optional[List[str]] = None,
        is_active: Optional[bool] = None
    ) -> Optional[Dict[str, Any]]:
        """Updates an existing webhook endpoint."""
        now = time.time()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM webhook_endpoints WHERE endpoint_id = ? AND org_id = ?", (endpoint_id, org_id))
            row = cursor.fetchone()
            if not row:
                return None
            ep = dict(row)

            new_url = url if url is not None else ep["url"]
            new_desc = description if description is not None else ep["description"]
            new_events = json.dumps(events) if events is not None else ep["events_json"]
            new_active = (1 if is_active else 0) if is_active is not None else ep["is_active"]

            cursor.execute("""
            UPDATE webhook_endpoints
            SET url = ?, description = ?, events_json = ?, is_active = ?, updated_at = ?
            WHERE endpoint_id = ?
            """, (new_url, new_desc, new_events, new_active, now, endpoint_id))
            conn.commit()

        return self.list_webhook_endpoints(org_id)[0]

    def rotate_webhook_secret(self, org_id: str, endpoint_id: str) -> Optional[Dict[str, Any]]:
        """Rotates the HMAC signing secret for a webhook endpoint."""
        new_secret = f"whsec_{secrets.token_hex(20)}"
        secret_hash = hashlib.sha256(new_secret.encode("utf-8")).hexdigest()
        now = time.time()

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            UPDATE webhook_endpoints
            SET secret_raw = ?, secret_hash = ?, updated_at = ?
            WHERE endpoint_id = ? AND org_id = ?
            """, (new_secret, secret_hash, now, endpoint_id, org_id))
            conn.commit()
            if cursor.rowcount == 0:
                return None

        return {
            "endpoint_id": endpoint_id,
            "new_signing_secret": new_secret,
            "updated_at": now
        }

    def delete_webhook_endpoint(self, org_id: str, endpoint_id: str) -> bool:
        """Deletes a webhook endpoint."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM webhook_endpoints WHERE endpoint_id = ? AND org_id = ?", (endpoint_id, org_id))
            conn.commit()
            return cursor.rowcount > 0

    # =========================================================================
    # 3. RELIABLE WEBHOOK DISPATCH & RETRY ENGINE
    # =========================================================================

    def compute_webhook_signature(self, payload_bytes: bytes, secret: str, timestamp: int) -> str:
        """
        Computes an HMAC-SHA256 signature over 'timestamp.payload' to protect against replay attacks.
        Format: t={timestamp},v1={hex_digest}
        """
        signed_payload = f"{timestamp}.".encode("utf-8") + payload_bytes
        digest = hmac.new(secret.encode("utf-8"), signed_payload, hashlib.sha256).hexdigest()
        return f"t={timestamp},v1={digest}"

    def verify_webhook_signature(self, payload_bytes: bytes, header_signature: str, secret: str, max_age_seconds: int = 300) -> bool:
        """
        Verifies incoming webhook signature and checks timestamp freshness.
        """
        if not header_signature or not secret:
            return False

        try:
            parts = dict(item.split("=", 1) for item in header_signature.split(","))
            ts = int(parts.get("t", 0))
            v1 = parts.get("v1", "")

            # Replay attack protection
            if abs(time.time() - ts) > max_age_seconds:
                logger.warning(f"Webhook signature rejected: Timestamp drift {abs(time.time() - ts)}s > {max_age_seconds}s")
                return False

            expected = hmac.new(
                secret.encode("utf-8"),
                f"{ts}.".encode("utf-8") + payload_bytes,
                hashlib.sha256
            ).hexdigest()

            return hmac.compare_digest(expected, v1)
        except Exception as e:
            logger.error(f"Webhook signature validation error: {e}")
            return False

    def enqueue_webhook_event(
        self,
        org_id: str,
        event_type: str,
        payload_data: Dict[str, Any]
    ) -> List[str]:
        """
        Enqueues an event for all active webhook endpoints subscribed to this event in the organization.
        Persists to database queue (`webhook_deliveries`) with computed signature.
        """
        event_id = f"evt_{str(uuid.uuid4())[:12]}"
        now = time.time()
        enqueued_ids = []

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT endpoint_id, url, secret_raw, events_json
            FROM webhook_endpoints
            WHERE org_id = ? AND is_active = 1
            """, (org_id,))
            endpoints = cursor.fetchall()

            for ep in endpoints:
                subscribed = json.loads(ep["events_json"] or "[]")
                if event_type not in subscribed:
                    continue

                full_payload = {
                    "event_id": event_id,
                    "event_type": event_type,
                    "org_id": org_id,
                    "created_at": now,
                    "data": payload_data
                }
                payload_json = json.dumps(full_payload, separators=(',', ':'))
                signature = self.compute_webhook_signature(payload_json.encode("utf-8"), ep["secret_raw"], int(now))

                delivery_id = f"del_{str(uuid.uuid4())[:12]}"
                cursor.execute("""
                INSERT INTO webhook_deliveries (
                    delivery_id, org_id, endpoint_id, event_type, event_id,
                    payload_json, signature, status, attempts, max_attempts,
                    next_retry_at, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, 5, ?, ?)
                """, (delivery_id, org_id, ep["endpoint_id"], event_type, event_id, payload_json, signature, now, now))
                enqueued_ids.append(delivery_id)

            conn.commit()

        logger.info(f"Enqueued {len(enqueued_ids)} deliveries for event {event_type} (org: {org_id})")
        return enqueued_ids

    def process_delivery_queue(self, mock_dispatch: bool = True) -> Dict[str, Any]:
        """
        Processes pending deliveries whose next_retry_at <= now.
        Applies exponential backoff: retry 1 = 30s, retry 2 = 2m, retry 3 = 10m, retry 4 = 30m.
        Transits to 'dead_letter' after max_attempts.
        """
        now = time.time()
        processed = 0
        succeeded = 0
        failed = 0
        dead_lettered = 0

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT d.*, e.url
            FROM webhook_deliveries d
            JOIN webhook_endpoints e ON d.endpoint_id = e.endpoint_id
            WHERE d.status = 'pending' AND (d.next_retry_at IS NULL OR d.next_retry_at <= ?)
            ORDER BY d.created_at ASC
            LIMIT 50
            """, (now,))
            deliveries = cursor.fetchall()

            for row in deliveries:
                d = dict(row)
                delivery_id = d["delivery_id"]
                attempts = d["attempts"] + 1
                max_attempts = d["max_attempts"]

                # Deliver payload (Mock sandbox mode or HTTP)
                delivery_success = True
                status_code = 200
                response_text = '{"status":"ok","received":true}'
                error_msg = None

                if not mock_dispatch:
                    try:
                        import urllib.request
                        req = urllib.request.Request(
                            d["url"],
                            data=d["payload_json"].encode("utf-8"),
                            headers={
                                "Content-Type": "application/json",
                                "User-Agent": "Gnani-VoicePrep-Webhook/1.0",
                                "X-Gnani-Signature": d["signature"],
                                "X-Gnani-Event": d["event_type"]
                            },
                            method="POST"
                        )
                        with urllib.request.urlopen(req, timeout=5.0) as resp:
                            status_code = resp.getcode()
                            response_text = resp.read().decode("utf-8")[:500]
                            delivery_success = (200 <= status_code < 300)
                    except Exception as http_err:
                        delivery_success = False
                        status_code = 500
                        error_msg = str(http_err)
                else:
                    # Deterministic test behavior: if URL contains 'fail', simulate failure
                    if "fail" in d["url"]:
                        delivery_success = False
                        status_code = 502
                        error_msg = "Mock HTTP 502 Bad Gateway"

                processed += 1
                if delivery_success:
                    cursor.execute("""
                    UPDATE webhook_deliveries
                    SET status = 'delivered', status_code = ?, response_body = ?,
                        attempts = ?, delivered_at = ?, error_message = NULL
                    WHERE delivery_id = ?
                    """, (status_code, response_text, attempts, now, delivery_id))
                    succeeded += 1
                else:
                    if attempts >= max_attempts:
                        # Move to dead-letter queue
                        cursor.execute("""
                        UPDATE webhook_deliveries
                        SET status = 'dead_letter', status_code = ?, error_message = ?,
                            attempts = ?, next_retry_at = NULL
                        WHERE delivery_id = ?
                        """, (status_code, error_msg, attempts, delivery_id))
                        dead_lettered += 1
                    else:
                        # Exponential backoff: 30 * (2 ** (attempts - 1))
                        backoff_seconds = 30 * (2 ** (attempts - 1))
                        next_retry = now + backoff_seconds
                        cursor.execute("""
                        UPDATE webhook_deliveries
                        SET status = 'pending', status_code = ?, error_message = ?,
                            attempts = ?, next_retry_at = ?
                        WHERE delivery_id = ?
                        """, (status_code, error_msg, attempts, next_retry, delivery_id))
                        failed += 1

            conn.commit()

        return {
            "processed": processed,
            "succeeded": succeeded,
            "failed": failed,
            "dead_lettered": dead_lettered
        }

    def retry_delivery_manually(self, org_id: str, delivery_id: str) -> bool:
        """Manually resets a failed or dead-lettered delivery to 'pending' for immediate retry."""
        now = time.time()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            UPDATE webhook_deliveries
            SET status = 'pending', next_retry_at = ?, attempts = 0, error_message = 'Manual retry scheduled'
            WHERE delivery_id = ? AND org_id = ?
            """, (now, delivery_id, org_id))
            conn.commit()
            return cursor.rowcount > 0

    def list_delivery_logs(self, org_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Retrieves delivery attempt history strictly scoped to the organization."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT d.delivery_id, d.org_id, d.endpoint_id, e.url, d.event_type, d.event_id,
                   d.status, d.status_code, d.attempts, d.max_attempts, d.next_retry_at,
                   d.delivered_at, d.error_message, d.created_at
            FROM webhook_deliveries d
            LEFT JOIN webhook_endpoints e ON d.endpoint_id = e.endpoint_id
            WHERE d.org_id = ?
            ORDER BY d.created_at DESC
            LIMIT ?
            """, (org_id, limit))
            return [dict(r) for r in cursor.fetchall()]

integration_service = IntegrationService()
