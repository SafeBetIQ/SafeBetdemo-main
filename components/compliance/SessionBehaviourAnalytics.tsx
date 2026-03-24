'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, Clock, TrendingDown, TriangleAlert as AlertTriangle, RefreshCw, Gamepad2, DollarSign, Timer, CircleDot, ChartBar as BarChart3, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/lib/supabase';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
  ScatterChart, Scatter, ZAxis, LineChart, Line, Legend
} from 'recharts';

interface Session {
  id: string;
  player_id: string;
  game_type: string;
  duration: number;
  total_bet: number;
  total_won: number;
  net_result: number;
  is_active: boolean;
  start_time: string;
  end_time: string | null;
  players?: { first_name: string; last_name: string; player_id: string; risk_score: number; risk_level: string };
}

interface SessionBehaviourAnalyticsProps {
  casinoId: string;
}

const GAME_COLORS: Record<string, string> = {
  slots:       '#3b82f6',
  roulette:    '#f97316',
  blackjack:   '#10b981',
  poker:       '#eab308',
  baccarat:    '#ef4444',
  live_dealer: '#8b5cf6',
};

const SUSPICIOUS_FLAGS = [
  { pattern: 'Extended Session (>3hrs)', description: 'Sessions lasting more than 3 hours without break' },
  { pattern: 'Rapid Deposit Sequence', description: 'Multiple deposits within 30 minutes of loss' },
  { pattern: 'Loss-Chasing Behaviour', description: 'Increasing bet amounts after consecutive losses' },
  { pattern: 'Late Night Activity (00:00–05:00)', description: 'Gaming activity in early morning hours' },
  { pattern: 'High-Frequency Short Sessions', description: 'More than 5 sessions per day under 20 minutes' },
];

