// ── SafeBet IQ — B4.1: acknowledge (OPEN → ACKNOWLEDGED) ──────────────────────
//
// POST /api/casino/protection-alerts/{id}/acknowledge — governed, own-casino, idempotent.
// Scoped by BOTH id and casino_id: a cross-casino/unknown id returns 404 (no existence
// disclosure). The server supplies ONLY status + acknowledged_by (from the verified
// principal); the DB trigger sets acknowledged_at. Request body must be empty.

import { NextResponse } from 'next/server';
import { resolveAlertAccess } from '@/lib/responsibleProfitability/alertsServer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const deny = (status: number) => NextResponse.json({ ok: false, error: 'Not available.' }, { status });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  // No request-body fields are accepted (attribution/timestamps are server/DB-derived).
  let body: unknown = null;
  try { body = await req.json(); } catch { body = null; }
  if (body && typeof body === 'object' && Object.keys(body as object).length > 0) return deny(400);

  const access = await resolveAlertAccess(req);
  if (!access.ok) return deny(access.status);
  const { admin, scopeCasino, principal } = access;

  const { data: row, error } = await admin
    .from('player_protection_alerts')
    .select('id, status')
    .eq('id', id).eq('casino_id', scopeCasino)
    .maybeSingle();
  if (error) return deny(503);
  if (!row) return deny(404);                                   // cross-casino/unknown → no existence leak
  if (row.status === 'ACKNOWLEDGED') return NextResponse.json({ ok: true, id, status: 'ACKNOWLEDGED', idempotent: true });
  if (row.status === 'RESOLVED') return deny(409);

  // Transition OPEN → ACKNOWLEDGED (concurrency-guarded by the status predicate).
  const { data: upd, error: uErr } = await admin
    .from('player_protection_alerts')
    .update({ status: 'ACKNOWLEDGED', acknowledged_by: principal.userId })
    .eq('id', id).eq('casino_id', scopeCasino).eq('status', 'OPEN')
    .select('id, status');
  if (uErr) return deny(409);
  if (upd && upd.length > 0) return NextResponse.json({ ok: true, id, status: 'ACKNOWLEDGED' });

  // Raced with another request: re-read and respond idempotently.
  const { data: now } = await admin
    .from('player_protection_alerts').select('status').eq('id', id).eq('casino_id', scopeCasino).maybeSingle();
  if (!now) return deny(404);
  if (now.status === 'ACKNOWLEDGED') return NextResponse.json({ ok: true, id, status: 'ACKNOWLEDGED', idempotent: true });
  return deny(409);
}

export async function GET() { return deny(404); }
