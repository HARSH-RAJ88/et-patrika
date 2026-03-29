// ─── ET Patrika — Live Chat API Route (Streaming) ───────────────────────
// POST /api/chat — Groq streaming with Mistral fallback

import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { createServiceClient } from '@/lib/supabase/server';
import type { UserRole } from '@/types';

const VALID_ROLES: UserRole[] = ['student', 'investor', 'founder', 'citizen'];

// ── System prompt builder ────────────────────────────────────────────────

function buildSystemPrompt(
  role: UserRole,
  articleTitle: string,
  synthesisBriefing: string,
  whyItMatters: string,
  whatToWatch: string,
  actionCards: { title: string; description: string; cta: string }[]
): string {
  const cardsText = actionCards.length > 0
    ? actionCards.map((c, i) => `${i + 1}. ${c.title}: ${c.description} → ${c.cta}`).join('\n')
    : 'No specific action cards available.';

  return `You are a news intelligence assistant for ET Patrika. You are speaking with a ${role}.

ARTICLE CONTEXT:
Topic: ${articleTitle}
Synthesis: ${synthesisBriefing}

ROLE-SPECIFIC CONTEXT FOR ${role.toUpperCase()}:
Why it matters: ${whyItMatters}
What to watch: ${whatToWatch}
Action items:
${cardsText}

Answer the user's questions about this topic with the depth and framing that a ${role} needs. Be specific, not generic. Draw from the synthesis above. Keep responses concise — 2-4 paragraphs maximum. If asked about something not covered in the synthesis, say so clearly.`;
}

// ── Mistral fallback (non-streaming) ─────────────────────────────────────

async function callMistralFallback(
  systemPrompt: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      temperature: 0.4,
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    throw new Error(`Mistral API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// ── POST handler ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      return NextResponse.json(
        { error: 'GROQ_API_KEY is not configured on the server.' },
        { status: 500 }
      );
    }

    const groq = new Groq({ apiKey: groqApiKey });

    const body = await request.json();
    const {
      message,
      articleId,
      role = 'citizen',
      conversationHistory = [],
    } = body;

    // Validate inputs
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    if (!articleId) {
      return NextResponse.json(
        { error: 'Article ID is required' },
        { status: 400 }
      );
    }

    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` },
        { status: 400 }
      );
    }

    // ── Fetch article + context from Supabase ────────────────
    const supabase = createServiceClient();

    const { data: article } = await supabase
      .from('articles')
      .select('title, synthesis_briefing, eli5, content')
      .eq('id', articleId)
      .single();

    const { data: context } = await supabase
      .from('article_contexts')
      .select('why_it_matters, what_to_watch, action_cards')
      .eq('article_id', articleId)
      .eq('role', role)
      .single();

    // Build system prompt with available data
    let actionCards = context?.action_cards || [];
    if (typeof actionCards === 'string') {
      try { actionCards = JSON.parse(actionCards); } catch { actionCards = []; }
    }

    const systemPrompt = buildSystemPrompt(
      role as UserRole,
      article?.title || 'Unknown article',
      article?.synthesis_briefing || article?.content?.slice(0, 1000) || '',
      context?.why_it_matters || '',
      context?.what_to_watch || '',
      actionCards
    );

    // Build messages array
    const chatMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-10).map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    // ── Try Groq streaming ───────────────────────────────────
    try {
      const stream = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: chatMessages,
        temperature: 0.4,
        max_tokens: 1500,
        stream: true,
      });

      // Create a ReadableStream to pipe Groq's streaming response
      const encoder = new TextEncoder();

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              const content = chunk.choices[0]?.delta?.content;
              if (content) {
                controller.enqueue(encoder.encode(content));
              }
            }
            controller.close();
          } catch (streamError) {
            console.error('Groq stream error:', streamError);
            controller.error(streamError);
          }
        },
      });

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked',
          'Cache-Control': 'no-cache',
        },
      });

    } catch (groqError) {
      console.error('Groq API failed, falling back to Mistral:', groqError);

      // ── Mistral fallback (non-streaming) ───────────────────
      try {
        if (!process.env.MISTRAL_API_KEY) {
          return NextResponse.json(
            { error: 'MISTRAL_API_KEY is not configured on the server.' },
            { status: 500 }
          );
        }

        const fallbackMessages = [
          ...conversationHistory.slice(-10),
          { role: 'user', content: message },
        ];

        const mistralResponse = await callMistralFallback(systemPrompt, fallbackMessages);

        return new Response(mistralResponse, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-cache',
          },
        });

      } catch (mistralError) {
        console.error('Mistral fallback also failed:', mistralError);
        return NextResponse.json(
          { error: 'Both Groq and Mistral APIs are unavailable. Please try again later.' },
          { status: 503 }
        );
      }
    }

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
