// ─── ET Patrika — Single Article API Route ──────────────────────────────
// GET /api/article/:id?role=student

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import type { Article, ArticleContext, StoryArc, UserRole } from '@/types';

const VALID_ROLES: UserRole[] = ['student', 'investor', 'founder', 'citizen'];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const role = (searchParams.get('role') || 'citizen') as UserRole;

    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` },
        { status: 400 }
      );
    }

    if (!id) {
      return NextResponse.json(
        { error: 'Article ID is required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // ── Fetch the article ─────────────────────────────────────
    const { data: article, error: articleError } = await supabase
      .from('articles')
      .select('*')
      .eq('id', id)
      .single();

    if (articleError || !article) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    // Parse entities if stored as JSON string
    if (typeof article.entities === 'string') {
      try {
        article.entities = JSON.parse(article.entities);
      } catch {
        article.entities = [];
      }
    }

    // ── Fetch context for the requested role ──────────────────
    const { data: context, error: contextError } = await supabase
      .from('article_contexts')
      .select('*')
      .eq('article_id', id)
      .eq('role', role)
      .single();

    let articleContext: ArticleContext;

    if (contextError || !context) {
      // Provide a default context if none exists
      articleContext = {
        id: '',
        article_id: id,
        role,
        why_it_matters: '',
        action_cards: [],
        relevance_score: 0.5,
        what_to_watch: '',
      };
    } else {
      // Parse action_cards if stored as string
      if (typeof context.action_cards === 'string') {
        try {
          context.action_cards = JSON.parse(context.action_cards);
        } catch {
          context.action_cards = [];
        }
      }
      articleContext = context as ArticleContext;
    }

    // ── Fetch story arc if available ──────────────────────────
    let storyArc: StoryArc | null = null;

    if (article.story_arc_key) {
      const { data: arc, error: arcError } = await supabase
        .from('story_arcs')
        .select('*')
        .eq('topic_key', article.story_arc_key)
        .single();

      if (!arcError && arc) {
        // Parse timeline and key_players if stored as JSON strings
        if (typeof arc.timeline === 'string') {
          try {
            arc.timeline = JSON.parse(arc.timeline);
          } catch {
            arc.timeline = [];
          }
        }
        if (typeof arc.key_players === 'string') {
          try {
            arc.key_players = JSON.parse(arc.key_players);
          } catch {
            arc.key_players = [];
          }
        }
        storyArc = arc as StoryArc;
      }
    }

    // ── Fetch all role contexts for this article (for role switching) ──
    const { data: allContexts } = await supabase
      .from('article_contexts')
      .select('*')
      .eq('article_id', id);

    const parsedContexts = (allContexts || []).map((ctx: ArticleContext) => {
      if (typeof ctx.action_cards === 'string') {
        try {
          ctx.action_cards = JSON.parse(ctx.action_cards as unknown as string);
        } catch {
          ctx.action_cards = [];
        }
      }
      return ctx;
    });

    return NextResponse.json({
      article: article as Article,
      context: articleContext,
      allContexts: parsedContexts as ArticleContext[],
      storyArc,
    });

  } catch (error) {
    console.error('Article API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
