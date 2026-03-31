"""
ET Patrika Pipeline — Configuration
Supabase client, Groq client, Mistral (via httpx), RSS feed list.
"""

import os
import json
import httpx
import random
import time
from dotenv import load_dotenv
from groq import Groq
import google.generativeai as genai
from postgrest import SyncPostgrestClient

# Load environment variables from pipeline/.env
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# ── Supabase ──────────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in pipeline/.env")

# PostgREST client for Supabase REST API
supabase_rest = SyncPostgrestClient(
    base_url=f"{SUPABASE_URL}/rest/v1",
    headers={
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    },
)

# Helper: raw httpx client for Supabase (for upserts and complex queries)

class PipelineHTTPError(Exception):
    """Base exception for outbound HTTP failures in pipeline integrations."""

    def __init__(self, message: str, *, url: str | None = None, status_code: int | None = None):
        super().__init__(message)
        self.url = url
        self.status_code = status_code


class RetryableHTTPError(PipelineHTTPError):
    """Raised when a request failed with a retryable condition after retries."""


class NonRetryableHTTPError(PipelineHTTPError):
    """Raised when a request failed with a non-retryable condition."""


class TransportHTTPError(PipelineHTTPError):
    """Raised when transport-level failures persist after retries."""


class InvalidResponseError(PipelineHTTPError):
    """Raised when an upstream service returns an unexpected payload shape."""


def _is_retryable_status(status_code: int) -> bool:
    return status_code == 429 or status_code >= 500


def _retry_delay_seconds(attempt: int, *, base: float = 0.5, cap: float = 8.0, jitter: float = 0.35) -> float:
    return min(base * (2 ** attempt), cap) + random.uniform(0.0, jitter)


def _http_request_with_retries(
    method: str,
    url: str,
    *,
    headers: dict | None = None,
    params: dict | None = None,
    data: dict | list | None = None,
    timeout: float = 30.0,
    max_retries: int = 3,
    operation: str = "http request",
) -> httpx.Response:
    """Execute HTTP request with retry/backoff on retryable status and transport failures."""
    attempt = 0

    while True:
        try:
            response = httpx.request(
                method=method,
                url=url,
                headers=headers,
                params=params,
                json=data,
                timeout=timeout,
            )

            if response.status_code < 400:
                return response

            if _is_retryable_status(response.status_code) and attempt < max_retries:
                sleep_s = _retry_delay_seconds(attempt)
                print(
                    f"  ⚠️ {operation}: retryable HTTP {response.status_code} "
                    f"(attempt {attempt + 1}/{max_retries}), retrying in {sleep_s:.2f}s"
                )
                attempt += 1
                time.sleep(sleep_s)
                continue

            message = (
                f"{operation} failed with HTTP {response.status_code}: "
                f"{response.text[:500]}"
            )
            if _is_retryable_status(response.status_code):
                raise RetryableHTTPError(message, url=url, status_code=response.status_code)
            raise NonRetryableHTTPError(message, url=url, status_code=response.status_code)

        except (httpx.TimeoutException, httpx.TransportError) as exc:
            if attempt < max_retries:
                sleep_s = _retry_delay_seconds(attempt)
                print(
                    f"  ⚠️ {operation}: transport failure {exc} "
                    f"(attempt {attempt + 1}/{max_retries}), retrying in {sleep_s:.2f}s"
                )
                attempt += 1
                time.sleep(sleep_s)
                continue

            raise TransportHTTPError(
                f"{operation} transport failed after retries: {exc}",
                url=url,
            ) from exc


def supabase_request(method: str, table: str, data=None, params=None):
    """Make a direct REST API call to Supabase."""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    request_params = dict(params or {})

    try:
        if method not in {"GET", "POST", "PATCH"}:
            raise ValueError(f"Unsupported method: {method}")

        # For upserts, move on_conflict into URL query and keep other params intact.
        if method == "POST" and request_params.get("on_conflict"):
            headers["Prefer"] = "return=representation,resolution=merge-duplicates"

        response = _http_request_with_retries(
            method=method,
            url=url,
            headers=headers,
            params=request_params,
            data=data,
            timeout=30.0,
            max_retries=3,
            operation=f"Supabase {table}",
        )

        try:
            return response.json()
        except json.JSONDecodeError:
            return response.text

    except PipelineHTTPError as exc:
        status = f" ({exc.status_code})" if exc.status_code is not None else ""
        print(f"  ❌ Supabase request failed{status}: {exc}")
        return None


