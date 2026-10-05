// ── SafeBet IQ — B7: operator-local workload & follow-up assurance summary ─────
//
// GET /api/casino/responsible-profitability/workload?start=YYYY-MM-DD&end=YYYY-MM-DD[&casino_id]
// Governed, own-casino, AGGREGATE-ONLY. Current-workload (as-of now) + period activity
// are separated. Occurrence/operational only — no completion, no effectiveness, no SLA.
// Migration-free: reads existing governed source tables; no DB object, no mutation.

import { NextResponse } from 'next/server';
import { resolveWorkloadAccess, buildWorkloadSummary } from '@/lib/responsibleProfitability/workloadServer';
import { validateWorkloadPeriod, isWorkloadPeriodError } from '@/lib/responsibleProfitability/workload';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const deny = (status: number) => NextResponse.json({ ok: false, error: 'Not available.' }, { status });
const bad = (code: string, error: string) => NextResponse.json({ ok: false, code, error }, { status: 400 });

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;

  // Timezone is fixed to Africa/Johannesburg — a caller override is rejected, never ignored.
  if (params.has('timezone') || params.has('tz')) return bad('TIMEZONE_FIXED', 'timezone is fixed to Africa/Johannesburg and cannot be overridden');

  const period = validateWorkloadPeriod(params.get('start'), params.get('end'));
  if (isWorkloadPeriodError(period)) return bad(period.code, period.error);

  const access = await resolveWorkloadAccess(req, params.get('casino_id') ?? undefined);
  if (!access.ok) return deny(access.status);

  const summary = await buildWorkloadSummary(access, period);
  return NextResponse.json(
    { ok: true, ...summary },
    { headers: { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' } },
  );
}

export async function POST() { return deny(404); }
