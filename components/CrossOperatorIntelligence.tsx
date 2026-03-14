'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Network, TriangleAlert as AlertTriangle, ShieldOff, TrendingUp,
  ArrowRightLeft, Zap, Users, RefreshCw, Eye, CircleCheck as CheckCircle2,
  Circle as XCircle, Clock, ChevronRight, Lock, Activity, Building2,
  FileWarning, BadgeAlert
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts';

interface CrossOperatorAlert {
  id: string;
  player_id: string;
  casino_id: string;
  pseudonym_token: string;
  alert_type: string;
  severity: string;
  status: string;
  detected_operators: number;
  operator_names: string[];
  evidence: Record<string, unknown>;
  cross_operator_score: number;
  platforms_detected: number;
  total_cross_op_deposits: number;
  total_cross_op_losses: number;
  session_overlap_minutes: number;
  self_exclusion_violation: boolean;
  alert_message: string;
  recommendation: string;
  auto_generated: boolean;
  false_positive: boolean;
  detected_at: string;
  resolved_at: string | null;
  action_notes: string | null;
  player?: {
    id: string;
    first_name: string;
    last_name: string;
    player_id: string;
    risk_score: number;
  };
}

interface SignalLog {
  id: string;
  player_id: string;
  pseudonym_token: string;
  signal_type: string;
  signal_value: number;
  signal_score: number;
  source_operator: string;
  reported_at: string;
  evidence: Record<string, unknown>;
}

const ALERT_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  operator_hopping:            { label: 'Operator Hopping',     icon: ArrowRightLeft, color: 'text-orange-600' },
  multi_platform_gambling:     { label: 'Multi-Platform',       icon: Network,        color: 'text-blue-600' },
  cross_operator_loss_chasing: { label: 'Loss Chasing',         icon: TrendingUp,     color: 'text-red-600' },
  self_exclusion_breach:       { label: 'Exclusion Breach',     icon: ShieldOff,      color: 'text-red-700' },
  velocity_spike:              { label: 'Velocity Spike',       icon: Zap,            color: 'text-yellow-600' },
  deposit_escalation:          { label: 'Deposit Escalation',   icon: TrendingUp,     color: 'text-orange-500' },
  cross_operator_high_risk:    { label: 'High Risk Composite',  icon: BadgeAlert,     color: 'text-red-800' },
};

