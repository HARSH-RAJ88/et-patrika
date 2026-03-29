"""
ET Patrika — seed_demo_data.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This script inserts realistic, high-quality demo articles into your
Supabase database and runs them through Agent 2 (Rashomon Protocol).

Usage:
  # Process all existing articles in DB (recommended first run):
  python pipeline/seed_demo_data.py --mode existing --limit 20

  # Seed fresh demo articles + process them (for hackathon demo day):
  python pipeline/seed_demo_data.py --mode fresh

  # Process a single article by ID (debugging):
  python pipeline/seed_demo_data.py --mode single --id <article_id>
"""

import os
import sys
import json
import time
import asyncio
import argparse
import logging

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# Verify we can import pipeline configs
try:
    from config import supabase_request, log
    from agent2_synthesizer import synthesize_article, reprocess_all_articles
except ImportError:
    print("Error: Must run from inside pipeline/ directory or with python pipeline/seed_demo_data.py")
    sys.exit(1)


# ═══════════════════════════════════════════════════════════════
# DEMO SEED ARTICLES
# These are realistic Indian business news pieces designed
# to produce genuinely divergent Rashomon Protocol role contexts.
# ═══════════════════════════════════════════════════════════════

DEMO_ARTICLES = [
    # ── MARKETS ──────────────────────────────────────────────
    {
        "title": "RBI cuts repo rate by 25 bps to 6.25%, signals further easing",
        "source": "Economic Times",
        "category": "Markets",
        "story_arc_key": "rbi-rate-cycle-2026",
        "published_at": "2026-03-15T10:30:00Z",
        "content": """The Reserve Bank of India's Monetary Policy Committee voted 4-2 to cut the repo rate by 25 basis points to 6.25% on Friday, the second consecutive cut in the current easing cycle. RBI Governor Sanjay Malhotra signalled that the central bank has room for at least one more cut if inflation remains anchored. Consumer price inflation came in at 3.61% for February, well within the RBI's 2-6% comfort band, giving the MPC space to act. The rate cut is expected to lower EMIs on home and auto loans — a ₹50 lakh, 20-year home loan at 8.5% would see monthly payments drop by approximately ₹900. Banks are expected to pass on the cut within 60-90 days as MCLR-linked loans reprice. HDFC Bank, ICICI Bank, and SBI shares rose between 1.2% and 2.4% on the news. NBFC stocks including Bajaj Finance and Shriram Finance rallied sharply, with analysts upgrading the sector. The Nifty Financial Services index hit a 52-week high intraday. Meanwhile, bond yields fell 12 basis points, with the 10-year G-Sec trading at 6.65%. Economists at Goldman Sachs India and Nomura both revised their terminal rate forecasts to 5.75%, implying two more cuts in 2026. Startup founders in the embedded lending and BNPL space noted that cheaper cost of capital could unlock a new wave of consumer credit products. Job seekers in the banking and financial services sector noted increased hiring signals from HDFC and Kotak as banks prepare for loan book expansion."""
    },
    {
        "title": "Sensex crosses 82,000 for first time; FII inflows at 3-month high",
        "source": "LiveMint",
        "category": "Markets",
        "story_arc_key": "rbi-rate-cycle-2026",
        "published_at": "2026-03-18T16:00:00Z",
        "content": """Indian equity markets hit a historic milestone as the Sensex closed above 82,000 for the first time, propelled by a surge in foreign institutional investor inflows following the RBI rate cut. FIIs pumped ₹14,200 crore into Indian equities in the week following the rate decision — the highest weekly inflow since December 2025. Domestic institutional investors added another ₹8,400 crore. Banking, NBFC, and real estate stocks led the rally, with the Nifty Realty index surging 6.8% on the week as lower rates made property more affordable. Analysts at ICICI Securities upgraded their Nifty year-end target to 26,500 from 24,800, citing rate tailwinds and robust Q4 corporate earnings expected in April. On the employment front, BFSI sector hiring platforms reported a 34% spike in job listings, particularly for relationship managers, credit analysts, and NBFC branch managers. Freshers from finance and MBA programmes are being aggressively targeted by mid-tier NBFCs. For household borrowers, State Bank of India announced a 20 bps cut in home loan rates effective April 1, followed by ICICI Bank with a 15 bps cut. A 30-year fixed deposit investor at SBI will however see returns fall from 7.1% to 6.8% — a real concern for retired government employees dependent on fixed income."""
    },
    {
        "title": "India's forex reserves touch $628 billion — highest since April 2024",
        "source": "Bloomberg Quint",
        "category": "Markets",
        "story_arc_key": "rbi-rate-cycle-2026",
        "published_at": "2026-03-22T09:00:00Z",
        "content": """India's foreign exchange reserves climbed to $628 billion as of March 14, the highest level since April 2024, according to RBI data released Friday. The accumulation — up $11 billion in a single week — reflects strong FII equity inflows, robust services export receipts, and the central bank's intervention to prevent excessive rupee appreciation. The rupee has strengthened to 83.2 against the dollar from a recent low of 87.4, a nearly 5% appreciation that is compressing margins for IT exporters like Infosys and TCS. Infosys CFO Jayesh Sanghrajka told analysts that every 1 rupee appreciation reduces revenue by approximately ₹400-500 crore annually. However, import-heavy sectors including oil marketing companies and electronics manufacturers benefit from a stronger rupee. Household LPG prices may fall by ₹30-50 per cylinder in the April revision if the rupee holds. The comfortable forex position gives RBI headroom to manage volatility and suggests the central bank is comfortable with further currency appreciation in the near term."""
    },

    # ── POLICY ────────────────────────────────────────────────
    {
        "title": "Budget 2026: Capex rises 22% to ₹11.2 lakh crore; infra push continues",
        "source": "Hindu BusinessLine",
        "category": "Policy",
        "story_arc_key": "union-budget-2026",
        "published_at": "2026-02-01T14:00:00Z",
        "content": """Finance Minister Nirmala Sitharaman presented the Union Budget 2026-27 with a capital expenditure allocation of ₹11.2 lakh crore, a 22% increase over the revised estimates for 2025-26. The budget retains a fiscal deficit target of 4.4% of GDP, signalling continued consolidation while sustaining infrastructure investment. Key allocations: National Highways Authority of India gets ₹1.7 lakh crore for road construction; railways capital budget hits ₹2.65 lakh crore with 100 new Vande Bharat services planned; affordable housing under PMAY gets ₹82,000 crore. The budget introduced revised income tax slabs giving middle-class taxpayers with income up to ₹12 lakh complete tax relief under the new regime, directly benefiting approximately 3.2 crore individual taxpayers. For startups, the government extended the angel tax exemption period to 10 years and expanded DPIIT recognition criteria to include agri-tech and ed-tech companies with revenue under ₹50 crore. The MSME credit guarantee corpus was doubled to ₹10,000 crore. On the jobs front, the budget includes a ₹2 lakh crore employment-linked incentive scheme for first-time employees in the formal sector — companies hiring freshers will get wage subsidies for 2 years. Economists from CRISIL and ICRA noted the budget's growth-friendly approach while flagging risks from monsoon dependency and global oil prices."""
    },
    {
        "title": "SEBI tightens F&O norms: Minimum lot size doubles, weekly expiries cut to one",
        "source": "SEBI (Primary Source)",
        "category": "Policy",
        "story_arc_key": "sebi-fo-reform-2026",
        "published_at": "2026-03-10T18:00:00Z",
        "content": """The Securities and Exchange Board of India issued a circular on Monday significantly tightening futures and options trading norms for retail investors, effective April 1, 2026. Key changes: minimum contract lot sizes double across all index derivatives; weekly options expiries are reduced to one per exchange (only the monthly expiry survives on NSE); upfront margin requirements on short option positions increase by 40%; position limits for retail traders are halved. SEBI cited its own study showing that 93% of retail F&O traders lost money in FY2024-25, with average losses of ₹1.2 lakh per trader. The regulator estimates ₹1.85 lakh crore was transferred from retail traders to institutional traders and market makers in that period. The NSE and BSE are expected to see a 35-40% reduction in options trading volumes, significantly denting their transaction fee income. Zerodha, Groww, and Upstox — which collectively generate over 60% of revenue from F&O commissions — saw stock prices or valuation estimates fall sharply. Zerodha founder Nithin Kamath called the move "painful but necessary." For retail investors with SIP-based mutual fund strategies, SEBI's move is neutral to positive. MBA students and finance freshers heading into trading firm interviews noted that proprietary trading desk hiring may slow at retail-facing brokerages."""
    },
    {
        "title": "DPIIT startup recognition expanded: Agri-tech and ed-tech now eligible",
        "source": "YourStory",
        "category": "Policy",
        "story_arc_key": "startup-india-2026",
        "published_at": "2026-03-05T11:00:00Z",
        "content": """The Department for Promotion of Industry and Internal Trade announced on Wednesday that it is expanding startup recognition criteria under Startup India to include agri-tech companies with revenue under ₹50 crore and ed-tech companies focusing on Bharat (Tier-2 and beyond) markets. Previously, ed-tech companies were largely excluded after the BYJU's collapse triggered regulatory scrutiny. The revision affects approximately 4,200 companies currently operating in the grey zone. DPIIT recognition unlocks access to the Fund of Funds for Startups (FFS), income tax exemptions for 3 years, and easier compliance with labour laws. The expanded criteria are particularly significant for agri-tech startups building crop advisory, market linkage, and credit scoring tools for farmers in Madhya Pradesh, Maharashtra, and UP. For students from agricultural colleges and Tier-2 engineering colleges building rural-focused products, the recognition path is now significantly clearer. Several incubators at IIT Kanpur, IIT Kharagpur, and BITS Pilani have been waiting for this clarification before greenlighting agri-tech cohorts. The deadline to apply under the expanded criteria for the current fiscal year is March 31."""
    },
    {
        "title": "GST Council reduces EV tax to 5% from 12%, two-wheelers now competitive",
        "source": "Economic Times",
        "category": "Policy",
        "story_arc_key": "ev-policy-india-2026",
        "published_at": "2026-03-20T15:00:00Z",
        "content": """The GST Council in its 56th meeting reduced the goods and services tax on electric two-wheelers and three-wheelers from 12% to 5%, a move that will directly lower sticker prices by ₹8,000-15,000 depending on the model. Ola Electric, TVS iQube, Bajaj Chetak, and Hero Vida are immediate beneficiaries. Ola Electric shares surged 12% on the announcement. For consumers, the price cut makes the Ola S1X — already India's bestselling EV — fall from ₹89,999 to approximately ₹83,500 after the GST reduction is passed on. The move is expected to accelerate EV adoption in Tier-2 and Tier-3 cities, where two-wheelers are the primary household transport. Petrol two-wheeler manufacturers Bajaj Auto and Hero MotoCorp are under pressure; their stocks fell 2-3%. Battery charging infrastructure players like Tata Power EV and BPCL's EV charging unit see increased tailwind. Auto sector analysts at Jefferies India estimate EV two-wheeler penetration will hit 18% of the market by end-2026, up from 12% currently. For school teachers and government employees who commute daily, the lower price puts an EV two-wheeler within EMI reach for the first time — a ₹83,500 vehicle at 10% down requires an EMI of approximately ₹1,850/month for 48 months at 8.5% interest."""
    },

    # ── STARTUPS ──────────────────────────────────────────────
    {
        "title": "Zepto raises $500M Series F at $5B valuation, eyes IPO by 2027",
        "source": "Inc42",
        "category": "Startups",
        "story_arc_key": "quick-commerce-war-2026",
        "published_at": "2026-03-12T09:00:00Z",
        "content": """Quick-commerce startup Zepto has closed a $500 million Series F funding round at a $5 billion valuation, making it the most valued pure-play quick-commerce company in India. The round was led by General Atlantic with participation from Lightspeed, StepStone Group, and existing investors Nexus and Y Combinator. Zepto co-founder Aadit Palicha told Inc42 the company expects to become EBITDA-positive by Q3 2026 and is targeting an IPO in H1 2027. Zepto currently operates 750 dark stores across 17 Indian cities and fulfills 1.2 million daily orders in under 12 minutes. The fundraise comes as the quick-commerce war intensifies: Blinkit (Zomato) is adding 100 dark stores per quarter, while Swiggy Instamart is aggressively expanding in Tier-2 cities. Tata's BigBasket is pivoting its now-commerce model to compete directly. For grocery and pharmacy startup founders, the massive round signals that deep-pocketed quick-commerce players are locking up supply chain and last-mile infrastructure, making the moat harder to attack. Students at IIM and ISB are reportedly using Zepto case studies in strategy classes to dissect dark store economics and the unit economics of 10-minute delivery. Job openings at Zepto jumped 40% post-announcement, with the company hiring aggressively for supply chain, data science, and category management roles."""
    },
    {
        "title": "PhonePe files DRHP with SEBI, IPO valuation set at ₹1.05 lakh crore",
        "source": "Entrackr",
        "category": "Startups",
        "story_arc_key": "fintech-ipo-wave-2026",
        "published_at": "2026-03-19T12:00:00Z",
        "content": """PhonePe has filed its Draft Red Herring Prospectus with SEBI for an IPO that would value India's most-used payments app at ₹1.05 lakh crore (approximately $12.6 billion). The offering includes a fresh issue of ₹4,500 crore and an offer-for-sale component of ₹12,000 crore from existing investors including Walmart, Tiger Global, and General Atlantic. PhonePe processed 6.8 billion UPI transactions in February 2026, a 31% market share ahead of Google Pay's 30% and Paytm's 13%. Revenue for FY2025 came in at ₹5,064 crore, up 74% YoY, with the company turning EBITDA-positive in Q3 FY2025. The IPO filing marks the beginning of the long-awaited fintech IPO wave — Groww's parent Nextbillion Technology and Razorpay have also indicated IPO plans for 2026-27. The grey market premium for PhonePe is already trading at 35% above the likely issue price. Retail investors eligible for the QIB and HNI categories can potentially apply through a yet-to-be-announced cut-off price. For fintech founders, the IPO validates the B2C payments model but raises the bar — public market investors will scrutinize unit economics, CAC:LTV ratios, and path to profitability with a level of scrutiny that private investors rarely applied."""
    },

    # ── TECH ──────────────────────────────────────────────────
    {
        "title": "Google announces ₹15,000 crore India AI investment; cloud and talent focus",
        "source": "Reuters India",
        "category": "Tech",
        "story_arc_key": "big-tech-india-2026",
        "published_at": "2026-03-08T14:00:00Z",
        "content": """Google CEO Sundar Pichai announced a ₹15,000 crore (approximately $1.8 billion) investment in India over the next two years during a meeting with Prime Minister Modi in New Delhi. The investment covers three areas: expansion of Google Cloud data centres in Mumbai and Pune (₹8,500 crore), an AI skilling initiative targeting 10 million Indians through Google Career Certificates and Coursera partnerships (₹2,000 crore), and a startup fund specifically for Indian AI companies using Google's Gemini models (₹4,500 crore). The announcement follows similar commitments from Microsoft ($3B) and Amazon ($12.7B) earlier in 2025-26, suggesting India is becoming a globally significant AI investment destination. For students, the skilling initiative creates a free pathway to Google-certified AI/ML credentials that are increasingly recognized by Indian tech employers. Google announced 5,000 new direct jobs in India by 2027, primarily in cloud engineering, AI research, and sales. For founders building on Google Cloud, the expanded presence means better pricing, faster support SLAs, and access to Gemini enterprise APIs at reduced rates."""
    },
    {
        "title": "UPI crosses 20 billion transactions in March 2026 — new monthly record",
        "source": "NPCI (Primary Source)",
        "category": "Tech",
        "story_arc_key": "upi-growth-story-2026",
        "published_at": "2026-04-01T10:00:00Z",
        "content": """The National Payments Corporation of India announced that UPI processed 20.06 billion transactions in March 2026, worth ₹23.97 lakh crore, setting a new record on both volume and value. This represents a 42% year-on-year growth in transaction count and a 38% growth in value. UPI's penetration now reaches 97% of Indian PIN codes, with rural transactions (Tier-3 and below) growing fastest at 67% YoY. PhonePe leads with 31.2% market share, Google Pay holds 29.8%, and Paytm has recovered to 14.1% after its 2024 crisis. The NPCI is currently processing applications for UPI Lite X — an offline-capable version that works without internet, targeting 140 million users in areas with poor connectivity. For startups, UPI's ubiquity means payment rails are a commodity — the differentiation has shifted entirely to credit products layered on top of UPI. Founders building Buy-Now-Pay-Later, merchant credit scoring, and recurring payment products are the primary beneficiaries. For ordinary Indians, the record milestone means digital payments are now genuinely mainstream. The NPCI also announced UPI Circle, which allows family members to authorise payments from a shared account."""
    },

    # ── ECONOMY ───────────────────────────────────────────────
    {
        "title": "India Q3 GDP grows 7.6%; consumption recovery drives broad-based growth",
        "source": "MOSPI (Primary Source)",
        "category": "Economy",
        "story_arc_key": "india-growth-2026",
        "published_at": "2026-02-28T18:00:00Z",
        "content": """India's economy expanded at 7.6% in Q3 FY2026 (October-December 2025), ahead of the Reserve Bank's 7.2% estimate and most private forecasts. Private final consumption expenditure — which accounts for 57% of GDP — grew 7.9%, the fastest rate in six quarters, driven by rural spending recovery, real wage growth in agriculture, and festival season demand. Government consumption grew 6.2% as the Centre front-loaded capex spending ahead of state elections. Gross Fixed Capital Formation (investment) expanded 8.4%, led by private sector manufacturing investment and commercial real estate. The data raises India's full-year FY2026 GDP growth to a likely 7.5%, which would make it the fastest-growing major economy globally for the third consecutive year. For ordinary households, the macro picture is important but abstract — what matters is that rural wage data shows real agricultural wages up 4.2% after inflation, the first meaningful real wage growth since 2021-22. Urban manufacturing wages are up 6.1% real — suggesting the employment growth in EPFO data is translating into actual purchasing power."""
    },
    {
        "title": "Retail inflation falls to 3.61% in February; food prices ease significantly",
        "source": "MOSPI (Primary Source)",
        "category": "Economy",
        "story_arc_key": "india-inflation-2026",
        "published_at": "2026-03-12T17:00:00Z",
        "content": """India's Consumer Price Index inflation fell to 3.61% in February 2026, the lowest reading in 22 months, from 4.26% in January. Food inflation, which had been the main driver of elevated CPI for most of 2024-25, fell sharply to 4.79% from 5.97% as vegetable prices normalised following a good rabi harvest. Tomatoes, which hit ₹100/kg in many markets in November 2025, are now available at ₹25-35/kg nationally. Onion prices are at their lowest since 2022. Core inflation (excluding food and fuel) remained sticky at 3.9%, driven primarily by education, healthcare, and urban housing costs. For families, the fall in tomato and vegetable prices is already visible at the Sunday sabzi mandi. A household that was spending ₹600-700/week on vegetables in October is now spending ₹380-420. The LPG cylinder price, which fell to ₹903 for domestic 14.2 kg in February, could fall to ₹870-880 by May if the rupee appreciation holds."""
    }
]


