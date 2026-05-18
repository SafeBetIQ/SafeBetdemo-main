'use client';
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from 'react';
import { CasinoDataProvider, useCasinoData } from '@/contexts/CasinoDataContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ModuleGuard } from '@/components/ModuleGuard';
import { PageHeader } from '@/components/saas/PageHeader';
import { KPICard } from '@/components/saas/KPICard';
import { ChartCard } from '@/components/saas/ChartCard';
import { DateRangePicker, type DateRange } from '@/components/saas/DateRangePicker';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { BehaviorTrendGraph } from '@/components/BehaviorTrendGraph';
import { PersonaShiftChart } from '@/components/PersonaShiftChart';
import { ImpulseVsIntentionTable } from '@/components/ImpulseVsIntentionTable';
import { RiskSignalBreakdown } from '@/components/RiskSignalBreakdown';
import { PlayerRiskProfileSheet } from '@/components/PlayerRiskProfileSheet';
import { PlayerHistorySheet } from '@/components/PlayerHistorySheet';
import { InterventionModal } from '@/components/InterventionModal';
import { CrossOperatorIntelligence } from '@/components/CrossOperatorIntelligence';
import { SelfExclusionNetwork } from '@/components/SelfExclusionNetwork';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Brain, Activity, TriangleAlert as AlertTriangle, Users, Download, Eye, Zap, TrendingUp, TrendingDown, Clock, DollarSign, Target, ShieldAlert, Search, RefreshCw, Globe, ChartBar as BarChart3, Filter, CircleCheck as CheckCircle, Circle as XCircle, Network, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
} from 'recharts';

const getRiskConfig = (score: number) => {
  if (score >= 80) return { label: 'Critical', variant: 'destructive' as const, color: 'text-red-600', barColor: '#ef4444', bg: 'bg-red-50' };
  if (score >= 60) return { label: 'High', variant: 'default' as const, color: 'text-orange-600', barColor: '#f97316', bg: 'bg-orange-50' };
  if (score >= 40) return { label: 'Moderate', variant: 'secondary' as const, color: 'text-amber-600', barColor: '#f59e0b', bg: 'bg-amber-50' };
  return { label: 'Low', variant: 'outline' as const, color: 'text-emerald-600', barColor: '#10b981', bg: 'bg-emerald-50' };
};

const RISK_LEVELS = [
  { key: 'all', label: 'All Risk Levels' },
  { key: 'critical', label: 'Critical (80+)' },
  { key: 'high', label: 'High (60–79)' },
  { key: 'moderate', label: 'Moderate (40–59)' },
  { key: 'low', label: 'Low (<40)' },
];

// ── Inner page — has access to the shared CasinoDataContext ──────────────────

