'use client';

// ─── Explainable Intelligence Centre (v1.4) ──────────────────────────────────
// Explains the EXISTING Domain Intelligence output — never recalculates.
// Consumes the Consumer Platform explanation/ai-performance/executive views.
// Every value is labelled Recorded Fact / Derived Intelligence / Policy Decision.

import { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { CasinoAdminGuard } from '@/components/CasinoAdminGuard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Lightbulb, Search, Gauge, Brain, Gavel, Clock, TrendingUp, Building2 } from 'lucide-react';

const CLS: Record<string, string> = {
  'recorded-fact': 'Recorded Fact', 'derived-intelligence': 'Derived Intelligence', 'policy-decision': 'Policy Decision',
};
const STAGE_ICON: Record<string, JSX.Element> = {
  'recorded-fact': <Clock className="h-4 w-4" />, 'derived-intelligence': <Brain className="h-4 w-4" />,
  'policy-decision': <Gavel className="h-4 w-4" />, 'recommended-intervention': <Lightbulb className="h-4 w-4" />,
  'recorded-outcome': <Clock className="h-4 w-4" />,
};

export default function ExplainabilityPage() {
  const { user } = useAuth();
  const casinoId = (user as unknown as Record<string, unknown>)?.casino_id as string | undefined;
  const [playerId, setPlayerId] = useState('');
  const [ex, setEx] = useState<Record<string, unknown> | null>(null);
  const [ai, setAi] = useState<Record<string, unknown> | null>(null);
  const [exec, setExec] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);

  const view = useCallback(async (v: string, extra = '') => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const res = await fetch(`${url}/functions/v1/consumer-gateway?view=${v}&casino_id=${casinoId}${extra}`, { headers: { Authorization: `Bearer ${token}`, apikey: key! } });
    return res.ok ? (await res.json())?.data : null;
  }, [casinoId]);

  useEffect(() => { (async () => { setAi(await view('ai-performance')); setExec(await view('executive-intelligence')); })(); }, [view]);

  const explain = useCallback(async () => {
    if (!playerId) { toast.error('Enter an anonymous SB-PLR id'); return; }
    setBusy(true);
    const data = await view('explanation', `&player_id=${encodeURIComponent(playerId)}`);
    if (data) setEx(data); else toast.error('No explanation (check the player id / scope)');
    setBusy(false);
  }, [view, playerId]);

  const summary = (ex?.summary ?? {}) as Record<string, unknown>;
  const rec = (ex?.recommendation ?? null) as Record<string, unknown> | null;
  const timeline = (ex?.decisionTimeline ?? []) as Record<string, unknown>[];
  const ci = (ex?.contributingIndicators ?? {}) as Record<string, { indicator: string; plainLanguage: string; evidenceClass: string }[]>;
  const support = (ex?.supportingEvidence ?? []) as { plainLanguage: string; evidenceClass: string }[];

  return (
    <CasinoAdminGuard>
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Lightbulb className="h-6 w-6" /> Explainable Intelligence</h1>
            <p className="text-muted-foreground">Understand <b>why</b> — every explanation comes from the certified Domain Intelligence Platform. Nothing is recalculated here.</p>
          </div>

          <Tabs defaultValue="why">
            <TabsList>
              <TabsTrigger value="why"><Search className="h-4 w-4 mr-1" /> Why (per player)</TabsTrigger>
              <TabsTrigger value="performance"><Gauge className="h-4 w-4 mr-1" /> AI Performance</TabsTrigger>
              <TabsTrigger value="executive"><Building2 className="h-4 w-4 mr-1" /> Executive</TabsTrigger>
            </TabsList>

            <TabsContent value="why" className="space-y-4">
              <Card><CardContent className="pt-4 flex gap-2">
                <Input placeholder="SB-PLR-…" value={playerId} onChange={e => setPlayerId(e.target.value)} className="w-80 font-mono" />
                <Button onClick={explain} disabled={busy}><Search className="h-4 w-4 mr-1" /> Explain</Button>
              </CardContent></Card>

              {ex && ex.driverAvailability === 'insufficient' && (
                <Card className="border-muted">
                  <CardHeader><CardTitle className="text-base">No risk drivers on record</CardTitle>
                    <CardDescription>{String(ex.driverNote ?? summary.headline)}</CardDescription></CardHeader>
                </Card>
              )}

              {ex && ex.driverAvailability !== 'insufficient' && (<>
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2">Summary <Badge variant="outline">{CLS['derived-intelligence']}</Badge></CardTitle>
                    <CardDescription>{String(summary.headline)}</CardDescription></CardHeader>
                  <CardContent className="flex flex-wrap gap-3 text-sm">
                    <Badge variant={summary.riskLevel === 'critical' ? 'destructive' : 'secondary'}>risk: {String(summary.riskLevel)}</Badge>
                    <span>score {String(summary.dynamicRiskScore)}</span>
                    <span>confidence {String(summary.confidence)}</span>
                    <span>trend {String(summary.trend)}</span>
                    <Badge variant="outline">source: {String(ex.source)}</Badge>
                  </CardContent>
                </Card>

                <div className="grid md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader><CardTitle className="text-base">Because… (contributing indicators)</CardTitle></CardHeader>
                    <CardContent className="space-y-1">
                      {['behavioural', 'session', 'machine'].flatMap(k => (ci[k] ?? []).map((i, idx) => (
                        <div key={k + idx} className="text-sm flex items-center gap-2"><Badge variant="outline" className="text-[10px]">{CLS[i.evidenceClass]}</Badge> {i.plainLanguage}</div>
                      )))}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-base">Supporting evidence</CardTitle></CardHeader>
                    <CardContent className="space-y-1">
                      {support.map((s, i) => <div key={i} className="text-sm flex items-center gap-2"><Badge variant="outline" className="text-[10px]">{CLS[s.evidenceClass]}</Badge> {s.plainLanguage}</div>)}
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader><CardTitle className="text-base">Decision timeline</CardTitle>
                    <CardDescription>Recorded Fact → Derived Intelligence → Policy Decision → Recommended Intervention → Recorded Outcome</CardDescription></CardHeader>
                  <CardContent className="space-y-2">
                    {timeline.map((s, i) => (
                      <div key={i} className="flex items-start gap-3 text-sm">
                        <span className="mt-0.5">{STAGE_ICON[String(s.stage)]}</span>
                        <div><div className="font-medium">{String(s.label)} <Badge variant="outline" className="text-[10px] ml-1">{String(s.stage)}</Badge></div><div className="text-muted-foreground text-xs">{String(s.detail)}</div></div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {rec && (
                  <Card className="border-amber-300">
                    <CardHeader><CardTitle className="text-base flex items-center gap-2"><Lightbulb className="h-4 w-4" /> Recommendation <Badge variant="outline">{CLS['policy-decision']}</Badge></CardTitle></CardHeader>
                    <CardContent className="space-y-1 text-sm">
                      <div><b>Recommended:</b> {String(rec.action ?? 'continue observation')}</div>
                      <div><b>Because:</b> {String(rec.reason)}</div>
                      <div><b>Confidence:</b> {String(rec.confidence)} · <b>Expected benefit:</b> {String(rec.expectedBenefit)}</div>
                      <div><b>Historical effectiveness:</b> {String(rec.historicalEffectiveness)}</div>
                      <div className="text-amber-700 text-xs pt-1">{String(rec.note)}</div>
                    </CardContent>
                  </Card>
                )}
              </>)}
            </TabsContent>

            <TabsContent value="performance" className="space-y-3">
              <p className="text-sm text-muted-foreground">{String(ai?.note ?? '')}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries((ai?.riskDistribution ?? {}) as Record<string, number>).map(([k, v]) => (
                  <div key={k} className="rounded-lg border p-4"><div className="text-2xl font-semibold">{v}</div><div className="text-xs uppercase text-muted-foreground">{k} risk</div></div>
                ))}
              </div>
              <Card><CardContent className="pt-4 text-sm flex flex-wrap gap-4">
                <span>Interventions recorded: <b>{String((ai?.interventions as Record<string, unknown>)?.recorded ?? 0)}</b></span>
                <span>Avg confidence: <b>{String((ai?.confidenceCalibration as Record<string, unknown>)?.averageConfidence ?? 0)}</b> <Badge variant="outline" className="text-[10px]">Derived Intelligence</Badge></span>
                <span className="flex items-center gap-1"><TrendingUp className="h-4 w-4" /> {String(ai?.predictionTrend ?? '')}</span>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="executive" className="space-y-3">
              <p className="text-sm text-muted-foreground">{String(exec?.note ?? '')}</p>
              <Card>
                <CardHeader><CardTitle className="text-base">Strategic risks <Badge variant="outline" className="text-[10px]">Derived Intelligence</Badge></CardTitle></CardHeader>
                <CardContent className="space-y-1">
                  {((exec?.strategicRisks ?? []) as string[]).length === 0 && <p className="text-sm text-muted-foreground">No strategic risks.</p>}
                  {((exec?.strategicRisks ?? []) as string[]).map((r, i) => <div key={i} className="text-sm">• {r}</div>)}
                </CardContent>
              </Card>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries((exec?.wellbeingIndicators ?? {}) as Record<string, number>).map(([k, v]) => (
                  <div key={k} className="rounded-lg border p-4"><div className="text-2xl font-semibold">{v}</div><div className="text-xs uppercase text-muted-foreground">{k.replace(/([A-Z])/g, ' $1')}</div></div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DashboardLayout>
    </CasinoAdminGuard>
  );
}
