// ─── ET Patrika — Dashboard Feed API Route ──────────────────────────────
// GET /api/feed?role=student&category=all&limit=10&offset=0

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import type { Article, ArticleContext, FeedItem, UserRole, ArticleCategory } from '@/types';

const VALID_ROLES: UserRole[] = ['student', 'investor', 'founder', 'citizen'];
const VALID_SPLITS = ['india_only', 'bharat_only', 'both', 'global'] as const;
type BharatIndiaSplit = (typeof VALID_SPLITS)[number];

type FeedRow = {
  id: string;
  article_id: string;
  role: UserRole;
  headline: string;
  role_analogy: string;
  why_it_matters: string;
  action_cards: ArticleContext['action_cards'] | string;
  translations: ArticleContext['translations'] | string;
  relevance_score: number;
  what_to_watch: string;
  article: Article;
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // ── Parse query params ───────────────────────────────────
    const role = (searchParams.get('role') || 'citizen') as UserRole;
    const category = searchParams.get('category') || 'all';
    const sortBy = searchParams.get('sortBy') || 'relevance';
    const split = searchParams.get('split') || 'all';
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { data: null, error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // ── Fetch role-scoped contexts joined with articles ──────
    let feedQuery = supabase
      .from('article_contexts')
      .select(`
        id,
        article_id,
        role,
        headline,
        role_analogy,
        why_it_matters,
        action_cards,
        translations,
        relevance_score,
        what_to_watch,
        article:articles!inner(*)
      `, { count: 'exact' })
      .eq('role', role)
      .not('article.synthesis_briefing', 'is', null)
      .not('article.eli5', 'is', null)
      .range(offset, offset + limit - 1);

    if (sortBy === 'conflict') {
      feedQuery = feedQuery
        .order('conflict_index', { referencedTable: 'article', ascending: false, nullsFirst: false })
        .order('relevance_score', { ascending: false })
        .order('published_at', { referencedTable: 'article', ascending: false });
    } else {
      feedQuery = feedQuery
        .order('relevance_score', { ascending: false })
        .order('published_at', { referencedTable: 'article', ascending: false });
    }

    if (category !== 'all') {
      feedQuery = feedQuery.eq('article.category', category as ArticleCategory);
    }

    if (split !== 'all' && VALID_SPLITS.includes(split as BharatIndiaSplit)) {
      feedQuery = feedQuery.eq('article.bharat_india_split', split as BharatIndiaSplit);
    }

    const { data: rows, count: total, error: feedError } = await feedQuery;

    if (feedError) {
      console.error('Feed query error:', feedError);
      return NextResponse.json(
        { data: null, error: 'Failed to fetch feed' },
        { status: 500 }
      );
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({
        data: [],
        total: 0,
        hasMore: false,
      });
    }

    const feedItems: FeedItem[] = (rows as FeedRow[]).map((row) => {
      const article = row.article as Article;
      const context = {
        id: row.id,
        article_id: row.article_id,
        role: row.role,
        headline: row.headline,
        role_analogy: row.role_analogy,
        why_it_matters: row.why_it_matters,
        action_cards: row.action_cards,
        translations: row.translations,
        relevance_score: row.relevance_score,
        what_to_watch: row.what_to_watch,
      } as ArticleContext;

      if (typeof article.entities === 'string') {
        try {
          article.entities = JSON.parse(article.entities as unknown as string);
        } catch {
          article.entities = [];
        }
      }

      if (typeof context.action_cards === 'string') {
        try {
          context.action_cards = JSON.parse(context.action_cards);
        } catch {
          context.action_cards = [];
        }
      }

      if (typeof context.translations === 'string') {
        try {
          context.translations = JSON.parse(context.translations);
        } catch {
          context.translations = {};
        }
      }

      return { article, context };
    });

    return NextResponse.json({
      data: feedItems,
      total: total || 0,
      hasMore: (offset + limit) < (total || 0),
    });

  } catch (error) {
    console.error('Feed API error:', error);
    return NextResponse.json(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
