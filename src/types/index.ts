// ─── ET Patrika — TypeScript Interfaces & Types ─────────────────────────
// Central type definitions for the entire application.

// ─── Core Enums ──────────────────────────────────────────────────────────

export type UserRole = 'student' | 'investor' | 'founder' | 'citizen';

export type ArticleCategory =
  | 'Startups'
  | 'Policy'
  | 'Markets'
  | 'Tech'
  | 'Global'
  | 'Sports'
  | 'Entertainment'
  | 'Health'
  | 'Education'
  | 'Science'
  | 'Technology'
  | 'Business'
  | 'Finance'
  | 'Politics'
  | 'World';

export type Sentiment = 'positive' | 'neutral' | 'negative';

export type TimelineSentiment =
  | 'positive'
  | 'neutral'
  | 'negative'
  | 'escalating'
  | 'resolving';

export type SupportedLanguage = 'en' | 'hi' | 'ta' | 'bn' | 'te';

// ─── Action Card ─────────────────────────────────────────────────────────

export interface ActionCard {
  title: string;
  description: string;
  cta: string;
}

// ─── Article ─────────────────────────────────────────────────────────────

export interface Article {
  id: string;
  url: string;
  title: string;
  original_title: string;
  content: string;
  source: string;
  source_url?: string;
  published_at: string;
  category: ArticleCategory;
  entities: string[];
  sentiment: Sentiment;
  credibility_score: number;
  synthesis_briefing: string | null;
  eli5: string | null;
  story_arc_key: string | null;
  created_at: string;
}

// ─── Article Context (role-specific) ─────────────────────────────────────

export interface ArticleContext {
  id: string;
  article_id: string;
  role: UserRole;
  headline?: string;
  role_analogy?: string;
  why_it_matters: string;
  action_cards: ActionCard[];
  relevance_score: number;
  what_to_watch: string;
  translations?: Record<string, string>;
}

// ─── Story Arc ───────────────────────────────────────────────────────────

export interface TimelineEvent {
  date: string;
  event_title: string;
  event_summary: string;
  sentiment: TimelineSentiment;
  article_id: string;
}

export interface KeyPlayer {
  name: string;
  role: string;
  relevance: number;
}

export interface StoryArc {
  id: string;
  topic_key: string;
  display_name: string;
  timeline: TimelineEvent[];
  key_players: KeyPlayer[];
  category: string;
  first_seen_at: string;
  last_updated_at: string;
}

// ─── User Profile ────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  user_id?: string;
  role: UserRole;
  interests: string[];
  language: SupportedLanguage;
  first_name: string;
  last_name: string;
  created_at?: string;
}

// ─── Composite Types ─────────────────────────────────────────────────────

/** Article enriched with all role contexts */
export interface ArticleWithContext extends Article {
  article_contexts: ArticleContext[];
}

/** Dashboard feed item: article + the context for the user's active role */
export interface FeedItem {
  article: Article;
  context: ArticleContext;
}

/** Chat message for the live chat widget */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

/** API response wrapper */
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}
