'use client';

// ─── Operator Dashboard (v1.6 reconciliation audit) ──────────────────────────
// A pure, READ-ONLY CONSUMER of the certified Consumer Platform. Every value
// comes from consumer-gateway views (live-floor + summary) — the SAME source as
// the Live Casino Feed, Explainability and Cases. No table is read directly and
// nothing is recomputed here: the page validates the projected KPI for internal
// consistency (reconcileOperatorKpi) and displays an honest data-integrity /
// unavailable state rather than disguising missing or inconsistent data.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/DashboardLayout';
import { CasinoAdminGuard } from '@/components/CasinoAdminGuard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { cgGet } from '@/lib/consumerClient';
import { reconcileOperatorKpi, type ReconciliationResult } from '@/lib/consumerPlatform/integrity';
import type { LiveKpiView, FinancialPostureView } from '@/lib/consumerPlatform/contracts';
import {
  LayoutDashboard, Users, ShieldAlert, TrendingUp, RefreshCw, Gauge, Lightbulb,
  Briefcase, Activity, CircleAlert, CircleCheck, HelpCircle,
} from 'lucide-react';

type Rec = Record<string, unknown>;
const n = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0)) || 0;
// South African currency formatting: space thousands, dot decimals; negatives
// as "-R 340.00" (e.g. "R 1 250 430.75", "-R 340.00").
const money = (v: unknown) => {
  const x = n(v);
  const s = Math.abs(x).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (x < 0 ? '-R ' : 'R ') + s;
};
const FIN_PERIODS = [
  ['Current shift', 'ggrCurrentShift', 'stakesCurrentShift', 'playerWinningsCurrentShift'],
  ['Today', 'ggrToday', 'stakesToday', 'playerWinningsToday'],
  ['Last 24 hours', 'ggrLast24Hours', 'stakesLast24Hours', 'playerWinningsLast24Hours'],
  ['Month to date', 'ggrMonthToDate', 'stakesMonthToDate', 'playerWinningsMonthToDate'],
] as const;

// Honest cell: a real value, or an em-dash when the certified value is
// unavailable — a false 0 is never shown for missing data.
function cell(available: boolean, value: string | number) {
  return available ? value : '—';
}

