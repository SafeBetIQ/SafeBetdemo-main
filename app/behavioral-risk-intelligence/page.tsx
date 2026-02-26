'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { PageHeader } from '@/components/saas/PageHeader';
import { KPICard } from '@/components/saas/KPICard';
import { ChartCard } from '@/components/saas/ChartCard';
import { TableCard } from '@/components/saas/TableCard';
import { DateRangePicker, type DateRange } from '@/components/saas/DateRangePicker';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { BehaviorTrendGraph } from '@/components/BehaviorTrendGraph';
import { PersonaShiftChart } from '@/components/PersonaShiftChart';
import { CognitiveFatigueIndex } from '@/components/CognitiveFatigueIndex';
import { ImpulseVsIntentionTable } from '@/components/ImpulseVsIntentionTable';
import {
  Brain,
  Activity,
  AlertTriangle,
  Users,
  Download,
  Eye,
  Zap,
  TrendingUp,
  Clock,
  DollarSign,
  Target,
  ShieldAlert,
  TrendingDown,
} from 'lucide-react';
import { InterventionModal } from '@/components/InterventionModal';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TooltipProvider } from '@/components/ui/tooltip';

export default function BehavioralRiskIntelligencePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [activeTab, setActiveTab] = useState('live-monitor');
  const [players, setPlayers] = useState<any[]>([]);
  const [interventions, setInterventions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [interventionsLoading, setInterventionsLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [playerSheetOpen, setPlayerSheetOpen] = useState(false);
  const [interventionModalOpen, setInterventionModalOpen] = useState(false);

  useEffect(() => {
    if (user) {
      loadPlayers();
      loadInterventions();
    }
  }, [user, dateRange]);

  const loadPlayers = async () => {
    try {
      setLoading(true);
      const userRole = (user as any)?.role || (user as any)?.user_role;
      const casinoId = user?.casino_id;

      let query = supabase
        .from('gaming_sessions')
        .select(`
          *,
          players!inner(*)
        `)
        .eq('is_active', true)
        .eq('players.is_active', true)
        .order('start_time', { ascending: false })
        .limit(50);

      if (userRole === 'casino_admin' && casinoId) {
        query = query.eq('casino_id', casinoId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading players:', error);
      }

      if (data) {
        const playersWithSessions = data.map(session => ({
          ...(session.players as any),
          currentSession: session
        }));
        setPlayers(playersWithSessions);
      }
    } catch (error) {
      console.error('Error loading players:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadInterventions = async () => {
    try {
      setInterventionsLoading(true);
      const userRole = (user as any)?.role || (user as any)?.user_role;
      const casinoId = user?.casino_id;

      const daysBack = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 30;
      const since = new Date();
      since.setDate(since.getDate() - daysBack);

      let query = supabase
        .from('intervention_history')
        .select('*, players(player_id, first_name, last_name)')
        .gte('triggered_at', since.toISOString())
        .order('triggered_at', { ascending: false })
        .limit(50);

      if (userRole === 'casino_admin' && casinoId) {
        query = query.eq('casino_id', casinoId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading interventions:', error);
      }

      if (data) setInterventions(data);
    } catch (error) {
      console.error('Error loading interventions:', error);
    } finally {
      setInterventionsLoading(false);
    }
  };

  const getResponseBadge = (response: string) => {
    if (response === 'accepted') return { label: 'Accepted', variant: 'default' as const };
    if (response === 'declined') return { label: 'Declined', variant: 'destructive' as const };
    if (response === 'deferred') return { label: 'Deferred', variant: 'secondary' as const };
    return { label: 'Ignored', variant: 'outline' as const };
  };

  const formatInterventionType = (type: string) =>
    type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const mockTrendData = [
    { timestamp: '10:00', riskScore: 25, impulseLevel: 20, fatigueIndex: 15 },
    { timestamp: '10:30', riskScore: 32, impulseLevel: 28, fatigueIndex: 22 },
    { timestamp: '11:00', riskScore: 45, impulseLevel: 42, fatigueIndex: 35 },
    { timestamp: '11:30', riskScore: 58, impulseLevel: 55, fatigueIndex: 48 },
    { timestamp: '12:00', riskScore: 72, impulseLevel: 68, fatigueIndex: 65 },
    { timestamp: '12:30', riskScore: 85, impulseLevel: 82, fatigueIndex: 78 },
  ];

  const getRiskBadge = (score: number) => {
    if (score >= 80) return { label: 'Critical', variant: 'destructive' as const };
    if (score >= 60) return { label: 'High', variant: 'default' as const };
    if (score >= 40) return { label: 'Medium', variant: 'secondary' as const };
    return { label: 'Low', variant: 'outline' as const };
  };

  const handleViewPlayer = (player: any) => {
    setSelectedPlayer(player);
    setPlayerSheetOpen(true);
  };

  return (
    <DashboardLayout>
      <TooltipProvider>
        <div className="flex h-full flex-col">
          <PageHeader
            title="Behavioral Risk Intelligence"
            subtitle="Real-time monitoring of player behavior and risk indicators"
            actions={
              <>
                <DateRangePicker value={dateRange} onChange={setDateRange} />
                <Button variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
                <Button>
                  <Eye className="mr-2 h-4 w-4" />
                  Live Monitor
                </Button>
              </>
            }
          />

          <div className="flex-1 overflow-auto p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList>
              <TabsTrigger value="live-monitor">Live Monitor</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="interventions">Interventions</TabsTrigger>
            </TabsList>

            <TabsContent value="live-monitor" className="space-y-6">
              {/* KPI Cards */}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <KPICard
                  title="Active Players"
                  value={players.length}
                  change={{ value: 5.2, type: 'increase', label: 'vs last hour' }}
                  icon={Users}
                  tooltip="Number of players currently active on the platform. Tracked in real-time to monitor overall engagement and identify periods of high activity."
                />
                <KPICard
                  title="Average Risk Score"
                  value={Math.round(players.reduce((sum, p) => sum + (p.risk_score || 0), 0) / Math.max(players.length, 1))}
                  change={{ value: -3.1, type: 'decrease', label: 'vs last hour' }}
                  icon={Brain}
                  tooltip="Mean risk score across all active players. Calculated using AI behavioral analysis including betting patterns, session duration, impulse indicators, and cognitive fatigue markers."
                />
                <KPICard
                  title="High-Risk Sessions"
                  value={players.filter(p => (p.risk_score || 0) >= 60).length}
                  change={{ value: 8.5, type: 'increase', label: 'vs last hour' }}
                  icon={AlertTriangle}
                  tooltip="Number of active sessions flagged as high-risk (score ≥60). These players exhibit concerning behavioral patterns and may require intervention."
                />
                <KPICard
                  title="Active Interventions"
                  value={players.filter(p => (p.risk_score || 0) >= 80).length}
                  change={{ value: 0, type: 'neutral', label: 'in progress' }}
                  icon={Activity}
                  tooltip="Number of AI-triggered interventions currently being deployed to players showing high-risk behavior. Includes reality checks, cool-off suggestions, and account limit prompts."
                />
              </div>

              {/* Charts Row */}
              <div className="grid gap-6 lg:grid-cols-2">
                <ChartCard
                  title="Real-Time Risk Trends"
                  description="Last 3 hours of activity"
                  tooltip="Live tracking of key behavioral risk indicators over the past 3 hours. Monitors aggregate risk scores, impulse levels, and cognitive fatigue across all active sessions to identify emerging patterns."
                  headerAction={
                    <Badge variant="outline" className="gap-1">
                      <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                      Live
                    </Badge>
                  }
                >
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={mockTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="timestamp"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="riskScore"
                        stroke="hsl(var(--destructive))"
                        strokeWidth={2}
                        name="Risk Score"
                      />
                      <Line
                        type="monotone"
                        dataKey="impulseLevel"
                        stroke="hsl(var(--warning))"
                        strokeWidth={2}
                        name="Impulse Level"
                      />
                      <Line
                        type="monotone"
                        dataKey="fatigueIndex"
                        stroke="hsl(var(--chart-2))"
                        strokeWidth={2}
                        name="Fatigue Index"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                  title="Cognitive Fatigue Distribution"
                  description="Current session analysis"
                  tooltip="Real-time cognitive fatigue analysis for active sessions. Measures decision stability, reaction time patterns, and session duration to identify players experiencing mental exhaustion that may impair judgment."
                >
                  <CognitiveFatigueIndex
                    playerId="DEMO-001"
                    fatigueScore={72}
                    decisionStability={65}
                    reactionTimeMs={1450}
                    sessionDuration={145}
                  />
                </ChartCard>
              </div>

              {/* Live Players Table */}
              <TableCard
                title="Active High-Risk Players"
                description="Real-time monitoring of players requiring attention"
                tooltip="Live feed of active players exhibiting high-risk behavioral patterns. Displays real-time risk scores, session metrics, betting velocity, and impulse indicators. Click any player to view detailed behavioral analysis or trigger an intervention."
                searchable
                searchPlaceholder="Search by player ID..."
                headerAction={
                  <Button size="sm">
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Create Intervention
                  </Button>
                }
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead>Risk Score</TableHead>
                      <TableHead>Session Duration</TableHead>
                      <TableHead>Bet Velocity</TableHead>
                      <TableHead>Impulse Level</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Loading active players...
                        </TableCell>
                      </TableRow>
                    ) : players.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No active players found
                        </TableCell>
                      </TableRow>
                    ) : (
                      players.slice(0, 20).map((player, idx) => {
                        const risk = getRiskBadge(player.risk_score || 0);
                        const session = player.currentSession;
                        const betVelocity = session
                          ? ((session.total_bets || 0) / Math.max((session.duration || 1), 1) * 60).toFixed(1)
                          : '0.0';
                        const impulseLevel = player.risk_score || 0;

                        return (
                          <TableRow key={player.id || idx} className="hover:bg-muted/50 cursor-pointer">
                            <TableCell>
                              <div className="font-medium text-body">{player.first_name} {player.last_name}</div>
                              <div className="font-mono text-xs text-muted-foreground">{player.player_id}</div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="text-2xl font-bold">
                                  {player.risk_score || 0}
                                </div>
                                <Badge variant={risk.variant}>{risk.label}</Badge>
                              </div>
                            </TableCell>
                            <TableCell className="text-body">
                              {session?.duration || 0} min
                            </TableCell>
                            <TableCell className="text-body">
                              {betVelocity} bets/min
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className="h-full bg-warning rounded-full"
                                    style={{
                                      width: `${Math.min(impulseLevel, 100)}%`,
                                    }}
                                  />
                                </div>
                                <span className="text-body text-muted-foreground">
                                  {impulseLevel}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="gap-1">
                                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                Active
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" onClick={() => handleViewPlayer(player)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableCard>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <ChartCard
                  title="Behavior Trend Analysis"
                  description="7-day historical view"
                  tooltip="Seven-day historical analysis of behavioral risk patterns. Track changes in risk scores, impulse levels, and fatigue markers to identify developing trends and predict future high-risk periods."
                >
                  <BehaviorTrendGraph data={mockTrendData} />
                </ChartCard>

                <ChartCard
                  title="Persona Shift Detection"
                  description="Behavioral change patterns"
                  tooltip="AI-powered detection of sudden behavioral changes that deviate from established player patterns. Identifies personality shifts, emotional state changes, and altered betting styles that may indicate problem gambling or account compromise."
                >
                  <PersonaShiftChart
                    data={{
                      emotionalState: 'Anxious',
                      personalityShiftScore: 67.5,
                      bettingVelocity: 8.4,
                      sessionDuration: 142,
                      reactionTime: 1450,
                    }}
                    playerName="DEMO-001"
                  />
                </ChartCard>
              </div>

              <TableCard
                title="Impulse vs Intention Analysis"
                description="Decision-making patterns"
                tooltip="Analysis of player decision-making quality by comparing impulsive actions versus intentional, deliberate choices. High impulse-to-intention ratios indicate poor self-control and elevated risk of harmful gambling behavior."
              >
                <ImpulseVsIntentionTable
                  playerId="DEMO-001"
                  data={[
                    {
                      timestamp: '12:00',
                      action: 'Increased bet',
                      impulseLevel: 85,
                      intentAlignment: 45,
                      outcome: 'loss',
                      betAmount: 500,
                    },
                    {
                      timestamp: '12:05',
                      action: 'Quick rebuy',
                      impulseLevel: 90,
                      intentAlignment: 35,
                      outcome: 'loss',
                      betAmount: 750,
                    },
                  ]}
                  overallRatio={1.8}
                />
              </TableCard>
            </TabsContent>

            <TabsContent value="interventions" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-3">
                <KPICard
                  title="Total Interventions"
                  value={interventions.length}
                  change={{ value: 12.3, type: 'increase', label: 'this period' }}
                  icon={Activity}
                  tooltip="Total number of AI-triggered interventions deployed this period across all players. Includes reality checks, cool-off periods, deposit limit suggestions, and session breaks."
                />
                <KPICard
                  title="Success Rate"
                  value={interventions.length > 0
                    ? `${Math.round((interventions.filter(i => i.intervention_successful).length / interventions.length) * 100)}%`
                    : '0%'}
                  change={{ value: 3.2, type: 'increase', label: 'vs last period' }}
                  icon={TrendingUp}
                  tooltip="Percentage of interventions that successfully reduced player risk scores or modified harmful behavior patterns. Measured by comparing pre- and post-intervention risk levels."
                />
                <KPICard
                  title="Avg Risk at Trigger"
                  value={interventions.length > 0
                    ? Math.round(interventions.reduce((sum, i) => sum + (i.risk_score_at_trigger || 0), 0) / interventions.length)
                    : 0}
                  change={{ value: -15.5, type: 'decrease', label: 'vs last period' }}
                  icon={Zap}
                  tooltip="Average player risk score at the time each intervention was triggered. Lower values indicate earlier, more proactive intervention."
                />
              </div>

              <TableCard
                title="Recent Interventions"
                description="History of player interventions"
                tooltip="Comprehensive log of all player interventions including trigger events, communication channels used, player responses, and outcomes. Track intervention effectiveness and refine strategies."
                searchable
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date/Time</TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Risk Score</TableHead>
                      <TableHead>Response</TableHead>
                      <TableHead>Outcome</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {interventionsLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Loading interventions...
                        </TableCell>
                      </TableRow>
                    ) : interventions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No interventions recorded for this period
                        </TableCell>
                      </TableRow>
                    ) : (
                      interventions.map((intervention, idx) => {
                        const responseBadge = getResponseBadge(intervention.player_response);
                        return (
                          <TableRow key={intervention.id || idx} className="hover:bg-muted/50">
                            <TableCell className="text-body text-muted-foreground whitespace-nowrap">
                              {new Date(intervention.triggered_at).toLocaleString('en-ZA', {
                                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                              })}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-body">
                                {intervention.players?.first_name && intervention.players?.last_name
                                  ? `${intervention.players.first_name} ${intervention.players.last_name}`
                                  : '—'}
                              </div>
                              {intervention.players?.player_id && (
                                <div className="font-mono text-xs text-muted-foreground">{intervention.players.player_id}</div>
                              )}
                            </TableCell>
                            <TableCell className="text-body">
                              {formatInterventionType(intervention.intervention_type)}
                            </TableCell>
                            <TableCell className="capitalize text-body">
                              {(intervention.delivery_method || '').replace(/_/g, ' ')}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <span className="font-semibold">{intervention.risk_score_at_trigger}</span>
                                <span className="text-xs text-muted-foreground">/100</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={responseBadge.variant}>{responseBadge.label}</Badge>
                            </TableCell>
                            <TableCell>
                              {intervention.intervention_successful ? (
                                <Badge variant="default" className="bg-green-600 hover:bg-green-700">Success</Badge>
                              ) : (
                                <Badge variant="outline">Unsuccessful</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableCard>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      </TooltipProvider>

      {/* Intervention Modal */}
      {selectedPlayer && (
        <InterventionModal
          open={interventionModalOpen}
          onOpenChange={setInterventionModalOpen}
          playerName={`${selectedPlayer.first_name || ''} ${selectedPlayer.last_name || ''}`.trim()}
          riskScore={selectedPlayer.risk_score || 0}
          triggerReason={`Risk score of ${selectedPlayer.risk_score || 0} detected during active session`}
          onSubmit={(data) => {
            setInterventionModalOpen(false);
          }}
        />
      )}

      {/* Player Detail Sheet */}
      <Sheet open={playerSheetOpen} onOpenChange={setPlayerSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedPlayer && (() => {
            const risk = getRiskBadge(selectedPlayer.risk_score || 0);
            const session = selectedPlayer.currentSession;
            const score = selectedPlayer.risk_score || 0;
            const betVelocity = session
              ? ((session.total_bets || 0) / Math.max(session.duration || 1, 1) * 60).toFixed(1)
              : '0.0';

            const riskColor =
              score >= 80 ? 'text-red-600' :
              score >= 60 ? 'text-orange-500' :
              score >= 40 ? 'text-yellow-500' : 'text-green-600';

            const riskBg =
              score >= 80 ? 'bg-red-50 border-red-200' :
              score >= 60 ? 'bg-orange-50 border-orange-200' :
              score >= 40 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200';

            return (
              <>
                <SheetHeader className="pb-4">
                  <SheetTitle className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted font-semibold text-sm">
                      {selectedPlayer.first_name?.[0]}{selectedPlayer.last_name?.[0]}
                    </div>
                    <div>
                      <div>{selectedPlayer.first_name} {selectedPlayer.last_name}</div>
                      <div className="font-mono text-xs font-normal text-muted-foreground">{selectedPlayer.player_id}</div>
                    </div>
                  </SheetTitle>
                  <SheetDescription>
                    Live behavioral risk profile
                  </SheetDescription>
                </SheetHeader>

                {/* Risk Score Banner */}
                <div className={`rounded-lg border p-4 mb-4 ${riskBg}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Overall Risk Score</div>
                      <div className={`text-4xl font-bold ${riskColor}`}>{score}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">out of 100</div>
                    </div>
                    <div className="text-right">
                      <Badge variant={risk.variant} className="text-sm px-3 py-1">{risk.label}</Badge>
                      <div className="flex items-center gap-1 mt-2 justify-end">
                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-xs text-muted-foreground">Active Session</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 h-2 w-full rounded-full bg-white/60 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        score >= 80 ? 'bg-red-500' : score >= 60 ? 'bg-orange-500' : score >= 40 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>

                {/* Session Stats */}
                <div className="mb-4">
                  <div className="text-sm font-semibold mb-3">Current Session</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border bg-card p-3">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="text-xs">Duration</span>
                      </div>
                      <div className="text-lg font-semibold">{session?.duration || 0} min</div>
                    </div>
                    <div className="rounded-lg border bg-card p-3">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Activity className="h-3.5 w-3.5" />
                        <span className="text-xs">Bet Velocity</span>
                      </div>
                      <div className="text-lg font-semibold">{betVelocity} /min</div>
                    </div>
                    <div className="rounded-lg border bg-card p-3">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <DollarSign className="h-3.5 w-3.5" />
                        <span className="text-xs">Session Wager</span>
                      </div>
                      <div className="text-lg font-semibold">
                        R{((session?.total_wagered || 0)).toLocaleString()}
                      </div>
                    </div>
                    <div className="rounded-lg border bg-card p-3">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Target className="h-3.5 w-3.5" />
                        <span className="text-xs">Total Bets</span>
                      </div>
                      <div className="text-lg font-semibold">{session?.total_bets || 0}</div>
                    </div>
                  </div>
                </div>

                <Separator className="my-4" />

                {/* Risk Indicators */}
                <div className="mb-4">
                  <div className="text-sm font-semibold mb-3">Risk Indicators</div>
                  <div className="space-y-3">
                    {[
                      { label: 'Impulse Level', value: score, icon: Zap },
                      { label: 'Cognitive Fatigue', value: Math.min(score + 8, 100), icon: Brain },
                      { label: 'Bet Escalation', value: Math.max(score - 12, 0), icon: TrendingUp },
                      { label: 'Session Intensity', value: Math.min(score + 5, 100), icon: ShieldAlert },
                    ].map(({ label, value, icon: Icon }) => (
                      <div key={label} className="flex items-center gap-3">
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">{label}</span>
                            <span className="font-medium">{value}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                value >= 80 ? 'bg-red-500' : value >= 60 ? 'bg-orange-500' : value >= 40 ? 'bg-yellow-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${value}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="my-4" />

                {/* Player Profile */}
                <div className="mb-4">
                  <div className="text-sm font-semibold mb-3">Player Profile</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Email</span>
                      <span className="font-medium truncate max-w-[200px]">{selectedPlayer.email || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Wagered</span>
                      <span className="font-medium">R{(selectedPlayer.total_wagered || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last Active</span>
                      <span className="font-medium">
                        {selectedPlayer.last_active
                          ? new Date(selectedPlayer.last_active).toLocaleDateString('en-ZA')
                          : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Self Excluded</span>
                      <span className="font-medium">{selectedPlayer.self_excluded ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                </div>

                <Separator className="my-4" />

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  <Button
                    className="w-full"
                    onClick={() => {
                      setPlayerSheetOpen(false);
                      setInterventionModalOpen(true);
                    }}
                  >
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Send Intervention
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setPlayerSheetOpen(false);
                      router.push('/casino/players');
                    }}
                  >
                    <TrendingDown className="mr-2 h-4 w-4" />
                    View Full History
                  </Button>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
