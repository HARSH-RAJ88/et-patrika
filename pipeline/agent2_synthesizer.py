"""
ET Patrika Pipeline — Agent 2: Context Generator + Multi-Article Synthesizer
Takes classified articles, fetches related articles, synthesizes via routed primary model
(with configured fallback), generates role-specific contexts.
"""

import json
import re
import time
import asyncio
import os
import random

from config import (
    groq_client,
    gemini_model,
    GROQ_MODEL_SYNTHESIS_PRIMARY,
    GEMINI_MODEL_SYNTHESIS_FALLBACK,
    supabase_request,
    supabase_rest,
    log,
)
from models import AgentArticlePayload, normalize_article_payload

# ── Related Article Fetching ─────────────────────────────────

def fetch_related_articles(article: AgentArticlePayload | dict, limit: int = 5) -> list[dict]:
    """Fetch up to `limit` related articles from Supabase."""
    article = normalize_article_payload(article).to_dict()
    article_id = article.get("id")
    category = article.get("category")
    related = []

    if category:
        params = {
            "select": "id,title,content,entities,category,source,published_at",
            "category": f"eq.{category}",
            "id": f"neq.{article_id}",
            "order": "published_at.desc",
            "limit": str(limit),
        }
        result = supabase_request("GET", "articles", params=params)
        if result and isinstance(result, list):
            related = result

    # Backfill if we don't have enough
    if len(related) < limit:
        remaining = limit - len(related)
        existing_ids = {r["id"] for r in related}
        existing_ids.add(article_id)
        params = {
            "select": "id,title,content,entities,category,source,published_at",
            "id": f"not.in.({','.join(existing_ids)})",
            "order": "published_at.desc",
            "limit": str(remaining),
        }
        result = supabase_request("GET", "articles", params=params)
        if result and isinstance(result, list):
            related.extend(result)

    return related[:limit]


# ── Synthesis Prompts ─────────────────────────────────────────

