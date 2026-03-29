"""
Script Generator — inherits role context from Agent 2 (Rashomon Protocol).
Handles language differences.
"""
import json
import re
from groq import Groq
from pipeline.video_studio.models.schemas import NewsScript
from pipeline.video_studio.core.config import config
from pipeline.video_studio.core.logger import logger

SYSTEM_PROMPT = """You are the broadcast scriptwriter for ET Patrika — India's first
role-aware business intelligence channel. You write 60–90 second news anchor scripts
that are NEVER generic. Every script is written for a specific viewer.

Your voice: Bloomberg India meets DD News. Authoritative. Crisp. Never sensational.
Your sentences: Short enough to read without gasping. Active voice always.
Your numbers: Always Indian scale. Crore not lakh, etc.
Your references: UPI, Zepto, Aadhaar, IRCTC — not Venmo, Amazon US.

Return ONLY valid JSON. No markdown fences. Start with { end with }."""

USER_PROMPT = """Convert this article into a broadcast script for a specific viewer.

═══ ARTICLE ═══
Title: {title}
Source: {source}
Content:
{content}

═══ ROLE INTELLIGENCE (from ET Patrika Rashomon Protocol) ═══
Viewer role: {role}
{role_context_block}

═══ STYLE & LANGUAGE ═══
Style Instruction: {style_instruction}
Language: {language_instruction}

═══ TASK ═══
Write a broadcast script ANGLED for the viewer's role.
If role context is provided, use its framing — not the generic article framing.
A student hears career implications. An investor hears market signals.

Return JSON:
{{
  "hook": "One opening sentence framed for this role. Under 15 words. Present tense.",
  "key_facts": [
    "Fact 1 relevant to this role. One sentence max 20 words.",
    "Fact 2. A number or name where possible.",
    "Fact 3. The cause or consequence that matters to this role.",
    "Fact 4. Optional — only if it genuinely adds new info."
  ],
  "context": "2-3 sentences. Why this matters TO THIS ROLE specifically.",
  "closing": "One sign-off sentence. Forward-looking for this role.",
  "keywords": ["visual keyword 1", "visual keyword 2", "visual keyword 3", "visual keyword 4", "visual keyword 5"],
  "has_numbers": true or false,
  "numbers_context": "If has_numbers: 'Chart Title | X-axis | Label1: Value | Label2: Value' (Indian scale). Else null."
}}

RULES:
1. Hook under 15 words. Grab attention immediately.
2. Each key_fact is ONE sentence, max 20 words.
3. keywords MUST be in English regardless of the script language, for fetching VISUAL IMAGES (e.g. 'Mumbai stock exchange floor').
4. The hook, key_facts, context, and closing must be written in the specified Language.
5. numbers_context must always be in English.
6. If role_context headline provided, USE IT as basis for your hook.
7. NEVER start hook with 'This article' or 'Today we look at'
"""

ROLE_CONTEXT_TEMPLATE = """
Role-specific headline (USE THIS AS YOUR HOOK BASIS): {headline}
Why it matters for {role}: {why_it_matters}
What to watch next: {what_to_watch}
Role analogy: {role_analogy}
"""

STYLE_INSTRUCTIONS = {
    "breaking": "URGENT TONE. Breaking story. Use present tense. Strong opener.",
    "standard": "Standard editorial. Professional and measured.",
    "explainer": "Accessible. More context. Viewer is smart but not an expert."
}

def generate_script_from_article(
    article: dict,
    role_context: dict = None,
    role: str = "general",
    style: str = "standard",
    language: str = "en"
) -> NewsScript:
    if not config.GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY not set in pipeline/.env")

    client = Groq(api_key=config.GROQ_API_KEY)

    role_block = ""
    if role_context:
        role_block = ROLE_CONTEXT_TEMPLATE.format(
            role=role,
            headline=role_context.get("headline", ""),
            why_it_matters=role_context.get("why_it_matters", ""),
            what_to_watch=role_context.get("what_to_watch", ""),
            role_analogy=role_context.get("role_analogy", "")
        )
        logger.info(f"Rashomon context injected for role={role}")
    else:
        role_block = f"No pre-generated role context. Write for a general {role} audience."

    content = (article.get("synthesis_briefing") or article.get("content", ""))[:3000]

    language_instruction = "English"
    if language == "hi":
        language_instruction = "Hindi (Devanagari script). Ensure the text is natural spoken Hindi news style."

    prompt = USER_PROMPT.format(
        title=article.get("title", ""),
        source=article.get("source", "ET Patrika"),
        content=content,
        role=role,
        role_context_block=role_block,
        style_instruction=STYLE_INSTRUCTIONS.get(style, STYLE_INSTRUCTIONS["standard"]),
        language_instruction=language_instruction
    )

    logger.info(f"Generating script: role={role}, style={style}, lang={language}, title={article.get('title','')[:40]}")

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            temperature=0.25,
            max_tokens=1500,
            response_format={"type": "json_object"}
        )
    except Exception as e:
        raise RuntimeError(f"Groq API failed: {e}. Verify GROQ_API_KEY in pipeline/.env")

    raw = response.choices[0].message.content
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            data = json.loads(match.group())
        else:
            raise ValueError(f"Groq returned unparseable output: {raw[:200]}")

    facts_text = " ".join(data.get("key_facts", []))
    full_script = f"{data['hook']} {facts_text} {data['context']} {data['closing']}"
    word_count = len(full_script.split())
    duration = max(60, min(120, int((word_count / 150) * 60)))

    return NewsScript(
        hook=data["hook"],
        key_facts=data.get("key_facts", []),
        context=data["context"],
        closing=data["closing"],
        full_script=full_script,
        estimated_duration_seconds=duration,
        keywords=data.get("keywords", [article.get("title", "India business")]),
        has_numbers=data.get("has_numbers", False),
        numbers_context=data.get("numbers_context"),
        role_context_used=role if role_context else None,
        language=language
    )
