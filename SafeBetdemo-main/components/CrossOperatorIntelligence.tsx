'use client';

// ─── Cross-Operator Intelligence (v1.5.1 convergence) ────────────────────────
// Repointed onto the certified Regulator Portal `cross-operator` view. This is
// AGGREGATE/cohort-level by design: per-INDIVIDUAL cross-operator linkage is
// denied by the Identity Policy (per-casino anonymous SB-PLR, federation denied
// — ADR-001). The previous implementation read cross_operator_alerts directly
// and fabricated per-player linkage the architecture forbids; that is removed.
// No direct table reads, no writes.

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { rpGet } from '@/lib/consumerClient';
import { Network, RefreshCw, Lock } from 'lucide-react';

type Rec = Record<string, unknown>;
const n = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0)) || 0;

export function CrossOperatorIntelligence() {
  const [data, setData] = useState<Rec | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setData(await rpGet('cross-operator'));
    setLoading(false);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const operators = (data?.operators ?? []) as Rec[];
  const nat = (data?.nationalRiskDistribution ?? { critical: 0, high: 0, medium: 0, low: 0 }) as Rec;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center"><Network className="h-5 w-5 text-white" /></div>
          <div>
            <h2 className="text-xl font-bold">Cross-Operator Intelligence</h2>
            <p className="text-sm text-muted-foreground">Aggregate jurisdiction-wide risk posture — certified Regulator Portal.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}><RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[['Critical', 'critical', 'text-red-600'], ['High', 'high', 'text-orange-600'], ['Medium', 'medium', 'text-amber-600'], ['Low', 'low', 'text-emerald-600']].map(([label, key, tone]) => (
          <Card key={key as string}><CardContent className="pt-4"><p className="text-xs text-muted-foreground">{label} risk (national)</p><p className={`text-3xl font-bold ${tone}`}>{n(nat[key as string])}</p></CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Per-operator risk distribution</CardTitle>
          <CardDescription>Recorded Fact + Derived Intelligence (intervention rate per active player)</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Operator</TableHead><TableHead className="text-right">Critical</TableHead><TableHead className="text-right">High</TableHead><TableHead className="text-right">Monitored</TableHead><TableHead className="text-right">Interventions</TableHead><TableHead className="text-right">Rate</TableHead></TableRow></TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>}
              {!loading && operators.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No operators in scope.</TableCell></TableRow>}
              {operators.map((o, i) => {
                const rd = (o.riskDistribution ?? {}) as Rec;
                return (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{String(o.name)}</TableCell>
                    <TableCell className="text-right"><Badge variant={n(rd.critical) > 0 ? 'destructive' : 'secondary'}>{n(rd.critical)}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">{n(rd.high)}</TableCell>
                    <TableCell className="text-right tabular-nums">{n(o.monitored)}</TableCell>
                    <TableCell className="text-right tabular-nums">{n(o.interventions)}</TableCell>
                    <TableCell className="text-right tabular-nums">{n(o.interventionRate)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-dashed bg-muted/20">
        <CardContent className="py-3">
          <div className="flex items-start gap-2">
            <Lock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              <strong>Privacy by design:</strong> {String(data?.note ?? 'Per-individual cross-operator linkage is not available by design — the anonymous SB-PLR identity is per-operator and federation is denied by the Identity Policy (ADR-001). Cross-operator intelligence is aggregate/cohort-level only.')}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
