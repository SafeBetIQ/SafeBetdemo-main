'use client';

// Shared Responsible Profitability (B3) dashboard scaffolding: the three-page
// sub-navigation, the time-scope chip (keeps B1 financial period and B2
// ALL_RECORDED visibly distinct), and the single governed data hook consumed by
// all three pages (one endpoint, casino-scoped, period-race-guarded).

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { readAccessTokenFast, supabase } from '@/lib/supabase';
import { isOverviewForPeriod } from '@/lib/responsibleProfitability';
import type { FinancialPeriod } from '@/lib/certifiedFinancial';
import { SCOPE_FINANCIAL, SCOPE_ALL_RECORDED } from '@/lib/responsibleProfitability/dashboardView';

export interface RpMetric {
  id: string; name: string; availability: string;
  value: number | null; ratio?: number | null; display: string;
  breakdown?: Record<string, number | string> | null;
  provenance: string; freshness?: string; reason?: string; framing: string;
}
export interface RpOverview {
  metricsVersion: string; casinoId: string; period: FinancialPeriod; generatedAt: string;
  currency: string; timezone: string; financialStatus: string;
  containsSyntheticData: boolean; syntheticDisclosure: string | null;
  reconciliation: 'RECONCILES_TO_CERTIFIED_POSTURE' | 'UNAVAILABLE';
  metrics: RpMetric[];
}
export interface B2Overview {
  metricsVersion: string; casinoId: string; observationWindow: string; source: string;
  generatedAt: string; dataProvenanceNote: string; lastInterventionAt: string | null;
  metrics: RpMetric[];
}

export const RP_TABS = [
  { href: '/casino/responsible-profitability', label: 'Executive Overview' },
  { href: '/casino/responsible-profitability/interventions', label: 'Intervention Intelligence' },
  { href: '/casino/responsible-profitability/governance', label: 'Governance & Reporting' },
];

export function RpTabs() {
  const pathname = usePathname();
  return (
    <div className="flex flex-wrap gap-1 border-b">
      {RP_TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link key={t.href} href={t.href}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

/** Visible time-scope chip. B1 = certified financial period; B2 = ALL_RECORDED — never conflated. */
export function ScopeChip({ scope }: { scope: 'financial' | 'all_recorded' }) {
  return (
    <Badge variant={scope === 'financial' ? 'default' : 'secondary'} className="font-normal">
      {scope === 'financial' ? SCOPE_FINANCIAL : SCOPE_ALL_RECORDED}
    </Badge>
  );
}

async function token(): Promise<string | null> {
  let t = readAccessTokenFast();
  if (!t) t = (await supabase.auth.getSession()).data.session?.access_token ?? null;
  return t;
}

export interface RpData { overview: RpOverview | null; b2: B2Overview | null; loading: boolean; unavailable: boolean }

/** Single governed fetch shared by all three B3 pages. Period-race-guarded; B2 is period-independent. */
export function useResponsibleProfitability(period: FinancialPeriod) {
  const [state, setState] = useState<RpData>({ overview: null, b2: null, loading: true, unavailable: false });
  const gen = useRef(0);
  const refresh = useCallback(async () => {
    const g = ++gen.current;
    setState({ overview: null, b2: null, loading: true, unavailable: false });
    const t = await token();
    if (g !== gen.current) return;
    if (!t) { setState({ overview: null, b2: null, loading: false, unavailable: true }); return; }
    try {
      const res = await fetch(`/api/casino/responsible-profitability?period=${period}`, { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' });
      if (g !== gen.current) return;
      if (!res.ok) { setState({ overview: null, b2: null, loading: false, unavailable: true }); return; }
      const b = await res.json();
      if (g !== gen.current) return;
      const ov = (b?.overview ?? null) as RpOverview | null;
      const accepted = isOverviewForPeriod(ov, period);   // stale-period guard
      setState({ overview: accepted ? ov : null, b2: accepted ? ((b?.interventionOutcomes ?? null) as B2Overview | null) : null, loading: false, unavailable: false });
    } catch { if (g === gen.current) setState({ overview: null, b2: null, loading: false, unavailable: true }); }
  }, [period]);
  useEffect(() => { refresh(); }, [refresh]);
  return { ...state, refresh };
}
