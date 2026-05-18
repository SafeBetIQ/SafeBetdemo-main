export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { authorise, serviceClient, isStr } from '@/lib/api-auth';
import { rateLimit, getIp, getRateLimitKey } from '@/lib/rate-limit';
import { getSandboxResponse } from '@/lib/sandbox';
import { logApiUsage } from '@/lib/api-usage';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  Sentry.setTag('endpoint', '/api/check-exclusion');
  Sentry.setTag('environment', process.env.NODE_ENV);

  const sandboxRes = getSandboxResponse('/api/check-exclusion');
  if (sandboxRes) return NextResponse.json(sandboxRes);

  const ip = getIp(req);
  if (!rateLimit(getRateLimitKey(req))) {
    Sentry.captureMessage('Rate limit exceeded', { level: 'warning', tags: { endpoint: '/api/check-exclusion', ip } });
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': '60' } });
  }

  const auth = await authorise(req);
  if ('error' in auth) return auth.error;
  Sentry.setUser({ id: auth.userId, email: auth.email });
  logApiUsage(req, '/api/check-exclusion', auth.userId);

  try {
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { player_id, player_token } = body;

    if (player_id !== undefined && !isStr(player_id)) {
      return NextResponse.json({ error: 'player_id must be a non-empty string' }, { status: 422 });
    }
    if (player_token !== undefined && !isStr(player_token)) {
      return NextResponse.json({ error: 'player_token must be a non-empty string' }, { status: 422 });
    }
    if (!player_id && !player_token) {
      return NextResponse.json({ error: 'player_id or player_token is required' }, { status: 422 });
    }

    const sb = serviceClient();
    const now = new Date().toISOString();

    let query = sb
      .from('self_exclusions')
      .select('id, exclusion_type, duration_type, starts_at, ends_at, status, reason')
      .eq('status', 'active')
      .or(`ends_at.is.null,ends_at.gt.${now}`);

    // Multi-tenant isolation
    if (auth.casinoId) query = query.eq('casino_id', auth.casinoId);
    if (isStr(player_id)) query = query.eq('player_id', player_id);
    else                  query = query.eq('player_token', player_token as string);

    const { data: exclusions, error } = await query.limit(1);

    if (error) {
      Sentry.captureException(error);
      return NextResponse.json({ error: 'Failed to check exclusion' }, { status: 500 });
    }

    const active = exclusions?.[0] ?? null;

    Sentry.setContext('request', { duration_ms: Date.now() - startTime });
    return NextResponse.json({
      success: true,
      excluded: !!active,
      exclusion: active ?? null,
    });

  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
