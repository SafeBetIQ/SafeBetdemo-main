'use client';

// ── SafeBet IQ — B8 Follow-Up Scheduling (operator UI) ────────────────────────
// Bounded own-casino list of interventions requiring follow-up. Schedule / reschedule /
// unschedule a due date through the governed APIs. Occurrence/operational only — no
// completion, no effectiveness, no SLA. Opaque player reference only; no PII.

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { readAccessTokenFast, supabase } from '@/lib/supabase';
import { CalendarClock, Plus, RefreshCw, X, Info } from 'lucide-react';

type Item = {
  interventionId: string; opaquePlayerRef: string; interventionType: string | null;
  interventionDate: string | null; followUpDate: string | null;
  followUpState: 'UNSCHEDULED' | 'DUE_TODAY' | 'OVERDUE' | 'FUTURE'; daysOverdue: number | null;
};
const GROUPS: { state: Item['followUpState']; label: string }[] = [
  { state: 'UNSCHEDULED', label: 'Required — no date recorded' },
  { state: 'OVERDUE', label: 'Overdue' },
  { state: 'DUE_TODAY', label: 'Due today' },
  { state: 'FUTURE', label: 'Future scheduled' },
];

async function token(): Promise<string | null> {
  let t = readAccessTokenFast();
  if (!t) t = (await supabase.auth.getSession()).data.session?.access_token ?? null;
  return t;
}
function dt(v: string | null): string {
  if (!v) return '—';
  try { return new Date(`${v}T00:00:00+02:00`).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg' }); } catch { return v; }
}

export function FollowUpScheduling() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [dateVal, setDateVal] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setUnavailable(false);
    const t = await token();
    if (!t) { setUnavailable(true); setLoading(false); return; }
    try {
      const r = await fetch('/api/casino/interventions/follow-ups', { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' });
      if (!r.ok) { setUnavailable(true); setItems([]); setLoading(false); return; }
      const b = await r.json();
      setItems((b.items ?? []) as Item[]); setLoading(false);
    } catch { setUnavailable(true); setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = useCallback(async (id: string, path: string, body?: object) => {
    const t = await token(); if (!t) return;
    setBusy(true); setNotice(null);
    try {
      const r = await fetch(`/api/casino/interventions/${id}/${path}`, {
        method: 'POST', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });
      const b = await r.json().catch(() => ({}));
      setNotice(r.ok ? (b.code === 'NOOP' ? 'No change (already in that state).' : 'Follow-up schedule updated.') : 'That action is not available for this intervention.');
    } catch { setNotice('Action is currently unavailable.'); }
    setBusy(false); setEditing(null); setDateVal('');
    await load();
  }, [load]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium"><CalendarClock className="h-4 w-4" /> Follow-Up Scheduling</CardTitle>
        <CardDescription>
          Record the due date for interventions that require follow-up. Scheduling does not indicate completion or
          effectiveness, and no SLA applies. A past date is allowed and will show as overdue.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <button onClick={load} className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs" aria-label="Refresh">
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
        {unavailable && <p className="text-sm text-muted-foreground">This view is currently unavailable.</p>}
        {loading && items.length === 0 && <p className="text-sm text-muted-foreground">Loading follow-ups…</p>}
        {!loading && !unavailable && items.length === 0 && (
          <p className="text-sm text-muted-foreground">No interventions currently require follow-up for your casino.</p>
        )}

        {GROUPS.map(({ state, label }) => {
          const rows = items.filter((i) => i.followUpState === state);
          if (rows.length === 0) return null;
          return (
            <div key={state}>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label} ({rows.length})</div>
              <div className="space-y-1.5">
                {rows.map((i) => (
                  <div key={i.interventionId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-xs">
                    <div className="space-y-0.5">
                      <div className="font-medium text-foreground">{i.interventionType ?? 'Recorded intervention'}
                        <span className="ml-2 font-mono text-muted-foreground" title="player reference">{i.opaquePlayerRef}</span></div>
                      <div className="text-muted-foreground">
                        Recorded {dt(i.interventionDate)} ·{' '}
                        {i.followUpDate
                          ? <>Follow-up due {dt(i.followUpDate)}{i.daysOverdue != null ? ` · ${i.daysOverdue} day(s) overdue` : ''}</>
                          : <span className="text-amber-600">Follow-up date not recorded</span>}
                      </div>
                    </div>
                    {editing === i.interventionId ? (
                      <div className="flex items-center gap-1">
                        <input type="date" value={dateVal} onChange={(e) => setDateVal(e.target.value)} className="rounded border px-2 py-1" />
                        <button disabled={busy || !dateVal}
                          onClick={() => act(i.interventionId, i.followUpDate ? 'reschedule-follow-up' : 'schedule-follow-up', { follow_up_date: dateVal })}
                          className="rounded-md border px-2 py-1 disabled:opacity-60">Save</button>
                        <button onClick={() => { setEditing(null); setDateVal(''); }} className="rounded p-1" aria-label="Cancel"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ) : (
                      <div className="flex shrink-0 gap-1">
                        {i.followUpDate
                          ? <>
                              <button disabled={busy} onClick={() => { setEditing(i.interventionId); setDateVal(i.followUpDate ?? ''); }} className="rounded-md border px-2 py-1 disabled:opacity-60">Reschedule</button>
                              <button disabled={busy} onClick={() => act(i.interventionId, 'unschedule-follow-up')} className="rounded-md border px-2 py-1 disabled:opacity-60">Unschedule</button>
                            </>
                          : <button disabled={busy} onClick={() => { setEditing(i.interventionId); setDateVal(''); }} className="flex items-center gap-1 rounded-md border px-2 py-1 disabled:opacity-60"><Plus className="h-3 w-3" /> Schedule follow-up</button>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {notice && <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><Info className="h-3 w-3" /> {notice}</p>}
      </CardContent>
    </Card>
  );
}