export function SessionBehaviourAnalytics({ casinoId }: SessionBehaviourAnalyticsProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [gameFilter, setGameFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('90d');

  useEffect(() => {
    loadSessions();
  }, [casinoId, periodFilter]);

  async function loadSessions() {
    setLoading(true);

    let query = supabase
      .from('gaming_sessions')
      .select('*, players(first_name, last_name, player_id, risk_score, risk_level)')
      .eq('casino_id', casinoId)
      .order('start_time', { ascending: false })
      .limit(500);

    if (periodFilter !== 'all') {
      const days = periodFilter === '24h' ? 1 : periodFilter === '7d' ? 7 : periodFilter === '30d' ? 30 : 90;
      const since = new Date();
      since.setDate(since.getDate() - days);
      query = query.gte('start_time', since.toISOString());
    }

    const { data } = await query;
    setSessions(data || []);
    setLoading(false);
  }

  const filtered = gameFilter === 'all' ? sessions : sessions.filter(s => s.game_type === gameFilter);

  // Game type breakdown
  const gameBreakdown = Object.entries(
    filtered.reduce((acc: Record<string, { sessions: number; revenue: number; avgDuration: number; totalDuration: number }>, s) => {
      if (!acc[s.game_type]) acc[s.game_type] = { sessions: 0, revenue: 0, avgDuration: 0, totalDuration: 0 };
      acc[s.game_type].sessions++;
      acc[s.game_type].revenue += Number(s.total_bet) || 0;
      acc[s.game_type].totalDuration += Number(s.duration) || 0;
      return acc;
    }, {})
  ).map(([game, d]) => ({
    game: game.charAt(0).toUpperCase() + game.slice(1).replace('_', ' '),
    sessions: d.sessions,
    revenue: Math.round(d.revenue / 1000),
    avgDuration: d.sessions > 0 ? Math.round(d.totalDuration / d.sessions) : 0,
    color: GAME_COLORS[game] || '#64748b',
  })).sort((a, b) => b.sessions - a.sessions);

  // Hourly pattern (heatmap data)
  const hourlyData = Array.from({ length: 24 }, (_, h) => {
    const count = filtered.filter(s => new Date(s.start_time).getHours() === h).length;
    const isSuspicious = h >= 0 && h < 5;
    return { hour: `${h.toString().padStart(2, '0')}:00`, count, suspicious: isSuspicious };
  });

  // Duration distribution buckets
  const durationBuckets = [
    { range: '<15 min', min: 0, max: 15 },
    { range: '15–30 min', min: 15, max: 30 },
    { range: '30–60 min', min: 30, max: 60 },
    { range: '1–2 hrs', min: 60, max: 120 },
    { range: '2–3 hrs', min: 120, max: 180 },
    { range: '>3 hrs (flag)', min: 180, max: 99999 },
  ].map(b => ({
    ...b,
    count: filtered.filter(s => (s.duration || 0) >= b.min && (s.duration || 0) < b.max).length,
  }));

  // KPIs
  const activeSessions = sessions.filter(s => s.is_active).length;
  const avgDuration = filtered.length > 0 ? Math.round(filtered.reduce((s, sess) => s + (sess.duration || 0), 0) / filtered.length) : 0;
  const totalWagered = filtered.reduce((s, sess) => s + (Number(sess.total_bet) || 0), 0);
  const extendedSessions = filtered.filter(s => (s.duration || 0) > 180).length;
  const lateNight = filtered.filter(s => {
    const h = new Date(s.start_time).getHours();
    return h >= 0 && h < 5;
  }).length;

  // Suspicious sessions
  const suspiciousSessions = filtered.filter(s =>
    (s.duration || 0) > 180 ||
    new Date(s.start_time).getHours() < 5 ||
    (s.players?.risk_score || 0) >= 80
  );

  if (loading) {
    return <div className="flex items-center justify-center h-48"><div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <TooltipProvider>
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap justify-between">
        <div className="flex items-center gap-2">
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="h-8 text-xs w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 hrs</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Select value={gameFilter} onValueChange={setGameFilter}>
            <SelectTrigger className="h-8 text-xs w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Game Types</SelectItem>
              <SelectItem value="slots">Slots</SelectItem>
              <SelectItem value="roulette">Roulette</SelectItem>
              <SelectItem value="blackjack">Blackjack</SelectItem>
              <SelectItem value="poker">Poker</SelectItem>
              <SelectItem value="baccarat">Baccarat</SelectItem>
              <SelectItem value="live_dealer">Live Dealer</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadSessions} className="h-8 w-8 p-0">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{filtered.length} sessions in period</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="relative">
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="absolute top-3 right-3 h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs"><p>Number of gaming sessions currently in progress across all players at this casino.</p></TooltipContent>
          </Tooltip>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
              <Activity className="h-3.5 w-3.5 text-emerald-500" /> Active Now
            </p>
            <p className="text-3xl font-bold text-emerald-600">{activeSessions}</p>
            <p className="text-xs text-muted-foreground">Live sessions</p>
          </CardContent>
        </Card>
        <Card className="relative">
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="absolute top-3 right-3 h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs"><p>Total sessions recorded during the selected time period after applying any active game type filter.</p></TooltipContent>
          </Tooltip>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
              <BarChart3 className="h-3.5 w-3.5" /> Total Sessions
            </p>
            <p className="text-3xl font-bold">{filtered.length}</p>
          </CardContent>
        </Card>
        <Card className="relative">
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="absolute top-3 right-3 h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs"><p>Average session length in minutes for the filtered period. Sessions averaging over 180 minutes may require proactive outreach.</p></TooltipContent>
          </Tooltip>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
              <Timer className="h-3.5 w-3.5" /> Avg Duration
            </p>
            <p className="text-3xl font-bold">{avgDuration}<span className="text-base font-normal text-muted-foreground">m</span></p>
          </CardContent>
        </Card>
        <Card className={`relative ${extendedSessions > 0 ? 'border-orange-200 bg-orange-50/40' : ''}`}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="absolute top-3 right-3 h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs"><p>Sessions exceeding 3 continuous hours. These are flagged as a responsible gambling concern and may require an intervention.</p></TooltipContent>
          </Tooltip>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-orange-600 flex items-center gap-1 mb-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Extended (&gt;3hrs)
            </p>
            <p className="text-3xl font-bold text-orange-600">{extendedSessions}</p>
            <p className="text-xs text-muted-foreground">Flagged sessions</p>
          </CardContent>
        </Card>
        <Card className={`relative ${lateNight > 0 ? 'border-yellow-200 bg-yellow-50/40' : ''}`}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="absolute top-3 right-3 h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs"><p>Sessions that started between 00:00 and 05:00. Late-night gambling is a recognised responsible gambling risk indicator.</p></TooltipContent>
          </Tooltip>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-yellow-600 flex items-center gap-1 mb-1">
              <Clock className="h-3.5 w-3.5" /> Late Night
            </p>
            <p className="text-3xl font-bold text-yellow-600">{lateNight}</p>
            <p className="text-xs text-muted-foreground">00:00–05:00 hrs</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="relative">
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="absolute top-3 right-3 h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors z-10" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs"><p>Session volume broken down by game category. Helps identify which game types are most frequently associated with problem gambling behaviour.</p></TooltipContent>
          </Tooltip>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Sessions by Game Type</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={gameBreakdown} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="game" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="sessions" radius={[4, 4, 0, 0]} name="Sessions">
                  {gameBreakdown.map((g, i) => <Cell key={i} fill={g.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="relative">
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="absolute top-3 right-3 h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors z-10" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs"><p>Distribution of sessions by length. The red bar (over 3 hrs) represents sessions flagged for responsible gambling review.</p></TooltipContent>
          </Tooltip>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Session Duration Distribution</CardTitle>
            <CardDescription className="text-xs">Sessions over 3 hours are flagged for review</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={durationBuckets} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="range" tick={{ fontSize: 9 }} angle={-15} textAnchor="end" height={40} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Sessions">
                  {durationBuckets.map((b, i) => (
                    <Cell key={i} fill={b.range.includes('flag') ? '#ef4444' : '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Hourly Activity Pattern */}
      <Card className="relative">
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="absolute top-3 right-3 h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors z-10" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs"><p>Hourly distribution of session start times. Red bars (00:00–05:00) highlight activity during hours associated with compulsive gambling patterns.</p></TooltipContent>
        </Tooltip>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Session Activity by Hour
          </CardTitle>
          <CardDescription className="text-xs">Sessions starting 00:00–05:00 are highlighted as a responsible gambling risk pattern</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={hourlyData} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={1} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <RechartsTooltip contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="count" name="Sessions" radius={[2, 2, 0, 0]}>
                {hourlyData.map((h, i) => (
                  <Cell key={i} fill={h.suspicious ? '#ef4444' : '#3b82f6'} fillOpacity={h.suspicious ? 0.9 : 0.7} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Flagged Sessions */}
      {suspiciousSessions.length > 0 && (
        <Card className="border-orange-200 relative">
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="absolute top-3 right-3 h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors z-10" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs"><p>Sessions that match one or more risk patterns: extended duration, late-night activity, or linked to a high-risk player. Manual review is recommended.</p></TooltipContent>
          </Tooltip>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Flagged Sessions ({suspiciousSessions.length})
            </CardTitle>
            <CardDescription className="text-xs">Sessions matching responsible gambling risk patterns — review recommended</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Player</TableHead>
                    <TableHead>Game</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead className="hidden md:table-cell">Start Time</TableHead>
                    <TableHead className="hidden lg:table-cell">Wagered</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Flag</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suspiciousSessions.slice(0, 20).map(s => {
                    const isExtended = (s.duration || 0) > 180;
                    const isLateNight = new Date(s.start_time).getHours() < 5;
                    const isHighRisk = (s.players?.risk_score || 0) >= 80;
                    return (
                      <TableRow key={s.id} className="hover:bg-muted/20">
                        <TableCell>
                          <p className="text-sm font-medium">{s.players?.first_name} {s.players?.last_name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{s.players?.player_id}</p>
                        </TableCell>
                        <TableCell className="text-xs capitalize">{s.game_type?.replace('_', ' ')}</TableCell>
                        <TableCell>
                          <span className={`text-sm font-medium ${isExtended ? 'text-red-600' : ''}`}>
                            {s.duration}m
                          </span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                          {new Date(s.start_time).toLocaleString()}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm font-medium">
                          R {Number(s.total_bet || 0).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <span className={`text-sm font-semibold ${isHighRisk ? 'text-red-600' : 'text-orange-600'}`}>
                            {s.players?.risk_score || '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {isExtended  && <Badge className="bg-red-100 text-red-700 border-0 text-xs">Extended</Badge>}
                            {isLateNight && <Badge className="bg-yellow-100 text-yellow-700 border-0 text-xs">Late Night</Badge>}
                            {isHighRisk  && <Badge className="bg-orange-100 text-orange-700 border-0 text-xs">High Risk</Badge>}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Suspicious Patterns Reference */}
      <Card className="border-dashed relative">
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="absolute top-3 right-3 h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors z-10" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs"><p>Reference list of all behavioural patterns the SafeBet IQ risk engine monitors. These patterns contribute to a player's overall risk score.</p></TooltipContent>
        </Tooltip>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Monitored Behaviour Patterns</CardTitle>
          <CardDescription className="text-xs">Patterns automatically flagged by the SafeBet IQ risk engine</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {SUSPICIOUS_FLAGS.map((f, i) => (
              <div key={i} className="flex items-start gap-2 p-3 rounded-lg border bg-muted/20">
                <CircleDot className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium">{f.pattern}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
    </TooltipProvider>
  );
}
