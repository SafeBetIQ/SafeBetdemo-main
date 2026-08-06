'use client';

// Overview financial (certified GGR, v2 rollup-backed, deferred) + registered-player
// snapshot age with a Super-Admin manual refresh. Never blanks the count during
// refresh; shows Partial capability + synthetic disclosure + rollup freshness.

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, DollarSign, Users } from 'lucide-react';
import { SnapshotAge } from '@/components/SnapshotAge';

const N = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0));
const zar = (v: unknown) => `R ${N(v).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`;

function freshnessBadge(f: string) {
  const s = (f || 'Unknown').toLowerCase();
  const cls = s === 'current' ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
    : s === 'delayed' ? 'bg-amber-100 text-amber-800 border-amber-200'
    : s === 'stale' ? 'bg-red-100 text-red-800 border-red-200'
    : 'bg-slate-100 text-slate-600 border-slate-200';
  return <Badge variant="outline" className={cls}>{f || 'Unknown'}</Badge>;
}

export function OverviewFinancialRegistered({
  financial, financialLoading, registeredStatus, refreshRegistered, registeredRefreshing,
}: {
  financial: Record<string, unknown> | null;
  financialLoading: boolean;
  registeredStatus: Record<string, unknown> | null;
  refreshRegistered: () => Promise<{ ok: boolean; reason?: string }>;
  registeredRefreshing: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const f = financial ?? {};
  const reg = registeredStatus ?? {};
  const regTotal = N(reg.registered_count_total);
  const isStale = reg.is_stale === true;

  const doRefresh = async () => {
    setConfirming(false); setMsg(null);
    const r = await refreshRegistered();
    setMsg(r.ok ? (r.reason === 'rate_limited' ? 'Recently refreshed — try again shortly.' : 'Registered snapshot updated.') : 'Refresh failed — last snapshot retained.');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Certified financial (GGR) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-1.5"><DollarSign className="h-4 w-4 text-primary" /> Certified GGR (today)</span>
            {financial ? freshnessBadge(String(f.freshness ?? 'Unknown')) : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!financial && financialLoading ? (
            <div className="animate-pulse space-y-2"><div className="h-7 w-40 rounded bg-muted" /><div className="h-3 w-56 rounded bg-muted" /></div>
          ) : financial ? (
            <>
              <p className="text-2xl font-bold">{zar(f.ggr_today)}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {String(f.currency ?? 'ZAR')} · GGR = settled stakes − player winnings ·{' '}
                <span className="font-medium">{String(f.status ?? '—')}</span> capability
                {f.is_simulated ? ' · synthetic' : ''}
              </p>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <SnapshotAge asOf={f.snapshot_at as string} staleAfterSeconds={120} />
                <span className="text-[10px] text-muted-foreground/70">source: {String(f.source ?? '—')} v{String(f.rollup_version ?? '—')}{f.fallback ? ' (fallback)' : ''}</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Financial posture unavailable.</p>
          )}
        </CardContent>
      </Card>

      {/* Registered players + freshness + manual refresh */}
      <Card className={isStale ? 'border-amber-200 bg-amber-50/30' : ''}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5"><Users className="h-4 w-4 text-primary" /> Registered players</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{regTotal ? regTotal.toLocaleString() : '—'}</p>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <SnapshotAge asOf={reg.refreshed_at as string} staleAfterSeconds={N(reg.stale_after_seconds) || 21600} />
            {isStale && <span className="text-[11px] text-amber-700 font-medium">Registered-player snapshot may be delayed.</span>}
          </div>
          <div className="mt-2 flex items-center gap-2">
            {!confirming ? (
              <Button size="sm" variant="outline" disabled={registeredRefreshing} onClick={() => setConfirming(true)}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${registeredRefreshing ? 'animate-spin' : ''}`} />
                {registeredRefreshing ? 'Refreshing…' : 'Refresh count'}
              </Button>
            ) : (
              <>
                <span className="text-[11px] text-muted-foreground">Recompute registered totals?</span>
                <Button size="sm" variant="default" onClick={doRefresh} disabled={registeredRefreshing}>Confirm</Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
              </>
            )}
            {msg && <span className="text-[11px] text-muted-foreground">{msg}</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
