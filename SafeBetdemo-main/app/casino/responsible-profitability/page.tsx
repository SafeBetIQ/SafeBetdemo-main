'use client';

// ── SafeBet IQ — Responsible Profitability B1 overview (NON-PRODUCTION) ───────
// A single MINIMAL operator panel (NOT the full B3 dashboard). It shows certified
// GGR ALONGSIDE harm-risk exposure, protection in force, intervention coverage
// (only when validly measurable), data provenance, reconciliation status and
// financial freshness. It never renders a missing value as zero, and it never
// frames elevated-risk / self-excluded players as growth, upsell or recovery
// opportunities — it is read-only responsible-profitability intelligence.
//
// All data comes from GET /api/casino/responsible-profitability, which reuses the
// certified Consumer Platform posture verbatim (reconciles by construction) and
// returns governed NOT_AVAILABLE metrics rather than estimates.

import { useCallback, useEffect, useRef, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { CasinoAdminGuard } from '@/components/CasinoAdminGuard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { readAccessTokenFast, supabase } from '@/lib/supabase';
import { isOverviewForPeriod } from '@/lib/responsibleProfitability';
import { FINANCIAL_PERIODS, type FinancialPeriod } from '@/lib/certifiedFinancial';
import { ShieldCheck, RefreshCw, Info } from 'lucide-react';

interface RpMetric {
  id: string; name: string;
  availability: 'MEASURABLE' | 'NOT_AVAILABLE' | 'SUPPRESSED';
  value: number | null; ratio?: number | null; display: string;
  provenance: string; freshness?: string; reason?: string; framing: string;
}
interface RpOverview {
  metricsVersion: string; casinoId: string; period: FinancialPeriod; generatedAt: string;
  currency: string; timezone: string; financialStatus: string;
  containsSyntheticData: boolean; syntheticDisclosure: string | null;
  reconciliation: 'RECONCILES_TO_CERTIFIED_POSTURE' | 'UNAVAILABLE';
  metrics: RpMetric[];
}

const AVAIL_TONE: Record<string, 'default' | 'secondary' | 'outline'> = {
  MEASURABLE: 'default', NOT_AVAILABLE: 'outline', SUPPRESSED: 'secondary',
};
const AVAIL_LABEL: Record<string, string> = {
  MEASURABLE: 'Measured', NOT_AVAILABLE: 'Not available', SUPPRESSED: 'Suppressed (small group)',
};
const PROV_LABEL: Record<string, string> = {
  CERTIFIED: 'Certified', OPERATIONAL_PROJECTION: 'Operational projection',
  DERIVED: 'Derived', SYNTHETIC_DEMO: 'Synthetic (demo)',
};

async function token(): Promise<string | null> {
  let t = readAccessTokenFast();
  if (!t) t = (await supabase.auth.getSession()).data.session?.access_token ?? null;
  return t;
}

export default function ResponsibleProfitabilityPage() {
  const [period, setPeriod] = useState<FinancialPeriod>('TODAY');
  const [data, setData] = useState<RpOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const reqGen = useRef(0);

  const refresh = useCallback(async () => {
    // Bump the request generation and clear any previously-shown figures so stale
    // financial data can never render under a newly-selected period (finding 4).
    const gen = ++reqGen.current;
    setLoading(true); setUnavailable(false); setData(null);
    const t = await token();
    if (gen !== reqGen.current) return;
    if (!t) { setUnavailable(true); setLoading(false); return; }
    try {
      const res = await fetch(`/api/casino/responsible-profitability?period=${period}`, {
        headers: { Authorization: `Bearer ${t}` }, cache: 'no-store',
      });
      if (gen !== reqGen.current) return;   // a newer request superseded this one
      if (!res.ok) { setUnavailable(true); setData(null); }
      else {
        const b = await res.json();
        if (gen !== reqGen.current) return;
        const ov = (b?.overview ?? null) as RpOverview | null;
        // Only accept a response that is actually for the currently-selected period.
        setData(isOverviewForPeriod(ov, period) ? ov : null);
      }
    } catch { if (gen === reqGen.current) { setUnavailable(true); setData(null); } }
    if (gen === reqGen.current) setLoading(false);
  }, [period]);

  useEffect(() => { refresh(); }, [refresh]);

  const metric = (id: string) => data?.metrics.find((m) => m.id === id);
  const measurable = data?.metrics.filter((m) => m.availability !== 'NOT_AVAILABLE') ?? [];
  const notAvailable = data?.metrics.filter((m) => m.availability === 'NOT_AVAILABLE') ?? [];
  const ggr = metric('certified_ggr');

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
                Certified performance shown alongside harm-risk exposure and player protection.
                Read-only intelligence — no targeting, incentives or actions. {data ? `Metrics v${data.metricsVersion}.` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-md border">
                {FINANCIAL_PERIODS.map((p) => (
                  <button key={p.key} onClick={() => setPeriod(p.key)}
                    className={`px-3 py-1.5 text-sm ${period === p.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
                    {p.short}
                  </button>
                ))}
              </div>
              <button onClick={refresh} className="rounded-md border p-2" aria-label="Refresh">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

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
              {/* Certified GGR headline + reconciliation/freshness/provenance */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Certified GGR — {FINANCIAL_PERIODS.find((p) => p.key === period)?.label}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-3xl font-semibold">{ggr?.display ?? '—'}</div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="outline">{data.currency} · {data.timezone}</Badge>
                    <Badge variant={data.financialStatus === 'Live' ? 'default' : 'secondary'}>Financial: {data.financialStatus}</Badge>
                    <Badge variant={data.reconciliation === 'RECONCILES_TO_CERTIFIED_POSTURE' ? 'default' : 'outline'}>
                      {data.reconciliation === 'RECONCILES_TO_CERTIFIED_POSTURE' ? 'Reconciles to certified posture' : 'Reconciliation unavailable'}
                    </Badge>
                    {data.containsSyntheticData && <Badge variant="secondary">Synthetic demo data</Badge>}
                  </div>
                  {data.syntheticDisclosure && <p className="text-xs text-muted-foreground">{data.syntheticDisclosure}</p>}
                </CardContent>
              </Card>

              {/* Measurable responsible-profitability metrics */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {measurable.filter((m) => m.id !== 'certified_ggr').map((m) => (
                  <Card key={m.id}>
                    <CardHeader className="pb-1">
                      <CardTitle className="text-sm font-medium">{m.name}</CardTitle>
                      <CardDescription className="flex flex-wrap gap-1 pt-1">
                        <Badge variant={AVAIL_TONE[m.availability]}>{AVAIL_LABEL[m.availability]}</Badge>
                        <Badge variant="outline">{PROV_LABEL[m.provenance] ?? m.provenance}</Badge>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl font-semibold">{m.display}</div>
                      {m.reason && <p className="mt-1 text-xs text-muted-foreground">{m.reason}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Honest disclosure of metrics defined but NOT currently measurable */}
              {notAvailable.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-medium">
                      <Info className="h-4 w-4" /> Defined but not currently measurable
                    </CardTitle>
                    <CardDescription>
                      These metrics are in the governed definitions contract but cannot be measured from
                      authorised, period-aligned, certified data today. They are shown as unavailable —
                      never estimated, inferred or allocated from aggregates.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {notAvailable.map((m) => (
                      <div key={m.id} className="flex flex-col gap-0.5 border-b pb-2 last:border-0 last:pb-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{m.name}</span>
                          <Badge variant="outline">Not available</Badge>
                        </div>
                        {m.reason && <span className="text-xs text-muted-foreground">{m.reason}</span>}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <p className="text-xs text-muted-foreground">
                Generated {new Date(data.generatedAt).toLocaleString()} · casino {data.casinoId}.
                Elevated-risk and self-excluded players are shown only as protection and exposure-to-reduce —
                never as commercial opportunities.
              </p>
            </>
          )}
        </div>
      </DashboardLayout>
    </CasinoAdminGuard>
  );
}
