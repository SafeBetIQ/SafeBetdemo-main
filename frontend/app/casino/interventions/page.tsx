'use client';
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ModuleGuard } from '@/components/ModuleGuard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { InterventionModal } from '@/components/InterventionModal';
import { ShieldAlert, TriangleAlert as AlertTriangle, Search, Send, CircleCheck as CheckCircle2, Circle as XCircle, Clock, Zap, Settings2, Layers, ChartBar as BarChart2, MessageSquare, RefreshCw, ChevronRight, Mail, Phone, Smartphone, Globe, Bell, TrendingDown, TrendingUp, Activity } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { PaginationControls } from '@/components/ui/pagination-controls';

interface Player {
  id: string;
  player_id: string;
  first_name: string;
  last_name: string;
  risk_score?: number;
  last_active?: string;
  total_wagered?: number;
}

interface ThresholdRule {
  id: string;
  rule_name: string;
  risk_threshold: number;
  intervention_type: string;
  delivery_methods: string[];
  cooldown_hours: number;
  auto_send: boolean;
  is_active: boolean;
  priority: number;
  message_template: string;
}

interface DeliveryQueueItem {
  id: string;
  intervention_id: string;
  player_id: string;
  channel: string;
  status: string;
  recipient_address: string;
  message_body: string;
  attempts: number;
  sent_at: string | null;
  failed_at: string | null;
  created_at: string;
  error_message: string | null;
}

interface InterventionRecord {
  id: string;
  player_id: string;
  intervention_type: string;
  trigger_reason: string;
  risk_score_at_trigger: number;
  delivery_method: string;
  channels_attempted: string[] | null;
  dispatch_status: string | null;
  message_sent: string | null;
  player_response: string | null;
  intervention_successful: boolean;
  auto_triggered: boolean;
  triggered_at: string;
}

interface InterventionOutcome {
  id: string;
  player_id: string;
  intervention_type: string;
  pre_risk_score: number;
  post_risk_score_7d: number | null;
  post_risk_score_30d: number | null;
  outcome: string;
  effectiveness_score: number;
  player_response: string | null;
  applied_at: string;
}

const INTERVENTION_TYPE_LABELS: Record<string, string> = {
  break_suggestion: 'Break Suggestion',
  session_limit: 'Session Limit',
  cooling_off: 'Cooling-Off',
  contact_support: 'Contact Support',
  manual_compliance: 'Manual Compliance',
  self_exclusion: 'Self-Exclusion',
  educational_content: 'Educational',
};

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  email: Mail,
  sms: Phone,
  whatsapp: Smartphone,
  in_app: Bell,
  phone: Phone,
};

function getRiskColor(score: number) {
  if (score >= 80) return { badge: 'bg-red-100 text-red-700', text: 'text-red-600', dot: 'bg-red-500' };
  if (score >= 70) return { badge: 'bg-orange-100 text-orange-700', text: 'text-orange-600', dot: 'bg-orange-500' };
  if (score >= 40) return { badge: 'bg-yellow-100 text-yellow-700', text: 'text-yellow-600', dot: 'bg-yellow-500' };
  return { badge: 'bg-emerald-100 text-emerald-700', text: 'text-emerald-600', dot: 'bg-emerald-500' };
}

function getStatusColor(status: string) {
  switch (status) {
    case 'sent': return 'bg-emerald-100 text-emerald-700';
    case 'pending': return 'bg-blue-100 text-blue-700';
    case 'failed': return 'bg-red-100 text-red-700';
    case 'queued': return 'bg-yellow-100 text-yellow-700';
    default: return 'bg-slate-100 text-slate-700';
  }
}

function MiniRiskBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-red-500' : score >= 60 ? 'bg-orange-500' : score >= 40 ? 'bg-yellow-500' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-mono w-6 text-right">{score}</span>
    </div>
  );
}

const PAGE_SIZE = 50;

