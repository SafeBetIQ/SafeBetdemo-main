'use client';

// ─── Notification Centre ─────────────────────────────────────────────────────
// Two separate governed sections:
//   • Responsible Gambling (B12): current operator attention projected from authoritative
//     RG state (self-exclusion alerts, follow-up due/overdue). IN_APP; no player data.
//   • Workflow (WS7, legacy): case workflow notifications (unchanged) — INFORM only.
// The two are distinct domains and are never merged.

import { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { CasinoAdminGuard } from '@/components/CasinoAdminGuard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { wfGet, wfPost } from '@/lib/workflowClient';
import { ResponsibleGamblingNotifications } from '@/components/responsibleProfitability/ResponsibleGamblingNotifications';
import { Bell, RefreshCw, Check } from 'lucide-react';

type Rec = Record<string, unknown>;

const KIND_TONE: Record<string, string> = {
  'case-overdue': 'destructive', 'compliance-deadline-approaching': 'destructive',
  'case-assigned': 'default', 'awaiting-review': 'secondary', 'case-due-soon': 'secondary',
};

// Legacy WS7 workflow notifications (unchanged behaviour, now a section).
function WorkflowNotifications() {
  const { user } = useAuth();
  const casinoId = (user as unknown as Rec)?.casino_id as string | undefined;
  const [notifications, setNotifications] = useState<Rec[]>([]);

  const refresh = useCallback(async () => {
    const r = await wfGet('notifications', { casino_id: casinoId });
    setNotifications((r?.notifications as Rec[]) ?? []);
  }, [casinoId]);
  useEffect(() => { refresh(); }, [refresh]);

  const markRead = useCallback(async (id: string) => {
    await wfPost('mark-read', { notification_id: id });
    await refresh();
  }, [refresh]);

  return (
    <Card>
      <CardHeader className="pb-2"><div className="flex items-center justify-between">
        <CardTitle className="text-base">Workflow ({notifications.length})</CardTitle>
        <Button variant="outline" size="sm" onClick={refresh}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
      </div></CardHeader>
      <CardContent className="space-y-1">
        <p className="mb-1 text-xs text-muted-foreground">Workflow notifications inform you — they never take action on your behalf.</p>
        {notifications.length === 0 && <p className="text-sm text-muted-foreground">No workflow notifications.</p>}
        {notifications.map((n) => (
          <div key={String(n.id)} className={`flex items-center justify-between gap-3 rounded-md border p-3 text-sm ${n.readAt ? 'opacity-50' : ''}`}>
            <span className="flex items-center gap-2">
              <Badge variant={(KIND_TONE[String(n.kind)] ?? 'secondary') as never} className="text-[10px]">{String(n.kind).replace(/-/g, ' ')}</Badge>
              {String(n.message)}
            </span>
            {!n.readAt && <Button size="sm" variant="ghost" onClick={() => markRead(String(n.id))}><Check className="h-4 w-4" /></Button>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function NotificationsPage() {
  const [tab, setTab] = useState<'rg' | 'workflow'>('rg');

  return (
    <CasinoAdminGuard>
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Bell className="h-6 w-6" /> Notification Centre</h1>
            <p className="text-muted-foreground">Current responsible-gambling attention and workflow notifications — informational; they never act on your behalf.</p>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setTab('rg')} className={`rounded-md border px-3 py-1.5 text-sm ${tab === 'rg' ? 'bg-muted font-medium' : ''}`}>Responsible Gambling</button>
            <button onClick={() => setTab('workflow')} className={`rounded-md border px-3 py-1.5 text-sm ${tab === 'workflow' ? 'bg-muted font-medium' : ''}`}>Workflow</button>
          </div>

          {tab === 'rg' ? <ResponsibleGamblingNotifications /> : <WorkflowNotifications />}
        </div>
      </DashboardLayout>
    </CasinoAdminGuard>
  );
}
