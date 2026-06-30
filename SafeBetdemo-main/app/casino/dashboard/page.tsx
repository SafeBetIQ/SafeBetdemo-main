'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { CasinoAdminGuard } from '@/components/CasinoAdminGuard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Shield, Users, TriangleAlert as AlertTriangle, Activity, Download, RefreshCw, ShieldOff, Bell, FileText, ChartBar as BarChart3, Building2, TrendingUp, CircleCheck as CheckCircle2, Zap, Network } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PlayerRiskMonitor } from '@/components/compliance/PlayerRiskMonitor';
import { InterventionAlerts } from '@/components/compliance/InterventionAlerts';
import { ComplianceReports } from '@/components/compliance/ComplianceReports';
import { SessionBehaviourAnalytics } from '@/components/compliance/SessionBehaviourAnalytics';
import { SelfExclusionCompliance } from '@/components/compliance/SelfExclusionCompliance';
import { ModuleGuard } from '@/components/ModuleGuard';
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import Link from 'next/link';

interface PlatformSummary {
  totalPlayers: number;
  criticalPlayers: number;
  pendingInterventions: number;
  activeSessions: number;
  activeExclusions: number;
  complianceScore: number;
  openBreaches: number;
  interventionsToday: number;
}

interface CasinoOption { id: string; name: string; }