SYNTHESIS_SYSTEM = """
You are the editorial intelligence engine of ET Patrika — India's first
role-aware business news platform. You have four analysts on your team
and one mandatory pre-step called the Rashomon Protocol.

─────────────────────────────────────────
THE RASHOMON PROTOCOL (mandatory first step)
─────────────────────────────────────────

Before any analyst writes a single word, you must produce a tension map.
A tension map answers three questions about the news event:

1. WINNERS: Which roles directly benefit from this news? List them and say why
   in one sentence each. Be specific — "investor benefits because rate cut 
   raises NBFC valuations" is valid. "everyone benefits" is not.

2. LOSERS: Which roles are threatened, disadvantaged, or face new risk?
   Same specificity required.

3. OPPOSITIONS: Where do two roles have directly conflicting interests?
   Example: "Founder wants deregulation; Citizen wants more government protection."
   If no opposition exists, state "low conflict story — force divergence on 
   FRAMING, not stakes."

The tension map is internal — it does NOT appear in the final JSON output.
But every role_context section must be written FROM the position established
in the tension map. A role that was marked "loser" cannot have an optimistic
why_it_matters. A role marked "winner" cannot be cautious. The map is binding.

─────────────────────────────────────────
THE FOUR INDIA CORRESPONDENTS
─────────────────────────────────────────

These are real people. Write as them, not about them.

ARJUN — 22, from Jaipur. Preparing for campus placements at a Tier-2 engineering
college. His world: JEE results, LinkedIn skill badges, placement drives, internship 
stipends, BYJU's courses he half-finished, college fests, anxiety about salary 
packages, competitive exams, his parents' expectations, hostel mess food.
He talks like he's WhatsApp-messaging a friend at 11 PM before an exam.
Energy: Curious, slightly anxious, trying to extract opportunity from everything.

VOCABULARY HE USES: skills, placement, salary, internship, campus, upskilling,
competition, opportunity, career move, future-proof, learn, certify, apply, shortlist,
job market, fresher, package, HR round, LinkedIn, college senior

VOCABULARY HE NEVER USES (these words do not exist in his world):
portfolio, equity, market cap, GTM, unit economics, regulatory compliance,
capex, EBITDA, valuations, term sheet, FII, DII, Nifty, Sensex, sector rotation.
If you write any of these in Arjun's section, you have broken character.

─────────────────────────────────────────

MEERA — 38, from Mumbai. HNI investor. Zerodha power user. Runs a WhatsApp
group of 40 investors. Her world: Sensex alerts at 9:15 AM, FII/DII data every
evening, screener.in watchlists with 200 stocks, quarterly earnings season,
Nifty options on expiry day, SIP books, rights issues, IPO grey market premium,
CNBC Awaaz in the background, portfolio review every Sunday morning.
She talks like a Bloomberg terminal crossed with a WhatsApp stock group admin.
Energy: Precise, data-driven, always looking for the asymmetric angle.

VOCABULARY SHE USES: allocation, exposure, multiple, catalyst, risk-reward,
sector rotation, earnings, FII flow, long signal, short signal, downside protection,
re-rating, derating, thesis, entry point, stop-loss, beta, alpha, Nifty, mid-cap,
large-cap, CAGR, quarterly numbers, promoter holding, OPM

VOCABULARY SHE NEVER USES:
placement, campus, ration card, sarkari scheme, chai tapri, EMI worry,
school fees, government hospital, auto-rickshaw fare. Invisible to her.

─────────────────────────────────────────

VIKRAM — 31, from Bengaluru. Running a Series-A fintech startup in Koramangala.
His world: DPIIT paperwork, term sheets, runway calculations at 3 AM, pitch deck
iteration number 14, Razorpay dashboard, Sequoia India meetings, YC India cohort
WhatsApp, Entrackr funding alerts, co-working space, co-founder disagreements,
hiring engineers in a hot market, regulatory grey zones, investor board calls.
He talks like a founder's journal — strategic, slightly paranoid, always hunting moats.
Energy: Opportunistic and defensive simultaneously. Sees every news item as either
a threat to his current model or a new market to enter.

VOCABULARY HE USES: build, GTM, unit economics, distribution, defensibility, moat,
CAC, LTV, product-market fit, fundraise, burn rate, pivot, regulatory arbitrage,
market timing, wedge, competitive moat, runway, ARR, cohort, churn, NPS

VOCABULARY HE NEVER USES:
placement percentile, FII flows, EMI burden, ration card, sarkari hospital,
school fees, government scheme. Not his reality.

─────────────────────────────────────────

SUNITA — 45, from Dhubri, Assam. School teacher, government employee.
Two kids — one in Class 12, one in a government college. EMI on a two-wheeler.
Her world: electricity bills, government hospital queues, ration card renewal,
auto-rickshaw fares to school, sabzi mandi prices on Sunday morning, school fees,
bank branch visits for passbook update, government schemes she may or may not qualify
for, WhatsApp forwards about price rises, DD News in the evening, IRCTC booking
for the one family trip per year, local MLA's phone number saved for emergencies.
She talks like a trusted mausi explaining things over chai — warm, direct, no jargon.
Energy: Practical. She does not have time for things that don't affect her next month.

VOCABULARY SHE USES: ghar, family, bacche ki padhai, mehangai, sarkari kaam,
naukri, bijli ka bill, petrol ke daam, doctor fees, loan ki EMI, school fees,
ration shop, government scheme, apply karna, form bharna, hamare liye kya hai

VOCABULARY SHE NEVER USES — HARD BAN:
portfolio, equity, sector rotation, GTM, startup, valuation, runway, term sheet,
market cap, EBITDA, FII, placement package, campus interview.
If Sunita uses any of these words, the entire output fails the quality check.

─────────────────────────────────────────
CRITICAL LAW (non-negotiable):

After writing all four sections, read them back to back.
If any two sections could be exchanged without a reader noticing the swap,
you have failed. Do not return the JSON. Rewrite the weaker section from scratch
until it is impossible to mistake for any other role's writing.

The test: A judge at a hackathon should be able to read Arjun's section and
immediately know it was written for a 22-year-old from Jaipur.
Then read Sunita's section and immediately know it was written for a 45-year-old
school teacher from Dhubri. Not just "different framing" — different life.
"""

