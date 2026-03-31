"""
ET Patrika Pipeline — Agent 4: Translation Worker
Precomputes vernacular translations for role contexts.
"""

from __future__ import annotations

import time
import httpx

from config import SUPABASE_URL, SARVAM_API_KEY, log, supabase_request
from models import AgentArticlePayload, normalize_article_payload

SARVAM_TRANSLATE_URL = "https://api.sarvam.ai/translate"
VALID_LANGUAGES = {
    "hi": "hi-IN",
    "ta": "ta-IN",
    "bn": "bn-IN",
    "te": "te-IN",
}



def _translate_text(text: str, target_language: str) -> str | None:
    if not text:
        return None
    if target_language not in VALID_LANGUAGES:
        return None
    if not SARVAM_API_KEY:
        return None

    try:
        resp = httpx.post(
            SARVAM_TRANSLATE_URL,
            headers={
                "Content-Type": "application/json",
                "api-subscription-key": SARVAM_API_KEY,
            },
            json={
                "input": text[:5000],
                "source_language_code": "en-IN",
                "target_language_code": VALID_LANGUAGES[target_language],
            },
            timeout=20,
        )
        if resp.status_code >= 400:
            log(f"Sarvam translation error {resp.status_code}: {resp.text[:180]}", "WARN")
            return None
        data = resp.json()
        return data.get("translated_text") or data.get("output")
    except Exception as exc:
        log(f"Sarvam call failed: {exc}", "WARN")
        return None



def _fetch_context_rows(article_id: str) -> list[dict]:
    rows = supabase_request(
        "GET",
        "article_contexts",
        params={
            "select": "id,article_id,role,why_it_matters,translations,version",
            "article_id": f"eq.{article_id}",
            "limit": "4",
        },
    )
    if rows and isinstance(rows, list):
        return rows
    return []



def _patch_context_translation(context_row: dict, payload: dict) -> bool:
    ctx_id = context_row.get("id")
    expected_version = int(context_row.get("version", 1) or 1)
    result = supabase_request(
        "PATCH",
        "article_contexts",
        data={
            "translations": payload,
            "updated_by_agent": "agent4",
            "version": expected_version + 1,
        },
        params={"id": f"eq.{ctx_id}", "version": f"eq.{expected_version}"},
    )
    return result is not None and (not isinstance(result, list) or len(result) > 0)



def precompute_translations(
    articles: list[AgentArticlePayload | dict],
    languages: list[str] | None = None,
) -> tuple[int, int]:
    """
    Precompute translation cache for each article context row.
    Returns: (rows_updated, stale_conflicts)
    """
    if not SARVAM_API_KEY:
        log("SARVAM_API_KEY missing, Agent 4 skipped.", "WARN")
        return 0, 0

    target_langs = [lang for lang in (languages or ["hi", "ta", "bn", "te"]) if lang in VALID_LANGUAGES]
    if not target_langs:
        return 0, 0

    updated_rows = 0
    stale_conflicts = 0

    for article in articles:
        article_payload = normalize_article_payload(article)
        contexts = _fetch_context_rows(article_payload.id)
        if not contexts:
            continue

        article_eli5 = article_payload.eli5 or ""

        for ctx in contexts:
            why_text = ctx.get("why_it_matters") or ""
            existing = ctx.get("translations") or {}
            if not isinstance(existing, dict):
                existing = {}

            patch = dict(existing)
            changed = False

            for lang in target_langs:
                why_key = lang
                eli5_key = f"{lang}_eli5"

                if why_text and not patch.get(why_key):
                    translated_why = _translate_text(why_text, lang)
                    if translated_why:
                        patch[why_key] = translated_why
                        changed = True

                if article_eli5 and not patch.get(eli5_key):
                    translated_eli5 = _translate_text(article_eli5, lang)
                    if translated_eli5:
                        patch[eli5_key] = translated_eli5
                        changed = True

            if not changed:
                continue

            ok = _patch_context_translation(ctx, patch)
            if ok:
                updated_rows += 1
            else:
                stale_conflicts += 1
                log(f"Stale write in translation context row {ctx.get('id')}", "WARN")

            time.sleep(0.15)

    return updated_rows, stale_conflicts


if __name__ == "__main__":
    # Optional standalone execution for latest synthesized rows.
    rows = supabase_request(
        "GET",
        "articles",
        params={
            "select": "id,title,eli5,content,source,published_at,category,entities,version,updated_by_agent",
            "synthesis_briefing": "not.is.null",
            "order": "published_at.desc",
            "limit": "5",
        },
    )
    batch = rows if isinstance(rows, list) else []
    done, stale = precompute_translations(batch)
    print(f"Agent 4 complete. Updated rows: {done} | Stale conflicts: {stale}")
