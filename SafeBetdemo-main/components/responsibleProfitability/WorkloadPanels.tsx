'use client';

// ── SafeBet IQ — B7 Workload & Follow-Up Assurance (operator UI panels) ───────
// Aggregate-only, own-casino. Separates CURRENT WORKLOAD (as-of now) from SELECTED
// PERIOD ACTIVITY. Occurrence/operational only — never follow-up completion, never
// intervention effectiveness, never SLA. Consumes the governed summary API only.

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { readAccessTokenFast, supabase } from '@/lib/supabase';
import { WORKLOAD_LINK_NEUTRAL_NOTE } from '@/lib/responsibleProfitability/workload';
import { CalendarClock, ClipboardList, Info, ShieldAlert, Link2 } from 'lucide-react';

type Summary = {
  scope: { casinoName: string | null };
  period: { start: string; endExclusive: string; timezone: string; maxRangeDays: number };
  currentWorkload: {
    interventions: { followUpRequiredCurrent: number; followUpRequiredButUndated: number; followUpDueToday: number; followUpOverdue: number; followUpFuture: number; maxDaysOverdue: number | null };
    alerts: { openAlerts: number; acknowledgedAlerts: number; oldestOpenAgeDays: number | null; oldestAcknowledgedAgeDays: number | null };
    traceability: { linkDenominator: string; alertsWithActiveInterventionLink: number; alertsWithoutActiveInterventionLink: number; activeTraceabilityLinks: number };
  };
  periodActivity: {
    interventions: { interventionsRecordedInPeriod: number; recordedOutcomeDistribution: Record<string, number> };
    alerts: { alertsGeneratedInPeriod: number; alertsResolvedInPeriod: number };
    traceability: { initialLinksRecordedInPeriod: number; linkCorrectionsRecordedInPeriod: number };
  };
  dataQuality: { followUpRequiredButUndated: number; followUpRequirementNotRecorded: number; followUpCompletionAvailable: false };
};

