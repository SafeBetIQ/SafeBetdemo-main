'use client';

// ─── Operator Self-Exclusion Register (UAT-OP-3 P1-B) ────────────────────────
// An AUTHENTICATED Casino Operator dashboard module (inside AppShell), NOT the
// marketing /features/self-exclusion-network page. Read-only: it presents the
// certified self-exclusion register scoped to the operator's own casino. Data
// comes from the `self_exclusions` table; row access is enforced by RLS
// ("Casino admins see own exclusions": casino_id = the caller's casino) and,
// defence-in-depth, an explicit casino_id filter. No write actions are exposed
// (Phase 12) and no fields are fabricated — only columns that exist are shown.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { CasinoAdminGuard } from '@/components/CasinoAdminGuard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ShieldBan, Search, RefreshCw } from 'lucide-react';

type Rec = Record<string, unknown>;

interface Exclusion {
  id: string;
  player_token: string | null;
  player_id: string | null;
  exclusion_type: string | null;
  duration_type: string | null;
  duration_days: number | null;
  starts_at: string | null;
  ends_at: string | null;
  status: string | null;
  breach_count: number | null;
  reason: string | null;
  updated_at: string | null;
}

const STATUS_TONE: Record<string, 'destructive' | 'secondary' | 'outline'> = {
  active: 'destructive', breached: 'destructive', expired: 'outline', lifted: 'secondary',
};

const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—');

export default function OperatorSelfExclusionPage() {
  const { user } = useAuth();
  const casinoId = (user as unknown as Rec)?.casino_id as string | undefined;
  const [rows, setRows] = useState<Exclusion[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const refresh = useCallback(async () => {
    if (!casinoId) return;
    setLoading(true); setUnavailable(false);
    // Scope to the operator's own casino (RLS also enforces this).
    const { data, error } = await supabase
      .from('self_exclusions')
      .select('id, player_token, player_id, exclusion_type, duration_type, duration_days, starts_at, ends_at, status, breach_count, reason, updated_at')
      .eq('casino_id', casinoId)
      .order('starts_at', { ascending: false })
      .limit(500);
    if (error) { setUnavailable(true); setRows([]); }
    else setRows((data ?? []) as Exclusion[]);
    setLoading(false);
  }, [casinoId]);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== 'all' && (r.status ?? '') !== statusFilter) return false;
      if (!needle) return true;
      return [r.player_token, r.reason, r.exclusion_type].some((f) => String(f ?? '').toLowerCase().includes(needle));
    });
  }, [rows, q, statusFilter]);

  const activeCount = rows.filter((r) => r.status === 'active').length;

  return (
    <CasinoAdminGuard>
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldBan className="h-6 w-6" /> Self-Exclusion Register</h1>
              <p className="text-muted-foreground">Read-only self-exclusion status for your operator. Scoped to this casino; the network signal never exposes another operator&apos;s private records.</p>
            </div>
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="Search self-exclusions" placeholder="Search player reference, reason, type…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44" aria-label="Filter by status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="lifted">Lifted</SelectItem>
                <SelectItem value="breached">Breached</SelectItem>
              </SelectContent>
            </Select>
            {!loading && !unavailable && (
              <span className="text-sm text-muted-foreground">{activeCount} active · {rows.length} total</span>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Register</CardTitle>
              <CardDescription>Recorded self-exclusions (read-only). Fields shown reflect the certified record.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2" aria-busy="true">
                  {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-9 w-full rounded bg-muted animate-pulse" />)}
                </div>
              ) : unavailable ? (
                <p className="text-sm text-muted-foreground">The self-exclusion register is currently unavailable.</p>
              ) : filtered.length === 0 ? (
                <div className="py-10 text-center">
                  <ShieldBan className="h-7 w-7 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium">{rows.length === 0 ? 'No active self-exclusions found for this operator.' : 'No records match your search.'}</p>
                  <p className="text-xs text-muted-foreground mt-1">This register lists players self-excluded (or excluded) at your casino and their current status.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                        <th className="py-2 pr-4 font-medium">Player reference</th>
                        <th className="py-2 pr-4 font-medium">Status</th>
                        <th className="py-2 pr-4 font-medium">Type</th>
                        <th className="py-2 pr-4 font-medium">Start</th>
                        <th className="py-2 pr-4 font-medium">End</th>
                        <th className="py-2 pr-4 font-medium">Reason</th>
                        <th className="py-2 pr-4 font-medium">Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r) => (
                        <tr key={r.id} className="border-b last:border-0">
                          <td className="py-2 pr-4 font-mono text-xs">{r.player_token ?? '—'}</td>
                          <td className="py-2 pr-4"><Badge variant={STATUS_TONE[r.status ?? ''] ?? 'outline'}>{r.status ?? 'unknown'}</Badge></td>
                          <td className="py-2 pr-4">{r.exclusion_type ?? '—'}{r.duration_type ? ` · ${r.duration_type}` : ''}</td>
                          <td className="py-2 pr-4 tabular-nums">{fmtDate(r.starts_at)}</td>
                          <td className="py-2 pr-4 tabular-nums">{r.ends_at ? fmtDate(r.ends_at) : (r.duration_type === 'indefinite' || r.duration_type === 'permanent' ? '—' : '—')}</td>
                          <td className="py-2 pr-4 max-w-[220px] truncate" title={r.reason ?? ''}>{r.reason ?? '—'}</td>
                          <td className="py-2 pr-4 tabular-nums text-muted-foreground text-xs">{fmtDate(r.updated_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </CasinoAdminGuard>
  );
}
