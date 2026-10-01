// ── SafeBet IQ — B4.1: deterministic evaluation (the ONLY alert-materialising op) ──
//
// POST /api/casino/protection-alerts/evaluate — governed, own-casino, idempotent.
// Identifies eligible source rows for the two v1 rules and INSERTs candidates;
// the identity indexes make this idempotent (a duplicate raises 23505 → alreadyPresent).
// The DB trigger RE-PROVES
// eligibility, GENERATES immutable evidence and OWNS timestamps; the API never
// supplies evidence/timestamps/status/identity. generated_by comes from the verified
// principal. Request body may ONLY carry a governed casino_id (super_admin selection);
// any other field is rejected (400). Returns a non-sensitive governed summary.

import { NextResponse } from 'next/server';
import { resolveAlertAccess } from '@/lib/responsibleProfitability/alertsServer';
import {
  emptyEvaluateSummary, sastBusinessDate,
  isSelfExclusionBreachEligible, isInterventionFollowUpOverdue,
  buildBreachCandidate, buildFollowUpCandidate,
  type AlertCandidate, type SelfExclusionSourceRow, type InterventionSourceRow,
} from '@/lib/responsibleProfitability/alerts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const deny = (status: number) => NextResponse.json({ ok: false, error: 'Not available.' }, { status });

export async function POST(req: Request) {
  // Parse an OPTIONAL body. The ONLY permitted field is casino_id (governed super_admin
  // selection); anything else is a forbidden server/DB-derived field → 400.
  let body: Record<string, unknown> | null = null;
  try { body = (await req.json()) as Record<string, unknown>; } catch { body = null; }
  if (body && typeof body === 'object') {
    for (const k of Object.keys(body)) if (k !== 'casino_id') return deny(400);
  }
  const requestedCasino =
    (body && typeof body.casino_id === 'string') ? body.casino_id
      : (new URL(req.url).searchParams.get('casino_id') ?? undefined);

  const access = await resolveAlertAccess(req, requestedCasino);
  if (!access.ok) return deny(access.status);
  const { admin, scopeCasino, principal } = access;

  const generatedBy = principal.userId;
  const sastToday = sastBusinessDate();
  const summary = emptyEvaluateSummary(scopeCasino);

  // Rule A — breached self-exclusions (own casino, player reference present).
  const { data: seRows, error: seErr } = await admin
    .from('self_exclusions')
    .select('id, casino_id, player_id, status, breach_count')
    .eq('casino_id', scopeCasino)
    .eq('status', 'breached');
  if (seErr) return deny(503);

  // Rule C — interventions with a required, past-due (SAST) follow-up.
  const { data: ivRows, error: ivErr } = await admin
    .from('player_protection_interventions')
    .select('id, casino_id, player_id, follow_up_required, follow_up_date')
    .eq('casino_id', scopeCasino)
    .eq('follow_up_required', true)
    .lt('follow_up_date', sastToday);
  if (ivErr) return deny(503);

  const candidates: AlertCandidate[] = [
    ...((seRows ?? []) as SelfExclusionSourceRow[])
      .filter((r) => isSelfExclusionBreachEligible(r, scopeCasino))
      .map((r) => buildBreachCandidate(r, scopeCasino, generatedBy)),
    ...((ivRows ?? []) as InterventionSourceRow[])
      .filter((r) => isInterventionFollowUpOverdue(r, scopeCasino, sastToday))
      .map((r) => buildFollowUpCandidate(r, scopeCasino, sastToday, generatedBy)),
  ];
  summary.evaluated = candidates.length;

  // Insert each candidate. The DB identity indexes make this idempotent: a duplicate
  // (same source row) raises 23505 → alreadyPresent. A DB eligibility re-proof failure
  // (edge: source changed between read and insert) is skipped — never fabricated.
  for (const c of candidates) {
    const { error } = await admin.from('player_protection_alerts').insert(c);
    if (!error) summary.created++;
    else if ((error as { code?: string }).code === '23505') summary.alreadyPresent++;
    // else: skip silently (do not fabricate; DB remains the eligibility authority)
  }

  return NextResponse.json({ ok: true, ...summary }, { headers: { 'Cache-Control': 'no-store, private' } });
}

export async function GET() { return deny(404); }
