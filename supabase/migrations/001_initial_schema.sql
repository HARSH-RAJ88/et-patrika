-- ============================================================
-- ET Patrika — Supabase Database Schema
-- Run this SQL in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLE 1: articles
-- Core articles table — stores scraped + classified news
-- ============================================================
CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT UNIQUE NOT NULL,
  title TEXT,
  original_title TEXT,                -- raw RSS title before ELI5 rewriting
  content TEXT,                       -- truncated to 2500 chars before LLM calls
  source TEXT,                        -- e.g. "Economic Times", "TechCrunch"
  source_url TEXT,
  published_at TIMESTAMPTZ,
  category TEXT CHECK (category IN ('Startups', 'Policy', 'Markets', 'Tech', 'Global', 'Sports', 'Entertainment', 'Health', 'Education', 'Science', 'Technology', 'Business', 'Finance', 'Politics', 'World')),
  entities JSONB DEFAULT '[]'::jsonb, -- array of named entities
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  credibility_score FLOAT DEFAULT 0.5 CHECK (credibility_score >= 0.0 AND credibility_score <= 1.0),
  synthesis_briefing TEXT,            -- Agent 2 output: multi-article unified briefing
  eli5 TEXT,                          -- Agent 2 output: explain-like-I'm-5
  story_arc_key TEXT,                 -- links to story_arcs.topic_key
  
  -- Rashomon Protocol fields
  story_momentum TEXT DEFAULT 'building',
  bharat_india_split TEXT DEFAULT 'both',
  conflict_index FLOAT DEFAULT 0.5,
  role_headlines JSONB DEFAULT '{}'::jsonb,
  key_concepts TEXT[] DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE 2: article_contexts
-- Role-specific intelligence for each article (4 rows per article)
-- ============================================================
CREATE TABLE IF NOT EXISTS article_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('student', 'investor', 'founder', 'citizen')),
  
  -- Rashomon Protocol elements
  headline TEXT,                      -- Role-specific headline
  why_it_matters TEXT,                -- role-specific relevance paragraph
  role_analogy TEXT,                  -- Concrete scene from that role's life
  
  action_cards JSONB DEFAULT '[]'::jsonb, -- [{title, description, cta}]
  relevance_score FLOAT DEFAULT 0.5 CHECK (relevance_score >= 0.0 AND relevance_score <= 1.0),
  what_to_watch TEXT,                 -- forward-looking prediction for this role
  translations JSONB DEFAULT '{}'::jsonb, -- cached translations keyed by language
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Only one context per role per article
  UNIQUE(article_id, role)
);

-- ============================================================
-- TABLE 3: story_arcs
-- Tracks evolving stories across multiple articles over time
-- ============================================================
CREATE TABLE IF NOT EXISTS story_arcs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_key TEXT UNIQUE NOT NULL,     -- e.g. "union-budget-2026"
  display_name TEXT,                  -- human-readable topic name
  timeline JSONB DEFAULT '[]'::jsonb, -- [{date, event_title, event_summary, sentiment, article_id}]
  key_players JSONB DEFAULT '[]'::jsonb, -- [{name, role, relevance}]
  category TEXT,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE 4: user_profiles
-- User preferences — role, interests, language
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY,               -- = Supabase auth.uid()
  role TEXT CHECK (role IN ('student', 'investor', 'founder', 'citizen')),
  interests TEXT[] DEFAULT '{}',      -- array of category strings
  language TEXT DEFAULT 'en' CHECK (language IN ('en', 'hi', 'ta', 'bn', 'te')),
  first_name TEXT,
  last_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- INDEXES
-- ============================================================

-- articles indexes
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles (category);
CREATE INDEX IF NOT EXISTS idx_articles_entities ON articles USING GIN (entities);
CREATE INDEX IF NOT EXISTS idx_articles_story_arc_key ON articles (story_arc_key);

-- article_contexts indexes
CREATE INDEX IF NOT EXISTS idx_article_contexts_article_id ON article_contexts(article_id);
CREATE INDEX IF NOT EXISTS idx_article_contexts_role ON article_contexts(role);
CREATE INDEX IF NOT EXISTS idx_article_contexts_article_role ON article_contexts (article_id, role);

-- story_arcs indexes
CREATE INDEX IF NOT EXISTS idx_story_arcs_topic_key ON story_arcs (topic_key);

-- user_profiles indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles (role);


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_arcs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- articles: public read, no write from client
CREATE POLICY "articles_public_read" ON articles
  FOR SELECT USING (true);

-- article_contexts: public read, no write from client
CREATE POLICY "article_contexts_public_read" ON article_contexts
  FOR SELECT USING (true);

-- story_arcs: public read, no write from client
CREATE POLICY "story_arcs_public_read" ON story_arcs
  FOR SELECT USING (true);

-- user_profiles: users can only read their own row
CREATE POLICY "user_profiles_own_read" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

-- user_profiles: users can only update their own row
CREATE POLICY "user_profiles_own_update" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- user_profiles: users can insert their own row (during onboarding)
CREATE POLICY "user_profiles_own_insert" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
