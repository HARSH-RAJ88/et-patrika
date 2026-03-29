"""
TTS Service using Piper TTS.
"""
import os
import sys
import shutil
import subprocess
import wave
from pathlib import Path
from pipeline.video_studio.core.config import config
from pipeline.video_studio.core.logger import logger
from pipeline.video_studio.models.schemas import ScriptSegment, NewsScript


def _resolve_ffmpeg_executable() -> str:
    """Resolve ffmpeg binary from PATH or imageio-ffmpeg fallback."""
    ffmpeg_bin = shutil.which("ffmpeg")
    if ffmpeg_bin:
        return ffmpeg_bin

    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return "ffmpeg"

def get_audio_duration(file_path: str) -> float:
    with wave.open(file_path, "rb") as audio:
        frames = audio.getnframes()
        rate = audio.getframerate()
        return frames / float(rate)

def check_voice_model(language: str = "en"):
    model = Path(config.PIPER_VOICE_MODEL_EN if language == "en" else config.PIPER_VOICE_MODEL_HI)
    cfg = Path(config.PIPER_VOICE_CONFIG_EN if language == "en" else config.PIPER_VOICE_CONFIG_HI)
    
    if not model.exists():
        raise FileNotFoundError(f"VOICE MODEL NOT FOUND: {model}")
    if not cfg.exists():
        raise FileNotFoundError(f"Voice config not found: {cfg}")


def _sanitize_tts_text(text: str) -> str:
    """Normalize text for Piper by removing invalid surrogate code points."""
    if not text:
        return ""

    # Flatten line breaks and normalize repeated whitespace.
    cleaned = " ".join(text.replace("\r", " ").replace("\n", " ").split())

    # Remove malformed surrogate code points that break UTF-8 encoding.
    cleaned = "".join(ch for ch in cleaned if not 0xD800 <= ord(ch) <= 0xDFFF)

    # Final safe UTF-8 round-trip to drop any remaining invalid bytes.
    cleaned = cleaned.encode("utf-8", errors="ignore").decode("utf-8", errors="ignore")
    return cleaned

def synthesize_segment(text: str, output_path: str, language: str = "en") -> float:
    check_voice_model(language)
    model_path = config.PIPER_VOICE_MODEL_EN if language == "en" else config.PIPER_VOICE_MODEL_HI
    safe_text = _sanitize_tts_text(text)

    if not safe_text.strip():
        raise ValueError("TTS input is empty after sanitization.")
    
    cmd = [sys.executable, "-m", "piper",
           "--model", model_path,
           "--output_file", output_path]
    
    result = subprocess.run(cmd, input=safe_text.encode("utf-8", errors="ignore"),
                            capture_output=True, timeout=60)
    if result.returncode != 0:
        raise RuntimeError(f"Piper failed: {result.stderr.decode()}")
    if not os.path.exists(output_path):
        raise RuntimeError(f"Piper ran but no audio file at {output_path}")
    
    return get_audio_duration(output_path)

def synthesize_full_script(script: NewsScript, job_id: str) -> list[ScriptSegment]:
    temp_audio_dir = config.TEMP_DIR / job_id / "audio"
    temp_audio_dir.mkdir(parents=True, exist_ok=True)
    
    segments = []
    
    parts = [
        ("hook", script.hook),
        ("facts", " ".join(script.key_facts)),
        ("context", script.context),
        ("closing", script.closing)
    ]
    
    current_time = 0.0
    pause_duration = 0.3
    
    for idx, (seg_type, text) in enumerate(parts):
        if not text.strip():
            continue
            
        output_file = str(temp_audio_dir / f"{idx:02d}_{seg_type}.wav")
        logger.info(f"Synthesizing {seg_type}...")
        
        duration = synthesize_segment(text, output_file, script.language)
        
        seg = ScriptSegment(
            text=text,
            segment_type=seg_type,
            audio_file=output_file,
            duration_seconds=duration,
            start_time=current_time,
            end_time=current_time + duration
        )
        segments.append(seg)
        current_time += duration + pause_duration
        
    return segments

def concatenate_audio_segments(segments: list[ScriptSegment], output_path: str):
    logger.info(f"Concatenating {len(segments)} audio segments...")
    
    if not segments:
        raise ValueError("No audio segments to concatenate.")
    
    list_path = Path(output_path).parent / "concat_list.txt"
    with open(list_path, "w", encoding="utf-8") as f:
        for seg in segments:
            # We use an absolute path formatted for FFmpeg concat demuxer
            clean_path = seg.audio_file.replace("\\", "/")
            f.write(f"file '{clean_path}'\n")
            f.write("duration 0.3\n") # pause
    
    cmd = [
        _resolve_ffmpeg_executable(), "-y", "-f", "concat", "-safe", "0",
        "-i", str(list_path), "-c", "copy", output_path
    ]
    
    result = subprocess.run(cmd, capture_output=True)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg audio concat failed: {result.stderr.decode()}")
