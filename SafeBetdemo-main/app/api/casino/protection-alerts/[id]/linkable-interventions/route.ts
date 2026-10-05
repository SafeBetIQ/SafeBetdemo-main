// ── SafeBet IQ — B6: bounded linkable-intervention candidates for an alert ────
//
// GET /api/casino/protection-alerts/{id}/linkable-interventions
// Governed, own-casino. Returns at most 100 interventions for the SAME casino + SAME
// player as the alert, ordered by intervention_date desc. No arbitrary search / no
// cross-player enumeration. Minimal fields only — NO player_id/casino_id/staff/PII/
// message content/risk scores.

import { NextResponse } from 'next/server';
import { resolveAlertAccess } from '@/lib/responsibleProfitability/alertsServer';
import { resolveAlert, listLinkableInterventions } from '@/lib/responsibleProfitability/traceabilityServer';
import { TRACEABILITY_CANDIDATE_LIMIT } from '@/lib/responsibleProfitability/traceability';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const deny = (status: number) => NextResponse.json({ ok: false, error: 'Not available.' }, { status });

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: alertId } = await ctx.params;

  const requestedCasino = new URL(req.url).searchParams.get('casino_id') ?? undefined;
  const access = await resolveAlertAccess(req, requestedCasino);
  if (!access.ok) return deny(access.status);
  const { admin, scopeCasino } = access;

  const alert = await resolveAlert(admin, scopeCasino, alertId);
  if (!alert.ok) return deny(alert.status);

  const candidates = await listLinkableInterventions(admin, scopeCasino, alertId, alert.alert.playerId);
  return NextResponse.json(
    { ok: true, candidates, limit: TRACEABILITY_CANDIDATE_LIMIT },
    { headers: { 'Cache-Control': 'no-store, private' } },
  );
}

export async function POST() { return deny(404); }