# ── Groq ──────────────────────────────────────────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY must be set in pipeline/.env")

groq_client = Groq(api_key=GROQ_API_KEY)

# Route cheaper tasks to smaller models by default.
GROQ_MODEL_CLASSIFIER = os.getenv("GROQ_MODEL_CLASSIFIER", "llama-3.1-8b-instant")
GROQ_MODEL_SYNTHESIS_PRIMARY = os.getenv("GROQ_MODEL_SYNTHESIS_PRIMARY", "llama-3.3-70b-versatile")

# Cost estimation (USD per 1M tokens)
GROQ_CLASSIFIER_INPUT_COST_PER_M = float(os.getenv("GROQ_CLASSIFIER_INPUT_COST_PER_M", "0.05"))
GROQ_CLASSIFIER_OUTPUT_COST_PER_M = float(os.getenv("GROQ_CLASSIFIER_OUTPUT_COST_PER_M", "0.08"))


# ── Google Gemini ─────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY must be set in pipeline/.env")

genai.configure(api_key=GEMINI_API_KEY)
GEMINI_MODEL_SYNTHESIS_FALLBACK = os.getenv("GEMINI_MODEL_SYNTHESIS_FALLBACK", "gemini-2.0-flash")
gemini_model = genai.GenerativeModel(GEMINI_MODEL_SYNTHESIS_FALLBACK)


# ── Sarvam Translation ────────────────────────────────────────
SARVAM_API_KEY = os.getenv("SARVAM_API_KEY")


# ── Mistral (via httpx — direct API calls) ────────────────────
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")
if not MISTRAL_API_KEY:
    raise ValueError("MISTRAL_API_KEY must be set in pipeline/.env")

MISTRAL_MODEL_STORY_ARC = os.getenv("MISTRAL_MODEL_STORY_ARC", "mistral-small-latest")

def mistral_chat(messages: list, model: str = MISTRAL_MODEL_STORY_ARC) -> str:
    """Call Mistral API directly via httpx. Returns the text response."""
    response = _http_request_with_retries(
        method="POST",
        url="https://api.mistral.ai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {MISTRAL_API_KEY}",
            "Content-Type": "application/json",
        },
        data={
            "model": model,
            "messages": messages,
            "temperature": 0.3,
        },
        timeout=60.0,
        max_retries=3,
        operation=f"Mistral {model}",
    )

    try:
        payload = response.json()
    except json.JSONDecodeError as exc:
        raise InvalidResponseError("Mistral returned non-JSON response") from exc

    try:
        return payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise InvalidResponseError("Mistral response missing choices[0].message.content") from exc


# ── RSS Feeds ─────────────────────────────────────────────────
RSS_FEEDS = [
    {"url": "https://inc42.com/feed/", "source": "Inc42"},
    {"url": "https://yourstory.com/feed", "source": "YourStory"},
    {"url": "https://community.nasscom.in/feed", "source": "NASSCOM"},
    {"url": "https://www.medianama.com/feed/", "source": "MediaNama"},
    {"url": "https://economictimes.indiatimes.com/tech/rssfeeds/13357270.cms", "source": "ET Tech"},
    {"url": "https://www.meity.gov.in", "source": "MeitY"},
    {"url": "https://www.marktechpost.com/feed/", "source": "MarkTechPost"},
    {"url": "https://techcrunch.com/tag/artificial-intelligence/feed/", "source": "TechCrunch AI"},
    {"url": "https://analyticsindiamag.com/feed", "source": "Analytics India Mag"},
]

# Valid article categories
VALID_CATEGORIES = [
    "Startups", "Policy", "Markets", "Tech", "Global",
    "Sports", "Entertainment", "Health", "Education",
    "Science", "Technology", "Business", "Finance",
    "Politics", "World",
]


# ── Logging helper ────────────────────────────────────────────
def log(msg: str, level: str = "INFO"):
    """Simple console logger with emoji prefixes."""
    prefixes = {
        "INFO": "ℹ️ ",
        "OK": "✅",
        "WARN": "⚠️ ",
        "ERROR": "❌",
        "SKIP": "⏭️ ",
    }
    prefix = prefixes.get(level, "  ")
    print(f"  {prefix} {msg}")
