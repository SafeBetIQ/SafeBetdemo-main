'use client';

// ── SafeBet IQ — B12 Responsible-Gambling notification inbox (operator-local) ─────
// Current attention projection: self-exclusion alert / follow-up due / follow-up overdue.
// IN_APP only. No player data, no player messaging, no marketing. Mark-read happens ONLY on
// an explicit click (never on poll/render). 60s polling + focus refresh. Click → mark read
// → navigate to the governed resource (which re-authorises). Legacy Workflow notifications
// are a separate section and are not mixed here.

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { readAccessTokenFast, supabase } from '@/lib/supabase';
import { Bell, RefreshCw, ShieldAlert, Clock, AlertTriangle } from 'lucide-react';

type Item = {
  notificationId: string; type: 'SELF_EXCLUSION_ALERT' | 'FOLLOW_UP_DUE' | 'FOLLOW_UP_OVERDUE';
  priority: 'HIGH' | 'NORMAL'; title: string; effectiveAt: string | null; attentionDate: string | null;
  read: boolean; targetHref: string;
};
const ICON = { SELF_EXCLUSION_ALERT: ShieldAlert, FOLLOW_UP_OVERDUE: AlertTriangle, FOLLOW_UP_DUE: Clock } as const;

async function token(): Promise<string | null> {
  let t = readAccessTokenFast();
  if (!t) t = (await supabase.auth.getSession()).data.session?.access_token ?? null;
  return t;
}
function dt(v: string | null): string {
  if (!v) return '—';
  try { return new Date(v.length === 10 ? `${v}T00:00:00+02:00` : v).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg' }); } catch { return v; }
}

export function ResponsibleGamblingNotifications() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [filter, setFilter] = useState<'unread' | 'all'>('unread');
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setUnavailable(false);
    const t = await token();
    if (!t) { setUnavailable(true); setLoading(false); return; }
    try {
      const r = await fetch(`/api/casino/notifications?filter=${filter}&limit=100`, { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' });
      if (!r.ok) { setUnavailable(true); setItems([]); setLoading(false); return; }
      const b = await r.json();
      setItems((b.items ?? []) as Item[]); setUnread(Number(b.unreadCount) || 0); setLoading(false);
    } catch { setUnavailable(true); setLoading(false); }
  }, [filter]);

  useEffect(() => {
    load();
    const id = setInterval(load, 60000);              // polling never marks read
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(id); window.removeEventListener('focus', onFocus); };
  }, [load]);

  const open = useCallback(async (it: Item) => {
    setBusy(it.notificationId);
    const t = await token();
    try {
      if (t) await fetch(`/api/casino/notifications/${it.notificationId}/read`, { method: 'POST', headers: { Authorization: `Bearer ${t}` }, body: '{}' });
    } catch { /* read-state is best-effort; never blocks navigation */ }
    setBusy(null);
    router.push(it.targetHref);
  }, [router]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Bell className="h-4 w-4" /> Responsible Gambling {unread > 0 && <Badge variant="destructive">{unread}</Badge>}
          </CardTitle>
          <div className="flex items-center gap-1">
            <button onClick={() => setFilter('unread')} className={`rounded-md border px-2 py-1 text-xs ${filter === 'unread' ? 'bg-muted' : ''}`}>Unread</button>
            <button onClick={() => setFilter('all')} className={`rounded-md border px-2 py-1 text-xs ${filter === 'all' ? 'bg-muted' : ''}`}>All</button>
            <button onClick={load} className="rounded-md border px-2 py-1 text-xs" aria-label="Refresh"><RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /></button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {unavailable && <p className="text-sm text-muted-foreground">This view is currently unavailable.</p>}
        {!unavailable && !loading && items.length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing currently needs your attention.</p>
        )}
        {items.map((i) => {
          const Icon = ICON[i.type];
          return (
            <button key={i.notificationId} disabled={busy === i.notificationId} onClick={() => open(i)}
              className={`flex w-full items-center justify-between gap-3 rounded-md border p-2 text-left text-xs disabled:opacity-60 ${i.read ? 'opacity-60' : ''}`}>
              <span className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="font-medium text-foreground">{i.title}</span>
                <Badge variant={i.priority === 'HIGH' ? 'destructive' : 'secondary'} className="text-[10px]">{i.priority}</Badge>
              </span>
              <span className="shrink-0 text-muted-foreground">{dt(i.effectiveAt ?? i.attentionDate)}{!i.read && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-destructive align-middle" aria-label="unread" />}</span>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
