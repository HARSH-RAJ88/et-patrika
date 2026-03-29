"""
ET Patrika Pipeline — Configuration
Supabase client, Groq client, Mistral (via httpx), RSS feed list.
"""

import os
import json
import httpx
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
def supabase_request(method: str, table: str, data=None, params=None):
    """Make a direct REST API call to Supabase."""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    if method == "GET":
        resp = httpx.get(url, headers=headers, params=params, timeout=30)
    elif method == "POST":
        # For upserts, add resolution header
        if params and params.get("on_conflict"):
            headers["Prefer"] = "return=representation,resolution=merge-duplicates"
            url += f"?on_conflict={params['on_conflict']}"
        resp = httpx.post(url, headers=headers, json=data, timeout=30)
    elif method == "PATCH":
        resp = httpx.patch(url, headers=headers, json=data, params=params, timeout=30)
    else:
        raise ValueError(f"Unsupported method: {method}")
    
    if resp.status_code >= 400:
        print(f"  ❌ Supabase error ({resp.status_code}): {resp.text[:500]}")
        return None
    
    try:
        return resp.json()
    except json.JSONDecodeError:
        return resp.text


# ── Groq ──────────────────────────────────────────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY must be set in pipeline/.env")

groq_client = Groq(api_key=GROQ_API_KEY)


# ── Google Gemini ─────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY must be set in pipeline/.env")

genai.configure(api_key=GEMINI_API_KEY)
gemini_model = genai.GenerativeModel("gemini-2.0-flash")


# ── Mistral (via httpx — direct API calls) ────────────────────
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")
if not MISTRAL_API_KEY:
    raise ValueError("MISTRAL_API_KEY must be set in pipeline/.env")

def mistral_chat(messages: list, model: str = "mistral-small-latest") -> str:
    """Call Mistral API directly via httpx. Returns the text response."""
    resp = httpx.post(
        "https://api.mistral.ai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {MISTRAL_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": messages,
            "temperature": 0.3,
        },
        timeout=60,
    )
    resp.raise_for_status()
    data = resp.json()
    return data["choices"][0]["message"]["content"]


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
