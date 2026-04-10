import { NextResponse } from 'next/server';

function isAllowedRemoteUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return false;
    // Prevent SSRF: only allow our public R2 domains.
    // Examples:
    // - https://pub-xxxx.r2.dev/...
    // - https://something.r2.dev/...
    const host = url.hostname.toLowerCase();
    if (!host.endsWith('.r2.dev')) return false;
    return true;
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get('url');
  if (!raw) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }
  if (!isAllowedRemoteUrl(raw)) {
    return NextResponse.json({ error: 'URL not allowed' }, { status: 400 });
  }

  try {
    const upstream = await fetch(raw, {
      // Let Next cache/dedupe for short periods; also allows browser caching.
      cache: 'force-cache',
      // No credentials; explicit.
      credentials: 'omit',
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: 'Upstream fetch failed', status: upstream.status },
        { status: 502 }
      );
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const arrayBuffer = await upstream.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'content-type': contentType,
        // Cache both at the edge and in the browser; tweak as needed.
        'cache-control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Proxy error', details: err?.message || String(err) },
      { status: 500 }
    );
  }
}

