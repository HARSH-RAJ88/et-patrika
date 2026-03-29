"""
ET Patrika Video Studio API — port 8001.
"""
import uuid
import threading
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from pipeline.video_studio.models.schemas import VideoRequest, VideoJobStatus, ArticlePreview, SourceMode, NewsScript
from pipeline.video_studio.core.config import config
from pipeline.video_studio.core.logger import logger
from pipeline.video_studio.services import supabase_reader as db
from pipeline.video_studio.services.article_extractor import extract_from_url, extract_from_text
from pipeline.video_studio.services.script_generator import generate_script_from_article
from pipeline.video_studio.services.tts_service import synthesize_full_script, concatenate_audio_segments, check_voice_model
from pipeline.video_studio.services.visual_fetcher import fetch_images
from pipeline.video_studio.services.chart_generator import generate_chart
from pipeline.video_studio.services.subtitle_generator import generate_srt
from pipeline.video_studio.services.video_composer import compose_video
from pipeline.video_studio.services.video_keypoints import generate_video_key_points

router = APIRouter()
jobs: dict[str, VideoJobStatus] = {}


def _news_script_from_row(row: dict, language: str) -> NewsScript:
    key_facts = row.get("key_facts") or []
    if not isinstance(key_facts, list):
        key_facts = []

    keywords = row.get("keywords") or []
    if not isinstance(keywords, list):
        keywords = []

    return NewsScript(
        hook=row.get("hook", ""),
        key_facts=key_facts,
        context=row.get("context_text", ""),
        closing=row.get("closing", ""),
        full_script=row.get("full_script", ""),
        estimated_duration_seconds=row.get("estimated_duration_seconds") or 60,
        keywords=keywords,
        has_numbers=bool(row.get("has_numbers")),
        numbers_context=row.get("numbers_context"),
        role_context_used=row.get("role"),
        language=language,
    )


def _upd(job_id: str, **kw):
    if job_id in jobs:
        for k, v in kw.items():
            setattr(jobs[job_id], k, v)
    try:
        db.update_video_job(job_id, **{k: v for k, v in kw.items()
                                       if k in ("status", "progress_percent", "current_step", "error")})
    except Exception:
        pass


