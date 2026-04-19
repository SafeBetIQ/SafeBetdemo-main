'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { TriangleAlert as AlertTriangle, Search, RefreshCw, TrendingUp, Users, Shield, Clock, Activity, ChartBar as BarChart3, Filter } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
  BarChart, Bar, PieChart, Pie, Legend
} from 'recharts';

interface HighRiskPlayer {
  id: string;
  player_id: string;
  first_name: string;
  last_name: string;
  risk_score: number;
  risk_level: string;
  total_wagered: number;
  session_count: number;
  last_active: string | null;
  status: string;
  casino_name: string;
  casino_province: string;
  interventions: number;
}

interface HighRiskPlayerAnalyticsProps {
  province?: string;
}

const RISK_COLORS = { critical: '#ef4444', high: '#f97316', medium: '#eab308' };

export function HighRiskPlayerAnalytics({ province }: HighRiskPlayerAnalyticsProps) {
  const [players, setPlayers] = useState<HighRiskPlayer[]>([]);
  const [casinos, setCasinos] = useState<{ id: string; name: string; province: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [casinoFilter, setCasinoFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, [province]);

  async function loadData() {
    setLoading(true);

    let casinoQuery = supabase.from('casinos').select('id, name, province').eq('is_active', true);
    if (province) casinoQuery = casinoQuery.eq('province', province);
    const { data: casinoList } = await casinoQuery.order('name');

    if (!casinoList || casinoList.length === 0) {
      setLoading(false);
      return;
    }
    setCasinos(casinoList);

    const casinoIds = casinoList.map(c => c.id);

    const { data: playerData } = await supabase
      .from('players')
      .select('id, player_id, first_name, last_name, risk_score, risk_level, total_wagered, session_count, last_active, status, casino_id')
      .in('casino_id', casinoIds)
      .in('risk_level', ['high', 'critical'])
      .order('risk_score', { ascending: false })
      .limit(500);

    if (!playerData || playerData.length === 0) {
      setLoading(false);
      return;
    }

    const playerIds = playerData.map(p => p.id);
    const { data: intCounts } = await supabase
      .from('player_protection_interventions')
      .select('player_id')
      .in('player_id', playerIds);

    const intCountMap: Record<string, number> = {};
    for (const i of (intCounts || [])) {
      intCountMap[i.player_id] = (intCountMap[i.player_id] || 0) + 1;
    }

    const casinoMap = Object.fromEntries(casinoList.map(c => [c.id, c]));

    setPlayers(playerData.map(p => ({
      ...p,
      casino_name: casinoMap[p.casino_id]?.name || 'Unknown',
      casino_province: casinoMap[p.casino_id]?.province || 'Unknown',
      interventions: intCountMap[p.id] || 0,
    })));

    setLoading(false);
  }

  const filtered = players.filter(p => {
    if (riskFilter !== 'all' && p.risk_level !== riskFilter) return false;
    if (casinoFilter !== 'all' && p.casino_name !== casinoFilter) return false;
    if (search) {
      const s = `${p.first_name} ${p.last_name} ${p.player_id} ${p.casino_name}`.toLowerCase();
      if (!s.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const critical = players.filter(p => p.risk_level === 'critical').length;
  const high     = players.filter(p => p.risk_level === 'high').length;
  const withNoIntervention = players.filter(p => p.interventions === 0).length;
  const avgScore = players.length > 0 ? Math.round(players.reduce((s, p) => s + p.risk_score, 0) / players.length) : 0;

  const interventionCoverage = players.length > 0
    ? Math.round(((players.length - withNoIntervention) / players.length) * 100)
    : 0;

  const scoreDistribution = [
    { range: '60–69', min: 60, max: 70 },
    { range: '70–79', min: 70, max: 80 },
    { range: '80–89', min: 80, max: 90 },
    { range: '90–100', min: 90, max: 101 },
  ].map(b => ({
    range: b.range,
    count: players.filter(p => p.risk_score >= b.min && p.risk_score < b.max).length,
  }));

  const casinoBreakdown = Object.entries(
    players.reduce((acc: Record<string, { critical: number; high: number }>, p) => {
      if (!acc[p.casino_name]) acc[p.casino_name] = { critical: 0, high: 0 };
      if (p.risk_level === 'critical') acc[p.casino_name].critical++;
      else acc[p.casino_name].high++;
      return acc;
    }, {})
  ).map(([name, d]) => ({ name: name.length > 22 ? name.slice(0, 20) + '…' : name, ...d }))
    .sort((a, b) => (b.critical + b.high) - (a.critical + a.high));

  const pieData = [
    { name: 'Critical (80+)', value: critical, color: '#ef4444' },
    { name: 'High (60–79)', value: high, color: '#f97316' },
  ].filter(d => d.value > 0);

  if (loading) {
    return <div className="flex items-center justify-center h-48"><div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <Card className="border-red-200 bg-red-50/40">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-red-600 flex items-center gap-1 mb-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Critical Risk
            </p>
            <p className="text-3xl font-bold text-red-600">{critical}</p>
            <p className="text-xs text-muted-foreground">Score 80+</p>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50/40">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-orange-600 flex items-center gap-1 mb-1">
              <TrendingUp className="h-3.5 w-3.5" /> High Risk
            </p>
            <p className="text-3xl font-bold text-orange-600">{high}</p>
            <p className="text-xs text-muted-foreground">Score 60–79</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
              <BarChart3 className="h-3.5 w-3.5" /> Avg Risk Score
            </p>
            <p className="text-3xl font-bold">{avgScore}</p>
          </CardContent>
        </Card>
        <Card className={withNoIntervention > 0 ? 'border-yellow-200 bg-yellow-50/40' : ''}>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-yellow-600 flex items-center gap-1 mb-1">
              <Clock className="h-3.5 w-3.5" /> No Intervention
            </p>
            <p className="text-3xl font-bold text-yellow-600">{withNoIntervention}</p>
            <p className="text-xs text-muted-foreground">Unaddressed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
              <Shield className="h-3.5 w-3.5 text-emerald-500" /> Intervention Coverage
            </p>
            <p className={`text-3xl font-bold ${interventionCoverage >= 80 ? 'text-emerald-600' : interventionCoverage >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
              {interventionCoverage}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Intervention Coverage Alert */}
      {withNoIntervention > 0 && (
        <div className="p-4 rounded-xl border border-yellow-200 bg-yellow-50 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-yellow-800">
              {withNoIntervention} high-risk player{withNoIntervention > 1 ? 's' : ''} have received no intervention
            </p>
            <p className="text-xs text-yellow-700 mt-0.5">
              National Gambling Act requires operators to actively manage players with elevated risk scores. Review operator compliance below.
            </p>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Risk Score Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={scoreDistribution} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Players">
                  {scoreDistribution.map((b, i) => (
                    <Cell key={i} fill={b.range.startsWith('9') ? '#ef4444' : b.range.startsWith('8') ? '#f97316' : '#eab308'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">High Risk by Operator</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={casinoBreakdown.slice(0, 8)} layout="vertical" margin={{ left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={100} />
                <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="critical" stackId="a" fill="#ef4444" name="Critical" radius={[0, 0, 0, 0]} />
                <Bar dataKey="high"     stackId="a" fill="#f97316" name="High"     radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Player Register */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-sm">High Risk Player Register</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Players with risk score 60+ — anonymised for regulatory oversight
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Search..." className="pl-8 h-8 text-xs w-40" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Select value={riskFilter} onValueChange={setRiskFilter}>
                <SelectTrigger className="h-8 text-xs w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Risk</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
              <Select value={casinoFilter} onValueChange={setCasinoFilter}>
                <SelectTrigger className="h-8 text-xs w-36">
                  <SelectValue placeholder="All Operators" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Operators</SelectItem>
                  {casinos.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={loadData} className="h-8 w-8 p-0">
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Player ID</TableHead>
                  <TableHead>Risk Score</TableHead>
                  <TableHead className="hidden md:table-cell">Operator</TableHead>
                  {!province && <TableHead className="hidden lg:table-cell">Province</TableHead>}
                  <TableHead className="hidden sm:table-cell">Sessions</TableHead>
                  <TableHead className="hidden lg:table-cell">Total Wagered</TableHead>
                  <TableHead className="hidden md:table-cell">Interventions</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">No high-risk players found</TableCell></TableRow>
                ) : filtered.slice(0, 50).map(p => (
                  <TableRow key={p.id} className="hover:bg-muted/20">
                    <TableCell className="font-mono text-xs">{p.player_id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${p.risk_level === 'critical' ? 'bg-red-500 animate-pulse' : 'bg-orange-500'}`} />
                        <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${p.risk_score}%`, backgroundColor: RISK_COLORS[p.risk_level as keyof typeof RISK_COLORS] || '#f97316' }} />
                        </div>
                        <span className="text-sm font-mono font-semibold">{p.risk_score}</span>
                        <Badge className={`border-0 text-xs hidden sm:inline-flex ${p.risk_level === 'critical' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                          {p.risk_level}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{p.casino_name}</TableCell>
                    {!province && <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{p.casino_province}</TableCell>}
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{p.session_count}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm font-medium">R {Number(p.total_wagered || 0).toLocaleString()}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {p.interventions > 0
                        ? <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">{p.interventions} sent</Badge>
                        : <Badge className="bg-red-100 text-red-700 border-0 text-xs">None</Badge>}
                    </TableCell>
                    <TableCell>
                      <Badge className={`border-0 text-xs ${p.status === 'active' ? 'bg-emerald-100 text-emerald-700' : p.status === 'self_excluded' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                        {p.status?.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filtered.length > 50 && (
            <p className="text-xs text-muted-foreground text-center mt-2">Showing 50 of {filtered.length} results</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
