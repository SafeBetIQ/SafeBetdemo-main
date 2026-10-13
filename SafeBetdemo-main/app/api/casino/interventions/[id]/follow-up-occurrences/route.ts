// ── SafeBet IQ — B10: record / list follow-up occurrences for an intervention ─────
//
// POST /api/casino/interventions/{id}/follow-up-occurrences
//   header: Idempotency-Key: <uuid>
//   body:   { occurred_on: "YYYY-MM-DD" }
// GET  /api/casino/interventions/{id}/follow-up-occurrences  → own-casino history (≤50)
//
// Governed, own-casino, append-only occurrence evidence. Casino/player/schedule-snapshot are
// derived DB-side; actor from the principal. Atomic create + audit via
// sbiq_b10_record_follow_up_occurrence. Occurrence ≠ completion ≠ effectiveness.
// Authorization is enforced BEFORE any business-field validation (no validation oracle).
// 201 CREATED / 200 REPLAYED / 409 IDEMPOTENCY_CONFLICT|INVALID_STATE / 404 unknown / 400 validation.

import { NextResponse } from 'next/server';
import { resolveAlertAccess } from '@/lib/responsibleProfitability/alertsServer';
import { recordFollowUpOccurrence, listFollowUpOccurrences } from '@/lib/responsibleProfitability/followUpOccurrenceServer';
import { parseIdempotencyKey, parseOccurrenceBody, httpForStatus } from '@/lib/responsibleProfitability/followUpOccurrence';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const deny = (status: number) => NextResponse.json({ ok: false, error: 'Not available.' }, { status });
const bad = (code: string, error: string) => NextResponse.json({ ok: false, code, error }, { status: 400 });
const casinoParam = (req: Request) => new URL(req.url).searchParams.get('casino_id') ?? undefined;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: interventionId } = await ctx.params;

  // §27 — authorise FIRST (deterministic 401/403; no business-validation oracle pre-auth).
  const access = await resolveAlertAccess(req, casinoParam(req));
  if (!access.ok) return deny(access.status);

  // Then idempotency + body validation.
  const idem = parseIdempotencyKey(req.headers.get('Idempotency-Key'));
  if (!idem.ok) return bad(idem.code, idem.error);

  let body: unknown = null;
  try { body = await req.json(); } catch { body = null; }
  const parsed = parseOccurrenceBody(body);
  if (!parsed.ok) return bad(parsed.code, parsed.error);

  const outcome = await recordFollowUpOccurrence(access.admin, access.scopeCasino, interventionId, access.principal, idem.key, parsed.occurredOn);
  if (outcome.kind === 'error') return deny(outcome.status);

  const m = httpForStatus(outcome.status);
  if (!m.ok) {
    if (outcome.status === 'NOT_FOUND') return deny(404);
    return NextResponse.json({ ok: false, code: m.code, error: 'that follow-up occurrence could not be recorded' }, { status: m.status });
  }
  return NextResponse.json(
    { ok: true, status: m.code === 'REPLAYED' ? 'REPLAYED' : 'CREATED', occurrenceId: outcome.occurrenceId },
    { status: m.status, headers: { 'Cache-Control': 'no-store, private' } },
  );
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: interventionId } = await ctx.params;

  const access = await resolveAlertAccess(req, casinoParam(req));
  if (!access.ok) return deny(access.status);

  const result = await listFollowUpOccurrences(access.admin, access.scopeCasino, interventionId);
  if (result.kind === 'error') return deny(503);
  if (result.kind === 'not_found') return deny(404);
  return NextResponse.json({ ok: true, items: result.items }, { headers: { 'Cache-Control': 'no-store, private' } });
}