function Stat({ label, value, sub, icon, tone, href }: {
  label: string; value: string | number; sub?: string; icon: JSX.Element; tone?: string; href?: string;
}) {
  const body = (
    <Card className={href ? 'transition-colors hover:border-primary/40' : ''}>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between">
          <div>
            <div className={`text-3xl font-semibold tabular-nums ${tone ?? ''}`}>{value}</div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mt-1">{label}</div>
            {sub && <div className="text-[11px] text-muted-foreground/70 mt-0.5">{sub}</div>}
          </div>
          <div className="text-muted-foreground/50">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function DataStatusBadge({ recon, unavailable }: { recon: ReconciliationResult; unavailable: boolean }) {
  if (unavailable) {
    return <Badge variant="outline" className="gap-1 border-muted-foreground/40 text-muted-foreground"><HelpCircle className="h-3 w-3" /> Data unavailable</Badge>;
  }
  if (!recon.ok) {
    return <Badge variant="destructive" className="gap-1"><CircleAlert className="h-3 w-3" /> Data integrity warning</Badge>;
  }
  return <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-600"><CircleCheck className="h-3 w-3" /> Reconciled · Healthy</Badge>;
}

export default function OperatorDashboardPage() {
  const { user } = useAuth();
  const casinoId = (user as unknown as Rec)?.casino_id as string | undefined;
  const [floor, setFloor] = useState<Rec | null>(null);
  const [summary, setSummary] = useState<Rec | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [finPeriod, setFinPeriod] = useState(1); // index into FIN_PERIODS; default Today

  const refresh = useCallback(async () => {
    setLoading(true);
    const [f, s] = await Promise.all([
      cgGet('live-floor', { casino_id: casinoId }),
      cgGet('summary', { casino_id: casinoId }),
    ]);
    setFloor(f); setSummary(s);
    setLoadFailed(f == null);
    setLoading(false);
  }, [casinoId]);

  useEffect(() => { refresh(); }, [refresh]);

  const kpi = (floor?.kpi ?? null) as LiveKpiView | null;
  const financial = (floor?.financial ?? null) as FinancialPostureView | null;
  const players = (floor?.players ?? []) as Rec[];
  const interventions = (floor?.interventions ?? []) as Rec[];
  const decisions = (summary?.headlineDecisions ?? []) as Rec[];
  const topPlayers = [...players].sort((a, b) => n(b.riskScore) - n(a.riskScore)).slice(0, 8);

  // Read-only reconciliation of the projected KPI (never recomputed here).
  const recon = reconcileOperatorKpi(kpi);
  const available = !loadFailed && kpi != null;
  const snapshotAt = kpi?.snapshot_at ? new Date(kpi.snapshot_at).toLocaleString('en-ZA') : null;

  // Risk posture: the five bands that must reconcile to active players.
  const RISK_BANDS: [string, keyof LiveKpiView, string, string][] = [
    ['Critical', 'risk_critical', 'text-red-600', '/casino/evidence?domain=player&risk=critical'],
    ['High', 'risk_high', 'text-orange-600', '/casino/evidence?domain=player&risk=high'],
    ['Medium', 'risk_medium', 'text-amber-600', '/casino/evidence?domain=player&risk=medium'],
    ['Low', 'risk_low', 'text-emerald-600', '/casino/evidence?domain=player&risk=low'],
    ['Unclassified', 'risk_unclassified', 'text-muted-foreground', '/casino/evidence?domain=player&risk=unclassified'],
  ];
  const bandSum = kpi ? RISK_BANDS.reduce((s, [, k]) => s + n(kpi[k]), 0) : 0;

  return (
    <CasinoAdminGuard>
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2"><LayoutDashboard className="h-6 w-6" /> Operator Dashboard</h1>
              <p className="text-muted-foreground">Live floor posture — every value served by the certified Consumer Platform.</p>
            </div>
            <div className="flex items-center gap-2">
              <DataStatusBadge recon={recon} unavailable={loadFailed} />
              <Button variant="outline" onClick={refresh} disabled={loading}><RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh</Button>
            </div>
          </div>

          {/* Data-integrity warning — shown, never silently corrected (Constitution §8). */}
          {!loading && available && !recon.ok && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="pt-4 text-sm">
                <div className="flex items-center gap-2 font-medium text-destructive"><CircleAlert className="h-4 w-4" /> Reconciliation discrepancy detected</div>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  {recon.checks.filter((c) => !c.ok).map((c) => (
                    <li key={c.name} className="font-mono text-xs">{c.name}: expected {c.expected}, got {c.actual} — {c.detail}</li>
                  ))}
                </ul>
                <Link href="/admin/audit" className="text-xs underline mt-2 inline-block">Open Audit Centre →</Link>
              </CardContent>
            </Card>
          )}

          {loadFailed && !loading && (
            <Card className="border-muted-foreground/30">
              <CardContent className="pt-4 text-sm text-muted-foreground flex items-center gap-2">
                <HelpCircle className="h-4 w-4" /> The certified Consumer Platform snapshot is currently unavailable. Values are shown as “—”, not zero.
              </CardContent>
            </Card>
          )}

          {/* ── Live floor posture ─────────────────────────────────────────── */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Live floor posture</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Players active now" value={cell(available, n(kpi?.players_active_now))} sub={available ? `${n(kpi?.active_players)} observed` : undefined} icon={<Users className="h-8 w-8" />} href="/casino/players" />
              <Stat label="Active sessions" value={cell(available, n(kpi?.active_sessions))} sub="fresh — recent activity" icon={<Activity className="h-8 w-8" />} href="/casino/live-feed" />
              <Stat label="Machines / endpoints in play" value={cell(available, n(kpi?.machines_in_play))} sub={available ? `${n(kpi?.registered_machines)} registered` : undefined} icon={<Gauge className="h-8 w-8" />} href="/casino/operations" />
              <Stat
                label={`GGR — ${FIN_PERIODS[finPeriod][0].toLowerCase()}`}
                value={financial ? money(financial[FIN_PERIODS[finPeriod][1]]) : '—'}
                sub={financial ? `${financial.currency} · certified` : 'financial data unavailable'}
                icon={<TrendingUp className="h-8 w-8" />} href="/casino/evidence?domain=financial" />
            </div>
          </section>

          {/* ── Player activity posture (active_now + idle + stale = observed) ── */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Player activity posture</h2>
              {available && (
                <span className="text-xs text-muted-foreground">{n(kpi?.active_players)} observed · freshness-classified</span>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {([
                ['Active now', 'players_active_now', 'text-emerald-600'],
                ['Idle', 'players_idle', 'text-amber-600'],
                ['Stale', 'players_stale', 'text-muted-foreground'],
                ['Observed', 'active_players', ''],
              ] as [string, keyof LiveKpiView, string][]).map(([label, key, tone]) => (
                <Link key={key} href="/casino/evidence?domain=player">
                  <Card className="transition-colors hover:border-primary/40">
                    <CardContent className="pt-4 flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <span className={`text-xl font-semibold ${tone}`}>{cell(available, n(kpi?.[key]))}</span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>

          {/* ── Machine posture (in play + stale = active; registered total) ─── */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Gaming machines &amp; endpoints</h2>
              {available && (
                <span className="text-xs text-muted-foreground">physical machines &amp; online/simulated endpoints · offline / faulted not in certified telemetry</span>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {([
                ['Registered', 'registered_machines', ''],
                ['In play', 'machines_in_play', 'text-emerald-600'],
                ['Stale', 'machines_stale', 'text-muted-foreground'],
                ['Allocated (active)', 'active_machines', ''],
              ] as [string, keyof LiveKpiView, string][]).map(([label, key, tone]) => (
                <Link key={key} href="/casino/evidence?domain=machine">
                  <Card className="transition-colors hover:border-primary/40">
                    <CardContent className="pt-4 flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <span className={`text-xl font-semibold ${tone}`}>{cell(available, n(kpi?.[key]))}</span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>

          {/* ── Session posture (active + idle + stale = open) ─────────────── */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Session posture</h2>
              {available && (
                <span className="text-xs text-muted-foreground">
                  {n(kpi?.active_sessions) + n(kpi?.idle_sessions) + n(kpi?.stale_sessions)} open · timeout-policy classified
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {([
                ['Active (fresh)', 'active_sessions', 'text-emerald-600', '/casino/evidence?domain=session&posture=active'],
                ['Idle', 'idle_sessions', 'text-amber-600', '/casino/evidence?domain=session&posture=idle'],
                ['Stale', 'stale_sessions', 'text-muted-foreground', '/casino/evidence?domain=session&posture=stale'],
                ['Open total', 'open_sessions', '', '/casino/evidence?domain=session'],
              ] as [string, keyof LiveKpiView, string, string][]).map(([label, key, tone, href]) => (
                <Link key={key} href={href}>
                  <Card className="transition-colors hover:border-primary/40">
                    <CardContent className="pt-4 flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <span className={`text-xl font-semibold ${tone}`}>{cell(available, n(kpi?.[key]))}</span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>

          {/* ── Financial posture (certified, period-scoped GGR) ───────────── */}
          <section className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Financial posture</h2>
              <div className="flex items-center gap-1">
                {FIN_PERIODS.map(([label], i) => (
                  <button key={label} onClick={() => setFinPeriod(i)}
                    className={`text-[11px] px-2 py-1 rounded border ${finPeriod === i ? 'bg-primary/10 border-primary/40 text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {!financial && !loading && (
              <Card className="border-muted-foreground/30"><CardContent className="pt-4 text-sm text-muted-foreground flex items-center gap-2">
                <HelpCircle className="h-4 w-4" /> No certified financial evidence for this scope — GGR is shown as “—”, not R 0.00.
              </CardContent></Card>
            )}
            {financial && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Stat label={`GGR — ${FIN_PERIODS[finPeriod][0].toLowerCase()}`} value={money(financial[FIN_PERIODS[finPeriod][1]])} sub={`${financial.currency} · GGR = stakes − winnings`} icon={<TrendingUp className="h-8 w-8" />} />
                  <Stat label="Stakes" value={money(financial[FIN_PERIODS[finPeriod][2]])} sub="selected period" icon={<TrendingUp className="h-8 w-8" />} />
                  <Stat label="Player winnings" value={money(financial[FIN_PERIODS[finPeriod][3]])} sub="selected period" icon={<TrendingUp className="h-8 w-8" />} />
                  <Stat label="Settled bets today" value={n(financial.settledBetsToday)}
                    sub={`voids ${financial.voidsSupported ? String(financial.voidedBetsToday ?? '—') : 'not supported'} · reversals ${financial.reversalsSupported ? String(financial.reversedTransactionsToday ?? '—') : 'not supported'}`}
                    icon={<Activity className="h-8 w-8" />} />
                </div>
                {financial.containsSyntheticData && (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-2">
                    <CircleAlert className="h-3.5 w-3.5" />
                    {financial.dataMode === 'synthetic' ? 'Synthetic demo data' : 'Mixed demo + live data'} — {financial.syntheticEventCount} synthetic · {financial.nonSyntheticEventCount} live event(s). Not real casino financial performance.
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {FIN_PERIODS.map(([label, key]) => (
                    <Card key={label}><CardContent className="pt-4 flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <span className={`text-lg font-semibold tabular-nums ${n(financial[key]) < 0 ? 'text-red-600' : ''}`}>{money(financial[key])}</span>
                    </CardContent></Card>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground/70">
                  Certified from the immutable financial event log · {financial.currency} · {financial.timezone} · status <span className="font-medium">{financial.status}</span> · mode {financial.dataMode} · source: {financial.combinedWagerSettlement ? 'combined wager+settlement' : 'separate settlement'} (cap v{financial.capabilityVersion}) · as at {new Date(financial.snapshotAt).toLocaleString('en-ZA')}
                </p>
              </>
            )}
          </section>

          {/* ── Player-risk posture (must reconcile to active players) ──────── */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Player-risk posture</h2>
              {available && (
                <span className="text-xs text-muted-foreground">
                  {bandSum} classified · {n(kpi?.active_players)} active {recon.ok ? '· reconciled' : '· mismatch'}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {RISK_BANDS.map(([label, key, tone, href]) => (
                <Link key={key} href={href}>
                  <Card className="transition-colors hover:border-primary/40">
                    <CardContent className="pt-4 flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <span className={`text-xl font-semibold ${tone}`}>{cell(available, n(kpi?.[key]))}</span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Highest-risk players</CardTitle>
                <CardDescription>Derived Intelligence · from the certified live-floor view</CardDescription></CardHeader>
              <CardContent className="space-y-1">
                {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
                {!loading && topPlayers.length === 0 && <p className="text-sm text-muted-foreground">{available ? 'No active players.' : 'Data unavailable.'}</p>}
                {topPlayers.map((p) => (
                  <div key={String(p.id)} className="flex items-center justify-between text-sm border-b py-1.5 last:border-0">
                    <span className="font-mono text-xs truncate max-w-[14rem]">{String(p.playerId)}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground">{String(p.game)}</span>
                      <Badge variant={p.riskLevel === 'critical' || p.riskLevel === 'high' ? 'destructive' : 'secondary'}>{n(p.riskScore)}</Badge>
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Recent interventions & decisions</CardTitle>
                <CardDescription>Recorded Fact / Policy Decision</CardDescription></CardHeader>
              <CardContent className="space-y-1">
                {interventions.slice(0, 4).map((i, idx) => (
                  <div key={idx} className="text-sm border-b py-1.5 last:border-0">
                    <span className="font-mono text-xs">{String(i.playerId)}</span> — {String(i.reason)} <Badge variant="outline" className="text-[10px]">recorded</Badge>
                  </div>
                ))}
                {decisions.slice(0, 4).map((d, idx) => (
                  <div key={'d' + idx} className="text-sm border-b py-1.5 last:border-0">
                    <Badge variant="outline" className="text-[10px] mr-1">{String(d.policyReference ?? d.policyId)}</Badge>{String(d.action)} — {String(d.reason)}
                  </div>
                ))}
                {interventions.length === 0 && decisions.length === 0 && !loading && <p className="text-sm text-muted-foreground">No interventions or decisions on record.</p>}
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link href="/casino/players"><Users className="h-4 w-4 mr-1" /> Player Risk Monitor</Link></Button>
            <Button asChild variant="outline"><Link href="/casino/explainability"><Lightbulb className="h-4 w-4 mr-1" /> Explainable Intelligence</Link></Button>
            <Button asChild variant="outline"><Link href="/casino/cases"><Briefcase className="h-4 w-4 mr-1" /> Case Management</Link></Button>
            <Button asChild variant="outline"><Link href="/casino/operations"><Gauge className="h-4 w-4 mr-1" /> Executive Operations</Link></Button>
          </div>

          {/* ── Data provenance & freshness ────────────────────────────────── */}
          <div className="text-[11px] text-muted-foreground/70 border-t pt-3 flex flex-wrap gap-x-4 gap-y-1">
            <span>Source: certified Consumer Platform (live-floor · summary)</span>
            <span>Snapshot: {snapshotAt ?? '—'}</span>
            <span>Scope: {casinoId ? `casino ${String(casinoId).slice(0, 8)}…` : '—'}</span>
            <span>Status: {loadFailed ? 'Unavailable' : recon.ok ? 'Healthy' : 'Degraded (reconciliation)'}</span>
          </div>
        </div>
      </DashboardLayout>
    </CasinoAdminGuard>
  );
}
