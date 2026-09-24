'use client';

// ── Responsible Profitability B3 — Page A: Executive Overview ─────────────────
// Certified commercial performance shown ALONGSIDE harm-risk exposure and player
// protection, for the selected certified financial period (TODAY/SHIFT/24H/MTD).
// Governed, honest states only; B2 intervention intelligence lives on its own page
// (ALL_RECORDED scope) so the two time-scopes are never conflated.

import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { CasinoAdminGuard } from '@/components/CasinoAdminGuard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GovernedKpiCard } from '@/components/dashboard/GovernedKpiCard';
import { RpTabs, ScopeChip, useResponsibleProfitability } from '@/components/responsibleProfitability/shared';
import { FINANCIAL_PERIODS, type FinancialPeriod } from '@/lib/certifiedFinancial';
import { ShieldCheck, RefreshCw, Info, TrendingUp, AlertTriangle, ShieldBan, Gauge } from 'lucide-react';

const PROV: Record<string, string> = {
  CERTIFIED: 'Certified', OPERATIONAL_PROJECTION: 'Operational projection', DERIVED: 'Derived', SYNTHETIC_DEMO: 'Synthetic (demo)',
};
const ICONS: Record<string, typeof Gauge> = {
  risk_posture_distribution: AlertTriangle, elevated_risk_exposure: AlertTriangle,
  self_exclusion_protection: ShieldBan, financial_data_quality: Gauge,
};

export default function ExecutiveOverviewPage() {
  const [period, setPeriod] = useState<FinancialPeriod>('TODAY');
  const { overview: data, loading, unavailable, refresh } = useResponsibleProfitability(period);
  const metric = (id: string) => data?.metrics.find((m) => m.id === id);
  const ggr = metric('certified_ggr');
  const kpiIds = ['risk_posture_distribution', 'elevated_risk_exposure', 'self_exclusion_protection', 'financial_data_quality'];
  const notAvailable = data?.metrics.filter((m) => m.availability === 'NOT_AVAILABLE') ?? [];

  return (
    <CasinoAdminGuard>
      <DashboardLayout>
        <div className="space-y-6 p-4 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-semibold">
                <ShieldCheck className="h-6 w-6 text-emerald-600" /> Responsible Profitability
              </h1>
              <p className="text-sm text-muted-foreground">
                Certified performance alongside harm-risk exposure and player protection. Read-only intelligence —
                no targeting, incentives or actions. {data ? `Metrics v${data.metricsVersion}.` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-md border">
                {FINANCIAL_PERIODS.map((p) => (
                  <button key={p.key} onClick={() => setPeriod(p.key)}
                    className={`px-3 py-1.5 text-sm ${period === p.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>{p.short}</button>
                ))}
              </div>
              <button onClick={refresh} className="rounded-md border p-2" aria-label="Refresh">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <RpTabs />

          {unavailable && (
            <Card><CardContent className="p-6 text-sm text-muted-foreground">
              This view is currently unavailable. It never displays estimated or zero-filled figures in place of missing certified data.
            </CardContent></Card>
          )}
          {loading && !data && (
            <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading certified posture…</CardContent></Card>
          )}

          {data && (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <TrendingUp className="h-4 w-4" /> Certified GGR — {FINANCIAL_PERIODS.find((p) => p.key === period)?.label}
                    </CardTitle>
                    <ScopeChip scope="financial" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-3xl font-semibold">{ggr && (ggr.availability === 'MEASURABLE') ? ggr.display : '—'}</div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="outline">{data.currency} · {data.timezone}</Badge>
                    <Badge variant={data.financialStatus === 'CERTIFIED' ? 'default' : 'secondary'}>Financial: {data.financialStatus}</Badge>
                    <Badge variant={data.reconciliation === 'RECONCILES_TO_CERTIFIED_POSTURE' ? 'default' : 'outline'}>
                      {data.reconciliation === 'RECONCILES_TO_CERTIFIED_POSTURE' ? 'Reconciles to certified posture' : 'Reconciliation unavailable'}
                    </Badge>
                    {data.containsSyntheticData && <Badge variant="secondary">Synthetic demo data</Badge>}
                  </div>
                  {data.syntheticDisclosure && <p className="text-xs text-muted-foreground">{data.syntheticDisclosure}</p>}
                </CardContent>
              </Card>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {kpiIds.map((id) => {
                  const m = metric(id);
                  if (!m) return null;
                  return <GovernedKpiCard key={id} icon={ICONS[id] ?? Gauge} label={m.name}
                    availability={m.availability} display={m.display} provenance={PROV[m.provenance] ?? m.provenance} reason={m.reason} />;
                })}
              </div>

              {notAvailable.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-medium"><Info className="h-4 w-4" /> Defined but not currently measurable</CardTitle>
                    <CardDescription>In the governed contract but not measurable from authorised, period-aligned, certified data today — shown as unavailable, never estimated.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {notAvailable.map((m) => (
                      <div key={m.id} className="flex flex-col gap-0.5 border-b pb-2 last:border-0 last:pb-0">
                        <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{m.name}</span><Badge variant="outline">Not available</Badge></div>
                        {m.reason && <span className="text-xs text-muted-foreground">{m.reason}</span>}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <p className="text-xs text-muted-foreground">
                Elevated-risk and self-excluded players are shown only as protection and exposure-to-reduce — never as commercial opportunities.
              </p>
            </>
          )}
        </div>
      </DashboardLayout>
    </CasinoAdminGuard>
  );
}