const SEVERITY_CONFIG: Record<string, { badge: string; dot: string; label: string }> = {
  critical: { badge: 'bg-red-100 text-red-700',       dot: 'bg-red-500',    label: 'Critical' },
  high:     { badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500', label: 'High' },
  medium:   { badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500', label: 'Medium' },
  low:      { badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', label: 'Low' },
};

const STATUS_CONFIG: Record<string, { badge: string; label: string }> = {
  new:      { badge: 'bg-blue-100 text-blue-700',     label: 'New' },
  reviewed: { badge: 'bg-yellow-100 text-yellow-700', label: 'Reviewed' },
  actioned: { badge: 'bg-emerald-100 text-emerald-700', label: 'Actioned' },
  dismissed:{ badge: 'bg-slate-100 text-slate-600',   label: 'Dismissed' },
};

const SIGNAL_TYPE_LABELS: Record<string, string> = {
  operator_hop:         'Operator Hop',
  concurrent_session:   'Concurrent Session',
  loss_chase:           'Loss Chase',
  deposit_escalation:   'Deposit Escalation',
  self_exclusion_flag:  'Self-Exclusion Flag',
  velocity_spike:       'Velocity Spike',
  multi_platform_deposit: 'Multi-Platform Deposit',
};

const BAR_COLORS: Record<string, string> = {
  operator_hopping: '#f97316',
  multi_platform_gambling: '#3b82f6',
  cross_operator_loss_chasing: '#ef4444',
  self_exclusion_breach: '#991b1b',
  velocity_spike: '#eab308',
  deposit_escalation: '#f59e0b',
  cross_operator_high_risk: '#dc2626',
};

function maskToken(token: string): string {
  if (!token || token.length < 12) return '***';
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

function AlertDetailSheet({
  alert,
  open,
  onOpenChange,
  onStatusUpdate,
}: {
  alert: CrossOperatorAlert | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onStatusUpdate: (id: string, status: string) => void;
}) {
  const [updating, setUpdating] = useState(false);

  async function updateStatus(status: string) {
    if (!alert) return;
    setUpdating(true);
    const { error } = await supabase
      .from('cross_operator_alerts')
      .update({ status, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', alert.id);
    if (!error) onStatusUpdate(alert.id, status);
    setUpdating(false);
  }

  if (!alert) return null;

  const severityCfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.medium;
  const typeCfg = ALERT_TYPE_CONFIG[alert.alert_type] || { label: alert.alert_type, icon: AlertTriangle, color: 'text-muted-foreground' };
  const TypeIcon = typeCfg.icon;

  const evidenceEntries = Object.entries(alert.evidence || {}).filter(
    ([k]) => !['signals_input'].includes(k)
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-muted`}>
              <TypeIcon className={`h-5 w-5 ${typeCfg.color}`} />
            </div>
            <div>
              <SheetTitle className="text-base">{typeCfg.label}</SheetTitle>
              <SheetDescription className="text-xs">
                Alert ID: {alert.id.slice(0, 8)}...
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-5 pt-4">
          {/* Severity + Status */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`${severityCfg.badge} border-0`}>{severityCfg.label}</Badge>
            <Badge className={`${STATUS_CONFIG[alert.status]?.badge || ''} border-0`}>
              {STATUS_CONFIG[alert.status]?.label || alert.status}
            </Badge>
            {alert.self_exclusion_violation && (
              <Badge className="bg-red-700 text-white border-0 flex items-center gap-1">
                <ShieldOff className="h-3 w-3" />
                EXCLUSION BREACH
              </Badge>
            )}
            {alert.false_positive && (
              <Badge className="bg-slate-200 text-slate-600 border-0">False Positive</Badge>
            )}
          </div>

          {/* Pseudonym token */}
          <div className="p-3 rounded-lg bg-muted/40 border border-dashed">
            <div className="flex items-center gap-2 mb-1">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Pseudonym Token (Privacy-Preserved)</span>
            </div>
            <p className="font-mono text-xs text-foreground break-all">{alert.pseudonym_token}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Real player identity is never transmitted cross-operator
            </p>
          </div>

          {/* Alert message */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Alert</h4>
            <p className="text-sm leading-relaxed">{alert.alert_message}</p>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/30 border">
              <p className="text-xs text-muted-foreground">Cross-Op Score</p>
              <p className="text-2xl font-bold mt-0.5">{alert.cross_operator_score}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border">
              <p className="text-xs text-muted-foreground">Operators Detected</p>
              <p className="text-2xl font-bold mt-0.5">{alert.detected_operators}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border">
              <p className="text-xs text-muted-foreground">Cross-Op Deposits</p>
              <p className="text-lg font-bold mt-0.5 text-orange-600">R{(alert.total_cross_op_deposits || 0).toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border">
              <p className="text-xs text-muted-foreground">Cross-Op Losses</p>
              <p className="text-lg font-bold mt-0.5 text-red-600">R{(alert.total_cross_op_losses || 0).toLocaleString()}</p>
            </div>
          </div>

          {/* Operators involved */}
          {alert.operator_names && alert.operator_names.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Operators Involved</h4>
              <div className="flex flex-wrap gap-1.5">
                {alert.operator_names.map((op, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-muted border">
                    <Building2 className="h-3 w-3" />
                    {op}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Evidence */}
          {evidenceEntries.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Evidence</h4>
              <div className="space-y-1.5">
                {evidenceEntries.map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between text-sm p-2 rounded bg-muted/30">
                    <span className="text-muted-foreground text-xs capitalize">{key.replace(/_/g, ' ')}</span>
                    <span className="font-medium text-xs">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendation */}
          <div className="p-3 rounded-lg border-l-4 border-primary bg-primary/5">
            <h4 className="text-xs font-semibold text-primary mb-1">Recommended Action</h4>
            <p className="text-sm">{alert.recommendation}</p>
          </div>

          {/* Detection time */}
          <div className="text-xs text-muted-foreground">
            Detected: {new Date(alert.detected_at).toLocaleString()}
            {alert.resolved_at && (
              <> · Resolved: {new Date(alert.resolved_at).toLocaleString()}</>
            )}
          </div>

          {/* Actions */}
          {alert.status === 'new' && (
            <div className="flex gap-2 pt-2 border-t">
              <Button size="sm" variant="outline" onClick={() => updateStatus('reviewed')} disabled={updating}>
                <Eye className="h-3.5 w-3.5 mr-1.5" />
                Mark Reviewed
              </Button>
              <Button size="sm" onClick={() => updateStatus('actioned')} disabled={updating} className="bg-primary">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                Mark Actioned
              </Button>
              <Button size="sm" variant="ghost" onClick={() => updateStatus('dismissed')} disabled={updating}>
                Dismiss
              </Button>
            </div>
          )}
          {alert.status === 'reviewed' && (
            <div className="flex gap-2 pt-2 border-t">
              <Button size="sm" onClick={() => updateStatus('actioned')} disabled={updating} className="bg-primary">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                Mark Actioned
              </Button>
              <Button size="sm" variant="ghost" onClick={() => updateStatus('dismissed')} disabled={updating}>
                Dismiss
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface CrossOperatorIntelligenceProps {
  casinoId?: string;
}

export function CrossOperatorIntelligence({ casinoId }: CrossOperatorIntelligenceProps) {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<CrossOperatorAlert[]>([]);
  const [signalLog, setSignalLog] = useState<SignalLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<CrossOperatorAlert | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('alerts');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  const effectiveCasinoId = casinoId || user?.casino_id;

  const loadData = useCallback(async () => {
    let alertQuery = supabase
      .from('cross_operator_alerts')
      .select(`*, player:players(id, first_name, last_name, player_id, risk_score)`)
      .order('detected_at', { ascending: false })
      .limit(100);

    let signalQuery = supabase
      .from('cross_operator_signal_log')
      .select('*')
      .order('reported_at', { ascending: false })
      .limit(100);

    if (effectiveCasinoId) {
      alertQuery = alertQuery.eq('casino_id', effectiveCasinoId);
      signalQuery = signalQuery.eq('casino_id', effectiveCasinoId);
    }

    const [{ data: alertData }, { data: signalData }] = await Promise.all([
      alertQuery,
      signalQuery,
    ]);

    setAlerts(alertData || []);
    setSignalLog(signalData || []);
  }, [effectiveCasinoId]);

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  function handleStatusUpdate(id: string, status: string) {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    setSheetOpen(false);
  }

  // Filtered alerts
  const filteredAlerts = alerts.filter(a => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
    return true;
  });

  // Stats
  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const newCount = alerts.filter(a => a.status === 'new').length;
  const exclusionBreaches = alerts.filter(a => a.self_exclusion_violation).length;
  const avgScore = alerts.length > 0
    ? Math.round(alerts.reduce((s, a) => s + (a.cross_operator_score || 0), 0) / alerts.length)
    : 0;

  // Chart data: alerts by type
  const alertsByType = Object.entries(
    alerts.reduce((acc: Record<string, number>, a) => {
      const label = ALERT_TYPE_CONFIG[a.alert_type]?.label || a.alert_type;
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

  // Chart data: severity distribution for pie
  const severityDist = [
    { name: 'Critical', value: alerts.filter(a => a.severity === 'critical').length, fill: '#ef4444' },
    { name: 'High',     value: alerts.filter(a => a.severity === 'high').length,     fill: '#f97316' },
    { name: 'Medium',   value: alerts.filter(a => a.severity === 'medium').length,   fill: '#eab308' },
    { name: 'Low',      value: alerts.filter(a => a.severity === 'low').length,      fill: '#10b981' },
  ].filter(d => d.value > 0);

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

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Network className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Cross-Operator Intelligence</h2>
              <p className="text-sm text-muted-foreground">
                Pseudonymised detection of harmful multi-operator gambling patterns
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-3 py-1.5 rounded-full bg-muted border">
              <Lock className="h-3 w-3" />
              Privacy-preserving tokens active
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className={criticalCount > 0 ? 'border-red-200 bg-red-50/50' : ''}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                Critical Alerts
              </p>
              <p className="text-3xl font-bold text-red-600">{criticalCount}</p>
              <p className="text-xs text-muted-foreground mt-1">{newCount} unreviewed</p>
            </CardContent>
          </Card>

          <Card className={exclusionBreaches > 0 ? 'border-red-300 bg-red-50' : ''}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <ShieldOff className="h-3.5 w-3.5 text-red-700" />
                Exclusion Breaches
              </p>
              <p className="text-3xl font-bold text-red-700">{exclusionBreaches}</p>
              <p className="text-xs text-muted-foreground mt-1">NRGP violations</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Activity className="h-3.5 w-3.5 text-primary" />
                Total Alerts
              </p>
              <p className="text-3xl font-bold">{alerts.length}</p>
              <p className="text-xs text-muted-foreground mt-1">{alertsByType.length} pattern types</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Users className="h-3.5 w-3.5 text-primary" />
                Avg Cross-Op Score
              </p>
              <p className="text-3xl font-bold">{avgScore}</p>
              <p className="text-xs text-muted-foreground mt-1">Across all flagged players</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Alert type bar chart */}
          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Alerts by Pattern Type</CardTitle>
            </CardHeader>
            <CardContent>
              {alertsByType.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={alertsByType} margin={{ left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {alertsByType.map((entry, index) => {
                        const alertTypeKey = Object.keys(ALERT_TYPE_CONFIG).find(k =>
                          ALERT_TYPE_CONFIG[k].label === entry.name
                        ) || '';
                        return <Cell key={index} fill={BAR_COLORS[alertTypeKey] || '#6b7280'} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Severity pie chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Severity Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {severityDist.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={severityDist}
                      cx="50%"
                      cy="45%"
                      innerRadius={40}
                      outerRadius={65}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={false}
                    >
                      {severityDist.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <TabsList>
              <TabsTrigger value="alerts" className="text-xs">
                <FileWarning className="h-3.5 w-3.5 mr-1.5" />
                Alerts ({filteredAlerts.length})
              </TabsTrigger>
              <TabsTrigger value="signals" className="text-xs">
                <Activity className="h-3.5 w-3.5 mr-1.5" />
                Signal Log ({signalLog.length})
              </TabsTrigger>
            </TabsList>

            {/* Filters */}
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs border rounded-md px-2 py-1.5 bg-background h-8"
              >
                <option value="all">All Status</option>
                <option value="new">New</option>
                <option value="reviewed">Reviewed</option>
                <option value="actioned">Actioned</option>
                <option value="dismissed">Dismissed</option>
              </select>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="text-xs border rounded-md px-2 py-1.5 bg-background h-8"
              >
                <option value="all">All Severity</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {/* Alerts Table */}
          <TabsContent value="alerts" className="mt-4">
            <Card>
              <CardContent className="pt-4">
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-8"></TableHead>
                        <TableHead>Player Token</TableHead>
                        <TableHead>Pattern</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead className="hidden md:table-cell">Operators</TableHead>
                        <TableHead className="hidden md:table-cell">Cross-Op Losses</TableHead>
                        <TableHead className="hidden lg:table-cell">Detected</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">View</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAlerts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center text-muted-foreground py-12">
                            No alerts match the current filters
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAlerts.map((alert) => {
                          const severityCfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.medium;
                          const statusCfg = STATUS_CONFIG[alert.status] || STATUS_CONFIG.new;
                          const typeCfg = ALERT_TYPE_CONFIG[alert.alert_type] || { label: alert.alert_type, icon: AlertTriangle, color: 'text-muted-foreground' };
                          const TypeIcon = typeCfg.icon;

                          return (
                            <TableRow
                              key={alert.id}
                              className="hover:bg-muted/20 transition-colors cursor-pointer"
                              onClick={() => { setSelectedAlert(alert); setSheetOpen(true); }}
                            >
                              <TableCell>
                                <div className={`w-2 h-2 rounded-full ${severityCfg.dot}`} />
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5">
                                  <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <span className="font-mono text-xs text-muted-foreground">
                                    {maskToken(alert.pseudonym_token)}
                                  </span>
                                </div>
                                {alert.player && (
                                  <div className="text-xs text-muted-foreground/60 mt-0.5">
                                    {alert.player.first_name} {alert.player.last_name}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5">
                                  <TypeIcon className={`h-3.5 w-3.5 ${typeCfg.color} shrink-0`} />
                                  <span className="text-sm">{typeCfg.label}</span>
                                </div>
                                {alert.self_exclusion_violation && (
                                  <Badge className="text-xs bg-red-700 text-white border-0 mt-0.5">
                                    <ShieldOff className="h-2.5 w-2.5 mr-1" />
                                    NRGP Breach
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge className={`${severityCfg.badge} border-0 text-xs`}>
                                  {severityCfg.label}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${alert.cross_operator_score >= 80 ? 'bg-red-500' : alert.cross_operator_score >= 60 ? 'bg-orange-500' : alert.cross_operator_score >= 40 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                                      style={{ width: `${alert.cross_operator_score}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-mono">{alert.cross_operator_score}</span>
                                </div>
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                                {alert.detected_operators}
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-sm text-red-600 font-medium">
                                {alert.total_cross_op_losses > 0 ? `R${alert.total_cross_op_losses.toLocaleString()}` : '—'}
                              </TableCell>
                              <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                                {new Date(alert.detected_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                <Badge className={`${statusCfg.badge} border-0 text-xs`}>
                                  {statusCfg.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Signal Log Tab */}
          <TabsContent value="signals" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Raw Signal Events
                </CardTitle>
                <CardDescription className="text-xs">
                  Individual behavioural signals received from operators and intelligence feeds.
                  All player references are pseudonymised.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Signal Type</TableHead>
                        <TableHead>Token</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead className="hidden md:table-cell">Value</TableHead>
                        <TableHead className="hidden md:table-cell">Source</TableHead>
                        <TableHead className="hidden lg:table-cell">Evidence</TableHead>
                        <TableHead>Reported</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {signalLog.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                            No signal events recorded
                          </TableCell>
                        </TableRow>
                      ) : (
                        signalLog.map((sig) => (
                          <TableRow key={sig.id} className="hover:bg-muted/20 transition-colors">
                            <TableCell>
                              <span className="text-sm">{SIGNAL_TYPE_LABELS[sig.signal_type] || sig.signal_type}</span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Lock className="h-3 w-3 text-muted-foreground" />
                                <span className="font-mono text-xs text-muted-foreground">
                                  {maskToken(sig.pseudonym_token)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-10 h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${sig.signal_score >= 80 ? 'bg-red-500' : sig.signal_score >= 60 ? 'bg-orange-500' : sig.signal_score >= 40 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                                    style={{ width: `${sig.signal_score}%` }}
                                  />
                                </div>
                                <span className="text-xs font-mono">{sig.signal_score}</span>
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                              {sig.signal_value > 0 ? sig.signal_value.toLocaleString() : '—'}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                              {sig.source_operator}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              {sig.evidence && Object.keys(sig.evidence).length > 0 ? (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <span className="text-xs text-primary underline cursor-help">
                                      {Object.keys(sig.evidence).length} fields
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(sig.evidence, null, 2)}</pre>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(sig.reported_at).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Privacy notice */}
        <Card className="border-dashed bg-muted/20">
          <CardContent className="py-3">
            <div className="flex items-start gap-2">
              <Lock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                <strong>Privacy-preserving design:</strong> All cross-operator intelligence uses pseudonymised player tokens generated via SHA-256 hashing. Real player identities are never shared with external operators. Token-to-player mappings are stored exclusively within your casino&apos;s secure environment. Self-exclusion breach detection cross-references the NRGP register using pseudonymised identifiers.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Alert Detail Sheet */}
        <AlertDetailSheet
          alert={selectedAlert}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          onStatusUpdate={handleStatusUpdate}
        />
      </div>
    </TooltipProvider>
  );
}
