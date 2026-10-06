// ── SafeBet IQ — B8: schedule a follow-up due date on an existing intervention ──
// POST /api/casino/interventions/{id}/schedule-follow-up  body: { follow_up_date: "YYYY-MM-DD" }
// Governed, own-casino. Atomic via sbiq_b8_set_follow_up. 200 applied; 409 invalid-state
// (already scheduled / not required); 404 unknown-in-scope; 400 bad date.

import { NextResponse } from 'next/server';
import { resolveAlertAccess } from '@/lib/responsibleProfitability/alertsServer';
import { setFollowUp } from '@/lib/responsibleProfitability/followUpSchedulingServer';
import { parseFollowUpDate, httpForResult } from '@/lib/responsibleProfitability/followUpScheduling';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const deny = (status: number) => NextResponse.json({ ok: false, error: 'Not available.' }, { status });
const bad = (code: string, error: string) => NextResponse.json({ ok: false, code, error }, { status: 400 });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: unknown = null;
  try { body = await req.json(); } catch { body = null; }
  const parsed = parseFollowUpDate(body);
  if (!parsed.ok) return bad(parsed.code, parsed.error);

  const access = await resolveAlertAccess(req, new URL(req.url).searchParams.get('casino_id') ?? undefined);
  if (!access.ok) return deny(access.status);

  const outcome = await setFollowUp(access.admin, access.scopeCasino, id, access.principal, 'SCHEDULE', parsed.date);
  if (outcome.kind === 'error') return deny(outcome.status);
  const m = httpForResult(outcome.result);
  return NextResponse.json({ ok: m.ok, ...(m.code ? { code: m.code } : {}) }, { status: m.status, headers: { 'Cache-Control': 'no-store, private' } });
}

export async function GET() { return deny(404); }
