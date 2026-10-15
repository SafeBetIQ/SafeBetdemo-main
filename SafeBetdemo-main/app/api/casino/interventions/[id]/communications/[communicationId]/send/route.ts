// ── SafeBet IQ — B13.1: authorise + perform SANDBOX send of a player communication ──
//
// POST /api/casino/interventions/{id}/communications/{communicationId}/send
//   header: Idempotency-Key: <uuid>   (SEPARATE from the create key)
//   body:   empty
//
// Human dispatch authorisation (PENDING → SUBMITTING) via the narrow DEFINER RPC, then the
// code-level SANDBOX connector (no network/contact/secret) drives SUBMITTED → DELIVERED, each
// step idempotent and crash-resumable. NO real message is sent. Returns the safe communication
// DTO. Authorization is enforced BEFORE any body validation.
// 200 (sandbox submitted/delivered/failed) / 409 IDEMPOTENCY_CONFLICT|INVALID_STATE / 404 / 400.

import { NextResponse } from 'next/server';
import { resolveAlertAccess } from '@/lib/responsibleProfitability/alertsServer';
import { sendPlayerCommunication } from '@/lib/responsibleProfitability/playerCommunicationsServer';
import { parseIdempotencyKey, parseEmptyBody, httpForSend } from '@/lib/responsibleProfitability/playerCommunications';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const deny = (status: number) => NextResponse.json({ ok: false, error: 'Not available.' }, { status });
const bad = (code: string, error: string) => NextResponse.json({ ok: false, code, error }, { status: 400 });
const casinoParam = (req: Request) => new URL(req.url).searchParams.get('casino_id') ?? undefined;

export async function POST(req: Request, ctx: { params: Promise<{ id: string; communicationId: string }> }) {
  const { communicationId } = await ctx.params;

  // Authorise FIRST.
  const access = await resolveAlertAccess(req, casinoParam(req));
  if (!access.ok) return deny(access.status);

  const idem = parseIdempotencyKey(req.headers.get('Idempotency-Key'));
  if (!idem.ok) return bad(idem.code, idem.error);

  let body: unknown = null;
  const raw = await req.text();
  if (raw.trim() !== '') { try { body = JSON.parse(raw); } catch { return bad('BODY', 'request body must be empty or {}'); } }
  const emptied = parseEmptyBody(body);
  if (!emptied.ok) return bad(emptied.code, emptied.error);

  const outcome = await sendPlayerCommunication(access.admin, access.scopeCasino, access.principal, communicationId, idem.key);
  if (outcome.kind === 'error') return deny(503);
  if (outcome.kind === 'status') {
    const m = httpForSend(outcome.status);
    if (outcome.status === 'NOT_FOUND') return deny(404);
    return NextResponse.json({ ok: false, code: m.code, error: 'that communication could not be sent' }, { status: m.status });
  }
  return NextResponse.json(
    { ok: true, sandbox: true, communication: outcome.communication },
    { headers: { 'Cache-Control': 'no-store, private' } },
  );
}

export async function GET() { return deny(404); }
