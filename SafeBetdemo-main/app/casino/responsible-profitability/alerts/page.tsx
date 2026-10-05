'use client';

// ── Responsible Profitability B3 — Protection Alerts (B4.1) ───────────────────
// Operator-local, own-casino protection-alert workflow: deterministic evaluation,
// then a governed OPEN → ACKNOWLEDGED → RESOLVED lifecycle. Consumes the governed
// API only (no direct table access). Shows ONLY governed evidence — never a diagnosis,
// probability, raw risk score, causal/effectiveness claim, trajectory, or cross-operator data.

import { useCallback, useEffect, useRef, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { CasinoAdminGuard } from '@/components/CasinoAdminGuard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RpTabs } from '@/components/responsibleProfitability/shared';
import { ProtectionActionTrace } from '@/components/responsibleProfitability/ProtectionActionTrace';
import { AlertWorkloadPanel } from '@/components/responsibleProfitability/WorkloadPanels';
import { readAccessTokenFast, supabase } from '@/lib/supabase';
import { ALERT_RULES, type AlertType, type AlertStatus, type ProtectionAlertView } from '@/lib/responsibleProfitability/alerts';
import { ShieldAlert, RefreshCw, Play, Check, CheckCheck, Info, Clock } from 'lucide-react';

const STATUS_TABS: (AlertStatus | 'ALL')[] = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'ALL'];
const STATUS_LABEL: Record<string, string> = { OPEN: 'Open', ACKNOWLEDGED: 'Acknowledged', RESOLVED: 'Resolved', ALL: 'All' };

async function token(): Promise<string | null> {
  let t = readAccessTokenFast();
  if (!t) t = (await supabase.auth.getSession()).data.session?.access_token ?? null;
  return t;
}