def build_synthesis_prompt(article: dict, related: list[dict]) -> str:
    n = len(related)
    related_articles_formatted = ""
    for i, r in enumerate(related, 1):
        content_preview = (r.get("content") or "")[:800]
        related_articles_formatted += (
            f"\nRELATED ARTICLE {i}:\n"
            f"Title: {r['title']}\n"
            f"Source: {r.get('source', 'Unknown')}\n"
            f"Content: {content_preview}\n"
        )
    
    if not related_articles_formatted:
        related_articles_formatted = "(No related articles found — synthesize from primary article alone.)"

    return f"""
PRIMARY ARTICLE:
Title: {article.get('title', '')}
Source: {article.get('source', 'Unknown')} (published: {article.get('published_at', '')})
Content: {(article.get('content') or '')[:2000]}

RELATED ARTICLES ({n} found on same topic):
{related_articles_formatted}

─────────────────────────────────────────────────────────
STEP 0 — RASHOMON PROTOCOL (run this before anything else)
─────────────────────────────────────────────────────────

Produce the tension map internally. Write it out as your chain-of-thought
before generating the JSON. Answer:

WINNERS from this news: [who + 1-sentence specific reason each]
LOSERS from this news: [who + 1-sentence specific reason each]  
OPPOSITIONS: [where two roles have conflicting interests, or "low conflict"]
CONFLICT INDEX: [float 0.0-1.0 — how much do the four roles disagree about
                 whether this news is good or bad?]
                 0.0 = all roles see this the same way (rare)
                 0.5 = some roles benefit, some are neutral
                 1.0 = roles have directly opposing interests (ideal demo story)

The tension map does NOT appear in the final JSON. But every section 
you write must be consistent with it. This is your contract with the reader.

─────────────────────────────────────────────────────────
STEP 1 — STORY CLASSIFICATION
─────────────────────────────────────────────────────────

story_momentum: One of:
  "emerging"   → First 1-2 sources covering this. Story just broke. No consensus yet.
  "building"   → Multiple sources. Angles multiplying. Not yet mainstream.
  "peak"       → Mainstream coverage. Noise is high. Most angles covered.
  "resolving"  → Outcome becoming clear. Story winding down.
  "aftermath"  → Story concluded. Now about consequences and lessons only.

bharat_india_split: One of:
  "india_only"  → Tier-1 cities, English-speaking urban India, professionals only
  "bharat_only" → Rural/semi-urban India, agriculture, grassroots, government schemes
  "both"        → Genuinely affects all of India regardless of tier
  "global"      → India is context, story is primarily global

source_credibility: Float 0.0-1.0
  0.8-1.0: Economic Times, LiveMint, Hindu BusinessLine, Reuters India, Bloomberg
           Quint, YourStory, Inc42, Entrackr, Moneycontrol, SEBI/RBI primary sources
  0.5-0.7: Business Standard, NDTV Profit, Zee Business, TechCrunch India
  0.2-0.4: Unknown blogs, unattributed opinion pieces, PRs without corroboration

conflict_index: Float 0.0-1.0 from your Rashomon Protocol tension map above.

─────────────────────────────────────────────────────────
STEP 2 — ELI5 (shared across all roles)
─────────────────────────────────────────────────────────

eli5 rules — follow exactly:

Opening hook — choose one that fits the story:
  "Arre bhai, socho ek second ke liye..."
  "Simple baat hai —"
  "Yaad hai jab [relevant Indian reference]..."
  "Toh hua kya aaj?"

Body — use INDIAN analogies ONLY:
  Payments → UPI, PhonePe, Paytm (NEVER Venmo, PayPal, Stripe)
  Shopping → Flipkart, Meesho, Zepto, BigBasket (NEVER Amazon US)
  Scale → "130 crore Indians", "har gali mein", Tier-2 towns, district headquarters
  Daily life → chai tapri, dabba delivery, sabzi mandi, auto-rickshaw, sarkari daftar
  Government → Aadhaar, DigiLocker, IRCTC, IndiaAI Mission, PM-KISAN, EPFO

Close — ALWAYS end with this format:
  "Toh iska matlab? [One crisp sentence takeaway in plain Hindi-English]"

Constraints:
  Max 200 words.
  Hindi-English code-switching is encouraged (not mandatory).
  FORBIDDEN: baseball analogies, NFL, Thanksgiving, Walmart US, Silicon Valley 
  (say "Indian tech startup ecosystem" instead), dry academic tone,
  "In conclusion", "Furthermore", "It is important to note".
  BANNED START: "This article discusses" → immediate failure.

─────────────────────────────────────────────────────────
STEP 3 — SYNTHESIS BRIEFING (shared, factual, no role framing)
─────────────────────────────────────────────────────────

5 paragraphs. Dense. Factual. No editorializing.

Para 1: WHAT — Core event. Facts, numbers, names, dates, amounts. Nothing else.
Para 2: WHY — Underlying forces, trigger events, historical context that caused this.
Para 3: TENSIONS — Where sources conflict. What's under-reported. What's contested.
         What the mainstream narrative is missing. If all sources agree, note what
         questions remain unanswered.
Para 4: THE ARC — Where this fits in India's longer economic/policy/startup story.
         What has this story been building toward? What does it echo from 5 years ago?
Para 5: WHAT'S NEXT — 2-3 specific future events with rough timeframes.
         Each must be concrete: "RBI's next MPC meeting on [month]",
         "Q4 earnings from HDFC Bank in [month]", "DPIIT deadline on [date]".

─────────────────────────────────────────────────────────
STEP 4 — THE FOUR ROLE CONTEXTS
─────────────────────────────────────────────────────────

Write Arjun's section first, completely.
Then write Meera's section — START by noting one specific thing Arjun said and
why Meera sees it completely differently. Do not put this note in the JSON — it
is your chain-of-thought to force divergence.
Then write Vikram's section — START by noting one specific thing Meera said and 
why Vikram's lens gives a completely different reading.
Then write Sunita's section — START by noting that she doesn't know or care about
what Arjun, Meera, or Vikram said. Her world is entirely different.

For EACH role context, generate ALL of these fields:

headline:
  A role-specific rewrite of the headline. Max 12 words.
  This is NOT the original title. It is a completely new headline
  written inside that role's vocabulary and worldview.
  
  Arjun's headlines use: career, skill, job, placement, salary, learn, opportunity
  ✓ "This SEBI change might affect which companies hire freshers next year"
  ✗ "SEBI tightens F&O norms" (this is a news headline, not Arjun's headline)
  
  Meera's headlines use: sector, signal, allocation, rotation, earnings, catalyst
  ✓ "NBFC tailwind building — mid-cap financials worth a second look now"
  ✗ "RBI cuts rates" (no signal, no direction, not a Meera headline)
  
  Vikram's headlines use: window, build, moat, threat, GTM, wedge, opportunity
  ✓ "Rate cut opens 6-month pricing window for embedded finance products"
  ✗ "Good news for fintech" (too vague, no strategic frame)
  
  Sunita's headlines use: ghar, bill, paisa, family, government, sasta, mehanga
  ✓ "Aapki bijli ka bill thoda kam ho sakta hai — yahan bataya hai kaise"
  ✗ "Policy benefits households" (jargon, not her voice)

  HEADLINE SWAP TEST (mandatory before proceeding):
  Read all 4 headlines. Could any headline appear in another role's section
  without looking wrong? If YES, rewrite until all 4 are mutually exclusive.

why_it_matters:
  3-4 sentences. Written entirely in that role's vocabulary.
  The emotional register must match the persona.
  Arjun = slightly anxious but hopeful
  Meera = clinical, data-confident
  Vikram = strategic, paranoid-optimistic
  Sunita = warm, practical, no-nonsense
  
  VOCABULARY ENFORCEMENT (hard):
  Arjun's section MUST contain at least 2 of: career, skills, placement, campus, opportunity
  Meera's section MUST contain at least 2 of: sector, allocation, multiple, signal, earnings
  Vikram's section MUST contain at least 2 of: product, build, GTM, unit economics, moat
  Sunita's section MUST contain zero of: portfolio, equity, GTM, valuation, EBITDA, IPO

role_analogy:
  A single concrete scenario from that role's specific life that makes this news real.
  Not a generic analogy. A scene from their world.
  
  Arjun's analogy scenes: JEE result day, placement offer letter, LinkedIn notification,
                          internship stipend credit, hostel room, college fest
  Meera's analogy scenes: Sunday morning portfolio review, 9:15 AM Sensex open,
                          quarterly results day, IPO allotment wait, stock group chat
  Vikram's analogy scenes: 3 AM runway calculation, term sheet negotiation, 
                            pitch deck slide 12, investor board call, co-founder argument
  Sunita's analogy scenes: Sunday sabzi mandi, bank passbook update queue,
                           electricity bill day, school fees deadline, ration shop visit
  
  The analogy must end with a direct connection to the news:
  "...just like that, except now [news impact in their life]."

action_cards: Array of exactly 2 objects.
  
  BANNED TITLES (if you write any of these, the output fails):
    "Stay informed", "Follow the news", "Keep an eye on", "Monitor developments",
    "Learn more", "Read further", "Stay updated", "Be aware"
  
  Each action_card must have:
    title: A specific action. Starts with a verb. Contains a concrete noun.
           ✓ "Add Infosys and TCS to your campus target list this month"
           ✓ "Review your NBFC allocation before next earnings season"
           ✓ "File your DPIIT startup recognition before the Q4 deadline"
           ✓ "Check if your LPG subsidy is still active on your Aadhaar"
           ✗ "Stay informed about developments" → FAIL
           
    description: 2 sentences. Sentence 1: why this action matters right now.
                 Sentence 2: exactly how to do it (specific app, website, form number,
                 office to visit, person to call — whatever is most relevant).
                 
    cta: Exactly 4 words. Verb first. Role-specific.
         Arjun: "Check campus placement portal" / "Apply for this internship"
         Meera: "Review NBFC fund holdings" / "Set Nifty alert now"
         Vikram: "File DPIIT form today" / "Update investor update deck"
         Sunita: "Check Aadhaar LPG link" / "Ask MLA about scheme"

relevance_score: Float 0.0-1.0.
  Be honest. If a DPIIT startup policy story scores 0.9 for Vikram, it should
  score 0.2 for Sunita (she doesn't have a startup). Don't give everyone 0.7.
  Forced variance: the highest and lowest relevance_score across the 4 roles
  MUST differ by at least 0.3. If they don't, you are being intellectually lazy.

what_to_watch:
  One sentence. Format: "[Specific event] in [rough timeframe], which will 
  [specific consequence for this role]."
  
  Must be concrete. Must include a what, when, and why-for-this-role.
  Arjun: about next placement season, new skill in demand, or job market shift
  Meera: about next earnings date, policy announcement, or FII flow window
  Vikram: about next funding window, regulation deadline, or competitive entry
  Sunita: about next price change, government scheme deadline, or election cycle

─────────────────────────────────────────────────────────
STEP 5 — MANDATORY QUALITY GATE
─────────────────────────────────────────────────────────

Before generating the JSON, run ALL 8 checks. If any FAIL, fix before outputting.

CHECK 1: Headline swap test
  Read all 4 headlines back-to-back without role labels.
  Can you correctly assign each headline to its role without guessing?
  If NO → rewrite whichever headline failed identification.

CHECK 2: Sunita's jargon test
  Scan Sunita's entire section for: portfolio, equity, market cap, GTM,
  unit economics, valuation, EBITDA, IPO, sector, Nifty, Sensex, startup,
  term sheet, runway, CAC, LTV, placement package, campus interview.
  Any of these present? → FAIL. Rewrite.

CHECK 3: Arjun's vocabulary test  
  Does Arjun's why_it_matters contain at least 2 of: career, skills, placement,
  campus, opportunity, job, learn, fresher, upskill?
  If fewer than 2 → FAIL. Rewrite.

CHECK 4: Action card specificity test
  Read all 8 action card titles (2 per role). Any start with "Stay", "Follow",
  "Monitor", "Keep", "Learn more", "Read"? → FAIL. Rewrite those cards.

CHECK 5: eli5 opening test
  Does eli5 start with "This article", "This news", "The article", "Today" (flat)?
  → FAIL. Rewrite with a hook.

CHECK 6: relevance_score variance test
  Highest relevance_score minus lowest relevance_score across 4 roles >= 0.3?
  If NO → you assigned similar relevance to all roles. Fix the outlier scores.

CHECK 7: Meera's vocabulary test
  Does Meera's why_it_matters contain at least 2 of: sector, allocation, multiple,
  signal, earnings, catalyst, exposure, rotation?
  If fewer than 2 → FAIL. Rewrite.

CHECK 8: The impossibility test (most important)
  Could Arjun's section and Meera's section be swapped without a reader noticing?
  If YES → the entire pipeline has failed its core purpose. Rewrite both from scratch
  using the tension map from the Rashomon Protocol.

Only generate the JSON after passing all 8 checks.

─────────────────────────────────────────────────────────
RETURN THIS EXACT JSON STRUCTURE
─────────────────────────────────────────────────────────

Return ONLY valid JSON. No markdown fences. No text before or after.
No "Here is the JSON:" prefix. Start with {{ and end with }}.

{{
  "story_momentum": "emerging|building|peak|resolving|aftermath",
  "bharat_india_split": "india_only|bharat_only|both|global",
  "source_credibility": 0.0,
  "conflict_index": 0.0,
  "eli5": "Arre bhai... [Indian-context explanation] ... Toh iska matlab? [one-line takeaway]",
  "key_concepts": ["concept1", "concept2", "concept3"],
  "synthesis_briefing": "Para1...\\n\\nPara2...\\n\\nPara3...\\n\\nPara4...\\n\\nPara5...",
  "role_contexts": {{
    "student": {{
      "headline": "...",
      "why_it_matters": "2-3 sentences explaining relevance to students and young professionals",
      "role_analogy": "...",
      "action_cards": [
        {{"title": "...", "description": "...", "cta": "..."}},
        {{"title": "...", "description": "...", "cta": "..."}}
      ],
      "relevance_score": 0.0,
      "what_to_watch": "..."
    }},
    "investor": {{
      "headline": "...",
      "why_it_matters": "...",
      "role_analogy": "...",
      "action_cards": [
        {{"title": "...", "description": "...", "cta": "..."}},
        {{"title": "...", "description": "...", "cta": "..."}}
      ],
      "relevance_score": 0.0,
      "what_to_watch": "..."
    }},
    "founder": {{
      "headline": "...",
      "why_it_matters": "...",
      "role_analogy": "...",
      "action_cards": [
        {{"title": "...", "description": "...", "cta": "..."}},
        {{"title": "...", "description": "...", "cta": "..."}}
      ],
      "relevance_score": 0.0,
      "what_to_watch": "..."
    }},
    "citizen": {{
      "headline": "...",
      "why_it_matters": "...",
      "role_analogy": "...",
      "action_cards": [
        {{"title": "...", "description": "...", "cta": "..."}},
        {{"title": "...", "description": "...", "cta": "..."}}
      ],
      "relevance_score": 0.0,
      "what_to_watch": "..."
    }}
  }}
}}
"""

