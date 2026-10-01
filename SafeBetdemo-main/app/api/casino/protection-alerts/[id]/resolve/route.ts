// ── SafeBet IQ — B4.1: resolve (OPEN|ACKNOWLEDGED → RESOLVED) ─────────────────
//
// POST /api/casino/protection-alerts/{id}/resolve — governed, own-casino, idempotent.
// Scoped by BOTH id and casino_id (cross-casino/unknown → 404). The server supplies ONLY
// status + resolved_by (from the verified principal); the DB trigger sets resolved_at and
// forbids fabricating acknowledgement on a direct OPEN→RESOLVED. Request body must be empty.
// No free-text resolution note in v1.

import { NextResponse } from 'next/server';
import { resolveAlertAccess } from '@/lib/responsibleProfitability/alertsServer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const deny = (status: number) => NextResponse.json({ ok: false, error: 'Not available.' }, { status });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

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
  if (!row) return deny(404);
  if (row.status === 'RESOLVED') return NextResponse.json({ ok: true, id, status: 'RESOLVED', idempotent: true });

  // Transition OPEN|ACKNOWLEDGED → RESOLVED (guarded against a concurrent resolve).
  const { data: upd, error: uErr } = await admin
    .from('player_protection_alerts')
    .update({ status: 'RESOLVED', resolved_by: principal.userId })
    .eq('id', id).eq('casino_id', scopeCasino).in('status', ['OPEN', 'ACKNOWLEDGED'])
    .select('id, status');
  if (uErr) return deny(409);
  if (upd && upd.length > 0) return NextResponse.json({ ok: true, id, status: 'RESOLVED' });

  // Raced: if it is now RESOLVED, respond idempotently; otherwise it vanished from scope.
  const { data: now } = await admin
    .from('player_protection_alerts').select('status').eq('id', id).eq('casino_id', scopeCasino).maybeSingle();
  if (!now) return deny(404);
  if (now.status === 'RESOLVED') return NextResponse.json({ ok: true, id, status: 'RESOLVED', idempotent: true });
  return deny(409);
}

export async function GET() { return deny(404); }
