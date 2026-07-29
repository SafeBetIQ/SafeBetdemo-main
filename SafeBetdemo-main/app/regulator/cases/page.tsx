'use client';

// ─── Regulatory Investigation Workspace (v1.5, WS4) ──────────────────────────
// Structured investigation workflow for regulators. Jurisdiction-scoped by the
// verified JWT (never a caller claim). Anonymous throughout — cases reference
// SB-PLR ids and evidence-package references, never PII. Consumes the same
// workflow endpoint; the certified evidence itself stays in the Consumer
// Platform (regulator-portal investigation view).

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { wfGet, wfPost, STATUS_TONE } from '@/lib/workflowClient';
import { Scale, Plus, RefreshCw, FileSearch } from 'lucide-react';

type Rec = Record<string, unknown>;

export default function RegulatorCasesPage() {
  const [cases, setCases] = useState<Rec[]>([]);
  const [open, setOpen] = useState<Rec | null>(null);
  const [detail, setDetail] = useState<Rec | null>(null);
  const [draft, setDraft] = useState({ title: '', subject_ref: '', casino_id: '' });
  const [obs, setObs] = useState('');

  const refresh = useCallback(async () => {
    const r = await wfGet('cases', { type: 'regulatory-investigation' });
    setCases((r?.cases as Rec[]) ?? []);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const openCase = useCallback(async (id: string) => {
    const r = await wfGet('case', { id });
    if (r) { setOpen(r.case as Rec); setDetail(r); }
  }, []);

  const create = useCallback(async () => {
    if (!draft.title || !draft.casino_id) { toast.error('Title and operator (casino id) are required'); return; }
    const evidence_refs = draft.subject_ref ? [{ evidenceClass: 'recorded-fact', kind: 'investigation', ref: draft.subject_ref, label: `Anonymous subject ${draft.subject_ref}` }] : [];
    const res = await wfPost('create-case', { casino_id: draft.casino_id, case_type: 'regulatory-investigation', priority: 'high', title: draft.title, subject_kind: 'player', subject_ref: draft.subject_ref, evidence_refs });
    if (res.ok) { toast.success('Investigation opened'); setDraft({ title: '', subject_ref: '', casino_id: '' }); await refresh(); }
    else toast.error(String(res.data?.error ?? 'Failed — check your jurisdiction scope'));
  }, [draft, refresh]);

  const addObservation = useCallback(async () => {
    if (!open || !obs) return;
    const res = await wfPost('note', { id: open.id, note: obs });
    if (res.ok) { toast.success('Observation recorded'); setObs(''); await openCase(String(open.id)); } else toast.error('Failed');
  }, [open, obs, openCase]);

  const resolve = useCallback(async (id: string) => {
    // Investigations move through review → resolved → closed.
    const cur = String(open?.status ?? '');
    const next = cur === 'open' ? 'in-review' : cur === 'in-review' ? 'accepted' : cur === 'accepted' ? 'action-recorded' : cur === 'action-recorded' ? 'outcome-recorded' : cur === 'outcome-recorded' ? 'resolved' : 'closed';
    const res = await wfPost('transition', { id, to_status: next, resolution: next === 'resolved' ? 'Investigation concluded' : undefined });
    if (res.ok) { toast.success(`→ ${next}`); await openCase(String(id)); await refresh(); } else toast.error(String(res.data?.error ?? 'Failed'));
  }, [open, openCase, refresh]);

  const audit = (detail?.audit ?? []) as Rec[];
  const timeline = (detail?.timeline ?? []) as Rec[];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Scale className="h-6 w-6" /> Investigation Workspace</h1>
            <p className="text-muted-foreground">Open, assign, track and resolve investigations across your jurisdiction. Anonymous evidence only — never PII.</p>
          </div>
          <Button variant="outline" onClick={refresh}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Open an investigation</CardTitle>
            <CardDescription>Reference an anonymous SB-PLR subject and the operator under investigation. Deep-dive evidence lives in the <Link className="underline" href="/regulator/investigation">Investigation view</Link>.</CardDescription></CardHeader>
          <CardContent className="grid md:grid-cols-3 gap-3">
            <div><Label>Title</Label><Input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Suspected intervention gap" /></div>
            <div><Label>Operator (casino id)</Label><Input value={draft.casino_id} onChange={e => setDraft({ ...draft, casino_id: e.target.value })} placeholder="uuid" className="font-mono" /></div>
            <div><Label>Subject (SB-PLR id)</Label><Input value={draft.subject_ref} onChange={e => setDraft({ ...draft, subject_ref: e.target.value })} placeholder="SB-PLR-…" className="font-mono" /></div>
            <div className="md:col-span-3"><Button onClick={create}><Plus className="h-4 w-4 mr-1" /> Open investigation</Button></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Investigations ({cases.length})</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {cases.length === 0 && <p className="text-sm text-muted-foreground">No investigations open.</p>}
            {cases.map((c) => (
              <button key={String(c.id)} onClick={() => openCase(String(c.id))} className="w-full flex items-center justify-between rounded-md border p-3 text-left text-sm hover:bg-muted/50">
                <span className="flex items-center gap-2"><FileSearch className="h-4 w-4" /><span className="font-mono text-xs">{String(c.caseNumber)}</span> {String(c.title)}</span>
                <Badge variant={(STATUS_TONE[String(c.status)] ?? 'secondary') as never}>{String(c.status)}</Badge>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      <Sheet open={!!open} onOpenChange={(o) => { if (!o) { setOpen(null); setDetail(null); } }}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {open && (
            <>
              <SheetHeader><SheetTitle className="flex items-center gap-2"><span className="font-mono text-sm">{String(open.caseNumber)}</span> {String(open.title)}</SheetTitle></SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap gap-2 text-sm">
                  <Badge variant={(STATUS_TONE[String(open.status)] ?? 'secondary') as never}>{String(open.status)}</Badge>
                  {open.subjectRef ? <Badge variant="outline" className="font-mono text-[10px]">{String(open.subjectRef)}</Badge> : null}
                  <Button size="sm" onClick={() => resolve(String(open.id))}>Advance</Button>
                </div>

                <Card>
                  <CardHeader><CardTitle className="text-sm">Investigation timeline</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {timeline.map((s, i) => (
                      <div key={i} className={`text-sm ${s.available ? '' : 'opacity-40'}`}>
                        <span className="font-medium">{String(s.label)}</span> {!s.available && <Badge variant="outline" className="text-[10px]">unavailable</Badge>}
                        {(s.entries as Rec[]).map((e, j) => <div key={j} className="text-xs text-muted-foreground">{String(e.detail)}</div>)}
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <div className="space-y-2">
                  <Label className="text-sm">Regulatory observation</Label>
                  <Textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="Record a regulatory observation (anonymous)…" />
                  <Button size="sm" onClick={addObservation} disabled={!obs}>Record observation</Button>
                </div>

                <Card>
                  <CardHeader><CardTitle className="text-sm">Audit history ({audit.length})</CardTitle></CardHeader>
                  <CardContent className="space-y-1">
                    {audit.map((a, i) => <div key={i} className="text-xs text-muted-foreground">{new Date(String(a.at)).toLocaleString()} · <b>{String(a.action)}</b> · {String(a.actor)}</div>)}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
