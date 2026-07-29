'use client';

// ─── Casino Integration — Onboarding Wizard (v1.1) ───────────────────────────
// Guides a casino IT manager through the 8-step integration workflow. Every
// step maps to a certified capability; the wizard configures SafeBet IQ — it
// never rewrites it. Events flow through the ONE Event Platform.

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/DashboardLayout';
import { CasinoAdminGuard } from '@/components/CasinoAdminGuard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { CheckCircle2, Circle, ArrowRight, ArrowLeft } from 'lucide-react';

const CONNECTOR_TYPES = [
  'loyalty', 'slot-management', 'table-management', 'casino-management',
  'cash-desk', 'rg-system', 'generic-api', 'batch-file',
];

const STEPS = [
  { title: 'Register the casino', body: 'Your casino must exist in the registry with a jurisdiction (e.g. ZA) and province. This is done during operator onboarding; confirm your account is bound to a casino.' },
  { title: 'Choose a connector', body: 'Pick the built-in profile that matches your source system. Profiles are configuration templates — no code required.' },
  { title: 'Map external identifiers', body: 'Map your field names (player reference, machine/table id, session id, timestamp, event type) onto the profile. Player references must be stable and non-PII (loyalty/account keys).' },
  { title: 'Validate connectivity', body: 'Authenticate with your operator JWT and confirm the connector endpoint is reachable and scoped to your casino.' },
  { title: 'Perform a test import', body: 'Submit a small sample batch. Events are translated to the certified CasinoEventDraft contract and enter the enterprise flow. Bad records surface as actionable diagnostics.' },
  { title: 'Review validation results', body: 'Inspect the run summary: received / translated / submitted / rejected / failed, plus diagnostics. Fix any source-side issues.' },
  { title: 'Activate live ingestion', body: 'Point your source system at the connector endpoint. Idempotency keys make retries safe; ordering is by event time.' },
  { title: 'Monitor operational health', body: 'Watch throughput and diagnostics on the Integration Health dashboard; platform monitoring alerts on lag/drift.' },
];

export default function OnboardingWizard() {
  const { user } = useAuth();
  const casinoId = (user as unknown as Record<string, unknown>)?.casino_id as string | undefined;
  const [step, setStep] = useState(0);
  const [connector, setConnector] = useState('slot-management');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);

  const testImport = useCallback(async () => {
    if (!casinoId) return;
    setBusy(true);
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const now = Date.now();
    const records = [
      { player_card: 'wizard-loyalty-1', session: `wz-${now}`, machine: '9', ts: new Date().toISOString(), type: 'allocate', txn_id: `wz-a-${now}` },
      { player_card: 'wizard-loyalty-1', session: `wz-${now}`, machine: '9', ts: new Date().toISOString(), type: 'spin', wager: 40, game: 'slots', machine_type: 'slot', zone: 'Zone A – Slots', txn_id: `wz-b-${now}` },
    ];
    try {
      const res = await fetch(`${url}/functions/v1/connector-ingest`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, apikey: key!, 'Content-Type': 'application/json' },
        body: JSON.stringify({ casino_id: casinoId, connector_type: connector, records }),
      });
      const body = await res.json();
      setResult(body);
      if (body?.success) { toast.success('Test import complete'); setStep(5); }
      else toast.error(body?.error ?? 'Test import failed');
    } catch { toast.error('Connector unreachable'); }
    setBusy(false);
  }, [casinoId, connector]);

  return (
    <CasinoAdminGuard>
      <DashboardLayout>
        <div className="p-6 max-w-3xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Integration Onboarding</h1>
            <p className="text-muted-foreground">Configure SafeBet IQ to receive your casino events — in eight guided steps.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {STEPS.map((s, i) => (
              <button key={i} onClick={() => setStep(i)} className="flex items-center gap-1 text-xs">
                {i < step ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : i === step ? <Circle className="h-4 w-4 text-blue-600 fill-blue-100" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                <span className={i === step ? 'font-semibold' : 'text-muted-foreground'}>{i + 1}</span>
              </button>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Step {step + 1}: {STEPS[step].title}</CardTitle>
              <CardDescription>{STEPS[step].body}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {step === 1 && (
                <div className="flex flex-wrap gap-2">
                  {CONNECTOR_TYPES.map(t => (
                    <Badge key={t} onClick={() => setConnector(t)} variant={connector === t ? 'default' : 'outline'} className="cursor-pointer">{t}</Badge>
                  ))}
                </div>
              )}
              {step === 4 && (
                <div className="space-y-2">
                  <p className="text-sm">Selected connector: <Badge>{connector}</Badge></p>
                  <Button onClick={testImport} disabled={busy}>{busy ? 'Importing…' : 'Run test import'}</Button>
                </div>
              )}
              {step === 5 && result && (
                <pre className="text-xs bg-muted rounded p-3 overflow-x-auto">{JSON.stringify(
                  { received: result.received, translated: result.translated, submitted: result.submitted, rejected: result.rejected, failed: result.failed }, null, 2)}</pre>
              )}
              {step === 7 && (
                <Link href="/casino/integration"><Button variant="secondary">Open Integration Health <ArrowRight className="h-4 w-4 ml-1" /></Button></Link>
              )}
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
                <Button onClick={() => setStep(Math.min(STEPS.length - 1, step + 1))} disabled={step === STEPS.length - 1}>Next <ArrowRight className="h-4 w-4 ml-1" /></Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </CasinoAdminGuard>
  );
}