# ═══════════════════════════════════════════════════════════════
# MODE 1: FRESH SEED
# Insert DEMO_ARTICLES + process each through Agent 2
# ═══════════════════════════════════════════════════════════════
async def seed_fresh():
    print(f"\n🌱 Seeding {len(DEMO_ARTICLES)} demo articles...\n")
    success, failed = 0, 0

    for i, article_data in enumerate(DEMO_ARTICLES):
        print(f"[{i+1}/{len(DEMO_ARTICLES)}] {article_data['title'][:70]}")
        
        # Check if article with same title already exists
        params = {"select": "id, title", "title": f"eq.{article_data['title']}"}
        existing = config.supabase_request("GET", "articles", params=params)

        article = None
        if existing and isinstance(existing, list) and len(existing) > 0:
            article = existing[0]
            print(f"  → Already in DB (id: {article['id']}), re-synthesizing...")
            # We wipe the old contexts before re-synthesizing
            config.supabase_rest.table("article_contexts").delete().eq("article_id", article["id"]).execute()
        else:
            # Insert new article
            insert_data = {
                "title":        article_data["title"],
                "source":       article_data["source"],
                "category":     article_data.get("category"),
                "story_arc_key": article_data.get("story_arc_key"),
                "published_at": article_data.get("published_at"),
                "content":      article_data["content"],
                "url":          f"https://etpatrika.demo/{article_data['title'][:40].lower().replace(' ', '-')}"
            }
            # Add resolution to force return=representation
            result = config.supabase_request("POST", "articles", data=insert_data, params={"select": "*"})
            if result and isinstance(result, list) and len(result) > 0:
                article = result[0]
                print(f"  → Inserted article (id: {article.get('id')})")
            else:
                print("  ✗ Failed to insert article!")
                failed += 1
                continue

        # Run through Agent 2
        try:
            synthesis_result = await synthesize_article(article)
            if synthesis_result:
                success += 1
            else:
                print(f"  ✗ Synthesis failed")
                failed += 1
        except Exception as e:
            print(f"  ✗ ERROR: {e}")
            failed += 1

        time.sleep(3)  # Rate limit courtesy

    print(f"\n✅ Seeding complete. Success: {success} | Failed: {failed}")
    print(f"   Dashboard will now show these articles with full role contexts.")


