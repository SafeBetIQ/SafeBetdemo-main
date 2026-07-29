'use client';

// ─── Casino Integration — Management & Health (v1.1) ─────────────────────────
// Consumes the existing Consumer Platform (`view=integration`). No parallel
// management application: this is a presentation surface over the certified
// gateway. Connectors submit through the ONE Event Platform (connector-ingest).

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/DashboardLayout';
import { CasinoAdminGuard } from '@/components/CasinoAdminGuard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Plug, RefreshCw, PlayCircle, CheckCircle2, AlertTriangle, ArrowRight, Activity } from 'lucide-react';

interface IntegrationHealth {
  casinoId: string; runs: number; received: number; submitted: number; rejected: number; failed: number;
  lastRunAt: string | null;
  connectors: { connectorType: string; connectorName: string; received: number; submitted: number; rejected: number; failed: number; lastRunAt: string | null }[];
  recentDiagnostics: { connectorName: string; finishedAt: string; diagnostics: { severity: string; code: string; message: string; hint: string }[] }[];
}

export default function IntegrationPage() {
  const { user } = useAuth();
  const casinoId = (user as unknown as Record<string, unknown>)?.casino_id as string | undefined;
  const [health, setHealth] = useState<IntegrationHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  const authFetch = useCallback(async (path: string, init?: RequestInit) => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!token || !url || !key) return null;
    const res = await fetch(`${url}/functions/v1/${path}`, {
      ...init, headers: { Authorization: `Bearer ${token}`, apikey: key, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    return res.ok ? res.json() : null;
  }, []);

  const refresh = useCallback(async () => {
    if (!casinoId) return;
    setLoading(true);
    const body = await authFetch(`consumer-gateway?view=integration&casino_id=${casinoId}&version=v1`);
    if (body?.data) setHealth(body.data as IntegrationHealth);
    setLoading(false);
  }, [casinoId, authFetch]);

  useEffect(() => { refresh(); }, [refresh]);

  const runTestImport = useCallback(async () => {
    if (!casinoId) return;
    setTesting(true);
    const now = Date.now();
    const records = [
      { player_card: 'demo-loyalty-1', session: `it-${now}`, machine: '5', ts: new Date().toISOString(), type: 'allocate', txn_id: `it-a-${now}` },
      { player_card: 'demo-loyalty-1', session: `it-${now}`, machine: '5', ts: new Date().toISOString(), type: 'spin', wager: 75, game: 'slots', machine_type: 'slot', zone: 'Zone A – Slots', txn_id: `it-b-${now}` },
      { machine: '5', ts: 'not-a-date', type: 'spin', txn_id: `it-c-${now}` }, // deliberately bad → diagnostic
    ];
    const summary = await authFetch('connector-ingest', {
      method: 'POST', body: JSON.stringify({ casino_id: casinoId, connector_type: 'slot-management', records }),
    });
    if (summary?.success) {
      toast.success(`Test import: ${summary.submitted} submitted, ${summary.rejected} rejected, ${summary.failed} failed`);
    } else {
      toast.error('Test import failed — check connector configuration');
    }
    setTesting(false);
    refresh();
  }, [casinoId, authFetch, refresh]);

  const Stat = ({ label, value, tone }: { label: string; value: number | string; tone?: string }) => (
    <div className="rounded-lg border p-4">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className={`text-xs uppercase tracking-wide ${tone ?? 'text-muted-foreground'}`}>{label}</div>
    </div>
  );

  return (
    <CasinoAdminGuard>
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2"><Plug className="h-6 w-6" /> Casino Integration</h1>
              <p className="text-muted-foreground">Connector health &amp; throughput — every event enters through the certified enterprise flow.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={refresh} disabled={loading}><RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh</Button>
              <Button onClick={runTestImport} disabled={testing}><PlayCircle className="h-4 w-4 mr-1" /> {testing ? 'Importing…' : 'Run test import'}</Button>
              <Link href="/casino/integration/onboarding"><Button variant="secondary">Onboarding wizard <ArrowRight className="h-4 w-4 ml-1" /></Button></Link>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Stat label="Runs" value={health?.runs ?? 0} />
            <Stat label="Received" value={health?.received ?? 0} />
            <Stat label="Submitted" value={health?.submitted ?? 0} tone="text-green-600" />
            <Stat label="Rejected (data quality)" value={health?.rejected ?? 0} tone="text-amber-600" />
            <Stat label="Failed (validation)" value={health?.failed ?? 0} tone="text-red-600" />
          </div>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Connectors</CardTitle>
              <CardDescription>Last run: {health?.lastRunAt ? new Date(health.lastRunAt).toLocaleString() : '—'}</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {(health?.connectors ?? []).length === 0 && <p className="text-sm text-muted-foreground">No connector runs yet. Run a test import or configure a connector via the onboarding wizard.</p>}
              {(health?.connectors ?? []).map((c) => (
                <div key={c.connectorType + c.connectorName} className="flex items-center justify-between rounded-lg border p-3">
                  <div><div className="font-medium">{c.connectorName}</div><div className="text-xs text-muted-foreground">{c.connectorType}</div></div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> {c.submitted}</span>
                    <span className="text-amber-600">{c.rejected} rej</span>
                    <span className="text-red-600">{c.failed} fail</span>
                    <Badge variant={c.failed > 0 ? 'destructive' : 'secondary'}>{c.failed > 0 ? 'attention' : 'healthy'}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Recent diagnostics</CardTitle>
              <CardDescription>Actionable feed-quality issues to fix at the source.</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {(health?.recentDiagnostics ?? []).flatMap(r => r.diagnostics).length === 0 && <p className="text-sm text-muted-foreground">No diagnostics — feed is clean.</p>}
              {(health?.recentDiagnostics ?? []).flatMap((r) => r.diagnostics.map((d, i) => (
                <div key={r.finishedAt + i} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant={d.severity === 'error' ? 'destructive' : 'outline'}>{d.severity}</Badge>
                    <span className="font-mono text-xs">{d.code}</span>
                  </div>
                  <div className="mt-1">{d.message}</div>
                  <div className="text-xs text-muted-foreground mt-1">→ {d.hint}</div>
                </div>
              )))}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </CasinoAdminGuard>
  );
}
