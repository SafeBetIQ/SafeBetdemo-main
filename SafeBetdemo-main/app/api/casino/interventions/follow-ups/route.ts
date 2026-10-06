// ── SafeBet IQ — B8: bounded follow-up scheduling list (own-casino) ───────────
// GET /api/casino/interventions/follow-ups
// Lists interventions where follow_up_required IS TRUE (max 100) for scheduling
// management. Opaque player ref only; no PII; no cross-casino; no player search.

import { NextResponse } from 'next/server';
import { resolveAlertAccess } from '@/lib/responsibleProfitability/alertsServer';
import { listFollowUps } from '@/lib/responsibleProfitability/followUpSchedulingServer';
import { FOLLOW_UP_LIST_LIMIT } from '@/lib/responsibleProfitability/followUpScheduling';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const deny = (status: number) => NextResponse.json({ ok: false, error: 'Not available.' }, { status });

export async function GET(req: Request) {
  const access = await resolveAlertAccess(req, new URL(req.url).searchParams.get('casino_id') ?? undefined);
  if (!access.ok) return deny(access.status);

  const items = await listFollowUps(access.admin, access.scopeCasino);
  return NextResponse.json(
    { ok: true, items, limit: FOLLOW_UP_LIST_LIMIT },
    { headers: { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' } },
  );
}

export async function POST() { return deny(404); }
