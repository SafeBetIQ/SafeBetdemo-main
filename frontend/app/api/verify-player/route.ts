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
  Sentry.setTag('endpoint', '/api/verify-player');
  Sentry.setTag('environment', process.env.NODE_ENV);

  const sandboxRes = getSandboxResponse('/api/verify-player');
  if (sandboxRes) return NextResponse.json(sandboxRes);

  const ip = getIp(req);
  if (!rateLimit(getRateLimitKey(req))) {
    Sentry.captureMessage('Rate limit exceeded', { level: 'warning', tags: { endpoint: '/api/verify-player', ip } });
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': '60' } });
  }

  const auth = await authorise(req);
  if ('error' in auth) return auth.error;
  Sentry.setUser({ id: auth.userId, email: auth.email });
  logApiUsage(req, '/api/verify-player', auth.userId);

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

    // Resolve player — enforce multi-tenant isolation
    let playerQuery = sb
      .from('players')
      .select('id, casino_id, is_active, registration_date');

    if (auth.casinoId) playerQuery = playerQuery.eq('casino_id', auth.casinoId);
    playerQuery = isStr(player_id)
      ? playerQuery.eq('id', player_id)
      : playerQuery.eq('player_token', player_token as string);

    const playerRes = await playerQuery.single();

    if (playerRes.error || !playerRes.data) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const resolvedId = playerRes.data.id;

    // Fetch underage behaviour events scoped to resolved player
    let eventsQuery = sb
      .from('behaviour_events')
      .select('event_type, signal_score, severity')
      .eq('player_id', resolvedId)
      .ilike('event_type', '%underage%');

    if (auth.casinoId) eventsQuery = eventsQuery.eq('casino_id', auth.casinoId);

    const eventsRes = await eventsQuery;

    const events = eventsRes.data ?? [];
    const underage_risk = events.length > 0
      ? Math.max(...events.map(e => e.signal_score ?? 0))
      : 0;

    const flags = events
      .filter(e => e.severity === 'high' || e.severity === 'critical')
      .map(e => e.event_type);

    Sentry.setContext('request', { duration_ms: Date.now() - startTime });
    return NextResponse.json({
      success: true,
      player_id: resolvedId,
      verified: playerRes.data.is_active,
      underage_risk,
      flags,
    });

  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
