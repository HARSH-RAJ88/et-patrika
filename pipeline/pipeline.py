"""
ET Patrika Pipeline — Master Orchestrator
Runs all 3 agents in sequence: Scrape → Synthesize → Story Arc.
"""

import sys
import time
import asyncio
import argparse
from datetime import datetime, timezone

from config import log
import agent1_classifier as agent1
import agent2_synthesizer as agent2
import agent3_storyarc as agent3


def run_pipeline(limit: int | None = None, dry_run: bool = False):
    """
    Run the full ET Patrika pipeline.
    1. Agent 1: Scrape RSS feeds, classify, insert to Supabase
    2. Agent 2: Synthesize articles (Gemini → Groq fallback)
    3. Agent 3: Build story arcs (Mistral)
    """
    start_time = time.time()

    print("\n" + "=" * 64)
    print("  🚀 ET PATRIKA — Full Pipeline Run")
    print(f"  Started: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    if limit:
        print(f"  Limit: {limit} articles")
    if dry_run:
        print(f"  Mode: DRY RUN (Agent 1 only)")
    print("=" * 64)

    # ── AGENT 1: Scrape + Classify ────────────────────────────
    print("\n" + "─" * 64)
    new_articles = agent1.run()

    if limit and len(new_articles) > limit:
        new_articles = new_articles[:limit]
        log(f"Limited to {limit} articles for processing")

    if not new_articles:
        print("\n  No new articles to process. Pipeline complete.")
        return

    if dry_run:
        print(f"\n  DRY RUN: {len(new_articles)} articles would be processed.")
        print("  Skipping Agent 2 and Agent 3.")
        for a in new_articles:
            print(f"    • {a.get('title', 'Untitled')[:70]}")
        return

    # ── AGENT 2: Synthesize ───────────────────────────────────
    print("\n" + "─" * 64)
    print("🧠 AGENT 2 — Synthesizing articles...")
    print("─" * 64)

    synthesized = []
    for i, article in enumerate(new_articles):
        try:
            log(f"\n[Synthesis {i+1}/{len(new_articles)}]")
            success = asyncio.run(agent2.synthesize_article(article))
            if success:
                # Re-fetch article to get eli5 and synthesis data
                from config import supabase_request
                updated = supabase_request(
                    "GET", "articles",
                    params={
                        "select": "id,title,content,eli5,entities,category,published_at",
                        "id": f"eq.{article['id']}",
                        "limit": "1",
                    },
                )
                if updated and isinstance(updated, list) and len(updated) > 0:
                    synthesized.append(updated[0])
                else:
                    synthesized.append(article)

            # Rate limit between articles
            if i < len(new_articles) - 1:
                time.sleep(1.5)

        except Exception as e:
            log(f"Agent 2 error on article {article.get('id', '?')}: {e}", "ERROR")
            continue

    # ── AGENT 3: Story Arcs ───────────────────────────────────
    print("\n" + "─" * 64)
    print("🕐 AGENT 3 — Building story arcs...")
    print("─" * 64)

    arcs_built = 0
    for i, article in enumerate(synthesized):
        try:
            log(f"\n[Story Arc {i+1}/{len(synthesized)}]")
            topic_key = agent3.process_story_arc(article)
            if topic_key:
                arcs_built += 1
        except Exception as e:
            log(f"Agent 3 error on article {article.get('id', '?')}: {e}", "ERROR")
            continue

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
    print(f"  Total time             : {minutes}m {seconds}s")
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
    args = parser.parse_args()

    if args.reprocess_all:
        agent2.reprocess_all_articles(limit=args.limit)
    else:
        run_pipeline(limit=args.limit, dry_run=args.dry_run)
