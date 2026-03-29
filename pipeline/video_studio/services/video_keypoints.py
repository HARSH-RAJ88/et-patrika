"""Generate role-aware video key points from article content using Mistral."""
import json
import re
from typing import Any, Optional, cast

import httpx

from pipeline.video_studio.core.config import config
from pipeline.video_studio.core.logger import logger
from pipeline.video_studio.models.schemas import NewsScript

_ALLOWED_ROLES = {"student", "investor", "founder", "citizen"}
ArticleRecord = dict[str, Any]

_SYSTEM_PROMPT = """You are an ET Patrika newsroom editor.
You produce factual, non-generic video key points from source article content.
Never invent facts. If uncertain, omit the claim.
Return ONLY valid JSON."""

_USER_PROMPT = """Create structured video key points for this article.

Role: {role}
Language: {language}

Article title: {title}
Source: {source}
Article content:
{content}

Current script facts (already generated):
{script_facts}

Return JSON with this exact schema:
{{
  "headline": "short clear headline for the video card",
  "key_points": [
    "Point 1 (factual, specific)",
    "Point 2 (factual, specific)",
    "Point 3 (factual, specific)",
    "Point 4 (factual, specific)"
  ]
}}

Rules:
1. Keep headline under 14 words.
2. Key points must be factual and specific to this article.
3. No duplicates and no vague language.
4. Max 20 words per point.
5. Produce output in requested language.
"""


def _fallback_key_points(article: ArticleRecord, script: Optional[NewsScript], language: str) -> dict[str, Any]:
    script_points = list(script.key_facts[:4]) if script and script.key_facts else []

    if not script_points:
        summary = (article.get("synthesis_briefing") or article.get("eli5") or article.get("content") or "").strip()
        chunks = [part.strip() for part in re.split(r"[.!?\n]", summary) if part.strip()]
        script_points = chunks[:4]

    script_points = [point[:180].strip() for point in script_points if point.strip()][:4]

    while len(script_points) < 4:
        script_points.append("More verified details will be added as coverage evolves.")

    return {
        "headline": (article.get("title") or "ET Patrika Video").strip()[:120],
        "key_points": script_points,
        "source_model": "fallback-script",
        "language": language,
    }


def generate_video_key_points(
    article: ArticleRecord,
    script: Optional[NewsScript],
    role: str,
    language: str = "en",
) -> dict[str, Any]:
    normalized_role = role if role in _ALLOWED_ROLES else "citizen"
    normalized_language = "hi" if language == "hi" else "en"

    if not config.MISTRAL_API_KEY:
        logger.warning("MISTRAL_API_KEY missing for key points generation; using fallback.")
        return _fallback_key_points(article, script, normalized_language)

    content = (article.get("synthesis_briefing") or article.get("content") or "")[:5000]
    script_facts = "\n".join(f"- {fact}" for fact in (script.key_facts if script else [])) or "- None"
    language_instruction = "Hindi (Devanagari)" if normalized_language == "hi" else "English"

    prompt = _USER_PROMPT.format(
        role=normalized_role,
        language=language_instruction,
        title=article.get("title", ""),
        source=article.get("source", "ET Patrika"),
        content=content,
        script_facts=script_facts,
    )

    try:
        response = httpx.post(
            "https://api.mistral.ai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {config.MISTRAL_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "mistral-small-latest",
                "messages": [
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.2,
                "response_format": {"type": "json_object"},
            },
            timeout=60,
        )
        response.raise_for_status()
        raw = response.json()["choices"][0]["message"]["content"]

        parsed = json.loads(raw)
        points = parsed.get("key_points")
        if not isinstance(points, list):
            raise ValueError("key_points is not a list")
        typed_points = cast(list[Any], points)

        cleaned_points = [str(point).strip() for point in typed_points if str(point).strip()][:4]
        if len(cleaned_points) < 3:
            raise ValueError("Insufficient key points returned")

        headline = str(parsed.get("headline") or article.get("title") or "ET Patrika Video").strip()

        while len(cleaned_points) < 4:
            cleaned_points.append(cleaned_points[-1])

        return {
            "headline": headline[:140],
            "key_points": cleaned_points,
            "source_model": "mistral-small-latest",
            "language": normalized_language,
        }

    except Exception as exc:
        logger.warning(f"Key points generation failed, using fallback: {exc}")
        return _fallback_key_points(article, script, normalized_language)