def _run(job_id: str, request: VideoRequest):
    temp = config.TEMP_DIR / job_id
    temp.mkdir(parents=True, exist_ok=True)
    article_id = request.article_id
    role_value = request.role.value if hasattr(request.role, "value") else str(request.role)
    style_value = request.style.value if hasattr(request.style, "value") else str(request.style)

    try:
        # 1. Get article
        _upd(job_id, status="extracting", progress_percent=10,
             current_step="Loading article from ET Patrika database...")

        if request.mode == SourceMode.SUPABASE:
            article = db.get_article_by_id(request.article_id)
            article_id = article["id"]
        elif request.mode == SourceMode.URL:
            _upd(job_id, current_step="Extracting article from URL...")
            ext = extract_from_url(request.url)
            article = {"id": None, "title": ext.title, "content": ext.content,
                       "source": ext.source, "synthesis_briefing": None, "eli5": None}
        else:
            ext = extract_from_text(request.article_text)
            article = {"id": None, "title": ext.title, "content": ext.content,
                       "source": "Pasted Text", "synthesis_briefing": None, "eli5": None}

        _upd(job_id, article_title=article.get("title", ""))

        # 2. Load Rashomon role context
        _upd(job_id, status="scripting", progress_percent=20,
             current_step="Loading role intelligence from Rashomon Protocol...")
        role_ctx = db.get_article_context(article_id, role_value) if article_id else None

        script_id = None
        cached_script = None
        if article_id:
            cached_script = db.get_latest_video_script(article_id, role_value, style_value)

        if cached_script:
            _upd(job_id, progress_percent=32, current_step="Using cached role-aware script...")
            script = _news_script_from_row(cached_script, request.language)
            script_id = cached_script.get("id")
        else:
            # 3. Generate script
            _upd(job_id, progress_percent=32, current_step="Writing broadcast script...")
            script = generate_script_from_article(article, role_ctx, role_value, style_value, request.language)
            _upd(job_id, script=script)

            if article_id:
                try:
                    script_id = db.save_video_script(article_id, role_value, style_value, {
                        "hook": script.hook, "key_facts": script.key_facts,
                        "context": script.context, "closing": script.closing,
                        "full_script": script.full_script, "keywords": script.keywords,
                        "has_numbers": script.has_numbers, "numbers_context": script.numbers_context,
                        "estimated_duration_seconds": script.estimated_duration_seconds
                    })
                except Exception as e:
                    logger.warning(f"[{job_id}] Script save failed: {e}")

        # 3b. Generate and cache key points for watch experience
        if article_id:
            try:
                existing_points = db.get_video_key_points(article_id, role_value, request.language)
                if not existing_points:
                    _upd(job_id, progress_percent=40, current_step="Extracting factual video key points...")
                    key_points_payload = generate_video_key_points(
                        article=article,
                        script=script,
                        role=role_value,
                        language=request.language,
                    )
                    db.upsert_video_key_points(
                        article_id=article_id,
                        role=role_value,
                        language=request.language,
                        headline=key_points_payload["headline"],
                        key_points=key_points_payload["key_points"],
                        script_id=script_id,
                        source_model=key_points_payload.get("source_model"),
                    )
            except Exception as e:
                logger.warning(f"[{job_id}] Key points save failed: {e}")

        # 4. TTS
        check_voice_model(request.language)
        _upd(job_id, status="tts", progress_percent=45,
             current_step="Generating voice narration with Piper...")
        segments = synthesize_full_script(script, job_id)
        master_audio = str(temp / "master_audio.wav")
        concatenate_audio_segments(segments, master_audio)

        # 5. Visuals
        _upd(job_id, status="visuals", progress_percent=60,
             current_step="Fetching news visuals from Pexels...")
        images = fetch_images(script.keywords, count=max(len(segments) + 1, 5), job_id=job_id)

        # 6. Chart
        chart_path = None
        if script.has_numbers and script.numbers_context:
            _upd(job_id, progress_percent=68, current_step="Building data visualization...")
            chart_path = generate_chart(script.numbers_context, str(temp / "chart.png"))

        # 7. Subtitles
        _upd(job_id, status="composing", progress_percent=74, current_step="Generating subtitles...")
        srt_path = str(temp / "subtitles.srt")
        generate_srt(segments, srt_path)

        # 8. Compose
        _upd(job_id, progress_percent=82, current_step="Composing broadcast video...")
        video_path = compose_video(
            script=script, segments=segments, images=images,
            chart_path=chart_path, srt_path=srt_path,
            master_audio_path=master_audio,
            article_title=article["title"],
            job_id=job_id, style=style_value
        )

        total_dur = segments[-1].end_time if segments else 90.0
        vf = f"etpatrika_{job_id}.mp4"

        _upd(job_id, status="done", progress_percent=100,
             current_step="Video ready!",
             video_path=video_path,
             video_url=f"/videos/{vf}")

        if article_id:
            db.complete_video_job(job_id, video_path, vf, total_dur, script_id)

        logger.info(f"[{job_id}] ✓ Complete: {video_path}")

    except FileNotFoundError as e:
        _upd(job_id, status="failed", error=str(e),
             current_step="Voice pack missing")
        if article_id:
            try: db.fail_video_job(job_id, str(e), "Voice model not found")
            except Exception: pass

    except Exception as e:
        logger.error(f"[{job_id}] Failed: {e}", exc_info=True)
        step = jobs[job_id].current_step if job_id in jobs else "unknown"
        _upd(job_id, status="failed", error=str(e), current_step=f"Failed at: {step}")
        if article_id:
            try: db.fail_video_job(job_id, str(e), step)
            except Exception: pass


@router.get("/articles", response_model=list[ArticlePreview])
async def list_articles(limit: int = Query(default=20, le=50), category: str = Query(default="all")):
    try:
        articles = db.get_latest_articles(limit=limit, category=category)
        previews = [ArticlePreview(
            id=a["id"], title=a["title"], source=a["source"],
            category=a.get("category", "General"),
            published_at=a.get("published_at"),
            credibility_score=a.get("credibility_score"),
            eli5=a.get("eli5"),
            has_synthesis=bool(a.get("synthesis_briefing")),
            story_momentum=a.get("story_momentum"),
            conflict_index=a.get("conflict_index")
        ) for a in articles]
        previews.sort(key=lambda x: x.conflict_index or 0, reverse=True)
        return previews
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate", response_model=VideoJobStatus)
async def generate_video(request: VideoRequest):
    role_value = request.role.value if hasattr(request.role, "value") else str(request.role)
    style_value = request.style.value if hasattr(request.style, "value") else str(request.style)

    job_id = str(uuid.uuid4())[:8]
    jobs[job_id] = VideoJobStatus(
        job_id=job_id, status="queued", progress_percent=0,
        current_step="Job queued — pipeline starting...", article_title=""
    )
    try:
        db.save_video_job(job_id, request.article_id, role_value,
                          style_value, request.mode, request.url)
    except Exception:
        pass
    threading.Thread(target=_run, args=(job_id, request), daemon=True).start()
    logger.info(f"Job {job_id} started: lang={request.language}, role={role_value}, style={style_value}")
    return jobs[job_id]


