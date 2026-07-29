'use client';

// ─── Certified Evidence drill-down ───────────────────────────────────────────
// Opens an authorised, JWT-scoped evidence view for a dashboard card. Every
// value is served by the evidence-gateway (certified projections); the page
// only renders — it computes no metric. Aggregates reconcile to the dashboard
// card at the same snapshot; missing data shows "—", never a false 0.

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/DashboardLayout';
import { CasinoAdminGuard } from '@/components/CasinoAdminGuard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { evGet, evExportUrl } from '@/lib/consumerClient';
import { ArrowLeft, Download, CircleCheck, CircleAlert, HelpCircle } from 'lucide-react';

type Rec = Record<string, unknown>;
const money = (v: unknown) => 'R ' + (Number(v ?? 0) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

function EvidenceInner() {
  const sp = useSearchParams();
  const domain = (sp.get('domain') ?? 'financial') as 'financial' | 'session' | 'player' | 'machine';
  const period = sp.get('period') ?? 'today';
  const posture = sp.get('posture') ?? undefined;
  const risk = sp.get('risk') ?? undefined;
  const [env, setEnv] = useState<Rec | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const refresh = useCallback(async () => {
    setLoading(true);
    const e = await evGet(domain, { period, posture, risk, page: String(page), pageSize: '25' });
    setEnv(e as Rec); setLoading(false);
  }, [domain, period, posture, risk, page]);
  useEffect(() => { refresh(); }, [refresh]);

  const agg = (env?.aggregates ?? {}) as Rec;
  const records = (env?.records ?? []) as Rec[];
  const recon = (env?.reconciliation ?? { status: 'unavailable', checks: [] }) as Rec;
  const snap = (env?.snapshot ?? {}) as Rec;
  const pag = (env?.pagination ?? {}) as Rec;
  const columns = records.length ? Object.keys(records[0]) : [];
  const available = env != null && snap.dataStatus !== 'unavailable';

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <Button asChild variant="ghost" size="sm"><Link href="/casino/dashboard"><ArrowLeft className="h-4 w-4 mr-1" /> Dashboard</Link></Button>
          <h1 className="text-xl font-bold capitalize mt-1">{domain} evidence · {period}</h1>
        </div>
        <div className="flex items-center gap-2">
          {recon.status === 'passed' && <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-600"><CircleCheck className="h-3 w-3" /> Reconciled</Badge>}
          {recon.status === 'failed' && <Badge variant="destructive" className="gap-1"><CircleAlert className="h-3 w-3" /> Reconciliation failed</Badge>}
          {recon.status === 'unavailable' && <Badge variant="outline" className="gap-1 text-muted-foreground"><HelpCircle className="h-3 w-3" /> Unavailable</Badge>}
          <Button asChild variant="outline" size="sm"><a href={evExportUrl(domain, { period, posture, risk })}><Download className="h-4 w-4 mr-1" /> Export CSV</a></Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Certified aggregates</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(agg).map(([k, v]) => (
            <div key={k} className="rounded border p-2">
              <div className="text-[11px] text-muted-foreground">{k}</div>
              <div className="text-lg font-semibold tabular-nums">
                {v == null ? 'not supported' : /ggr|stake|winning/i.test(k) ? money(v) : String(v)}
              </div>
            </div>
          ))}
          {!available && <div className="text-sm text-muted-foreground col-span-full">No certified evidence for this scope — shown as “—”, not zero.</div>}
        </CardContent>
      </Card>

      <div className="text-[11px] text-muted-foreground/70">
        Snapshot {snap.snapshotAt ? new Date(String(snap.snapshotAt)).toLocaleString('en-ZA') : '—'} · status {String(snap.dataStatus ?? '—')} · tz {String(snap.timezone ?? '—')} · {String(pag.totalRecords ?? 0)} records
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Evidence records</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : records.length === 0 ? <p className="text-sm text-muted-foreground">No records.</p> : (
            <table className="w-full text-xs">
              <thead><tr className="border-b text-left text-muted-foreground">{columns.map((c) => <th key={c} className="py-1.5 pr-3 font-medium">{c}</th>)}</tr></thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={i} className="border-b last:border-0">
                    {columns.map((c) => <td key={c} className="py-1.5 pr-3 font-mono truncate max-w-[16rem]">{r[c] == null ? '—' : String(r[c])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {Number(pag.totalPages ?? 0) > 1 && (
            <div className="flex items-center gap-2 mt-3">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
              <span className="text-xs text-muted-foreground">Page {String(pag.page)} / {String(pag.totalPages)}</span>
              <Button size="sm" variant="outline" disabled={page >= Number(pag.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function EvidencePage() {
  return (
    <CasinoAdminGuard>
      <DashboardLayout>
        <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading evidence…</div>}>
          <EvidenceInner />
        </Suspense>
      </DashboardLayout>
    </CasinoAdminGuard>
  );
}