# ═══════════════════════════════════════════════════════════════
# MODE 2: PROCESS EXISTING ARTICLES IN DB
# ═══════════════════════════════════════════════════════════════
def process_existing(limit: int = 20):
    reprocess_all_articles(limit=limit)


# ═══════════════════════════════════════════════════════════════
# MODE 3: PROCESS SINGLE ARTICLE BY ID
# ═══════════════════════════════════════════════════════════════
async def process_single(article_id: str):
    params = {"select": "*", "id": f"eq.{article_id}"}
    existing = config.supabase_request("GET", "articles", params=params)
    
    if not existing or not isinstance(existing, list) or len(existing) == 0:
        print(f"Article {article_id} not found.")
        return

    article = existing[0]
    print(f"Processing: {article['title']}")

    # Wipe existing context
    config.supabase_rest.table("article_contexts").delete().eq("article_id", article["id"]).execute()

    synthesis_result = await synthesize_article(article)
    if synthesis_result:
        print("✅ Done.")
    else:
        print("✗ Synthesis failed.")


# ═══════════════════════════════════════════════════════════════
# VERIFY: Check all 4 role contexts exist for each article
# ═══════════════════════════════════════════════════════════════
def verify_seed():
    articles = config.supabase_request("GET", "articles", params={"select": "id, title"})
    if not articles:
        print("No articles found in DB.")
        return
        
    print(f"\n🔍 Verifying {len(articles)} articles...\n")

    perfect, incomplete, missing = 0, 0, 0
    for article in articles:
        contexts = config.supabase_request("GET", "article_contexts", params={"select": "role", "article_id": f"eq.{article['id']}"})
        roles_present = [c["role"] for c in contexts] if contexts else []
        expected = {"student", "investor", "founder", "citizen"}
        present = set(roles_present)

        if present == expected:
            perfect += 1
        elif present:
            incomplete += 1
            missing_roles = expected - present
            print(f"  ⚠ INCOMPLETE: {article['title'][:60]}")
            print(f"    Missing: {missing_roles}")
        else:
            missing += 1
            print(f"  ✗ NO CONTEXTS: {article['title'][:60]}")

    print(f"\nSummary: ✅ {perfect} perfect | ⚠ {incomplete} incomplete | ✗ {missing} missing")


# ═══════════════════════════════════════════════════════════════
# MAIN CLI
# ═══════════════════════════════════════════════════════════════
if __name__ == "__main__":
    import config 
    
    parser = argparse.ArgumentParser(description="ET Patrika — Seed Demo Data")
    parser.add_argument(
        "--mode",
        choices=["fresh", "existing", "single", "verify"],
        default="fresh",
        help="fresh: insert+process demo articles | existing: process DB articles | single: one article by ID | verify: check completeness"
    )
    parser.add_argument("--limit", type=int, default=20, help="Limit for 'existing' mode")
    parser.add_argument("--id", type=str, help="Article ID for 'single' mode")

    args = parser.parse_args()

    print(f"✓ Connected to Supabase via config.py (REST layer)")

    if args.mode == "fresh":
        asyncio.run(seed_fresh())
    elif args.mode == "existing":
        process_existing(limit=args.limit)
    elif args.mode == "single":
        if not args.id:
            print("--id is required for single mode")
        else:
            asyncio.run(process_single(args.id))
    elif args.mode == "verify":
        verify_seed()
