import logging
import time
from typing import Dict, Any, Tuple
import httpx
from fastapi import HTTPException
from app.config import settings
from app.services.audio_converter import convert_to_wav_pcm, inspect_audio

logger = logging.getLogger(__name__)

# Language code mapping for Gnani Prisma STT
LANGUAGE_MAP = {
    "en": "en-IN",
    "en-IN": "en-IN",
    "te": "te-IN",
    "te-IN": "te-IN",
    "hi": "hi-IN",
    "hi-IN": "hi-IN",
    "hinglish": "hi-IN",
    "indic-auto": "indic-auto"
}

class GnaniPrismaSTT:
    """
    Client for Gnani Prisma Speech-to-Text (v3).
    Endpoint: POST https://api.vachana.ai/stt/v3
    Headers: X-API-Key-ID: <GNANI_API_KEY>
    Body: multipart/form-data
        audio_file: <binary>
        language_code: en-IN / te-IN / hi-IN / indic-auto
        model: prisma-v3.0
    """

    def __init__(self):
        self.api_key = settings.GNANI_API_KEY
        self.endpoint = settings.GNANI_STT_URL
        self.model = settings.GNANI_STT_MODEL

    async def transcribe(
        self,
        audio_bytes: bytes,
        filename: str = "recording.wav",
        content_type: str = "audio/wav",
        language_code: str = "en-IN"
    ) -> Tuple[str, str]:
        """
        Transcribes submitted audio using Gnani Prisma STT API.
        Returns: (transcript, detected_language)
        Raises: HTTPException if API key is missing, STT fails, or audio cannot be transcribed.
        NEVER silently falls back to hardcoded mock text.
        """
        resolved_lang = LANGUAGE_MAP.get(language_code, "en-IN")
        byte_size = len(audio_bytes)

        if byte_size == 0:
            raise HTTPException(
                status_code=400,
                detail="Empty audio recording received. Please record your answer before submitting."
            )

        # Inspect incoming container/codec and transcode to 16kHz mono linear PCM WAV
        # Gnani Prisma STT strictly rejects WebM (default browser MediaRecorder output) with HTTP 400 UNSUPPORTED_AUDIO_FORMAT
        pre_info = inspect_audio(audio_bytes)
        logger.info(
            f"Gnani Prisma STT input audio inspection: size={byte_size} bytes, "
            f"detected_format='{pre_info['detected_format']}', incoming_filename='{filename}', "
            f"incoming_content_type='{content_type}'"
        )

        try:
            wav_bytes, post_info = convert_to_wav_pcm(audio_bytes, sample_rate=16000)
            submission_bytes = wav_bytes
            submission_filename = "recording.wav"
            submission_content_type = "audio/wav"
            logger.info(
                f"Audio transcoded successfully for Gnani Prisma STT: {len(submission_bytes)} bytes WAV PCM"
            )
        except Exception as conv_err:
            logger.warning(
                f"Audio conversion error ({conv_err}); checking if raw audio can be sent directly: format={pre_info['detected_format']}"
            )
            # If conversion failed but incoming was already wav/ogg/mp3/flac, allow fallback
            if pre_info["detected_format"] in ("wav", "ogg", "mp3", "flac"):
                submission_bytes = audio_bytes
                submission_filename = filename
                submission_content_type = content_type
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported audio format '{pre_info['detected_format']}'. Could not transcode audio to WAV for Gnani Prisma: {str(conv_err)}"
                )

        # Safe logging (Never log API keys or sensitive raw audio payloads)
        logger.info(
            f"Gnani Prisma STT request initiated: "
            f"outbound_filename='{submission_filename}', "
            f"outbound_content_type='{submission_content_type}', "
            f"outbound_byte_size={len(submission_bytes)}, "
            f"original_size={byte_size}, "
            f"converted_container='{post_info['detected_format']}', "
            f"sample_rate={post_info.get('sample_rate')}, "
            f"channels={post_info.get('channels')}, "
            f"bit_depth={post_info.get('bit_depth')}, "
            f"language_code='{resolved_lang}', "
            f"model='{self.model}'"
        )

        api_key = (self.api_key or "").strip()
        if not api_key or api_key.startswith("your_gnani") or len(api_key) < 5:
            logger.error("Gnani Prisma STT rejected: GNANI_API_KEY is not configured or is a placeholder.")
            raise HTTPException(
                status_code=503,
                detail="Gnani API Key is not configured on the backend. Please set a valid GNANI_API_KEY in backend/.env to transcribe your voice."
            )

        headers = {
            "X-API-Key-ID": api_key
        }
        files = {
            "audio_file": (submission_filename, submission_bytes, submission_content_type)
        }
        data = {
            "language_code": resolved_lang,
            "model": self.model
        }

        start_time = time.time()
        try:
            async with httpx.AsyncClient(timeout=35.0) as client:
                response = await client.post(
                    self.endpoint,
                    headers=headers,
                    files=files,
                    data=data
                )
            duration_ms = round((time.time() - start_time) * 1000, 1)
        except httpx.TimeoutException:
            duration_ms = round((time.time() - start_time) * 1000, 1)
            logger.error(f"Gnani Prisma STT request timed out at endpoint: {self.endpoint} after {duration_ms}ms")
            raise HTTPException(
                status_code=504,
                detail=f"Gnani Prisma STT service timed out after {duration_ms}ms. Please check your network and try again."
            )
        except Exception as e:
            duration_ms = round((time.time() - start_time) * 1000, 1)
            logger.error(f"Gnani Prisma STT network connection error after {duration_ms}ms: {type(e).__name__}: {str(e)}")
            raise HTTPException(
                status_code=502,
                detail=f"Unable to connect to Gnani Prisma STT service ({duration_ms}ms): {str(e)}"
            )

        logger.info(
            f"Gnani Prisma STT response received: status_code={response.status_code}, "
            f"duration_ms={duration_ms}, endpoint='{self.endpoint}'"
        )

        if response.status_code != 200:
            error_preview = response.text[:300] if response.text else "No response body"
            logger.error(
                f"Gnani Prisma STT API error: status={response.status_code}, details={error_preview}"
            )
            raise HTTPException(
                status_code=502,
                detail=f"Gnani Prisma STT transcription failed with status {response.status_code}: {error_preview}"
            )

        try:
            result = response.json()
        except Exception as e:
            logger.error(f"Failed to parse Gnani Prisma STT JSON response: {e}")
            raise HTTPException(
                status_code=502,
                detail="Invalid response format received from Gnani Prisma STT."
            )

        transcript = (result.get("transcript") or "").strip()
        detected = result.get("detected_language_code") or resolved_lang

        if not transcript:
            logger.warning(
                f"Gnani Prisma STT returned empty transcript. result_keys={list(result.keys())}"
            )
            raise HTTPException(
                status_code=422,
                detail="Gnani Prisma STT could not detect any speech in the recorded audio. Please speak clearly into the microphone and try again."
            )

        logger.info(
            f"Gnani Prisma STT transcription successful: word_count={len(transcript.split())}, "
            f"detected_language='{detected}'"
        )
        return transcript, detected

gnani_stt = GnaniPrismaSTT()
