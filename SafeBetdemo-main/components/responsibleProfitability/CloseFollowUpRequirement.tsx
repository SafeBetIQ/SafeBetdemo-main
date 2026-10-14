'use client';

// ── SafeBet IQ — B11 Close Follow-Up Requirement (operator UI) ────────────────────
// Records "no further follow-up is currently required" for an intervention that currently
// requires follow-up. One-way (no reopen). It removes the current follow-up requirement and
// clears any scheduled date — it does NOT mark the intervention successful/complete/effective.
// Confirmation required; no reason/notes/free text. A mandatory UUID Idempotency-Key is
// reused across retries so a double-submit never double-closes.

import { useCallback, useState } from 'react';
import { CircleSlash, X, Info } from 'lucide-react';

export function CloseFollowUpRequirement({ interventionId, token, onClosed }: { interventionId: string; token: () => Promise<string | null>; onClosed?: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [key, setKey] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const start = useCallback(() => { setKey(crypto.randomUUID()); setNotice(null); setConfirming(true); }, []);

  const submit = useCallback(async () => {
    const t = await token(); if (!t) { setNotice('Session unavailable.'); return; }
    setBusy(true); setNotice(null);
    try {
      const res = await fetch(`/api/casino/interventions/${interventionId}/close-follow-up-requirement`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: '{}',
      });
      if (res.ok) {
        const b = await res.json().catch(() => ({}));
        setNotice(b.status === 'REPLAYED' ? 'Already closed (no change).' : b.status === 'NOOP' ? 'No follow-up requirement to close.' : 'Follow-up requirement closed.');
        setConfirming(false); onClosed?.();
        return;                                            // key consumed on definitive success
      }
      if (res.status === 409) setNotice('This submission conflicts with a prior one using the same key.');
      else setNotice('That requirement could not be closed.');
      // ambiguous/non-definitive: keep the same key for a safe retry
    } catch {
      setNotice('Network issue — you may retry safely.');  // keep key for idempotent retry
    } finally { setBusy(false); }
  }, [interventionId, token, key, onClosed]);

  if (!confirming) {
    return (
      <button onClick={start} className="mt-1 flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
        <CircleSlash className="h-3.5 w-3.5" /> No further follow-up required
      </button>
    );
  }

  return (
    <div className="mt-1 w-full rounded-md border p-3 text-xs">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium">No further follow-up required?</span>
        <button onClick={() => setConfirming(false)} className="rounded p-1" aria-label="Cancel"><X className="h-3.5 w-3.5" /></button>
      </div>
      <p className="text-muted-foreground">This will remove the current follow-up requirement and clear any scheduled follow-up date.</p>
      <p className="mt-1 text-[10px] text-muted-foreground">This does not mark the intervention as successful or complete.</p>
      <div className="mt-2 flex items-center gap-2">
        <button onClick={submit} disabled={busy} className="rounded-md border bg-primary px-3 py-1 text-primary-foreground disabled:opacity-60">
          {busy ? 'Closing…' : 'Confirm — no further follow-up'}
        </button>
        <button onClick={() => setConfirming(false)} className="rounded-md border px-3 py-1">Cancel</button>
      </div>
      {notice && <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground"><Info className="h-3 w-3" /> {notice}</p>}
    </div>
  );
}
