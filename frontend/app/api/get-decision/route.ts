export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { authorise, serviceClient, isStr } from '@/lib/api-auth';
import { rateLimit, getIp, getRateLimitKey } from '@/lib/rate-limit';
import { cacheGet, cacheSet } from '@/lib/cache';
import { getSandboxResponse } from '@/lib/sandbox';
import { logApiUsage } from '@/lib/api-usage';

type Decision = 'ALLOW' | 'VERIFY' | 'LIMIT' | 'BLOCK';

const ACTION_MAP: Record<Decision, string> = {
  BLOCK:  'ACCOUNT_SUSPEND',
  LIMIT:  'APPLY_LIMITS',
  VERIFY: 'REQUIRE_KYC',
  ALLOW:  'NONE',
};

function decide(risk_score: number, underage_risk: number, excluded: boolean): { decision: Decision; reason: string } {
  if (underage_risk > 80) return { decision: 'BLOCK',  reason: 'Underage risk score exceeds threshold' };
  if (excluded)           return { decision: 'BLOCK',  reason: 'Player is subject to an active exclusion' };
  if (risk_score > 70)    return { decision: 'LIMIT',  reason: 'High risk score — betting limits applied' };
  if (risk_score > 50)    return { decision: 'VERIFY', reason: 'Elevated risk score — identity verification required' };
  return                         { decision: 'ALLOW',  reason: 'No risk indicators detected' };
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  Sentry.setTag('endpoint', '/api/get-decision');
  Sentry.setTag('environment', process.env.NODE_ENV);

  const sandboxRes = getSandboxResponse('/api/get-decision');
  if (sandboxRes) return NextResponse.json(sandboxRes);

  const ip = getIp(req);
  if (!rateLimit(getRateLimitKey(req))) {
    Sentry.captureMessage('Rate limit exceeded', { level: 'warning', tags: { endpoint: '/api/get-decision', ip } });
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': '60' } });
  }

  const auth = await authorise(req);
  if ('error' in auth) return auth.error;
  Sentry.setUser({ id: auth.userId, email: auth.email });
  logApiUsage(req, '/api/get-decision', auth.userId);

  try {
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { player_id, player_token, casino_id: bodyCasinoId } = body;

    if (player_id !== undefined && !isStr(player_id)) {
      return NextResponse.json({ error: 'player_id must be a non-empty string' }, { status: 422 });
    }
    if (player_token !== undefined && !isStr(player_token)) {
      return NextResponse.json({ error: 'player_token must be a non-empty string' }, { status: 422 });
    }
    if (!player_id && !player_token) {
      return NextResponse.json({ error: 'player_id or player_token is required' }, { status: 422 });
    }

    // Effective casino_id: auth takes precedence over body (multi-tenant isolation)
    const casinoId = auth.casinoId ?? (isStr(bodyCasinoId) ? bodyCasinoId : null);

    const sb = serviceClient();
    const now = new Date().toISOString();

    // Resolve player with multi-tenant isolation
    let playerQuery = sb
      .from('players')
      .select('id, casino_id, current_risk_score, current_risk_level, is_active');

    if (casinoId) playerQuery = playerQuery.eq('casino_id', casinoId);
    playerQuery = isStr(player_id)
      ? playerQuery.eq('id', player_id)
      : playerQuery.eq('player_token', player_token as string);

    const playerRes = await playerQuery.single();

    if (playerRes.error || !playerRes.data) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const resolvedId       = playerRes.data.id;
    const resolvedCasinoId = casinoId ?? playerRes.data.casino_id ?? null;

    type RiskCache = { risk_score: number; underage_risk: number };
    const cached = cacheGet<RiskCache>(`risk:${resolvedId}`);

    // Fetch exclusion always (security-critical); skip underage events if cached
    const [exclusionRes, eventsRes] = await Promise.all([
      (() => {
        let q = sb.from('self_exclusions')
          .select('id')
          .eq('player_id', resolvedId)
          .eq('status', 'active')
          .or(`ends_at.is.null,ends_at.gt.${now}`)
          .limit(1);
        if (resolvedCasinoId) q = q.eq('casino_id', resolvedCasinoId);
        return q;
      })(),
      cached ? Promise.resolve(null) : (() => {
        let q = sb.from('behaviour_events')
          .select('signal_score')
          .eq('player_id', resolvedId)
          .ilike('event_type', '%underage%');
        if (resolvedCasinoId) q = q.eq('casino_id', resolvedCasinoId);
        return q;
      })(),
    ]);

    const excluded = (exclusionRes.data?.length ?? 0) > 0;

    let risk_score: number;
    let underage_risk: number;

    if (cached) {
      risk_score    = cached.risk_score;
      underage_risk = cached.underage_risk;
    } else {
      const events  = eventsRes?.data ?? [];
      risk_score    = playerRes.data.current_risk_score ?? 0;
      underage_risk = events.length > 0
        ? Math.max(...events.map((e: { signal_score?: number }) => e.signal_score ?? 0))
        : 0;
      cacheSet<RiskCache>(`risk:${resolvedId}`, { risk_score, underage_risk });
    }

    const { decision, reason } = decide(risk_score, underage_risk, excluded);
    const action_required = ACTION_MAP[decision];
    const duration_ms = Date.now() - startTime;

    Sentry.setContext('request', { duration_ms });

    // Log decision — non-blocking
    sb.from('decision_logs').insert({
      player_id:     resolvedId,
      casino_id:     resolvedCasinoId,
      decision,
      reason,
      risk_score,
      underage_risk,
      excluded,
      request_ip:    ip,
      endpoint:      '/api/get-decision',
      user_id:       auth.userId,
      created_at:    now,
    }).then(({ error: logErr }) => {
      if (logErr) Sentry.captureException(logErr);
    });

    return NextResponse.json({
      success: true,
      player_id: resolvedId,
      decision,
      reason,
      action_required,
      risk_score,
      underage_risk,
      excluded,
    });

  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