function ts(v: string | null): string {
  if (!v) return '—';
  try { return new Date(v).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' }); } catch { return v; }
}

/** Governed evidence rendering — only the source-derived keys the DB wrote. */
function Evidence({ a }: { a: ProtectionAlertView }) {
  const e = a.evidence ?? {};
  if (a.alert_type === 'SELF_EXCLUSION_BREACH_REVIEW') {
    const bc = (e as { breach_count?: number | null }).breach_count;
    return (
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Self-exclusion status: <span className="font-medium text-foreground">{String((e as { self_exclusion_status?: string }).self_exclusion_status ?? 'breached')}</span></span>
        <span>Breach count: <span className="font-medium text-foreground">{bc === null || bc === undefined ? '—' : String(bc)}</span></span>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span>Follow-up due (SAST): <span className="font-medium text-foreground">{String((e as { follow_up_date?: string }).follow_up_date ?? '—')}</span></span>
    </div>
  );
}

export default function ProtectionAlertsPage() {
  const [status, setStatus] = useState<AlertStatus | 'ALL'>('OPEN');
  const [alerts, setAlerts] = useState<ProtectionAlertView[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const gen = useRef(0);

  const load = useCallback(async () => {
    const g = ++gen.current;
    setLoading(true); setUnavailable(false);
    const t = await token();
    if (g !== gen.current) return;
    if (!t) { setUnavailable(true); setLoading(false); return; }
    try {
      const qs = status === 'ALL' ? '' : `?status=${status}`;
      const res = await fetch(`/api/casino/protection-alerts${qs}`, { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' });
      if (g !== gen.current) return;
      if (!res.ok) { setUnavailable(true); setAlerts([]); setLoading(false); return; }
      const b = await res.json();
      if (g !== gen.current) return;
      setAlerts((b?.alerts ?? []) as ProtectionAlertView[]);
      setLoading(false);
    } catch { if (g === gen.current) { setUnavailable(true); setLoading(false); } }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const evaluate = useCallback(async () => {
    setEvaluating(true); setNotice(null);
    const t = await token();
    if (!t) { setUnavailable(true); setEvaluating(false); return; }
    try {
      const res = await fetch('/api/casino/protection-alerts/evaluate', { method: 'POST', headers: { Authorization: `Bearer ${t}` } });
      if (res.ok) {
        const b = await res.json();
        setNotice(`Evaluation complete — ${b.created} new, ${b.alreadyPresent} already present, ${b.evaluated} eligible source rows reviewed.`);
      } else { setNotice('Evaluation is currently unavailable.'); }
    } catch { setNotice('Evaluation is currently unavailable.'); }
    setEvaluating(false);
    await load();
  }, [load]);

  const act = useCallback(async (id: string, action: 'acknowledge' | 'resolve') => {
    setBusyId(id);
    const t = await token();
    if (!t) { setUnavailable(true); setBusyId(null); return; }
    try {
      await fetch(`/api/casino/protection-alerts/${id}/${action}`, { method: 'POST', headers: { Authorization: `Bearer ${t}` } });
    } catch { /* surfaced by reload */ }
    setBusyId(null);
    await load();
  }, [load]);

  return (
    <CasinoAdminGuard>
      <DashboardLayout>
        <div className="space-y-6 p-4 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-semibold">
                <ShieldAlert className="h-6 w-6 text-amber-600" /> Protection Alerts
              </h1>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Operator-local signals for your casino that require human review. An alert is an operational signal —
                not a diagnosis, proof of harm, effectiveness claim, or an instruction to exclude or enforce.
                Rule set v{ALERT_RULES.SELF_EXCLUSION_BREACH_REVIEW.version}.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={evaluate} disabled={evaluating}
                className="flex items-center gap-2 rounded-md border bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-60">
                <Play className={`h-4 w-4 ${evaluating ? 'animate-pulse' : ''}`} /> Evaluate alerts
              </button>
              <button onClick={load} className="rounded-md border p-2" aria-label="Refresh">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <RpTabs />

          <AlertWorkloadPanel />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex rounded-md border">
              {STATUS_TABS.map((s) => (
                <button key={s} onClick={() => setStatus(s)}
                  className={`px-3 py-1.5 text-sm ${status === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            <Badge variant="secondary" className="font-normal">Operational — own casino</Badge>
          </div>

          {notice && (
            <Card><CardContent className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
              <Info className="h-4 w-4" /> {notice}
            </CardContent></Card>
          )}

          {unavailable && (
            <Card><CardContent className="p-6 text-sm text-muted-foreground">
              This view is currently unavailable. It never displays estimated or fabricated alerts.
            </CardContent></Card>
          )}
          {loading && !unavailable && (
            <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading protection alerts…</CardContent></Card>
          )}

          {!loading && !unavailable && alerts.length === 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium"><Info className="h-4 w-4" /> No {status === 'ALL' ? '' : STATUS_LABEL[status].toLowerCase()} alerts</CardTitle>
                <CardDescription>Run “Evaluate alerts” to materialise any new governed signals for your casino. Absence of alerts is not a clearance of risk.</CardDescription>
              </CardHeader>
            </Card>
          )}

          <div className="space-y-3">
            {alerts.map((a) => {
              const rule = ALERT_RULES[a.alert_type as AlertType];
              return (
                <Card key={a.id}>
                  <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{rule?.label ?? a.alert_type}</span>
                        <Badge variant={a.status === 'OPEN' ? 'default' : a.status === 'ACKNOWLEDGED' ? 'secondary' : 'outline'}>
                          {STATUS_LABEL[a.status]}
                        </Badge>
                        <Badge variant="outline" className="font-normal">v{a.rule_version}</Badge>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> Generated {ts(a.generated_at)}
                        {a.acknowledged_at && <span>· Acknowledged {ts(a.acknowledged_at)}</span>}
                        {a.resolved_at && <span>· Resolved {ts(a.resolved_at)}</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Player reference: <span className="font-mono text-foreground" title={a.player_id}>…{a.player_id.slice(-8)}</span>
                        <span className="ml-1">(resolve full detail via your governed player view)</span>
                      </div>
                      <Evidence a={a} />
                      <ProtectionActionTrace alertId={a.id} token={token} />
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {a.status === 'OPEN' && (
                        <button onClick={() => act(a.id, 'acknowledge')} disabled={busyId === a.id}
                          className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm disabled:opacity-60">
                          <Check className="h-4 w-4" /> Acknowledge
                        </button>
                      )}
                      {(a.status === 'OPEN' || a.status === 'ACKNOWLEDGED') && (
                        <button onClick={() => act(a.id, 'resolve')} disabled={busyId === a.id}
                          className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm disabled:opacity-60">
                          <CheckCheck className="h-4 w-4" /> Resolve
                        </button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground">
            Alerts are governed operational signals for human review within your own casino. Cross-operator federation is off;
            no cross-operator data is shown. Acknowledgement and resolution are recorded in the tamper-evident audit chain.
          </p>
        </div>
      </DashboardLayout>
    </CasinoAdminGuard>
  );
}
