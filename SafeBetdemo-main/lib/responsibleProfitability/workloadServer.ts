// ─── SafeBet IQ — B7 Workload & Follow-Up Assurance: governed server assembly ────
//
// Server-only. Reuses the B4.1 authorisation path (resolveAlertAccess) and reads ONLY
// the governed source tables with minimal columns / exact COUNT aggregates — never
// audit_events, never the B2 ALL_RECORDED projection. Aggregate-only; no PII.

import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveAlertAccess } from './alertsServer.ts';
import {
  sastToday, sastDateOf, dayDiff, buildInterventionCurrent, buildOutcomeDistribution,
  WORKLOAD_TIMEZONE, WORKLOAD_MAX_RANGE_DAYS, WORKLOAD_LINK_DENOMINATOR, WORKLOAD_SEMANTICS,
  OUTCOME_CATEGORIES,
  type WorkloadPeriod,
} from './workload.ts';

export interface WorkloadAccessOk { ok: true; admin: SupabaseClient; scopeCasino: string; casinoName: string | null; role: string }
export interface WorkloadAccessDeny { ok: false; status: number }
export type WorkloadAccess = WorkloadAccessOk | WorkloadAccessDeny;

export async function resolveWorkloadAccess(req: Request, requestedCasinoId?: string): Promise<WorkloadAccess> {
  const access = await resolveAlertAccess(req, requestedCasinoId);     // verifyPrincipal → operator gate → scope → mayAccess
  if (!access.ok) return { ok: false, status: access.status };
  const { data } = await access.admin.from('casinos').select('name').eq('id', access.scopeCasino).maybeSingle();
  return { ok: true, admin: access.admin, scopeCasino: access.scopeCasino, casinoName: (data as { name?: string | null } | null)?.name ?? null, role: access.principal.role };
}

/** Exact COUNT (head request; no rows fetched). */
async function cnt(q: { count: number | null }): Promise<number> { return q.count ?? 0; }

