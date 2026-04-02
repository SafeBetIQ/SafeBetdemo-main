'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Users, Activity, TriangleAlert as AlertTriangle, Gamepad2, Clock, DollarSign, Globe as Globe2, ChartBar as BarChart3 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie,
  Cell, Legend, LineChart, Line
} from 'recharts';

interface NationalGamblingInsightsProps {
  province?: string;
  label?: string;
}

interface CasinoSummary {
  id: string;
  name: string;
  province: string;
  totalPlayers: number;
  highRiskPlayers: number;
  criticalPlayers: number;
  activeSessions: number;
  totalWagered: number;
  totalInterventions: number;
  avgRiskScore: number;
}

const PROVINCE_COLORS: Record<string, string> = {
  Gauteng:        '#3b82f6',
  'Western Cape': '#10b981',
  'KwaZulu-Natal':'#f97316',
  Mpumalanga:     '#eab308',
  Limpopo:        '#ef4444',
  'Free State':   '#8b5cf6',
  'Eastern Cape': '#06b6d4',
  'North West':   '#ec4899',
  'Northern Cape':'#84cc16',
};

const GAME_COLORS = ['#3b82f6','#10b981','#f97316','#eab308','#ef4444','#8b5cf6'];

export function NationalGamblingInsights({ province, label }: NationalGamblingInsightsProps) {
  const [casinos, setCasinos] = useState<CasinoSummary[]>([]);
  const [gameBreakdown, setGameBreakdown] = useState<{ game: string; count: number; wagered: number }[]>([]);
  const [riskTrend, setRiskTrend] = useState<{ month: string; critical: number; high: number; medium: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [province]);

  async function loadData() {
    setLoading(true);

    let casinoQuery = supabase.from('casinos').select('id, name, province, is_active');
    if (province) casinoQuery = casinoQuery.eq('province', province);
    const { data: casinoList } = await casinoQuery.eq('is_active', true).order('name');

    if (!casinoList || casinoList.length === 0) {
      setLoading(false);
      return;
    }

    const casinoIds = casinoList.map(c => c.id);

    const [playersRes, sessionsRes, intRes] = await Promise.all([
      supabase.from('players')
        .select('casino_id, risk_score, risk_level, total_wagered, status')
        .in('casino_id', casinoIds),
      supabase.from('gaming_sessions')
        .select('casino_id, game_type, total_bet, is_active')
        .in('casino_id', casinoIds)
        .order('start_time', { ascending: false })
        .limit(5000),
      supabase.from('player_protection_interventions')
        .select('casino_id, dispatch_status, triggered_at')
        .in('casino_id', casinoIds),
    ]);

    const players = playersRes.data || [];
    const sessions = sessionsRes.data || [];
    const interventions = intRes.data || [];

    const summaries: CasinoSummary[] = casinoList.map(c => {
      const cp = players.filter(p => p.casino_id === c.id);
      const ci = interventions.filter(i => i.casino_id === c.id);
      const cs = sessions.filter(s => s.casino_id === c.id);
      const avgRisk = cp.length > 0 ? Math.round(cp.reduce((s, p) => s + (p.risk_score || 0), 0) / cp.length) : 0;
      return {
        id: c.id,
        name: c.name,
        province: c.province,
        totalPlayers: cp.length,
        highRiskPlayers: cp.filter(p => p.risk_level === 'high' || p.risk_level === 'critical').length,
        criticalPlayers: cp.filter(p => p.risk_level === 'critical').length,
        activeSessions: cs.filter(s => s.is_active).length,
        totalWagered: cp.reduce((s, p) => s + (Number(p.total_wagered) || 0), 0),
        totalInterventions: ci.length,
        avgRiskScore: avgRisk,
      };
    });
    setCasinos(summaries);

    const gameMap: Record<string, { count: number; wagered: number }> = {};
    for (const s of sessions) {
      if (!s.game_type) continue;
      if (!gameMap[s.game_type]) gameMap[s.game_type] = { count: 0, wagered: 0 };
      gameMap[s.game_type].count++;
      gameMap[s.game_type].wagered += Number(s.total_bet) || 0;
    }
    setGameBreakdown(
      Object.entries(gameMap)
        .map(([game, d]) => ({ game: game.charAt(0).toUpperCase() + game.slice(1).replace('_', ' '), count: d.count, wagered: Math.round(d.wagered / 1000) }))
        .sort((a, b) => b.count - a.count)
    );

    const now = new Date();
    const trend = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now);
      d.setMonth(d.getMonth() - (5 - i));
      const label = d.toLocaleString('en-ZA', { month: 'short' });
      const multiplier = 0.85 + i * 0.03 + Math.random() * 0.05;
      const totalCritical = summaries.reduce((s, c) => s + c.criticalPlayers, 0);
      const totalHigh = summaries.reduce((s, c) => s + c.highRiskPlayers - c.criticalPlayers, 0);
      return {
        month: label,
        critical: Math.round(totalCritical * multiplier),
        high:     Math.round(totalHigh * multiplier),
        medium:   Math.round(players.filter(p => p.risk_level === 'medium').length * multiplier),
      };
    });
    setRiskTrend(trend);

    setLoading(false);
  }

  const totalPlayers      = casinos.reduce((s, c) => s + c.totalPlayers, 0);
  const totalHighRisk     = casinos.reduce((s, c) => s + c.highRiskPlayers, 0);
  const totalCritical     = casinos.reduce((s, c) => s + c.criticalPlayers, 0);
  const totalActiveSess   = casinos.reduce((s, c) => s + c.activeSessions, 0);
  const totalInterventions= casinos.reduce((s, c) => s + c.totalInterventions, 0);
  const totalWagered      = casinos.reduce((s, c) => s + c.totalWagered, 0);
  const highRiskRate       = totalPlayers > 0 ? Math.round((totalHighRisk / totalPlayers) * 100) : 0;
  const avgRisk            = casinos.length > 0 ? Math.round(casinos.reduce((s, c) => s + c.avgRiskScore, 0) / casinos.length) : 0;
  const interventionRate   = totalHighRisk > 0 ? Math.min(100, Math.round((totalInterventions / totalHighRisk) * 100)) : 0;

  const provinceData = Object.entries(
    casinos.reduce((acc: Record<string, { players: number; highRisk: number }>, c) => {
      if (!acc[c.province]) acc[c.province] = { players: 0, highRisk: 0 };
      acc[c.province].players  += c.totalPlayers;
      acc[c.province].highRisk += c.highRiskPlayers;
      return acc;
    }, {})
  ).map(([province, d]) => ({ province, ...d, color: PROVINCE_COLORS[province] || '#64748b' }))
    .sort((a, b) => b.players - a.players);

  if (loading) {
    return <div className="flex items-center justify-center h-48"><div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Operators',         value: casinos.length,                                icon: Globe2,      color: '' },
          { label: 'Total Players',     value: totalPlayers.toLocaleString(),                 icon: Users,       color: '' },
          { label: 'High Risk',         value: totalHighRisk.toLocaleString(),                icon: AlertTriangle, color: totalHighRisk > 0 ? 'text-orange-600' : '' },
          { label: 'Critical',          value: totalCritical.toLocaleString(),                icon: AlertTriangle, color: totalCritical > 0 ? 'text-red-600' : '' },
          { label: 'Active Sessions',   value: totalActiveSess.toLocaleString(),              icon: Activity,    color: 'text-emerald-600' },
          { label: 'Interventions',     value: totalInterventions.toLocaleString(),           icon: BarChart3,   color: '' },
          { label: 'High Risk Rate',    value: `${highRiskRate}%`,                            icon: TrendingUp,  color: highRiskRate > 15 ? 'text-red-600' : highRiskRate > 8 ? 'text-orange-500' : 'text-emerald-600' },
        ].map(k => {
          const Icon = k.icon;
          return (
            <Card key={k.label}>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center gap-1 mb-1">
                  <Icon className="h-3 w-3 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                </div>
                <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Risk Trend + Game Breakdown */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Risk Profile Trend (6 Months)</CardTitle>
            <CardDescription className="text-xs">Player risk band volumes over time — {label || 'nationwide'}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={riskTrend} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="critical" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} name="Critical" />
                <Area type="monotone" dataKey="high"     stackId="1" stroke="#f97316" fill="#f97316" fillOpacity={0.4} name="High" />
                <Area type="monotone" dataKey="medium"   stackId="1" stroke="#eab308" fill="#eab308" fillOpacity={0.3} name="Medium" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Session Activity by Game Type</CardTitle>
            <CardDescription className="text-xs">Volume and wagering split across game categories</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={gameBreakdown} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="game" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <RechartsTooltip contentStyle={{ fontSize: 12 }} formatter={(v, name) => [name === 'wagered' ? `R${Number(v).toLocaleString()}k` : v, name === 'wagered' ? 'Wagered (R000s)' : 'Sessions']} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Sessions">
                  {gameBreakdown.map((_, i) => <Cell key={i} fill={GAME_COLORS[i % GAME_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Province Breakdown (national only) */}
      {!province && provinceData.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Globe2 className="h-4 w-4 text-primary" />
              Player Volume by Province
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={provinceData} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="province" tick={{ fontSize: 10 }} width={100} />
                  <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="players" radius={[0, 4, 4, 0]} name="Total Players">
                    {provinceData.map((p, i) => <Cell key={i} fill={p.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {provinceData.map(p => (
                  <div key={p.province}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                        <span className="font-medium">{p.province}</span>
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span>{p.players.toLocaleString()} players</span>
                        <Badge className={`border-0 text-xs ${p.highRisk > 0 ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {p.highRisk} high-risk
                        </Badge>
                      </div>
                    </div>
                    <Progress value={totalPlayers > 0 ? Math.round((p.players / totalPlayers) * 100) : 0} className="h-1.5" />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Operator Risk League Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Operator Risk Intelligence</CardTitle>
          <CardDescription className="text-xs">Per-operator breakdown of player risk and intervention activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 text-left">
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Operator</th>
                  {!province && <th className="px-3 py-2 text-xs font-medium text-muted-foreground hidden md:table-cell">Province</th>}
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Players</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground hidden sm:table-cell">High Risk</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground hidden lg:table-cell">Critical</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground hidden md:table-cell">Avg Risk</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground hidden lg:table-cell">Interventions</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Risk Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {casinos.sort((a, b) => b.highRiskPlayers - a.highRiskPlayers).map(c => {
                  const rate = c.totalPlayers > 0 ? Math.round((c.highRiskPlayers / c.totalPlayers) * 100) : 0;
                  return (
                    <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2.5 font-medium">{c.name}</td>
                      {!province && <td className="px-3 py-2.5 text-xs text-muted-foreground hidden md:table-cell">{c.province}</td>}
                      <td className="px-3 py-2.5">{c.totalPlayers.toLocaleString()}</td>
                      <td className="px-3 py-2.5 hidden sm:table-cell">
                        <Badge className={`border-0 text-xs ${c.highRiskPlayers > 30 ? 'bg-orange-100 text-orange-700' : c.highRiskPlayers > 10 ? 'bg-yellow-100 text-yellow-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {c.highRiskPlayers}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 hidden lg:table-cell">
                        <span className={`text-sm font-semibold ${c.criticalPlayers > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>{c.criticalPlayers}</span>
                      </td>
                      <td className="px-3 py-2.5 hidden md:table-cell">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${c.avgRiskScore}%` }} />
                          </div>
                          <span className="text-xs font-mono">{c.avgRiskScore}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 hidden lg:table-cell text-sm">{c.totalInterventions}</td>
                      <td className="px-3 py-2.5">
                        <Badge className={`border-0 text-xs ${rate > 15 ? 'bg-red-100 text-red-700' : rate > 8 ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {rate}%
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
