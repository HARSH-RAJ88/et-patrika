// ─── ET Patrika — Story Arcs API Route ──────────────────────────────────
// GET /api/story-arcs — Returns all story arcs for trending sidebar

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = createServiceClient();

    const { data: arcs, error } = await supabase
      .from('story_arcs')
      .select('topic_key, display_name, category, last_updated_at')
      .order('last_updated_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Story arcs error:', error);
      return NextResponse.json({ data: [] });
    }

    return NextResponse.json({ data: arcs || [] });
  } catch (error) {
    console.error('Story arcs API error:', error);
    return NextResponse.json({ data: [] });
  }
}
