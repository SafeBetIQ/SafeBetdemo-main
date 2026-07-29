'use client';

// ─── Enterprise Regulator Intelligence Portal (v1.2) ─────────────────────────
// A CONSUMER of the certified platform: every value comes from the
// regulator-portal endpoint (Consumer Platform serveRegulator). Nothing is
// calculated in the UI. Anonymous, evidence-classified, jurisdiction-scoped.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { ShieldCheck, Globe, Building2, AlertTriangle, RefreshCw, Search, BarChart3 } from 'lucide-react';

const EVIDENCE_LABEL: Record<string, string> = {
  'recorded-fact': 'Recorded Fact', 'derived-intelligence': 'Derived Intelligence',
  'policy-decision': 'Policy Decision', 'demonstration-data': 'Demonstration Data',
};

export default function RegulatorIntelligencePage() {
  const [nat, setNat] = useState<Record<string, unknown> | null>(null);
  const [cross, setCross] = useState<Record<string, unknown> | null>(null);
  const [ops, setOps] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const portal = useCallback(async (params: string) => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!token || !url || !key) return null;
    const res = await fetch(`${url}/functions/v1/regulator-portal?${params}`, { headers: { Authorization: `Bearer ${token}`, apikey: key } });
    return res.ok ? (await res.json())?.data : null;
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [a, b, c] = await Promise.all([
      portal('view=national-overview'), portal('view=cross-operator'), portal('view=operator-compliance'),
    ]);
    setNat(a); setCross(b); setOps(c);
    if (!a) toast.error('Unable to load regulator intelligence — check your regulator access.');
    setLoading(false);
  }, [portal]);

  useEffect(() => { refresh(); }, [refresh]);

  const n = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0)) || 0;
  const tiers = (nat?.riskTiers ?? {}) as Record<string, number>;

  const Stat = ({ label, value, tone, cls }: { label: string; value: number | string; tone?: string; cls?: string }) => (
    <div className="rounded-lg border p-4">
      <div className={`text-2xl font-semibold tabular-nums ${cls ?? ''}`}>{value}</div>
      <div className={`text-xs uppercase tracking-wide ${tone ?? 'text-muted-foreground'}`}>{label}</div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldCheck className="h-6 w-6" /> Regulator Intelligence</h1>
            <p className="text-muted-foreground">Anonymous national oversight — jurisdiction {String(nat?.jurisdiction ?? '')}. Every value is evidence-classified; no PII.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={refresh} disabled={loading}><RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh</Button>
            <Link href="/regulator/intelligence/investigation"><Button><Search className="h-4 w-4 mr-1" /> Investigation</Button></Link>
          </div>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview"><Globe className="h-4 w-4 mr-1" /> National Overview</TabsTrigger>
            <TabsTrigger value="cross"><BarChart3 className="h-4 w-4 mr-1" /> Cross-Operator</TabsTrigger>
            <TabsTrigger value="compliance"><Building2 className="h-4 w-4 mr-1" /> Operator Compliance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Operators" value={n(nat?.operators)} />
              <Stat label="Active players (anon)" value={n(nat?.activePlayers)} />
              <Stat label="Players monitored" value={n(nat?.playersMonitored)} tone="text-amber-600" />
              <Stat label="Interventions" value={n(nat?.interventions)} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Critical risk" value={n(tiers.critical)} cls="text-red-600" />
              <Stat label="High risk" value={n(tiers.high)} cls="text-orange-600" />
              <Stat label="Medium risk" value={n(tiers.medium)} cls="text-amber-600" />
              <Stat label="Low risk" value={n(tiers.low)} cls="text-green-600" />
            </div>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Emerging risks <Badge variant="outline">{EVIDENCE_LABEL['derived-intelligence']}</Badge></CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {(((nat?.emergingRisks ?? []) as { code: string; detail: string }[]).length === 0) && <p className="text-sm text-muted-foreground">No emerging risks.</p>}
                {((nat?.emergingRisks ?? []) as { code: string; detail: string }[]).map((r, i) => (
                  <div key={i} className="text-sm flex items-center gap-2"><Badge variant="secondary" className="font-mono text-xs">{r.code}</Badge> {r.detail}</div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cross" className="space-y-3">
            <Card><CardContent className="pt-4 text-sm text-muted-foreground">{String(cross?.note ?? '')}</CardContent></Card>
            {((cross?.operators ?? []) as Record<string, unknown>[]).map((o) => {
              const rd = (o.riskDistribution ?? {}) as Record<string, number>;
              return (
                <div key={String(o.casinoId)} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="font-medium">{String(o.name)}</div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-red-600">{n(rd.critical)} crit</span>
                    <span className="text-orange-600">{n(rd.high)} high</span>
                    <span>monitored {n(o.monitored)}</span>
                    <Badge variant="outline">rate {String(o.interventionRate)}</Badge>
                  </div>
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="compliance" className="space-y-3">
            {((ops?.operators ?? []) as Record<string, unknown>[]).map((o) => (
              <div key={String(o.casinoId)} className="flex items-center justify-between rounded-lg border p-3">
                <div><div className="font-medium">{String(o.name)}</div><div className="text-xs text-muted-foreground">{String(o.province ?? '')}</div></div>
                <div className="flex items-center gap-4 text-sm">
                  <span>active {n(o.activePlayers)}</span>
                  <span className="text-amber-600">monitored {n(o.monitored)}</span>
                  <span className="text-red-600">critical {n(o.riskCritical)}</span>
                  <Badge variant={o.complianceStatus === 'attention' ? 'destructive' : o.complianceStatus === 'monitor' ? 'secondary' : 'outline'}>{String(o.complianceStatus)}</Badge>
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
