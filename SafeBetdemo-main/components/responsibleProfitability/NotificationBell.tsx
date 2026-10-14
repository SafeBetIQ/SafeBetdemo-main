'use client';

// ── SafeBet IQ — B12 header notification Bell ─────────────────────────────────────
// Shows the current active UNREAD count of governed Responsible-Gambling operator
// notifications (B12 projection). Polls every 60s + on window focus. Reading the count
// NEVER marks anything read. Badge derives ONLY from B12 unread — never the legacy
// workflow notifications. Non-operator / no-scope responses simply show no badge.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';
import { readAccessTokenFast, supabase } from '@/lib/supabase';

async function token(): Promise<string | null> {
  let t = readAccessTokenFast();
  if (!t) t = (await supabase.auth.getSession()).data.session?.access_token ?? null;
  return t;
}

export function NotificationBell() {
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    const t = await token();
    if (!t) { setCount(0); return; }
    try {
      const r = await fetch('/api/casino/notifications?filter=unread&limit=1', { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' });
      if (!r.ok) { setCount(0); return; }
      const b = await r.json().catch(() => ({}));
      setCount(Number(b.unreadCount) || 0);
    } catch { setCount(0); }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(id); window.removeEventListener('focus', onFocus); };
  }, [load]);

  return (
    <Link href="/casino/notifications" aria-label={count > 0 ? `Notifications (${count} unread)` : 'Notifications'}>
      <Button variant="ghost" size="icon" className="relative">
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </Button>
    </Link>
  );
}