async function token(): Promise<string | null> {
  let t = readAccessTokenFast();
  if (!t) t = (await supabase.auth.getSession()).data.session?.access_token ?? null;
  return t;
}
function sastTodayStr(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00+02:00`); d.setUTCDate(d.getUTCDate() + n);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function useWorkload() {
  const today = sastTodayStr();
  const [from, setFrom] = useState(addDays(today, -29));   // last 30 SAST dates incl. today
  const [to, setTo] = useState(today);                     // inclusive display day
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setUnavailable(false);
    const t = await token();
    if (!t) { setUnavailable(true); setLoading(false); return; }
    try {
      const endExclusive = addDays(to, 1);                 // API end is EXCLUSIVE
      const res = await fetch(`/api/casino/responsible-profitability/workload?start=${from}&end=${endExclusive}`, { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' });
      if (!res.ok) { setUnavailable(true); setData(null); setLoading(false); return; }
      setData(await res.json()); setLoading(false);
    } catch { setUnavailable(true); setLoading(false); }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);
  return { data, loading, unavailable, from, to, setFrom, setTo, today, reload: load };
}

function PeriodControl({ from, to, setFrom, setTo, today }: { from: string; to: string; setFrom: (v: string) => void; setTo: (v: string) => void; today: string }) {
  return (
    <div className="flex flex-wrap items-end gap-2 text-xs">
      <label className="flex flex-col gap-0.5">From<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="rounded border px-2 py-1" /></label>
      <label className="flex flex-col gap-0.5">To<input type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} className="rounded border px-2 py-1" /></label>
      <button onClick={() => { setFrom(addDays(today, -29)); setTo(today); }} className="rounded border px-2 py-1">Last 30 days</button>
      <button onClick={() => { setFrom(addDays(today, -89)); setTo(today); }} className="rounded border px-2 py-1">Last 90 days</button>
      <span className="text-muted-foreground">SAST · period affects “selected period activity” only</span>
    </div>
  );
}

// ── Intervention Intelligence panel ──────────────────────────────────────────────
export function InterventionWorkloadPanel() {
  const w = useWorkload();
  const i = w.data?.currentWorkload.interventions;
  const dq = w.data?.dataQuality;
  const p = w.data?.periodActivity.interventions;
  const dist = p?.recordedOutcomeDistribution ?? {};
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium"><ClipboardList className="h-4 w-4" /> Intervention &amp; Follow-Up Workload</CardTitle>
        <CardDescription>Operational workload only. “Follow-up required” does not indicate completion; completion is not recorded. Recorded outcome does not indicate effectiveness.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <PeriodControl {...w} />
        {w.unavailable && <p className="text-sm text-muted-foreground">This view is currently unavailable.</p>}
        {w.loading && !w.data && <p className="text-sm text-muted-foreground">Loading workload…</p>}
        {w.data && (
          <>
            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Current workload</div>
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <Stat label="Follow-up required" value={i!.followUpRequiredCurrent} />
                <Stat label="Required but no date recorded" value={i!.followUpRequiredButUndated} />
                <Stat label="Due today" value={i!.followUpDueToday} />
                <Stat label="Overdue" value={i!.followUpOverdue} />
                <Stat label="Max days overdue" value={i!.maxDaysOverdue ?? '—'} />
                <Stat label="Future scheduled" value={i!.followUpFuture} />
              </div>
              {(dq?.followUpRequiredButUndated ?? 0) > 0 && (
                <p className="mt-2 flex items-center gap-1 text-[11px] text-amber-600"><Info className="h-3 w-3" />
                  {dq!.followUpRequiredButUndated} interventions require follow-up but do not have a recorded follow-up date.</p>
              )}
              {(dq?.followUpRequirementNotRecorded ?? 0) > 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground">{dq!.followUpRequirementNotRecorded} interventions do not have a recorded follow-up requirement status.</p>
              )}
            </div>
            <div>
              <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"><CalendarClock className="h-3 w-3" /> Selected period activity</div>
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <Stat label="Interventions recorded" value={p!.interventionsRecordedInPeriod} />
                {(['accepted', 'declined', 'pending', 'successful', 'unsuccessful', 'notRecorded'] as const).map((k) => (
                  <Stat key={k} label={`Recorded outcome: ${k === 'notRecorded' ? 'not recorded' : k}`} value={dist[k] ?? 0} />
                ))}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Recorded intervention outcome — a recorded category, not an effectiveness measure.</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Protection Alerts panel ──────────────────────────────────────────────────────
export function AlertWorkloadPanel() {
  const w = useWorkload();
  const a = w.data?.currentWorkload.alerts;
  const tr = w.data?.currentWorkload.traceability;
  const pa = w.data?.periodActivity.alerts;
  const pt = w.data?.periodActivity.traceability;
  const noData = w.data && a!.openAlerts === 0 && a!.acknowledgedAlerts === 0 && (tr!.activeTraceabilityLinks === 0);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium"><ShieldAlert className="h-4 w-4 text-amber-600" /> Alert Workload &amp; Traceability</CardTitle>
        <CardDescription>{WORKLOAD_LINK_NEUTRAL_NOTE}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <PeriodControl {...w} />
        {w.unavailable && <p className="text-sm text-muted-foreground">This view is currently unavailable.</p>}
        {w.loading && !w.data && <p className="text-sm text-muted-foreground">Loading workload…</p>}
        {w.data && (
          <>
            {noData && <p className="text-xs text-muted-foreground">No protection alerts recorded in the current Demo dataset.</p>}
            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Current workload</div>
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                <Stat label="Open alerts" value={a!.openAlerts} />
                <Stat label="Acknowledged alerts" value={a!.acknowledgedAlerts} />
                <Stat label="Oldest open (days)" value={a!.oldestOpenAgeDays ?? '—'} />
                <Stat label="Oldest acknowledged (days)" value={a!.oldestAcknowledgedAgeDays ?? '—'} hint="measured from acknowledged_at" />
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <Stat label="Alerts with linked intervention" value={tr!.alertsWithActiveInterventionLink} hint="open + acknowledged" />
                <Stat label="Alerts without linked intervention" value={tr!.alertsWithoutActiveInterventionLink} hint="open + acknowledged" />
                <Stat label="Active traceability links" value={tr!.activeTraceabilityLinks} />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"><Link2 className="h-3 w-3" /> Selected period activity</div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Alerts generated" value={pa!.alertsGeneratedInPeriod} />
                <Stat label="Alerts resolved" value={pa!.alertsResolvedInPeriod} />
                <Stat label="Initial links recorded" value={pt!.initialLinksRecordedInPeriod} />
                <Stat label="Link corrections recorded" value={pt!.linkCorrectionsRecordedInPeriod} />
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
