'use client';

// Super-Admin-only Demo Simulation Health panel. Reads the certified governance
// views via /api/admin/simulation-health (which is itself gated to super_admin +
// demo env). Shows overall status, event-volume vs limits, storage, partition
// readiness, showcase state, emergency-disable state, open alerts, and a
// six-casino operational table. Read-only — no controls are exposed here.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Activity, TriangleAlert as AlertTriangle, HardDrive, Layers, Clock, RefreshCw } from 'lucide-react';
import { supabase, readAccessTokenFast } from '@/lib/supabase';
import { SnapshotAge } from '@/components/SnapshotAge';
import { slowMessage, showRetryAt, shouldPoll } from '@/lib/demoSimHealthClient';

type Health = {
  ok: boolean; as_of: string;
  overall: Record<string, unknown> | null;
  casinos: Array<Record<string, unknown>>;
  usage: Record<string, unknown> | null;
  storage: Record<string, unknown> | null;
  readiness: { ok?: boolean; required?: string[]; missing?: string[]; insecure?: string[] } | null;
  alerts: Array<{ category: string; severity: string; scope: string | null; created_at: string }>;
  emergency: { simulator_enabled: boolean; showcase_enabled: boolean };
  financial_rollup?: Record<string, unknown> | null;
};

const N = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0));
const S = (v: unknown) => (v == null ? '—' : String(v));

function classBadge(state: string) {
  const s = state.toLowerCase();
  const cls = s === 'healthy' ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
    : s === 'warning' ? 'bg-amber-100 text-amber-800 border-amber-200'
    : s === 'critical' ? 'bg-red-100 text-red-800 border-red-200'
    : s === 'disabled' ? 'bg-slate-200 text-slate-700 border-slate-300'
    : 'bg-slate-100 text-slate-600 border-slate-200';
  return <Badge variant="outline" className={cls}>{state}</Badge>;
}

const POLL_MS = 30000;

