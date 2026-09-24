'use client';

// ── Responsible Profitability B3 — Page C: Governance & Reporting ─────────────
// The governance surface: metric definitions, provenance, availability and
// reconciliation for the B1 (certified financial period) and B2 (ALL_RECORDED)
// metrics, plus a CSV export. The export is generated CLIENT-SIDE from the already
// governed + suppressed API response only — it is NOT a new server route and adds
// NO new privileged surface; it carries scope, version, provenance, availability,
// suppression and reconciliation, and never a raw or re-derived figure.

import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { CasinoAdminGuard } from '@/components/CasinoAdminGuard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RpTabs, ScopeChip, useResponsibleProfitability, type RpMetric } from '@/components/responsibleProfitability/shared';
import { availabilityPresentation, buildGovernedCsv } from '@/lib/responsibleProfitability/dashboardView';
import { FINANCIAL_PERIODS, type FinancialPeriod } from '@/lib/certifiedFinancial';
import { FileText, Download, ShieldCheck } from 'lucide-react';

const PROV: Record<string, string> = { CERTIFIED: 'Certified', OPERATIONAL_PROJECTION: 'Operational projection', DERIVED: 'Derived', SYNTHETIC_DEMO: 'Synthetic (demo)', DEMO_INTERVENTION_RECORD: 'Demo intervention record', NONE: '—' };

function MetricRows({ metrics }: { metrics: RpMetric[] }) {
  return (
    <div className="divide-y">
      {metrics.map((m) => {
        const pres = availabilityPresentation(m.availability);
        return (
          <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div className="min-w-[200px]"><div className="text-sm font-medium">{m.name}</div><div className="text-[11px] text-muted-foreground">{m.id}</div></div>
            <div className="flex items-center gap-2">
              <span className="text-sm">{(m.availability === 'MEASURABLE' || m.availability === 'PARTIAL') ? m.display : '—'}</span>
              <Badge variant={pres.tone}>{pres.label}</Badge>
              <Badge variant="outline">{PROV[m.provenance] ?? m.provenance}</Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function GovernanceReportingPage() {
  const [period, setPeriod] = useState<FinancialPeriod>('TODAY');
  const { overview: data, b2, loading, unavailable } = useResponsibleProfitability(period);

  const exportCsv = () => {
    if (!data) return;
    const csv = buildGovernedCsv({
      casinoId: data.casinoId, financialPeriod: period, currency: data.currency,
      financialStatus: data.financialStatus, reconciliation: data.reconciliation,
      containsSyntheticData: data.containsSyntheticData,
      b1Metrics: data.metrics.map((m) => ({ id: m.id, name: m.name, availability: m.availability, display: (m.availability === 'MEASURABLE' || m.availability === 'PARTIAL') ? m.display : '—', provenance: m.provenance })),
      b2Metrics: (b2?.metrics ?? []).map((m) => ({ id: m.id, name: m.name, availability: m.availability, display: (m.availability === 'MEASURABLE' || m.availability === 'PARTIAL') ? m.display : '—', provenance: m.provenance })),
      b2ObservationWindow: b2?.observationWindow ?? 'ALL_RECORDED',
      metricsVersionB1: data.metricsVersion, metricsVersionB2: b2?.metricsVersion ?? '',
      generatedAt: new Date().toISOString(),
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `responsible-profitability-${data.casinoId}-${period}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <CasinoAdminGuard>
      <DashboardLayout>
        <div className="space-y-6 p-4 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-semibold"><FileText className="h-6 w-6 text-sky-600" /> Governance &amp; Reporting</h1>
              <p className="text-sm text-muted-foreground">Metric definitions, provenance, availability and reconciliation for the governed Responsible-Profitability metrics.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-md border">
                {FINANCIAL_PERIODS.map((p) => (<button key={p.key} onClick={() => setPeriod(p.key)} className={`px-3 py-1.5 text-sm ${period === p.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>{p.short}</button>))}
              </div>
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={!data}><Download className="mr-1 h-4 w-4" /> Export CSV</Button>
            </div>
          </div>
          <RpTabs />

          {unavailable && <Card><CardContent className="p-6 text-sm text-muted-foreground">This view is currently unavailable.</CardContent></Card>}
          {loading && !data && <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading governed metrics…</CardContent></Card>}

          {data && (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="h-4 w-4" /> Financial &amp; risk metrics</CardTitle>
                    <ScopeChip scope="financial" />
                  </div>
                  <CardDescription className="flex flex-wrap gap-2 pt-1">
                    <Badge variant="outline">v{data.metricsVersion}</Badge>
                    <Badge variant={data.reconciliation === 'RECONCILES_TO_CERTIFIED_POSTURE' ? 'default' : 'outline'}>{data.reconciliation === 'RECONCILES_TO_CERTIFIED_POSTURE' ? 'Reconciles to certified posture' : 'Reconciliation unavailable'}</Badge>
                    {data.containsSyntheticData && <Badge variant="secondary">Synthetic demo data</Badge>}
                  </CardDescription>
                </CardHeader>
                <CardContent><MetricRows metrics={data.metrics} /></CardContent>
              </Card>

              {b2 && (
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="text-sm font-medium">Intervention-outcome metrics</CardTitle>
                      <ScopeChip scope="all_recorded" />
                    </div>
                    <CardDescription className="pt-1"><Badge variant="outline">v{b2.metricsVersion}</Badge> <span className="text-xs">{b2.dataProvenanceNote}</span></CardDescription>
                  </CardHeader>
                  <CardContent><MetricRows metrics={b2.metrics} /></CardContent>
                </Card>
              )}

              <p className="text-xs text-muted-foreground">
                The CSV export contains only the governed, already-suppressed display values with their scope, version, provenance, availability and reconciliation — no raw or re-derived figures and no player identifiers. Platform-wide k-anonymity is not claimed.
              </p>
            </>
          )}
        </div>
      </DashboardLayout>
    </CasinoAdminGuard>
  );
}