# ── Response Parsing ──────────────────────────────────────────

def parse_llm_response(raw: str) -> dict | None:
    text = raw.strip()
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        text = match.group(1)
    else:
        match = re.search(r'(\{[\s\n]*"story_momentum"[\s\S]*\})', text)
        if match:
            text = match.group(1)
        else:
            brace_start = text.find("{")
            brace_end = text.rfind("}")
            if brace_start != -1 and brace_end != -1:
                text = text[brace_start:brace_end + 1]
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        log(f"JSON parse error: {e}", "WARN")
        return None


PERSONA_HARD_BANS = {
    "citizen": [
        "portfolio", "equity", "market cap", "gtm", "unit economics",
        "valuation", "ebitda", "ipo", "sector", "nifty", "sensex",
        "startup", "term sheet", "runway", "cac", "ltv",
        "placement package", "campus interview",
    ]
}


def _flatten_role_text(ctx: dict) -> str:
    chunks = [
        str(ctx.get("headline", "")),
        str(ctx.get("why_it_matters", "")),
        str(ctx.get("role_analogy", "")),
        str(ctx.get("what_to_watch", "")),
    ]

    cards = ctx.get("action_cards", [])
    if isinstance(cards, list):
        for card in cards:
            if isinstance(card, dict):
                chunks.append(str(card.get("title", "")))
                chunks.append(str(card.get("description", "")))
                chunks.append(str(card.get("cta", "")))

    return "\n".join(chunks)


