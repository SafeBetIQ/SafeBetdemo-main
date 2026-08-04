'use client';

// Super-Admin-only Demo Simulation Health panel. Reads the certified governance
// views via /api/admin/simulation-health (which is itself gated to super_admin +
// demo env). Shows overall status, event-volume vs limits, storage, partition
// readiness, showcase state, emergency-disable state, open alerts, and a
// six-casino operational table. Read-only — no controls are exposed here.

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Activity, TriangleAlert as AlertTriangle, HardDrive, Layers, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SnapshotAge } from '@/components/SnapshotAge';

type Health = {
  ok: boolean; as_of: string;
  overall: Record<string, unknown> | null;
  casinos: Array<Record<string, unknown>>;
  usage: Record<string, unknown> | null;
  storage: Record<string, unknown> | null;
  readiness: { ok?: boolean; required?: string[]; missing?: string[]; insecure?: string[] } | null;
  alerts: Array<{ category: string; severity: string; scope: string | null; created_at: string }>;
  emergency: { simulator_enabled: boolean; showcase_enabled: boolean };
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

export function DemoSimulationHealth() {
  const [data, setData] = useState<Health | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) { setErr('Not authenticated'); setLoading(false); return; }
      const res = await fetch('/api/admin/simulation-health', {
        headers: { authorization: `Bearer ${token}` }, cache: 'no-store',
      });
      if (res.status === 404) { setErr('unavailable'); setLoading(false); return; }
      if (!res.ok) { setErr('Unable to load simulation health'); setLoading(false); return; }
      setData(await res.json()); setErr(null);
    } catch { setErr('Unable to load simulation health'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  if (err === 'unavailable') return null; // not a demo env
  if (loading && !data) return <Card><CardContent className="py-6 text-sm text-muted-foreground">Loading Demo simulation health…</CardContent></Card>;
  if (err) return <Card><CardContent className="py-6 text-sm text-muted-foreground">{err}</CardContent></Card>;
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Demo Simulation Health {classBadge(overall)}
        </h3>
        <SnapshotAge asOf={data.as_of} staleAfterSeconds={90} />
      </div>

      {/* Top status tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label="Simulator" value={data.emergency.simulator_enabled ? 'Enabled' : 'Disabled'}
          sub={`Showcase ${data.emergency.showcase_enabled ? 'on' : 'off'} · cron ${o['cron_active'] ? 'active' : 'inactive'}`}
          urgent={!data.emergency.simulator_enabled} />
        <Tile label="Last successful tick" value={o['last_successful_tick'] ? new Date(String(o['last_successful_tick'])).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
          sub={o['tick_late'] ? 'LATE' : 'on schedule'} urgent={!!o['tick_late']} />
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
            <Row k="This month" v={N(u['events_month']).toLocaleString()} />
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
