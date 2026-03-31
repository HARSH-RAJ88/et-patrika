"""
ET Patrika Pipeline — Master Orchestrator
Runs all agents in sequence: Scrape → Synthesize → Story Arc → (Optional) Translation.
"""

import sys
import time
import asyncio
import argparse
from uuid import uuid4
from datetime import datetime, timezone

from config import (
    log,
    supabase_request,
    GROQ_MODEL_CLASSIFIER,
    MISTRAL_MODEL_STORY_ARC,
)
import agent1_classifier as agent1
import agent2_synthesizer as agent2
import agent3_storyarc as agent3
import agent4_translator as agent4
from models import AgentArticlePayload


def _new_run_id() -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return f"run_{ts}_{uuid4().hex[:8]}"


def _create_pipeline_run(run_id: str, limit: int | None, dry_run: bool):
    supabase_request(
        "POST",
        "pipeline_runs",
        data={
            "run_id": run_id,
            "status": "running",
            "dry_run": dry_run,
            "article_limit": limit,
            "agent1_status": "pending",
            "agent2_status": "pending",
            "agent3_status": "pending",
            "agent4_status": "pending",
        },
    )


def _update_pipeline_run(run_id: str, **fields):
    supabase_request(
        "PATCH",
        "pipeline_runs",
        data=fields,
        params={"run_id": f"eq.{run_id}"},
    )


def _record_agent_run(
    run_id: str,
    article_id: str,
    stage: str,
    status: str,
    *,
    provider: str = "",
    model: str = "",
    latency_ms: int = 0,
    retry_count: int = 0,
    conflict_score: float | None = None,
    error_message: str | None = None,
    metadata: dict | None = None,
):
    payload = {
        "run_id": run_id,
        "article_id": article_id,
        "stage": stage,
        "status": status,
        "provider": provider,
        "model": model,
        "latency_ms": max(0, int(latency_ms)),
        "retry_count": max(0, int(retry_count)),
        "metadata": metadata or {},
    }
    if conflict_score is not None:
        payload["conflict_score"] = float(conflict_score)
    if error_message:
        payload["error_message"] = error_message[:500]

    supabase_request("POST", "agent_runs", data=payload)