def _find_banned_hits(text: str, banned_terms: list[str]) -> list[str]:
    hits = []
    for term in banned_terms:
        # Word-boundary match, case-insensitive.
        pattern = r"\b" + re.escape(term) + r"\b"
        if re.search(pattern, text, re.IGNORECASE):
            hits.append(term)
    return hits


def validate_persona_constraints(result: dict) -> tuple[bool, list[str]]:
    role_contexts = result.get("role_contexts", {})
    if not isinstance(role_contexts, dict):
        return False, ["role_contexts missing or invalid"]

    issues = []

    for role, banned_terms in PERSONA_HARD_BANS.items():
        ctx = role_contexts.get(role, {})
        if not isinstance(ctx, dict):
            issues.append(f"{role}: missing role context")
            continue

        role_text = _flatten_role_text(ctx)
        hits = _find_banned_hits(role_text, banned_terms)
        if hits:
            issues.append(f"{role}: banned vocabulary detected -> {', '.join(sorted(set(hits)))}")

    return len(issues) == 0, issues


def repair_persona_violations(
    article: dict,
    related: list[dict],
    invalid_result: dict,
    issues: list[str],
) -> dict | None:
    issue_lines = "\n".join(f"- {issue}" for issue in issues)

    repair_prompt = (
        build_synthesis_prompt(article, related)
        + "\n\nSTRICT REPAIR TASK:\n"
        + "The previous JSON violated persona constraints. Repair it and return corrected JSON only.\n"
        + "Do not change the schema. Preserve intent and facts.\n"
        + "Fix banned vocabulary violations with role-appropriate rewrites.\n"
        + f"Violations:\n{issue_lines}\n\n"
        + "Previous invalid JSON:\n"
        + json.dumps(invalid_result, ensure_ascii=False)
    )

    return synthesize_with_llm(repair_prompt)

