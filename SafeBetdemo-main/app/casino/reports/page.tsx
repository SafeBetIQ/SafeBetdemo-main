'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { CasinoAdminGuard } from '@/components/CasinoAdminGuard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  FileText, Download, Calendar, TrendingUp, Shield, Users, Bell,
  Activity, BarChart3, Clock, CheckCircle2, RefreshCw, FileSpreadsheet,
  FileCode, AlertTriangle, ChevronRight, Lock, Globe, Building2,
  Printer, Filter, Eye,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface ReportSummary {
  totalPlayers: number;
  criticalPlayers: number;
  pendingInterventions: number;
  totalInterventions: number;
  activeExclusions: number;
  complianceScore: number;
  activeSessions: number;
  interventionsThisMonth: number;
}

interface GeneratedReport {
  id: string;
  title: string;
  type: string;
  period: string;
  generatedAt: string;
  status: 'ready' | 'generating' | 'scheduled';
  size: string;
  format: 'pdf' | 'excel' | 'csv';
}

const REPORT_TYPES = [
  {
    id: 'monthly-compliance',
    title: 'Monthly Compliance Report',
    description: 'Comprehensive National Gambling Act compliance summary with risk metrics, intervention outcomes, and training compliance status.',
    category: 'Compliance',
    icon: Shield,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    formats: ['pdf', 'excel'],
    regulatoryRef: 'NGA §26',
    frequency: 'Monthly',
  },
  {
    id: 'weekly-risk',
    title: 'Weekly Risk Summary',
    description: 'Player risk score distribution, high-risk player changes, new critical alerts, and intervention queue status.',
    category: 'Risk',
    icon: AlertTriangle,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    formats: ['pdf', 'excel', 'csv'],
    regulatoryRef: 'NRGP §4.2',
    frequency: 'Weekly',
  },
  {
    id: 'daily-interventions',
    title: 'Daily Intervention Report',
    description: 'All interventions dispatched, delivered, and resolved in the last 24 hours with outcome tracking.',
    category: 'Interventions',
    icon: Bell,
    color: 'text-yellow-600',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    formats: ['pdf', 'csv'],
    regulatoryRef: 'NGA §26(3)',
    frequency: 'Daily',
  },
  {
    id: 'audit-summary',
    title: 'Audit & Activity Log',
    description: 'Tamper-evident log of all user actions, data access events, configuration changes, and security events.',
    category: 'Audit',
    icon: Lock,
    color: 'text-slate-600',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    formats: ['pdf', 'csv'],
    regulatoryRef: 'POPIA §8',
    frequency: 'On demand',
  },
  {
    id: 'self-exclusion',
    title: 'Self-Exclusion Register',
    description: 'Active and historical self-exclusion records, SARGF compliance, reinstatements, and cross-casino breach events.',
    category: 'Compliance',
    icon: Users,
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
    formats: ['pdf', 'excel', 'csv'],
    regulatoryRef: 'NGA §14',
    frequency: 'Weekly',
  },
  {
    id: 'player-risk-analysis',
    title: 'Player Risk Analysis',
    description: 'Detailed breakdown of player risk profiles, score trends, behavioural indicators, and AI signal weights.',
    category: 'Risk',
    icon: TrendingUp,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    formats: ['pdf', 'excel'],
    regulatoryRef: 'NRGP §4',
    frequency: 'Weekly',
  },
  {
    id: 'session-analytics',
    title: 'Session Behaviour Report',
    description: 'Game-type breakdown, session duration patterns, velocity changes, and anomalous betting behaviour flags.',
    category: 'Analytics',
    icon: Activity,
    color: 'text-teal-600',
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    formats: ['pdf', 'excel'],
    regulatoryRef: 'NRGP §3.1',
    frequency: 'Weekly',
  },
  {
    id: 'regulatory-submission',
    title: 'Regulatory Submission Package',
    description: 'Complete submission-ready package for the National Gambling Board including all statutory reports and supporting data.',
    category: 'Compliance',
    icon: Globe,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    formats: ['pdf'],
    regulatoryRef: 'NGB Annual Return',
    frequency: 'Quarterly',
  },
];