def run_pipeline(
    limit: int | None = None,
    dry_run: bool = False,
    with_translation: bool = False,
    translation_languages: list[str] | None = None,
):
    """
    Run the full ET Patrika pipeline.
    1. Agent 1: Scrape RSS feeds, classify, insert to Supabase
    2. Agent 2: Synthesize articles (Gemini → Groq fallback)
    3. Agent 3: Build story arcs (Mistral)
    """
    start_time = time.time()
    run_id = _new_run_id()
    _create_pipeline_run(run_id, limit, dry_run)

    print("\n" + "=" * 64)
    print("  🚀 ET PATRIKA — Full Pipeline Run")
    print(f"  Run ID: {run_id}")
    print(f"  Started: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    if limit:
        print(f"  Limit: {limit} articles")
    if dry_run:
        print(f"  Mode: DRY RUN (Agent 1 only)")
    if with_translation:
        langs = ",".join(translation_languages or ["hi", "ta", "bn", "te"])
        print(f"  Agent 4: enabled ({langs})")
    print("=" * 64)

    # ── AGENT 1: Scrape + Classify ────────────────────────────
    print("\n" + "─" * 64)
    _update_pipeline_run(run_id, agent1_status="running")
    agent1_start = time.time()
    raw_new_articles = agent1.run(run_id=run_id)
    agent1_elapsed_ms = int((time.time() - agent1_start) * 1000)
    new_articles: list[AgentArticlePayload] = []
    for row in raw_new_articles:
        try:
            new_articles.append(AgentArticlePayload.from_dict(row))
        except ValueError as exc:
            log(f"Skipping malformed Agent 1 payload: {exc}", "WARN")

    _update_pipeline_run(
        run_id,
        agent1_status="succeeded",
        agent1_processed=len(new_articles),
    )

    if new_articles:
        avg_agent1_latency_ms = int(agent1_elapsed_ms / max(1, len(new_articles)))
        for article in new_articles:
            _record_agent_run(
                run_id,
                article.id,
                "agent1_classification",
                "succeeded",
                provider="groq",
                model=GROQ_MODEL_CLASSIFIER,
                latency_ms=avg_agent1_latency_ms,
                retry_count=0,
            )

    if limit and len(new_articles) > limit:
        new_articles = new_articles[:limit]
        log(f"Limited to {limit} articles for processing")

    if not new_articles:
        _update_pipeline_run(
            run_id,
            status="succeeded",
            agent2_status="skipped",
            agent3_status="skipped",
            agent4_status="skipped",
            completed_at=datetime.now(timezone.utc).isoformat(),
            metadata={"reason": "no_new_articles"},
        )
        print("\n  No new articles to process. Pipeline complete.")
        return

    if dry_run:
        _update_pipeline_run(
            run_id,
            status="succeeded",
            agent2_status="skipped",
            agent3_status="skipped",
            agent4_status="skipped",
            completed_at=datetime.now(timezone.utc).isoformat(),
            metadata={"reason": "dry_run"},
        )
        print(f"\n  DRY RUN: {len(new_articles)} articles would be processed.")
        print("  Skipping Agent 2 and Agent 3.")
        for a in new_articles:
            print(f"    • {a.title[:70] if a.title else 'Untitled'}")
        return

    # ── AGENT 2: Synthesize ───────────────────────────────────
    print("\n" + "─" * 64)
    print("🧠 AGENT 2 — Synthesizing articles...")
    print("─" * 64)
    _update_pipeline_run(run_id, agent2_status="running")

    synthesized: list[AgentArticlePayload] = []
    for i, article in enumerate(new_articles):
        article_stage_start = time.time()
        try:
            log(f"\n[Synthesis {i+1}/{len(new_articles)}]")
            success = asyncio.run(agent2.synthesize_article(article))
            llm_audit = agent2.get_last_synthesis_audit()
            stage_latency_ms = int((time.time() - article_stage_start) * 1000)
            if success:
                # Re-fetch article to get eli5 and synthesis data
                from config import supabase_request
                updated = supabase_request(
                    "GET", "articles",
                    params={
                        "select": "id,title,content,eli5,entities,category,published_at,version,updated_by_agent,conflict_index",
                        "id": f"eq.{article.id}",
                        "limit": "1",
                    },
                )
                conflict_score = None
                if updated and isinstance(updated, list) and len(updated) > 0:
                    try:
                        synthesized.append(AgentArticlePayload.from_dict(updated[0]))
                        conflict_score = updated[0].get("conflict_index")
                    except ValueError as exc:
                        log(f"Skipping malformed Agent 2 payload: {exc}", "WARN")
                else:
                    synthesized.append(article)

                _record_agent_run(
                    run_id,
                    article.id,
                    "agent2_synthesis",
                    "succeeded",
                    provider=llm_audit.get("provider", "unknown"),
                    model=llm_audit.get("model", ""),
                    latency_ms=stage_latency_ms,
                    retry_count=int(llm_audit.get("retry_count", 0) or 0),
                    conflict_score=conflict_score,
                )
            else:
                _record_agent_run(
                    run_id,
                    article.id,
                    "agent2_synthesis",
                    "failed",
                    provider=llm_audit.get("provider", "unknown"),
                    model=llm_audit.get("model", ""),
                    latency_ms=stage_latency_ms,
                    retry_count=int(llm_audit.get("retry_count", 0) or 0),
                    error_message="synthesis_failed",
                )

            # Rate limit between articles
            if i < len(new_articles) - 1:
                time.sleep(1.5)

        except Exception as e:
            stage_latency_ms = int((time.time() - article_stage_start) * 1000)
            log(f"Agent 2 error on article {article.id}: {e}", "ERROR")
            _record_agent_run(
                run_id,
                article.id,
                "agent2_synthesis",
                "failed",
                provider="unknown",
                model="",
                latency_ms=stage_latency_ms,
                retry_count=0,
                error_message=str(e),
            )
            continue

    agent2_status = "succeeded" if len(synthesized) == len(new_articles) else ("partial" if len(synthesized) > 0 else "failed")
    _update_pipeline_run(
        run_id,
        agent2_status=agent2_status,
        agent2_processed=len(synthesized),
    )

    # ── AGENT 3: Story Arcs ───────────────────────────────────
    print("\n" + "─" * 64)
    print("🕐 AGENT 3 — Building story arcs...")
    print("─" * 64)
    _update_pipeline_run(run_id, agent3_status="running")

    arcs_built = 0
    for i, article in enumerate(synthesized):
        article_stage_start = time.time()
        try:
            log(f"\n[Story Arc {i+1}/{len(synthesized)}]")
            topic_key = agent3.process_story_arc(article)
            stage_latency_ms = int((time.time() - article_stage_start) * 1000)
            if topic_key:
                arcs_built += 1
                _record_agent_run(
                    run_id,
                    article.id,
                    "agent3_story_arc",
                    "succeeded",
                    provider="mistral",
                    model=MISTRAL_MODEL_STORY_ARC,
                    latency_ms=stage_latency_ms,
                    retry_count=0,
                    metadata={"topic_key": topic_key},
                )
            else:
                _record_agent_run(
                    run_id,
                    article.id,
                    "agent3_story_arc",
                    "failed",
                    provider="mistral",
                    model=MISTRAL_MODEL_STORY_ARC,
                    latency_ms=stage_latency_ms,
                    retry_count=0,
                    error_message="topic_key_generation_failed",
                )
        except Exception as e:
            stage_latency_ms = int((time.time() - article_stage_start) * 1000)
            log(f"Agent 3 error on article {article.id}: {e}", "ERROR")
            _record_agent_run(
                run_id,
                article.id,
                "agent3_story_arc",
                "failed",
                provider="mistral",
                model=MISTRAL_MODEL_STORY_ARC,
                latency_ms=stage_latency_ms,
                retry_count=0,
                error_message=str(e),
            )
            continue

    agent3_status = "succeeded" if arcs_built == len(synthesized) else ("partial" if arcs_built > 0 else "failed")

    if agent2_status == "succeeded" and agent3_status == "succeeded":
        run_status = "succeeded"
    elif agent2_status == "failed" and agent3_status == "failed":
        run_status = "failed"
    else:
        run_status = "partial"

    # ── AGENT 4: Translation (Optional) ─────────────────────
    translated_rows = 0
    stale_translation_writes = 0
    agent4_elapsed_ms = 0
    agent4_error: str | None = None
    agent4_status = "skipped"

    if with_translation and synthesized:
        print("\n" + "─" * 64)
        print("🌐 AGENT 4 — Precomputing vernacular translations...")
        print("─" * 64)
        _update_pipeline_run(run_id, agent4_status="running")
        agent4_stage_start = time.time()
        try:
            translated_rows, stale_translation_writes = agent4.precompute_translations(
                synthesized,
                languages=translation_languages,
            )
            agent4_status = "succeeded" if stale_translation_writes == 0 else "partial"
        except Exception as exc:
            log(f"Agent 4 error: {exc}", "ERROR")
            agent4_error = str(exc)
            agent4_status = "failed"
        finally:
            agent4_elapsed_ms = int((time.time() - agent4_stage_start) * 1000)

    if agent4_status == "failed":
        run_status = "partial" if run_status == "succeeded" else run_status

    if synthesized:
        if with_translation:
            avg_agent4_latency_ms = int(agent4_elapsed_ms / max(1, len(synthesized)))
            for article in synthesized:
                _record_agent_run(
                    run_id,
                    article.id,
                    "agent4_translation",
                    agent4_status,
                    provider="sarvam",
                    model="sarvam-translate",
                    latency_ms=avg_agent4_latency_ms,
                    retry_count=0,
                    error_message=agent4_error,
                    metadata={
                        "translation_languages": translation_languages or ["hi", "ta", "bn", "te"],
                        "translated_context_rows": translated_rows,
                        "stale_translation_writes": stale_translation_writes,
                    },
                )
        else:
            for article in synthesized:
                _record_agent_run(
                    run_id,
                    article.id,
                    "agent4_translation",
                    "skipped",
                    provider="sarvam",
                    model="sarvam-translate",
                    latency_ms=0,
                    retry_count=0,
                    metadata={"reason": "translation_disabled"},
                )

    _update_pipeline_run(
        run_id,
        status=run_status,
        agent3_status=agent3_status,
        agent3_processed=arcs_built,
        agent4_status=agent4_status,
        agent4_processed=translated_rows,
        completed_at=datetime.now(timezone.utc).isoformat(),
        metadata={
            "new_articles": len(new_articles),
            "synthesized": len(synthesized),
            "story_arcs": arcs_built,
            "translated_context_rows": translated_rows,
            "translation_stale_writes": stale_translation_writes,
        },
    )

    # ── FINAL SUMMARY ─────────────────────────────────────────
    elapsed = time.time() - start_time
    minutes = int(elapsed // 60)
    seconds = int(elapsed % 60)

    print(f"\n{'=' * 64}")
    print(f"  ✅ ET PATRIKA PIPELINE COMPLETE")
    print(f"{'=' * 64}")
    print(f"  Articles scraped       : {len(new_articles)}")
    print(f"  Articles synthesized   : {len(synthesized)}")
    print(f"  Story arcs updated     : {arcs_built}")
    if with_translation:
        print(f"  Contexts translated    : {translated_rows}")
    print(f"  Total time             : {minutes}m {seconds}s")
    print(f"  Run tracking           : pipeline_runs.run_id={run_id}")
    print(f"{'=' * 64}\n")


# ── CLI ───────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ET Patrika Pipeline Orchestrator")
    parser.add_argument(
        "--limit", type=int, default=None,
        help="Only process N articles (for testing)",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Run Agent 1 only, show what would be processed",
    )
    parser.add_argument(
        "--reprocess-all", action="store_true",
        help="Re-run Agent 2 on all existing articles",
    )
    parser.add_argument(
        "--with-translation", action="store_true",
        help="Run optional Agent 4 to precompute vernacular translations",
    )
    parser.add_argument(
        "--translation-langs", type=str, default="hi,ta,bn,te",
        help="Comma-separated translation targets for Agent 4",
    )
    args = parser.parse_args()

    translation_langs = [p.strip() for p in args.translation_langs.split(",") if p.strip()]

    if args.reprocess_all:
        agent2.reprocess_all_articles(limit=args.limit)
    else:
        run_pipeline(
            limit=args.limit,
            dry_run=args.dry_run,
            with_translation=args.with_translation,
            translation_languages=translation_langs,
        )