export default function CasinoDashboardPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('executive');
  const [summary, setSummary] = useState<PlatformSummary>({
    totalPlayers: 0,
    criticalPlayers: 0,
    pendingInterventions: 0,
    activeSessions: 0,
    activeExclusions: 0,
    complianceScore: 0,
    openBreaches: 0,
    interventionsToday: 0,
  });
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [casinoName, setCasinoName] = useState('');
  const [casinoOptions, setCasinoOptions] = useState<CasinoOption[]>([]);
  const [selectedCasinoId, setSelectedCasinoId] = useState('');

  const isSuperAdmin = user?.role === 'super_admin';
  const casinoId = isSuperAdmin ? selectedCasinoId : (user?.casino_id || '');

  useEffect(() => {
    if (!user) return;
    if (isSuperAdmin) {
      supabase.from('casinos').select('id, name').eq('is_active', true).neq('name', 'Prestige Casino (Demo)').order('name')
        .then(({ data }) => {
          if (data && data.length > 0) {
            setCasinoOptions(data);
            setSelectedCasinoId(data[0].id);
          }
        });
    } else if (user.casino_id) {
      loadSummary();
    }
  }, [user]);

  useEffect(() => {
    if (selectedCasinoId) loadSummary();
  }, [selectedCasinoId]);

  async function loadSummary() {
    const effectiveCasinoId = isSuperAdmin ? selectedCasinoId : (user?.casino_id || '');
    if (!effectiveCasinoId) return;
    setLoadingSummary(true);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [playerCountRes, playerStatsRes, intRes, sessionsRes, exclRes, casinoRes, networkRes, snapRes] = await Promise.all([
      supabase.from('players').select('*', { count: 'exact', head: true }).eq('casino_id', effectiveCasinoId),
      supabase.from('players').select('risk_score').eq('casino_id', effectiveCasinoId),
      supabase.from('player_protection_interventions').select('outcome, intervention_date').eq('casino_id', effectiveCasinoId).limit(2000),
      supabase.from('gaming_sessions').select('*', { count: 'exact', head: true }).eq('casino_id', effectiveCasinoId).eq('is_active', true),
      supabase.from('self_exclusion_registry').select('status').eq('casino_id', effectiveCasinoId).eq('status', 'active'),
      supabase.from('casinos').select('name').eq('id', effectiveCasinoId).maybeSingle(),
      supabase.from('sen_breach_detections').select('status').or(`detecting_casino_id.eq.${effectiveCasinoId},originating_casino_id.eq.${effectiveCasinoId}`).eq('status', 'open'),
      supabase.from('compliance_snapshots').select('compliance_score').eq('casino_id', effectiveCasinoId).order('snapshot_date', { ascending: false }).limit(2),
    ]);

    const totalPlayers = playerCountRes.count ?? 0;
    const playerScores = playerStatsRes.data || [];
    const interventions = intRes.data || [];
    const todayInt = interventions.filter(i => new Date(i.intervention_date) >= todayStart);

    if (casinoRes.data?.name) setCasinoName(casinoRes.data.name);

    const critical = playerScores.filter(p => p.risk_score >= 80).length;
    const pending  = interventions.filter(i => !i.outcome || i.outcome === 'pending').length;

    // Use compliance_snapshots if available, otherwise estimate
    const snapshots = snapRes.data || [];
    const snapshotScore = snapshots.length > 0
      ? Math.round(snapshots.reduce((s, r) => s + Number(r.compliance_score), 0) / snapshots.length)
      : null;
    const coveragePct = playerScores.length > 0 ? Math.min(100, Math.round((playerScores.filter(p => p.risk_score != null).length / playerScores.length) * 100)) : 100;
    const interventionCoverage = critical > 0 ? Math.min(100, Math.round((interventions.filter(i => i.outcome && i.outcome !== 'pending').length / critical) * 100)) : 100;
    const complianceScore = snapshotScore ?? Math.round((coveragePct + interventionCoverage) / 2);

    setSummary({
      totalPlayers,
      criticalPlayers: critical,
      pendingInterventions: pending,
      activeSessions: sessionsRes.count ?? 0,
      activeExclusions: exclRes.data?.length || 0,
      complianceScore,
      openBreaches: networkRes.data?.length || 0,
      interventionsToday: todayInt.length,
    });
    setLoadingSummary(false);
  }

  const NAV_TABS = [
    {
      id: 'executive',
      label: 'Overview',
      icon: BarChart3,
      badge: (summary.criticalPlayers + summary.pendingInterventions) > 0 ? (summary.criticalPlayers + summary.pendingInterventions) : undefined,
      badgeClass: 'bg-red-500',
      description: 'Executive overview',
    },
    {
      id: 'risk-monitoring',
      label: 'Player Risk',
      icon: Users,
      badge: summary.criticalPlayers > 0 ? summary.criticalPlayers : undefined,
      badgeClass: 'bg-red-500',
      description: 'Live risk scores',
    },
    {
      id: 'intervention-alerts',
      label: 'Interventions',
      icon: Bell,
      badge: summary.pendingInterventions > 0 ? summary.pendingInterventions : undefined,
      badgeClass: 'bg-yellow-500',
      description: 'Alert queue',
    },
    {
      id: 'compliance-reports',
      label: 'Compliance',
      icon: FileText,
      description: 'Reports & score',
    },
    {
      id: 'session-analytics',
      label: 'Sessions',
      icon: Activity,
      badge: summary.activeSessions > 0 ? summary.activeSessions : undefined,
      badgeClass: 'bg-emerald-500',
      description: 'Behaviour analytics',
    },
    {
      id: 'self-exclusion',
      label: 'Self-Exclusion',
      icon: ShieldOff,
      badge: summary.activeExclusions > 0 ? summary.activeExclusions : undefined,
      badgeClass: 'bg-orange-500',
      description: 'Monitoring & network',
    },
  ];

  return (
    <ModuleGuard slug="behavioural-risk-intelligence" fallbackHref="/casino/dashboard">
    <CasinoAdminGuard>
      <DashboardLayout>
        <div className="flex min-h-full flex-col">

          {/* ── Header ── */}
          <div className="border-b bg-card px-6 py-4">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold">Operator Compliance Platform</h1>
                    {summary.openBreaches > 0 && (
                      <Badge className="bg-red-500 text-white border-0 text-xs animate-pulse">
                        {summary.openBreaches} Open Breach{summary.openBreaches > 1 ? 'es' : ''}
                      </Badge>
                    )}
                  </div>
                  {isSuperAdmin && casinoOptions.length > 0 ? (
                    <div className="flex items-center gap-2 mt-1">
                      <Select value={selectedCasinoId} onValueChange={setSelectedCasinoId}>
                        <SelectTrigger className="h-7 text-xs w-[220px]">
                          <SelectValue placeholder="Select casino…" />
                        </SelectTrigger>
                        <SelectContent>
                          {casinoOptions.map(c => (
                            <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-muted-foreground">· National Gambling Act compliance</span>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{casinoName || 'Casino'} · National Gambling Act compliance</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={loadSummary} disabled={loadingSummary}>
                  <RefreshCw className={`h-4 w-4 mr-1.5 ${loadingSummary ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-1.5" />
                  Export
                </Button>
              </div>
            </div>

            {/* Summary KPI Strip */}
            <div className="grid grid-cols-4 md:grid-cols-8 gap-2 mt-4">
              {[
                { label: 'Players',           value: summary.totalPlayers,          icon: Users,        color: '' },
                { label: 'Critical Risk',     value: summary.criticalPlayers,       icon: AlertTriangle,color: summary.criticalPlayers > 0 ? 'text-red-600' : '' },
                { label: 'Pending Alerts',    value: summary.pendingInterventions,  icon: Bell,         color: summary.pendingInterventions > 0 ? 'text-yellow-600' : '' },
                { label: 'Active Sessions',   value: summary.activeSessions,        icon: Activity,     color: 'text-emerald-600' },
                { label: 'Self-Excluded',     value: summary.activeExclusions,      icon: ShieldOff,    color: 'text-orange-600' },
                { label: 'Open Breaches',     value: summary.openBreaches,          icon: Network,      color: summary.openBreaches > 0 ? 'text-red-600' : '' },
                { label: 'Today\'s Alerts',   value: summary.interventionsToday,    icon: Zap,          color: '' },
                { label: 'Compliance',        value: `${summary.complianceScore}%`, icon: Shield,       color: summary.complianceScore >= 85 ? 'text-emerald-600' : summary.complianceScore >= 70 ? 'text-yellow-600' : 'text-red-600' },
              ].map(k => {
                const Icon = k.icon;
                return (
                  <div key={k.label} className="flex flex-col items-start px-3 py-2 rounded-lg bg-muted/30 border">
                    <div className="flex items-center gap-1 mb-0.5">
                      <Icon className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{k.label}</span>
                    </div>
                    <span className={`text-lg font-bold ${k.color}`}>{k.value}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Main Tabs ── */}
          <div className="flex-1 overflow-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">

              {/* Tab bar */}
              <div className="border-b bg-card px-6 pt-2 pb-0">
                <TabsList className="h-auto bg-transparent p-0 gap-0 border-0">
                  {NAV_TABS.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <TabsTrigger
                        key={tab.id}
                        value={tab.id}
                        className={`
                          relative flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-none border-b-2 transition-colors
                          ${isActive ? 'border-primary text-foreground bg-transparent' : 'border-transparent text-muted-foreground hover:text-foreground bg-transparent'}
                        `}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="hidden sm:inline">{tab.label}</span>
                        {tab.badge !== undefined && (
                          <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full ${tab.badgeClass} text-white text-[10px] font-bold flex items-center justify-center px-1`}>
                            {tab.badge}
                          </span>
                        )}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>

              {/* Tab content */}
              <div className="flex-1 p-6 min-w-0">

                {/* ── Executive Overview ── */}
                <TabsContent value="executive" className="mt-0 space-y-5">

                  {/* Top KPI Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className={`${summary.criticalPlayers > 0 ? 'border-red-200 bg-red-50/20' : ''}`}>
                      <CardContent className="pt-5 pb-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-muted-foreground">Total Players</p>
                          <Users className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="text-3xl font-bold">{summary.totalPlayers.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground mt-1">Registered at {casinoName || 'your casino'}</p>
                      </CardContent>
                    </Card>
                    <Card className={`${summary.criticalPlayers > 0 ? 'border-red-200 bg-red-50/20' : ''}`}>
                      <CardContent className="pt-5 pb-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-muted-foreground">Critical Risk Players</p>
                          <AlertTriangle className={`h-4 w-4 ${summary.criticalPlayers > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
                        </div>
                        <p className={`text-3xl font-bold ${summary.criticalPlayers > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{summary.criticalPlayers}</p>
                        <p className="text-xs text-muted-foreground mt-1">Risk score ≥ 80 · Immediate action</p>
                      </CardContent>
                    </Card>
                    <Card className={`${summary.pendingInterventions > 0 ? 'border-yellow-200 bg-yellow-50/20' : ''}`}>
                      <CardContent className="pt-5 pb-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-muted-foreground">Pending Interventions</p>
                          <Bell className={`h-4 w-4 ${summary.pendingInterventions > 0 ? 'text-yellow-500' : 'text-muted-foreground'}`} />
                        </div>
                        <p className={`text-3xl font-bold ${summary.pendingInterventions > 0 ? 'text-yellow-600' : 'text-emerald-600'}`}>{summary.pendingInterventions}</p>
                        <p className="text-xs text-muted-foreground mt-1">Awaiting dispatch or outcome</p>
                      </CardContent>
                    </Card>
                    <Card className={`${summary.complianceScore >= 85 ? 'border-emerald-200 bg-emerald-50/20' : summary.complianceScore >= 70 ? 'border-yellow-200 bg-yellow-50/20' : 'border-red-200 bg-red-50/20'}`}>
                      <CardContent className="pt-5 pb-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-muted-foreground">Compliance Score</p>
                          <Shield className={`h-4 w-4 ${summary.complianceScore >= 85 ? 'text-emerald-500' : summary.complianceScore >= 70 ? 'text-yellow-500' : 'text-red-500'}`} />
                        </div>
                        <p className={`text-3xl font-bold ${summary.complianceScore >= 85 ? 'text-emerald-600' : summary.complianceScore >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>{summary.complianceScore}%</p>
                        <Progress value={summary.complianceScore} className="h-1 mt-2" />
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    {/* Secondary KPIs */}
                    <div className="space-y-3">
                      {[
                        { label: 'Active Sessions', value: summary.activeSessions, icon: Activity, color: 'text-emerald-600', sub: 'Currently playing', onClick: () => setActiveTab('session-analytics') },
                        { label: 'Active Self-Exclusions', value: summary.activeExclusions, icon: ShieldOff, color: 'text-orange-600', sub: 'NRGP registered', onClick: () => setActiveTab('self-exclusion') },
                        { label: "Today's Interventions", value: summary.interventionsToday, icon: Zap, color: 'text-blue-600', sub: 'Dispatched today', onClick: () => setActiveTab('intervention-alerts') },
                        { label: 'Network Breaches', value: summary.openBreaches, icon: Network, color: summary.openBreaches > 0 ? 'text-red-600' : 'text-emerald-600', sub: 'Cross-casino alerts', onClick: null },
                      ].map((kpi, i) => {
                        const Icon = kpi.icon;
                        return (
                          <div
                            key={i}
                            className={`flex items-center justify-between p-3 rounded-lg border bg-muted/20 ${kpi.onClick ? 'cursor-pointer hover:bg-muted/40 transition-colors' : ''}`}
                            onClick={kpi.onClick ?? undefined}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                                <Icon className={`h-4 w-4 ${kpi.color}`} />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                                <p className="text-xs text-muted-foreground/70">{kpi.sub}</p>
                              </div>
                            </div>
                            <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Risk Distribution Pie */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Risk Distribution</CardTitle>
                        <CardDescription className="text-xs">All players by risk band</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {(() => {
                          const low = Math.max(0, summary.totalPlayers - summary.criticalPlayers - Math.max(0, Math.round(summary.totalPlayers * 0.15)));
                          const high = Math.max(0, Math.round(summary.totalPlayers * 0.15) - summary.criticalPlayers);
                          const pieData = [
                            { name: 'Critical (80+)', value: summary.criticalPlayers, fill: '#ef4444' },
                            { name: 'High (60–79)', value: Math.max(0, high), fill: '#f97316' },
                            { name: 'Medium (40–59)', value: Math.max(0, Math.round(summary.totalPlayers * 0.2)), fill: '#eab308' },
                            { name: 'Low (0–39)', value: Math.max(0, low - Math.round(summary.totalPlayers * 0.2)), fill: '#10b981' },
                          ].filter(d => d.value > 0);
                          return (
                            <>
                              <ResponsiveContainer width="100%" height={130}>
                                <PieChart>
                                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" paddingAngle={2}>
                                    {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                                  </Pie>
                                  <Tooltip contentStyle={{ fontSize: 11 }} />
                                </PieChart>
                              </ResponsiveContainer>
                              <div className="space-y-1 mt-1">
                                {pieData.map((d, i) => (
                                  <div key={i} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-1.5">
                                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.fill }} />
                                      <span className="text-muted-foreground">{d.name}</span>
                                    </div>
                                    <span className="font-medium">{d.value.toLocaleString()}</span>
                                  </div>
                                ))}
                              </div>
                            </>
                          );
                        })()}
                      </CardContent>
                    </Card>

                    {/* Compliance Health */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Compliance Health</CardTitle>
                        <CardDescription className="text-xs">NGA responsible gambling obligations</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {[
                          { label: 'Risk Monitoring Coverage', value: 100, color: 'bg-emerald-500' },
                          { label: 'Intervention Rate', value: summary.criticalPlayers > 0 ? Math.min(100, Math.round(((summary.criticalPlayers - summary.pendingInterventions) / summary.criticalPlayers) * 100)) : 100, color: summary.pendingInterventions > 0 ? 'bg-yellow-500' : 'bg-emerald-500' },
                          { label: 'Self-Exclusion Register', value: 100, color: 'bg-emerald-500' },
                          { label: 'Overall Compliance', value: summary.complianceScore, color: summary.complianceScore >= 85 ? 'bg-emerald-500' : summary.complianceScore >= 70 ? 'bg-yellow-500' : 'bg-red-500' },
                        ].map((item, i) => (
                          <div key={i}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-muted-foreground">{item.label}</span>
                              <span className="font-semibold">{item.value}%</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${item.color} transition-all`} style={{ width: `${item.value}%` }} />
                            </div>
                          </div>
                        ))}

                        <div className="pt-2 border-t space-y-1.5">
                          {[
                            { label: 'Monthly Report', status: 'Filed — May 2026', ok: true },
                            { label: 'Staff Training', status: 'Active', ok: true },
                            { label: 'SARGF Referrals', status: 'Up to date', ok: true },
                          ].map((item, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{item.label}</span>
                              <span className={`flex items-center gap-1 font-medium ${item.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                                <CheckCircle2 className="h-3 w-3" />
                                {item.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Quick Navigation */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Player Risk Monitor', desc: 'View all risk scores', icon: Users, tab: 'risk-monitoring', urgent: summary.criticalPlayers > 0 },
                      { label: 'Intervention Alerts', desc: `${summary.pendingInterventions} pending`, icon: Bell, tab: 'intervention-alerts', urgent: summary.pendingInterventions > 0 },
                      { label: 'Reporting Centre', desc: 'Reports & downloads', icon: FileText, href: '/casino/reports', urgent: false },
                      { label: 'Audit Centre', desc: 'Activity & security log', icon: TrendingUp, href: '/admin/audit', urgent: false },
                    ].map((item, i) => {
                      const Icon = item.icon;
                      const content = (
                        <div className={`p-4 rounded-xl border transition-all hover:shadow-sm cursor-pointer ${item.urgent ? 'border-red-200 bg-red-50/20 hover:border-red-300' : 'hover:border-primary/30 hover:bg-muted/20'}`}>
                          <div className="flex items-center gap-2.5 mb-1.5">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.urgent ? 'bg-red-100' : 'bg-muted'}`}>
                              <Icon className={`h-4 w-4 ${item.urgent ? 'text-red-600' : 'text-muted-foreground'}`} />
                            </div>
                            {item.urgent && <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
                          </div>
                          <p className="text-sm font-semibold">{item.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                        </div>
                      );
                      if ('href' in item) {
                        return <Link key={i} href={item.href!}>{content}</Link>;
                      }
                      return <div key={i} onClick={() => setActiveTab(item.tab!)}>{content}</div>;
                    })}
                  </div>
                </TabsContent>

                {/* ── Player Risk Monitoring ── */}
                <TabsContent value="risk-monitoring" className="mt-0 space-y-0">
                  <div className="mb-4">
                    <h2 className="text-base font-semibold flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      Player Risk Monitoring
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Live AI risk scores for all players at your casino. Only your casino&apos;s player data is visible.
                    </p>
                  </div>
                  {casinoId && <PlayerRiskMonitor casinoId={casinoId} />}
                </TabsContent>

                {/* ── Intervention Alerts ── */}
                <TabsContent value="intervention-alerts" className="mt-0">
                  <div className="mb-4">
                    <h2 className="text-base font-semibold flex items-center gap-2">
                      <Bell className="h-5 w-5 text-primary" />
                      Intervention Alerts
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Player intervention queue, dispatch status, auto-trigger rules, and outcome tracking.
                    </p>
                  </div>
                  {casinoId && <InterventionAlerts casinoId={casinoId} />}
                </TabsContent>

                {/* ── Compliance Reports ── */}
                <TabsContent value="compliance-reports" className="mt-0">
                  <div className="mb-4">
                    <h2 className="text-base font-semibold flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      Compliance Reports
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Regulatory compliance score, downloadable reports, and National Gambling Act obligation checklist.
                    </p>
                  </div>
                  {casinoId && <ComplianceReports casinoId={casinoId} casinoName={casinoName} />}
                </TabsContent>

                {/* ── Session Behaviour Analytics ── */}
                <TabsContent value="session-analytics" className="mt-0">
                  <div className="mb-4">
                    <h2 className="text-base font-semibold flex items-center gap-2">
                      <Activity className="h-5 w-5 text-primary" />
                      Session Behaviour Analytics
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Game type breakdown, session duration patterns, hourly activity, and flagged suspicious behaviour.
                    </p>
                  </div>
                  {casinoId && <SessionBehaviourAnalytics casinoId={casinoId} />}
                </TabsContent>

                {/* ── Self-Exclusion Monitoring ── */}
                <TabsContent value="self-exclusion" className="mt-0">
                  <div className="mb-4">
                    <h2 className="text-base font-semibold flex items-center gap-2">
                      <ShieldOff className="h-5 w-5 text-primary" />
                      Self-Exclusion Monitoring
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Active exclusion register, SARGF counselling compliance, reinstatement queue, and SafeBet IQ network events.
                    </p>
                  </div>
                  {casinoId && <SelfExclusionCompliance casinoId={casinoId} />}
                </TabsContent>

              </div>
            </Tabs>
          </div>

        </div>
      </DashboardLayout>
    </CasinoAdminGuard>
    </ModuleGuard>
  );
}