# ── LLM Callers ───────────────────────────────────────────────

_LAST_SYNTHESIS_AUDIT = {
  "provider": "unknown",
  "model": "",
  "retry_count": 0,
}


def get_last_synthesis_audit() -> dict:
  return dict(_LAST_SYNTHESIS_AUDIT)



def _extract_http_status(exc: Exception) -> int | None:
  status = getattr(exc, "status_code", None)
  if isinstance(status, int):
    return status

  match = re.search(r"\b(429|5\d\d|4\d\d)\b", str(exc))
  if match:
    try:
      return int(match.group(1))
    except ValueError:
      return None
  return None


def _is_retryable_status(status_code: int | None) -> bool:
  if status_code is None:
    return False
  return status_code == 429 or status_code >= 500


def _backoff_seconds(attempt: int) -> float:
  # 2^attempt + jitter, bounded so pipeline remains responsive.
  return min(float(2 ** attempt), 20.0) + random.uniform(0.0, 0.35)


def call_groq(prompt: str) -> tuple[dict | None, int]:
  max_retries = 3
  retries_used = 0
  for attempt in range(max_retries + 1):
    try:
      response = groq_client.chat.completions.create(
        model=GROQ_MODEL_SYNTHESIS_PRIMARY,
        messages=[
          {"role": "system", "content": SYNTHESIS_SYSTEM},
          {"role": "user", "content": prompt},
        ],
        temperature=0.3,
        max_tokens=4000,
      )
      raw = response.choices[0].message.content
      if raw:
        return parse_llm_response(raw), retries_used
      return None, retries_used
    except Exception as e:
      status_code = _extract_http_status(e)
      if attempt < max_retries and _is_retryable_status(status_code):
        delay = _backoff_seconds(attempt)
        retries_used += 1
        status_msg = f"HTTP {status_code}" if status_code is not None else "retryable error"
        log(
          f"Groq {status_msg}; retrying in {delay:.2f}s "
          f"(attempt {attempt + 1}/{max_retries})",
          "WARN",
        )
        time.sleep(delay)
        continue
      log(f"Groq primary error: {e}", "ERROR")
      return None, retries_used
  return None, retries_used


def call_gemini(prompt: str) -> tuple[dict | None, int]:
  max_retries = 2
  retries_used = 0
  for attempt in range(max_retries + 1):
    try:
      response = gemini_model.generate_content(
        [
          {"role": "user", "parts": [SYNTHESIS_SYSTEM]},
          {"role": "user", "parts": [prompt]},
        ]
      )

      raw = getattr(response, "text", None)
      if not raw and getattr(response, "candidates", None):
        try:
          raw = response.candidates[0].content.parts[0].text
        except Exception:
          raw = None

      if raw:
        return parse_llm_response(raw), retries_used
      return None, retries_used
    except Exception as e:
      status_code = _extract_http_status(e)
      if attempt < max_retries and _is_retryable_status(status_code):
        delay = _backoff_seconds(attempt)
        retries_used += 1
        status_msg = f"HTTP {status_code}" if status_code is not None else "retryable error"
        log(
          f"Gemini fallback {status_msg}; retrying in {delay:.2f}s "
          f"(attempt {attempt + 1}/{max_retries})",
          "WARN",
        )
        time.sleep(delay)
        continue
      log(f"Gemini fallback error: {e}", "ERROR")
      return None, retries_used
  return None, retries_used


