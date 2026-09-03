'use client';

// ─── Operator Dashboard (v2 — Live Feed design language) ─────────────────────
// A pure, READ-ONLY CONSUMER of the certified Consumer Platform. Every value
// comes from consumer-gateway views (live-floor + summary) — the SAME source as
// the Live Casino Feed. Nothing is recomputed here: the page validates the
// projected KPI for internal consistency (reconcileOperatorKpi) and shows an
// honest unavailable/integrity state rather than disguising missing data.
// Redesigned to match the Live Casino Feed: shared KPI cards, three compact
// posture panels, and a secondary risk/financial row. Tenant-agnostic (no
// casino-name conditionals) — the same shared implementation for all six casinos
// and any future tenant.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/DashboardLayout';
import { CasinoAdminGuard } from '@/components/CasinoAdminGuard';
import { SnapshotAge } from '@/components/SnapshotAge';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { PostureSummaryCard, ReconciliationBadge } from '@/components/dashboard/PostureSummaryCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { cgGet } from '@/lib/consumerClient';
import { reconcileOperatorKpi } from '@/lib/consumerPlatform/integrity';
import { dashboardStatus } from '@/lib/dashboardStatus';
import { OPERATOR_METRIC_LABELS } from '@/lib/operatorMetricLabels';
import type { LiveKpiView, FinancialPostureView } from '@/lib/consumerPlatform/contracts';
import { certifiedMoney } from '@/lib/certifiedFinancial';
import {
  financialFreshnessState, freshnessPresentation, financialCaption,
  DEFAULT_FINANCIAL_STALE_AFTER_SECONDS,
} from '@/lib/financialFreshness';
import {
  Users, Activity, MonitorSmartphone, DollarSign, ShieldAlert, HeartPulse,
  RefreshCw, CircleAlert, CircleCheck, HelpCircle,
} from 'lucide-react';

type Rec = Record<string, unknown>;
const n = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0)) || 0;
const int = (v: unknown) => n(v).toLocaleString();
// South African currency via the shared certified-financial contract: space
// thousands, "R 1 250 430", null → "—" (never a false zero), sign preserved.
const money0 = (v: unknown) => certifiedMoney(v, 0);

