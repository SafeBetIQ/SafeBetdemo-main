'use client';

// ─── Regulator Audit Verification (read-only oversight) ──────────────────────
// A read-only, jurisdiction-scoped view of certified audit-chain integrity.
// Scope is enforced server-side: projection_audit_verification_health is a
// security_invoker view over scope-aware RLS tables, so a regulator sees ONLY
// the chains within their authorised jurisdiction. This is a verification and
// oversight surface — it can never edit events, move checkpoints or repair a
// chain. Verification is performed server-side (sbiq_verify_audit_chain).

import { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { ShieldCheck, RefreshCw, CircleCheck, CircleAlert, HelpCircle, FileText } from 'lucide-react';

type Rec = Record<string, unknown>;
const abbr = (h: unknown) => (h ? String(h).slice(0, 12) + '…' : '—');

function StatusBadge({ s }: { s: string }) {
  if (s === 'healthy') return <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-600"><CircleCheck className="h-3 w-3" /> Verified</Badge>;
  if (s === 'broken') return <Badge variant="destructive" className="gap-1"><CircleAlert className="h-3 w-3" /> Broken</Badge>;
  if (s === 'warning' || s === 'degraded') return <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-600"><CircleAlert className="h-3 w-3" /> {s}</Badge>;
  return <Badge variant="outline" className="gap-1 text-muted-foreground"><HelpCircle className="h-3 w-3" /> Unavailable</Badge>;
}

export default function RegulatorAuditVerificationPage() {
  const [rows, setRows] = useState<Rec[]>([]);
  const [alerts, setAlerts] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<Rec | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [{ data: health }, { data: al }] = await Promise.all([
      supabase.from('projection_audit_verification_health').select('*').order('chain_scope'),
      supabase.from('platform_integrity_alert').select('chain_scope, first_failing_sequence, failure_category, detected_at, resolved').eq('resolved', false),
    ]);
    setRows((health ?? []) as Rec[]);
    setAlerts((al ?? []) as Rec[]);
    setLoading(false);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  // Server-side verification (scope-checked). Produces a verification report.
  const verify = async (scope: string) => {
    const { data } = await supabase.rpc('sbiq_verify_audit_chain', { p_scope: scope });
    setReport({
      reportId: crypto.randomUUID(), environment: 'SafeBet Demo (non-production)',
      generatedAt: new Date().toISOString(), scope, ...(data as Rec),
      internalCheckpoints: 'Active', externalAnchoring: 'Not configured',
      note: 'Chain integrity + sequence continuity for the stated range. This does NOT prove the factual correctness of source events, external anchoring, or regulatory approval.',
    });
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldCheck className="h-6 w-6" /> Audit Integrity Verification</h1>
            <p className="text-muted-foreground text-sm">Read-only oversight of certified audit chains within your authorised jurisdiction.</p>
          </div>
          <Button variant="outline" onClick={refresh} disabled={loading}><RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh</Button>
        </div>

        {alerts.length > 0 && (
          <Card className="border-destructive/50 bg-destructive/5"><CardContent className="pt-4 text-sm">
            <div className="flex items-center gap-2 font-medium text-destructive"><CircleAlert className="h-4 w-4" /> {alerts.length} open integrity alert(s)</div>
            {alerts.map((a, i) => <div key={i} className="text-xs text-muted-foreground mt-1">scope {String(a.chain_scope).slice(0, 12)}… · first failing seq {String(a.first_failing_sequence ?? '—')} · {String(a.failure_category)}</div>)}
          </CardContent></Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">Authorised audit chains</CardTitle>
            <CardDescription>Integrity status derives from a completed independent verification at the current chain head.</CardDescription></CardHeader>
          <CardContent className="overflow-x-auto">
            {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : rows.length === 0 ? <p className="text-sm text-muted-foreground">No chains within your authorised scope.</p> : (
              <table className="w-full text-xs">
                <thead><tr className="border-b text-left text-muted-foreground">
                  {['Scope', 'Type', 'Head seq', 'Verified-through', 'Head hash', 'Last verified', 'Status', ''].map((h) => <th key={h} className="py-2 pr-3 font-medium">{h}</th>)}
                </tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-mono">{r.boundary_type === 'platform' ? 'platform' : String(r.chain_scope).slice(0, 12) + '…'}</td>
                      <td className="py-2 pr-3">{String(r.boundary_type)}</td>
                      <td className="py-2 pr-3 tabular-nums">{String(r.head_sequence ?? '—')}</td>
                      <td className="py-2 pr-3 tabular-nums">{String(r.verified_through_sequence ?? '—')}</td>
                      <td className="py-2 pr-3 font-mono">{abbr(r.head_hash)}</td>
                      <td className="py-2 pr-3">{r.verified_at ? new Date(String(r.verified_at)).toLocaleString('en-ZA') : '—'}</td>
                      <td className="py-2 pr-3"><StatusBadge s={String(r.integrity_status)} /></td>
                      <td className="py-2 pr-3"><Button size="sm" variant="ghost" onClick={() => verify(String(r.chain_scope))}><FileText className="h-3.5 w-3.5 mr-1" /> Verify</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {report && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Verification report</CardTitle>
              <CardDescription>Report {String(report.reportId).slice(0, 8)} · {String(report.environment)}</CardDescription></CardHeader>
            <CardContent className="text-xs font-mono whitespace-pre-wrap break-all">
              {Object.entries(report).map(([k, v]) => <div key={k}><span className="text-muted-foreground">{k}:</span> {String(v)}</div>)}
            </CardContent>
          </Card>
        )}

        <p className="text-[11px] text-muted-foreground/70 border-t pt-3">
          Internal checkpoints: Active · External anchoring: Not configured · SafeBet Demo is a non-production evaluation environment.
        </p>
      </div>
    </DashboardLayout>
  );
}
