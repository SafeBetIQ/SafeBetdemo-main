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
import { FileText, RefreshCw, Printer } from 'lucide-react';

type Rec = Record<string, unknown>;
const n = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0)) || 0;

export default function RegulatoryReportsPage() {
  const [nat, setNat] = useState<Rec | null>(null);
  const [oc, setOc] = useState<Rec | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [a, b] = await Promise.all([rpGet('national-overview'), rpGet('operator-compliance')]);
    setNat(a); setOc(b); setLoading(false);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const tiers = (nat?.riskTiers ?? { critical: 0, high: 0, medium: 0, low: 0 }) as Rec;
  const operators = (oc?.operators ?? []) as Rec[];

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
