"""
ET Patrika Pipeline — Agent 1: RSS Scraper + Article Classifier
Fetches articles from RSS feeds, classifies them via Groq, inserts into Supabase.
"""

import json
import time
import re
from datetime import datetime, timezone
from html import unescape

import feedparser
import httpx

from config import (
    groq_client,
    supabase_request,
    RSS_FEEDS,
    VALID_CATEGORIES,
    log,
)


# ── Content extraction helpers ────────────────────────────────

def strip_html(html_text: str) -> str:
    """Remove HTML tags and decode entities."""
    if not html_text:
        return ""
    text = re.sub(r"<[^>]+>", " ", html_text)
    text = unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def parse_published_date(entry) -> str | None:
    """Extract published date from a feedparser entry."""
    for field in ("published_parsed", "updated_parsed"):
        parsed = getattr(entry, field, None)
        if parsed:
            try:
                dt = datetime(*parsed[:6], tzinfo=timezone.utc)
                return dt.isoformat()
            except Exception:
                pass
    # Try raw string fields
    for field in ("published", "updated"):
        raw = getattr(entry, field, None)
        if raw:
            return raw
    return datetime.now(timezone.utc).isoformat()


def extract_content(entry) -> str:
    """Extract the best available content from a feed entry."""
    # Try content field first (full article text)
    content_list = getattr(entry, "content", [])
    if content_list:
        best = max(content_list, key=lambda c: len(c.get("value", "")))
        text = strip_html(best.get("value", ""))
        if text:
            return text

    # Try summary/description
    summary = getattr(entry, "summary", "") or getattr(entry, "description", "")
    if summary:
        return strip_html(summary)

    return ""


# ── Groq Classification ──────────────────────────────────────

CLASSIFIER_SYSTEM_PROMPT = (
    "You are a news classifier. Respond ONLY with a valid JSON object, "
    "no markdown, no explanation, no code fences."
)

VALID_CATEGORIES_STR = ", ".join(VALID_CATEGORIES)

def build_classifier_prompt(title: str, content: str) -> str:
    """Build the user prompt for the Groq classifier."""
    return f"""Classify this article and return JSON with these exact fields:
{{
  "category": one of [{VALID_CATEGORIES_STR}],
  "entities": [array of up to 8 strings — company names, person names, locations],
  "sentiment": one of ["positive", "neutral", "negative"],
  "credibility_score": float between 0.0 and 1.0 based on source reputation and factual language,
  "relevance_scores": {{
    "student": float 0.0-1.0,
    "investor": float 0.0-1.0,
    "founder": float 0.0-1.0,
    "citizen": float 0.0-1.0
  }}
}}
Article title: {title}
Article content (first 1500 chars): {content[:1500]}"""


def classify_article(title: str, content: str) -> dict:
    """Call Groq to classify an article. Returns classification dict."""
    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": CLASSIFIER_SYSTEM_PROMPT},
                {"role": "user", "content": build_classifier_prompt(title, content)},
            ],
            temperature=0.2,
            max_tokens=500,
        )
        raw = response.choices[0].message.content.strip()

        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)

        result = json.loads(raw)

        # Validate category
        if result.get("category") not in VALID_CATEGORIES:
            result["category"] = "Global"

        # Validate sentiment
        if result.get("sentiment") not in ("positive", "neutral", "negative"):
            result["sentiment"] = "neutral"

        # Clamp credibility_score
        try:
            result["credibility_score"] = max(0.0, min(1.0, float(result.get("credibility_score", 0.5))))
        except (ValueError, TypeError):
            result["credibility_score"] = 0.5

        # Validate relevance_scores
        roles = ["student", "investor", "founder", "citizen"]
        scores = result.get("relevance_scores", {})
        for role in roles:
            try:
                scores[role] = max(0.0, min(1.0, float(scores.get(role, 0.5))))
            except (ValueError, TypeError):
                scores[role] = 0.5
        result["relevance_scores"] = scores

        # Validate entities
        entities = result.get("entities", [])
        if not isinstance(entities, list):
            entities = []
        result["entities"] = entities[:8]

        return result

    except Exception as e:
        log(f"Groq classification failed: {e}", "WARN")
        return {
            "category": "Global",
            "entities": [],
            "sentiment": "neutral",
            "credibility_score": 0.5,
            "relevance_scores": {
                "student": 0.5,
                "investor": 0.5,
                "founder": 0.5,
                "citizen": 0.5,
            },
        }


# ── RSS Fetching ──────────────────────────────────────────────

