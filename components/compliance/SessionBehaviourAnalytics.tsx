'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Activity, Clock, TriangleAlert as AlertTriangle, RefreshCw,
  DollarSign, Timer, CircleDot, ChartBar as BarChart3, Info,
  Radio, User
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/lib/supabase';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
} from 'recharts';

interface Session {
  id: string;
  player_id: string;
  casino_id: string;
  game_type: string;
  duration: number;
  total_wagered: number;
  total_won: number;
  net_result: number;
  total_bets: number;
  is_active: boolean;
  start_time: string;
  end_time: string | null;
  players?: {
    first_name: string;
    last_name: string;
    player_id: string;
    risk_score: number;
    risk_level: string;
  };
}

interface SessionBehaviourAnalyticsProps {
  casinoId: string;
}

const GAME_COLORS: Record<string, string> = {
  slots:     '#3b82f6',
  roulette:  '#f97316',
  blackjack: '#10b981',
  poker:     '#eab308',
  baccarat:  '#ef4444',
};

const SUSPICIOUS_FLAGS = [
  { pattern: 'Extended Session (>3hrs)', description: 'Sessions lasting more than 3 hours without break' },
  { pattern: 'Rapid Deposit Sequence', description: 'Multiple deposits within 30 minutes of loss' },
  { pattern: 'Loss-Chasing Behaviour', description: 'Increasing bet amounts after consecutive losses' },
  { pattern: 'Late Night Activity (00:00–05:00)', description: 'Gaming activity in early morning hours' },
  { pattern: 'High-Frequency Short Sessions', description: 'More than 5 sessions per day under 20 minutes' },
];

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function timeSince(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export function SessionBehaviourAnalytics({ casinoId }: SessionBehaviourAnalyticsProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [liveSessions, setLiveSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveLoading, setLiveLoading] = useState(true);
  const [gameFilter, setGameFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('7d');
  const [activeTab, setActiveTab] = useState('analytics');

  const loadLiveSessions = useCallback(async () => {
    setLiveLoading(true);
    const { data } = await supabase
      .from('gaming_sessions')
      .select('*, players(first_name, last_name, player_id, risk_score, risk_level)')
      .eq('casino_id', casinoId)
      .eq('is_active', true)
      .order('start_time', { ascending: false })
      .limit(200);
    setLiveSessions(data || []);
    setLiveLoading(false);
  }, [casinoId]);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('gaming_sessions')
      .select('*, players(first_name, last_name, player_id, risk_score, risk_level)')
      .eq('casino_id', casinoId)
      .eq('is_active', false)
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
  }, [casinoId, periodFilter]);

  useEffect(() => {
    loadSessions();
    loadLiveSessions();
  }, [loadSessions, loadLiveSessions]);

  const filtered = gameFilter === 'all' ? sessions : sessions.filter(s => s.game_type === gameFilter);

  // Game type breakdown
  const gameBreakdown = Object.entries(
    filtered.reduce((acc: Record<string, { sessions: number; revenue: number; totalDuration: number }>, s) => {
      if (!acc[s.game_type]) acc[s.game_type] = { sessions: 0, revenue: 0, totalDuration: 0 };
      acc[s.game_type].sessions++;
      acc[s.game_type].revenue += Number(s.total_wagered) || 0;
      acc[s.game_type].totalDuration += Number(s.duration) || 0;
      return acc;
    }, {})
  ).map(([game, d]) => ({
    game: game.charAt(0).toUpperCase() + game.slice(1),
    sessions: d.sessions,
    revenue: Math.round(d.revenue / 1000),
    avgDuration: d.sessions > 0 ? Math.round(d.totalDuration / d.sessions) : 0,
    color: GAME_COLORS[game] || '#64748b',
  })).sort((a, b) => b.sessions - a.sessions);

  // Hourly pattern
  const hourlyData = Array.from({ length: 24 }, (_, h) => {
    const count = filtered.filter(s => new Date(s.start_time).getHours() === h).length;
    return { hour: `${h.toString().padStart(2, '0')}:00`, count, suspicious: h >= 0 && h < 5 };
  });

  // Duration distribution
  const durationBuckets = [
    { range: '<15m', min: 0, max: 15 },
    { range: '15–30m', min: 15, max: 30 },
    { range: '30–60m', min: 30, max: 60 },
    { range: '1–2h', min: 60, max: 120 },
    { range: '2–3h', min: 120, max: 180 },
    { range: '>3h', min: 180, max: 99999 },
  ].map(b => ({
    ...b,
    count: filtered.filter(s => (s.duration || 0) >= b.min && (s.duration || 0) < b.max).length,
    flag: b.min >= 180,
  }));

  // KPIs
  const avgDuration = filtered.length > 0
    ? Math.round(filtered.reduce((s, sess) => s + (sess.duration || 0), 0) / filtered.length) : 0;
  const totalWagered = filtered.reduce((s, sess) => s + (Number(sess.total_wagered) || 0), 0);
  const extendedSessions = filtered.filter(s => (s.duration || 0) > 180).length;
  const lateNight = filtered.filter(s => new Date(s.start_time).getHours() < 5).length;

  // Flagged sessions
  const suspiciousSessions = filtered.filter(s =>
    (s.duration || 0) > 180 ||
    new Date(s.start_time).getHours() < 5 ||
    (s.players?.risk_score || 0) >= 80
  );

  // Live game breakdown
  const liveGameBreakdown = Object.entries(
    liveSessions.reduce((acc: Record<string, number>, s) => {
      acc[s.game_type] = (acc[s.game_type] || 0) + 1;
      return acc;
    }, {})
  ).map(([game, count]) => ({
    game: game.charAt(0).toUpperCase() + game.slice(1),
    count,
    color: GAME_COLORS[game] || '#64748b',
  })).sort((a, b) => b.count - a.count);

  const liveHighRisk = liveSessions.filter(s => (s.players?.risk_score || 0) >= 70).length;
  const liveExtended = liveSessions.filter(s => (s.duration || 0) > 180).length;
  const liveTotalWagered = liveSessions.reduce((s, sess) => s + (Number(sess.total_wagered) || 0), 0);

  return (
    <TooltipProvider>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="live" className="flex items-center gap-2">
            <Radio className="h-3.5 w-3.5 text-emerald-500" />
            Live Play
            {liveSessions.length > 0 && (
              <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs ml-1 px-1.5 py-0">
                {liveSessions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="analytics">Session Analytics</TabsTrigger>
        </TabsList>

        {/* ── LIVE PLAY TAB ── */}
        <TabsContent value="live" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <p className="text-sm font-medium text-emerald-700">
                {liveLoading ? 'Loading...' : `${liveSessions.length} players in active sessions`}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={loadLiveSessions} className="h-8 w-8 p-0">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Live KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-emerald-200 bg-emerald-50/40">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-emerald-700 flex items-center gap-1 mb-1">
                  <Activity className="h-3.5 w-3.5" /> Active Players
                </p>
                <p className="text-3xl font-bold text-emerald-700">{liveSessions.length}</p>
                <p className="text-xs text-muted-foreground">In live play now</p>
              </CardContent>
            </Card>
            <Card className={liveHighRisk > 0 ? 'border-orange-200 bg-orange-50/40' : ''}>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-orange-600 flex items-center gap-1 mb-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> High Risk Active
                </p>
                <p className="text-3xl font-bold text-orange-600">{liveHighRisk}</p>
                <p className="text-xs text-muted-foreground">Risk score ≥70</p>
              </CardContent>
            </Card>
            <Card className={liveExtended > 0 ? 'border-red-200 bg-red-50/40' : ''}>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-red-600 flex items-center gap-1 mb-1">
                  <Timer className="h-3.5 w-3.5" /> Extended (&gt;3h)
                </p>
                <p className="text-3xl font-bold text-red-600">{liveExtended}</p>
                <p className="text-xs text-muted-foreground">Flagged sessions</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                  <DollarSign className="h-3.5 w-3.5" /> Live Wagered
                </p>
                <p className="text-2xl font-bold">R {Math.round(liveTotalWagered / 1000)}k</p>
                <p className="text-xs text-muted-foreground">In active sessions</p>
              </CardContent>
            </Card>
          </div>

          {/* Live game breakdown */}
          {liveGameBreakdown.length > 0 && (
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Active Sessions by Game</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={liveGameBreakdown} margin={{ left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="game" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Active Players">
                        {liveGameBreakdown.map((g, i) => <Cell key={i} fill={g.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Risk Distribution (Live)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 pt-1">
                    {[
                      { label: 'Critical (90–100)', min: 90, color: 'bg-red-500' },
                      { label: 'High (70–89)', min: 70, max: 90, color: 'bg-orange-500' },
                      { label: 'Medium (40–69)', min: 40, max: 70, color: 'bg-yellow-500' },
                      { label: 'Low (0–39)', min: 0, max: 40, color: 'bg-emerald-500' },
                    ].map(band => {
                      const count = liveSessions.filter(s => {
                        const rs = s.players?.risk_score || 0;
                        return rs >= band.min && (band.max === undefined || rs < band.max);
                      }).length;
                      const pct = liveSessions.length > 0 ? Math.round((count / liveSessions.length) * 100) : 0;
                      return (
                        <div key={band.label} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-36">{band.label}</span>
                          <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                            <div className={`h-full rounded-full ${band.color}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-medium w-8 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Live player table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4" />
                Active Players ({liveSessions.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Players currently in an active gaming session — ordered by session duration
              </CardDescription>
            </CardHeader>
            <CardContent>
              {liveLoading ? (
                <div className="flex items-center justify-center h-24">
                  <div className="h-5 w-5 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : liveSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No active sessions at this time.</p>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Player</TableHead>
                        <TableHead>Game</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Started</TableHead>
                        <TableHead>Wagered</TableHead>
                        <TableHead>Risk</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {liveSessions
                        .sort((a, b) => (b.duration || 0) - (a.duration || 0))
                        .slice(0, 50)
                        .map(s => {
                          const isExtended = (s.duration || 0) > 180;
                          const isHighRisk = (s.players?.risk_score || 0) >= 70;
                          const isCritical = (s.players?.risk_score || 0) >= 90;
                          return (
                            <TableRow key={s.id} className={`hover:bg-muted/20 ${isExtended ? 'bg-red-50/30' : ''}`}>
                              <TableCell>
                                <p className="text-sm font-medium">
                                  {s.players?.first_name} {s.players?.last_name}
                                </p>
                                <p className="text-xs text-muted-foreground font-mono">
                                  {s.players?.player_id}
                                </p>
                              </TableCell>
                              <TableCell className="text-xs capitalize">{s.game_type}</TableCell>
                              <TableCell>
                                <span className={`text-sm font-semibold ${isExtended ? 'text-red-600' : ''}`}>
                                  {formatDuration(s.duration || 0)}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {timeSince(s.start_time)}
                              </TableCell>
                              <TableCell className="text-sm font-medium">
                                R {Number(s.total_wagered || 0).toLocaleString()}
                              </TableCell>
                              <TableCell>
                                <span className={`text-sm font-bold ${isCritical ? 'text-red-600' : isHighRisk ? 'text-orange-600' : 'text-muted-foreground'}`}>
                                  {s.players?.risk_score ?? '—'}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Live</Badge>
                                  {isExtended && <Badge className="bg-red-100 text-red-700 border-0 text-xs">Extended</Badge>}
                                  {isCritical && <Badge className="bg-red-100 text-red-700 border-0 text-xs">Critical</Badge>}
                                  {isHighRisk && !isCritical && <Badge className="bg-orange-100 text-orange-700 border-0 text-xs">High Risk</Badge>}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                  {liveSessions.length > 50 && (
                    <p className="text-xs text-muted-foreground text-center py-2 border-t">
                      Showing top 50 of {liveSessions.length} active sessions
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ANALYTICS TAB ── */}
        <TabsContent value="analytics" className="space-y-6">
          {/* Controls */}
          <div className="flex items-center gap-2 flex-wrap justify-between">
            <div className="flex items-center gap-2">
              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger className="h-8 text-xs w-32">
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
            <Card className="border-emerald-200 bg-emerald-50/40 relative">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="absolute top-3 right-3 h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs"><p>Number of gaming sessions currently in progress.</p></TooltipContent>
              </Tooltip>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-emerald-700 flex items-center gap-1 mb-1">
                  <Activity className="h-3.5 w-3.5" /> Active Now
                </p>
                <p className="text-3xl font-bold text-emerald-700">{liveSessions.length}</p>
                <p className="text-xs text-muted-foreground">Live sessions</p>
              </CardContent>
            </Card>
            <Card className="relative">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="absolute top-3 right-3 h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs"><p>Total completed sessions in the selected period.</p></TooltipContent>
              </Tooltip>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                  <BarChart3 className="h-3.5 w-3.5" /> Total Sessions
                </p>
                <p className="text-3xl font-bold">{filtered.length.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="relative">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="absolute top-3 right-3 h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs"><p>Average session length in minutes. Over 180 minutes may require proactive outreach.</p></TooltipContent>
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
                  <Info className="absolute top-3 right-3 h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs"><p>Sessions exceeding 3 continuous hours — flagged as a responsible gambling concern.</p></TooltipContent>
              </Tooltip>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-orange-600 flex items-center gap-1 mb-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> Extended (&gt;3h)
                </p>
                <p className="text-3xl font-bold text-orange-600">{extendedSessions}</p>
                <p className="text-xs text-muted-foreground">Flagged sessions</p>
              </CardContent>
            </Card>
            <Card className={`relative ${lateNight > 0 ? 'border-yellow-200 bg-yellow-50/40' : ''}`}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="absolute top-3 right-3 h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs"><p>Sessions started between 00:00 and 05:00 — a recognised responsible gambling risk pattern.</p></TooltipContent>
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

          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <>
              {/* Charts Row */}
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
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

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Session Duration Distribution</CardTitle>
                    <CardDescription className="text-xs">Sessions over 3 hours are flagged for review</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={durationBuckets} margin={{ left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                        <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Sessions">
                          {durationBuckets.map((b, i) => (
                            <Cell key={i} fill={b.flag ? '#ef4444' : '#3b82f6'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Hourly Activity */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Session Activity by Hour
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Sessions starting 00:00–05:00 are highlighted as a responsible gambling risk pattern
                  </CardDescription>
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
                <Card className="border-orange-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      Flagged Sessions ({suspiciousSessions.length})
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Sessions matching responsible gambling risk patterns — review recommended
                    </CardDescription>
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
                                <TableCell className="text-xs capitalize">{s.game_type}</TableCell>
                                <TableCell>
                                  <span className={`text-sm font-medium ${isExtended ? 'text-red-600' : ''}`}>
                                    {formatDuration(s.duration || 0)}
                                  </span>
                                </TableCell>
                                <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                                  {new Date(s.start_time).toLocaleString()}
                                </TableCell>
                                <TableCell className="hidden lg:table-cell text-sm font-medium">
                                  R {Number(s.total_wagered || 0).toLocaleString()}
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

              {/* Monitored Patterns Reference */}
              <Card className="border-dashed">
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
            </>
          )}
        </TabsContent>
      </Tabs>
    </TooltipProvider>
  );
}
