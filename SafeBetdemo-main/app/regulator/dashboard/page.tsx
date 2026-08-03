'use client';

// ─── National Intelligence (v1.5.1 convergence) ──────────────────────────────
// Repointed onto the certified Regulator Portal (regulator-portal
// national-overview). Jurisdiction is derived from the verified regulator JWT
// — never a caller claim. Anonymous, evidence-classified, and identical to the
// figures the Regulator Intelligence portal shows. No direct table reads.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { rpGet } from '@/lib/consumerClient';
import { LayoutDashboard, RefreshCw, Building2, AlertTriangle, Network, Scale } from 'lucide-react';

type Rec = Record<string, unknown>;
const n = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0)) || 0;

export default function NationalIntelligencePage() {
  const [nat, setNat] = useState<Rec | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setNat(await rpGet('national-overview'));
    setLoading(false);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const tiers = (nat?.riskTiers ?? { critical: 0, high: 0, medium: 0, low: 0 }) as Rec;
  const health = (nat?.operatorHealth ?? []) as Rec[];
  const emerging = (nat?.emergingRisks ?? []) as Rec[];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><LayoutDashboard className="h-6 w-6" /> National Intelligence</h1>
            <p className="text-muted-foreground">Jurisdiction-wide posture from the certified Regulator Portal — anonymous, evidence-classified.</p>
          </div>
          <Button variant="outline" onClick={refresh} disabled={loading}><RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh</Button>
        </div>

        {!loading && !nat && <Card><CardContent className="pt-6 text-sm text-muted-foreground">Unable to load — verify your regulator access.</CardContent></Card>}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="rounded-lg border p-4"><div className="text-3xl font-semibold">{n(nat?.operators)}</div><div className="text-xs uppercase text-muted-foreground">Operators</div></div>
          {/* Active now = certified freshness-based sum of each casino's active-now (NOT observed). */}
          <div className="rounded-lg border p-4"><div className="text-3xl font-semibold">{n(nat?.activePlayers)}</div><div className="text-xs uppercase text-muted-foreground">Active now</div><div className="text-[10px] text-muted-foreground/70 mt-0.5">freshness window</div></div>
          <div className="rounded-lg border p-4"><div className="text-3xl font-semibold">{n(nat?.observedPlayers)}</div><div className="text-xs uppercase text-muted-foreground">Observed</div><div className="text-[10px] text-muted-foreground/70 mt-0.5">activity projection</div></div>
          <div className="rounded-lg border p-4"><div className="text-3xl font-semibold">{n(nat?.playersMonitored)}</div><div className="text-xs uppercase text-muted-foreground">Monitored</div></div>
          <div className="rounded-lg border p-4"><div className="text-3xl font-semibold">{n(nat?.interventions)}</div><div className="text-xs uppercase text-muted-foreground">Interventions</div></div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[['Critical', 'critical', 'text-red-600'], ['High', 'high', 'text-orange-600'], ['Medium', 'medium', 'text-amber-600'], ['Low', 'low', 'text-emerald-600']].map(([label, key, tone]) => (
            <Card key={key as string}><CardContent className="pt-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{label} risk</span><span className={`text-xl font-semibold ${tone}`}>{n(tiers[key as string])}</span>
            </CardContent></Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" /> Operator health</CardTitle><CardDescription>Recorded Fact (projected)</CardDescription></CardHeader>
            <CardContent className="space-y-1">
              {health.length === 0 && <p className="text-sm text-muted-foreground">No operators in scope.</p>}
              {health.map((o, i) => (
                <div key={i} className="flex items-center justify-between text-sm border-b py-1 last:border-0">
                  <span className="font-medium">{String(o.name)}</span>
                  <span className="flex items-center gap-3 text-muted-foreground"><span>{n(o.activeNow)} active · {n(o.observed)} observed</span><Badge variant={n(o.riskCritical) > 0 ? 'destructive' : 'secondary'}>{n(o.riskCritical)} critical</Badge></span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Emerging risks</CardTitle><CardDescription>Derived Intelligence</CardDescription></CardHeader>
            <CardContent className="space-y-1">
              {emerging.length === 0 && <p className="text-sm text-muted-foreground">No emerging risks.</p>}
              {emerging.map((e, i) => <div key={i} className="text-sm"><Badge variant="outline" className="text-[10px] mr-1">{String(e.code)}</Badge>{String(e.detail)}</div>)}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link href="/regulator/intelligence"><Network className="h-4 w-4 mr-1" /> Regulator Intelligence</Link></Button>
          <Button asChild variant="outline"><Link href="/regulator/cases"><Scale className="h-4 w-4 mr-1" /> Investigations</Link></Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
