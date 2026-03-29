"""
ET Patrika Pipeline — Agent 3: Story Arc Builder
Takes synthesized articles, groups them into evolving story arcs,
builds timelines, and tracks key players using Mistral.
"""

import json
import re
import time
from datetime import datetime, timezone

from config import (
    mistral_chat,
    supabase_request,
    log,
)


# ── Mistral Prompts ───────────────────────────────────────────

def generate_topic_key(title: str, entities: list, category: str) -> dict | None:
    """
    CALL 1: Generate a stable topic_key and display_name for the article.
    Returns: {"topic_key": str, "display_name": str} or None on failure.
    """
    entities_str = ", ".join(entities[:6]) if entities else "none"

    messages = [
        {
            "role": "system",
            "content": "You are a news editor. Respond ONLY with valid JSON, no markdown, no explanation.",
        },
        {
            "role": "user",
            "content": (
                f"Given this article, generate a stable topic identifier "
                f"(snake_case, max 5 words, lowercase, e.g. 'rbi_rate_decision') "
                f"and a human-readable display name.\n"
                f"Article title: {title}\n"
                f"Entities: {entities_str}\n"
                f"Category: {category}\n"
                f'Return: {{"topic_key": "string", "display_name": "string"}}'
            ),
        },
    ]

    try:
        raw = mistral_chat(messages)
        return _parse_json(raw)
    except Exception as e:
        log(f"Mistral topic_key generation failed: {e}", "ERROR")
        return None


def generate_timeline_event(title: str, eli5: str) -> dict | None:
    """
    CALL 2: Generate a timeline event entry for an article.
    Returns: {"event_title": str, "event_summary": str, "sentiment": str} or None.
    """
    messages = [
        {
            "role": "system",
            "content": "You are a news analyst. Respond ONLY with valid JSON, no markdown, no explanation.",
        },
        {
            "role": "user",
            "content": (
                f"Generate a timeline event entry for this article.\n"
                f"Article: {title} — {eli5 or 'No summary available'}\n"
                f"Return: {{\n"
                f'  "event_title": "string (max 10 words, punchy)",\n'
                f'  "event_summary": "string (1-2 sentences)",\n'
                f'  "sentiment": "one of [positive, neutral, negative, escalating, resolving]"\n'
                f"}}"
            ),
        },
    ]

    try:
        raw = mistral_chat(messages)
        result = _parse_json(raw)
        if result:
            # Validate sentiment
            valid_sentiments = ["positive", "neutral", "negative", "escalating", "resolving"]
            if result.get("sentiment") not in valid_sentiments:
                result["sentiment"] = "neutral"
        return result
    except Exception as e:
        log(f"Mistral timeline event generation failed: {e}", "ERROR")
        return None


def _parse_json(raw: str) -> dict | None:
    """Parse JSON from Mistral response, stripping markdown fences."""
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*\n?", "", text)
        text = re.sub(r"\n?\s*```$", "", text)

    brace_start = text.find("{")
    brace_end = text.rfind("}")
    if brace_start != -1 and brace_end != -1:
        text = text[brace_start:brace_end + 1]

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        log(f"JSON parse error from Mistral: {text[:200]}", "WARN")
        return None


# ── Story Arc Upsert ──────────────────────────────────────────

def fetch_existing_arc(topic_key: str) -> dict | None:
    """Check if a story_arc already exists for this topic_key."""
    result = supabase_request(
        "GET",
        "story_arcs",
        params={
            "select": "id,topic_key,display_name,timeline,key_players,category",
            "topic_key": f"eq.{topic_key}",
            "limit": "1",
        },
    )
    if result and isinstance(result, list) and len(result) > 0:
        return result[0]
    return None


def create_story_arc(topic_key: str, display_name: str, category: str,
                     event: dict, article: dict) -> bool:
    """Create a new story_arc row with an initial timeline event."""
    entities = article.get("entities", [])
    if isinstance(entities, str):
        try:
            entities = json.loads(entities)
        except (json.JSONDecodeError, TypeError):
            entities = []

    timeline_entry = {
        "date": article.get("published_at", datetime.now(timezone.utc).isoformat()),
        "event_title": event.get("event_title", "Story begins"),
        "event_summary": event.get("event_summary", ""),
        "sentiment": event.get("sentiment", "neutral"),
        "article_id": article.get("id"),
    }

    key_players = [
        {"name": entity, "role": "mentioned", "relevance": 1.0}
        for entity in entities[:8]
    ]

    row = {
        "topic_key": topic_key,
        "display_name": display_name,
        "timeline": json.dumps([timeline_entry]),
        "key_players": json.dumps(key_players),
        "category": category,
    }

    result = supabase_request("POST", "story_arcs", data=row)
    return result is not None


