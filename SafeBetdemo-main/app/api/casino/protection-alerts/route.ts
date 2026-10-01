// ── SafeBet IQ — B4.1 Operator-Local Protection Alerts: list (READ-ONLY) ──────
//
// GET /api/casino/protection-alerts — governed, own-casino, read-only. Never
// materialises alerts (that is POST /evaluate only). Bearer → verifyPrincipal →
// operator role → governed casino scope → principalMayAccessCasino → service_role read.
// Anon → 401; ineligible role / cross-casino → 403/404; no direct client table access.

import { NextResponse } from 'next/server';
import { resolveAlertAccess } from '@/lib/responsibleProfitability/alertsServer';
import { ALERT_TYPES, EXCLUDED_ALERT_TYPES } from '@/lib/responsibleProfitability/alerts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const deny = (status: number) => NextResponse.json({ ok: false, error: 'Not available.' }, { status });

const ALERT_FIELDS =
  'id, alert_type, rule_version, status, player_id, evidence, generated_at, acknowledged_at, acknowledged_by, resolved_at, resolved_by, updated_at';

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const requestedCasino = params.get('casino_id') ?? undefined;

  const access = await resolveAlertAccess(req, requestedCasino);
  if (!access.ok) return deny(access.status);
  const { admin, scopeCasino } = access;

  const statusFilter = params.get('status');
  const typeFilter = params.get('alert_type');
  const limit = Math.min(Math.max(parseInt(params.get('limit') ?? '50', 10) || 50, 1), 200);
  const offset = Math.max(parseInt(params.get('offset') ?? '0', 10) || 0, 0);

  let q = admin
    .from('player_protection_alerts')
    .select(ALERT_FIELDS, { count: 'exact' })
    .eq('casino_id', scopeCasino)
    .order('generated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (statusFilter && ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'].includes(statusFilter)) q = q.eq('status', statusFilter);
  if (typeFilter && (ALERT_TYPES as string[]).includes(typeFilter)) q = q.eq('alert_type', typeFilter);

  const { data, error, count } = await q;
  if (error) return deny(503);

  return NextResponse.json(
    {
      ok: true, casinoId: scopeCasino, alerts: data ?? [], total: count ?? 0, limit, offset,
      rulesRun: [...ALERT_TYPES], rulesExcluded: [...EXCLUDED_ALERT_TYPES],
    },
    { headers: { 'Cache-Control': 'no-store, private' } },
  );
}

export async function POST() { return deny(404); }
