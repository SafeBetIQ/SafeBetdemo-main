'use client';

// ─── Reporting Centre (certified financial convergence) ──────────────────────
// Reports COMPOSE certified Consumer Platform views — they recalculate nothing
// and read no tables directly. Financial figures come from the SAME certified
// posture (projection_financial_posture → FinancialPostureView) the Operator
// dashboard and Evidence Centre use, formatted through lib/certifiedFinancial so
// every screen shows identical numbers. Null certified values render as "—",
// never a false R 0. Printable for distribution.

import { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { CasinoAdminGuard } from '@/components/CasinoAdminGuard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { cgGet } from '@/lib/consumerClient';
import type { FinancialPostureView } from '@/lib/consumerPlatform/contracts';
import {
  FINANCIAL_PERIODS, type FinancialPeriod,
  certifiedMoney, ggrForPeriod, stakesForPeriod, winningsForPeriod,
  financialStatusLabel, financialStatusTone, financialCurrency, financialTimezone,
  syntheticDisclosure,
} from '@/lib/certifiedFinancial';
import { buildReportNarrative } from '@/lib/reportNarrative';
import { FileText, RefreshCw, Printer } from 'lucide-react';

type Rec = Record<string, unknown>;
const n = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0)) || 0;

export default function ReportingCentrePage() {
  const { user } = useAuth();
  const casinoId = (user as unknown as Rec)?.casino_id as string | undefined;
  const [floor, setFloor] = useState<Rec | null>(null);
  const [summary, setSummary] = useState<Rec | null>(null);
  const [compliance, setCompliance] = useState<Rec | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatedAt, setGeneratedAt] = useState<string>('');
  const [period, setPeriod] = useState<FinancialPeriod>('TODAY');

  const refresh = useCallback(async () => {
    setLoading(true);
    const [f, s, c] = await Promise.all([
      cgGet('live-floor', { casino_id: casinoId }),
      cgGet('summary', { casino_id: casinoId }),
      cgGet('compliance', { casino_id: casinoId }),
    ]);
    setFloor(f); setSummary(s); setCompliance(c);
    setGeneratedAt(new Date().toLocaleString());
    setLoading(false);
  }, [casinoId]);
  useEffect(() => { refresh(); }, [refresh]);

  // Certified financial posture — the single source of truth, identical to the
  // Operator dashboard and Evidence Centre. Null when the certified source does
  // not support the scope (rendered as "—", never a false zero).
  const financial = (floor?.financial ?? null) as FinancialPostureView | null;
  const kpi = ((floor?.kpi ?? summary?.kpi) ?? {}) as Rec;
  const tiers = (compliance?.riskTiers ?? { critical: 0, high: 0, medium: 0, low: 0 }) as Rec;
  const monitored = (compliance?.playersRequiringMonitoring ?? []) as Rec[];
  const decisions = (compliance?.regulatoryDecisions ?? summary?.headlineDecisions ?? []) as Rec[];

  const statusLabel = financialStatusLabel(financial);
  const periodMeta = FINANCIAL_PERIODS.find((p) => p.key === period)!;
  const disclosure = syntheticDisclosure(financial);

  // UAT-OP-1 (P0-1): one coherent risk narrative so the summary and the findings
  // section can never contradict each other.
  const narrative = buildReportNarrative({
    critical: n(tiers.critical), high: n(tiers.high),
    monitoredCount: monitored.length, decisionCount: decisions.length,
  });

  return (
    <CasinoAdminGuard>
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="h-6 w-6" /> Reporting Centre</h1>
              <p className="text-muted-foreground">Reports composed from the certified Consumer Platform — identical figures to every other screen.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={refresh} disabled={loading}><RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh</Button>
              <Button onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" /> Print / PDF</Button>
            </div>
          </div>

          {/* ─── Certified financial position ───────────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    Certified financial position
                    <Badge variant={financialStatusTone(statusLabel)} aria-label={`Certification status ${statusLabel}`}>{statusLabel}</Badge>
                  </CardTitle>
                  <CardDescription>
                    {periodMeta.label} · {financialCurrency(financial)} · {financialTimezone(financial)} · Generated {generatedAt || '—'}
                  </CardDescription>
                </div>
                {/* Period selector — changes ALL financial cards together. */}
                <div className="flex flex-wrap gap-1" role="group" aria-label="Reporting period">
                  {FINANCIAL_PERIODS.map((p) => (
                    <Button
                      key={p.key}
                      size="sm"
                      variant={p.key === period ? 'default' : 'outline'}
                      aria-pressed={p.key === period}
                      onClick={() => setPeriod(p.key)}
                    >{p.short}</Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg border p-4">
                  <div className="text-2xl font-semibold tabular-nums text-emerald-700">{loading ? '…' : certifiedMoney(ggrForPeriod(financial, period))}</div>
                  <div className="text-xs uppercase text-muted-foreground">GGR</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-2xl font-semibold tabular-nums">{loading ? '…' : certifiedMoney(stakesForPeriod(financial, period))}</div>
                  <div className="text-xs uppercase text-muted-foreground">Settled stakes</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-2xl font-semibold tabular-nums">{loading ? '…' : certifiedMoney(winningsForPeriod(financial, period))}</div>
                  <div className="text-xs uppercase text-muted-foreground">Player winnings</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-2xl font-semibold tabular-nums">{loading ? '…' : (financial ? n(financial.settledBetsToday).toLocaleString() : '—')}</div>
                  <div className="text-xs uppercase text-muted-foreground">Settled bets (today)</div>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                GGR = settled stakes − player winnings, over the certified financial event log.
                {disclosure ? ` · ${disclosure}` : ''}
              </p>
              {!loading && !financial && (
                <p className="text-sm text-muted-foreground">Certified financial position unavailable for this scope.</p>
              )}
            </CardContent>
          </Card>

          {/* ─── Responsible Gambling posture ───────────────────────────── */}
          <Card>
            <CardHeader><CardTitle className="text-base">Responsible Gambling posture report</CardTitle>
              <CardDescription>Generated {generatedAt || '—'} · Recorded Fact + Derived Intelligence</CardDescription></CardHeader>
            <CardContent className="space-y-3">
            {!loading && <p className="text-sm font-medium">{narrative.riskSummary}</p>}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border p-4"><div className="text-2xl font-semibold">{n(kpi.active_players)}</div><div className="text-xs uppercase text-muted-foreground">Active players</div></div>
              <div className="rounded-lg border p-4"><div className="text-2xl font-semibold tabular-nums text-emerald-700">{loading ? '…' : certifiedMoney(ggrForPeriod(financial, period))}</div><div className="text-xs uppercase text-muted-foreground">GGR ({periodMeta.short})</div></div>
              <div className="rounded-lg border p-4"><div className="text-2xl font-semibold text-red-600">{n(tiers.critical)}</div><div className="text-xs uppercase text-muted-foreground">Critical risk</div></div>
              <div className="rounded-lg border p-4"><div className="text-2xl font-semibold text-orange-600">{n(tiers.high)}</div><div className="text-xs uppercase text-muted-foreground">High risk</div></div>
            </div>
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Players requiring monitoring</CardTitle><CardDescription>Derived Intelligence</CardDescription></CardHeader>
              <CardContent className="space-y-1">
                {monitored.length === 0 && <p className="text-sm text-muted-foreground">None.</p>}
                {monitored.slice(0, 12).map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-sm border-b py-1 last:border-0">
                    <span className="font-mono text-xs">{String(p.playerId)}</span>
                    <span className="flex items-center gap-2"><Badge variant="outline">{n(p.riskScore)}</Badge><span className="text-muted-foreground text-xs">{n(p.interventionCount)} interventions</span></span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">{narrative.findingsLabel}</CardTitle>
                <CardDescription>{narrative.findingsAreObserved ? 'Observed incidents · Policy Decision' : 'Policy Decision'}</CardDescription></CardHeader>
              <CardContent className="space-y-1">
                {narrative.guidanceDisclaimer && <p className="text-xs text-muted-foreground border-l-2 pl-2">{narrative.guidanceDisclaimer}</p>}
                {decisions.length === 0 && <p className="text-sm text-muted-foreground">No decisions on record.</p>}
                {decisions.slice(0, 12).map((d, i) => (
                  <div key={i} className="text-sm border-b py-1 last:border-0"><Badge variant="outline" className="text-[10px] mr-1">{String(d.policyReference ?? d.policyId)}</Badge>{String(d.action)} — {String(d.reason)}</div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    </CasinoAdminGuard>
  );
}
