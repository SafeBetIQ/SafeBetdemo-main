'use client';

// ── SafeBet IQ — B9 Record Intervention (operator UI, alert-derived) ──────────
// Records a real intervention from a protection alert. Occurrence/record only — no
// effectiveness/completion/SLA wording, no free text, no player/casino/staff/source/
// timestamp pickers. Casino/player/actor are server-derived. A mandatory UUID
// Idempotency-Key is reused across retries so a double-submit never double-records.

import { useCallback, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ClipboardPlus, X, Info } from 'lucide-react';
import { B9_INTERVENTION_TYPES, B9_OUTCOMES } from '@/lib/responsibleProfitability/interventionRecording';

const TYPE_LABEL: Record<string, string> = {
  manual_review: 'Manual review', limit_setting: 'Limit setting', timeout: 'Timeout',
  self_exclusion_referral: 'Self-exclusion referral', helpline_referral: 'Helpline referral', counseling_referral: 'Counseling referral',
};

export function RecordIntervention({ alertId, token, onRecorded }: { alertId: string; token: () => Promise<string | null>; onRecorded?: () => void }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>('manual_review');
  const [outcome, setOutcome] = useState<string>('');            // '' = not recorded
  const [followUp, setFollowUp] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [key, setKey] = useState<string>('');                    // idempotency key for this attempt
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const start = useCallback(() => {
    setKey(crypto.randomUUID());                                 // one key per logical submission attempt
    setType('manual_review'); setOutcome(''); setFollowUp(false); setDueDate(''); setNotice(null); setOpen(true);
  }, []);

  const submit = useCallback(async () => {
    const t = await token(); if (!t) { setNotice('Session unavailable.'); return; }
    setBusy(true); setNotice(null);
    const body: Record<string, unknown> = { intervention_type: type, follow_up_required: followUp };
    if (outcome) body.outcome = outcome;
    if (followUp && dueDate) body.follow_up_date = dueDate;
    try {
      const res = await fetch(`/api/casino/protection-alerts/${alertId}/interventions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const b = await res.json().catch(() => ({}));
        setNotice(b.code === 'REPLAYED' ? 'Already recorded (no duplicate created).' : 'Intervention recorded and linked to this alert.');
        setOpen(false); onRecorded?.();
        return;                                                   // key consumed on definitive success
      }
      if (res.status === 409) { setNotice('This submission conflicts with a prior one using the same key.'); }
      else { setNotice('That intervention could not be recorded.'); }
      // ambiguous/non-definitive: keep the same key for a safe retry
    } catch {
      setNotice('Network issue — you may retry safely.');         // keep key for idempotent retry
    } finally { setBusy(false); }
  }, [alertId, token, key, type, outcome, followUp, dueDate, onRecorded]);

  if (!open) {
    return (
      <button onClick={start} className="mt-2 flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
        <ClipboardPlus className="h-3.5 w-3.5" /> Record intervention
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-md border p-3 text-xs">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium">Record intervention</span>
        <button onClick={() => setOpen(false)} className="rounded p-1" aria-label="Cancel"><X className="h-3.5 w-3.5" /></button>
      </div>
      <div className="space-y-2">
        <label className="flex flex-col gap-0.5">Intervention type
          <select value={type} onChange={(e) => setType(e.target.value)} className="rounded border px-2 py-1">
            {B9_INTERVENTION_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t] ?? t}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-0.5">Recorded intervention outcome <span className="text-[10px] text-muted-foreground">(optional; not a measure of effectiveness)</span>
          <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className="rounded border px-2 py-1">
            <option value="">Not recorded</option>
            {B9_OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={followUp} onChange={(e) => setFollowUp(e.target.checked)} /> Follow-up required</label>
        {followUp && (
          <label className="flex flex-col gap-0.5">Follow-up due date <span className="text-[10px] text-muted-foreground">(optional; a past date will show as overdue)</span>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="rounded border px-2 py-1" />
          </label>
        )}
        <div className="flex items-center gap-2">
          <button onClick={submit} disabled={busy} className="rounded-md border bg-primary px-3 py-1 text-primary-foreground disabled:opacity-60">
            {busy ? 'Recording…' : 'Record'}
          </button>
          <Badge variant="outline" className="font-normal">Linked to this alert</Badge>
        </div>
      </div>
      {notice && <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground"><Info className="h-3 w-3" /> {notice}</p>}
    </div>
  );
}