export default function OperatorDashboardPage() {
  const { user } = useAuth();
  const casinoId = (user as unknown as Rec)?.casino_id as string | undefined;
  const [floor, setFloor] = useState<Rec | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    // UAT-OP-3 (P1-A): the dashboard consumes ONLY the certified live-floor envelope
    // (kpi + financial + interventions). The previous parallel `summary` fetch was a
    // second full twin computation whose result was never rendered — dropped so the
    // shell settles on a single request.
    // Resilient fetch: the very first call after login can race the session write.
    // Retry a couple of times before declaring the certified snapshot unavailable
    // (so the dashboard never gets stuck on a false "Data unavailable").
    let f: Rec | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      f = await cgGet('live-floor', { casino_id: casinoId });
      // Retry until the certified KPI is actually present — a post-login token/scope
      // race can briefly return a floor envelope with a null kpi.
      if (f != null && (f as { kpi?: unknown }).kpi != null) break;
      await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
    }
    setFloor(f);
    setLoadFailed(f == null || (f as { kpi?: unknown }).kpi == null);
    setLoading(false);
  }, [casinoId]);

  useEffect(() => { refresh(); }, [refresh]);

  const kpi = (floor?.kpi ?? null) as LiveKpiView | null;
  const financial = (floor?.financial ?? null) as FinancialPostureView | null;
  const interventions = (floor?.interventions ?? []) as Rec[];
  const casinoName = String(floor?.casinoName ?? floor?.casino_name ?? '');
  const recon = reconcileOperatorKpi(kpi);
  const available = !loadFailed && kpi != null;

  // Per-domain reconciliation (certified identities; read-only, never recomputed source).
  const k = kpi ?? ({} as LiveKpiView);
  const playersOk = available && n(k.active_players) === n(k.players_active_now) + n(k.players_idle) + n(k.players_stale);
  const sessionsOk = available && n(k.open_sessions) === n(k.active_sessions) + n(k.idle_sessions) + n(k.stale_sessions);
  const machinesOk = available && n(k.active_machines) === n(k.machines_in_play) + n(k.machines_stale);
  const riskSum = n(k.risk_critical) + n(k.risk_high) + n(k.risk_medium) + n(k.risk_low) + n(k.risk_unclassified);
  const riskOk = available && n(k.active_players) === riskSum;

  const RISK = [
    { label: 'Critical', val: n(k.risk_critical), color: 'text-red-600', bar: 'bg-red-500', href: '/casino/evidence?domain=player&risk=critical' },
    { label: 'High', val: n(k.risk_high), color: 'text-orange-600', bar: 'bg-orange-500', href: '/casino/evidence?domain=player&risk=high' },
    { label: 'Medium', val: n(k.risk_medium), color: 'text-amber-600', bar: 'bg-amber-500', href: '/casino/evidence?domain=player&risk=medium' },
    { label: 'Low', val: n(k.risk_low), color: 'text-emerald-600', bar: 'bg-emerald-500', href: '/casino/evidence?domain=player&risk=low' },
    { label: 'Unclassified', val: n(k.risk_unclassified), color: 'text-muted-foreground', bar: 'bg-muted-foreground', href: '/casino/evidence?domain=player&risk=unclassified' },
  ];
  const FIN = [
    ['Today', financial?.ggrToday], ['Current shift', financial?.ggrCurrentShift],
    ['Last 24 hours', financial?.ggrLast24Hours], ['Month to date', financial?.ggrMonthToDate],
  ] as const;

  // ARCH-V3-A1: shared certified-financial freshness state (§12.4). Derived from
  // the certified posture + the TRUTHFUL source as-of (newest event time the
  // live-floor published) + the loading flag — never from render/request time.
  // Certified GGR is only ever LABELLED "certified" when this is FRESH; a
  // missing/stale/failed source shows an honest state, never "R0 certified".
  const freshness = financialFreshnessState({
    loading, posture: financial, sourceAsOf: kpi?.source_as_of,
    staleAfterSeconds: DEFAULT_FINANCIAL_STALE_AFTER_SECONDS,
  });
  const finCaption = financialCaption(freshness, financial?.currency ?? 'ZAR');
  const finLabel = freshnessPresentation(freshness).label;

  // UAT-OP-3 (P1-A): loading is NOT an integrity failure — gate the header badge so
  // no "Data integrity warning" flashes while the certified snapshot is still fetching.
  const status = dashboardStatus({ loading, hasKpi: kpi != null, loadFailed, reconOk: recon.ok });
  const statusBadge = status === 'loading'
    ? <Badge variant="outline" className="gap-1 border-muted-foreground/30 text-muted-foreground"><RefreshCw className="h-3 w-3 animate-spin" /> Loading…</Badge>
    : status === 'unavailable'
    ? <Badge variant="outline" className="gap-1 border-muted-foreground/40 text-muted-foreground"><HelpCircle className="h-3 w-3" /> Data unavailable</Badge>
    : status === 'integrity'
      ? <Badge variant="destructive" className="gap-1"><CircleAlert className="h-3 w-3" /> Data integrity warning</Badge>
      : <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-600"><CircleCheck className="h-3 w-3" /> Reconciled · Healthy</Badge>;

  return (
    <CasinoAdminGuard>
      <DashboardLayout>
        <div className="flex min-h-full flex-col">
          {/* 1. Simplified header */}
          <div className="border-b bg-card px-6 py-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Operator Dashboard</h1>
                <p className="text-sm text-muted-foreground">Live operational posture{casinoName ? ` for ${casinoName}` : ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end gap-0.5">
                {statusBadge}
                <SnapshotAge asOf={kpi?.source_as_of} staleAfterSeconds={DEFAULT_FINANCIAL_STALE_AFTER_SECONDS} />
              </div>
              <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6 space-y-6">
            {loading && !kpi ? (
              // Loading skeleton — never render a transient integrity warning / "—"
              // while the certified snapshot is still being fetched.
              <div className="space-y-6" aria-busy="true">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="bg-card border border-border rounded-xl px-4 py-4 space-y-2">
                      <div className="w-9 h-9 rounded-lg bg-muted animate-pulse" />
                      <div className="h-6 w-16 rounded bg-muted animate-pulse" />
                      <div className="h-3 w-24 rounded bg-muted animate-pulse" />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-2">
                      <div className="h-3 w-28 rounded bg-muted animate-pulse" />
                      {Array.from({ length: 4 }).map((_, j) => <div key={j} className="h-4 w-full rounded bg-muted animate-pulse" />)}
                    </div>
                  ))}
                </div>
              </div>
            ) : loadFailed ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
                <HelpCircle className="h-6 w-6 mx-auto mb-2 opacity-60" />
                The certified Consumer Platform snapshot is currently unavailable. Values are shown as “—”, not zero.
              </div>
            ) : (
              <>
                {/* 2. Primary KPI strip — Live Feed card system */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <KpiCard icon={Users} value={available ? int(k.players_active_now) : '—'} label={OPERATOR_METRIC_LABELS.activeNow}
                    sub={available ? `${int(k.active_players)} observed` : undefined} color="text-blue-600" iconBg="bg-blue-100" pulse={available} />
                  <KpiCard icon={Activity} value={available ? int(k.active_sessions) : '—'} label="Active Sessions"
                    sub={available ? `${int(k.open_sessions)} open` : undefined} color="text-orange-600" iconBg="bg-orange-100" />
                  <KpiCard icon={MonitorSmartphone} value={available ? int(k.machines_in_play) : '—'} label="In Play"
                    sub={available ? `${int(k.registered_machines)} registered` : 'Gaming machines & endpoints'} color="text-indigo-600" iconBg="bg-indigo-100" />
                  <KpiCard icon={DollarSign} value={financial ? money0(financial.ggrToday) : '—'} label="GGR Today"
                    sub={finCaption} color="text-emerald-600" iconBg="bg-emerald-100" />
                  <KpiCard icon={ShieldAlert} value={available ? int(k.risk_critical) : '—'} label="Critical Risk"
                    sub={available ? `${int(k.risk_high)} high` : undefined} color={n(k.risk_critical) > 0 ? 'text-red-600' : 'text-foreground'} iconBg="bg-red-100" />
                  <KpiCard icon={HeartPulse} value={int(interventions.length)} label="Open Interventions"
                    sub="Responsible gambling actions" color="text-teal-600" iconBg="bg-teal-100" />
                </div>

                {/* 3. Three compact posture panels */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <PostureSummaryCard title="Player Activity" reconciled={playersOk}
                    rows={[
                      { label: 'Active now', value: int(k.players_active_now), color: 'text-blue-600', barColor: 'bg-blue-500', segment: n(k.players_active_now) },
                      { label: 'Idle', value: int(k.players_idle), barColor: 'bg-amber-400', segment: n(k.players_idle) },
                      { label: 'Stale', value: int(k.players_stale), color: 'text-muted-foreground', barColor: 'bg-slate-300', segment: n(k.players_stale) },
                    ]}
                    total={{ label: 'Observed', value: int(k.active_players) }}
                    href="/casino/players" hrefLabel="View player activity details" />

                  <PostureSummaryCard title="Session Posture" reconciled={sessionsOk}
                    rows={[
                      { label: 'Active', value: int(k.active_sessions), color: 'text-orange-600', barColor: 'bg-orange-500', segment: n(k.active_sessions) },
                      { label: 'Idle', value: int(k.idle_sessions), barColor: 'bg-amber-400', segment: n(k.idle_sessions) },
                      { label: 'Stale', value: int(k.stale_sessions), color: 'text-muted-foreground', barColor: 'bg-slate-300', segment: n(k.stale_sessions) },
                    ]}
                    total={{ label: 'Open total', value: int(k.open_sessions) }}
                    href="/casino/evidence?domain=session" hrefLabel="View session evidence" />

                  <PostureSummaryCard title="Gaming Machines & Endpoints" reconciled={machinesOk}
                    rows={[
                      { label: 'In play', value: int(k.machines_in_play), color: 'text-indigo-600', barColor: 'bg-indigo-500', segment: n(k.machines_in_play) },
                      { label: 'Stale', value: int(k.machines_stale), color: 'text-muted-foreground', barColor: 'bg-slate-300', segment: n(k.machines_stale) },
                    ]}
                    total={{ label: 'Allocated', value: int(k.active_machines) }}
                    note="Physical machines & online/simulated endpoints"
                    href="/casino/evidence?domain=machine" hrefLabel="View endpoint evidence" />
                </div>

                {/* 4. Secondary intelligence row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Risk Overview */}
                  <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Risk Overview</h3>
                      <ReconciliationBadge ok={riskOk} label="Risk population reconciled" />
                    </div>
                    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                      {RISK.map((r) => <div key={r.label} className={r.bar} style={{ width: `${(r.val / (riskSum || 1)) * 100}%` }} />)}
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {RISK.map((r) => (
                        <Link key={r.label} href={r.href} className="text-center rounded-lg py-1.5 hover:bg-muted/50 transition-colors">
                          <div className={`text-lg font-bold tabular-nums ${r.color}`}>{available ? int(r.val) : '—'}</div>
                          <div className="text-[10px] text-muted-foreground">{r.label}</div>
                        </Link>
                      ))}
                    </div>
                    <Link href="/casino/players" className="text-[11px] font-medium text-primary hover:underline mt-auto">View Player Risk Monitor →</Link>
                  </div>

                  {/* Financial Posture */}
                  <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Financial Posture</h3>
                      <span className="text-[10px] text-muted-foreground/70">GGR = settled stakes − player winnings</span>
                    </div>
                    <div className="space-y-1.5">
                      {FIN.map(([label, val]) => (
                        <div key={label} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-semibold tabular-nums text-emerald-700">{financial ? money0(val) : '—'}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between border-t pt-2">
                      {/* Honest freshness state (§12.4): "Certified" only when FRESH;
                          otherwise Partial/Stale/Unavailable — never a stale certified claim. */}
                      <span className="text-[11px] text-muted-foreground">
                        {financial ? `${finLabel} · ${financial.containsSyntheticData ? 'Synthetic · ' : ''}${String(financial.currency ?? 'ZAR')}` : 'Unavailable'}
                      </span>
                      <Link href="/casino/evidence?domain=financial" className="text-[11px] font-medium text-primary hover:underline">View financial evidence →</Link>
                    </div>
                  </div>
                </div>

                {/* Integrity detail — shown, never silently corrected (Constitution §8) */}
                {available && !recon.ok && (
                  <div className="bg-destructive/5 border border-destructive/40 rounded-xl p-4 text-sm">
                    <div className="flex items-center gap-2 font-medium text-destructive"><CircleAlert className="h-4 w-4" /> Reconciliation discrepancy detected</div>
                    <ul className="mt-2 space-y-1 text-muted-foreground">
                      {recon.checks.filter((c) => !c.ok).map((c) => (
                        <li key={c.name} className="font-mono text-xs">{c.name}: expected {c.expected}, got {c.actual}</li>
                      ))}
                    </ul>
                    <Link href="/admin/audit" className="text-xs underline mt-2 inline-block">Open Audit Centre →</Link>
                  </div>
                )}

                {/* Provenance footer */}
                <div className="text-[11px] text-muted-foreground/70 border-t pt-3 flex flex-wrap gap-x-4 gap-y-1">
                  <span>Source: certified Consumer Platform (live-floor)</span>
                  <span className="inline-flex items-center gap-1">Snapshot: <SnapshotAge asOf={kpi?.source_as_of} staleAfterSeconds={DEFAULT_FINANCIAL_STALE_AFTER_SECONDS} /></span>
                  <span>Status: {loadFailed ? 'Unavailable' : recon.ok ? 'Healthy' : 'Degraded (reconciliation)'}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </DashboardLayout>
    </CasinoAdminGuard>
  );
}
