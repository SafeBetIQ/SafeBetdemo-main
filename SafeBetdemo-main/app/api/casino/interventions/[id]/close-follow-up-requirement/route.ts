// ── SafeBet IQ — B11: close the follow-up requirement for an intervention ─────────
//
// POST /api/casino/interventions/{id}/close-follow-up-requirement
//   header: Idempotency-Key: <uuid>
//   body:   empty  (or {})
//
// Governed, own-casino, one-way transition follow_up_required true→false (+ date→NULL).
// "No further follow-up is currently required" — NOT completion/effectiveness. Casino from
// the governed scope; actor from the principal. Atomic mutation + audit via
// sbiq_b11_close_follow_up_requirement. Authorization is enforced BEFORE any business
// validation (no validation oracle). 200 CLOSED/REPLAYED/NOOP / 409 CONFLICT / 404 / 400.

import { NextResponse } from 'next/server';
import { resolveAlertAccess } from '@/lib/responsibleProfitability/alertsServer';
import { closeFollowUpRequirement } from '@/lib/responsibleProfitability/followUpRequirementClosureServer';
import { parseIdempotencyKey, parseEmptyBody, httpForStatus } from '@/lib/responsibleProfitability/followUpRequirementClosure';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const deny = (status: number) => NextResponse.json({ ok: false, error: 'Not available.' }, { status });
const bad = (code: string, error: string) => NextResponse.json({ ok: false, code, error }, { status: 400 });
const casinoParam = (req: Request) => new URL(req.url).searchParams.get('casino_id') ?? undefined;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: interventionId } = await ctx.params;

  // §10/§28 — authorise FIRST (deterministic 401/403; no business-validation oracle pre-auth).
  const access = await resolveAlertAccess(req, casinoParam(req));
  if (!access.ok) return deny(access.status);

  const idem = parseIdempotencyKey(req.headers.get('Idempotency-Key'));
  if (!idem.ok) return bad(idem.code, idem.error);

  // Accept a zero-length body or {}; reject any body carrying fields/array/scalar.
  let body: unknown = null;
  const raw = await req.text();
  if (raw.trim() !== '') {
    try { body = JSON.parse(raw); } catch { return bad('BODY', 'request body must be empty or {}'); }
  }
  const emptied = parseEmptyBody(body);
  if (!emptied.ok) return bad(emptied.code, emptied.error);

  const outcome = await closeFollowUpRequirement(access.admin, access.scopeCasino, interventionId, access.principal, idem.key);
  if (outcome.kind === 'error') return deny(outcome.status);

  const m = httpForStatus(outcome.status);
  if (!m.ok) {
    if (outcome.status === 'NOT_FOUND') return deny(404);
    return NextResponse.json({ ok: false, code: m.code, error: 'that closure conflicts with a prior request using the same idempotency key' }, { status: m.status });
  }
  return NextResponse.json(
    { ok: true, status: outcome.status },
    { status: m.status, headers: { 'Cache-Control': 'no-store, private' } },
  );
}

export async function GET() { return deny(404); }
