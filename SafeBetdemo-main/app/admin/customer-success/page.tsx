'use client';

// ─── Customer Success Command Centre (v1.3) ──────────────────────────────────
// Consumes commercial metadata + certified platform health via the commerce
// endpoint. No duplicate runtime state; no recalculation. Covers Customer
// Success (WS3), Pilots (WS2), Licensing (WS4), and Support/Diagnostics (WS5).

import { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { CasinoAdminGuard } from '@/components/CasinoAdminGuard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Users, HeartPulse, Rocket, BadgeDollarSign, LifeBuoy, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';

interface Operator {
  casinoId: string; name: string; jurisdiction: string;
  plan: string; licenceStatus: string; licenceActive: boolean; daysToExpiry: number | null;
  onboardingPercent: number; onboardingActivated: boolean;
  pilotStatus: string | null; pilotReadiness: number | null;
  connectorRuns: number; connectorFailed: number; eventsInLog: number;
  projectionLagSeconds: number | null; healthState: 'ok' | 'attention' | 'unknown'; warnings: string[];
}

export default function CustomerSuccessPage() {
  const [ops, setOps] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    try {
      const res = await fetch(`${url}/functions/v1/commerce?action=customer-success`, { headers: { Authorization: `Bearer ${token}`, apikey: key! } });
      const body = await res.json();
      if (body?.operators) setOps(body.operators as Operator[]);
      else toast.error('Customer Success requires administrator access.');
    } catch { toast.error('Unable to load Customer Success data.'); }
    setLoading(false);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const health = (s: string) => s === 'ok' ? <Badge variant="outline" className="text-green-600">healthy</Badge>
    : s === 'attention' ? <Badge variant="destructive">attention</Badge> : <Badge variant="secondary">unknown</Badge>;

  const kpi = {
    operators: ops.length,
    active: ops.filter(o => o.licenceActive).length,
    pilots: ops.filter(o => o.pilotStatus && o.pilotStatus !== 'planned').length,
    attention: ops.filter(o => o.healthState === 'attention').length,
  };

  return (
    <CasinoAdminGuard>
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2"><HeartPulse className="h-6 w-6" /> Customer Success</h1>
              <p className="text-muted-foreground">Every deployment at a glance — licences, onboarding, pilots, and platform health. Consumes the certified platform.</p>
            </div>
            <Button variant="outline" onClick={refresh} disabled={loading}><RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh</Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[['Connected casinos', kpi.operators], ['Active licences', kpi.active], ['Live/active pilots', kpi.pilots], ['Need attention', kpi.attention]].map(([l, v]) => (
              <div key={l as string} className="rounded-lg border p-4"><div className="text-2xl font-semibold">{v as number}</div><div className="text-xs uppercase tracking-wide text-muted-foreground">{l as string}</div></div>
            ))}
          </div>

          <Tabs defaultValue="operators">
            <TabsList>
              <TabsTrigger value="operators"><Users className="h-4 w-4 mr-1" /> Operators</TabsTrigger>
              <TabsTrigger value="pilots"><Rocket className="h-4 w-4 mr-1" /> Pilots</TabsTrigger>
              <TabsTrigger value="licensing"><BadgeDollarSign className="h-4 w-4 mr-1" /> Licensing</TabsTrigger>
              <TabsTrigger value="support"><LifeBuoy className="h-4 w-4 mr-1" /> Support</TabsTrigger>
            </TabsList>

            <TabsContent value="operators" className="space-y-2">
              {ops.map(o => (
                <div key={o.casinoId} className="flex items-center justify-between rounded-lg border p-3">
                  <div><div className="font-medium">{o.name}</div><div className="text-xs text-muted-foreground">{o.jurisdiction} · {o.eventsInLog} events · onboarding {o.onboardingPercent}%</div></div>
                  <div className="flex items-center gap-3 text-sm">{health(o.healthState)}<Badge variant="secondary">{o.plan}</Badge>{o.onboardingActivated ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : null}</div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="pilots" className="space-y-2">
              {ops.map(o => (
                <div key={o.casinoId} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="font-medium">{o.name}</div>
                  <div className="flex items-center gap-3 text-sm"><Badge variant="outline">{o.pilotStatus ?? 'planned'}</Badge><span>readiness {o.pilotReadiness ?? 0}%</span></div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="licensing" className="space-y-2">
              {ops.map(o => (
                <div key={o.casinoId} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="font-medium">{o.name}</div>
                  <div className="flex items-center gap-3 text-sm">
                    <Badge variant="secondary">{o.plan}</Badge>
                    <Badge variant={o.licenceActive ? 'outline' : 'destructive'}>{o.licenceStatus}</Badge>
                    {o.daysToExpiry != null && <span className={o.daysToExpiry <= 7 ? 'text-amber-600' : ''}>{o.daysToExpiry}d to expiry</span>}
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="support" className="space-y-2">
              {ops.filter(o => o.warnings.length > 0 || o.connectorFailed > 0).length === 0 && <p className="text-sm text-muted-foreground">No open issues — all operators healthy.</p>}
              {ops.filter(o => o.warnings.length > 0).map(o => (
                <Card key={o.casinoId}>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" /> {o.name}</CardTitle></CardHeader>
                  <CardContent className="space-y-1">
                    {o.warnings.map((w, i) => <div key={i} className="text-sm">• {w}</div>)}
                    <div className="text-xs text-muted-foreground pt-1">connector runs {o.connectorRuns} · failed {o.connectorFailed} · lag {o.projectionLagSeconds != null ? Math.round(o.projectionLagSeconds) + 's' : '—'}</div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        </div>
      </DashboardLayout>
    </CasinoAdminGuard>
  );
}
