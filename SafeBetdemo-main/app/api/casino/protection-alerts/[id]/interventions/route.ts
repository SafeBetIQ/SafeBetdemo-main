// ── SafeBet IQ — B9: record an intervention from a protection alert ───────────
//
// POST /api/casino/protection-alerts/{id}/interventions
//   header: Idempotency-Key: <uuid>
//   body:   { intervention_type, outcome?, follow_up_required, follow_up_date? }
// Governed, own-casino, alert-derived. Casino/player derived from the alert (in the RPC);
// actor from the principal. Atomic create + B6 link + audits via sbiq_b9_record_alert_intervention.
// 201 CREATED / 200 REPLAYED / 409 IDEMPOTENCY_CONFLICT / 404 unknown alert / 400 validation.
// No standalone creation, no free text, no direct table INSERT.

import { NextResponse } from 'next/server';
import { resolveAlertAccess } from '@/lib/responsibleProfitability/alertsServer';
import { recordAlertIntervention } from '@/lib/responsibleProfitability/interventionRecordingServer';
import { parseIdempotencyKey, parseRecordBody, httpForStatus } from '@/lib/responsibleProfitability/interventionRecording';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const deny = (status: number) => NextResponse.json({ ok: false, error: 'Not available.' }, { status });
const bad = (code: string, error: string) => NextResponse.json({ ok: false, code, error }, { status: 400 });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: alertId } = await ctx.params;

  const idem = parseIdempotencyKey(req.headers.get('Idempotency-Key'));
  if (!idem.ok) return bad(idem.code, idem.error);

  let body: unknown = null;
  try { body = await req.json(); } catch { body = null; }
  const parsed = parseRecordBody(body);
  if (!parsed.ok) return bad(parsed.code, parsed.error);

  const access = await resolveAlertAccess(req, new URL(req.url).searchParams.get('casino_id') ?? undefined);
  if (!access.ok) return deny(access.status);

  const outcome = await recordAlertIntervention(access.admin, access.scopeCasino, alertId, access.principal, idem.key, parsed.fields);
  if (outcome.kind === 'error') return deny(outcome.status);

  const m = httpForStatus(outcome.status);
  if (!m.ok) {
    if (outcome.status === 'NOT_FOUND') return deny(404);
    return NextResponse.json({ ok: false, code: m.code, error: 'that recording conflicts with a prior request using the same idempotency key' }, { status: m.status });
  }
  return NextResponse.json(
    { ok: true, ...(m.code ? { code: m.code } : {}), interventionId: outcome.interventionId, linkId: outcome.linkId },
    { status: m.status, headers: { 'Cache-Control': 'no-store, private' } },
  );
}

export async function GET() { return deny(404); }
