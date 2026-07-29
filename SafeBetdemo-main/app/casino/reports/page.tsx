'use client';

// ─── Reporting Centre (v1.5.1 convergence) ───────────────────────────────────
// Reports COMPOSE certified Consumer Platform views (summary + compliance) —
// they recalculate nothing and read no tables directly. Same numbers as every
// other screen. Printable for distribution.

import { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { CasinoAdminGuard } from '@/components/CasinoAdminGuard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { cgGet } from '@/lib/consumerClient';
import { FileText, RefreshCw, Printer } from 'lucide-react';

type Rec = Record<string, unknown>;
const n = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0)) || 0;

export default function ReportingCentrePage() {
  const { user } = useAuth();
  const casinoId = (user as unknown as Rec)?.casino_id as string | undefined;
  const [summary, setSummary] = useState<Rec | null>(null);
  const [compliance, setCompliance] = useState<Rec | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [s, c] = await Promise.all([
      cgGet('summary', { casino_id: casinoId }),
      cgGet('compliance', { casino_id: casinoId }),
    ]);
    setSummary(s); setCompliance(c); setLoading(false);
  }, [casinoId]);
  useEffect(() => { refresh(); }, [refresh]);

  const kpi = (summary?.kpi ?? {}) as Rec;
  const tiers = (compliance?.riskTiers ?? { critical: 0, high: 0, medium: 0, low: 0 }) as Rec;
  const monitored = (compliance?.playersRequiringMonitoring ?? []) as Rec[];
  const decisions = (compliance?.regulatoryDecisions ?? summary?.headlineDecisions ?? []) as Rec[];

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

          <Card>
            <CardHeader><CardTitle className="text-base">Responsible Gambling posture report</CardTitle>
              <CardDescription>Generated {new Date().toLocaleString()} · Recorded Fact + Derived Intelligence</CardDescription></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border p-4"><div className="text-2xl font-semibold">{n(kpi.active_players)}</div><div className="text-xs uppercase text-muted-foreground">Active players</div></div>
              <div className="rounded-lg border p-4"><div className="text-2xl font-semibold">R {n(kpi.ggr).toLocaleString()}</div><div className="text-xs uppercase text-muted-foreground">GGR</div></div>
              <div className="rounded-lg border p-4"><div className="text-2xl font-semibold text-red-600">{n(tiers.critical)}</div><div className="text-xs uppercase text-muted-foreground">Critical risk</div></div>
              <div className="rounded-lg border p-4"><div className="text-2xl font-semibold text-orange-600">{n(tiers.high)}</div><div className="text-xs uppercase text-muted-foreground">High risk</div></div>
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
              <CardHeader><CardTitle className="text-base">Policy decisions</CardTitle><CardDescription>Policy Decision</CardDescription></CardHeader>
              <CardContent className="space-y-1">
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
