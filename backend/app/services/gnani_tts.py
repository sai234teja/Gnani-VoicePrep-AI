import logging
import base64
import time
from typing import Optional, Tuple
import httpx
from fastapi import HTTPException
from app.config import settings

logger = logging.getLogger(__name__)

# Default voices for Gnani Timbre
VOICE_MAP = {
    "en-IN": "Nalini",
    "hi-IN": "Deepak",
    "te-IN": "Kaveri"
}

class GnaniTimbreTTS:
    """
    Client for Gnani Timbre Text-to-Speech.
    Endpoint: POST https://api.vachana.ai/api/v1/tts/inference
    Headers:
        Content-Type: application/json
        X-API-Key-ID: <GNANI_API_KEY>
    Body:
        {
          "text": "...",
          "voice": "Nalini",
          "model": "timbre-v2.5",
          "language": "en-IN",
          "speed": 1.0,
          "audio_config": {
            "encoding": "linear_pcm",
            "container": "wav",
            "num_channels": 1,
            "sample_rate": 24000,
            "sample_width": 2
          }
        }
    """

    def __init__(self):
        self.api_key = settings.GNANI_API_KEY
        self.endpoint = settings.GNANI_TTS_URL
        self.model = settings.GNANI_TTS_MODEL

    async def synthesize(
        self,
        text: str,
        language: str = "en-IN",
        voice: Optional[str] = None
    ) -> Tuple[Optional[str], bool]:
        """
        Synthesizes spoken audio from text using Gnani Timbre TTS.
        Returns: (base64_encoded_wav, is_live_api)
        """
        selected_voice = voice or VOICE_MAP.get(language, settings.GNANI_TTS_VOICE)
        char_count = len(text)

        # Safe logging (Never log API keys or raw audio payload)
        logger.info(
            f"Gnani Timbre TTS request initiated: text_length={char_count}, language='{language}', "
            f"voice='{selected_voice}', model='{self.model}'"
        )

        api_key = (self.api_key or "").strip()
        if not api_key or api_key.startswith("your_gnani") or len(api_key) < 5:
            logger.warning("Gnani Timbre TTS skipped: GNANI_API_KEY is not configured or is a placeholder.")
            return None, False

        headers = {
            "Content-Type": "application/json",
            "X-API-Key-ID": api_key
        }
        payload = {
            "text": text,
            "voice": selected_voice,
            "model": self.model,
            "language": language,
            "speed": 1.0,
            "audio_config": {
                "encoding": "linear_pcm",
                "container": "wav",
                "num_channels": 1,
                "sample_rate": 24000,
                "sample_width": 2
            }
        }

        start_time = time.time()
        try:
            async with httpx.AsyncClient(timeout=35.0) as client:
                response = await client.post(
                    self.endpoint,
                    headers=headers,
                    json=payload
                )
            duration_ms = round((time.time() - start_time) * 1000, 1)

            logger.info(
                f"Gnani Timbre TTS response received: status_code={response.status_code}, "
                f"duration_ms={duration_ms}, endpoint='{self.endpoint}'"
            )

            if response.status_code == 200:
                raw_audio = response.content
                logger.info(
                    f"Gnani Timbre TTS synthesized audio received: byte_size={len(raw_audio)}, "
                    f"duration_ms={duration_ms}"
                )
                b64_audio = base64.b64encode(raw_audio).decode("utf-8")
                return b64_audio, True
            else:
                error_preview = response.text[:200] if response.text else "No response body"
                logger.warning(
                    f"Gnani Timbre TTS API returned error: status={response.status_code}, "
                    f"duration_ms={duration_ms}, details={error_preview}"
                )
                return None, False
        except Exception as e:
            duration_ms = round((time.time() - start_time) * 1000, 1)
            logger.error(f"Error calling Gnani Timbre TTS after {duration_ms}ms: {type(e).__name__}: {str(e)}")
            return None, False

gnani_tts = GnaniTimbreTTS()
