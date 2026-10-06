// ── SafeBet IQ — B8: unschedule (clear the follow-up due date), keep required ──
// POST /api/casino/interventions/{id}/unschedule-follow-up  body: {} / none
// 200 applied; 200 NOOP if already undated; 409 invalid-state (not required);
// 404 unknown-in-scope. follow_up_required stays true.

import { NextResponse } from 'next/server';
import { resolveAlertAccess } from '@/lib/responsibleProfitability/alertsServer';
import { setFollowUp } from '@/lib/responsibleProfitability/followUpSchedulingServer';
import { parseEmptyBody, httpForResult } from '@/lib/responsibleProfitability/followUpScheduling';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const deny = (status: number) => NextResponse.json({ ok: false, error: 'Not available.' }, { status });
const bad = (code: string, error: string) => NextResponse.json({ ok: false, code, error }, { status: 400 });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: unknown = null;
  try { body = await req.json(); } catch { body = null; }
  const parsed = parseEmptyBody(body);
  if (!parsed.ok) return bad(parsed.code, parsed.error);

  const access = await resolveAlertAccess(req, new URL(req.url).searchParams.get('casino_id') ?? undefined);
  if (!access.ok) return deny(access.status);

  const outcome = await setFollowUp(access.admin, access.scopeCasino, id, access.principal, 'UNSCHEDULE', null);
  if (outcome.kind === 'error') return deny(outcome.status);
  const m = httpForResult(outcome.result);
  return NextResponse.json({ ok: m.ok, ...(m.code ? { code: m.code } : {}) }, { status: m.status, headers: { 'Cache-Control': 'no-store, private' } });
}

export async function GET() { return deny(404); }
