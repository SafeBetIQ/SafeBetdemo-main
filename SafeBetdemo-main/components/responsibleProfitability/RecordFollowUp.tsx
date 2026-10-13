'use client';

// ── SafeBet IQ — B10 Record Follow-Up (operator UI, append-only occurrence) ──────
// Records that a follow-up action OCCURRED for an intervention that requires follow-up.
// Occurrence/record only — no completion/effectiveness/SLA wording, no outcome, no free
// text, no player/casino/staff/source pickers. The only operator input is the date the
// follow-up occurred (SAST). A mandatory UUID Idempotency-Key is reused across retries so a
// double-submit never double-records. Casino/player/schedule-snapshot are server-derived.

import { useCallback, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ClipboardCheck, X, Info, History } from 'lucide-react';

/** Current SAST (Africa/Johannesburg) business date as YYYY-MM-DD. */
function sastToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function dt(v: string | null): string {
  if (!v) return '—';
  try { return new Date(`${v}T00:00:00+02:00`).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg' }); } catch { return v; }
}
const TIMING_LABEL: Record<string, string> = { EARLY: 'Early', ON_DATE: 'On date', LATE: 'Late', NOT_APPLICABLE: 'Not applicable' };

type Occurrence = { occurrenceId: string; occurredOn: string; recordedAt: string; scheduledFollowUpDate: string | null; timingClassification: string };

export function RecordFollowUp({ interventionId, token, onRecorded }: { interventionId: string; token: () => Promise<string | null>; onRecorded?: () => void }) {
  const today = sastToday();
  const [open, setOpen] = useState(false);
  const [occurredOn, setOccurredOn] = useState(today);
  const [key, setKey] = useState<string>('');              // idempotency key for this attempt
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [history, setHistory] = useState<Occurrence[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const start = useCallback(() => {
    setKey(crypto.randomUUID()); setOccurredOn(today); setNotice(null); setOpen(true);
  }, [today]);

  const loadHistory = useCallback(async () => {
    const t = await token(); if (!t) return;
    try {
      const res = await fetch(`/api/casino/interventions/${interventionId}/follow-up-occurrences`, { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' });
      if (!res.ok) { setHistory([]); return; }
      const b = await res.json().catch(() => ({}));
      setHistory((b.items ?? []) as Occurrence[]);
    } catch { setHistory([]); }
  }, [interventionId, token]);

  const submit = useCallback(async () => {
    const t = await token(); if (!t) { setNotice('Session unavailable.'); return; }
    setBusy(true); setNotice(null);
    try {
      const res = await fetch(`/api/casino/interventions/${interventionId}/follow-up-occurrences`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify({ occurred_on: occurredOn }),
      });
      if (res.ok) {
        const b = await res.json().catch(() => ({}));
        setNotice(b.status === 'REPLAYED' ? 'Already recorded (no duplicate created).' : 'Follow-up recorded.');
        setOpen(false); onRecorded?.();
        if (showHistory) void loadHistory();
        return;                                            // key consumed on definitive success
      }
      if (res.status === 409) setNotice('This submission conflicts with a prior one using the same key.');
      else setNotice('That follow-up occurrence could not be recorded.');
      // ambiguous/non-definitive: keep the same key for a safe retry
    } catch {
      setNotice('Network issue — you may retry safely.');  // keep key for idempotent retry
    } finally { setBusy(false); }
  }, [interventionId, token, key, occurredOn, onRecorded, showHistory, loadHistory]);

  const toggleHistory = useCallback(() => {
    const next = !showHistory; setShowHistory(next);
    if (next && history === null) void loadHistory();
  }, [showHistory, history, loadHistory]);

  return (
    <div className="mt-1 w-full">
      <div className="flex items-center gap-1">
        {!open && (
          <button onClick={start} className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
            <ClipboardCheck className="h-3.5 w-3.5" /> Record follow-up
          </button>
        )}
        <button onClick={toggleHistory} className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs" aria-label="Follow-up history">
          <History className="h-3.5 w-3.5" /> History
        </button>
      </div>

      {open && (
        <div className="mt-2 rounded-md border p-3 text-xs">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium">Record follow-up</span>
            <button onClick={() => setOpen(false)} className="rounded p-1" aria-label="Cancel"><X className="h-3.5 w-3.5" /></button>
          </div>
          <label className="flex flex-col gap-0.5">Follow-up occurred on <span className="text-[10px] text-muted-foreground">(SAST; recording occurrence, not completion or effectiveness)</span>
            <input type="date" max={today} value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} className="rounded border px-2 py-1" />
          </label>
          <div className="mt-2 flex items-center gap-2">
            <button onClick={submit} disabled={busy || !occurredOn} className="rounded-md border bg-primary px-3 py-1 text-primary-foreground disabled:opacity-60">
              {busy ? 'Recording…' : 'Record'}
            </button>
            <Badge variant="outline" className="font-normal">Append-only evidence</Badge>
          </div>
        </div>
      )}

      {showHistory && (
        <div className="mt-2 rounded-md border p-2 text-[11px]">
          {history === null && <p className="text-muted-foreground">Loading history…</p>}
          {history !== null && history.length === 0 && <p className="text-muted-foreground">No follow-up occurrences recorded.</p>}
          {history !== null && history.map((o) => (
            <div key={o.occurrenceId} className="border-b py-1 last:border-b-0">
              Follow-up recorded · Occurred on: {dt(o.occurredOn)} · Scheduled date at time: {o.scheduledFollowUpDate ? dt(o.scheduledFollowUpDate) : 'Not recorded'} · Timing: {TIMING_LABEL[o.timingClassification] ?? o.timingClassification}
            </div>
          ))}
        </div>
      )}

      {notice && <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground"><Info className="h-3 w-3" /> {notice}</p>}
    </div>
  );
}
