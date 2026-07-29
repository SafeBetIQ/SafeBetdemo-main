'use client';

// ─── Regulator Investigation Workspace + Evidence Package (v1.2) ─────────────
// Consumes the regulator-portal endpoint. Every value is traceable to an
// evidence class; the raw event timeline is Recorded Fact, intelligence is
// Derived, decisions are Policy Decisions. Anonymous SB-PLR only; no PII.

import { useCallback, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Search, FileBadge, Clock, Brain, Gavel, ShieldCheck } from 'lucide-react';

const EVIDENCE_LABEL: Record<string, string> = {
  'recorded-fact': 'Recorded Fact', 'derived-intelligence': 'Derived Intelligence', 'policy-decision': 'Policy Decision',
};

export default function InvestigationPage() {
  const [playerId, setPlayerId] = useState('');
  const [casinoId, setCasinoId] = useState('');
  const [inv, setInv] = useState<Record<string, unknown> | null>(null);
  const [pkg, setPkg] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);

  const call = useCallback(async (view: string) => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const res = await fetch(`${url}/functions/v1/regulator-portal?view=${view}&player_id=${encodeURIComponent(playerId)}&casino_id=${encodeURIComponent(casinoId)}`,
      { headers: { Authorization: `Bearer ${token}`, apikey: key! } });
    return res.ok ? (await res.json())?.data : null;
  }, [playerId, casinoId]);

  const investigate = useCallback(async () => {
    if (!playerId || !casinoId) { toast.error('Enter an anonymous SB-PLR id and casino id'); return; }
    setBusy(true); setPkg(null);
    const data = await call('investigation');
    if (data) setInv(data); else toast.error('No investigation data (check scope / ids)');
    setBusy(false);
  }, [call, playerId, casinoId]);

  const buildPackage = useCallback(async () => {
    setBusy(true);
    const data = await call('evidence-package');
    if (data) { setPkg(data); toast.success('Evidence package generated'); }
    setBusy(false);
  }, [call]);

  const timeline = (inv?.timeline ?? []) as Record<string, unknown>[];
  const decisions = (inv?.decisions ?? []) as Record<string, unknown>[];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Search className="h-6 w-6" /> Investigation Workspace</h1>
          <p className="text-muted-foreground">Anonymous, evidence-traceable investigation. Deterministically replayable from the immutable event log.</p>
        </div>

        <Card>
          <CardHeader><CardTitle>Open an investigation</CardTitle>
            <CardDescription>Enter an anonymous SB-PLR id and an in-jurisdiction casino id.</CardDescription></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Input placeholder="SB-PLR-…" value={playerId} onChange={e => setPlayerId(e.target.value)} className="w-72 font-mono" />
            <Input placeholder="casino id (uuid)" value={casinoId} onChange={e => setCasinoId(e.target.value)} className="w-80 font-mono" />
            <Button onClick={investigate} disabled={busy}><Search className="h-4 w-4 mr-1" /> Investigate</Button>
            {inv && <Button variant="secondary" onClick={buildPackage} disabled={busy}><FileBadge className="h-4 w-4 mr-1" /> Build evidence package</Button>}
          </CardContent>
        </Card>

        {inv && (
          <>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Event Timeline <Badge variant="outline">{EVIDENCE_LABEL['recorded-fact']}</Badge></CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {timeline.length === 0 && <p className="text-sm text-muted-foreground">No events for this anonymous player in scope.</p>}
                {timeline.map((e, i) => (
                  <div key={i} className="text-sm flex items-center gap-3 border-b py-1">
                    <span className="font-mono text-xs text-muted-foreground w-40">{new Date(String(e.occurredAt)).toLocaleString()}</span>
                    <Badge variant="secondary" className="font-mono text-xs">{String(e.eventType)}</Badge>
                    <span className="text-xs">{String(e.machineId ?? '')}</span>
                    {(e.amounts as { bet: number })?.bet ? <span className="text-xs">bet {(e.amounts as { bet: number }).bet}</span> : null}
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5" /> Intelligence <Badge variant="outline">{EVIDENCE_LABEL['derived-intelligence']}</Badge></CardTitle></CardHeader>
                <CardContent><pre className="text-xs bg-muted rounded p-2 overflow-x-auto">{JSON.stringify(inv.intelligence ?? {}, null, 1).slice(0, 1200)}</pre></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Gavel className="h-5 w-5" /> Policy Decisions <Badge variant="outline">{EVIDENCE_LABEL['policy-decision']}</Badge></CardTitle></CardHeader>
                <CardContent className="space-y-1">
                  {decisions.length === 0 && <p className="text-sm text-muted-foreground">No decisions.</p>}
                  {decisions.map((d, i) => (
                    <div key={i} className="text-sm border-b py-1">
                      <Badge variant={String(d.priority) === 'critical' ? 'destructive' : 'secondary'}>{String(d.action)}</Badge>
                      <span className="ml-2 text-xs">{String(d.policyReference)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {pkg && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Evidence Package {String(pkg.packageId)}</CardTitle>
              <CardDescription>{String(pkg.attestation)}</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {((pkg.sections ?? []) as Record<string, unknown>[]).map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-sm border-b py-1">
                  <Badge variant="outline">{EVIDENCE_LABEL[String(s.evidenceClass)] ?? String(s.evidenceClass)}</Badge>
                  <span className="font-medium">{String(s.title)}</span>
                </div>
              ))}
              <Button variant="outline" onClick={() => {
                const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${String(pkg.packageId)}.json`; a.click();
              }}>Export package (JSON)</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
