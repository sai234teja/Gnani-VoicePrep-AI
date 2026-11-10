import os
import subprocess
import logging
import tempfile
import wave
import io
from typing import Tuple, Dict, Any

logger = logging.getLogger(__name__)

def get_ffmpeg_path() -> str:
    """
    Returns path to ffmpeg executable.
    Tries imageio_ffmpeg first (bundled), then falls back to system PATH.
    """
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return "ffmpeg"

def inspect_audio(audio_bytes: bytes) -> Dict[str, Any]:
    """
    Inspects audio byte header to detect format without relying on file extension.
    """
    size = len(audio_bytes)
    header = audio_bytes[:16] if size >= 16 else audio_bytes

    detected_format = "unknown"
    if audio_bytes.startswith(b"RIFF") and b"WAVE" in audio_bytes[:12]:
        detected_format = "wav"
    elif audio_bytes.startswith(b"\x1a\x45\xdf\xa3"):
        detected_format = "webm"
    elif audio_bytes.startswith(b"OggS"):
        detected_format = "ogg"
    elif audio_bytes.startswith(b"ID3") or (len(audio_bytes) > 2 and audio_bytes[0] == 0xFF and (audio_bytes[1] & 0xE0) == 0xE0):
        detected_format = "mp3"
    elif audio_bytes.startswith(b"fLaC"):
        detected_format = "flac"
    elif len(audio_bytes) > 8 and audio_bytes[4:8] in (b"ftyp", b"moov"):
        detected_format = "mp4/m4a"

    # If it's a WAV, parse header details directly
    sample_rate = None
    channels = None
    bit_depth = None
    duration_sec = None
    chunk_size_valid = False

    if detected_format == "wav" and size >= 44:
        try:
            with wave.open(io.BytesIO(audio_bytes), 'rb') as w:
                channels = w.getnchannels()
                sample_rate = w.getframerate()
                bit_depth = w.getsampwidth() * 8
                n_frames = w.getnframes()
                if n_frames < 2000000000 and sample_rate > 0:
                    duration_sec = round(n_frames / float(sample_rate), 2)
                    chunk_size_valid = True
                else:
                    duration_sec = None
                    chunk_size_valid = False
        except Exception:
            pass

    return {
        "byte_size": size,
        "header_hex": header.hex(),
        "detected_format": detected_format,
        "sample_rate": sample_rate,
        "channels": channels,
        "bit_depth": bit_depth,
        "duration_sec": duration_sec,
        "chunk_size_valid": chunk_size_valid
    }

def generate_dummy_wav(duration_s: float = 0.5, sample_rate: int = 16000) -> bytes:
    """Generate in-memory valid PCM WAV with exact headers."""
    import struct
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        data = struct.pack('<h', 0) * int(sample_rate * duration_s)
        wav_file.writeframes(data)
    return buffer.getvalue()


def convert_to_wav_pcm(audio_bytes: bytes, sample_rate: int = 16000) -> Tuple[bytes, Dict[str, Any]]:
    """
    Converts incoming audio (WebM, Opus, MP3, OGG, AAC, etc.) to genuine 16kHz mono 16-bit linear PCM WAV.
    Gnani Prisma STT v3 strictly requires standard WAV/OGG/MP3/AAC/FLAC and rejects WebM with HTTP 400 UNSUPPORTED_AUDIO_FORMAT.

    IMPORTANT: Uses temporary disk files for FFmpeg input and output so that FFmpeg can seek
    and write the exact RIFF chunk size and data chunk size into the WAV header. (Streaming to pipe:1
    forces FFmpeg to write placeholder 0xFFFFFFFF chunk sizes which STT decoders reject as corrupted).

    Returns:
        (wav_bytes, inspection_details)
    """
    pre_info = inspect_audio(audio_bytes)
    logger.info(
        f"[AudioConverter] Input audio inspection before conversion: "
        f"size={pre_info['byte_size']} bytes, format='{pre_info['detected_format']}', "
        f"header_hex='{pre_info['header_hex']}'"
    )

    if len(audio_bytes) == 0:
        raise ValueError("Audio payload is empty (0 bytes).")

    # If it is already a valid WAV with exact chunk sizes and matches 16kHz mono 16-bit PCM, return directly
    if (
        pre_info["detected_format"] == "wav" and 
        pre_info["chunk_size_valid"] and
        pre_info["sample_rate"] == sample_rate and
        pre_info["channels"] == 1 and
        pre_info["bit_depth"] == 16
    ):
        logger.info(
            f"[AudioConverter] Audio is already valid 16kHz mono 16-bit linear PCM WAV ({len(audio_bytes)} bytes). "
            f"Bypassing FFmpeg."
        )
        return audio_bytes, pre_info

    ffmpeg_exe = get_ffmpeg_path()

    suffix_map = {
        "webm": ".webm",
        "ogg": ".ogg",
        "mp3": ".mp3",
        "flac": ".flac",
        "mp4/m4a": ".m4a",
        "wav": ".wav"
    }
    in_suffix = suffix_map.get(pre_info["detected_format"], ".bin")

    with tempfile.NamedTemporaryFile(suffix=in_suffix, delete=False) as in_file, \
         tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as out_file:
        in_path = in_file.name
        out_path = out_file.name

    try:
        # Write input bytes to temporary file
        with open(in_path, "wb") as f:
            f.write(audio_bytes)

        cmd = [
            ffmpeg_exe,
            "-y",
            "-i", in_path,
            "-vn",                    # Discard video track
            "-acodec", "pcm_s16le",   # 16-bit linear PCM
            "-ac", "1",               # 1 channel (mono)
            "-ar", str(sample_rate),  # Sample rate (16000 Hz)
            out_path                  # Write to seekable WAV file
        ]

        logger.info(f"[AudioConverter] Executing FFmpeg conversion: {' '.join(cmd)}")
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=20
        )

        if result.returncode != 0:
            err_msg = result.stderr.decode("utf-8", errors="replace")[-400:]
            logger.error(f"[AudioConverter] FFmpeg conversion failed (exit code {result.returncode}): {err_msg}")
            raise RuntimeError(f"FFmpeg audio conversion failed (code {result.returncode}): {err_msg}")

        with open(out_path, "rb") as f:
            wav_bytes = f.read()

        post_info = inspect_audio(wav_bytes)

        # Header and integrity verification
        if not wav_bytes.startswith(b"RIFF") or b"WAVE" not in wav_bytes[:12]:
            raise RuntimeError("Transcoded audio does not contain a valid RIFF/WAVE header.")

        if not post_info["chunk_size_valid"]:
            raise RuntimeError("Transcoded WAV has invalid chunk size headers.")

        logger.info(
            f"[AudioConverter] FFmpeg conversion SUCCESS: "
            f"output_size={len(wav_bytes)} bytes, format='{post_info['detected_format']}', "
            f"sample_rate={post_info['sample_rate']}Hz, channels={post_info['channels']}, "
            f"bit_depth={post_info['bit_depth']}-bit, duration={post_info['duration_sec']}s, "
            f"header_hex='{post_info['header_hex']}'"
        )

        return wav_bytes, post_info

    except subprocess.TimeoutExpired:
        logger.error("[AudioConverter] FFmpeg conversion timed out after 20 seconds.")
        raise TimeoutError("FFmpeg audio conversion timed out after 20 seconds.")
    finally:
        if os.path.exists(in_path):
            try:
                os.remove(in_path)
            except Exception:
                pass
        if os.path.exists(out_path):
            try:
                os.remove(out_path)
            except Exception:
                pass
