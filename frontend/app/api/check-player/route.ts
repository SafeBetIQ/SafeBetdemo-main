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
  Sentry.setTag('endpoint', '/api/check-player');
  Sentry.setTag('environment', process.env.NODE_ENV);

  const sandboxRes = getSandboxResponse('/api/check-player');
  if (sandboxRes) return NextResponse.json(sandboxRes);

  const ip = getIp(req);
  if (!rateLimit(getRateLimitKey(req))) {
    Sentry.captureMessage('Rate limit exceeded', { level: 'warning', tags: { endpoint: '/api/check-player', ip } });
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': '60' } });
  }

  const auth = await authorise(req);
  if ('error' in auth) return auth.error;
  Sentry.setUser({ id: auth.userId, email: auth.email });
  logApiUsage(req, '/api/check-player', auth.userId);

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

    let query = sb
      .from('players')
      .select('id, casino_id, player_token, first_name, last_name, email, current_risk_score, current_risk_level, is_active, last_activity, registration_date');

    // Multi-tenant isolation
    if (auth.casinoId) query = query.eq('casino_id', auth.casinoId);
    query = isStr(player_id) ? query.eq('id', player_id) : query.eq('player_token', player_token as string);

    const { data: player, error } = await query.single();

    if (error || !player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    Sentry.setContext('request', { duration_ms: Date.now() - startTime });
    return NextResponse.json({ success: true, player });

  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
