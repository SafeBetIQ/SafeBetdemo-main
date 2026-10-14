// ── SafeBet IQ — B12: operator Responsible-Gambling notification projection ───────
//
// GET /api/casino/notifications?filter=unread|all&limit=
//   Governed, own-casino, IN_APP, projection-based. Derives CURRENT attention items
//   (self-exclusion alert / follow-up due / follow-up overdue) from authoritative state +
//   this user's read-state. No persisted notifications; no player data; read-only.
//   Authorisation is enforced before any query derivation.

import { NextResponse } from 'next/server';
import { resolveAlertAccess } from '@/lib/responsibleProfitability/alertsServer';
import { listOperatorNotifications } from '@/lib/responsibleProfitability/operatorNotificationsServer';
import { B12_LIST_LIMIT_DEFAULT } from '@/lib/responsibleProfitability/operatorNotifications';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const deny = (status: number) => NextResponse.json({ ok: false, error: 'Not available.' }, { status });

export async function GET(req: Request) {
  const access = await resolveAlertAccess(req, new URL(req.url).searchParams.get('casino_id') ?? undefined);
  if (!access.ok) return deny(access.status);

  const url = new URL(req.url);
  const filter = url.searchParams.get('filter') === 'all' ? 'all' : 'unread';
  const limRaw = Number(url.searchParams.get('limit'));
  const limit = Number.isFinite(limRaw) && limRaw > 0 ? limRaw : B12_LIST_LIMIT_DEFAULT;

  const out = await listOperatorNotifications(access.admin, access.scopeCasino, access.principal, filter, limit);
  if (out.kind === 'error') return deny(503);
  return NextResponse.json({ ok: true, items: out.items, unreadCount: out.unreadCount }, { headers: { 'Cache-Control': 'no-store, private' } });
}
