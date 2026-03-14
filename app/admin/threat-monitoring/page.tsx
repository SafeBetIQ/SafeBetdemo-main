'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend,
} from 'recharts';
import { ShieldAlert, Activity, CircleAlert as AlertCircle, TriangleAlert as AlertTriangle, Info, Shield, TrendingUp, Eye, CircleCheck as CheckCircle2, Clock, RefreshCw, Zap, Search, Terminal, Lock, Wifi, Database, Server } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThreatAlert {
  id: string;
  casino_id: string | null;
  alert_type: string;
  severity: string;
  title: string;
  description: string | null;
  affected_resource: string | null;
  actor_hash: string | null;
  ip_hash: string | null;
  status: string;
  auto_mitigated: boolean;
  acknowledged_at: string | null;
  resolved_at: string | null;
  created_at: string;
}

interface SecurityMetric {
  metric_name: string;
  metric_value: number;
  recorded_at: string;
}

interface Casino {
  id: string;
  name: string;
}

const SEVERITY_CONFIG: Record<string, { label: string; className: string; dotClass: string }> = {
  info: { label: 'Info', className: 'bg-blue-50 text-blue-700 border-blue-200', dotClass: 'bg-blue-500' },
  low: { label: 'Low', className: 'bg-slate-50 text-slate-600 border-slate-200', dotClass: 'bg-slate-400' },
  medium: { label: 'Medium', className: 'bg-amber-50 text-amber-700 border-amber-200', dotClass: 'bg-amber-500' },
  high: { label: 'High', className: 'bg-orange-50 text-orange-700 border-orange-200', dotClass: 'bg-orange-500' },
  critical: { label: 'Critical', className: 'bg-red-50 text-red-700 border-red-200', dotClass: 'bg-red-600' },
};

const STATUS_CONFIG: Record<string, string> = {
  open: 'bg-red-50 text-red-700 border-red-200',
  investigating: 'bg-amber-50 text-amber-700 border-amber-200',
  mitigated: 'bg-blue-50 text-blue-700 border-blue-200',
  closed: 'bg-green-50 text-green-700 border-green-200',
  false_positive: 'bg-slate-50 text-slate-500 border-slate-200',
};

const ALERT_TYPE_ICONS: Record<string, React.FC<{ className?: string }>> = {
  brute_force_attempt: Lock,
  api_key_abuse: Zap,
  unusual_login_location: Wifi,
  rate_limit_violation: Activity,
  privilege_escalation: ShieldAlert,
  data_export_anomaly: Database,
  session_hijack_attempt: Terminal,
  sql_injection_probe: Server,
  credential_stuffing: Lock,
  mass_data_access: Eye,
};

