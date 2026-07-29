'use client';

// ─── Player Risk Monitor (v1.5.1 convergence) ────────────────────────────────
// Consumes the certified Consumer Platform live-floor view. The player
// population here is identical to the Operator Dashboard, Live Casino Feed and
// Explainability — ONE population, ONE risk source. No direct table reads.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/DashboardLayout';
import { CasinoAdminGuard } from '@/components/CasinoAdminGuard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { cgGet } from '@/lib/consumerClient';
import { Users, RefreshCw, Search, Lightbulb } from 'lucide-react';

type Rec = Record<string, unknown>;
const n = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0)) || 0;
const tone = (lvl: string) => (lvl === 'critical' || lvl === 'high' ? 'destructive' : lvl === 'medium' ? 'default' : 'secondary');

export default function PlayerRiskMonitorPage() {
  const { user } = useAuth();
  const casinoId = (user as unknown as Rec)?.casino_id as string | undefined;
  const [players, setPlayers] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [tier, setTier] = useState<string>('all');

  const refresh = useCallback(async () => {
    setLoading(true);
    const floor = await cgGet('live-floor', { casino_id: casinoId });
    setPlayers(((floor?.players ?? []) as Rec[]));
    setLoading(false);
  }, [casinoId]);
  useEffect(() => { refresh(); }, [refresh]);

  const filtered = useMemo(() => players
    .filter(p => tier === 'all' || p.riskLevel === tier)
    .filter(p => !q || String(p.playerId).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => n(b.riskScore) - n(a.riskScore)), [players, q, tier]);

  const tiers = useMemo(() => {
    const t = { critical: 0, high: 0, medium: 0, low: 0 } as Record<string, number>;
    players.forEach(p => { t[String(p.riskLevel)] = (t[String(p.riskLevel)] ?? 0) + 1; });
    return t;
  }, [players]);

  return (
    <CasinoAdminGuard>
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6" /> Player Risk Monitor</h1>
              <p className="text-muted-foreground">{players.length} active players · certified Consumer Platform (live-floor)</p>
            </div>
            <Button variant="outline" onClick={refresh} disabled={loading}><RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh</Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {['all', 'critical', 'high', 'medium', 'low'].map(t => (
              <Button key={t} size="sm" variant={tier === t ? 'default' : 'outline'} onClick={() => setTier(t)}>
                {t === 'all' ? `All (${players.length})` : `${t} (${tiers[t] ?? 0})`}
              </Button>
            ))}
            <div className="ml-auto relative">
              <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
              <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search SB-PLR…" className="pl-8 w-64 font-mono" />
            </div>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Players</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player (SB-PLR)</TableHead><TableHead>Game</TableHead>
                    <TableHead className="text-right">Total wagered</TableHead>
                    <TableHead className="text-right">Session (min)</TableHead>
                    <TableHead className="text-right">Risk</TableHead><TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>}
                  {!loading && filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No players match.</TableCell></TableRow>}
                  {filtered.map((p) => (
                    <TableRow key={String(p.id)}>
                      <TableCell className="font-mono text-xs">{String(p.playerId)}</TableCell>
                      <TableCell>{String(p.game)}</TableCell>
                      <TableCell className="text-right tabular-nums">R {n(p.totalWagered).toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums">{Math.round(n(p.sessionDuration) / 60)}</TableCell>
                      <TableCell className="text-right"><Badge variant={tone(String(p.riskLevel)) as never}>{n(p.riskScore)}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="ghost"><Link href={`/casino/players/${encodeURIComponent(String(p.playerId))}/investigate`}><Lightbulb className="h-4 w-4" /></Link></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </CasinoAdminGuard>
  );
}
