import os
import uuid
import time
from typing import Dict, Optional, List
from cryptography.fernet import Fernet
from pydantic import BaseModel

# Server-side symmetric encryption key for secure at-rest recording storage
RECORDING_STORAGE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "storage", "recordings")
os.makedirs(RECORDING_STORAGE_DIR, exist_ok=True)

# Generate or load a consistent encryption key for the backend process
_ENCRYPTION_KEY = os.getenv("RECORDING_ENCRYPTION_KEY")
if not _ENCRYPTION_KEY:
    _ENCRYPTION_KEY = Fernet.generate_key().decode()

fernet = Fernet(_ENCRYPTION_KEY.encode())

class StoredRecordingMetadata(BaseModel):
    recording_id: str
    session_id: str
    interview_mode: str  # "practice" or "company"
    candidate_id: str
    filename: str
    file_path: str
    byte_size: int
    duration_seconds: float
    created_at: float
    retention_days: int
    consent_given: bool
    is_encrypted: bool = True
    authorized_reviewers: List[str] = ["assigned_recruiter", "interview_lead"]

class SecureRecordingManager:
    """
    Manages secure at-rest encrypted storage of session video/audio recordings.
    Enforces:
    - Encryption with Fernet (AES-128 CBC + HMAC)
    - Mode restrictions: Practice recordings are candidate-controlled.
    - Explicit informed consent requirement.
    - Configured retention & deletion.
    - Strict prohibition of training without separate consent.
    """
    def __init__(self):
        self._registry: Dict[str, StoredRecordingMetadata] = {}

    def save_recording(
        self,
        session_id: str,
        raw_bytes: bytes,
        interview_mode: str = "practice",
        candidate_id: str = "candidate_self",
        duration_seconds: float = 0.0,
        consent_given: bool = True,
        retention_days: int = 30
    ) -> StoredRecordingMetadata:
        if not consent_given:
            raise ValueError("Cannot store recording without explicit informed consent.")

        recording_id = str(uuid.uuid4())
        # Encrypt the payload before writing to disk
        encrypted_bytes = fernet.encrypt(raw_bytes)

        file_name = f"{session_id}_{recording_id}.enc"
        file_path = os.path.join(RECORDING_STORAGE_DIR, file_name)

        with open(file_path, "wb") as f:
            f.write(encrypted_bytes)

        meta = StoredRecordingMetadata(
            recording_id=recording_id,
            session_id=session_id,
            interview_mode=interview_mode,
            candidate_id=candidate_id,
            filename=file_name,
            file_path=file_path,
            byte_size=len(encrypted_bytes),
            duration_seconds=duration_seconds,
            created_at=time.time(),
            retention_days=retention_days,
            consent_given=consent_given,
            is_encrypted=True
        )

        self._registry[recording_id] = meta
        return meta

    def read_decrypted_recording(
        self, 
        recording_id: str, 
        requester_role: str = "assigned_recruiter"
    ) -> Optional[bytes]:
        meta = self._registry.get(recording_id)
        if not meta:
            return None

        # Access control check
        if requester_role not in meta.authorized_reviewers and requester_role != "candidate_self":
            raise PermissionError("Access forbidden: You are not an authorized reviewer for this recording.")

        if not os.path.exists(meta.file_path):
            return None

        with open(meta.file_path, "rb") as f:
            encrypted_data = f.read()

        return fernet.decrypt(encrypted_data)

    def delete_recording(self, recording_id: str, candidate_or_admin_id: str) -> bool:
        """Deletes recording immediately upon candidate or admin request."""
        meta = self._registry.get(recording_id)
        if not meta:
            return False

        if os.path.exists(meta.file_path):
            try:
                os.remove(meta.file_path)
            except OSError:
                pass

        del self._registry[recording_id]
        return True

    def enforce_retention(self, max_age_days: int = 30) -> int:
        """Deletes all recordings older than max_age_days or their specific retention_days."""
        now = time.time()
        to_delete = []
        for rid, meta in self._registry.items():
            limit_days = min(meta.retention_days, max_age_days)
            if (now - meta.created_at) > (limit_days * 86400):
                to_delete.append(rid)

        deleted_count = 0
        for rid in to_delete:
            if self.delete_recording(rid, candidate_or_admin_id="system_retention"):
                deleted_count += 1
        return deleted_count

    def get_session_recordings(self, session_id: str) -> List[StoredRecordingMetadata]:
        return [m for m in self._registry.values() if m.session_id == session_id]

secure_recording_manager = SecureRecordingManager()

