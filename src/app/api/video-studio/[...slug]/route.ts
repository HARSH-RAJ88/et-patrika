import { NextRequest, NextResponse } from 'next/server';

function getVideoStudioApiBase(): string {
  const base = process.env.NEXT_PUBLIC_VIDEO_STUDIO_API_BASE;
  if (!base) {
    throw new Error('Missing NEXT_PUBLIC_VIDEO_STUDIO_API_BASE for Video Studio API proxy.');
  }
  return base.replace(/\/$/, '');
}

function buildTargetUrl(req: NextRequest, slug: string[]): string {
  const base = getVideoStudioApiBase();
  const path = slug.map(encodeURIComponent).join('/');
  const query = req.nextUrl.searchParams.toString();
  return `${base}/studio/api/${path}${query ? `?${query}` : ''}`;
}

async function proxyRequest(req: NextRequest, slug: string[]) {
  const target = buildTargetUrl(req, slug);

  const headers = new Headers(req.headers);
  headers.delete('host');
  headers.delete('connection');
  headers.delete('content-length');

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: 'no-store',
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.text();
  }

  const upstream = await fetch(target, init);
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('transfer-encoding');

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function GET(req: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  try {
    const { slug } = await context.params;
    return await proxyRequest(req, slug);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Video Studio proxy failed' },
      { status: 502 }
    );
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ slug: string[] }> }) {
  try {
    const { slug } = await context.params;
    return await proxyRequest(req, slug);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Video Studio proxy failed' },
      { status: 502 }
    );
  }
}