export default function InterventionsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('players');
  const [players, setPlayers] = useState<Player[]>([]);
  const [playersCount, setPlayersCount] = useState(0);
  const [playersPage, setPlayersPage] = useState(0);
  const [thresholdRules, setThresholdRules] = useState<ThresholdRule[]>([]);
  const [deliveryQueue, setDeliveryQueue] = useState<DeliveryQueueItem[]>([]);
  const [queueCount, setQueueCount] = useState(0);
  const [queuePage, setQueuePage] = useState(0);
  const [interventions, setInterventions] = useState<InterventionRecord[]>([]);
  const [outcomes, setOutcomes] = useState<InterventionOutcome[]>([]);
  const [outcomesCount, setOutcomesCount] = useState(0);
  const [outcomesPage, setOutcomesPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [interventionModalOpen, setInterventionModalOpen] = useState(false);
  const [casinoName, setCasinoName] = useState<string>('SafeBet IQ');
  const [togglingRule, setTogglingRule] = useState<string | null>(null);
  const [refreshingQueue, setRefreshingQueue] = useState(false);

  const loadCasinoName = useCallback(async () => {
    if (!user?.casino_id) return;
    const { data } = await supabase.from('casinos').select('name').eq('id', user.casino_id).maybeSingle();
    if (data?.name) setCasinoName(data.name);
  }, [user?.casino_id]);

  const loadPlayers = useCallback(async () => {
    const offset = playersPage * PAGE_SIZE;
    let query = supabase
      .from('players')
      .select('id, player_id, first_name, last_name, risk_score, last_active, total_wagered', { count: 'exact' })
      .order('risk_score', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (user?.role === 'casino_admin' && user?.casino_id) {
      query = query.eq('casino_id', user.casino_id);
    }
    if (searchTerm.trim()) {
      const t = searchTerm.trim();
      query = query.or(`first_name.ilike.%${t}%,last_name.ilike.%${t}%,player_id.ilike.%${t}%`);
    }

    const { data, count } = await query;
    setPlayers(data || []);
    setPlayersCount(count ?? 0);
  }, [user?.role, user?.casino_id, playersPage, searchTerm]);

  const loadThresholdRules = useCallback(async () => {
    let query = supabase
      .from('intervention_threshold_rules')
      .select('*')
      .order('risk_threshold', { ascending: true });

    if (user?.role === 'casino_admin' && user?.casino_id) {
      query = query.eq('casino_id', user.casino_id);
    }

    const { data } = await query;
    setThresholdRules(data || []);
  }, [user?.role, user?.casino_id]);

  const loadDeliveryQueue = useCallback(async () => {
    const offset = queuePage * PAGE_SIZE;
    let query = supabase
      .from('intervention_delivery_queue')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (user?.role === 'casino_admin' && user?.casino_id) {
      query = query.eq('casino_id', user.casino_id);
    }

    const { data, count } = await query;
    setDeliveryQueue(data || []);
    setQueueCount(count ?? 0);
  }, [user?.role, user?.casino_id, queuePage]);

  const loadInterventions = useCallback(async () => {
    let query = supabase
      .from('intervention_history')
      .select('*')
      .order('triggered_at', { ascending: false })
      .limit(100);

    if (user?.role === 'casino_admin' && user?.casino_id) {
      query = query.eq('casino_id', user.casino_id);
    }

    const { data } = await query;
    setInterventions(data || []);
  }, [user?.role, user?.casino_id]);

  const loadOutcomes = useCallback(async () => {
    const offset = outcomesPage * PAGE_SIZE;
    let query = supabase
      .from('intervention_outcomes')
      .select('*', { count: 'exact' })
      .order('applied_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (user?.role === 'casino_admin' && user?.casino_id) {
      query = query.eq('casino_id', user.casino_id);
    }

    const { data, count } = await query;
    setOutcomes(data || []);
    setOutcomesCount(count ?? 0);
  }, [user?.role, user?.casino_id, outcomesPage]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      loadCasinoName(),
      loadPlayers(),
      loadThresholdRules(),
      loadDeliveryQueue(),
      loadInterventions(),
      loadOutcomes(),
    ]).finally(() => setLoading(false));
  }, [user, loadCasinoName, loadPlayers, loadThresholdRules, loadDeliveryQueue, loadInterventions, loadOutcomes]);

  async function handleToggleRule(ruleId: string, currentValue: boolean) {
    setTogglingRule(ruleId);
    const { error } = await supabase
      .from('intervention_threshold_rules')
      .update({ is_active: !currentValue, updated_at: new Date().toISOString() })
      .eq('id', ruleId);

    if (error) {
      toast.error('Failed to update rule');
    } else {
      setThresholdRules(prev => prev.map(r => r.id === ruleId ? { ...r, is_active: !currentValue } : r));
      toast.success(`Rule ${!currentValue ? 'activated' : 'deactivated'}`);
    }
    setTogglingRule(null);
  }

  async function handleRefreshQueue() {
    setRefreshingQueue(true);
    await loadDeliveryQueue();
    setRefreshingQueue(false);
    toast.success('Queue refreshed');
  }

  async function handleSendIntervention(data: {
    interventionType: string;
    deliveryMethod: string;
    deliveryMethods: string[];
    message: string;
    customMessage?: string;
  }) {
    if (!selectedPlayer || !user?.casino_id) return;

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/intervention-engine?action=send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          player_id: selectedPlayer.id,
          casino_id: user.casino_id,
          intervention_type: data.interventionType,
          delivery_methods: data.deliveryMethods,
          message: data.message,
          risk_score: selectedPlayer.risk_score || 0,
          trigger_reason: `Manual intervention — Risk Score: ${selectedPlayer.risk_score || 'N/A'}`,
          triggered_by: user.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send intervention');
      }

      toast.success('Intervention dispatched successfully');
      await Promise.all([loadInterventions(), loadDeliveryQueue()]);
      setSelectedPlayer(null);
    } catch (error: any) {
      console.error('Error sending intervention:', error);
      toast.error(error.message || 'Failed to send intervention');
    }
  }

  const handleSearch = (v: string) => { setSearchTerm(v); setPlayersPage(0); };

  const highRiskPlayers = players.filter(p => (p.risk_score || 0) >= 70);
  const mediumRiskPlayers = players.filter(p => (p.risk_score || 0) >= 40 && (p.risk_score || 0) < 70);
  // counts reflect current page; for KPIs use total counts from DB
  const autoTriggered = interventions.filter(i => i.auto_triggered).length;

  const queueStats = {
    sent: deliveryQueue.filter(q => q.status === 'sent').length,
    pending: deliveryQueue.filter(q => q.status === 'pending' || q.status === 'queued').length,
    failed: deliveryQueue.filter(q => q.status === 'failed').length,
  };

  const avgEffectiveness = outcomes.length > 0
    ? Math.round(outcomes.reduce((sum, o) => sum + (o.effectiveness_score || 0), 0) / outcomes.length)
    : 0;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
            <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <ModuleGuard slug="responsible-gambling-alerts" fallbackHref="/casino/dashboard">
    <DashboardLayout>
      <TooltipProvider>
        <div className="p-6 space-y-6">

          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-sm">
                <ShieldAlert className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Intervention Engine</h1>
                <p className="text-muted-foreground">
                  Monitor risk thresholds, dispatch interventions, and track outcomes
                </p>
              </div>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  High Risk Players
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">{highRiskPlayers.length}</div>
                <p className="text-xs text-muted-foreground mt-1">Score ≥ 70</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-yellow-500" />
                  Medium Risk
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-yellow-600">{mediumRiskPlayers.length}</div>
                <p className="text-xs text-muted-foreground mt-1">Score 40–69</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-primary" />
                  Auto-Triggered
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{autoTriggered}</div>
                <p className="text-xs text-muted-foreground mt-1">Of {interventions.length} total</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-600" />
                  Effectiveness
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-emerald-600">{avgEffectiveness}%</div>
                <p className="text-xs text-muted-foreground mt-1">Avg outcome score</p>
              </CardContent>
            </Card>
          </div>

          {/* Main Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-4 w-full max-w-2xl">
              <TabsTrigger value="players" className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                At-Risk Players
              </TabsTrigger>
              <TabsTrigger value="rules" className="flex items-center gap-1.5">
                <Settings2 className="h-3.5 w-3.5" />
                Threshold Rules
              </TabsTrigger>
              <TabsTrigger value="queue" className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" />
                Delivery Queue
              </TabsTrigger>
              <TabsTrigger value="outcomes" className="flex items-center gap-1.5">
                <BarChart2 className="h-3.5 w-3.5" />
                Outcomes
              </TabsTrigger>
            </TabsList>

            {/* At-Risk Players Tab */}
            <TabsContent value="players" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-primary" />
                        Players Requiring Intervention
                      </CardTitle>
                      <CardDescription>
                        Sorted by risk score — select any player to dispatch a targeted intervention
                      </CardDescription>
                    </div>
                    <div className="relative w-64">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search players..."
                        value={searchTerm}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="pl-9"
                      />
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
                          <TableHead className="hidden md:table-cell">Risk Level</TableHead>
                          <TableHead className="hidden md:table-cell">Last Active</TableHead>
                          <TableHead className="hidden lg:table-cell">Total Wagered</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {players.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                              No players found
                            </TableCell>
                          </TableRow>
                        ) : (
                          players.map((player) => {
                            const score = player.risk_score || 0;
                            const colors = getRiskColor(score);
                            const level = score >= 80 ? 'Critical' : score >= 70 ? 'High' : score >= 40 ? 'Moderate' : 'Low';
                            return (
                              <TableRow key={player.id} className="hover:bg-muted/20 transition-colors">
                                <TableCell>
                                  <div className="font-medium">{player.first_name} {player.last_name}</div>
                                  <div className="font-mono text-xs text-muted-foreground">{player.player_id}</div>
                                </TableCell>
                                <TableCell>
                                  <div className="w-32">
                                    <MiniRiskBar score={score} />
                                  </div>
                                </TableCell>
                                <TableCell className="hidden md:table-cell">
                                  <Badge className={`${colors.badge} border-0 text-xs`}>
                                    {level}
                                  </Badge>
                                </TableCell>
                                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                                  {player.last_active
                                    ? new Date(player.last_active).toLocaleDateString()
                                    : 'N/A'}
                                </TableCell>
                                <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                                  {player.total_wagered != null
                                    ? `R${player.total_wagered.toLocaleString()}`
                                    : 'N/A'}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setSelectedPlayer(player);
                                      setInterventionModalOpen(true);
                                    }}
                                    className="bg-primary hover:bg-primary/90"
                                  >
                                    <Send className="h-3.5 w-3.5 mr-1.5" />
                                    Intervene
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                    <PaginationControls
                      page={playersPage}
                      pageSize={PAGE_SIZE}
                      total={playersCount}
                      onPageChange={setPlayersPage}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Recent Interventions Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Recent Interventions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {interventions.slice(0, 5).length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">No interventions recorded yet</p>
                    ) : (
                      interventions.slice(0, 5).map((intervention) => (
                        <div
                          key={intervention.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {intervention.intervention_successful
                              ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                              : <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                            }
                            <div>
                              <div className="text-sm font-medium">
                                {INTERVENTION_TYPE_LABELS[intervention.intervention_type] || intervention.intervention_type}
                                {intervention.auto_triggered && (
                                  <Badge className="ml-2 text-xs bg-primary/10 text-primary border-0">Auto</Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(intervention.triggered_at).toLocaleString()}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={`${getRiskColor(intervention.risk_score_at_trigger).badge} border-0 text-xs`}>
                              {intervention.risk_score_at_trigger}
                            </Badge>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Threshold Rules Tab */}
            <TabsContent value="rules" className="space-y-4 mt-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Intervention Threshold Rules</h2>
                  <p className="text-sm text-muted-foreground">
                    Rules trigger automatic interventions when a player&apos;s risk score crosses the configured threshold
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {thresholdRules.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      No threshold rules configured
                    </CardContent>
                  </Card>
                ) : (
                  thresholdRules.map((rule) => {
                    const colors = getRiskColor(rule.risk_threshold);
                    return (
                      <Card key={rule.id} className={`transition-all ${!rule.is_active ? 'opacity-60' : ''}`}>
                        <CardContent className="pt-4 pb-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-4 flex-1 min-w-0">
                              {/* Threshold Badge */}
                              <div className={`shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center ${colors.badge}`}>
                                <span className="text-lg font-bold leading-tight">{rule.risk_threshold}</span>
                                <span className="text-xs opacity-75">+</span>
                              </div>

                              {/* Rule Details */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="font-semibold text-sm">{rule.rule_name}</span>
                                  {rule.auto_send && (
                                    <Badge className="text-xs bg-primary/10 text-primary border-0">
                                      <Zap className="h-3 w-3 mr-1" />
                                      Auto-Send
                                    </Badge>
                                  )}
                                  {rule.priority === 1 && (
                                    <Badge className="text-xs bg-red-100 text-red-700 border-0">Priority 1</Badge>
                                  )}
                                </div>

                                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2 flex-wrap">
                                  <span className="flex items-center gap-1">
                                    <MessageSquare className="h-3 w-3" />
                                    {INTERVENTION_TYPE_LABELS[rule.intervention_type] || rule.intervention_type}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {rule.cooldown_hours}h cooldown
                                  </span>
                                </div>

                                {/* Delivery Channels */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {rule.delivery_methods.map((method) => {
                                    const Icon = CHANNEL_ICONS[method] || Globe;
                                    return (
                                      <span
                                        key={method}
                                        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted border"
                                      >
                                        <Icon className="h-3 w-3" />
                                        {method}
                                      </span>
                                    );
                                  })}
                                </div>

                                {rule.message_template && (
                                  <p className="mt-2 text-xs text-muted-foreground line-clamp-1 italic">
                                    &quot;{rule.message_template}&quot;
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Toggle */}
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-muted-foreground">
                                {rule.is_active ? 'Active' : 'Inactive'}
                              </span>
                              <Switch
                                checked={rule.is_active}
                                disabled={togglingRule === rule.id}
                                onCheckedChange={() => handleToggleRule(rule.id, rule.is_active)}
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>

              <Card className="border-dashed bg-muted/20">
                <CardContent className="py-4">
                  <p className="text-xs text-muted-foreground text-center">
                    Rules are evaluated in priority order. Auto-send rules dispatch immediately when the threshold is crossed. Cooldown windows prevent repeated interventions for the same player.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Delivery Queue Tab */}
            <TabsContent value="queue" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Delivery Queue</h2>
                  <p className="text-sm text-muted-foreground">Per-channel dispatch status for all outbound messages</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleRefreshQueue} disabled={refreshingQueue}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshingQueue ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>

              {/* Queue Stats */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="border-emerald-200 bg-emerald-50">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-emerald-700 font-medium">Sent</p>
                        <p className="text-2xl font-bold text-emerald-700">{queueStats.sent}</p>
                      </div>
                      <CheckCircle2 className="h-8 w-8 text-emerald-300" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-blue-700 font-medium">Pending</p>
                        <p className="text-2xl font-bold text-blue-700">{queueStats.pending}</p>
                      </div>
                      <Clock className="h-8 w-8 text-blue-300" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-red-200 bg-red-50">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-red-700 font-medium">Failed</p>
                        <p className="text-2xl font-bold text-red-700">{queueStats.failed}</p>
                      </div>
                      <XCircle className="h-8 w-8 text-red-300" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardContent className="pt-4">
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead>Channel</TableHead>
                          <TableHead>Recipient</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="hidden md:table-cell">Attempts</TableHead>
                          <TableHead className="hidden md:table-cell">Sent At</TableHead>
                          <TableHead className="hidden lg:table-cell">Error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deliveryQueue.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                              No delivery records yet
                            </TableCell>
                          </TableRow>
                        ) : (
                          deliveryQueue.map((item) => {
                            const Icon = CHANNEL_ICONS[item.channel] || Globe;
                            return (
                              <TableRow key={item.id} className="hover:bg-muted/20 transition-colors">
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Icon className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm capitalize">{item.channel}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm font-mono text-muted-foreground truncate max-w-[150px] block">
                                    {item.recipient_address || '—'}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <Badge className={`${getStatusColor(item.status)} border-0 text-xs capitalize`}>
                                    {item.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                                  {item.attempts}
                                </TableCell>
                                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                                  {item.sent_at
                                    ? new Date(item.sent_at).toLocaleString()
                                    : '—'}
                                </TableCell>
                                <TableCell className="hidden lg:table-cell">
                                  {item.error_message ? (
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <span className="text-xs text-red-600 line-clamp-1 max-w-[200px]">
                                          {item.error_message}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs">
                                        <p className="text-xs">{item.error_message}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                    <PaginationControls
                      page={queuePage}
                      pageSize={PAGE_SIZE}
                      total={queueCount}
                      onPageChange={setQueuePage}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Outcomes Tab */}
            <TabsContent value="outcomes" className="space-y-4 mt-4">
              <div>
                <h2 className="text-lg font-semibold">Intervention Outcomes</h2>
                <p className="text-sm text-muted-foreground">
                  Tracks risk score changes and player responses following interventions
                </p>
              </div>

              {/* Outcome Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs text-muted-foreground mb-1">Total Tracked</p>
                    <p className="text-2xl font-bold">{outcomes.length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs text-muted-foreground mb-1">Improved</p>
                    <p className="text-2xl font-bold text-emerald-600">
                      {outcomes.filter(o => o.outcome === 'improved' || o.outcome === 'risk_reduced').length}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs text-muted-foreground mb-1">No Change</p>
                    <p className="text-2xl font-bold text-yellow-600">
                      {outcomes.filter(o => o.outcome === 'no_change').length}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs text-muted-foreground mb-1">Avg Score</p>
                    <p className="text-2xl font-bold text-primary">{avgEffectiveness}</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardContent className="pt-4">
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead>Intervention</TableHead>
                          <TableHead>Pre-Risk</TableHead>
                          <TableHead>Post-Risk (7d)</TableHead>
                          <TableHead>Delta</TableHead>
                          <TableHead className="hidden md:table-cell">Outcome</TableHead>
                          <TableHead className="hidden md:table-cell">Effectiveness</TableHead>
                          <TableHead className="hidden lg:table-cell">Applied At</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {outcomes.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                              No outcome data yet — interventions will appear here after their 7-day measurement window
                            </TableCell>
                          </TableRow>
                        ) : (
                          outcomes.map((outcome) => {
                            const delta = outcome.post_risk_score_7d != null
                              ? outcome.post_risk_score_7d - outcome.pre_risk_score
                              : null;
                            const improved = delta != null && delta < 0;
                            const worsened = delta != null && delta > 0;

                            return (
                              <TableRow key={outcome.id} className="hover:bg-muted/20 transition-colors">
                                <TableCell>
                                  <span className="text-sm font-medium">
                                    {INTERVENTION_TYPE_LABELS[outcome.intervention_type] || outcome.intervention_type}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <Badge className={`${getRiskColor(outcome.pre_risk_score).badge} border-0 text-xs`}>
                                    {outcome.pre_risk_score}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {outcome.post_risk_score_7d != null ? (
                                    <Badge className={`${getRiskColor(outcome.post_risk_score_7d).badge} border-0 text-xs`}>
                                      {outcome.post_risk_score_7d}
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">Pending</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {delta != null ? (
                                    <div className={`flex items-center gap-1 text-sm font-medium ${improved ? 'text-emerald-600' : worsened ? 'text-red-600' : 'text-muted-foreground'}`}>
                                      {improved ? <TrendingDown className="h-3.5 w-3.5" /> : worsened ? <TrendingUp className="h-3.5 w-3.5" /> : null}
                                      {delta > 0 ? '+' : ''}{delta}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="hidden md:table-cell">
                                  <Badge className={`border-0 text-xs ${
                                    outcome.outcome === 'improved' || outcome.outcome === 'risk_reduced'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : outcome.outcome === 'no_change'
                                        ? 'bg-yellow-100 text-yellow-700'
                                        : 'bg-red-100 text-red-700'
                                  }`}>
                                    {outcome.outcome?.replace(/_/g, ' ') || 'pending'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="hidden md:table-cell">
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${outcome.effectiveness_score >= 70 ? 'bg-emerald-500' : outcome.effectiveness_score >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                        style={{ width: `${outcome.effectiveness_score || 0}%` }}
                                      />
                                    </div>
                                    <span className="text-xs font-mono">{outcome.effectiveness_score || 0}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                                  {new Date(outcome.applied_at).toLocaleDateString()}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                    <PaginationControls
                      page={outcomesPage}
                      pageSize={PAGE_SIZE}
                      total={outcomesCount}
                      onPageChange={setOutcomesPage}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Intervention Modal */}
          {selectedPlayer && (
            <InterventionModal
              open={interventionModalOpen}
              onOpenChange={setInterventionModalOpen}
              playerName={`${selectedPlayer.first_name} ${selectedPlayer.last_name}`}
              casinoName={casinoName}
              riskScore={selectedPlayer.risk_score || 0}
              triggerReason={`Risk Score: ${selectedPlayer.risk_score || 'N/A'}`}
              onSubmit={handleSendIntervention}
            />
          )}
        </div>
      </TooltipProvider>
    </DashboardLayout>
    </ModuleGuard>
  );
}