function BRIPageInner() {
  const { data, refreshData } = useCasinoData();
  const { user } = useAuth();
  const casinoId = (user as any)?.casino_id;

  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [activeTab, setActiveTab] = useState('live-monitor');
  const [signalTrends, setSignalTrends] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [playerSheetOpen, setPlayerSheetOpen] = useState(false);
  const [historySheetOpen, setHistorySheetOpen] = useState(false);
  const [interventionModalOpen, setInterventionModalOpen] = useState(false);
  const [playerSignalHistory, setPlayerSignalHistory] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');

  // Unified player dataset — sourced from CasinoDataContext (live_events + behavioral_risk_profiles)
  const players = data.activePlayers;
  // Intervention history — sourced from CasinoDataContext (intervention_history)
  const interventions = data.liveAlerts;
  const loading = false; // data loads asynchronously; activePlayers is always defined (may be empty)

  const loadSignalTrends = useCallback(async () => {
    if (!casinoId) return;
    try {
      const daysBack = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      const since = new Date();
      since.setDate(since.getDate() - daysBack);

      // Use behavioral_risk_profiles as the signal history source (bri_signal_history is unused)
      const { data } = await supabase
        .from('behavioral_risk_profiles')
        .select('analyzed_at,risk_score,session_duration_score,deposit_frequency_score,loss_escalation_score,bet_intensity_score,cross_operator_score')
        .eq('casino_id', casinoId)
        .gte('analyzed_at', since.toISOString())
        .order('analyzed_at', { ascending: true })
        .limit(2000);

      if (data) {
        const grouped: Record<string, any[]> = {};
        data.forEach((row: any) => {
          const day = new Date(row.analyzed_at).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' });
          if (!grouped[day]) grouped[day] = [];
          grouped[day].push(row);
        });

        const trend = Object.entries(grouped).map(([date, rows]) => {
          const avg = (field: string) =>
            Math.round(rows.reduce((s: number, r: any) => s + (r[field] || 0), 0) / rows.length);
          return {
            date,
            risk: avg('risk_score'),
            session: avg('session_duration_score'),
            deposit: avg('deposit_frequency_score'),
            lossEscalation: avg('loss_escalation_score'),
            betIntensity: avg('bet_intensity_score'),
            crossOperator: avg('cross_operator_score'),
          };
        }).slice(-30);

        setSignalTrends(trend);
      }
    } catch (e) {
      console.error('Error loading signal trends:', e);
    }
  }, [casinoId, dateRange]);

  useEffect(() => {
    if (user) {
      loadSignalTrends();
    }
  }, [user, loadSignalTrends]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshData(), loadSignalTrends()]);
    setRefreshing(false);
  };

  const handleViewPlayer = async (player: any) => {
    setSelectedPlayer(player);
    setPlayerSheetOpen(true);

    try {
      // Use behavioral_risk_profiles as the per-player history source
      const { data } = await supabase
        .from('behavioral_risk_profiles')
        .select('analyzed_at,risk_score,impulse_level,session_duration_minutes')
        .eq('player_id', player.player_id)
        .eq('casino_id', casinoId)
        .order('analyzed_at', { ascending: false })
        .limit(14);
      const mapped = (data || []).reverse().map((r: any) => ({
        timestamp: new Date(r.analyzed_at).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' }),
        riskScore: r.risk_score || 0,
        impulseLevel: r.impulse_level || 0,
        fatigueIndex: Math.min(100, Math.round((r.session_duration_minutes || 0) / 1.2)),
      }));
      setPlayerSignalHistory(mapped);
    } catch (e) {
      setPlayerSignalHistory([]);
    }
  };

  const filteredPlayers = players.filter((p) => {
    const score = p.risk_score || 0;
    const matchSearch =
      !search ||
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      (p.player_id || '').toLowerCase().includes(search.toLowerCase());

    const matchRisk =
      riskFilter === 'all' ||
      (riskFilter === 'critical' && score >= 80) ||
      (riskFilter === 'high' && score >= 60 && score < 80) ||
      (riskFilter === 'moderate' && score >= 40 && score < 60) ||
      (riskFilter === 'low' && score < 40);

    return matchSearch && matchRisk;
  });

  const avgRisk = players.length
    ? Math.round(players.reduce((s, p) => s + (p.risk_score || 0), 0) / players.length)
    : 0;
  const criticalCount = players.filter((p) => (p.risk_score || 0) >= 80).length;
  const highRiskCount = players.filter((p) => (p.risk_score || 0) >= 60).length;
  const crossOpCount = players.filter((p) => (p.cross_operator_score || 0) > 0).length;

  const riskDistribution = [
    { label: 'Critical', min: 80, max: 100, color: '#ef4444' },
    { label: 'High', min: 60, max: 79, color: '#f97316' },
    { label: 'Moderate', min: 40, max: 59, color: '#f59e0b' },
    { label: 'Low', min: 0, max: 39, color: '#10b981' },
  ].map((tier) => ({
    ...tier,
    count: players.filter((p) => {
      const s = p.risk_score || 0;
      return s >= tier.min && s <= tier.max;
    }).length,
  }));

  const signalRadarData = [
    { signal: 'Session\nDuration', value: Math.round(players.reduce((s, p) => s + (p.session_duration_score || 0), 0) / Math.max(players.length, 1)) },
    { signal: 'Deposit\nFreq', value: Math.round(players.reduce((s, p) => s + (p.deposit_frequency_score || 0), 0) / Math.max(players.length, 1)) },
    { signal: 'Loss\nEscalation', value: Math.round(players.reduce((s, p) => s + (p.loss_escalation_score || 0), 0) / Math.max(players.length, 1)) },
    { signal: 'Bet\nIntensity', value: Math.round(players.reduce((s, p) => s + (p.bet_intensity_score || 0), 0) / Math.max(players.length, 1)) },
    { signal: 'Cross\nOperator', value: Math.round(players.reduce((s, p) => s + (p.cross_operator_score || 0), 0) / Math.max(players.length, 1)) },
  ];

  const interventionSuccessRate = interventions.length > 0
    ? Math.round((interventions.filter((i) => i.intervention_successful).length / interventions.length) * 100)
    : 0;

  const formatType = (t: string) => t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const getResponseBadge = (r: string) => {
    if (r === 'accepted') return { label: 'Accepted', variant: 'default' as const };
    if (r === 'declined') return { label: 'Declined', variant: 'destructive' as const };
    if (r === 'deferred') return { label: 'Deferred', variant: 'secondary' as const };
    return { label: 'Ignored', variant: 'outline' as const };
  };

  return (
    <ModuleGuard slug="behavioural-risk-intelligence" fallbackHref="/casino/dashboard">
    <DashboardLayout>
      <TooltipProvider>
        <div className="flex min-h-full flex-col">
          <PageHeader
            title="Behavioral Risk Intelligence Engine"
            subtitle="Multi-signal player risk analysis — session, deposit, loss escalation, bet intensity & cross-operator"
            actions={
              <>
                <DateRangePicker value={dateRange} onChange={setDateRange} />
                <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </>
            }
          />

          <div className="flex-1 p-6 min-w-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-5 max-w-3xl">
                <TabsTrigger value="live-monitor">
                  <Activity className="mr-1.5 h-3.5 w-3.5" />
                  Live Monitor
                </TabsTrigger>
                <TabsTrigger value="analytics">
                  <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
                  Analytics
                </TabsTrigger>
                <TabsTrigger value="cross-operator">
                  <Network className="mr-1.5 h-3.5 w-3.5" />
                  Cross-Operator
                </TabsTrigger>
                <TabsTrigger value="exclusion-network">
                  <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                  SE Network
                </TabsTrigger>
                <TabsTrigger value="interventions">
                  <ShieldAlert className="mr-1.5 h-3.5 w-3.5" />
                  Interventions
                </TabsTrigger>
              </TabsList>

              {/* ── LIVE MONITOR ── */}
              <TabsContent value="live-monitor" className="space-y-6">
                {/* KPI Row */}
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                  <KPICard
                    title="Active Players"
                    value={players.length}
                    change={{ value: 5.2, type: 'increase', label: 'vs last hour' }}
                    icon={Users}
                    tooltip="Players currently in an active gaming session."
                  />
                  <KPICard
                    title="Avg Risk Score"
                    value={avgRisk}
                    change={{ value: -3.1, type: 'decrease', label: 'vs last hour' }}
                    icon={Brain}
                    tooltip="Weighted composite score across all 5 behavioral signals."
                  />
                  <KPICard
                    title="Critical / High Risk"
                    value={`${criticalCount} / ${highRiskCount}`}
                    change={{ value: criticalCount, type: criticalCount > 0 ? 'increase' : 'neutral', label: 'critical now' }}
                    icon={AlertTriangle}
                    tooltip="Players scoring Critical (≥80) and High (≥60) right now."
                  />
                  <KPICard
                    title="Cross-Operator Flags"
                    value={crossOpCount}
                    change={{ value: crossOpCount, type: crossOpCount > 0 ? 'increase' : 'neutral', label: 'active flags' }}
                    icon={Globe}
                    tooltip="Players flagged for multi-platform gambling activity."
                  />
                </div>

                {/* Charts Row */}
                <div className="grid gap-5 lg:grid-cols-3">
                  {/* Risk Distribution Bar */}
                  <ChartCard
                    title="Risk Distribution"
                    description="Active players by risk tier"
                    tooltip="Breakdown of active players across all four risk levels."
                  >
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={riskDistribution} margin={{ top: 4, right: 4, bottom: 4, left: -10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" fontSize={11} />
                        <YAxis fontSize={11} />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                          formatter={(v: any) => [v, 'Players']}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {riskDistribution.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  {/* Signal Radar */}
                  <ChartCard
                    title="Signal Radar"
                    description="Average signal intensity across all active players"
                    tooltip="Spider chart showing mean score for each of the 5 risk signals."
                  >
                    <ResponsiveContainer width="100%" height={220}>
                      <RadarChart data={signalRadarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                        <PolarGrid stroke="hsl(var(--border))" />
                        <PolarAngleAxis dataKey="signal" fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                        <Radar
                          name="Avg Signal"
                          dataKey="value"
                          stroke="#3b82f6"
                          fill="#3b82f6"
                          fillOpacity={0.25}
                          strokeWidth={2}
                        />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  {/* Real-time trend */}
                  <ChartCard
                    title="Real-Time Risk Trend"
                    description="Aggregate signal scores over time"
                    tooltip="Live tracking of composite risk and individual signal scores."
                    headerAction={
                      <Badge variant="outline" className="gap-1 text-xs">
                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                        Live
                      </Badge>
                    }
                  >
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart
                        data={signalTrends.slice(-14)}
                        margin={{ top: 4, right: 4, bottom: 4, left: -10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" fontSize={10} />
                        <YAxis domain={[0, 100]} fontSize={10} />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }}
                        />
                        <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                        <Line type="monotone" dataKey="risk" stroke="#ef4444" strokeWidth={2.5} name="Risk Score" dot={false} />
                        <Line type="monotone" dataKey="lossEscalation" stroke="#f97316" strokeWidth={1.5} name="Loss Escalation" dot={false} strokeDasharray="4 2" />
                        <Line type="monotone" dataKey="betIntensity" stroke="#f59e0b" strokeWidth={1.5} name="Bet Intensity" dot={false} strokeDasharray="4 2" />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="relative flex-1 min-w-[220px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or player ID..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Select value={riskFilter} onValueChange={setRiskFilter}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RISK_LEVELS.map((l) => (
                          <SelectItem key={l.key} value={l.key}>{l.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-sm text-muted-foreground ml-auto">
                    {filteredPlayers.length} of {players.length} players
                  </div>
                </div>

                {/* Players Table */}
                <div className="rounded-lg border bg-card overflow-x-auto">
                  <div className="px-4 py-3 border-b flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-sm">Active Players — Risk Monitor</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Click a row to view full signal breakdown and risk rationale
                      </p>
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="text-xs">Player</TableHead>
                        <TableHead className="text-xs">Risk Score</TableHead>
                        <TableHead className="text-xs">Loss Escalation</TableHead>
                        <TableHead className="text-xs">Session Duration</TableHead>
                        <TableHead className="text-xs">Deposit Freq</TableHead>
                        <TableHead className="text-xs">Bet Intensity</TableHead>
                        <TableHead className="text-xs">Cross-Op</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                            <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                            Loading active players...
                          </TableCell>
                        </TableRow>
                      ) : filteredPlayers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                            No players match the current filters
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredPlayers.slice(0, 30).map((player, idx) => {
                          const score = player.risk_score || 0;
                          const riskCfg = getRiskConfig(score);
                          const lossScore = player.loss_escalation_score ?? Math.min(score + 7, 100);
                          const sessScore = player.session_duration_score ?? Math.max(score - 5, 0);
                          const depScore = player.deposit_frequency_score ?? Math.max(score - 8, 0);
                          const betScore = player.bet_intensity_score ?? Math.max(score - 3, 0);
                          const crossScore = player.cross_operator_score ?? (score >= 70 ? 40 : 10);

                          const MiniBar = ({ value }: { value: number }) => {
                            const c = getRiskConfig(value);
                            return (
                              <div className="flex items-center gap-1.5">
                                <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: c.barColor }} />
                                </div>
                                <span className={`text-xs font-medium tabular-nums ${c.color}`}>{value}</span>
                              </div>
                            );
                          };

                          return (
                            <TableRow
                              key={player.player_id || idx}
                              className="hover:bg-muted/40 cursor-pointer"
                              onClick={() => handleViewPlayer(player)}
                            >
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase shrink-0">
                                    {player.first_name?.[0]}{player.last_name?.[0]}
                                  </div>
                                  <div>
                                    <div className="text-sm font-medium">{player.first_name} {player.last_name}</div>
                                    <div className="font-mono text-xs text-muted-foreground">{player.player_id}</div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span className={`text-2xl font-bold tabular-nums ${riskCfg.color}`}>{score}</span>
                                  <Badge variant={riskCfg.variant} className="text-xs">{riskCfg.label}</Badge>
                                </div>
                              </TableCell>
                              <TableCell><MiniBar value={lossScore} /></TableCell>
                              <TableCell><MiniBar value={sessScore} /></TableCell>
                              <TableCell><MiniBar value={depScore} /></TableCell>
                              <TableCell><MiniBar value={betScore} /></TableCell>
                              <TableCell>
                                <MiniBar value={crossScore} />
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="gap-1 text-xs">
                                  <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                                  Active
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleViewPlayer(player); }}>
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* ── SIGNAL ANALYTICS ── */}
              <TabsContent value="analytics" className="space-y-6">
                {/* Signal Trend Chart */}
                <ChartCard
                  title="All-Signal Trend"
                  description={`${dateRange === '7d' ? '7-day' : dateRange === '30d' ? '30-day' : '90-day'} signal history`}
                  tooltip="Historical view of all 5 behavioral signals averaged across active players."
                >
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={signalTrends} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" fontSize={11} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis domain={[0, 100]} fontSize={11} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="risk" stroke="#ef4444" strokeWidth={2.5} name="Composite Risk" dot={false} />
                      <Line type="monotone" dataKey="lossEscalation" stroke="#f97316" strokeWidth={2} name="Loss Escalation" dot={false} />
                      <Line type="monotone" dataKey="session" stroke="#3b82f6" strokeWidth={1.5} name="Session Duration" dot={false} strokeDasharray="5 3" />
                      <Line type="monotone" dataKey="deposit" stroke="#8b5cf6" strokeWidth={1.5} name="Deposit Freq" dot={false} strokeDasharray="5 3" />
                      <Line type="monotone" dataKey="betIntensity" stroke="#f59e0b" strokeWidth={1.5} name="Bet Intensity" dot={false} strokeDasharray="5 3" />
                      <Line type="monotone" dataKey="crossOperator" stroke="#06b6d4" strokeWidth={1.5} name="Cross-Operator" dot={false} strokeDasharray="5 3" />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                <div className="grid gap-5 lg:grid-cols-2">
                  <ChartCard
                    title="Behavior Trend Analysis"
                    description="7-day historical view"
                    tooltip="Seven-day historical analysis of behavioral risk patterns."
                  >
                    <BehaviorTrendGraph data={signalTrends.slice(-7).map(t => ({
                      timestamp: t.date,
                      riskScore: t.risk,
                      impulseLevel: t.betIntensity,
                      fatigueIndex: t.session,
                    }))} />
                  </ChartCard>

                  <ChartCard
                    title="Persona Shift Detection"
                    description="Behavioral change patterns"
                    tooltip="AI-powered detection of sudden behavioral deviations from established player patterns."
                  >
                    <PersonaShiftChart
                      data={{
                        emotionalState: avgRisk >= 70 ? 'Anxious' : avgRisk >= 50 ? 'Agitated' : 'Calm',
                        personalityShiftScore: avgRisk * 0.8,
                        bettingVelocity: signalTrends[signalTrends.length - 1]?.betIntensity / 10 || 6.4,
                        sessionDuration: signalTrends[signalTrends.length - 1]?.session * 1.5 || 120,
                        reactionTime: 1200 + avgRisk * 5,
                      }}
                      playerName="Population Average"
                    />
                  </ChartCard>

                  {/* Signal Weight Explainer */}
                  <div className="rounded-lg border bg-card p-5 space-y-4">
                    <div>
                      <h3 className="font-semibold text-sm">Risk Scoring Model</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        How the composite risk score is calculated from 5 behavioral signals
                      </p>
                    </div>
                    <Separator />
                    {[
                      { label: 'Loss Escalation', weight: 30, description: 'Bet size increase after losses', color: '#f97316' },
                      { label: 'Session Duration', weight: 20, description: 'Extended time in active play', color: '#3b82f6' },
                      { label: 'Deposit Frequency', weight: 20, description: 'Multiple deposits in rolling windows', color: '#8b5cf6' },
                      { label: 'Bet Intensity', weight: 20, description: 'Bets vs established baseline', color: '#f59e0b' },
                      { label: 'Cross-Operator', weight: 10, description: 'Multi-platform activity flags', color: '#06b6d4' },
                    ].map((signal) => (
                      <div key={signal.label}>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <div>
                            <span className="font-medium">{signal.label}</span>
                            <span className="text-muted-foreground ml-2">{signal.description}</span>
                          </div>
                          <span className="font-bold tabular-nums">{signal.weight}%</span>
                        </div>
                        <Progress value={signal.weight * 3} className="h-1.5" style={{ '--progress-color': signal.color } as any} />
                      </div>
                    ))}
                    <div className="pt-2 text-xs text-muted-foreground border-t">
                      Composite Score = (Loss Escalation × 0.30) + (Session × 0.20) + (Deposit × 0.20) + (Bet × 0.20) + (Cross-Op × 0.10)
                    </div>
                  </div>

                  {/* Impulse vs Intention */}
                  <div className="rounded-lg border bg-card overflow-hidden">
                    <div className="px-4 py-3 border-b">
                      <h3 className="font-semibold text-sm">Impulse vs Intention Analysis</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Decision-making quality breakdown</p>
                    </div>
                    <div className="p-4">
                      <ImpulseVsIntentionTable
                        playerId="aggregate"
                        data={[
                          { timestamp: '08:00', action: 'Bet increase post-loss', impulseLevel: 82, intentAlignment: 42, outcome: 'loss', betAmount: 450 },
                          { timestamp: '09:15', action: 'Rapid re-deposit', impulseLevel: 88, intentAlignment: 35, outcome: 'loss', betAmount: 800 },
                          { timestamp: '10:30', action: 'Session extension', impulseLevel: 71, intentAlignment: 55, outcome: 'win', betAmount: 300 },
                          { timestamp: '11:45', action: 'Max bet stake', impulseLevel: 94, intentAlignment: 28, outcome: 'loss', betAmount: 1200 },
                        ]}
                        overallRatio={1.9}
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ── INTERVENTIONS ── */}
              {/* ── CROSS-OPERATOR INTELLIGENCE ── */}
              <TabsContent value="cross-operator" className="space-y-6">
                <CrossOperatorIntelligence />
              </TabsContent>

              {/* ── SELF-EXCLUSION NETWORK ── */}
              <TabsContent value="exclusion-network" className="space-y-6">
                <SelfExclusionNetwork />
              </TabsContent>

              <TabsContent value="interventions" className="space-y-6">
                <div className="grid gap-5 md:grid-cols-3">
                  <KPICard
                    title="Total Interventions"
                    value={interventions.length}
                    change={{ value: 12.3, type: 'increase', label: 'this period' }}
                    icon={Activity}
                    tooltip="Total AI-triggered interventions deployed this period."
                  />
                  <KPICard
                    title="Success Rate"
                    value={`${interventionSuccessRate}%`}
                    change={{ value: 3.2, type: 'increase', label: 'vs last period' }}
                    icon={TrendingUp}
                    tooltip="Percentage of interventions that successfully reduced player risk scores."
                  />
                  <KPICard
                    title="Avg Risk at Trigger"
                    value={
                      interventions.length > 0
                        ? Math.round(interventions.reduce((s, i) => s + (i.risk_score_at_trigger || 0), 0) / interventions.length)
                        : 0
                    }
                    change={{ value: -15.5, type: 'decrease', label: 'vs last period' }}
                    icon={Zap}
                    tooltip="Average risk score when interventions were triggered. Lower = earlier intervention."
                  />
                </div>

                <div className="rounded-lg border bg-card overflow-hidden">
                  <div className="px-4 py-3 border-b flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-sm">Intervention History</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Complete log of AI-triggered player interventions
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {interventions.length} records
                    </Badge>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="text-xs">Date / Time</TableHead>
                        <TableHead className="text-xs">Player</TableHead>
                        <TableHead className="text-xs">Intervention Type</TableHead>
                        <TableHead className="text-xs">Channel</TableHead>
                        <TableHead className="text-xs">Risk Score</TableHead>
                        <TableHead className="text-xs">Response</TableHead>
                        <TableHead className="text-xs">Outcome</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {refreshing ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                            <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                            Loading interventions...
                          </TableCell>
                        </TableRow>
                      ) : interventions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                            No interventions recorded for this period
                          </TableCell>
                        </TableRow>
                      ) : (
                        interventions.map((iv, idx) => {
                          const rb = getResponseBadge(iv.player_response ?? '');
                          const ivScore = iv.risk_score_at_trigger || 0;
                          const riskCfg = getRiskConfig(ivScore);
                          return (
                            <TableRow key={iv.id || idx} className="hover:bg-muted/40">
                              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                {new Date(iv.triggered_at).toLocaleString('en-ZA', {
                                  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                                })}
                              </TableCell>
                              <TableCell>
                                <div className="font-mono text-xs text-muted-foreground">
                                  …{(iv.player_id || '').slice(-8)}
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                  {iv.trigger_reason || '—'}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">{formatType(iv.intervention_type || '')}</TableCell>
                              <TableCell className="capitalize text-sm text-muted-foreground">
                                {(iv.delivery_method || '').replace(/_/g, ' ')}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5">
                                  <span className={`font-bold text-sm ${riskCfg.color}`}>{ivScore}</span>
                                  <Badge variant={riskCfg.variant} className="text-xs">{riskCfg.label}</Badge>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={rb.variant} className="text-xs">{rb.label}</Badge>
                              </TableCell>
                              <TableCell>
                                {iv.intervention_successful ? (
                                  <div className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
                                    <CheckCircle className="h-3.5 w-3.5" />
                                    Success
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 text-muted-foreground text-xs">
                                    <XCircle className="h-3.5 w-3.5" />
                                    No change
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Player Risk Profile Sheet */}
        <PlayerRiskProfileSheet
          open={playerSheetOpen}
          onOpenChange={setPlayerSheetOpen}
          player={selectedPlayer}
          signalHistory={playerSignalHistory}
          onIntervene={() => {
            setPlayerSheetOpen(false);
            setInterventionModalOpen(true);
          }}
          onViewHistory={() => {
            setPlayerSheetOpen(false);
            setHistorySheetOpen(true);
          }}
        />

        {/* Intervention Modal */}
        {selectedPlayer && (
          <>
            <PlayerHistorySheet
              open={historySheetOpen}
              onOpenChange={setHistorySheetOpen}
              player={selectedPlayer}
            />
            <InterventionModal
              open={interventionModalOpen}
              onOpenChange={setInterventionModalOpen}
              playerName={`${selectedPlayer.first_name || ''} ${selectedPlayer.last_name || ''}`.trim()}
              riskScore={selectedPlayer.risk_score || 0}
              triggerReason={`Risk score of ${selectedPlayer.risk_score || 0} — ${
                getRiskConfig(selectedPlayer.risk_score || 0).label
              } level detected during active session`}
              onSubmit={() => {
                setInterventionModalOpen(false);
                refreshData();
              }}
            />
          </>
        )}
      </TooltipProvider>
    </DashboardLayout>
    </ModuleGuard>
  );
}

export default function BehavioralRiskIntelligencePage() {
  return (
    <CasinoDataProvider>
      <BRIPageInner />
    </CasinoDataProvider>
  );
}
