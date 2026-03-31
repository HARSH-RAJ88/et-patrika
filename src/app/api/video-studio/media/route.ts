import { NextRequest, NextResponse } from 'next/server';

function getVideoStudioApiBase(): string {
  const base = process.env.NEXT_PUBLIC_VIDEO_STUDIO_API_BASE;
  if (!base) {
    throw new Error('Missing NEXT_PUBLIC_VIDEO_STUDIO_API_BASE for Video Studio media proxy.');
  }
  return base.replace(/\/$/, '');
}

export async function GET(req: NextRequest) {
  try {
    const rawPath = req.nextUrl.searchParams.get('path') || '';
    if (!rawPath.startsWith('/videos/')) {
      return NextResponse.json(
        { error: 'Invalid media path. Expected /videos/<filename>' },
        { status: 400 }
      );
    }

    const base = getVideoStudioApiBase();
    const targetUrl = `${base}${rawPath}`;
    const upstream = await fetch(targetUrl, { cache: 'no-store' });

    const headers = new Headers(upstream.headers);
    headers.delete('content-encoding');
    headers.delete('transfer-encoding');

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Video media proxy failed' },
      { status: 502 }
    );
  }
}
