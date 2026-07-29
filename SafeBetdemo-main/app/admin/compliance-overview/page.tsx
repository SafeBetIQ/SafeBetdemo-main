'use client';

// ─── Compliance Overview (v1.5.1 convergence) ────────────────────────────────
// Cross-operator compliance posture from the certified Regulator Portal
// (national-overview + operator-compliance). super_admin maps to the
// 'administrator' consumer profile. No compliance_snapshots / direct reads.

import { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { rpGet } from '@/lib/consumerClient';
import { Shield, RefreshCw } from 'lucide-react';

type Rec = Record<string, unknown>;
const n = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0)) || 0;

export default function ComplianceOverviewPage() {
  const [nat, setNat] = useState<Rec | null>(null);
  const [oc, setOc] = useState<Rec | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [a, b] = await Promise.all([rpGet('national-overview'), rpGet('operator-compliance')]);
    setNat(a); setOc(b); setLoading(false);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const operators = (oc?.operators ?? []) as Rec[];
  const attention = operators.filter(o => o.complianceStatus === 'attention').length;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Shield className="h-6 w-6" /> Compliance Overview</h1>
            <p className="text-muted-foreground">Cross-operator compliance posture — certified Regulator Portal, evidence-classified.</p>
          </div>
          <Button variant="outline" onClick={refresh} disabled={loading}><RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh</Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border p-4"><div className="text-3xl font-semibold">{n(nat?.operators ?? operators.length)}</div><div className="text-xs uppercase text-muted-foreground">Operators</div></div>
          <div className="rounded-lg border p-4"><div className="text-3xl font-semibold">{n(nat?.activePlayers)}</div><div className="text-xs uppercase text-muted-foreground">Active players</div></div>
          <div className="rounded-lg border p-4"><div className="text-3xl font-semibold">{n(nat?.playersMonitored)}</div><div className="text-xs uppercase text-muted-foreground">Monitored</div></div>
          <div className="rounded-lg border p-4"><div className={`text-3xl font-semibold ${attention > 0 ? 'text-red-600' : ''}`}>{attention}</div><div className="text-xs uppercase text-muted-foreground">Need attention</div></div>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Operator compliance status</CardTitle><CardDescription>Derived Intelligence from projected risk tiers</CardDescription></CardHeader>
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