@router.get("/status/{job_id}", response_model=VideoJobStatus)
async def get_status(job_id: str):
    if job_id in jobs:
        return jobs[job_id]
    try:
        row = db._get_client().table("video_jobs").select("*").eq("id", job_id).single().execute().data
        if row:
            return VideoJobStatus(job_id=job_id, status=row["status"],
                                  progress_percent=row["progress_percent"],
                                  current_step=row["current_step"],
                                  video_path=row.get("video_path"),
                                  error=row.get("error_message"))
    except Exception:
        pass
    raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")


@router.get("/download/{job_id}")
async def download_video(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status != "done":
        raise HTTPException(status_code=400, detail=f"Video not ready. Status: {job.status}")
    if not job.video_path or not Path(job.video_path).exists():
        raise HTTPException(status_code=500, detail="Video file not found on disk")
    return FileResponse(path=job.video_path, media_type="video/mp4",
                        filename=f"etpatrika_{job_id}.mp4")


@router.get("/history")
async def video_history(limit: int = Query(default=10, le=50)):
    try:
        result = db._get_client().table("video_jobs") \
            .select("id, article_id, role, style, status, progress_percent, created_at, completed_at, video_filename, duration_seconds") \
            .order("created_at", desc=True).limit(limit).execute()
        return result.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/key-points")
async def video_key_points(
    article_id: str = Query(...),
    role: str = Query(default="citizen"),
    language: str = Query(default="en")
):
    normalized_role = role if role in ("student", "investor", "founder", "citizen") else "citizen"
    normalized_language = "hi" if language == "hi" else "en"

    try:
        existing = db.get_video_key_points(article_id, normalized_role, normalized_language)
        if existing:
            return {
                "article_id": article_id,
                "role": normalized_role,
                "language": normalized_language,
                "headline": existing.get("headline"),
                "key_points": existing.get("key_points") or [],
                "source_model": existing.get("source_model"),
            }

        article = db.get_article_by_id(article_id)
        script_row = db.get_latest_video_script(article_id, normalized_role)
        script = _news_script_from_row(script_row, normalized_language) if script_row else None

        generated = generate_video_key_points(
            article=article,
            script=script,
            role=normalized_role,
            language=normalized_language,
        )

        db.upsert_video_key_points(
            article_id=article_id,
            role=normalized_role,
            language=normalized_language,
            headline=generated["headline"],
            key_points=generated["key_points"],
            script_id=script_row.get("id") if script_row else None,
            source_model=generated.get("source_model"),
        )

        return {
            "article_id": article_id,
            "role": normalized_role,
            "language": normalized_language,
            "headline": generated["headline"],
            "key_points": generated["key_points"],
            "source_model": generated.get("source_model"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health():
    import shutil
    issues = config.validate()
    return {
        "service": "ET Patrika Video Studio",
        "port": config.PORT,
        "status": "ok" if not [i for i in issues if "missing" in i.lower()] else "degraded",
        "dependencies": {
            "ffmpeg": bool(shutil.which("ffmpeg")),
            "groq_key": bool(config.GROQ_API_KEY),
            "mistral_key": bool(config.MISTRAL_API_KEY),
            "pexels_key": bool(config.PEXELS_API_KEY),
            "supabase_url": bool(config.SUPABASE_URL),
            "supabase_key": bool(config.SUPABASE_SERVICE_ROLE_KEY),
            "voice_model_en": Path(config.PIPER_VOICE_MODEL_EN).exists(),
            "voice_model_hi": Path(config.PIPER_VOICE_MODEL_HI).exists(),
        },
        "warnings": issues
    }
