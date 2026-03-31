"""
Supabase Reader — bridges Video Studio with ET Patrika's existing data.
"""
from postgrest import SyncPostgrestClient
from typing import Optional
from datetime import datetime, timezone
from pipeline.video_studio.core.config import config
from pipeline.video_studio.core.logger import logger


def _get_client() -> SyncPostgrestClient:
    if not config.SUPABASE_URL or not config.SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError(
            "Supabase credentials missing from pipeline/.env. "
            "Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set."
        )
    return SyncPostgrestClient(
        f"{config.SUPABASE_URL}/rest/v1",
        headers={
            "apikey": config.SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {config.SUPABASE_SERVICE_ROLE_KEY}"
        }
    )


def get_article_by_id(article_id: str) -> dict:
    """Fetch a single article from the existing articles table."""
    client = _get_client()
    result = client.table("articles").select("*").eq("id", article_id).single().execute()
    if not result.data:
        raise ValueError(f"Article '{article_id}' not found in Supabase.")
    logger.info(f"Fetched article: {result.data['title'][:60]}")
    return result.data


def get_article_context(article_id: str, role: str) -> Optional[dict]:
    """
    Fetch role-specific context from article_contexts.
    Returns None if Agent 2 hasn't processed this article yet.
    'general' role maps to 'citizen' as broadest fallback.
    """
    normalized = role if role in ("student", "investor", "founder", "citizen") else "citizen"
    client = _get_client()
    result = (
        client.table("article_contexts")
        .select("*")
        .eq("article_id", article_id)
        .eq("role", normalized)
        .limit(1)
        .execute()
    )
    if not result.data:
        logger.warning(f"No context for article {article_id}, role={normalized}. Using general framing.")
        return None
    return result.data[0]


def get_latest_video_script(article_id: str, role: str, style: str = None) -> Optional[dict]:
    """Fetch most recent cached script for article+role (optionally style)."""
    client = _get_client()
    query = (
        client.table("video_scripts")
        .select("*")
        .eq("article_id", article_id)
        .eq("role", role)
    )

    if style:
        query = query.eq("style", style)

    result = query.order("created_at", desc=True).limit(1).execute()
    if not result.data:
        return None
    return result.data[0]


def get_video_key_points(article_id: str, role: str, language: str = "en") -> Optional[dict]:
    """Fetch cached video key points for article+role+language."""
    client = _get_client()
    result = (
        client.table("video_key_points")
        .select("*")
        .eq("article_id", article_id)
        .eq("role", role)
        .eq("language", language)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not result.data:
        return None
    return result.data[0]


def get_story_arc(topic_key: str) -> Optional[dict]:
    """Fetch story arc for an article's topic (for timeline context in video)."""
    if not topic_key:
        return None
    client = _get_client()
    result = client.table("story_arcs").select("*").eq("topic_key", topic_key).single().execute()
    return result.data if result.data else None


def get_latest_articles(limit: int = 20, category: str = None) -> list[dict]:
    """
    Fetch recent articles ready for video generation.
    Only returns articles where synthesis_briefing is populated (Agent 2 ran).
    This is the article picker list for the video studio UI.
    """
    client = _get_client()
    query = (
        client.table("articles")
        .select("id, title, source, category, published_at, credibility_score, eli5, synthesis_briefing, story_momentum, conflict_index")
        .not_.is_("synthesis_briefing", "null")
        .order("published_at", desc=True)
        .limit(limit)
    )
    if category and category != "all":
        query = query.eq("category", category)
    result = query.execute()
    return result.data or []


def save_video_script(article_id: str, role: str, style: str, script_data: dict) -> str:
    """Save generated video script to video_scripts table. Returns script ID."""
    client = _get_client()
    result = client.table("video_scripts").insert({
        "article_id": article_id,
        "role": role,
        "style": style,
        "hook": script_data["hook"],
        "key_facts": script_data["key_facts"],
        "context_text": script_data["context"],
        "closing": script_data["closing"],
        "full_script": script_data["full_script"],
        "keywords": script_data.get("keywords", []),
        "has_numbers": script_data.get("has_numbers", False),
        "numbers_context": script_data.get("numbers_context"),
        "estimated_duration_seconds": script_data.get("estimated_duration_seconds"),
    }).execute()
    script_id = result.data[0]["id"]
    logger.info(f"Script saved to Supabase: {script_id}")
    return script_id


def upsert_video_key_points(
    article_id: str,
    role: str,
    language: str,
    headline: str,
    key_points: list[str],
    script_id: str = None,
    source_model: str = None,
):
    """Upsert role-aware key points used in watch UI."""
    client = _get_client()
    row = {
        "article_id": article_id,
        "role": role,
        "language": language,
        "headline": headline,
        "key_points": key_points,
        "script_id": script_id,
        "source_model": source_model,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    client.table("video_key_points").upsert(
        row,
        on_conflict="article_id,role,language"
    ).execute()


def save_video_job(job_id: str, article_id: str, role: str, style: str,
                   source_mode: str, source_url: str = None):
    """Create a new video_jobs row at job start."""
    client = _get_client()
    client.table("video_jobs").insert({
        "id": job_id, "article_id": article_id, "role": role,
        "style": style, "source_mode": source_mode, "source_url": source_url,
        "status": "queued", "progress_percent": 0, "current_step": "Queued"
    }).execute()


def update_video_job(job_id: str, **kwargs):
    """Update video_jobs row with new status fields."""
    client = _get_client()
    client.table("video_jobs").update(kwargs).eq("id", job_id).execute()


def complete_video_job(job_id: str, video_path: str, video_filename: str,
                        duration_seconds: float, script_id: str = None):
    """Mark job as done with final output details."""
    client = _get_client()
    client.table("video_jobs").update({
        "status": "done", "progress_percent": 100, "current_step": "Video ready",
        "video_path": video_path, "video_filename": video_filename,
        "duration_seconds": duration_seconds, "script_id": script_id,
        "completed_at": "now()"
    }).eq("id", job_id).execute()


def fail_video_job(job_id: str, error_message: str, current_step: str):
    """Mark job as failed."""
    client = _get_client()
    client.table("video_jobs").update({
        "status": "failed", "error_message": error_message, "current_step": current_step
    }).eq("id", job_id).execute()


def log_ai_cost_event(
    stage: str,
    provider: str,
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    total_tokens: int,
    estimated_cost_usd: float,
    article_id: str | None = None,
    video_job_id: str | None = None,
    metadata: dict | None = None,
):
    """Persist token/cost usage for observability and optimization."""
    client = _get_client()
    payload = {
        "stage": stage,
        "provider": provider,
        "model": model,
        "prompt_tokens": int(prompt_tokens or 0),
        "completion_tokens": int(completion_tokens or 0),
        "total_tokens": int(total_tokens or 0),
        "estimated_cost_usd": float(estimated_cost_usd or 0.0),
        "metadata": metadata or {},
    }
    if article_id:
        payload["article_id"] = article_id
    if video_job_id:
        payload["video_job_id"] = video_job_id

    client.table("ai_cost_events").insert(payload).execute()