def synthesize_with_llm(prompt: str) -> dict | None:
  global _LAST_SYNTHESIS_AUDIT

  log(f"  Calling Groq {GROQ_MODEL_SYNTHESIS_PRIMARY} (Primary)...", "INFO")
  result, groq_retries = call_groq(prompt)
  if result:
    _LAST_SYNTHESIS_AUDIT = {
      "provider": "groq",
      "model": GROQ_MODEL_SYNTHESIS_PRIMARY,
      "retry_count": groq_retries,
    }
    log("  ✓ Groq synthesis successful", "OK")
    return result

  log("  Groq failed, trying Gemini fallback...", "WARN")
  fallback, gemini_retries = call_gemini(prompt)
  if fallback:
    _LAST_SYNTHESIS_AUDIT = {
      "provider": "gemini",
      "model": GEMINI_MODEL_SYNTHESIS_FALLBACK,
      "retry_count": groq_retries + gemini_retries,
    }
    log("  ✓ Gemini fallback synthesis successful", "OK")
    return fallback

  _LAST_SYNTHESIS_AUDIT = {
    "provider": "none",
    "model": "",
    "retry_count": groq_retries + gemini_retries,
  }
  log("  Groq primary and Gemini fallback both failed.", "ERROR")
  return None

# ── Supabase Updates & Workflow ──────────────────────────────────────────

def check_context_exists(article_id: str) -> bool:
    result = supabase_request(
        "GET", "article_contexts",
        params={"select": "id", "article_id": f"eq.{article_id}", "limit": "1"},
    )
    return result is not None and isinstance(result, list) and len(result) > 0

async def synthesize_article(article: AgentArticlePayload | dict) -> bool:
  article_payload = normalize_article_payload(article)
  article_dict = article_payload.to_dict()
  article_id = article_payload.id
  title = article_payload.title
  log(f"Synthesizing: {title[:70]}...")
  start_time = time.time()

  related = fetch_related_articles(article_payload)
  log(f"  Found {len(related)} related articles")

  prompt = build_synthesis_prompt(article_dict, related)
  result = synthesize_with_llm(prompt)

  if result is None:
    log("Retrying with single-article mode...", "WARN")
    prompt = build_synthesis_prompt(article_dict, [])
    result = synthesize_with_llm(prompt)

  if result is None:
    log(f"Synthesis completely failed for: {title[:50]}", "ERROR")
    return False

  eli5 = result.get("eli5", "")
  synthesis_briefing = result.get("synthesis_briefing", "")
  role_contexts = result.get("role_contexts", {})

  if not eli5 or not synthesis_briefing:
    log("Missing eli5 or synthesis_briefing in response", "WARN")
    return False

  valid_persona, issues = validate_persona_constraints(result)
  if not valid_persona:
    log("Persona validation failed. Attempting automatic repair...", "WARN")
    for issue in issues:
      log(f"  {issue}", "WARN")

    repaired = repair_persona_violations(article_dict, related, result, issues)
    if repaired is None:
      log("Repair attempt failed. Rejecting synthesis output.", "ERROR")
      return False

    repaired_valid, repaired_issues = validate_persona_constraints(repaired)
    if not repaired_valid:
      log("Repaired output still violates persona constraints.", "ERROR")
      for issue in repaired_issues:
        log(f"  {issue}", "ERROR")
      return False

    result = repaired
    eli5 = result.get("eli5", "")
    synthesis_briefing = result.get("synthesis_briefing", "")
    role_contexts = result.get("role_contexts", {})

  role_headlines = {role: ctx.get("headline", "") for role, ctx in role_contexts.items()}

  # Optimistic lock for article update: PATCH with expected version.
  expected_version = int(article_payload.version or 1)
  update_data = {
    "story_momentum": result.get("story_momentum", "building"),
    "bharat_india_split": result.get("bharat_india_split", "both"),
    "conflict_index": result.get("conflict_index", 0.5),
    "role_headlines": role_headlines,
    "key_concepts": result.get("key_concepts", []),
    "eli5": eli5,
    "synthesis_briefing": synthesis_briefing,
    "credibility_score": result.get("source_credibility", 0.5),
    "updated_by_agent": "agent2",
    "version": expected_version + 1,
    "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
  }

  success = supabase_request(
    "PATCH",
    "articles",
    data=update_data,
    params={"id": f"eq.{article_id}", "version": f"eq.{expected_version}"},
  )
  if success is None or (isinstance(success, list) and len(success) == 0):
    log("Stale write detected on articles row (version mismatch).", "WARN")
    return False

  roles = ["student", "investor", "founder", "citizen"]
  contexts_inserted = 0

  for role in roles:
    ctx = role_contexts.get(role, {})
    if not ctx:
      continue

    row = {
      "article_id": article_id,
      "role": role,
      "headline": ctx.get("headline", ""),
      "why_it_matters": ctx.get("why_it_matters", ""),
      "role_analogy": ctx.get("role_analogy", ""),
      "action_cards": json.dumps(ctx.get("action_cards", [])),
      "relevance_score": max(0.0, min(1.0, float(ctx.get("relevance_score", 0.5)))),
      "what_to_watch": ctx.get("what_to_watch", ""),
      "updated_by_agent": "agent2",
    }

    existing_ctx = supabase_request(
      "GET",
      "article_contexts",
      params={
        "select": "id,version",
        "article_id": f"eq.{article_id}",
        "role": f"eq.{role}",
        "limit": "1",
      },
    )

    if existing_ctx and isinstance(existing_ctx, list) and len(existing_ctx) > 0:
      ctx_id = existing_ctx[0].get("id")
      ctx_version = int(existing_ctx[0].get("version", 1) or 1)
      row["version"] = ctx_version + 1
      res = supabase_request(
        "PATCH",
        "article_contexts",
        data=row,
        params={"id": f"eq.{ctx_id}", "version": f"eq.{ctx_version}"},
      )
    else:
      row["version"] = 1
      res = supabase_request("POST", "article_contexts", data=row)

    if res is not None and (not isinstance(res, list) or len(res) > 0):
      contexts_inserted += 1
    else:
      log(f"  Failed optimistic write for role context: {role}", "WARN")

  elapsed = time.time() - start_time
  log(f"  Synthesis complete ({contexts_inserted}/4 roles) in {elapsed:.1f}s", "OK")
  return contexts_inserted == 4