export function DemoSimulationHealth() {
  const [data, setData] = useState<Health | null>(null);
  const [phase, setPhase] = useState<'verifying' | 'loading' | 'ready' | 'error' | 'unavailable'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [slow, setSlow] = useState(0);                 // 0 | 5 | 10 | 15 (seconds elapsed on first load)
  const [correlationId, setCorrelationId] = useState<string | null>(null);
  const inflight = useRef<AbortController | null>(null);
  const firstDone = useRef(false);

  const load = useCallback(async (opts?: { fresh?: boolean; isRefresh?: boolean }) => {
    inflight.current?.abort();                           // never duplicate an in-flight request
    const ac = new AbortController();
    inflight.current = ac;
    const cid = crypto.randomUUID();
    if (opts?.isRefresh) setRefreshing(true);
    else if (!firstDone.current) setPhase('loading');
    let timers: ReturnType<typeof setTimeout>[] = [];
    if (!firstDone.current) {                            // staged slow-load messaging (first load only)
      setSlow(0);
      timers = [setTimeout(() => setSlow(5), 5000), setTimeout(() => setSlow(10), 10000), setTimeout(() => setSlow(15), 15000)];
    }
    const endpoint = `/api/admin/simulation-health${opts?.fresh ? '?fresh=1' : ''}`;
    const call = (t: string) => fetch(endpoint, { headers: { authorization: `Bearer ${t}` }, cache: 'no-store', signal: ac.signal });
    try {
      // Lock-free token from the persisted session — do NOT wait on AuthContext or
      // getSession() (both contend the auth-token lock ~10-20s on first paint).
      let token = readAccessTokenFast();
      let res = token ? await call(token) : null;
      if (!res || res.status === 401) {
        // Missing/stale token (rare): refresh via getSession once, then retry.
        const { data: sess } = await supabase.auth.getSession();
        token = sess.session?.access_token ?? null;
        if (!token) { if (!firstDone.current) { setPhase('error'); setCorrelationId(cid); } return; }
        res = await call(token);
      }
      if (res.status === 404 || res.status === 403) { setPhase('unavailable'); return; } // not demo / not super-admin
      if (!res.ok) { if (!firstDone.current) { setPhase('error'); setCorrelationId(cid); } return; }
      const json = (await res.json()) as Health;
      setData(json); setPhase('ready'); setCorrelationId(null); firstDone.current = true;
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;   // superseded — keep prior data
      if (!firstDone.current) { setPhase('error'); setCorrelationId(cid); }
    } finally {
      timers.forEach(clearTimeout);
      setRefreshing(false);
    }
  }, []);

  // Start IMMEDIATELY on mount (the required client state — a persisted token — is
  // available synchronously). Poll AFTER the first load: one timer, paused when the
  // tab is hidden, in-flight aborted, cancelled on unmount. The server enforces role.
  useEffect(() => {
    load();
    const interval = setInterval(() => {
      if (shouldPoll(document.hidden, firstDone.current)) load({ isRefresh: true });
    }, POLL_MS);
    const onVis = () => { if (!document.hidden && firstDone.current) load({ isRefresh: true }); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVis);
      inflight.current?.abort();
    };
  }, [load]);

  if (phase === 'unavailable') return null;              // not a demo env / not super-admin (API is the authority)

  // Structured skeleton + staged status while first load / verifying.
  if (!data && (phase === 'verifying' || phase === 'loading')) {
    return <HealthSkeleton message={slowMessage(phase, slow)} showRetry={showRetryAt(slow)} onRetry={() => load({ fresh: true })} />;
  }
  if (!data && phase === 'error') {
    return (
      <Card>
        <CardContent className="py-6 space-y-3">
          <p className="text-sm text-muted-foreground">Demo Simulation Health could not be loaded.</p>
          {correlationId && <p className="text-[11px] text-muted-foreground/70">Reference: {correlationId}</p>}
          <Button size="sm" variant="outline" onClick={() => load({ fresh: true })}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }
  if (!data) return null;

  const o = data.overall ?? {};
  const u = data.usage ?? {};
  const st = data.storage ?? {};
  const rd = data.readiness ?? {};
  const overall = S(o['overall_health'] ?? 'Unknown');
  const dayPct = N(o['pct_of_daily_hardstop']);
  const missing = (rd.missing ?? []) as string[];
  const insecure = (rd.insecure ?? []) as string[];
  const partitionsOk = rd.ok !== false && missing.length === 0 && insecure.length === 0;
  const fmtTime = (v: unknown) => v ? new Date(String(v)).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
  // Next expected tick = last successful tick + the 5-minute cron interval.
  const nextTick = o['last_successful_tick'] ? new Date(new Date(String(o['last_successful_tick'])).getTime() + 5 * 60_000) : null;
  const estMonthly = N(u['est_daily_events']) * 30;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Demo Simulation Health {classBadge(overall)}
        </h3>
        <div className="flex items-center gap-2">
          {refreshing && <RefreshCw className="h-3 w-3 text-muted-foreground/60 animate-spin" aria-label="Refreshing" />}
          <SnapshotAge asOf={data.as_of} staleAfterSeconds={90} />
        </div>
      </div>

      {/* Top status tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label="Simulator" value={data.emergency.simulator_enabled ? 'Enabled' : 'Disabled'}
          sub={`Showcase ${data.emergency.showcase_enabled ? 'on' : 'off'} · cron ${o['cron_active'] ? 'active' : 'inactive'}`}
          urgent={!data.emergency.simulator_enabled} />
        <Tile label="Last successful tick" value={fmtTime(o['last_successful_tick'])}
          sub={`Next expected ~${nextTick ? fmtTime(nextTick.toISOString()) : '—'} · ${o['tick_late'] ? 'LATE' : 'on schedule'}`} urgent={!!o['tick_late']} />
        <Tile label="Events today" value={N(o['events_today']).toLocaleString()}
          sub={`${dayPct}% of hard limit (${N(o['day_hardstop_limit']).toLocaleString()})`} urgent={dayPct >= 100} warn={dayPct >= 62.5} />
        <Tile label="Active showcase windows" value={String(o['active_windows'] ?? 0)}
          sub={`${N(o['activations_1h'])} activations / hr`} />
      </div>

      {/* Volume / storage / partitions / integrity */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />Event volume</CardTitle></CardHeader>
          <CardContent className="text-xs space-y-1">
            <Row k="Last 15 min" v={N(u['events_15m']).toLocaleString()} />
            <Row k="Last hour" v={N(u['events_1h']).toLocaleString()} />
            <Row k="Est. daily" v={N(u['est_daily_events']).toLocaleString()} />
            <Row k="Est. monthly" v={estMonthly.toLocaleString()} />
            <Row k="This month" v={N(u['events_month']).toLocaleString()} />
            <Row k="Daily warning" v={N(u['day_warning_limit']).toLocaleString()} warn={N(o['events_today']) >= N(u['day_warning_limit'])} />
            <Row k="Daily hard limit" v={N(u['day_hardstop_limit']).toLocaleString()} bad={N(o['events_today']) >= N(u['day_hardstop_limit'])} />
            <Row k="Failures 24h" v={String(u['failures_24h'] ?? 0)} bad={N(u['failures_24h']) > 0} />
          </CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs flex items-center gap-1.5"><HardDrive className="h-3.5 w-3.5" />Storage</CardTitle></CardHeader>
          <CardContent className="text-xs space-y-1">
            <Row k="Database" v={S(st['db_size'])} />
            <Row k="Event log" v={S(st['event_log_size'])} />
            <Row k="Audit log" v={S(st['audit_size'])} />
            <Row k="Growth" v={`${S(st['est_daily_growth_mb'])} MB/day`} />
            <Row k="Of alloc" v={`${S(st['pct_of_internal_alloc'])}%`} warn={N(st['pct_of_internal_alloc']) >= N((o as Record<string, unknown>)['storage_pct']) && N(st['pct_of_internal_alloc']) >= 70} />
          </CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" />Partition readiness</CardTitle></CardHeader>
          <CardContent className="text-xs space-y-1">
            <Row k="Status" v={partitionsOk ? 'Ready' : 'Attention'} bad={!partitionsOk} />
            <Row k="Prepared" v={(rd.required ?? []).join(', ') || '—'} />
            {missing.length > 0 && <Row k="Missing" v={missing.join(', ')} bad />}
            {insecure.length > 0 && <Row k="Insecure" v={insecure.join(', ')} bad />}
          </CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" />Integrity</CardTitle></CardHeader>
          <CardContent className="text-xs space-y-1">
            <Row k="Reconciliations" v={o['reconciles_all'] ? 'Green' : 'Attention'} bad={o['reconciles_all'] === false} />
            <Row k="Projection lag" v={o['tick_late'] ? 'Late tick' : 'Current'} bad={!!o['tick_late']} />
            <Row k="Open alerts" v={String(o['open_alerts'] ?? 0)} bad={N(o['open_alerts']) > 0} />
            <Row k="Storage days left" v={o['storage_days_left'] != null ? String(o['storage_days_left']) : '—'} />
          </CardContent></Card>
      </div>

      {/* Financial rollup status */}
      {data.financial_rollup && (() => {
        const fr = data.financial_rollup as Record<string, unknown>;
        return (
          <Card>
            <CardHeader className="pb-1"><CardTitle className="text-xs flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />Financial rollup</CardTitle></CardHeader>
            <CardContent className="text-xs">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1">
                <Row k="Status" v={S(fr['freshness'])} bad={fr['freshness'] === 'Stale'} warn={fr['freshness'] === 'Delayed'} />
                <Row k="Enabled" v={fr['enabled'] ? `yes · cron ${fr['cron_active'] ? 'on' : 'off'}` : 'no'} bad={!fr['enabled']} />
                <Row k="Lag" v={`${S(fr['lag_seconds'])}s`} warn={N(fr['lag_seconds']) > 300} />
                <Row k="Buckets" v={N(fr['buckets']).toLocaleString()} />
                <Row k="Reconcile" v={fr['buckets_reconcile'] ? 'Green' : 'Attention'} bad={fr['buckets_reconcile'] === false} />
                <Row k="Version" v={`v${S(fr['rollup_version'])}`} />
                <Row k="Last run buckets" v={S(fr['last_run_buckets'])} />
                <Row k="Rollup alerts" v={S(fr['open_rollup_alerts'] ?? 0)} bad={N(fr['open_rollup_alerts']) > 0} />
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Open alerts */}
      {data.alerts.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader className="pb-1"><CardTitle className="text-xs flex items-center gap-1.5 text-amber-800"><AlertTriangle className="h-3.5 w-3.5" />Open alerts ({data.alerts.length})</CardTitle></CardHeader>
          <CardContent className="text-xs space-y-1">
            {data.alerts.slice(0, 8).map((a, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <span className="font-medium">{a.category}</span>
                <span className="text-muted-foreground">{a.severity} · {a.scope ?? '—'} · {new Date(a.created_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Six-casino operational table */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Per-casino simulation</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Casino</TableHead><TableHead>Profile</TableHead><TableHead className="text-right">Active now</TableHead>
                  <TableHead className="text-right">Target</TableHead><TableHead className="text-right">Observed</TableHead>
                  <TableHead className="text-right">Events 5m</TableHead><TableHead>Showcase expiry</TableHead><TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.casinos.map((c) => {
                  const profile = S(c['profile']);
                  const target = profile === 'showcase' ? N(c['showcase_active_target']) : N(c['baseline_active_target']);
                  return (
                    <TableRow key={S(c['casino_id'])}>
                      <TableCell className="font-medium">{S(c['casino_name'])}</TableCell>
                      <TableCell><Badge variant="outline" className={profile === 'showcase' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-600 border-slate-200'}>{profile}</Badge></TableCell>
                      <TableCell className="text-right font-semibold">{N(c['active_now']).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-muted-foreground">~{target}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{N(c['observed']).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{N(c['events_last_5m']).toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c['showcase_expiry'] ? new Date(String(c['showcase_expiry'])).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) : '—'}</TableCell>
                      <TableCell>{classBadge(S(c['status'] ?? 'unknown'))}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Structured skeleton that mirrors the real panel layout (overall bar, four
// tiles, four cards, six-casino table) with a staged status message.
function HealthSkeleton({ message, showRetry, onRetry }: { message: string; showRetry?: boolean; onRetry?: () => void }) {
  const blk = 'animate-pulse rounded bg-muted';
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Demo Simulation Health</span>
          <span className="text-xs text-muted-foreground">· {message}</span>
        </div>
        {showRetry && <Button size="sm" variant="outline" onClick={onRetry}><RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry</Button>}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardContent className="pt-3 pb-2 space-y-2"><div className={`${blk} h-3 w-20`} /><div className={`${blk} h-6 w-24`} /><div className={`${blk} h-2.5 w-28`} /></CardContent></Card>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {['Event volume', 'Storage', 'Partition readiness', 'Integrity'].map((t) => (
          <Card key={t}><CardHeader className="pb-1"><CardTitle className="text-xs">{t}</CardTitle></CardHeader>
            <CardContent className="space-y-1.5">{Array.from({ length: 5 }).map((_, i) => <div key={i} className={`${blk} h-2.5 w-full`} />)}</CardContent></Card>
        ))}
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Per-casino simulation</CardTitle></CardHeader>
        <CardContent className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className={`${blk} h-6 w-full`} />)}</CardContent>
      </Card>
    </div>
  );
}

function Tile({ label, value, sub, urgent, warn }: { label: string; value: string; sub?: string; urgent?: boolean; warn?: boolean }) {
  return (
    <Card className={urgent ? 'border-red-200 bg-red-50/40' : warn ? 'border-amber-200 bg-amber-50/40' : ''}>
      <CardContent className="pt-3 pb-2">
        <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
        <p className={`text-xl font-bold mt-0.5 ${urgent ? 'text-red-700' : warn ? 'text-amber-700' : ''}`}>{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function Row({ k, v, bad, warn }: { k: string; v: string; bad?: boolean; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span className={`font-medium ${bad ? 'text-red-600' : warn ? 'text-amber-600' : ''}`}>{v}</span>
    </div>
  );
}
