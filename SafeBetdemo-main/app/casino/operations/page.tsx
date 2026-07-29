'use client';

// ─── Executive Operations Dashboard (v1.5, WS5) ──────────────────────────────
// Operational KPIs composed from workflow case/task METADATA only. No runtime
// state, no intelligence recomputation — open/overdue cases, SLA performance,
// completion rates, outstanding investigations and bottlenecks.

import { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { CasinoAdminGuard } from '@/components/CasinoAdminGuard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { wfGet } from '@/lib/workflowClient';
import { Gauge, RefreshCw, AlertTriangle, Timer, ClipboardCheck, Activity } from 'lucide-react';

type Rec = Record<string, unknown>;

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-lg border p-4">
      <div className={`text-3xl font-semibold ${tone ?? ''}`}>{value}</div>
      <div className="text-xs uppercase text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

export default function OperationsPage() {
  const { user } = useAuth();
  const casinoId = (user as unknown as Rec)?.casino_id as string | undefined;
  const [ops, setOps] = useState<Rec | null>(null);
  const [rollup, setRollup] = useState<Rec[]>([]);

  const refresh = useCallback(async () => {
    const r = await wfGet('operations', { casino_id: casinoId });
    setOps((r?.operations as Rec) ?? null);
    setRollup((r?.rollup as Rec[]) ?? []);
  }, [casinoId]);
  useEffect(() => { refresh(); }, [refresh]);

  const sla = (ops?.slaPerformance ?? {}) as Rec;
  const iv = (ops?.interventionCompletion ?? {}) as Rec;
  const cc = (ops?.complianceCompletion ?? {}) as Rec;
  const bottlenecks = (ops?.bottlenecks ?? []) as Rec[];
  const byType = (ops?.byType ?? {}) as Record<string, number>;

  return (
    <CasinoAdminGuard>
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2"><Gauge className="h-6 w-6" /> Executive Operations</h1>
              <p className="text-muted-foreground">Operational performance across cases and tasks. Every metric consumes certified workflow metadata — nothing recomputed.</p>
            </div>
            <Button variant="outline" onClick={refresh}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Open cases" value={Number(ops?.openCases ?? 0)} />
            <Stat label="Overdue" value={Number(ops?.overdueCases ?? 0)} tone={Number(ops?.overdueCases ?? 0) > 0 ? 'text-red-600' : ''} />
            <Stat label="Resolved" value={Number(ops?.resolvedCases ?? 0)} />
            <Stat label="Open investigations" value={Number(ops?.outstandingInvestigations ?? 0)} />
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Timer className="h-4 w-4" /> SLA performance</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                <div>On time: <b>{Number(sla.onTime ?? 0)}</b></div>
                <div>Breached: <b>{Number(sla.breached ?? 0)}</b></div>
                <div>Rate: <b>{Math.round(Number(sla.rate ?? 0) * 100)}%</b></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" /> Intervention completion</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                <div>{Number(iv.completed ?? 0)} / {Number(iv.total ?? 0)} cases actioned to outcome</div>
                <div>Rate: <b>{Math.round(Number(iv.rate ?? 0) * 100)}%</b></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><ClipboardCheck className="h-4 w-4" /> Compliance completion</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                <div>{Number(cc.completed ?? 0)} / {Number(cc.total ?? 0)} tasks completed</div>
                <div>Rate: <b>{Math.round(Number(cc.rate ?? 0) * 100)}%</b></div>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Operational bottlenecks</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {bottlenecks.length === 0 && <p className="text-sm text-muted-foreground">No bottlenecks — cases are flowing.</p>}
                {bottlenecks.map((b, i) => (
                  <div key={i} className="text-sm flex justify-between"><span>{String(b.status)}</span><Badge variant="outline">{Number(b.count)}</Badge></div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Cases by type</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {Object.entries(byType).length === 0 && <p className="text-sm text-muted-foreground">No cases yet.</p>}
                {Object.entries(byType).map(([k, v]) => (
                  <div key={k} className="text-sm flex justify-between"><span>{k.replace(/-/g, ' ')}</span><Badge variant="outline">{v}</Badge></div>
                ))}
              </CardContent>
            </Card>
          </div>

          {rollup.length > 1 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Per-operator rollup</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {rollup.map((r, i) => (
                  <div key={i} className="text-sm flex flex-wrap gap-3 border-b py-1 last:border-0">
                    <span className="font-medium min-w-[8rem]">{String(r.casino_name)}</span>
                    <span>open {String(r.open_cases)}</span>
                    <span className={Number(r.overdue_cases) > 0 ? 'text-red-600' : ''}>overdue {String(r.overdue_cases)}</span>
                    <span>investigations {String(r.investigations_open)}</span>
                    <span>compliance {String(r.compliance_completed)}/{String(r.compliance_tasks)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <p className="text-xs text-muted-foreground">{String(ops?.note ?? '')}</p>
        </div>
      </DashboardLayout>
    </CasinoAdminGuard>
  );
}