function formatAlertType(type: string) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function ThreatMonitoringPage() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<ThreatAlert[]>([]);
  const [metrics, setMetrics] = useState<SecurityMetric[]>([]);
  const [casinos, setCasinos] = useState<Casino[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<ThreatAlert | null>(null);
  const [activeTab, setActiveTab] = useState('alerts');

  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [casinoFilter, setCasinoFilter] = useState('all');
  const [search, setSearch] = useState('');

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);

    const [alertsRes, metricsRes, casinosRes] = await Promise.all([
      supabase.from('threat_alerts').select('*').order('created_at', { ascending: false }).limit(300),
      supabase.from('security_metrics').select('*').order('recorded_at', { ascending: false }).limit(360),
      supabase.from('casinos').select('id, name').eq('is_active', true).order('name'),
    ]);

    if (alertsRes.data) setAlerts(alertsRes.data);
    if (metricsRes.data) setMetrics(metricsRes.data);
    if (casinosRes.data) setCasinos(casinosRes.data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredAlerts = alerts.filter(a => {
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (casinoFilter !== 'all' && a.casino_id !== casinoFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!a.title.toLowerCase().includes(q) && !a.alert_type.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const openCritical = alerts.filter(a => a.severity === 'critical' && a.status === 'open').length;
  const openHigh = alerts.filter(a => a.severity === 'high' && a.status === 'open').length;
  const autoMitigated = alerts.filter(a => a.auto_mitigated).length;
  const last24h = alerts.filter(a => Date.now() - new Date(a.created_at).getTime() < 86400000).length;

  const chartData = (() => {
    const byDay: Record<string, { date: string; threats: number; resolved: number }> = {};
    const today = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' });
      byDay[key] = { date: key, threats: 0, resolved: 0 };
    }
    alerts.forEach(a => {
      const key = new Date(a.created_at).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' });
      if (byDay[key]) {
        byDay[key].threats++;
        if (a.status === 'closed' || a.status === 'mitigated') byDay[key].resolved++;
      }
    });
    return Object.values(byDay);
  })();

  const alertsByType = Object.entries(
    alerts.reduce((acc, a) => {
      acc[a.alert_type] = (acc[a.alert_type] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name: formatAlertType(name), count }));

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('threat_alerts').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    setSelectedAlert(null);
    loadData(true);
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-slate-700" />
              Threat Monitoring Engine
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Real-time threat detection and security anomaly management — ISO 27001 A.16 / SOC 2 CC7
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={refreshing} className="gap-2">
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        {openCritical > 0 && (
          <div className="bg-red-600 text-white rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <div>
              <span className="font-bold">{openCritical} critical alert{openCritical > 1 ? 's' : ''} require immediate attention.</span>
              <span className="ml-2 text-red-200">Review and action below.</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Critical Open', value: openCritical, className: 'text-red-700', bg: 'bg-red-50', icon: AlertCircle },
            { label: 'High Open', value: openHigh, className: 'text-orange-700', bg: 'bg-orange-50', icon: AlertTriangle },
            { label: 'Last 24 Hours', value: last24h, className: 'text-amber-700', bg: 'bg-amber-50', icon: Clock },
            { label: 'Auto-Mitigated', value: autoMitigated, className: 'text-emerald-700', bg: 'bg-emerald-50', icon: CheckCircle2 },
          ].map(card => (
            <Card key={card.label} className={cn('border', card.bg)}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn('p-2 rounded-lg bg-white shadow-sm', card.className)}>
                  <card.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className={cn('text-2xl font-bold', card.className)}>{card.value}</div>
                  <div className="text-xs text-slate-500">{card.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 w-full max-w-xl">
            <TabsTrigger value="alerts">Active Alerts</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="detections">Detection Rules</TabsTrigger>
          </TabsList>

          <TabsContent value="alerts" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input placeholder="Search alerts..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
                  </div>
                  <div className="flex gap-2">
                    <Select value={severityFilter} onValueChange={setSeverityFilter}>
                      <SelectTrigger className="h-9 w-32 text-xs"><SelectValue placeholder="Severity" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Severities</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="h-9 w-36 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="investigating">Investigating</SelectItem>
                        <SelectItem value="mitigated">Mitigated</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="w-24">Severity</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead className="w-36">Type</TableHead>
                      <TableHead className="w-24">Status</TableHead>
                      <TableHead className="w-28">Time</TableHead>
                      <TableHead className="w-24 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-400">Loading...</TableCell></TableRow>
                    ) : filteredAlerts.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-400">No alerts match your filters</TableCell></TableRow>
                    ) : filteredAlerts.map(alert => {
                      const sev = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.info;
                      const AlertIcon = ALERT_TYPE_ICONS[alert.alert_type] ?? Shield;
                      return (
                        <TableRow
                          key={alert.id}
                          className={cn('cursor-pointer hover:bg-slate-50 text-sm', alert.severity === 'critical' && alert.status === 'open' && 'bg-red-50/30')}
                          onClick={() => setSelectedAlert(alert)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className={cn('h-2 w-2 rounded-full', sev.dotClass)} />
                              <Badge variant="outline" className={cn('text-xs', sev.className)}>{sev.label}</Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-slate-800">{alert.title}</div>
                            {alert.affected_resource && (
                              <div className="text-xs text-slate-400 font-mono">{alert.affected_resource}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                              <AlertIcon className="h-3.5 w-3.5" />
                              {formatAlertType(alert.alert_type)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('text-xs capitalize', STATUS_CONFIG[alert.status])}>
                              {alert.status.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs text-slate-500">{timeAgo(alert.created_at)}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                              View <Eye className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <div className="px-4 py-2 bg-slate-50 border-t text-xs text-slate-400">
                  {filteredAlerts.length} of {alerts.length} alerts
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-slate-700">Threat Trend (14 Days)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <Tooltip contentStyle={{ fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Area type="monotone" dataKey="threats" stroke="#ef4444" fill="#fee2e2" name="Threats" />
                      <Area type="monotone" dataKey="resolved" stroke="#22c55e" fill="#dcfce7" name="Resolved" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-slate-700">Alerts by Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={alertsByType} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fill: '#64748b' }} width={120} />
                      <Tooltip contentStyle={{ fontSize: 12 }} />
                      <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-slate-700">Security KPIs (30 Days)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                    {(() => {
                      const latest: Record<string, number> = {};
                      metrics.forEach(m => { if (!latest[m.metric_name]) latest[m.metric_name] = m.metric_value; });
                      return [
                        { key: 'login_success_rate', label: 'Login Success', suffix: '%', good: true },
                        { key: 'failed_login_attempts', label: 'Failed Logins', suffix: '/day', good: false },
                        { key: 'api_auth_failures', label: 'API Auth Fails', suffix: '/day', good: false },
                        { key: 'threat_alerts_generated', label: 'Alerts/Day', suffix: '', good: false },
                        { key: 'mfa_verifications', label: 'MFA Checks', suffix: '/day', good: true },
                        { key: 'uptime_percent', label: 'Uptime', suffix: '%', good: true },
                      ].map(kpi => (
                        <div key={kpi.key} className="p-3 bg-slate-50 rounded-lg text-center">
                          <div className={cn('text-xl font-bold', kpi.good ? 'text-emerald-700' : 'text-slate-800')}>
                            {(latest[kpi.key] ?? 0).toFixed(kpi.key === 'uptime_percent' ? 2 : 0)}{kpi.suffix}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">{kpi.label}</div>
                        </div>
                      ));
                    })()}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="detections" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Automated Detection Rules</CardTitle>
                <CardDescription>Rules configured in the SafeBet IQ threat detection engine</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { name: 'Brute Force Detection', trigger: '5+ failed logins within 5 minutes', severity: 'high', action: 'Lock account + alert admin', status: 'active' },
                  { name: 'Credential Stuffing', trigger: '50+ unique password attempts from single IP', severity: 'critical', action: 'Block IP + notify security team', status: 'active' },
                  { name: 'Impossible Travel', trigger: 'Login from 2 locations >500km apart within 1 hour', severity: 'high', action: 'Force re-authentication', status: 'active' },
                  { name: 'API Abuse Detection', trigger: 'Endpoint hit >100 times/minute per API key', severity: 'medium', action: 'Rate limit + log event', status: 'active' },
                  { name: 'Mass Data Export', trigger: '>10,000 records exported in single session', severity: 'high', action: 'Suspend session + alert', status: 'active' },
                  { name: 'Privilege Escalation', trigger: 'Role change without admin approval', severity: 'critical', action: 'Block + immediate alert', status: 'active' },
                  { name: 'SQL Injection Probe', trigger: 'SQL keywords detected in API parameters', severity: 'critical', action: 'Block request + log evidence', status: 'active' },
                  { name: 'Session Replay Attack', trigger: 'Same JWT used from different IP/UA', severity: 'high', action: 'Invalidate session + alert', status: 'active' },
                  { name: 'Off-Hours Admin Access', trigger: 'Admin login 22:00–06:00 SAST', severity: 'medium', action: 'Log + notify compliance officer', status: 'active' },
                  { name: 'Unusual Geographic Access', trigger: 'Login from non-ZA/EU IP for ZA operators', severity: 'medium', action: 'Alert + require MFA re-verify', status: 'active' },
                ].map(rule => (
                  <div key={rule.name} className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg border">
                    <div className={cn('h-2 w-2 rounded-full mt-2 flex-shrink-0', {
                      'bg-red-600': rule.severity === 'critical',
                      'bg-orange-500': rule.severity === 'high',
                      'bg-amber-500': rule.severity === 'medium',
                    })} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm text-slate-800">{rule.name}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge variant="outline" className={cn('text-xs', {
                            'bg-red-50 text-red-700 border-red-200': rule.severity === 'critical',
                            'bg-orange-50 text-orange-700 border-orange-200': rule.severity === 'high',
                            'bg-amber-50 text-amber-700 border-amber-200': rule.severity === 'medium',
                          })}>{rule.severity}</Badge>
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                            <CheckCircle2 className="h-3 w-3 mr-1 inline" />Active
                          </Badge>
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        <span className="font-medium text-slate-600">Trigger:</span> {rule.trigger}
                      </div>
                      <div className="text-xs text-slate-500">
                        <span className="font-medium text-slate-600">Action:</span> {rule.action}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {selectedAlert && (
        <Dialog open={!!selectedAlert} onOpenChange={() => setSelectedAlert(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-orange-600" />
                Alert Detail
              </DialogTitle>
              <DialogDescription>ID: <code className="text-xs">{selectedAlert.id}</code></DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><div className="text-xs text-slate-500 uppercase mb-1">Severity</div>
                  <Badge variant="outline" className={cn('text-xs', SEVERITY_CONFIG[selectedAlert.severity]?.className)}>{selectedAlert.severity}</Badge>
                </div>
                <div><div className="text-xs text-slate-500 uppercase mb-1">Status</div>
                  <Badge variant="outline" className={cn('text-xs capitalize', STATUS_CONFIG[selectedAlert.status])}>{selectedAlert.status.replace(/_/g, ' ')}</Badge>
                </div>
                <div className="col-span-2"><div className="text-xs text-slate-500 uppercase mb-1">Title</div>
                  <div className="font-medium">{selectedAlert.title}</div>
                </div>
                {selectedAlert.affected_resource && (
                  <div className="col-span-2"><div className="text-xs text-slate-500 uppercase mb-1">Affected Resource</div>
                    <code className="text-xs bg-slate-100 px-2 py-0.5 rounded">{selectedAlert.affected_resource}</code>
                  </div>
                )}
                {selectedAlert.description && (
                  <div className="col-span-2"><div className="text-xs text-slate-500 uppercase mb-1">Description</div>
                    <div className="text-slate-600">{selectedAlert.description}</div>
                  </div>
                )}
                {selectedAlert.actor_hash && (
                  <div><div className="text-xs text-slate-500 uppercase mb-1">Actor Hash</div>
                    <div className="text-xs font-mono truncate">{selectedAlert.actor_hash.slice(0, 20)}...</div>
                  </div>
                )}
                {selectedAlert.ip_hash && (
                  <div><div className="text-xs text-slate-500 uppercase mb-1">IP Hash</div>
                    <div className="text-xs font-mono truncate">{selectedAlert.ip_hash.slice(0, 20)}...</div>
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-2 border-t flex-wrap">
                {selectedAlert.status === 'open' && (
                  <Button size="sm" variant="outline" onClick={() => updateStatus(selectedAlert.id, 'investigating')} className="text-amber-700 border-amber-200 bg-amber-50">
                    Start Investigation
                  </Button>
                )}
                {(selectedAlert.status === 'open' || selectedAlert.status === 'investigating') && (
                  <Button size="sm" variant="outline" onClick={() => updateStatus(selectedAlert.id, 'mitigated')} className="text-blue-700 border-blue-200 bg-blue-50">
                    Mark Mitigated
                  </Button>
                )}
                {selectedAlert.status !== 'closed' && selectedAlert.status !== 'false_positive' && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => updateStatus(selectedAlert.id, 'closed')} className="text-green-700 border-green-200 bg-green-50">
                      Close
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => updateStatus(selectedAlert.id, 'false_positive')} className="text-slate-600 border-slate-200">
                      False Positive
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}
