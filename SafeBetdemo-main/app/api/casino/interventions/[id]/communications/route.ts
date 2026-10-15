// ── SafeBet IQ — B13.1: create / list governed player communications (SANDBOX) ─────
//
// POST /api/casino/interventions/{id}/communications
//   header: Idempotency-Key: <uuid>
//   body:   { communicationType, templateKey }   (version/purpose/mode/channel server-governed)
// GET  /api/casino/interventions/{id}/communications  → own-casino history (≤50, safe DTO)
//
// Governed, own-casino, responsible-gambling only, SANDBOX delivery only. Creates a PENDING
// communication record via the narrow DEFINER RPC; NO real message is sent here. Casino +
// intervention type are derived/validated DB-side; actor from the principal. Authorization is
// enforced BEFORE any business-field validation (no validation oracle).
// 201 CREATED / 200 REPLAYED / 409 IDEMPOTENCY_CONFLICT|INVALID_STATE / 404 unknown / 400 validation.

import { NextResponse } from 'next/server';
import { resolveAlertAccess } from '@/lib/responsibleProfitability/alertsServer';
import { createPlayerCommunication, listPlayerCommunications } from '@/lib/responsibleProfitability/playerCommunicationsServer';
import { parseIdempotencyKey, parseCreateBody, httpForCreate } from '@/lib/responsibleProfitability/playerCommunications';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const deny = (status: number) => NextResponse.json({ ok: false, error: 'Not available.' }, { status });
const bad = (code: string, error: string) => NextResponse.json({ ok: false, code, error }, { status: 400 });
const casinoParam = (req: Request) => new URL(req.url).searchParams.get('casino_id') ?? undefined;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: interventionId } = await ctx.params;

  // Authorise FIRST (deterministic 401/403; no business-validation oracle pre-auth).
  const access = await resolveAlertAccess(req, casinoParam(req));
  if (!access.ok) return deny(access.status);

  const idem = parseIdempotencyKey(req.headers.get('Idempotency-Key'));
  if (!idem.ok) return bad(idem.code, idem.error);

  let body: unknown = null;
  try { body = await req.json(); } catch { body = null; }
  const parsed = parseCreateBody(body);
  if (!parsed.ok) return bad(parsed.code, parsed.error);

  const outcome = await createPlayerCommunication(
    access.admin, access.scopeCasino, access.principal, interventionId, parsed.communicationType, parsed.templateKey, idem.key,
  );
  if (outcome.kind === 'error') return deny(503);

  const status = outcome.kind === 'ok' ? outcome.status : outcome.status;
  const m = httpForCreate(status);
  if (!m.ok) {
    if (status === 'NOT_FOUND') return deny(404);
    return NextResponse.json({ ok: false, code: m.code, error: 'that communication could not be created' }, { status: m.status });
  }
  return NextResponse.json(
    {
      ok: true, status: m.code === 'REPLAYED' ? 'REPLAYED' : 'CREATED',
      communicationId: outcome.kind === 'ok' ? outcome.communicationId : undefined,
      sequence: outcome.kind === 'ok' ? outcome.sequence : undefined,
      sandbox: true,
    },
    { status: m.status, headers: { 'Cache-Control': 'no-store, private' } },
  );
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: interventionId } = await ctx.params;

  const access = await resolveAlertAccess(req, casinoParam(req));
  if (!access.ok) return deny(access.status);

  const result = await listPlayerCommunications(access.admin, access.scopeCasino, interventionId);
  if (result.kind === 'error') return deny(503);
  if (result.kind === 'not_found') return deny(404);
  return NextResponse.json({ ok: true, items: result.items }, { headers: { 'Cache-Control': 'no-store, private' } });
}