export async function buildWorkloadSummary(access: WorkloadAccessOk, period: WorkloadPeriod) {
  const { admin, scopeCasino, casinoName } = access;
  const C = scopeCasino;
  const today = sastToday();
  const { startIso, endIsoExclusive } = period;

  const IV = () => admin.from('player_protection_interventions').select('*', { count: 'exact', head: true }).eq('casino_id', C);
  const AL = () => admin.from('player_protection_alerts').select('*', { count: 'exact', head: true }).eq('casino_id', C);
  const LK = () => admin.from('alert_intervention_links').select('*', { count: 'exact', head: true }).eq('casino_id', C);

  // ── current intervention follow-up workload (as-of now; period-independent) ──
  const [undated, dueToday, overdue, future, reqNotRecorded] = await Promise.all([
    cnt(await IV().eq('follow_up_required', true).is('follow_up_date', null)),
    cnt(await IV().eq('follow_up_required', true).eq('follow_up_date', today)),
    cnt(await IV().eq('follow_up_required', true).lt('follow_up_date', today)),
    cnt(await IV().eq('follow_up_required', true).gt('follow_up_date', today)),
    cnt(await IV().is('follow_up_required', null)),
  ]);
  // maxDaysOverdue: earliest overdue follow_up_date → days before today (minimal 1-row read)
  let maxDaysOverdue: number | null = null;
  if (overdue > 0) {
    const { data } = await admin.from('player_protection_interventions')
      .select('follow_up_date').eq('casino_id', C).eq('follow_up_required', true).lt('follow_up_date', today)
      .order('follow_up_date', { ascending: true }).limit(1).maybeSingle();
    maxDaysOverdue = dayDiff((data as { follow_up_date?: string } | null)?.follow_up_date ?? null, today);
  }
  const interventionsCurrent = buildInterventionCurrent({
    followUpRequiredButUndated: undated, followUpDueToday: dueToday, followUpOverdue: overdue, followUpFuture: future, maxDaysOverdue,
  });

  // ── current alert workload ──
  const [openAlerts, acknowledgedAlerts] = await Promise.all([
    cnt(await AL().eq('status', 'OPEN')),
    cnt(await AL().eq('status', 'ACKNOWLEDGED')),
  ]);
  const oldestIso = async (status: string, col: string): Promise<string | null> => {
    const { data } = await admin.from('player_protection_alerts')
      .select(col).eq('casino_id', C).eq('status', status).order(col, { ascending: true }).limit(1).maybeSingle();
    return (data as Record<string, string | null> | null)?.[col] ?? null;
  };
  const oldestOpenAgeDays = openAlerts > 0 ? dayDiff(sastDateOf(await oldestIso('OPEN', 'generated_at')), today) : null;
  const oldestAcknowledgedAgeDays = acknowledgedAlerts > 0 ? dayDiff(sastDateOf(await oldestIso('ACKNOWLEDGED', 'acknowledged_at')), today) : null;

  // ── current traceability (denominator = OPEN + ACKNOWLEDGED) ──
  const activeTraceabilityLinks = await cnt(await LK().is('superseded_at', null));
  const { data: activeLinkRows } = await admin.from('alert_intervention_links')
    .select('alert_id').eq('casino_id', C).is('superseded_at', null);
  const linkedAlertIds = new Set((activeLinkRows ?? []).map((r) => (r as { alert_id: string }).alert_id));
  const { data: activeAlertRows } = await admin.from('player_protection_alerts')
    .select('id').eq('casino_id', C).in('status', ['OPEN', 'ACKNOWLEDGED']);
  const openAckIds = (activeAlertRows ?? []).map((r) => (r as { id: string }).id);
  const alertsWithActiveInterventionLink = openAckIds.filter((id) => linkedAlertIds.has(id)).length;
  const alertsWithoutActiveInterventionLink = openAckIds.length - alertsWithActiveInterventionLink;

  // ── period activity ──
  const interventionsRecordedInPeriod = await cnt(await IV().gte('intervention_date', startIso).lt('intervention_date', endIsoExclusive));
  const outcomeCounts: Partial<Record<(typeof OUTCOME_CATEGORIES)[number], number>> = {};
  await Promise.all(OUTCOME_CATEGORIES.map(async (o) => {
    outcomeCounts[o] = await cnt(await IV().eq('outcome', o).gte('intervention_date', startIso).lt('intervention_date', endIsoExclusive));
  }));
  const notRecorded = await cnt(await IV().is('outcome', null).gte('intervention_date', startIso).lt('intervention_date', endIsoExclusive));
  const recordedOutcomeDistribution = buildOutcomeDistribution(outcomeCounts, notRecorded);

  const [alertsGeneratedInPeriod, alertsResolvedInPeriod] = await Promise.all([
    cnt(await AL().gte('generated_at', startIso).lt('generated_at', endIsoExclusive)),
    cnt(await AL().gte('resolved_at', startIso).lt('resolved_at', endIsoExclusive)),
  ]);
  const [initialLinksRecordedInPeriod, linkCorrectionsRecordedInPeriod] = await Promise.all([
    cnt(await LK().gte('linked_at', startIso).lt('linked_at', endIsoExclusive).is('supersedes_link_id', null)),
    cnt(await LK().gte('linked_at', startIso).lt('linked_at', endIsoExclusive).not('supersedes_link_id', 'is', null)),
  ]);

  return {
    scope: { casinoName },
    period: { start: period.startDate, endExclusive: period.endDate, timezone: WORKLOAD_TIMEZONE, maxRangeDays: WORKLOAD_MAX_RANGE_DAYS },
    generatedAt: new Date().toISOString(),
    currentWorkload: {
      interventions: interventionsCurrent,
      alerts: { openAlerts, acknowledgedAlerts, oldestOpenAgeDays, oldestAcknowledgedAgeDays },
      traceability: { linkDenominator: WORKLOAD_LINK_DENOMINATOR, alertsWithActiveInterventionLink, alertsWithoutActiveInterventionLink, activeTraceabilityLinks },
    },
    periodActivity: {
      interventions: { interventionsRecordedInPeriod, recordedOutcomeDistribution },
      alerts: { alertsGeneratedInPeriod, alertsResolvedInPeriod },
      traceability: { initialLinksRecordedInPeriod, linkCorrectionsRecordedInPeriod },
    },
    dataQuality: {
      followUpRequiredButUndated: undated,
      followUpRequirementNotRecorded: reqNotRecorded,
      followUpCompletionAvailable: false as const,
    },
    semantics: { ...WORKLOAD_SEMANTICS },
  };
}
