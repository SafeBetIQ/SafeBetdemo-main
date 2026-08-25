'use client';

// ─── Regulatory Reports (v1.5.1 convergence) ─────────────────────────────────
// Composes certified Regulator Portal views (national-overview +
// operator-compliance) into a printable jurisdiction report. Jurisdiction is
// from the verified JWT; anonymous; evidence-classified; no direct table reads.

import { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { rpGet } from '@/lib/consumerClient';
import type { FinancialPostureView } from '@/lib/consumerPlatform/contracts';
import {
  FINANCIAL_PERIODS, type FinancialPeriod,
  certifiedMoney, ggrForPeriod, stakesForPeriod, winningsForPeriod,
  financialStatusLabel, financialStatusTone, financialCurrency, financialTimezone,
} from '@/lib/certifiedFinancial';
import { FileText, RefreshCw, Printer } from 'lucide-react';

type Rec = Record<string, unknown>;
const n = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0)) || 0;

export default function RegulatoryReportsPage() {
  const [nat, setNat] = useState<Rec | null>(null);
  const [oc, setOc] = useState<Rec | null>(null);
  const [loading, setLoading] = useState(true);

  // Certified operator financial (FIN-UI-2): a regulator views ONE authorised
  // operator's certified posture — the SAME certified source/arithmetic as the
  // operator, presented through the SAME shared module. No cross-operator sum.
  const [finCasino, setFinCasino] = useState<string>('');
  const [finPeriod, setFinPeriod] = useState<FinancialPeriod>('TODAY');
  const [finData, setFinData] = useState<Rec | null>(null);
  const [finLoading, setFinLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [a, b] = await Promise.all([rpGet('national-overview'), rpGet('operator-compliance')]);
    setNat(a); setOc(b); setLoading(false);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const tiers = (nat?.riskTiers ?? { critical: 0, high: 0, medium: 0, low: 0 }) as Rec;
  const operators = (oc?.operators ?? []) as Rec[];

  // Fetch the certified financial posture for the selected authorised operator.
  // The server proves jurisdiction/scope; the browser never sums or authorises.
  useEffect(() => {
    if (!finCasino) { setFinData(null); return; }
    let live = true;
    setFinLoading(true);
    rpGet('operator-financial', { casino_id: finCasino }).then((d) => {
      if (live) { setFinData(d); setFinLoading(false); }
    });
    return () => { live = false; };
  }, [finCasino]);

  const financial = (finData?.financial ?? null) as FinancialPostureView | null;
  const finOperator = (finData?.operator ?? null) as Rec | null;
  const finStatus = financialStatusLabel(financial);
  const finPeriodMeta = FINANCIAL_PERIODS.find((p) => p.key === finPeriod)!;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="h-6 w-6" /> Regulatory Reports</h1>
            <p className="text-muted-foreground">Jurisdiction compliance report — composed from the certified Regulator Portal.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={refresh} disabled={loading}><RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh</Button>
            <Button onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" /> Print / PDF</Button>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Jurisdiction summary</CardTitle>
            <CardDescription>Generated {new Date().toLocaleString()} · anonymous · Recorded Fact + Derived Intelligence</CardDescription></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="rounded-lg border p-4"><div className="text-2xl font-semibold">{n(nat?.operators)}</div><div className="text-xs uppercase text-muted-foreground">Operators</div></div>
            <div className="rounded-lg border p-4"><div className="text-2xl font-semibold">{n(nat?.activePlayers)}</div><div className="text-xs uppercase text-muted-foreground">Active players</div></div>
            <div className="rounded-lg border p-4"><div className="text-2xl font-semibold text-red-600">{n(tiers.critical)}</div><div className="text-xs uppercase text-muted-foreground">Critical</div></div>
            <div className="rounded-lg border p-4"><div className="text-2xl font-semibold">{n(nat?.playersMonitored)}</div><div className="text-xs uppercase text-muted-foreground">Monitored</div></div>
            <div className="rounded-lg border p-4"><div className="text-2xl font-semibold">{n(nat?.interventions)}</div><div className="text-xs uppercase text-muted-foreground">Interventions</div></div>
          </CardContent>
        </Card>

        {/* ─── Certified operator financial (per authorised operator) ──────── */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  Certified operator financial
                  {financial && <Badge variant={financialStatusTone(finStatus)} aria-label={`Certification status ${finStatus}`}>{finStatus}</Badge>}
                </CardTitle>
                <CardDescription>
                  {finOperator ? `${String(finOperator.name)} · ` : ''}{finPeriodMeta.label} · {financialCurrency(financial)} · {financialTimezone(financial)}
                  {' '}· same certified source as the operator — regulator role changes access, not the numbers
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor="reg-fin-operator">Operator</label>
                <select
                  id="reg-fin-operator"
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={finCasino}
                  onChange={(e) => setFinCasino(e.target.value)}
                >
                  <option value="">Select operator…</option>
                  {operators.map((o, i) => (
                    <option key={i} value={String(o.casinoId ?? '')}>{String(o.name ?? o.casinoName ?? o.casinoId)}</option>
                  ))}
                </select>
                <div className="flex flex-wrap gap-1" role="group" aria-label="Reporting period">
                  {FINANCIAL_PERIODS.map((p) => (
                    <Button key={p.key} size="sm" variant={p.key === finPeriod ? 'default' : 'outline'}
                      aria-pressed={p.key === finPeriod} onClick={() => setFinPeriod(p.key)}>{p.short}</Button>
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {!finCasino ? (
              <p className="text-sm text-muted-foreground">Select an authorised operator to view its certified financial position.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="rounded-lg border p-4">
                    <div className="text-2xl font-semibold tabular-nums text-emerald-700">{finLoading ? '…' : certifiedMoney(ggrForPeriod(financial, finPeriod))}</div>
                    <div className="text-xs uppercase text-muted-foreground">GGR</div>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="text-2xl font-semibold tabular-nums">{finLoading ? '…' : certifiedMoney(stakesForPeriod(financial, finPeriod))}</div>
                    <div className="text-xs uppercase text-muted-foreground">Settled stakes</div>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="text-2xl font-semibold tabular-nums">{finLoading ? '…' : certifiedMoney(winningsForPeriod(financial, finPeriod))}</div>
                    <div className="text-xs uppercase text-muted-foreground">Player winnings</div>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">GGR = settled stakes − player winnings (certified financial event log). Null certified values show “—”, never R 0.</p>
                {!finLoading && !financial && (
                  <p className="text-sm text-muted-foreground">Certified financial position unavailable for this operator/scope.</p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Per-operator compliance</CardTitle><CardDescription>Recorded Fact + Derived Intelligence (aggregate, no per-player cross-operator linkage by design)</CardDescription></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Operator</TableHead><TableHead className="text-right">Active players</TableHead><TableHead className="text-right">Monitored</TableHead><TableHead className="text-right">Interventions</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {loading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>}
                {!loading && operators.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No operators in scope.</TableCell></TableRow>}
                {operators.map((o, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{String(o.name ?? o.casinoName ?? o.casinoId)}</TableCell>
                    <TableCell className="text-right tabular-nums">{n(o.activePlayers)}</TableCell>
                    <TableCell className="text-right tabular-nums">{n(o.monitored)}</TableCell>
                    <TableCell className="text-right tabular-nums">{n(o.interventions)}</TableCell>
                    <TableCell><Badge variant={o.complianceStatus === 'attention' ? 'destructive' : o.complianceStatus === 'monitor' ? 'default' : 'secondary'}>{String(o.complianceStatus ?? 'clear')}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
