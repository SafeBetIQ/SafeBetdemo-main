'use client';

// ─── Compliance Workflow (v1.5, WS3) ─────────────────────────────────────────
// Compliance task management. Every task references an existing Policy
// Decision (evidence_ref) — the workflow tracks completion; it never evaluates
// policy or recalculates anything.

import { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { CasinoAdminGuard } from '@/components/CasinoAdminGuard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { wfGet, wfPost, STATUS_TONE } from '@/lib/workflowClient';
import { ClipboardCheck, Plus, RefreshCw, CheckCircle2 } from 'lucide-react';

type Rec = Record<string, unknown>;

export default function ComplianceWorkflowPage() {
  const { user } = useAuth();
  const casinoId = (user as unknown as Rec)?.casino_id as string | undefined;
  const [cases, setCases] = useState<Rec[]>([]);
  const [tasksByCase, setTasksByCase] = useState<Record<string, Rec[]>>({});
  const [draft, setDraft] = useState({ title: '', policyRef: '' });

  const refresh = useCallback(async () => {
    const r = await wfGet('cases', { casino_id: casinoId, type: 'compliance-finding' });
    const cs = (r?.cases as Rec[]) ?? [];
    setCases(cs);
    const map: Record<string, Rec[]> = {};
    await Promise.all(cs.map(async (c) => { const d = await wfGet('case', { id: String(c.id) }); map[String(c.id)] = (d?.tasks as Rec[]) ?? []; }));
    setTasksByCase(map);
  }, [casinoId]);

  useEffect(() => { refresh(); }, [refresh]);

  const createFinding = useCallback(async () => {
    if (!draft.title) { toast.error('Describe the finding'); return; }
    const evidence_refs = draft.policyRef ? [{ evidenceClass: 'policy-decision', kind: 'policy-decision', ref: draft.policyRef, label: `Policy decision ${draft.policyRef}` }] : [];
    const res = await wfPost('create-case', { casino_id: casinoId, case_type: 'compliance-finding', priority: 'high', title: draft.title, subject_kind: 'obligation', subject_ref: draft.policyRef, evidence_refs });
    if (!res.ok) { toast.error(String(res.data?.error ?? 'Failed')); return; }
    const caseId = (res.data?.case as Rec)?.id;
    if (caseId) await wfPost('add-task', { id: caseId, description: draft.title, task_type: 'compliance-action', evidence_ref: draft.policyRef });
    toast.success('Compliance case + task created'); setDraft({ title: '', policyRef: '' }); await refresh();
  }, [draft, casinoId, refresh]);

  const addTask = useCallback(async (caseId: string, description: string, policyRef: string) => {
    const res = await wfPost('add-task', { id: caseId, description, task_type: 'compliance-action', evidence_ref: policyRef });
    if (res.ok) { toast.success('Task added'); await refresh(); } else toast.error('Failed');
  }, [refresh]);

  const complete = useCallback(async (taskId: string) => {
    const res = await wfPost('complete-task', { task_id: taskId, note: 'Completed by compliance officer' });
    if (res.ok) { toast.success('Task completed'); await refresh(); } else toast.error(String(res.data?.error ?? 'Failed'));
  }, [refresh]);

  const escalate = useCallback(async (caseId: string) => {
    const res = await wfPost('transition', { id: caseId, to_status: 'in-review', note: 'Escalated for review' });
    if (res.ok) { toast.success('Escalated'); await refresh(); } else toast.error(String(res.data?.error ?? 'Failed'));
  }, [refresh]);

  return (
    <CasinoAdminGuard>
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2"><ClipboardCheck className="h-6 w-6" /> Compliance Workflow</h1>
              <p className="text-muted-foreground">Outstanding compliance actions, each linked to an existing Policy Decision. Track ownership and completion.</p>
            </div>
            <Button variant="outline" onClick={refresh}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Raise a compliance finding</CardTitle>
              <CardDescription>Reference the Policy Decision id (e.g. ZA-RG-001) this obligation derives from.</CardDescription></CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-3">
              <div className="md:col-span-2"><Label>Finding</Label><Input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Player exceeded loss threshold without intervention record" /></div>
              <div><Label>Policy reference</Label><Input value={draft.policyRef} onChange={e => setDraft({ ...draft, policyRef: e.target.value })} placeholder="ZA-RG-001" /></div>
              <div className="md:col-span-3"><Button onClick={createFinding}><Plus className="h-4 w-4 mr-1" /> Create finding + task</Button></div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {cases.length === 0 && <p className="text-sm text-muted-foreground">No compliance cases. Raise a finding above.</p>}
            {cases.map((c) => {
              const tasks = tasksByCase[String(c.id)] ?? [];
              const done = tasks.filter(t => t.status === 'completed').length;
              return (
                <Card key={String(c.id)}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span className="flex items-center gap-2"><span className="font-mono text-xs">{String(c.caseNumber)}</span> {String(c.title)}</span>
                      <span className="flex items-center gap-2">
                        <Badge variant="outline">{done}/{tasks.length} tasks</Badge>
                        <Badge variant={(STATUS_TONE[String(c.status)] ?? 'secondary') as never}>{String(c.status)}</Badge>
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {tasks.map((t) => (
                      <div key={String(t.id)} className="flex items-center justify-between text-sm border-b py-1 last:border-0">
                        <span>{String(t.description)} {t.evidenceRef ? <Badge variant="outline" className="text-[10px] ml-1">Policy Decision {String(t.evidenceRef)}</Badge> : null}</span>
                        {t.status === 'completed'
                          ? <Badge variant="outline" className="text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" /> done</Badge>
                          : <Button size="sm" variant="outline" onClick={() => complete(String(t.id))}>Complete</Button>}
                      </div>
                    ))}
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" variant="ghost" onClick={() => addTask(String(c.id), 'Follow-up compliance action', String(c.subjectRef ?? ''))}>+ Task</Button>
                      {String(c.status) === 'open' && <Button size="sm" variant="ghost" onClick={() => escalate(String(c.id))}>Escalate</Button>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </DashboardLayout>
    </CasinoAdminGuard>
  );
}
