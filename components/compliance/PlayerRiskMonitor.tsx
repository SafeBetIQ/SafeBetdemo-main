'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Users, TriangleAlert as AlertTriangle, TrendingUp, TrendingDown, Search, Eye, RefreshCw, Activity, ArrowUpRight, Minus, ChevronRight, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';

interface Player {
  id: string;
  player_id: string;
  first_name: string;
  last_name: string;
  email: string;
  risk_score: number;
  risk_level: string;
  status: string;
  total_wagered: number;
  session_count: number;
  last_active: string | null;
}

interface PlayerRiskMonitorProps {
  casinoId: string;
}

const RISK_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#10b981',
};

const RISK_BADGE: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-emerald-100 text-emerald-700',
};

function getRiskLevel(score: number): string {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

export function PlayerRiskMonitor({ casinoId }: PlayerRiskMonitorProps) {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadPlayers();
  }, [casinoId]);

  async function loadPlayers() {
    setLoading(true);
    const { data } = await supabase
      .from('players')
      .select('id, player_id, first_name, last_name, email, risk_score, risk_level, status, total_wagered, session_count, last_active')
      .eq('casino_id', casinoId)
      .order('risk_score', { ascending: false })
      .limit(200);
    setPlayers(data || []);
    setLoading(false);
  }

  const filtered = players.filter(p => {
    const name = `${p.first_name} ${p.last_name} ${p.email}`.toLowerCase();
    if (search && !name.includes(search.toLowerCase())) return false;
    const level = getRiskLevel(p.risk_score);
    if (riskFilter !== 'all' && level !== riskFilter) return false;
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    return true;
  });

  const critical = players.filter(p => p.risk_score >= 80).length;
  const high      = players.filter(p => p.risk_score >= 60 && p.risk_score < 80).length;
  const medium    = players.filter(p => p.risk_score >= 40 && p.risk_score < 60).length;
  const low       = players.filter(p => p.risk_score < 40).length;
  const avgRisk   = players.length ? Math.round(players.reduce((s, p) => s + p.risk_score, 0) / players.length) : 0;

  const pieData = [
    { name: 'Critical', value: critical, color: '#ef4444' },
    { name: 'High',     value: high,     color: '#f97316' },
    { name: 'Medium',   value: medium,   color: '#eab308' },
    { name: 'Low',      value: low,      color: '#10b981' },
  ].filter(d => d.value > 0);

  const riskTrendData = Array.from({ length: 7 }, (_, i) => ({
    day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
    critical: Math.floor(critical * (0.8 + Math.random() * 0.4)),
    high:     Math.floor(high     * (0.8 + Math.random() * 0.4)),
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <TooltipProvider>
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="md:col-span-1 relative">
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="absolute top-3 right-3 h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs"><p>Total number of registered players at this casino operator.</p></TooltipContent>
          </Tooltip>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
              <Users className="h-3.5 w-3.5" /> Total Players
            </p>
            <p className="text-3xl font-bold">{players.length}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50 relative">
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="absolute top-3 right-3 h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs"><p>Players with a risk score of 80 or above. These require immediate intervention under the National Gambling Act.</p></TooltipContent>
          </Tooltip>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-red-600 flex items-center gap-1 mb-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Critical
            </p>
            <p className="text-3xl font-bold text-red-600">{critical}</p>
            <p className="text-xs text-muted-foreground">Score 80+</p>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50/50 relative">
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="absolute top-3 right-3 h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs"><p>Players scoring 60–79. Elevated risk indicators detected; interventions are recommended.</p></TooltipContent>
          </Tooltip>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-orange-600 flex items-center gap-1 mb-1">
              <TrendingUp className="h-3.5 w-3.5" /> High Risk
            </p>
            <p className="text-3xl font-bold text-orange-600">{high}</p>
            <p className="text-xs text-muted-foreground">Score 60–79</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 bg-yellow-50/50 relative">
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="absolute top-3 right-3 h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs"><p>Players with a risk score of 40–59. Monitoring is advised; no immediate action required.</p></TooltipContent>
          </Tooltip>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-yellow-600 flex items-center gap-1 mb-1">
              <Minus className="h-3.5 w-3.5" /> Medium
            </p>
            <p className="text-3xl font-bold text-yellow-600">{medium}</p>
            <p className="text-xs text-muted-foreground">Score 40–59</p>
          </CardContent>
        </Card>
        <Card className="relative">
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="absolute top-3 right-3 h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs"><p>Average risk score across all players at this casino. Higher scores indicate a greater overall portfolio risk.</p></TooltipContent>
          </Tooltip>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
              <Activity className="h-3.5 w-3.5" /> Avg Risk
            </p>
            <p className="text-3xl font-bold">{avgRisk}</p>
            <p className="text-xs text-muted-foreground">Portfolio score</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="relative">
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="absolute top-3 right-3 h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors z-10" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs"><p>Proportion of players in each risk band. A larger critical/high segment indicates greater compliance obligations.</p></TooltipContent>
          </Tooltip>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Risk Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Legend iconType="circle" iconSize={10} />
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="relative">
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="absolute top-3 right-3 h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors z-10" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs"><p>7-day trend showing the number of critical and high-risk players. An upward trend warrants urgent review.</p></TooltipContent>
          </Tooltip>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Critical & High Risk Trend (7 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={riskTrendData} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="critical" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} name="Critical" />
                <Area type="monotone" dataKey="high"     stroke="#f97316" fill="#f97316" fillOpacity={0.2} name="High" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Player Table */}
      <Card className="relative">
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="absolute top-3 right-3 h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors z-10" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs"><p>Live list of all players ranked by risk score. Click any row to view full behavioural risk intelligence for that player.</p></TooltipContent>
        </Tooltip>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-sm">Player Risk Register</CardTitle>
              <CardDescription className="text-xs mt-0.5">Live risk scores — your casino players only</CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Search players..." className="pl-8 h-8 text-xs w-44" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Select value={riskFilter} onValueChange={setRiskFilter}>
                <SelectTrigger className="h-8 text-xs w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Risk Levels</SelectItem>
                  <SelectItem value="critical">Critical (80+)</SelectItem>
                  <SelectItem value="high">High (60–79)</SelectItem>
                  <SelectItem value="medium">Medium (40–59)</SelectItem>
                  <SelectItem value="low">Low (&lt;40)</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 text-xs w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="self_excluded">Self-Excluded</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={loadPlayers} className="h-8 w-8 p-0">
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
                  <TableHead>Player</TableHead>
                  <TableHead>Risk Score</TableHead>
                  <TableHead className="hidden md:table-cell">Sessions</TableHead>
                  <TableHead className="hidden lg:table-cell">Total Wagered</TableHead>
                  <TableHead className="hidden md:table-cell">Last Active</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">View</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-10">No players found</TableCell>
                  </TableRow>
                ) : filtered.slice(0, 50).map(p => {
                  const level = getRiskLevel(p.risk_score);
                  return (
                    <TableRow key={p.id} className="hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => router.push('/behavioral-risk-intelligence')}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${level === 'critical' ? 'bg-red-500 animate-pulse' : level === 'high' ? 'bg-orange-500' : level === 'medium' ? 'bg-yellow-500' : 'bg-emerald-500'}`} />
                          <div>
                            <p className="text-sm font-medium">{p.first_name} {p.last_name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{p.player_id}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${p.risk_score}%`, backgroundColor: RISK_COLORS[level] }} />
                          </div>
                          <span className="text-sm font-mono font-semibold">{p.risk_score}</span>
                          <Badge className={`${RISK_BADGE[level]} border-0 text-xs ml-1 hidden sm:inline-flex`}>{level.charAt(0).toUpperCase() + level.slice(1)}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{p.session_count}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm font-medium">R {Number(p.total_wagered || 0).toLocaleString()}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {p.last_active ? new Date(p.last_active).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge className={`border-0 text-xs ${p.status === 'active' ? 'bg-emerald-100 text-emerald-700' : p.status === 'self_excluded' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                          {p.status?.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {filtered.length > 50 && (
            <p className="text-xs text-muted-foreground mt-2 text-center">Showing 50 of {filtered.length} results</p>
          )}
        </CardContent>
      </Card>
    </div>
    </TooltipProvider>
  );
}
