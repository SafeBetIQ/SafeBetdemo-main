'use client';

// ── SafeBet IQ — B13.1 Player Communication panel (SANDBOX ONLY) ──────────────────
// Lets authorised operator/compliance staff create and "send" a governed, responsible-
// gambling, versioned-template player communication tied to an eligible intervention.
// B13.1 is SANDBOX ONLY: no real player message is ever sent, no contact detail is shown or
// entered, there is NO composer / free text / recipient field. The template is selected by the
// intervention type (fixed mapping). Separate request + send idempotency keys protect retries.

import { useCallback, useEffect, useState } from 'react';
import { MessageSquare, X, Info, ShieldCheck } from 'lucide-react';

// Mirror of the server-side mapping + SANDBOX template labels (presentation only).
const ELIGIBLE: Record<string, { communicationType: string; templateKey: string; label: string; preview: string }> = {
  limit_setting: { communicationType: 'LIMIT_CONFIRMATION', templateKey: 'rg.limit_confirmation', label: 'Limit confirmation', preview: 'Confirms the account limit change and points to responsible-gambling support.' },
  timeout: { communicationType: 'TIMEOUT_CONFIRMATION', templateKey: 'rg.timeout_confirmation', label: 'Timeout confirmation', preview: 'Confirms the cooling-off period and points to responsible-gambling support.' },
  self_exclusion_referral: { communicationType: 'SELF_EXCLUSION_SUPPORT', templateKey: 'rg.self_exclusion_support', label: 'Self-exclusion support', preview: 'Shares self-exclusion support resources.' },
  helpline_referral: { communicationType: 'HELPLINE_SUPPORT', templateKey: 'rg.helpline_support', label: 'Helpline support', preview: 'Shares helpline support resources.' },
  counseling_referral: { communicationType: 'COUNSELLING_SUPPORT', templateKey: 'rg.counselling_support', label: 'Counselling support', preview: 'Shares counselling support resources.' },
};

interface CommunicationDTO {
  communicationId: string; communicationType: string; status: string; sequence: number;
  requestedAt: string; submittedAt: string | null; deliveredAt: string | null; failedAt: string | null; failureClass: string | null; sandbox: boolean;
}

function statusLabel(s: string): string {
  switch (s) {
    case 'PENDING': return 'Sandbox draft (not sent)';
    case 'SUBMITTING': return 'Sandbox submitting…';
    case 'SUBMITTED': return 'Sandbox submitted';
    case 'DELIVERED': return 'Sandbox delivered';
    case 'FAILED': return 'Sandbox failed';
    default: return s;
  }
}

export function PlayerCommunicationPanel(
  { interventionId, interventionType, token }: { interventionId: string; interventionType: string; token: () => Promise<string | null> },
) {
  const eligible = ELIGIBLE[interventionType];
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reqKey, setReqKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [items, setItems] = useState<CommunicationDTO[]>([]);

  const load = useCallback(async () => {
    const t = await token(); if (!t) return;
    try {
      const res = await fetch(`/api/casino/interventions/${interventionId}/communications`, { headers: { Authorization: `Bearer ${t}` } });
      if (res.ok) { const b = await res.json().catch(() => ({})); setItems(Array.isArray(b.items) ? b.items : []); }
    } catch { /* non-fatal */ }
  }, [interventionId, token]);

  useEffect(() => { if (open) void load(); }, [open, load]);

  const start = useCallback(() => { setReqKey(crypto.randomUUID()); setNotice(null); setConfirming(true); }, []);

  // Create a PENDING sandbox record, then drive the sandbox send with a SEPARATE key.
  const submit = useCallback(async () => {
    if (!eligible) return;
    const t = await token(); if (!t) { setNotice('Session unavailable.'); return; }
    setBusy(true); setNotice(null);
    try {
      const createRes = await fetch(`/api/casino/interventions/${interventionId}/communications`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', 'Idempotency-Key': reqKey },
        body: JSON.stringify({ communicationType: eligible.communicationType, templateKey: eligible.templateKey }),
      });
      if (!createRes.ok && createRes.status !== 200) {
        setNotice(createRes.status === 409 ? 'This request conflicts with a prior one.' : 'That sandbox communication could not be created.');
        return;                                           // keep key for safe retry
      }
      const created = await createRes.json().catch(() => ({}));
      if (!created.communicationId) { setNotice('That sandbox communication could not be created.'); return; }

      const sendKey = crypto.randomUUID();                // SEPARATE from the request key
      const sendRes = await fetch(`/api/casino/interventions/${interventionId}/communications/${created.communicationId}/send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', 'Idempotency-Key': sendKey },
        body: '{}',
      });
      if (sendRes.ok) {
        const b = await sendRes.json().catch(() => ({}));
        setNotice(`Sandbox record ${statusLabel(b.communication?.status ?? 'SUBMITTED').toLowerCase()}. No real player message was sent.`);
      } else {
        setNotice('The sandbox record was created but could not be submitted.');
      }
      setConfirming(false); await load();
    } catch {
      setNotice('Network issue — you may retry safely.'); // reqKey retained; create is idempotent
    } finally { setBusy(false); }
  }, [eligible, interventionId, token, reqKey, load]);

  if (!eligible) {
    return (
      <p className="mt-1 text-[11px] text-muted-foreground">
        Player communication is not available for this intervention type.
      </p>
    );
  }

  return (
    <div className="mt-1 w-full">
      {!open ? (
        <button onClick={() => setOpen(true)} className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
          <MessageSquare className="h-3.5 w-3.5" /> Player communication (sandbox)
        </button>
      ) : (
        <div className="rounded-md border p-3 text-xs">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1 font-medium"><ShieldCheck className="h-3.5 w-3.5" /> {eligible.label}</span>
            <button onClick={() => { setOpen(false); setConfirming(false); }} className="rounded p-1" aria-label="Close"><X className="h-3.5 w-3.5" /></button>
          </div>
          <span className="inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">SANDBOX — no real message is sent</span>
          <p className="mt-2 text-muted-foreground">{eligible.preview}</p>

          {items.length > 0 && (
            <ul className="mt-2 space-y-1">
              {items.map((c) => (
                <li key={c.communicationId} className="flex items-center justify-between rounded border px-2 py-1">
                  <span>#{c.sequence} · {c.communicationType}</span>
                  <span className="text-[10px] text-muted-foreground">{statusLabel(c.status)}{c.failureClass ? ` (${c.failureClass})` : ''}</span>
                </li>
              ))}
            </ul>
          )}

          {!confirming ? (
            <button onClick={start} className="mt-2 rounded-md border px-2 py-1">Create sandbox communication…</button>
          ) : (
            <div className="mt-2">
              <p className="text-[11px] text-muted-foreground">
                This will create a sandbox responsible-gambling delivery record. No real player message will be sent.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <button onClick={submit} disabled={busy} className="rounded-md border bg-primary px-3 py-1 text-primary-foreground disabled:opacity-60">
                  {busy ? 'Working…' : 'Confirm — create sandbox record'}
                </button>
                <button onClick={() => setConfirming(false)} className="rounded-md border px-3 py-1">Cancel</button>
              </div>
            </div>
          )}
          {notice && <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground"><Info className="h-3 w-3" /> {notice}</p>}
        </div>
      )}
    </div>
  );
}
