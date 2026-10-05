// ── SafeBet IQ — B6: link a recorded intervention to a protection alert ───────
//
// POST /api/casino/protection-alerts/{id}/link-intervention   body: { intervention_id }
// Governed, own-casino, own-player. The server derives casino/player (from the alert)
// and actor (from the verified principal); the caller supplies ONLY intervention_id.
// Idempotent on an already-active (alert,intervention) pair. Occurrence only — a link
// records that an action followed the alert, never that it worked.

import { NextResponse } from 'next/server';
import { resolveAlertAccess } from '@/lib/responsibleProfitability/alertsServer';
import { resolveAlert, createInitialLink } from '@/lib/responsibleProfitability/traceabilityServer';
import { parseLinkBody } from '@/lib/responsibleProfitability/traceability';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const deny = (status: number) => NextResponse.json({ ok: false, error: 'Not available.' }, { status });
const bad = (code: string, error: string) => NextResponse.json({ ok: false, code, error }, { status: 400 });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: alertId } = await ctx.params;

  let body: unknown = null;
  try { body = await req.json(); } catch { body = null; }
  const parsed = parseLinkBody(body);
  if (!parsed.ok) return bad(parsed.code, parsed.error);

  const requestedCasino = new URL(req.url).searchParams.get('casino_id') ?? undefined;
  const access = await resolveAlertAccess(req, requestedCasino);
  if (!access.ok) return deny(access.status);
  const { admin, scopeCasino, principal } = access;

  const alert = await resolveAlert(admin, scopeCasino, alertId);
  if (!alert.ok) return deny(alert.status);

  const outcome = await createInitialLink(admin, scopeCasino, alertId, alert.alert.playerId, parsed.interventionId, principal);
  switch (outcome.kind) {
    case 'created':
      return NextResponse.json({ ok: true, link: { id: outcome.link.id, interventionId: outcome.link.intervention_id } },
        { status: 201, headers: { 'Cache-Control': 'no-store, private' } });
    case 'idempotent':
      return NextResponse.json({ ok: true, idempotent: true, link: { id: outcome.link.id, interventionId: outcome.link.intervention_id } },
        { headers: { 'Cache-Control': 'no-store, private' } });
    case 'not_linkable':
      return NextResponse.json({ ok: false, code: 'INTERVENTION_NOT_LINKABLE', error: 'that intervention is not linkable for this alert' }, { status: 404 });
    default:
      return deny(outcome.status);
  }
}

export async function GET() { return deny(404); }
