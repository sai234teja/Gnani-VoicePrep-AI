import os
import sys
import logging
from pathlib import Path
from typing import List
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Search and load environment files in priority order
BASE_DIR = Path(__file__).resolve().parent.parent
backend_env = BASE_DIR / ".env"
root_env = BASE_DIR.parent / ".env"

if backend_env.exists():
    load_dotenv(dotenv_path=backend_env, override=False)
if root_env.exists():
    load_dotenv(dotenv_path=root_env, override=False)
load_dotenv()

class Settings(BaseModel):
    # Core Application
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    PORT: int = int(os.getenv("PORT", "8010"))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    
    # CORS Allowlists
    CORS_ORIGINS: List[str] = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8010,http://127.0.0.1:8010"
        ).split(",")
        if origin.strip()
    ]
    
    # Security Secrets
    AUTH_SECRET_KEY: str = os.getenv("AUTH_SECRET_KEY", "")
    RECORDING_ENCRYPTION_KEY: str = os.getenv("RECORDING_ENCRYPTION_KEY", "")
    
    # Gnani.ai Services
    GNANI_API_KEY: str = os.getenv("GNANI_API_KEY", "")
    GNANI_STT_URL: str = os.getenv("GNANI_STT_URL", "https://api.vachana.ai/stt/v3")
    GNANI_STT_MODEL: str = os.getenv("GNANI_STT_MODEL", "prisma-v3.0")
    GNANI_TTS_URL: str = os.getenv("GNANI_TTS_URL", "https://api.vachana.ai/api/v1/tts/inference")
    GNANI_TTS_MODEL: str = os.getenv("GNANI_TTS_MODEL", "timbre-v2.5")
    GNANI_TTS_VOICE: str = os.getenv("GNANI_TTS_VOICE", "Nalini")
    
    # Storage & Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./storage/secure_assess.db")
    DATA_RETENTION_DAYS: int = int(os.getenv("DATA_RETENTION_DAYS", "30"))

    def validate_production_readiness(self) -> List[str]:
        """
        Validates critical requirements if operating in a 'production' environment.
        Returns a list of validation failure messages.
        """
        errors = []
        if self.ENVIRONMENT.lower() == "production":
            if not self.AUTH_SECRET_KEY or "change_me" in self.AUTH_SECRET_KEY.lower():
                errors.append("AUTH_SECRET_KEY must be configured with a strong non-default secret in production.")
            if not self.RECORDING_ENCRYPTION_KEY or "change_me" in self.RECORDING_ENCRYPTION_KEY.lower():
                errors.append("RECORDING_ENCRYPTION_KEY must be set with a persistent Fernet key in production.")
            if not self.GNANI_API_KEY or self.GNANI_API_KEY.startswith("your_gnani"):
                errors.append("GNANI_API_KEY must be provided with a valid enterprise API key in production.")
            if "*" in self.CORS_ORIGINS:
                errors.append("Wildcard CORS (*) is not permitted in production. Explicit origins required.")
        return errors

settings = Settings()

# Run startup production validation check
prod_errors = settings.validate_production_readiness()
if prod_errors:
    logging.getLogger("voiceprep-config").critical("PRODUCTION CONFIGURATION CHECK FAILED:")
    for err in prod_errors:
        logging.getLogger("voiceprep-config").critical(f" - {err}")
    if os.getenv("FAIL_ON_PROD_CONFIG_ERROR", "false").lower() == "true":
        sys.exit(1)
