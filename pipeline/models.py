"""
Shared pipeline payload models for Agent 1 -> Agent 2 -> Agent 3 handoffs.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field

VALID_CATEGORIES = {
    "Startups", "Policy", "Markets", "Tech", "Global",
    "Sports", "Entertainment", "Health", "Education",
    "Science", "Technology", "Business", "Finance",
    "Politics", "World",
}



def _coerce_entities(value) -> list[str]:
    if value is None:
        return []

    if isinstance(value, str):
        text = value.strip()
        if not text:
            return []
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return [str(item).strip() for item in parsed if str(item).strip()]
        except json.JSONDecodeError:
            return [text]
        return []

    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]

    return []


@dataclass
class AgentArticlePayload:
    id: str
    title: str
    content: str = ""
    source: str = "Unknown"
    published_at: str = ""
    category: str = "Global"
    entities: list[str] = field(default_factory=list)
    url: str | None = None
    original_title: str | None = None
    source_url: str | None = None
    eli5: str | None = None
    synthesis_briefing: str | None = None
    version: int = 1
    updated_by_agent: str | None = None

    @classmethod
    def from_dict(cls, data: dict) -> "AgentArticlePayload":
        if not isinstance(data, dict):
            raise ValueError("Article payload must be a dict")

        article_id = str(data.get("id", "")).strip()
        if not article_id:
            raise ValueError("Article payload missing id")

        title = str(data.get("title", "")).strip()
        if not title:
            raise ValueError("Article payload missing title")

        category = str(data.get("category", "Global") or "Global").strip() or "Global"
        if category not in VALID_CATEGORIES:
            category = "Global"

        return cls(
            id=article_id,
            title=title,
            content=str(data.get("content", "") or ""),
            source=str(data.get("source", "Unknown") or "Unknown"),
            published_at=str(data.get("published_at", "") or ""),
            category=category,
            entities=_coerce_entities(data.get("entities")),
            url=data.get("url"),
            original_title=data.get("original_title"),
            source_url=data.get("source_url"),
            eli5=data.get("eli5"),
            synthesis_briefing=data.get("synthesis_briefing"),
            version=int(data.get("version", 1) or 1),
            updated_by_agent=data.get("updated_by_agent"),
        )

    def to_dict(self) -> dict:
        return asdict(self)



def normalize_article_payload(article: AgentArticlePayload | dict) -> AgentArticlePayload:
    if isinstance(article, AgentArticlePayload):
        return article
    return AgentArticlePayload.from_dict(article)
