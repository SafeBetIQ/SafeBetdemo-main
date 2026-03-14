'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2, Clock, MessageSquare, Send, RefreshCw, Circle as XCircle, Zap, Settings2, ChevronRight, Users, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/lib/supabase';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell
} from 'recharts';

interface Intervention {
  id: string;
  player_id: string;
  intervention_type: string;
  trigger_reason: string;
  risk_score_at_trigger: number;
  delivery_method: string;
  dispatch_status: string;
  message_sent: string | null;
  player_response: string | null;
  intervention_successful: boolean | null;
  auto_triggered: boolean;
  triggered_at: string;
  players?: { first_name: string; last_name: string; player_id: string; risk_score: number };
}

interface ThresholdRule {
  id: string;
  rule_name: string;
  risk_threshold: number;
  intervention_type: string;
  delivery_methods: string[];
  auto_send: boolean;
  is_active: boolean;
  priority: number;
}

interface InterventionAlertsProps {
  casinoId: string;
}

const DISPATCH_CONFIG: Record<string, { badge: string; label: string; icon: React.ElementType }> = {
  sent:      { badge: 'bg-emerald-100 text-emerald-700', label: 'Sent',      icon: CheckCircle2 },
  pending:   { badge: 'bg-yellow-100 text-yellow-700',   label: 'Pending',   icon: Clock },
  failed:    { badge: 'bg-red-100 text-red-700',         label: 'Failed',    icon: XCircle },
  delivered: { badge: 'bg-blue-100 text-blue-700',       label: 'Delivered', icon: CheckCircle2 },
};

const INTERVENTION_LABELS: Record<string, string> = {
  responsible_gambling_message: 'RG Message',
  cooling_off_suggestion: 'Cool-Off',
  deposit_limit_recommendation: 'Deposit Limit',
  self_exclusion_referral: 'Self-Exclusion',
  helpline_referral: 'Helpline',
  follow_up_check: 'Follow-up',
  account_review: 'Account Review',
};

