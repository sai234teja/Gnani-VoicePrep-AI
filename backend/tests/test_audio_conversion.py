import pytest
import io
import wave
import struct
import subprocess
import imageio_ffmpeg
from unittest.mock import patch, AsyncMock
import httpx
from app.services.audio_converter import inspect_audio, convert_to_wav_pcm, generate_dummy_wav
from app.services.gnani_stt import GnaniPrismaSTT

def test_inspect_audio_wav():
    raw_wav = generate_dummy_wav(duration_s=0.5, sample_rate=16000)
    info = inspect_audio(raw_wav)
    assert info["detected_format"] == "wav"
    assert info["sample_rate"] == 16000
    assert info["channels"] == 1
    assert info["bit_depth"] == 16
    assert info["chunk_size_valid"] is True
    assert info["duration_sec"] == 0.5

def test_inspect_audio_webm():
    fake_webm = b"\x1a\x45\xdf\xa3\x9f\x42\x86\x81\x01\x42\xf7\x81\x01"
    info = inspect_audio(fake_webm)
    assert info["detected_format"] == "webm"

def test_convert_to_wav_pcm_from_wav():
    raw_wav = generate_dummy_wav(duration_s=1.0, sample_rate=16000)
    out_wav, details = convert_to_wav_pcm(raw_wav, sample_rate=16000)
    assert out_wav.startswith(b"RIFF")
    assert b"WAVE" in out_wav[:12]
    assert details["detected_format"] == "wav"
    assert details["chunk_size_valid"] is True
    assert details["sample_rate"] == 16000
    assert details["channels"] == 1
    assert details["bit_depth"] == 16

def test_convert_to_wav_pcm_from_real_webm_opus():
    """Generates real WebM/Opus stream and verifies conversion yields seekable standard WAV PCM."""
    exe = imageio_ffmpeg.get_ffmpeg_exe()
    cmd = [exe, "-f", "lavfi", "-i", "sine=frequency=1000:duration=1.5", "-c:a", "libopus", "-f", "webm", "pipe:1"]
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    webm_bytes, _ = p.communicate()
    assert len(webm_bytes) > 0

    wav_bytes, details = convert_to_wav_pcm(webm_bytes, sample_rate=16000)
    assert wav_bytes.startswith(b"RIFF")
    assert b"WAVE" in wav_bytes[:12]
    # Verify non-streaming chunk size (not 0xFFFFFFFF)
    assert wav_bytes[4:8] != b"\xff\xff\xff\xff"
    assert details["detected_format"] == "wav"
    assert details["chunk_size_valid"] is True
    assert details["sample_rate"] == 16000
    assert details["channels"] == 1
    assert details["bit_depth"] == 16
    assert details["duration_sec"] == 1.5

@pytest.mark.asyncio
async def test_gnani_stt_transcode_and_multipart_intercept():
    """
    Submits WebM audio to GnaniPrismaSTT, intercepts the outbound HTTP request,
    and verifies that the converted WAV PCM bytes (NOT WebM) are transmitted.
    """
    exe = imageio_ffmpeg.get_ffmpeg_exe()
    cmd = [exe, "-f", "lavfi", "-i", "sine=frequency=1000:duration=1", "-c:a", "libopus", "-f", "webm", "pipe:1"]
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    webm_bytes, _ = p.communicate()

    stt_client = GnaniPrismaSTT()
    stt_client.api_key = "test_actual_key_12345"

    intercepted_files = {}

    async def mock_post(url, headers=None, files=None, data=None):
        nonlocal intercepted_files
        intercepted_files = files
        return httpx.Response(
            status_code=200,
            json={"transcript": "Test speech transcription", "detected_language_code": "en-IN"}
        )

    with patch("httpx.AsyncClient.post", side_effect=mock_post):
        transcript, detected_lang = await stt_client.transcribe(
            audio_bytes=webm_bytes,
            filename="answer.webm",
            content_type="audio/webm;codecs=opus",
            language_code="en-IN"
        )

        assert transcript == "Test speech transcription"
        assert detected_lang == "en-IN"
        assert "audio_file" in intercepted_files

        uploaded_fname, uploaded_bytes, uploaded_mime = intercepted_files["audio_file"]
        assert uploaded_fname == "recording.wav"
        assert uploaded_mime == "audio/wav"
        assert uploaded_bytes.startswith(b"RIFF")
        assert b"WAVE" in uploaded_bytes[:12]
        assert uploaded_bytes[4:8] != b"\xff\xff\xff\xff"
        # Confirm we did NOT upload the original WebM bytes
        assert uploaded_bytes != webm_bytes
