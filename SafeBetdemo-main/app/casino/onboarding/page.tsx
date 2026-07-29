'use client';

// ─── Customer Onboarding Centre + Welcome (v1.3) ─────────────────────────────
// Guided operator onboarding (WS1) + first-run welcome & readiness (WS7).
// Consumes the commerce endpoint (commercial metadata) and the certified
// Connector Framework. No SQL, no manual DB work — configuration only.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/DashboardLayout';
import { CasinoAdminGuard } from '@/components/CasinoAdminGuard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Rocket, CheckCircle2, Circle, ArrowRight, PartyPopper } from 'lucide-react';

interface Step { key: string; title: string; capability: string; done: boolean; current: boolean }
interface Status {
  onboarding: { steps: Step[]; percent: number; currentStep: string | null; activated: boolean };
  licence: { plan: string; status: string; active: boolean; daysToExpiry: number | null } | null;
  pilot: { status: string; readinessScore: number; goLiveRecommended: boolean } | null;
}

export default function OnboardingCentre() {
  const { user } = useAuth();
  const casinoId = (user as unknown as Record<string, unknown>)?.casino_id as string | undefined;
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);

  const api = useCallback(async (path: string, init?: RequestInit) => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const res = await fetch(`${url}/functions/v1/commerce${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, apikey: key!, 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
    return res.ok ? res.json() : null;
  }, []);

  const refresh = useCallback(async () => {
    if (!casinoId) return;
    const s = await api(`?action=my-status&casino_id=${casinoId}`);
    if (s?.success) setStatus(s as Status);
  }, [casinoId, api]);
  useEffect(() => { refresh(); }, [refresh]);

  const toggleStep = useCallback(async (key: string, done: boolean) => {
    if (!casinoId) return;
    setBusy(true);
    await api(`?action=onboarding-step`, { method: 'POST', body: JSON.stringify({ casino_id: casinoId, step: key, done }) });
    await refresh();
    setBusy(false);
  }, [casinoId, api, refresh]);

  const ob = status?.onboarding;

  return (
    <CasinoAdminGuard>
      <DashboardLayout>
        <div className="p-6 space-y-6 max-w-3xl">
          {/* Welcome / first-run (WS7) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><PartyPopper className="h-6 w-6" /> Welcome to SafeBet IQ</CardTitle>
              <CardDescription>Let's get your casino connected. Follow the guided steps — no SQL, no database work, just configuration. Every step maps to a certified platform capability.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Progress value={ob?.percent ?? 0} className="flex-1" />
                <span className="text-sm font-medium tabular-nums">{ob?.percent ?? 0}%</span>
                {ob?.activated
                  ? <Badge variant="outline" className="text-green-600">Production active</Badge>
                  : <Badge variant="secondary">Onboarding</Badge>}
              </div>
              {status?.licence && (
                <div className="mt-3 text-sm flex items-center gap-2">
                  <Badge variant="secondary">{status.licence.plan}</Badge>
                  <Badge variant={status.licence.active ? 'outline' : 'destructive'}>{status.licence.status}</Badge>
                  {status.licence.daysToExpiry != null && <span className={status.licence.daysToExpiry <= 7 ? 'text-amber-600' : 'text-muted-foreground'}>{status.licence.daysToExpiry} days remaining</span>}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Rocket className="h-5 w-5" /> Onboarding steps</CardTitle>
              <CardDescription>Mark each step complete as you finish it. Use the Integration wizard and certification checklist along the way.</CardDescription></CardHeader>
            <CardContent className="space-y-1">
              {(ob?.steps ?? []).map(s => (
                <div key={s.key} className={`flex items-center justify-between rounded-lg border p-3 ${s.current ? 'border-blue-400 bg-blue-50/40' : ''}`}>
                  <div className="flex items-center gap-3">
                    {s.done ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <Circle className={`h-5 w-5 ${s.current ? 'text-blue-600' : 'text-muted-foreground'}`} />}
                    <div><div className="font-medium">{s.title}</div><div className="text-xs text-muted-foreground">{s.capability}</div></div>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.key === 'test-ingestion' && <Link href="/casino/integration/onboarding"><Button size="sm" variant="ghost">Open wizard <ArrowRight className="h-3 w-3 ml-1" /></Button></Link>}
                    <Button size="sm" variant={s.done ? 'ghost' : 'outline'} disabled={busy} onClick={() => toggleStep(s.key, !s.done)}>{s.done ? 'Undo' : 'Mark done'}</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Link href="/casino/integration"><Button variant="secondary">Integration Health</Button></Link>
            <Link href="/casino/dashboard"><Button variant="outline">Go to dashboard <ArrowRight className="h-4 w-4 ml-1" /></Button></Link>
          </div>
        </div>
      </DashboardLayout>
    </CasinoAdminGuard>
  );
}