def update_story_arc(arc: dict, event: dict, article: dict) -> bool:
    """Append a new event to an existing story arc's timeline."""
    # Parse existing timeline
    timeline = arc.get("timeline", [])
    if isinstance(timeline, str):
        try:
            timeline = json.loads(timeline)
        except (json.JSONDecodeError, TypeError):
            timeline = []

    # Build new event
    new_event = {
        "date": article.get("published_at", datetime.now(timezone.utc).isoformat()),
        "event_title": event.get("event_title", "New development"),
        "event_summary": event.get("event_summary", ""),
        "sentiment": event.get("sentiment", "neutral"),
        "article_id": article.get("id"),
    }

    # Skip if this article is already in the timeline
    existing_article_ids = {e.get("article_id") for e in timeline}
    if article.get("id") in existing_article_ids:
        log("  Article already in this story arc timeline", "SKIP")
        return True

    timeline.append(new_event)

    # Sort timeline by date
    timeline.sort(key=lambda e: e.get("date", ""))

    # Update key_players with new entities
    key_players = arc.get("key_players", [])
    if isinstance(key_players, str):
        try:
            key_players = json.loads(key_players)
        except (json.JSONDecodeError, TypeError):
            key_players = []

    existing_names = {p.get("name", "").lower() for p in key_players}
    entities = article.get("entities", [])
    if isinstance(entities, str):
        try:
            entities = json.loads(entities)
        except (json.JSONDecodeError, TypeError):
            entities = []

    for entity in entities:
        if entity.lower() not in existing_names:
            key_players.append({"name": entity, "role": "mentioned", "relevance": 0.8})
            existing_names.add(entity.lower())

    # Update in Supabase
    result = supabase_request(
        "PATCH",
        "story_arcs",
        data={
            "timeline": json.dumps(timeline),
            "key_players": json.dumps(key_players),
            "last_updated_at": datetime.now(timezone.utc).isoformat(),
        },
        params={"id": f"eq.{arc['id']}"},
    )
    return result is not None


def update_article_story_arc_key(article_id: str, topic_key: str) -> bool:
    """Set the story_arc_key on the article."""
    result = supabase_request(
        "PATCH",
        "articles",
        data={"story_arc_key": topic_key},
        params={"id": f"eq.{article_id}"},
    )
    return result is not None


# ── Main Entry Point ──────────────────────────────────────────

def process_story_arc(article: dict) -> str | None:
    """
    Main Agent 3 entry point.
    Takes an article (post Agent 2), builds/updates its story arc.
    Returns the topic_key, or None on failure.
    """
    article_id = article.get("id")
    title = article.get("title", "Untitled")
    eli5 = article.get("eli5", "")
    category = article.get("category", "Global")
    entities = article.get("entities", [])

    if isinstance(entities, str):
        try:
            entities = json.loads(entities)
        except (json.JSONDecodeError, TypeError):
            entities = []

    log(f"Processing story arc: {title[:60]}...")

    # Step 1: Generate topic_key via Mistral
    topic_result = generate_topic_key(title, entities, category)
    if not topic_result:
        log("Failed to generate topic_key", "ERROR")
        return None

    topic_key = topic_result.get("topic_key", "").strip().lower().replace(" ", "_")
    display_name = topic_result.get("display_name", title[:50])

    if not topic_key:
        log("Empty topic_key from Mistral", "ERROR")
        return None

    log(f"  Topic key: {topic_key} ({display_name})")

    # Step 2: Generate timeline event via Mistral
    event = generate_timeline_event(title, eli5)
    if not event:
        # Fallback: create a basic event without Mistral
        event = {
            "event_title": title[:60],
            "event_summary": eli5 or "Article published.",
            "sentiment": "neutral",
        }
        log("  Using fallback timeline event", "WARN")

    log(f"  Event: {event.get('event_title', '')}")

    # Step 3: Check if arc exists
    existing_arc = fetch_existing_arc(topic_key)

    if existing_arc:
        # Append to existing arc
        log(f"  Existing arc found — appending event #{len(existing_arc.get('timeline', []))+1}")
        success = update_story_arc(existing_arc, event, article)
    else:
        # Create new arc
        log("  Creating new story arc")
        success = create_story_arc(topic_key, display_name, category, event, article)

    if not success:
        log("Failed to upsert story arc", "ERROR")
        return None

    # Step 4: Update article with story_arc_key
    update_article_story_arc_key(article_id, topic_key)
    log(f"  Story arc complete: {topic_key}", "OK")

    # Rate limit between Mistral calls
    time.sleep(0.5)

    return topic_key


# ── CLI entry point ───────────────────────────────────────────

if __name__ == "__main__":
    import sys

    print("\n" + "=" * 60)
    print("🕐 AGENT 3 — Story Arc Builder")
    print("=" * 60)

    limit = 5
    if len(sys.argv) > 1:
        try:
            limit = int(sys.argv[1])
        except ValueError:
            pass

    log(f"Fetching up to {limit} synthesized articles without story arcs...")

    # Fetch articles that have been synthesized but don't have a story_arc_key yet
    articles = supabase_request(
        "GET",
        "articles",
        params={
            "select": "id,title,content,eli5,entities,category,published_at",
            "synthesis_briefing": "not.is.null",
            "story_arc_key": "is.null",
            "order": "published_at.desc",
            "limit": str(limit),
        },
    )

    if not articles or not isinstance(articles, list) or len(articles) == 0:
        log("No articles ready for story arc processing.", "OK")
        sys.exit(0)

    log(f"Found {len(articles)} articles to process")

    arcs_created = 0
    arc_keys = {}

    for i, article in enumerate(articles):
        try:
            log(f"\n[{i+1}/{len(articles)}]")
            key = process_story_arc(article)
            if key:
                arcs_created += 1
                arc_keys[key] = arc_keys.get(key, 0) + 1
        except Exception as e:
            log(f"Error processing article {article.get('id', '?')}: {e}", "ERROR")
            continue

    print(f"\n{'=' * 60}")
    print(f"📊 AGENT 3 SUMMARY")
    print(f"   Articles processed   : {len(articles)}")
    print(f"   Story arcs updated   : {arcs_created}")
    print(f"   Unique arcs          : {len(arc_keys)}")
    for key, count in arc_keys.items():
        print(f"     • {key}: {count} event(s)")
    print(f"{'=' * 60}\n")
