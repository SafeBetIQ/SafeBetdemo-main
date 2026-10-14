// ── SafeBet IQ — B12: mark an operator notification read ──────────────────────────
//
// POST /api/casino/notifications/{notificationId}/read   (empty body)
//   Governed, own-casino. Re-derives the CURRENT projection and proves the notificationId
//   is a current active item BEFORE recording per-user read-state via the narrow DEFINER
//   RPC. Read-state is operational only (never audit evidence, never a domain mutation).
//   200 READ/NOOP / 404 (not a current item / stale) / 400 (bad id or body) / 401 / 403.

import { NextResponse } from 'next/server';
import { resolveAlertAccess } from '@/lib/responsibleProfitability/alertsServer';
import { markOperatorNotificationRead } from '@/lib/responsibleProfitability/operatorNotificationsServer';
import { isNotificationId, parseEmptyBody } from '@/lib/responsibleProfitability/operatorNotifications';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const deny = (status: number) => NextResponse.json({ ok: false, error: 'Not available.' }, { status });
const bad = (code: string, error: string) => NextResponse.json({ ok: false, code, error }, { status: 400 });

export async function POST(req: Request, ctx: { params: Promise<{ notificationId: string }> }) {
  const { notificationId } = await ctx.params;

  // Authorise FIRST (deterministic 401/403; no business-validation oracle pre-auth).
  const access = await resolveAlertAccess(req, new URL(req.url).searchParams.get('casino_id') ?? undefined);
  if (!access.ok) return deny(access.status);

  if (!isNotificationId(notificationId)) return bad('NOTIFICATION_ID', 'invalid notification id');

  let body: unknown = null;
  const raw = await req.text();
  if (raw.trim() !== '') { try { body = JSON.parse(raw); } catch { return bad('BODY', 'request body must be empty or {}'); } }
  const emptied = parseEmptyBody(body);
  if (!emptied.ok) return bad(emptied.code, emptied.error);

  const outcome = await markOperatorNotificationRead(access.admin, access.scopeCasino, access.principal, notificationId);
  if (outcome.kind === 'error') return deny(503);
  if (outcome.kind === 'not_found') return deny(404);
  return NextResponse.json({ ok: true, status: outcome.status }, { headers: { 'Cache-Control': 'no-store, private' } });
}

export async function GET() { return deny(404); }
