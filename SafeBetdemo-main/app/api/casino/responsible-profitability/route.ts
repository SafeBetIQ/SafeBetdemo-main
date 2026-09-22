// ── SafeBet IQ — Responsible Profitability B1 overview (NON-PRODUCTION scope) ──
//
// A read-only operator intelligence endpoint. It NEVER computes a second GGR
// engine: it forwards the caller's own verified JWT to the certified Consumer
// Platform gateway (consumer-gateway `live-floor`) and reuses the certified
// financial posture + risk-band KPI VERBATIM, so every financial value here
// reconciles to the certified posture by construction (B1 §2). It then adds a
// casino-scoped active self-exclusion COUNT (defence-in-depth: only the count,
// only for the gateway-confirmed casino, never player identities) and composes
// the governed Responsible-Profitability metric set with the pure metrics
// library. Metrics whose supporting data is not authorised/period-aligned/
// certified are returned NOT_AVAILABLE with provenance — never estimated (§4).
//
// Auth: the gateway derives scope from the JWT (principalMayAccessCasino applies
// server-side there); this route requires a bearer, resolves the caller's own
// casino, and refuses cross-casino requests. No new SECURITY DEFINER / PUBLIC /
// anon surface is introduced (§7). Anon → 401, unknown/ineligible role → 403.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { computeResponsibleProfitability, type RpKpi, type RpInterventionCoverage } from '@/lib/responsibleProfitability';
import { profileForRole } from '@/lib/consumerPlatform/authorization';
import { FINANCIAL_PERIODS, type FinancialPeriod } from '@/lib/certifiedFinancial';
import type { FinancialPostureView, LiveKpiView } from '@/lib/consumerPlatform/contracts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const deny = (status: number) => NextResponse.json({ ok: false, error: 'Not available.' }, { status });

interface LiveFloorLite { kpi: LiveKpiView | null; financial: FinancialPostureView | null }

export async function GET(req: Request) {
  const correlationId = crypto.randomUUID();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) return deny(503);

  // Require a bearer; resolve the caller's own identity + casino server-side.
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return deny(401);
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: u, error: uErr } = await admin.auth.getUser(token);
  if (uErr || !u?.user) return deny(401);
  const { data: prof } = await admin.from('users').select('role, casino_id').eq('id', u.user.id).single();
  const profile = profileForRole(prof?.role);
  // Responsible-Profitability is an operator-scoped view: operators + admins only.
  if (!profile || (profile !== 'casino-operator' && profile !== 'administrator')) return deny(403);
  const casinoId = (prof?.casino_id as string | undefined) ?? undefined;
  if (profile === 'casino-operator' && !casinoId) return deny(403);

  // Period selection only SELECTS a certified view; it can never widen scope.
  const params = new URL(req.url).searchParams;
  const requested = (params.get('period') ?? 'TODAY').toUpperCase();
  const period: FinancialPeriod = FINANCIAL_PERIODS.some((p) => p.key === requested)
    ? (requested as FinancialPeriod) : 'TODAY';
  // An operator is pinned to their own casino; a differing request is refused.
  const reqCasino = params.get('casino_id') ?? undefined;
  if (reqCasino && casinoId && reqCasino !== casinoId) return deny(403);
  const scopeCasino = casinoId ?? reqCasino;
  if (!scopeCasino) return deny(403);

  // ── certified live-floor bundle, via the caller's OWN JWT (scope enforced by
  //    the gateway). financial + kpi are reused verbatim → reconciles by
  //    construction; no second GGR computation happens here. ──
  let floor: LiveFloorLite = { kpi: null, financial: null };
  try {
    const qs = new URLSearchParams({ view: 'live-floor', version: 'v1', casino_id: scopeCasino });
    const res = await fetch(`${url}/functions/v1/consumer-gateway?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anon },
    });
    if (res.ok) {
      const body = await res.json();
      const data = (body?.data ?? null) as LiveFloorLite | null;
      if (data) floor = { kpi: data.kpi ?? null, financial: data.financial ?? null };
    }
    // A non-OK gateway response is treated as UNAVAILABLE data (null-not-zero),
    // never as a silent 0 — computeResponsibleProfitability renders "—".
  } catch {
    /* leave floor null → certified metrics render "—" */
  }

  // ── casino-scoped active self-exclusion COUNT (protection metric input) ──
  //    Count only, scoped to the gateway-confirmed casino; never identities.
  let activeSelfExclusions: number | null = null;
  try {
    const { count, error } = await admin
      .from('self_exclusions')
      .select('id', { count: 'exact', head: true })
      .eq('casino_id', scopeCasino)
      .in('status', ['active', 'breached']);
    if (!error) activeSelfExclusions = count ?? 0;
  } catch {
    activeSelfExclusions = null; // unavailable → "—", never 0
  }

  // ── intervention coverage: currently NOT_AVAILABLE by design ──
  //    projection_intervention_state is unpopulated on this environment; B1 does
  //    NOT fabricate coverage. A labelled, isolated synthetic Demo fixture would
  //    be required to make this MEASURABLE (deliberately withheld — §4/§6).
  const interventionCoverage: RpInterventionCoverage | null = null;

  const kpi: RpKpi | null = floor.kpi
    ? {
        active_players: floor.kpi.active_players ?? null,
        risk_critical: floor.kpi.risk_critical ?? null,
        risk_high: floor.kpi.risk_high ?? null,
        risk_medium: floor.kpi.risk_medium ?? null,
        risk_low: floor.kpi.risk_low ?? null,
      }
    : null;

  const overview = computeResponsibleProfitability({
    casinoId: scopeCasino,
    period,
    financial: floor.financial,
    kpi,
    activeSelfExclusions,
    interventionCoverage,
    now: new Date().toISOString(),
  });

  return NextResponse.json(
    { ok: true, correlationId, overview },
    { headers: { 'Cache-Control': 'no-store, private' } },
  );
}

export async function POST() { return deny(404); }
