"""
Video Studio config — reads from the shared pipeline/.env.
All Supabase and Groq keys already exist there.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load from pipeline/.env (two levels up from video_studio/core/)
_env_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(dotenv_path=_env_path, override=False)

class VideoStudioConfig:
    # ── Inherited from existing pipeline/.env ──
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    MISTRAL_API_KEY: str = os.getenv("MISTRAL_API_KEY", "")
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    # ── One new key to add to pipeline/.env ──
    PEXELS_API_KEY: str = os.getenv("PEXELS_API_KEY", "")

    # ── Piper TTS paths ──
    _BASE = Path(__file__).parent.parent
    PIPER_VOICE_MODEL_EN: str = str(_BASE / "voices" / "en_US-ryan-medium.onnx")
    PIPER_VOICE_CONFIG_EN: str = str(_BASE / "voices" / "en_US-ryan-medium.onnx.json")
    
    PIPER_VOICE_MODEL_HI: str = str(_BASE / "voices" / "hi_IN-pratham-medium.onnx")
    PIPER_VOICE_CONFIG_HI: str = str(_BASE / "voices" / "hi_IN-pratham-medium.onnx.json")

    # ── Output paths ──
    OUTPUT_DIR: Path = _BASE / "outputs"
    TEMP_DIR: Path = _BASE / "temp"
    ASSETS_DIR: Path = _BASE / "assets"

    # ── Video settings ──
    VIDEO_WIDTH: int = 1920
    VIDEO_HEIGHT: int = 1080
    VIDEO_FPS: int = 24
    VIDEO_BITRATE: str = "4000k"

    # ── ET Patrika brand ──
    BRAND_NAME: str = "ET Patrika"
    BRAND_COLOR_RGB: tuple = (232, 19, 43)

    # ── Server ──
    PORT: int = 8001  # Next.js is on 3000. Never conflict.
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    # ── Pipeline trigger controls (for autonomous ingestion) ──
    PIPELINE_TRIGGER_API_KEY: str = os.getenv("PIPELINE_TRIGGER_API_KEY", "")
    PIPELINE_MAX_ARTICLES_PER_RUN: int = int(os.getenv("PIPELINE_MAX_ARTICLES_PER_RUN", "5"))
    PIPELINE_TRIGGER_TIMEOUT_SEC: int = int(os.getenv("PIPELINE_TRIGGER_TIMEOUT_SEC", "900"))

    def validate(self) -> list[str]:
        missing = []
        if not self.GROQ_API_KEY:
            missing.append("GROQ_API_KEY missing from pipeline/.env")
        if not self.SUPABASE_URL:
            missing.append("SUPABASE_URL missing from pipeline/.env")
        if not self.SUPABASE_SERVICE_ROLE_KEY:
            missing.append("SUPABASE_SERVICE_ROLE_KEY missing from pipeline/.env")
        if not self.PEXELS_API_KEY:
            missing.append("PEXELS_API_KEY not set — visuals will use fallback gradients")
        if not self.PIPELINE_TRIGGER_API_KEY:
            missing.append("PIPELINE_TRIGGER_API_KEY not set — /studio/api/ingest/trigger is disabled")
        return missing

    def ensure_dirs(self):
        self.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        self.TEMP_DIR.mkdir(parents=True, exist_ok=True)
        (self.ASSETS_DIR / "fallback_images").mkdir(parents=True, exist_ok=True)

config = VideoStudioConfig()
config.ensure_dirs()

for issue in config.validate():
    print(f"[VideoStudio CONFIG] ⚠️  {issue}")
