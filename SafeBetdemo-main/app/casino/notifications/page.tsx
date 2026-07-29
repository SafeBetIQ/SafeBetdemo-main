'use client';

// ─── Notification Centre (v1.5, WS7) ─────────────────────────────────────────
// Workflow notifications INFORM users — they never trigger business logic.
// New case assigned · case overdue · awaiting review · deadline approaching.

import { useCallback, useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { CasinoAdminGuard } from '@/components/CasinoAdminGuard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { wfGet, wfPost } from '@/lib/workflowClient';
import { Bell, RefreshCw, Check } from 'lucide-react';

type Rec = Record<string, unknown>;

const KIND_TONE: Record<string, string> = {
  'case-overdue': 'destructive', 'compliance-deadline-approaching': 'destructive',
  'case-assigned': 'default', 'awaiting-review': 'secondary', 'case-due-soon': 'secondary',
};

export default function NotificationsPage() {
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

  const unread = notifications.filter(n => !n.readAt).length;

  return (
    <CasinoAdminGuard>
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2"><Bell className="h-6 w-6" /> Notification Centre {unread > 0 && <Badge variant="destructive">{unread}</Badge>}</h1>
              <p className="text-muted-foreground">Workflow notifications inform you — they never take action on your behalf.</p>
            </div>
            <Button variant="outline" onClick={refresh}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Notifications ({notifications.length})</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {notifications.length === 0 && <p className="text-sm text-muted-foreground">No notifications.</p>}
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
        </div>
      </DashboardLayout>
    </CasinoAdminGuard>
  );
}