export function InterventionAlerts({ casinoId }: InterventionAlertsProps) {
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [rules, setRules] = useState<ThresholdRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('alerts');
  const [selectedIntervention, setSelectedIntervention] = useState<Intervention | null>(null);

  useEffect(() => {
    loadData();
  }, [casinoId]);

  async function loadData() {
    setLoading(true);
    const [intRes, ruleRes] = await Promise.all([
      supabase.from('player_protection_interventions')
        .select('*, players(first_name, last_name, player_id, risk_score)')
        .eq('casino_id', casinoId)
        .order('triggered_at', { ascending: false })
        .limit(100),
      supabase.from('intervention_threshold_rules')
        .select('*')
        .eq('casino_id', casinoId)
        .order('priority', { ascending: true }),
    ]);
    setInterventions(intRes.data || []);
    setRules(ruleRes.data || []);
    setLoading(false);
  }

  const pending   = interventions.filter(i => i.dispatch_status === 'pending').length;
  const sent      = interventions.filter(i => i.dispatch_status === 'sent').length;
  const failed    = interventions.filter(i => i.dispatch_status === 'failed').length;
  const successful = interventions.filter(i => i.intervention_successful === true).length;

  const typeData = Object.entries(
    interventions.reduce((acc: Record<string, number>, i) => {
      const k = INTERVENTION_LABELS[i.intervention_type] || i.intervention_type;
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

  const COLORS = ['#3b82f6','#f97316','#10b981','#ef4444','#eab308','#8b5cf6'];

  if (loading) {
    return <div className="flex items-center justify-center h-48"><div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <TooltipProvider>
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={`relative ${pending > 0 ? 'border-yellow-200 bg-yellow-50/50' : ''}`}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="absolute top-3 right-3 h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs"><p>Interventions that have been triggered but not yet sent to the player. Review delivery configuration if this number is high.</p></TooltipContent>
          </Tooltip>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
              <Clock className="h-3.5 w-3.5 text-yellow-500" /> Pending
            </p>
            <p className="text-3xl font-bold text-yellow-600">{pending}</p>
            <p className="text-xs text-muted-foreground">Awaiting dispatch</p>
          </CardContent>
        </Card>
        <Card className="relative">
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="absolute top-3 right-3 h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs"><p>Interventions successfully sent to players via the configured delivery channel (SMS, email, WhatsApp, or in-app).</p></TooltipContent>
          </Tooltip>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
              <Send className="h-3.5 w-3.5 text-blue-500" /> Sent
            </p>
            <p className="text-3xl font-bold">{sent}</p>
            <p className="text-xs text-muted-foreground">Delivered to player</p>
          </CardContent>
        </Card>
        <Card className="relative">
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="absolute top-3 right-3 h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs"><p>Interventions that resulted in a measurable reduction in the player's risk score following the interaction.</p></TooltipContent>
          </Tooltip>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Successful
            </p>
            <p className="text-3xl font-bold text-emerald-600">{successful}</p>
            <p className="text-xs text-muted-foreground">Risk score reduced</p>
          </CardContent>
        </Card>
        <Card className={`relative ${failed > 0 ? 'border-red-200 bg-red-50/40' : ''}`}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="absolute top-3 right-3 h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs"><p>Interventions where delivery failed. This may indicate an invalid contact number, blocked address, or integration issue.</p></TooltipContent>
          </Tooltip>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
              <XCircle className="h-3.5 w-3.5 text-red-500" /> Failed
            </p>
            <p className="text-3xl font-bold text-red-600">{failed}</p>
            <p className="text-xs text-muted-foreground">Delivery failure</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="max-w-sm">
          <TabsTrigger value="alerts" className="text-xs">
            <Bell className="h-3.5 w-3.5 mr-1.5" />
            Alert Queue ({interventions.length})
          </TabsTrigger>
          <TabsTrigger value="breakdown" className="text-xs">
            <Zap className="h-3.5 w-3.5 mr-1.5" />
            Type Breakdown
          </TabsTrigger>
          <TabsTrigger value="rules" className="text-xs">
            <Settings2 className="h-3.5 w-3.5 mr-1.5" />
            Threshold Rules ({rules.length})
          </TabsTrigger>
        </TabsList>

        {/* ALERT QUEUE */}
        <TabsContent value="alerts" className="mt-4">
          <Card className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="absolute top-3 right-3 h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors z-10" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs"><p>Full log of all player interventions ordered by date. Click a row to see the full detail including message content and outcome.</p></TooltipContent>
            </Tooltip>
            <CardContent className="pt-4">
              {pending > 0 && (
                <div className="mb-4 p-3 rounded-lg bg-yellow-50 border border-yellow-200 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />
                  <p className="text-sm text-yellow-700">
                    <strong>{pending} intervention{pending > 1 ? 's' : ''}</strong> pending dispatch. Check your delivery configuration.
                  </p>
                </div>
              )}
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Player</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="hidden md:table-cell">Trigger</TableHead>
                      <TableHead className="hidden md:table-cell">Risk</TableHead>
                      <TableHead className="hidden lg:table-cell">Channel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden lg:table-cell">Outcome</TableHead>
                      <TableHead className="text-right">Detail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {interventions.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">No interventions recorded</TableCell></TableRow>
                    ) : interventions.slice(0, 50).map(i => {
                      const dispCfg = DISPATCH_CONFIG[i.dispatch_status] || DISPATCH_CONFIG.pending;
                      const DispIcon = dispCfg.icon;
                      return (
                        <TableRow key={i.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => setSelectedIntervention(i)}>
                          <TableCell>
                            <p className="text-sm font-medium">{i.players?.first_name} {i.players?.last_name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{i.players?.player_id}</p>
                          </TableCell>
                          <TableCell className="text-xs">{INTERVENTION_LABELS[i.intervention_type] || i.intervention_type}</TableCell>
                          <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-[180px] truncate">{i.trigger_reason}</TableCell>
                          <TableCell className="hidden md:table-cell">
                            <span className={`text-sm font-semibold ${i.risk_score_at_trigger >= 80 ? 'text-red-600' : i.risk_score_at_trigger >= 60 ? 'text-orange-600' : 'text-yellow-600'}`}>
                              {i.risk_score_at_trigger}
                            </span>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-xs capitalize">{i.delivery_method || '—'}</TableCell>
                          <TableCell>
                            <Badge className={`${dispCfg.badge} border-0 text-xs`}>
                              <DispIcon className="h-3 w-3 mr-1" />
                              {dispCfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {i.intervention_successful === true
                              ? <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Success</Badge>
                              : i.intervention_successful === false
                              ? <Badge className="bg-red-100 text-red-700 border-0 text-xs">No Change</Badge>
                              : <Badge className="bg-slate-100 text-slate-600 border-0 text-xs">Pending</Badge>}
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* TYPE BREAKDOWN */}
        <TabsContent value="breakdown" className="mt-4">
          <Card className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="absolute top-3 right-3 h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors z-10" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs"><p>Breakdown of how many interventions were issued per type. Helps identify which responsible gambling tools are used most frequently.</p></TooltipContent>
            </Tooltip>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Interventions by Type</CardTitle>
              <CardDescription className="text-xs">Distribution of intervention categories issued to your players</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={typeData} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Count">
                    {typeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* THRESHOLD RULES */}
        <TabsContent value="rules" className="mt-4">
          <Card className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="absolute top-3 right-3 h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors z-10" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs"><p>Rules configured to automatically trigger interventions when a player's risk score crosses a defined threshold. Configure these in the Interventions settings.</p></TooltipContent>
            </Tooltip>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-primary" />
                Auto-Intervention Threshold Rules
              </CardTitle>
              <CardDescription className="text-xs">Rules that trigger automatic interventions when player risk scores exceed thresholds</CardDescription>
            </CardHeader>
            <CardContent>
              {rules.length === 0 ? (
                <div className="text-center py-10 text-sm text-muted-foreground">
                  <Settings2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  No threshold rules configured.
                  <Button variant="link" className="block mx-auto mt-1 text-xs" onClick={() => window.location.href = '/casino/interventions'}>Configure in Interventions</Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {rules.map(rule => (
                    <div key={rule.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${rule.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        <div>
                          <p className="text-sm font-medium">{rule.rule_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Triggers at risk score &ge; {rule.risk_threshold} &middot; {INTERVENTION_LABELS[rule.intervention_type] || rule.intervention_type}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {rule.delivery_methods?.map(m => (
                          <Badge key={m} className="bg-blue-100 text-blue-700 border-0 text-xs capitalize">{m}</Badge>
                        ))}
                        {rule.auto_send && <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Auto</Badge>}
                        <Badge className={`border-0 text-xs ${rule.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                          {rule.is_active ? 'Active' : 'Disabled'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Intervention Detail Dialog — outside TooltipProvider scope intentionally */}
      <Dialog open={!!selectedIntervention} onOpenChange={() => setSelectedIntervention(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Intervention Detail</DialogTitle>
            <DialogDescription>
              {selectedIntervention && `${INTERVENTION_LABELS[selectedIntervention.intervention_type] || selectedIntervention.intervention_type} · ${new Date(selectedIntervention.triggered_at).toLocaleString()}`}
            </DialogDescription>
          </DialogHeader>
          {selectedIntervention && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/30 border">
                  <p className="text-xs text-muted-foreground">Player</p>
                  <p className="font-medium text-sm mt-0.5">{selectedIntervention.players?.first_name} {selectedIntervention.players?.last_name}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border">
                  <p className="text-xs text-muted-foreground">Risk at Trigger</p>
                  <p className="font-bold text-xl mt-0.5 text-orange-600">{selectedIntervention.risk_score_at_trigger}</p>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 border">
                <p className="text-xs text-muted-foreground mb-1">Trigger Reason</p>
                <p className="text-sm">{selectedIntervention.trigger_reason}</p>
              </div>
              {selectedIntervention.message_sent && (
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="flex items-center gap-1.5 mb-1">
                    <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
                    <span className="text-xs font-medium text-blue-700">Message Sent</span>
                  </div>
                  <p className="text-sm text-blue-800">{selectedIntervention.message_sent}</p>
                </div>
              )}
              {selectedIntervention.player_response && (
                <div className="p-3 rounded-lg bg-muted/30 border">
                  <p className="text-xs text-muted-foreground mb-1">Player Response</p>
                  <p className="text-sm">{selectedIntervention.player_response}</p>
                </div>
              )}
              <div className="flex items-center gap-2">
                {selectedIntervention.auto_triggered && <Badge className="bg-blue-100 text-blue-700 border-0">Auto-triggered</Badge>}
                <Badge className={`${DISPATCH_CONFIG[selectedIntervention.dispatch_status]?.badge || ''} border-0`}>
                  {DISPATCH_CONFIG[selectedIntervention.dispatch_status]?.label || selectedIntervention.dispatch_status}
                </Badge>
                {selectedIntervention.intervention_successful === true && <Badge className="bg-emerald-100 text-emerald-700 border-0">Successful</Badge>}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedIntervention(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}
