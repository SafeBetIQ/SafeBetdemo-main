'use client';

// ── Responsible Profitability B3 — Page B: Intervention Intelligence ──────────
// Recorded responsible-gambling interventions for the casino. Scope is ALL_RECORDED
// (all recorded history) — NEVER a financial period, and never presented as such.
// Charts consume only chartable governed values; suppressed/unavailable metrics
// render honest empty states. No causal-effectiveness language ("Recorded outcomes").

import { DashboardLayout } from '@/components/DashboardLayout';
import { CasinoAdminGuard } from '@/components/CasinoAdminGuard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GovernedKpiCard } from '@/components/dashboard/GovernedKpiCard';
import { RpTabs, ScopeChip, useResponsibleProfitability } from '@/components/responsibleProfitability/shared';
import { isChartable, breakdownToChartData } from '@/lib/responsibleProfitability/dashboardView';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { HeartPulse, Users, CalendarClock, FileCheck, Info } from 'lucide-react';

const OUTCOME_COLOR: Record<string, string> = {
  accepted: '#10b981', successful: '#059669', pending: '#f59e0b', declined: '#f43f5e', unsuccessful: '#e11d48',
  sent: '#6366f1', delivered: '#10b981',
};
const KPI_ICON: Record<string, typeof Users> = {
  interventions_recorded: HeartPulse, distinct_intervention_players: Users,
  follow_up_required_rate: CalendarClock, reporting_completeness: FileCheck,
};

function GovernedBarChart({ title, m }: { title: string; m: { availability: string; display: string; breakdown?: Record<string, number | string> | null; reason?: string } | undefined }) {
  const data = breakdownToChartData(m);
  return (
    <Card>
      <CardHeader className="pb-1"><CardTitle className="text-sm font-medium">{title}</CardTitle></CardHeader>
      <CardContent>
        {isChartable(m) && data.length > 0 ? (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {data.map((d) => <Cell key={d.name} fill={OUTCOME_COLOR[d.name] ?? '#6366f1'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-56 items-center justify-center text-center text-sm text-muted-foreground">
            <div><Badge variant="outline" className="mb-2">{m?.availability ?? 'Not available'}</Badge><p className="text-xs">{m?.reason ?? 'Not measurable from current evidence.'}</p></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function InterventionIntelligencePage() {
  const { b2, loading, unavailable } = useResponsibleProfitability('TODAY');   // B2 is period-independent
  const m = (id: string) => b2?.metrics.find((x) => x.id === id);
  const kpiIds = ['interventions_recorded', 'distinct_intervention_players', 'follow_up_required_rate', 'reporting_completeness'];
  const notAvailable = b2?.metrics.filter((x) => x.availability === 'NOT_AVAILABLE') ?? [];
  const evidence = m('intervention_evidence_completeness');

  return (
    <CasinoAdminGuard>
      <DashboardLayout>
        <div className="space-y-6 p-4 md:p-6">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold"><HeartPulse className="h-6 w-6 text-rose-500" /> Intervention Intelligence</h1>
            <p className="text-sm text-muted-foreground">Recorded responsible-gambling interventions for this casino. {b2 ? `Metrics v${b2.metricsVersion}.` : ''}</p>
          </div>
          <RpTabs />

          <div className="flex flex-wrap items-center gap-2">
            <ScopeChip scope="all_recorded" />
            {b2?.lastInterventionAt && <Badge variant="outline" className="font-normal">Most recent recorded: {new Date(b2.lastInterventionAt).toLocaleDateString()}</Badge>}
          </div>
          {b2?.dataProvenanceNote && <p className="text-xs text-muted-foreground">{b2.dataProvenanceNote}</p>}

          {unavailable && <Card><CardContent className="p-6 text-sm text-muted-foreground">This view is currently unavailable.</CardContent></Card>}
          {loading && !b2 && <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading intervention records…</CardContent></Card>}

          {b2 && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {kpiIds.map((id) => { const x = m(id); if (!x) return null;
                  return <GovernedKpiCard key={id} icon={KPI_ICON[id] ?? HeartPulse} label={x.name} availability={x.availability} display={x.display} provenance={x.provenance} reason={x.reason} />; })}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <GovernedBarChart title="Recorded outcome distribution (not causal effectiveness)" m={m('intervention_outcome_distribution')} />
                <GovernedBarChart title="Dispatch status (recorded field — not delivery timing)" m={m('intervention_status_distribution')} />
              </div>

              {evidence && (
                <Card>
                  <CardHeader className="pb-1"><CardTitle className="text-sm font-medium">Intervention evidence completeness</CardTitle>
                    <CardDescription>How complete the recorded evidence is per lifecycle field. Low completeness is a data gap — never grounds to fabricate values.</CardDescription></CardHeader>
                  <CardContent><div className="text-sm">{evidence.display}</div></CardContent>
                </Card>
              )}

              {notAvailable.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-medium"><Info className="h-4 w-4" /> Not measurable from current evidence</CardTitle>
                    <CardDescription>Coverage, causal effectiveness, delivery timing and follow-up completion are not supported by the current source data. Shown as unavailable — never estimated or inferred.</CardDescription></CardHeader>
                  <CardContent className="space-y-2">
                    {notAvailable.map((x) => (
                      <div key={x.id} className="flex flex-col gap-0.5 border-b pb-2 last:border-0 last:pb-0">
                        <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{x.name}</span><Badge variant="outline">Not available</Badge></div>
                        {x.reason && <span className="text-xs text-muted-foreground">{x.reason}</span>}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </DashboardLayout>
    </CasinoAdminGuard>
  );
}
