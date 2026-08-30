'use client';

// ─── Enterprise Case Management + Intervention Workflow (v1.5, WS1/2/6) ───────
// A CONSUMER + ORCHESTRATOR: cases coordinate human actions over the certified
// flow. Every case references evidence (Recorded Fact / Derived Intelligence /
// Policy Decision) and presents one unified, honest timeline. No intelligence
// is recalculated here — the platform already decided; humans act and record.

import { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { CasinoAdminGuard } from '@/components/CasinoAdminGuard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { wfGet, wfPost, EVIDENCE_LABEL, STATUS_TONE, PRIORITY_TONE } from '@/lib/workflowClient';
import { Briefcase, Plus, Clock, Brain, Gavel, Play, CheckCircle2, Flag, AlertTriangle, RefreshCw } from 'lucide-react';

type Rec = Record<string, unknown>;
const STAGE_ICON: Record<string, JSX.Element> = {
  'recorded-fact': <Clock className="h-4 w-4" />, 'derived-intelligence': <Brain className="h-4 w-4" />,
  'policy-decision': <Gavel className="h-4 w-4" />, 'workflow-action': <Play className="h-4 w-4" />,
  'recorded-outcome': <CheckCircle2 className="h-4 w-4" />, 'case-resolution': <Flag className="h-4 w-4" />,
};

export default function CasesPage() {
  const { user } = useAuth();
  const casinoId = (user as unknown as Rec)?.casino_id as string | undefined;
  const [cases, setCases] = useState<Rec[]>([]);
  const [attention, setAttention] = useState<Rec[]>([]);
  const [open, setOpen] = useState<Rec | null>(null);
  const [detail, setDetail] = useState<Rec | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ title: '', case_type: 'high-risk-player', priority: 'high', subject_ref: '', escalation_level: '' });

  const refresh = useCallback(async () => {
    const r = await wfGet('cases', { casino_id: casinoId });
    setCases((r?.cases as Rec[]) ?? []);
    setAttention((r?.attention as Rec[]) ?? []);
  }, [casinoId]);

  useEffect(() => { refresh(); }, [refresh]);

  const openCase = useCallback(async (id: string) => {
    const r = await wfGet('case', { id });
    if (r) { setOpen(r.case as Rec); setDetail(r); }
  }, []);

  const act = useCallback(async (action: string, body: Rec, ok = 'Done') => {
    setBusy(true);
    const res = await wfPost(action, body);
    setBusy(false);
    if (res.ok) { toast.success(ok); await refresh(); if (body.id) await openCase(String(body.id)); }
    else toast.error(String(res.data?.error ?? 'Action failed'));
    return res.ok;
  }, [refresh, openCase]);

  const create = useCallback(async () => {
    if (!draft.title) { toast.error('Give the case a title'); return; }
    const evidence_refs = draft.subject_ref
      ? [{ evidenceClass: 'derived-intelligence', kind: 'risk-assessment', ref: draft.subject_ref, label: `Risk assessment for ${draft.subject_ref}` }]
      : [];
    const res = await wfPost('create-case', { casino_id: casinoId, ...draft, subject_kind: 'player', evidence_refs });
    if (res.ok) { toast.success(`Case ${(res.data?.case as Rec)?.caseNumber ?? ''} opened`); setCreating(false); setDraft({ title: '', case_type: 'high-risk-player', priority: 'high', subject_ref: '', escalation_level: '' }); await refresh(); }
    else toast.error(String(res.data?.error ?? 'Create failed'));
  }, [draft, casinoId, refresh]);

  const status = String(open?.status ?? '');
  const timeline = (detail?.timeline ?? []) as Rec[];
  const audit = (detail?.audit ?? []) as Rec[];

  return (
    <CasinoAdminGuard>
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2"><Briefcase className="h-6 w-6" /> Case Management</h1>
              <p className="text-muted-foreground">Turn recommendations into owned, tracked, auditable work. The platform recommends — humans decide and record.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={refresh}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
              <Button onClick={() => setCreating(v => !v)}><Plus className="h-4 w-4 mr-1" /> New case</Button>
            </div>
          </div>

          {attention.length > 0 && (
            <Card className="border-amber-300">
              <CardContent className="pt-4 flex flex-wrap gap-2 text-sm">
                <span className="flex items-center gap-1 font-medium text-amber-700"><AlertTriangle className="h-4 w-4" /> Needs attention:</span>
                {attention.slice(0, 8).map((a, i) => (
                  <button key={i} onClick={() => openCase(String(a.caseId))} className="underline">
                    {String(a.caseNumber)} ({String(a.kind).replace('case-', '').replace('-', ' ')})
                  </button>
                ))}
              </CardContent>
            </Card>
          )}

          {creating && (
            <Card>
              <CardHeader><CardTitle className="text-base">Open a new case</CardTitle>
                <CardDescription>Link an anonymous player (SB-PLR id) so the case references the certified risk assessment.</CardDescription></CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-3">
                <div><Label>Title</Label><Input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. High-risk player review" /></div>
                <div><Label>Subject (SB-PLR id, optional)</Label><Input value={draft.subject_ref} onChange={e => setDraft({ ...draft, subject_ref: e.target.value })} placeholder="SB-PLR-…" className="font-mono" /></div>
                <div><Label>Type</Label>
                  <Select value={draft.case_type} onValueChange={v => setDraft({ ...draft, case_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high-risk-player">High-risk player</SelectItem>
                      <SelectItem value="rg-recommendation">RG recommendation</SelectItem>
                      <SelectItem value="compliance-finding">Compliance finding</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Priority</Label>
                  <Select value={draft.priority} onValueChange={v => setDraft({ ...draft, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['critical', 'high', 'medium', 'low'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2 flex gap-2"><Button onClick={create}>Open case</Button><Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button></div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Cases ({cases.length})</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {cases.length === 0 && <p className="text-sm text-muted-foreground">No cases yet. Open one from a recommendation to get started.</p>}
              {cases.map((c) => (
                <button key={String(c.id)} onClick={() => openCase(String(c.id))} className="w-full flex items-center justify-between gap-3 rounded-md border p-3 text-left text-sm hover:bg-muted/50">
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-xs">{String(c.caseNumber)}</span>
                    <span className="font-medium">{String(c.title)}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge variant={(PRIORITY_TONE[String(c.priority)] ?? 'secondary') as never}>{String(c.priority)}</Badge>
                    <Badge variant={(STATUS_TONE[String(c.status)] ?? 'secondary') as never}>{String(c.status)}</Badge>
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* ── Case detail: unified timeline + intervention workflow ── */}
        <Sheet open={!!open} onOpenChange={(o) => { if (!o) { setOpen(null); setDetail(null); } }}>
          <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
            {open && (
              <>
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2"><span className="font-mono text-sm">{String(open.caseNumber)}</span> {String(open.title)}</SheetTitle>
                </SheetHeader>
                <div className="mt-4 space-y-5">
                  <div className="flex flex-wrap gap-2 text-sm">
                    <Badge variant={(STATUS_TONE[status] ?? 'secondary') as never}>{status}</Badge>
                    <Badge variant={(PRIORITY_TONE[String(open.priority)] ?? 'secondary') as never}>{String(open.priority)}</Badge>
                    <Badge variant="outline">{String(open.caseType)}</Badge>
                    {open.subjectRef ? <Badge variant="outline" className="font-mono text-[10px]">{String(open.subjectRef)}</Badge> : null}
                    {open.dueAt ? <span className="text-muted-foreground">due {new Date(String(open.dueAt)).toLocaleString()}</span> : null}
                  </div>

                  {/* Intervention workflow controls — driven by the state machine */}
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Intervention workflow</CardTitle>
                      <CardDescription>No intervention is executed automatically. Record what a human decided and did.</CardDescription></CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      {status === 'open' && <Button size="sm" onClick={() => act('transition', { id: open.id, to_status: 'in-review' }, 'Moved to review')}>Start review</Button>}
                      {status === 'in-review' && <>
                        <Button size="sm" onClick={() => act('review', { id: open.id, decision: 'accept', note: 'Recommendation accepted' }, 'Accepted')}>Accept</Button>
                        <Button size="sm" variant="destructive" onClick={() => act('review', { id: open.id, decision: 'reject', note: 'Not warranted' }, 'Rejected')}>Reject</Button>
                      </>}
                      {status === 'accepted' && <Button size="sm" onClick={() => act('record-action', { id: open.id, action: 'Operator contacted player and offered support tools' }, 'Action recorded')}>Record action</Button>}
                      {status === 'action-recorded' && <Button size="sm" onClick={() => act('record-outcome', { id: open.id, outcome: 'Player accepted a cool-off period' }, 'Outcome recorded')}>Record outcome</Button>}
                      {status === 'outcome-recorded' && <Button size="sm" onClick={() => act('transition', { id: open.id, to_status: 'resolved', resolution: 'Player supported; monitoring continues' }, 'Resolved')}>Resolve</Button>}
                      {(status === 'resolved' || status === 'rejected') && <Button size="sm" variant="outline" onClick={() => act('transition', { id: open.id, to_status: 'closed' }, 'Closed')}>Close case</Button>}
                      {status === 'closed' && <span className="text-sm text-muted-foreground">Case closed — {String(open.resolution ?? '')}</span>}
                    </CardContent>
                  </Card>

                  {/* Unified timeline (WS6) */}
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Unified timeline</CardTitle>
                      <CardDescription>Recorded Fact → Derived Intelligence → Policy Decision → Workflow Action → Recorded Outcome → Case Resolution</CardDescription></CardHeader>
                    <CardContent className="space-y-2">
                      {timeline.map((s, i) => (
                        <div key={i} className={`flex items-start gap-3 text-sm ${s.available ? '' : 'opacity-60'}`}>
                          <span className="mt-0.5">{STAGE_ICON[String(s.stage)]}</span>
                          <div className="flex-1">
                            <div className="font-medium flex items-center gap-2">{String(s.label)}
                              {!s.available && <Badge variant="outline" className="text-[10px]">not linked</Badge>}</div>
                            {(s.entries as Rec[]).map((e, j) => (
                              <div key={j} className="text-muted-foreground text-xs">{e.at ? `${new Date(String(e.at)).toLocaleString()} — ` : ''}{String(e.detail)}{e.ref ? ` [${String(e.ref)}]` : ''}</div>
                            ))}
                            {/* UAT-OP-5 (P1-2): honest wording instead of a bare "unavailable". */}
                            {!s.available && s.unavailableNote != null && (
                              <div className="text-muted-foreground text-xs italic">{String(s.unavailableNote)}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Evidence references */}
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Evidence</CardTitle></CardHeader>
                    <CardContent className="space-y-1">
                      {((open.evidenceRefs ?? []) as Rec[]).length === 0 && <p className="text-xs text-muted-foreground">No evidence linked.</p>}
                      {((open.evidenceRefs ?? []) as Rec[]).map((e, i) => (
                        <div key={i} className="text-xs flex items-center gap-2"><Badge variant="outline" className="text-[10px]">{EVIDENCE_LABEL[String(e.evidenceClass)] ?? String(e.evidenceClass)}</Badge> {String(e.label)} <span className="font-mono opacity-60">{String(e.ref)}</span></div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Audit trail */}
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Audit history ({audit.length})</CardTitle></CardHeader>
                    <CardContent className="space-y-1">
                      {audit.map((a, i) => (
                        <div key={i} className="text-xs text-muted-foreground">{new Date(String(a.at)).toLocaleString()} · <b>{String(a.action)}</b> · {String(a.actor)}{a.toStatus ? ` → ${String(a.toStatus)}` : ''}</div>
                      ))}
                    </CardContent>
                  </Card>

                  <AddNote caseId={String(open.id)} onAdd={(note) => act('note', { id: open.id, note }, 'Note added')} busy={busy} />
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </DashboardLayout>
    </CasinoAdminGuard>
  );
}

function AddNote({ onAdd, busy }: { caseId: string; onAdd: (n: string) => void; busy: boolean }) {
  const [note, setNote] = useState('');
  return (
    <div className="space-y-2">
      <Label className="text-sm">Add a note</Label>
      <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Record an observation or decision…" />
      <Button size="sm" disabled={busy || !note} onClick={() => { onAdd(note); setNote(''); }}>Add note</Button>
    </div>
  );
}