async def synthesize_batch(articles: list[AgentArticlePayload | dict]) -> int:
  success_count = 0
  for i, article in enumerate(articles):
    article_payload: AgentArticlePayload | None = None
    try:
      article_payload = normalize_article_payload(article)
      log(f"\n[{i+1}/{len(articles)}]")
      if check_context_exists(article_payload.id):
        log("Already synthesized, skipping.", "SKIP")
        continue
      if await synthesize_article(article_payload):
        success_count += 1
      if i < len(articles) - 1:
        time.sleep(1.5)
    except Exception as e:
      article_id = article_payload.id if article_payload else "?"
      log(f"Error synthesizing article {article_id}: {e}", "ERROR")
      continue
  return success_count


# ── Reprocess ──────────────────────────────────────────────────

def reprocess_all_articles(limit: int = None):
    """
    Re-runs Agent 2 on every article in Supabase using the new Rashomon Protocol.
    Deletes and replaces article_contexts for each article.
    """
    params = {
        "select": "*",
        "order": "created_at.desc"
    }
    if limit:
        params["limit"] = str(limit)
        
    articles = supabase_request("GET", "articles", params=params)
    if not articles or not isinstance(articles, list):
        print("No articles found to reprocess.")
        return
        
    print(f"Reprocessing {len(articles)} articles with Rashomon Protocol...")
    success, failed = 0, 0
    
    for i, article in enumerate(articles):
        print(f"[{i+1}/{len(articles)}] {article.get('title', '')[:60]}")
        try:
            supabase_rest.table("article_contexts").delete().eq("article_id", article["id"]).execute()
            result = asyncio.run(synthesize_article(article))
            if result:
                success += 1
            else:
                failed += 1
        except Exception as e:
            print(f"  ERROR: {e}")
            failed += 1
        time.sleep(2)
        
    print(f"\nDone. Success: {success} | Failed: {failed}")

if __name__ == "__main__":
    import sys
    print("\n" + "=" * 60)
    print("🧠 AGENT 2 — Context Generator + Multi-Article Synthesizer")
    print("=" * 60)
    
    limit = 5
    if len(sys.argv) > 1:
        try: limit = int(sys.argv[1])
        except ValueError: pass
        
    log(f"Fetching up to {limit} unsynthesized articles...")
    articles = supabase_request(
        "GET", "articles",
        params={
        "select": "id,title,content,entities,category,source,published_at,version,updated_by_agent",
            "synthesis_briefing": "is.null",
            "order": "published_at.desc",
            "limit": str(limit),
        },
    )
    if not articles or not isinstance(articles, list) or len(articles) == 0:
        log("No unsynthesized articles found.", "OK")
        sys.exit(0)
        
    log(f"Found {len(articles)} articles to synthesize")
    count = asyncio.run(synthesize_batch(articles))
    print(f"\n{'=' * 60}\n📊 AGENT 2 SUMMARY\n   Articles processed  : {len(articles)}\n   Successfully synth. : {count}\n   Failed              : {len(articles) - count}\n{'=' * 60}\n")