def fetch_rss_articles() -> list[dict]:
    """Fetch articles from all configured RSS feeds."""
    all_articles = []

    for feed_info in RSS_FEEDS:
        feed_url = feed_info["url"]
        source_name = feed_info["source"]

        log(f"Fetching RSS: {source_name} ({feed_url})")

        try:
            feed = feedparser.parse(feed_url)

            if feed.bozo and not feed.entries:
                log(f"Feed parse error for {source_name}: {feed.bozo_exception}", "WARN")
                continue

            entry_count = 0
            for entry in feed.entries:
                title = getattr(entry, "title", None)
                link = getattr(entry, "link", None)

                if not title or not link:
                    continue

                title = strip_html(title)
                content = extract_content(entry)
                published_at = parse_published_date(entry)

                all_articles.append({
                    "title": title,
                    "original_title": title,
                    "url": link,
                    "content": content[:2500],  # Truncate to 2500 chars
                    "source": source_name,
                    "source_url": feed_url,
                    "published_at": published_at,
                })
                entry_count += 1

            log(f"Found {entry_count} articles from {source_name}", "OK")

        except Exception as e:
            log(f"Failed to fetch {source_name}: {e}", "ERROR")

    log(f"Total articles fetched from RSS: {len(all_articles)}")
    return all_articles


# ── Supabase Insert ───────────────────────────────────────────

def check_existing_urls(urls: list[str]) -> set:
    """Check which URLs already exist in Supabase."""
    if not urls:
        return set()
    
    existing = set()
    # Check in batches of 50
    for i in range(0, len(urls), 50):
        batch = urls[i:i+50]
        # Use Supabase REST API with 'in' filter
        url_filter = ",".join(f'"{u}"' for u in batch)
        params = {
            "select": "url",
            "url": f"in.({url_filter})",
        }
        result = supabase_request("GET", "articles", params=params)
        if result and isinstance(result, list):
            for row in result:
                existing.add(row["url"])
    
    return existing


def insert_article(article: dict, classification: dict) -> dict | None:
    """Insert a classified article into Supabase. Returns the inserted row or None."""
    row = {
        "url": article["url"],
        "title": article["title"],
        "original_title": article["original_title"],
        "content": article["content"],
        "source": article["source"],
        "source_url": article["source_url"],
        "published_at": article["published_at"],
        "category": classification["category"],
        "entities": json.dumps(classification["entities"]),
        "sentiment": classification["sentiment"],
        "credibility_score": classification["credibility_score"],
    }

    result = supabase_request(
        "POST", "articles", data=row, params={"on_conflict": "url"}
    )

    if result and isinstance(result, list) and len(result) > 0:
        return result[0]
    return None


# ── Main Pipeline ─────────────────────────────────────────────

def run() -> list[dict]:
    """
    Main Agent 1 entry point.
    Returns list of newly inserted article dicts (with Supabase IDs).
    """
    print("\n" + "=" * 60)
    print("🔍 AGENT 1 — RSS Scraper + Article Classifier")
    print("=" * 60)

    # Step 1: Fetch all RSS articles
    raw_articles = fetch_rss_articles()
    if not raw_articles:
        log("No articles fetched from any feed.", "WARN")
        return []

    # Step 2: Check which URLs already exist
    all_urls = [a["url"] for a in raw_articles]
    existing_urls = check_existing_urls(all_urls)
    log(f"Already in database: {len(existing_urls)} articles", "SKIP")

    new_articles = [a for a in raw_articles if a["url"] not in existing_urls]
    log(f"New articles to process: {len(new_articles)}")

    if not new_articles:
        log("No new articles to process.", "OK")
        return []

    # Step 3: Classify and insert each new article
    inserted = []
    for i, article in enumerate(new_articles):
        try:
            log(f"[{i+1}/{len(new_articles)}] Classifying: {article['title'][:80]}...")

            # Classify via Groq
            classification = classify_article(article["title"], article["content"])
            log(f"  → Category: {classification['category']} | Sentiment: {classification['sentiment']}")

            # Insert into Supabase
            result = insert_article(article, classification)
            if result:
                # Attach classification data to the result for downstream agents
                result["_relevance_scores"] = classification["relevance_scores"]
                inserted.append(result)
                log(f"  → Inserted (ID: {result.get('id', 'unknown')[:8]}...)", "OK")
            else:
                log(f"  → Insert failed or duplicate", "SKIP")

            # Rate limit: 0.5s between Groq calls
            time.sleep(0.5)

        except Exception as e:
            log(f"Error processing article {article['url']}: {e}", "ERROR")
            continue

    print(f"\n{'=' * 60}")
    print(f"📊 AGENT 1 SUMMARY")
    print(f"   RSS articles fetched : {len(raw_articles)}")
    print(f"   Already in DB        : {len(existing_urls)}")
    print(f"   Newly classified     : {len(new_articles)}")
    print(f"   Successfully inserted: {len(inserted)}")
    print(f"{'=' * 60}\n")

    return inserted


# ── CLI entry point ───────────────────────────────────────────

if __name__ == "__main__":
    results = run()
    if results:
        print(f"\n✅ Agent 1 complete. {len(results)} articles ready for Agent 2.")
    else:
        print("\n⚠️  Agent 1 complete. No new articles inserted.")
