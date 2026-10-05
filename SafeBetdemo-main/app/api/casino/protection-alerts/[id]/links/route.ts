// ── SafeBet IQ — B6: active intervention links for a protection alert ─────────
//
// GET /api/casino/protection-alerts/{id}/links
// Governed, own-casino, read-only. Returns the ACTIVE links for the alert joined to the
// CURRENT recorded intervention values (never a link-time snapshot). Minimal fields only.

import { NextResponse } from 'next/server';
import { resolveAlertAccess } from '@/lib/responsibleProfitability/alertsServer';
import { resolveAlert, listActiveLinks } from '@/lib/responsibleProfitability/traceabilityServer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const deny = (status: number) => NextResponse.json({ ok: false, error: 'Not available.' }, { status });

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: alertId } = await ctx.params;

  const requestedCasino = new URL(req.url).searchParams.get('casino_id') ?? undefined;
  const access = await resolveAlertAccess(req, requestedCasino);
  if (!access.ok) return deny(access.status);
  const { admin, scopeCasino } = access;

  const alert = await resolveAlert(admin, scopeCasino, alertId);
  if (!alert.ok) return deny(alert.status);

  const links = await listActiveLinks(admin, scopeCasino, alertId);
  return NextResponse.json({ ok: true, links }, { headers: { 'Cache-Control': 'no-store, private' } });
}

export async function POST() { return deny(404); }