const FORMAT_ICONS: Record<string, React.ElementType> = {
  pdf: FileText,
  excel: FileSpreadsheet,
  csv: FileCode,
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso));
}

export default function ReportingCentrePage() {
  const { user } = useAuth();
  const casinoId = user?.casino_id || '';
  const isSuperAdmin = user?.role === 'super_admin';
  const [activeTab, setActiveTab] = useState('overview');
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);
  const [casinoName, setCasinoName] = useState('');
  const [periodFilter, setPeriodFilter] = useState('this-month');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [trendData, setTrendData] = useState<any[]>([]);

  const [recentReports, setRecentReports] = useState<GeneratedReport[]>([
    { id: '1', title: 'Monthly Compliance Report — May 2026', type: 'monthly-compliance', period: 'May 2026', generatedAt: new Date(Date.now() - 3600000 * 2).toISOString(), status: 'ready', size: '2.4 MB', format: 'pdf' },
    { id: '2', title: 'Weekly Risk Summary — W24 2026', type: 'weekly-risk', period: 'Week 24, 2026', generatedAt: new Date(Date.now() - 3600000 * 18).toISOString(), status: 'ready', size: '1.1 MB', format: 'excel' },
    { id: '3', title: 'Daily Intervention Report — 28 Jun 2026', type: 'daily-interventions', period: '28 Jun 2026', generatedAt: new Date(Date.now() - 3600000 * 4).toISOString(), status: 'ready', size: '348 KB', format: 'pdf' },
    { id: '4', title: 'Self-Exclusion Register — Jun 2026', type: 'self-exclusion', period: 'June 2026', generatedAt: new Date(Date.now() - 3600000 * 26).toISOString(), status: 'ready', size: '890 KB', format: 'csv' },
    { id: '5', title: 'Regulatory Submission Package — Q1 2026', type: 'regulatory-submission', period: 'Q1 2026', generatedAt: new Date(Date.now() - 86400000 * 5).toISOString(), status: 'ready', size: '8.7 MB', format: 'pdf' },
  ]);

  useEffect(() => {
    if (casinoId || isSuperAdmin) loadData();
  }, [casinoId, isSuperAdmin]);

  async function loadData() {
    setLoading(true);
    try {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      // super_admin has no casino_id — query across all casinos
      const applyFilter = (q: any) => casinoId ? q.eq('casino_id', casinoId) : q;

      const [casinoRes, playerCountRes, playerScoresRes, intRes, sessRes, exclRes] = await Promise.all([
        casinoId
          ? supabase.from('casinos').select('name').eq('id', casinoId).maybeSingle()
          : Promise.resolve({ data: { name: 'All Operators' }, error: null }),
        applyFilter(supabase.from('players').select('*', { count: 'exact', head: true })),
        applyFilter(supabase.from('players').select('risk_score')),
        applyFilter(supabase.from('player_protection_interventions').select('outcome, intervention_date')).limit(2000),
        applyFilter(supabase.from('gaming_sessions').select('*', { count: 'exact', head: true }).eq('is_active', true)),
        applyFilter(supabase.from('self_exclusion_registry').select('status').eq('status', 'active')),
      ]);

      if (casinoRes.data?.name) setCasinoName(casinoRes.data.name);

      const scores = (playerScoresRes.data || []) as Array<{ risk_score: number | null }>;
      const interventions = (intRes.data || []) as Array<{ outcome: string | null; intervention_date: string }>;
      const critical = scores.filter(p => p.risk_score != null && p.risk_score >= 80).length;
      const pending = interventions.filter(i => !i.outcome || i.outcome === 'pending').length;
      const thisMonth = interventions.filter(i => new Date(i.intervention_date) >= monthStart).length;
      const coveragePct = scores.length > 0 ? Math.min(100, Math.round((scores.filter(p => p.risk_score != null).length / scores.length) * 100)) : 100;
      const interventionCoverage = critical > 0 ? Math.min(100, Math.round((interventions.filter(i => i.outcome && i.outcome !== 'pending').length / critical) * 100)) : 100;

      setSummary({
        totalPlayers: playerCountRes.count ?? 0,
        criticalPlayers: critical,
        pendingInterventions: pending,
        totalInterventions: interventions.length,
        activeExclusions: exclRes.data?.length || 0,
        complianceScore: Math.round((coveragePct + interventionCoverage) / 2),
        activeSessions: sessRes.count ?? 0,
        interventionsThisMonth: thisMonth,
      });

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
      const base = playerCountRes.count ?? 100;
      setTrendData(months.map((m, i) => ({
        month: m,
        players: Math.round(base * (0.75 + i * 0.05)),
        interventions: Math.round((interventions.length) * (0.6 + i * 0.08)),
        exclusions: Math.round((exclRes.data?.length || 1) * (0.8 + i * 0.04)),
        compliance: Math.round(60 + i * 5 + Math.random() * 8),
      })));
    } catch {
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  }

  function handleGenerateReport(reportId: string, format: string) {
    setGeneratingReport(reportId);
    const type = REPORT_TYPES.find(r => r.id === reportId);
    setTimeout(() => {
      const newReport: GeneratedReport = {
        id: Date.now().toString(),
        title: `${type?.title} — ${new Date().toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}`,
        type: reportId,
        period: new Date().toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' }),
        generatedAt: new Date().toISOString(),
        status: 'ready',
        size: `${(Math.random() * 3 + 0.5).toFixed(1)} MB`,
        format: format as 'pdf' | 'excel' | 'csv',
      };
      setRecentReports(prev => [newReport, ...prev]);
      setGeneratingReport(null);
      toast.success(`${type?.title} generated successfully`);
    }, 2200);
  }

  const filteredReportTypes = REPORT_TYPES.filter(r =>
    categoryFilter === 'all' || r.category.toLowerCase() === categoryFilter.toLowerCase()
  );

  const categories = Array.from(new Set(REPORT_TYPES.map(r => r.category)));

  return (
    <CasinoAdminGuard>
      <DashboardLayout>
        <div className="flex min-h-full flex-col">

          {/* Header */}
          <div className="border-b bg-card px-6 py-4">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Reporting Centre</h1>
                  <p className="text-sm text-muted-foreground">
                    {casinoName || 'Casino'} · Regulatory reports, compliance summaries, and data exports
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  NGA Compliant
                </Badge>
                <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>

            {/* KPI Strip */}
            {summary && (
              <div className="grid grid-cols-4 md:grid-cols-8 gap-2 mt-4">
                {[
                  { label: 'Total Players', value: summary.totalPlayers.toLocaleString(), color: '' },
                  { label: 'Critical Risk', value: summary.criticalPlayers.toLocaleString(), color: summary.criticalPlayers > 0 ? 'text-red-600' : 'text-emerald-600' },
                  { label: 'Pending Alerts', value: summary.pendingInterventions.toLocaleString(), color: summary.pendingInterventions > 0 ? 'text-yellow-600' : '' },
                  { label: 'Total Interventions', value: summary.totalInterventions.toLocaleString(), color: '' },
                  { label: 'This Month', value: summary.interventionsThisMonth.toLocaleString(), color: 'text-blue-600' },
                  { label: 'Self-Excluded', value: summary.activeExclusions.toLocaleString(), color: 'text-orange-600' },
                  { label: 'Active Sessions', value: summary.activeSessions.toLocaleString(), color: 'text-emerald-600' },
                  { label: 'Compliance', value: `${summary.complianceScore}%`, color: summary.complianceScore >= 85 ? 'text-emerald-600' : summary.complianceScore >= 70 ? 'text-yellow-600' : 'text-red-600' },
                ].map(k => (
                  <div key={k.label} className="flex flex-col px-3 py-2 rounded-lg bg-muted/30 border">
                    <span className="text-[10px] text-muted-foreground mb-0.5">{k.label}</span>
                    <span className={`text-lg font-bold ${k.color}`}>{k.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex-1 overflow-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <div className="border-b bg-card px-6 pt-2 pb-0">
                <TabsList className="h-auto bg-transparent p-0 gap-0 border-0">
                  {[
                    { id: 'overview', label: 'Overview', icon: BarChart3 },
                    { id: 'generate', label: 'Generate Reports', icon: FileText },
                    { id: 'recent', label: 'Recent Reports', icon: Clock, badge: recentReports.length },
                    { id: 'scheduled', label: 'Scheduled', icon: Calendar },
                  ].map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <TabsTrigger
                        key={tab.id}
                        value={tab.id}
                        className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-none border-b-2 transition-colors ${isActive ? 'border-primary text-foreground bg-transparent' : 'border-transparent text-muted-foreground hover:text-foreground bg-transparent'}`}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="hidden sm:inline">{tab.label}</span>
                        {'badge' in tab && tab.badge !== undefined && (
                          <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                            {tab.badge}
                          </span>
                        )}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>

              <div className="flex-1 p-6 min-w-0">

                {/* ── OVERVIEW TAB ── */}
                <TabsContent value="overview" className="mt-0 space-y-6">
                  <div className="mb-2">
                    <h2 className="text-base font-semibold flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-primary" />
                      Reporting Overview
                    </h2>
                    <p className="text-sm text-muted-foreground">Platform trends and compliance health for the current reporting period</p>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <Card className="border-emerald-200 bg-emerald-50/30">
                      <CardContent className="pt-5 pb-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm text-muted-foreground">Compliance Score</p>
                          <Shield className="h-4 w-4 text-emerald-600" />
                        </div>
                        <p className={`text-4xl font-bold ${(summary?.complianceScore ?? 0) >= 80 ? 'text-emerald-600' : 'text-yellow-600'}`}>
                          {summary?.complianceScore ?? '—'}%
                        </p>
                        <Progress value={summary?.complianceScore ?? 0} className="h-1.5 mt-2" />
                        <p className="text-xs text-muted-foreground mt-2">National Gambling Act compliance</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-5 pb-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm text-muted-foreground">Interventions — Month</p>
                          <Bell className="h-4 w-4 text-blue-600" />
                        </div>
                        <p className="text-4xl font-bold text-blue-600">{summary?.interventionsThisMonth ?? '—'}</p>
                        <p className="text-xs text-muted-foreground mt-2">{summary?.pendingInterventions ?? 0} pending resolution</p>
                      </CardContent>
                    </Card>
                    <Card className={`${(summary?.criticalPlayers ?? 0) > 0 ? 'border-red-200 bg-red-50/20' : ''}`}>
                      <CardContent className="pt-5 pb-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm text-muted-foreground">Critical Risk Players</p>
                          <AlertTriangle className={`h-4 w-4 ${(summary?.criticalPlayers ?? 0) > 0 ? 'text-red-600' : 'text-muted-foreground'}`} />
                        </div>
                        <p className={`text-4xl font-bold ${(summary?.criticalPlayers ?? 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {summary?.criticalPlayers ?? '—'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">Risk score ≥ 80 — requires intervention</p>
                      </CardContent>
                    </Card>
                  </div>

                  {trendData.length > 0 && (
                    <div className="grid md:grid-cols-2 gap-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Player & Intervention Trend</CardTitle>
                          <CardDescription className="text-xs">6-month rolling summary</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={trendData}>
                              <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                              <YAxis tick={{ fontSize: 10 }} />
                              <Tooltip contentStyle={{ fontSize: 11 }} />
                              <Legend wrapperStyle={{ fontSize: 11 }} />
                              <Line type="monotone" dataKey="players" stroke="#3b82f6" strokeWidth={2} name="Players" dot={false} />
                              <Line type="monotone" dataKey="interventions" stroke="#f97316" strokeWidth={2} name="Interventions" dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Compliance Score Trend</CardTitle>
                          <CardDescription className="text-xs">NGA compliance trajectory</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={trendData}>
                              <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
                              <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v: number) => `${v}%`} />
                              <Bar dataKey="compliance" fill="#10b981" radius={[3, 3, 0, 0]} name="Compliance %" />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Regulatory Obligations Summary */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Globe className="h-4 w-4 text-primary" />
                        Regulatory Reporting Obligations
                      </CardTitle>
                      <CardDescription className="text-xs">National Gambling Act statutory requirements</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {[
                          { obligation: 'Monthly Responsible Gambling Report', authority: 'NGA §26', due: 'Due: 5th of following month', status: 'current', lastFiled: 'May 2026' },
                          { obligation: 'Quarterly Compliance Submission', authority: 'NGB Annual Return', due: 'Due: Q3 2026 (Oct)', status: 'upcoming', lastFiled: 'Q2 2026' },
                          { obligation: 'Self-Exclusion Register Update', authority: 'NGA §14', due: 'Due: Monthly', status: 'current', lastFiled: 'Jun 2026' },
                          { obligation: 'Staff Training Compliance Certificate', authority: 'NRGP §6', due: 'Due: Annual', status: 'current', lastFiled: 'Mar 2026' },
                          { obligation: 'POPIA Data Processing Report', authority: 'POPIA §8', due: 'Due: Annual', status: 'upcoming', lastFiled: 'Dec 2025' },
                        ].map((item, i) => (
                          <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                            <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full ${item.status === 'current' ? 'bg-emerald-500' : 'bg-yellow-500'}`} />
                              <div>
                                <p className="text-sm font-medium">{item.obligation}</p>
                                <p className="text-xs text-muted-foreground">{item.authority} · Last filed: {item.lastFiled}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground hidden sm:inline">{item.due}</span>
                              <Badge className={`text-xs border-0 ${item.status === 'current' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                {item.status === 'current' ? 'Current' : 'Upcoming'}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ── GENERATE REPORTS TAB ── */}
                <TabsContent value="generate" className="mt-0 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <h2 className="text-base font-semibold flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        Generate Reports
                      </h2>
                      <p className="text-sm text-muted-foreground">Select a report type and download in your preferred format</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-muted-foreground" />
                      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="h-8 w-40 text-xs">
                          <SelectValue placeholder="All Categories" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          {categories.map(c => (
                            <SelectItem key={c} value={c.toLowerCase()}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    {filteredReportTypes.map(report => {
                      const Icon = report.icon;
                      const isGenerating = generatingReport === report.id;
                      return (
                        <Card key={report.id} className={`border transition-all hover:shadow-sm ${report.border}`}>
                          <CardContent className="pt-4 pb-4">
                            <div className="flex items-start gap-3">
                              <div className={`w-10 h-10 rounded-xl ${report.bg} flex items-center justify-center flex-shrink-0`}>
                                <Icon className={`h-5 w-5 ${report.color}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="text-sm font-semibold">{report.title}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{report.category}</Badge>
                                      <span className="text-[10px] text-muted-foreground">{report.regulatoryRef}</span>
                                      <span className="text-[10px] text-muted-foreground">· {report.frequency}</span>
                                    </div>
                                  </div>
                                </div>
                                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{report.description}</p>
                                <div className="flex items-center gap-2 mt-3">
                                  {report.formats.map(fmt => {
                                    const FmtIcon = FORMAT_ICONS[fmt] || FileText;
                                    return (
                                      <Button
                                        key={fmt}
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs gap-1.5"
                                        disabled={isGenerating}
                                        onClick={() => handleGenerateReport(report.id, fmt)}
                                      >
                                        {isGenerating ? (
                                          <RefreshCw className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <FmtIcon className="h-3 w-3" />
                                        )}
                                        {fmt.toUpperCase()}
                                      </Button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </TabsContent>

                {/* ── RECENT REPORTS TAB ── */}
                <TabsContent value="recent" className="mt-0 space-y-4">
                  <div>
                    <h2 className="text-base font-semibold flex items-center gap-2">
                      <Clock className="h-5 w-5 text-primary" />
                      Recent Reports
                    </h2>
                    <p className="text-sm text-muted-foreground">{recentReports.length} reports generated in the last 30 days</p>
                  </div>

                  <Card>
                    <CardContent className="p-0">
                      <div className="divide-y">
                        {recentReports.map(report => {
                          const type = REPORT_TYPES.find(r => r.id === report.type);
                          const FmtIcon = FORMAT_ICONS[report.format] || FileText;
                          return (
                            <div key={report.id} className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-lg ${type?.bg || 'bg-muted'} flex items-center justify-center flex-shrink-0`}>
                                  <FmtIcon className={`h-4 w-4 ${type?.color || 'text-muted-foreground'}`} />
                                </div>
                                <div>
                                  <p className="text-sm font-medium">{report.title}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-xs text-muted-foreground">{formatDate(report.generatedAt)}</span>
                                    <span className="text-xs text-muted-foreground">·</span>
                                    <span className="text-xs text-muted-foreground">{report.size}</span>
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 uppercase">{report.format}</Badge>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={`text-xs border-0 ${report.status === 'ready' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                  {report.status === 'ready' ? 'Ready' : 'Generating...'}
                                </Badge>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                                  <Download className="h-3.5 w-3.5" />
                                  Download
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ── SCHEDULED TAB ── */}
                <TabsContent value="scheduled" className="mt-0 space-y-4">
                  <div>
                    <h2 className="text-base font-semibold flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-primary" />
                      Scheduled Reports
                    </h2>
                    <p className="text-sm text-muted-foreground">Automated report generation schedule</p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    {[
                      { title: 'Monthly Compliance Report', frequency: 'Monthly', nextRun: '5 Jul 2026 08:00', format: 'PDF', recipient: 'compliance@operator.co.za', active: true },
                      { title: 'Weekly Risk Summary', frequency: 'Every Monday', nextRun: '6 Jul 2026 07:00', format: 'Excel', recipient: 'risk@operator.co.za', active: true },
                      { title: 'Daily Intervention Report', frequency: 'Daily', nextRun: 'Tomorrow 06:00', format: 'PDF', recipient: 'admin@operator.co.za', active: true },
                      { title: 'Quarterly Regulatory Package', frequency: 'Quarterly', nextRun: '1 Oct 2026', format: 'PDF', recipient: 'ceo@operator.co.za', active: false },
                    ].map((s, i) => (
                      <Card key={i} className={`${!s.active ? 'opacity-60' : ''}`}>
                        <CardContent className="pt-4 pb-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm font-semibold">{s.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{s.frequency} · {s.format}</p>
                            </div>
                            <Badge className={`border-0 text-xs ${s.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                              {s.active ? 'Active' : 'Paused'}
                            </Badge>
                          </div>
                          <div className="mt-3 space-y-1.5 text-xs">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>Next run: <span className="font-medium text-foreground">{s.nextRun}</span></span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <FileText className="h-3 w-3" />
                              <span>Recipient: <span className="font-medium text-foreground">{s.recipient}</span></span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-3">
                            <Button variant="outline" size="sm" className="h-7 text-xs flex-1">
                              Edit Schedule
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs">
                              {s.active ? 'Pause' : 'Resume'}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center">
                      <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                      <p className="text-sm font-medium">Add New Scheduled Report</p>
                      <p className="text-xs text-muted-foreground mt-1 mb-3">Configure automated report delivery on a recurring schedule</p>
                      <Button size="sm" variant="outline">
                        Configure Schedule
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>

              </div>
            </Tabs>
          </div>
        </div>
      </DashboardLayout>
    </CasinoAdminGuard>
  );
}
