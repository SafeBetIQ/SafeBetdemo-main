'use client';

// ─── Player Investigation (v1.5.1 convergence) ───────────────────────────────
// Repointed onto the certified Consumer Platform `explanation` view — the same
// per-player evidence the Explainable Intelligence Centre shows. No direct
// table reads; every value traces to Recorded Fact / Derived Intelligence /
// Policy Decision. The route param is the anonymous SB-PLR id.

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '@/components/DashboardLayout';
import { CasinoAdminGuard } from '@/components/CasinoAdminGuard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { cgGet, EVIDENCE_LABEL } from '@/lib/consumerClient';
import { Search, Clock, Brain, Gavel, Lightbulb, CheckCircle2, ArrowLeft, Briefcase } from 'lucide-react';

type Rec = Record<string, unknown>;
const STAGE_ICON: Record<string, JSX.Element> = {
  'recorded-fact': <Clock className="h-4 w-4" />, 'derived-intelligence': <Brain className="h-4 w-4" />,
  'policy-decision': <Gavel className="h-4 w-4" />, 'recommended-intervention': <Lightbulb className="h-4 w-4" />,
  'recorded-outcome': <CheckCircle2 className="h-4 w-4" />,
};

export default function InvestigatePage() {
  const params = useParams();
  const playerId = decodeURIComponent(String(params?.id ?? ''));
  const { user } = useAuth();
  const casinoId = (user as unknown as Rec)?.casino_id as string | undefined;
  const [ex, setEx] = useState<Rec | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setEx(await cgGet('explanation', { casino_id: casinoId, player_id: playerId }));
    setLoading(false);
  }, [casinoId, playerId]);
  useEffect(() => { load(); }, [load]);

  const summary = (ex?.summary ?? {}) as Rec;
  const timeline = (ex?.decisionTimeline ?? []) as Rec[];
  const ci = (ex?.contributingIndicators ?? {}) as Record<string, { plainLanguage: string; evidenceClass: string }[]>;
  const support = (ex?.supportingEvidence ?? []) as { plainLanguage: string; evidenceClass: string }[];
  const rec = (ex?.recommendation ?? null) as Rec | null;

  return (
    <CasinoAdminGuard>
      <DashboardLayout>
        <div className="p-6 space-y-5 max-w-4xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2"><Search className="h-6 w-6" /> Player Investigation</h1>
              <p className="text-muted-foreground font-mono text-sm">{playerId}</p>
            </div>
            <Button asChild variant="outline"><Link href="/casino/players"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link></Button>
          </div>

          {loading && <p className="text-sm text-muted-foreground">Loading certified evidence…</p>}
          {!loading && !ex && <Card><CardContent className="pt-6 text-sm text-muted-foreground">No certified evidence for this player id in scope.</CardContent></Card>}

          {ex && (<>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2">Summary <Badge variant="outline">{EVIDENCE_LABEL['derived-intelligence']}</Badge></CardTitle>
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
                <CardHeader><CardTitle className="text-base">Contributing indicators</CardTitle></CardHeader>
                <CardContent className="space-y-1">
                  {['behavioural', 'session', 'machine'].flatMap(k => (ci[k] ?? []).map((i, idx) => (
                    <div key={k + idx} className="text-sm flex items-center gap-2"><Badge variant="outline" className="text-[10px]">{EVIDENCE_LABEL[i.evidenceClass]}</Badge> {i.plainLanguage}</div>
                  )))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Supporting evidence</CardTitle></CardHeader>
                <CardContent className="space-y-1">
                  {support.map((s, i) => <div key={i} className="text-sm flex items-center gap-2"><Badge variant="outline" className="text-[10px]">{EVIDENCE_LABEL[s.evidenceClass]}</Badge> {s.plainLanguage}</div>)}
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
                    <div><div className="font-medium">{String(s.label)}</div><div className="text-muted-foreground text-xs">{String(s.detail)}</div></div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {rec && (
              <Card className="border-amber-300">
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Lightbulb className="h-4 w-4" /> Recommendation <Badge variant="outline">{EVIDENCE_LABEL['policy-decision']}</Badge></CardTitle></CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div><b>Recommended:</b> {String(rec.action ?? 'continue observation')}</div>
                  <div><b>Because:</b> {String(rec.reason)}</div>
                  <div className="text-amber-700 text-xs pt-1">{String(rec.note)}</div>
                </CardContent>
              </Card>
            )}

            <Button asChild><Link href="/casino/cases"><Briefcase className="h-4 w-4 mr-1" /> Open a case for this player</Link></Button>
          </>)}
        </div>
      </DashboardLayout>
    </CasinoAdminGuard>
  );
}
