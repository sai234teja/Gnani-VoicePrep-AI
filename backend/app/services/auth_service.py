import os
import time
import hmac
import hashlib
import json
import base64
import secrets
from typing import Dict, Any, Optional
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

SECRET_KEY = os.getenv("AUTH_SECRET_KEY")
if not SECRET_KEY:
    SECRET_KEY = secrets.token_hex(32)

# Simple, auditable HMAC token generator & validator (No external vulnerable JWT dependencies)
def create_access_token(
    user_id: str, 
    email: str, 
    role: str = "recruiter", 
    org_id: str = "org_default", 
    expires_in_seconds: int = 86400
) -> str:
    """Generates a cryptographically signed HMAC-SHA256 session token with tenant context."""
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "org_id": org_id,
        "exp": int(time.time()) + expires_in_seconds,
        "iat": int(time.time())
    }
    header_b64 = base64.urlsafe_b64encode(json.dumps(header).encode()).decode().rstrip("=")
    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    signature = hmac.new(
        SECRET_KEY.encode(),
        f"{header_b64}.{payload_b64}".encode(),
        hashlib.sha256
    ).digest()
    sig_b64 = base64.urlsafe_b64encode(signature).decode().rstrip("=")
    return f"{header_b64}.{payload_b64}.{sig_b64}"

def verify_access_token(token: str) -> Dict[str, Any]:
    """Validates signature and expiration of HMAC token."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError("Malformed token format")
        header_b64, payload_b64, sig_b64 = parts
        
        # Verify signature
        expected_sig = hmac.new(
            SECRET_KEY.encode(),
            f"{header_b64}.{payload_b64}".encode(),
            hashlib.sha256
        ).digest()
        actual_sig = base64.urlsafe_b64decode(sig_b64 + "==")
        if not hmac.compare_digest(expected_sig, actual_sig):
            raise ValueError("Invalid signature")
        
        payload_json = base64.urlsafe_b64decode(payload_b64 + "==").decode()
        payload = json.loads(payload_json)
        
        if payload.get("exp", 0) < time.time():
            raise ValueError("Token has expired")
        
        return payload
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")

security_bearer = HTTPBearer(auto_error=False)

def get_current_user_optional(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer)) -> Optional[Dict[str, Any]]:
    """Retrieves user info if bearer token is present, otherwise None (for endpoints allowing both public and recruiter access)."""
    if not credentials:
        return None
    try:
        return verify_access_token(credentials.credentials)
    except HTTPException:
        return None

def require_recruiter_auth(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer)) -> Dict[str, Any]:
    """Strictly enforces recruiter, org_admin or platform_admin role access."""
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Authorization required. Provide a valid Bearer token in the Authorization header."
        )
    user = verify_access_token(credentials.credentials)
    allowed_roles = ("recruiter", "admin", "org_admin", "platform_admin")
    if user.get("role") not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail="Access forbidden: Insufficient privileges. Recruiter role required."
        )
    return user

def require_org_admin_auth(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer)) -> Dict[str, Any]:
    """Strictly enforces org_admin or platform_admin role access."""
    user = require_recruiter_auth(credentials)
    if user.get("role") not in ("org_admin", "platform_admin", "admin"):
        raise HTTPException(
            status_code=403,
            detail="Access forbidden: Organization administrator role required."
        )
    return user

def require_platform_admin_auth(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer)) -> Dict[str, Any]:
    """Strictly enforces system-wide platform administrator access."""
    user = require_recruiter_auth(credentials)
    if user.get("role") != "platform_admin":
        raise HTTPException(
            status_code=403,
            detail="Access forbidden: Platform administrator role required."
        )
    return user

def require_candidate_auth(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer)) -> Dict[str, Any]:
    """Strictly enforces candidate role access for practice and candidate profile actions."""
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Authorization required. Candidate Bearer token required in Authorization header."
        )
    user = verify_access_token(credentials.credentials)
    if user.get("role") != "candidate":
        raise HTTPException(
            status_code=403,
            detail="Access forbidden: Candidate account required for this practice resource."
        )
    return user


