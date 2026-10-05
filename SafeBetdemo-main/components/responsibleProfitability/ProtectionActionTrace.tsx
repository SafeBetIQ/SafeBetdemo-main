'use client';

// ── SafeBet IQ — B6 Protection Action Traceability (operator UI) ──────────────
// Per-alert panel: shows the ACTIVE recorded-intervention links (current recorded
// values) and lets an operator link an existing recorded intervention or correct a
// link. OCCURRENCE ONLY — it states that an action was recorded after the alert, never
// that it worked. Recorded outcome is always shown with explicit "Recorded intervention
// outcome:" framing — never an effectiveness/positive badge. Consumes governed APIs only.

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Link2, Plus, RefreshCw, Check, X, Info } from 'lucide-react';
import { RECORDED_OUTCOME_PREFIX } from '@/lib/responsibleProfitability/traceability';

interface ActiveLink {
  linkId: string; interventionId: string; linkedAt: string;
  interventionType: string | null; interventionDate: string | null;
  recordedOutcome: string | null; followUpRequired: boolean | null;
}
interface Candidate {
  interventionId: string; interventionType: string | null; interventionDate: string | null;
  recordedOutcome: string | null; followUpRequired: boolean | null; alreadyLinked: boolean;
}

function dt(v: string | null): string {
  if (!v) return '—';
  try { return new Date(v).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg' }); } catch { return v; }
}

export function ProtectionActionTrace({ alertId, token }: { alertId: string; token: () => Promise<string | null> }) {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<ActiveLink[]>([]);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [picking, setPicking] = useState(false);
  const [correctFor, setCorrectFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const auth = useCallback(async () => {
    const t = await token();
    return t ? { Authorization: `Bearer ${t}` } : null;
  }, [token]);

  const loadLinks = useCallback(async () => {
    const h = await auth(); if (!h) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/casino/protection-alerts/${alertId}/links`, { headers: h, cache: 'no-store' });
      const b = await r.json().catch(() => ({}));
      setLinks(r.ok ? (b.links ?? []) : []);
    } catch { setLinks([]); }
    setLoading(false);
  }, [alertId, auth]);

  useEffect(() => { if (open) loadLinks(); }, [open, loadLinks]);

  const loadCandidates = useCallback(async () => {
    const h = await auth(); if (!h) return;
    setPicking(true); setNotice(null);
    try {
      const r = await fetch(`/api/casino/protection-alerts/${alertId}/linkable-interventions`, { headers: h, cache: 'no-store' });
      const b = await r.json().catch(() => ({}));
      setCandidates(r.ok ? (b.candidates ?? []) : []);
    } catch { setCandidates([]); }
  }, [alertId, auth]);

  const doLink = useCallback(async (interventionId: string) => {
    const h = await auth(); if (!h) return;
    setBusy(true); setNotice(null);
    try {
      if (correctFor) {
        const r = await fetch(`/api/casino/protection-alerts/${alertId}/links/${correctFor}/supersede`, {
          method: 'POST', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify({ intervention_id: interventionId }) });
        setNotice(r.ok ? 'Link corrected. The prior link is retained as history.' : 'That correction is not available.');
      } else {
        const r = await fetch(`/api/casino/protection-alerts/${alertId}/link-intervention`, {
          method: 'POST', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify({ intervention_id: interventionId }) });
        setNotice(r.ok ? 'Recorded intervention linked.' : 'That intervention is not linkable for this alert.');
      }
    } catch { setNotice('Action is currently unavailable.'); }
    setBusy(false); setPicking(false); setCandidates(null); setCorrectFor(null);
    await loadLinks();
  }, [alertId, auth, correctFor, loadLinks]);

  return (
    <div className="mt-3 border-t pt-3">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
        <Link2 className="h-3.5 w-3.5" /> Protection action trace {open ? '▾' : '▸'}
        {links.length > 0 && <Badge variant="outline" className="ml-1 font-normal">{links.length} linked</Badge>}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          <p className="text-[11px] text-muted-foreground">
            Records which recorded interventions followed this alert. This is occurrence only — it does not state whether an
            intervention worked, reduced harm, or changed risk. Values shown are the current recorded intervention values.
          </p>

          {loading && <p className="text-xs text-muted-foreground">Loading links…</p>}

          {!loading && links.length === 0 && (
            <p className="text-xs text-muted-foreground">No linked intervention recorded. (This is valid; absence of a link is not a judgment.)</p>
          )}

          {links.map((l) => (
            <div key={l.linkId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 p-2 text-xs">
              <div className="space-y-0.5">
                <div className="font-medium text-foreground">{l.interventionType ?? 'Recorded intervention'}</div>
                <div className="text-muted-foreground">
                  Recorded {dt(l.interventionDate)} · {RECORDED_OUTCOME_PREFIX}: <span className="font-medium text-foreground">{l.recordedOutcome ?? '—'}</span>
                  {l.followUpRequired ? ' · follow-up required' : ''}
                </div>
              </div>
              <button onClick={() => { setCorrectFor(l.linkId); loadCandidates(); }} disabled={busy}
                className="flex items-center gap-1 rounded-md border px-2 py-1 disabled:opacity-60">
                <RefreshCw className="h-3 w-3" /> Correct
              </button>
            </div>
          ))}

          {!picking && (
            <button onClick={() => { setCorrectFor(null); loadCandidates(); }} disabled={busy}
              className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs disabled:opacity-60">
              <Plus className="h-3 w-3" /> Link recorded intervention
            </button>
          )}

          {picking && candidates && (
            <div className="rounded-md border p-2">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-medium">{correctFor ? 'Choose a replacement recorded intervention' : 'Choose a recorded intervention for this player'}</span>
                <button onClick={() => { setPicking(false); setCandidates(null); setCorrectFor(null); }} className="rounded p-1" aria-label="Cancel"><X className="h-3.5 w-3.5" /></button>
              </div>
              {candidates.length === 0 && <p className="text-xs text-muted-foreground">No recorded interventions for this player.</p>}
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {candidates.map((c) => (
                  <div key={c.interventionId} className="flex flex-wrap items-center justify-between gap-2 rounded border p-1.5 text-xs">
                    <div className="space-y-0.5">
                      <div className="font-medium text-foreground">{c.interventionType ?? 'Recorded intervention'}</div>
                      <div className="text-muted-foreground">
                        Recorded {dt(c.interventionDate)} · {RECORDED_OUTCOME_PREFIX}: <span className="font-medium text-foreground">{c.recordedOutcome ?? '—'}</span>
                      </div>
                    </div>
                    {c.alreadyLinked && !correctFor
                      ? <Badge variant="outline" className="font-normal">Already linked</Badge>
                      : <button onClick={() => doLink(c.interventionId)} disabled={busy}
                          className="flex items-center gap-1 rounded-md border px-2 py-1 disabled:opacity-60">
                          <Check className="h-3 w-3" /> {correctFor ? 'Replace' : 'Link'}
                        </button>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {notice && <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><Info className="h-3 w-3" /> {notice}</p>}
        </div>
      )}
    </div>
  );
}
