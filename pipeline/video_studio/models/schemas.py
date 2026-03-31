from pydantic import BaseModel, validator
from typing import Optional, List
from enum import Enum


class VideoStyle(str, Enum):
    BREAKING = "breaking"
    STANDARD = "standard"
    EXPLAINER = "explainer"


class SourceMode(str, Enum):
    SUPABASE = "supabase"   # Article already in DB
    URL = "url"             # Fetch from URL
    TEXT = "text"           # Pasted text


class VideoRequest(BaseModel):
    mode: SourceMode = SourceMode.SUPABASE
    article_id: Optional[str] = None   # Required for SUPABASE mode
    url: Optional[str] = None          # Required for URL mode
    article_text: Optional[str] = None # Required for TEXT mode
    role: str = "general"              # student|investor|founder|citizen|general
    style: VideoStyle = VideoStyle.STANDARD
    language: str = "en"               # en or hi
    fast_mode: bool = False             # 35-45s target script/video path

    @validator("article_id", always=True)
    def check_supabase(cls, v, values):
        if values.get("mode") == SourceMode.SUPABASE and not v:
            raise ValueError("article_id is required when mode is 'supabase'")
        return v

    @validator("url", always=True)
    def check_url(cls, v, values):
        if values.get("mode") == SourceMode.URL and not v:
            raise ValueError("url is required when mode is 'url'")
        return v


class ArticlePreview(BaseModel):
    id: str
    title: str
    source: str
    category: str
    published_at: Optional[str]
    credibility_score: Optional[float]
    eli5: Optional[str]
    has_synthesis: bool
    story_momentum: Optional[str]
    conflict_index: Optional[float]


class NewsScript(BaseModel):
    hook: str
    key_facts: List[str]
    context: str
    closing: str
    full_script: str
    estimated_duration_seconds: int
    keywords: List[str]
    has_numbers: bool
    numbers_context: Optional[str] = None
    role_context_used: Optional[str] = None
    language: str = "en"


class ScriptSegment(BaseModel):
    text: str
    segment_type: str
    audio_file: Optional[str] = None
    duration_seconds: Optional[float] = None
    start_time: Optional[float] = None
    end_time: Optional[float] = None


class VideoJobStatus(BaseModel):
    job_id: str
    status: str
    progress_percent: int
    current_step: str
    video_path: Optional[str] = None
    video_url: Optional[str] = None
    script: Optional[NewsScript] = None
    error: Optional[str] = None
    article_title: Optional[str] = None
