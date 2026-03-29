// ─── ET Patrika — Translation API Route (Sarvam AI) ─────────────────────
// POST /api/translate — Translates text to Hindi, Tamil, Bengali, or Telugu

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

const SARVAM_TRANSLATE_URL = 'https://api.sarvam.ai/translate';

const VALID_LANGUAGES: Record<string, string> = {
  hi: 'hi-IN',
  ta: 'ta-IN',
  bn: 'bn-IN',
  te: 'te-IN',
};

export async function POST(request: NextRequest) {
  try {
    const sarvamApiKey = process.env.SARVAM_API_KEY;
    if (!sarvamApiKey) {
      return NextResponse.json(
        { error: 'SARVAM_API_KEY is not configured on the server.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { text, targetLanguage, articleId, fieldName, role } = body as {
      text: string;
      targetLanguage: string;
      articleId: string;
      fieldName: 'eli5' | 'why_it_matters' | 'synthesis_briefing' | 'what_to_watch';
      role?: string;
    };

    // ── Validate inputs ──────────────────────────────────────
    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    if (!targetLanguage || !VALID_LANGUAGES[targetLanguage]) {
      return NextResponse.json(
        { error: `Invalid language. Must be one of: ${Object.keys(VALID_LANGUAGES).join(', ')}` },
        { status: 400 }
      );
    }

    if (!articleId) {
      return NextResponse.json(
        { error: 'Article ID is required' },
        { status: 400 }
      );
    }

    if (!fieldName || !['eli5', 'why_it_matters', 'synthesis_briefing', 'what_to_watch'].includes(fieldName)) {
      return NextResponse.json(
        { error: 'Invalid fieldName. Must be one of: eli5, why_it_matters, synthesis_briefing, what_to_watch' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    // Requirement: translations->>'hi' should store translated why_it_matters.
    const cacheKey = fieldName === 'why_it_matters'
      ? targetLanguage
      : `${targetLanguage}_${fieldName}`;

    // ── Check cache ──────────────────────────────────────────
    let contextQuery = supabase
      .from('article_contexts')
      .select('id, translations')
      .eq('article_id', articleId);

    if (role && ['student', 'investor', 'founder', 'citizen'].includes(role)) {
      contextQuery = contextQuery.eq('role', role);
    }

    const { data: contextRow } = await contextQuery.limit(1).maybeSingle();

    if (contextRow) {
      const translations = contextRow.translations || {};
      if (translations[cacheKey]) {
        return NextResponse.json({
          translatedText: translations[cacheKey],
          language: targetLanguage,
          cached: true,
        });
      }
    }

    // ── Call Sarvam AI ───────────────────────────────────────
    try {
      const sarvamResponse = await fetch(SARVAM_TRANSLATE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-subscription-key': sarvamApiKey,
        },
        body: JSON.stringify({
          input: text.slice(0, 5000), // Sarvam limit
          source_language_code: 'en-IN',
          target_language_code: VALID_LANGUAGES[targetLanguage],
        }),
      });

      if (!sarvamResponse.ok) {
        const errorText = await sarvamResponse.text();
        console.error('Sarvam API error:', sarvamResponse.status, errorText);
        throw new Error(`Sarvam API returned ${sarvamResponse.status}`);
      }

      const sarvamData = await sarvamResponse.json();
      const translatedText = sarvamData.translated_text || sarvamData.output || text;

      // ── Cache the result ─────────────────────────────────
      if (contextRow) {
        const updatedTranslations = {
          ...(contextRow.translations || {}),
          [cacheKey]: translatedText,
        };

        await supabase
          .from('article_contexts')
          .update({ translations: updatedTranslations })
          .eq('id', contextRow.id);
      }

      return NextResponse.json({
        translatedText,
        language: targetLanguage,
        cached: false,
      });

    } catch (sarvamError) {
      console.error('Sarvam translation failed:', sarvamError);

      // Fallback: return original English text
      return NextResponse.json({
        translatedText: text,
        language: 'en',
        cached: false,
        error: 'translation_unavailable',
      });
    }

  } catch (error) {
    console.error('Translate API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
