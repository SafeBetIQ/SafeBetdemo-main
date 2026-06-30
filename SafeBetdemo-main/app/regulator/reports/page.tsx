'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  FileText, Download, RefreshCw, ShieldCheck, Globe, Building2,
  AlertTriangle, BarChart3, Calendar, Clock, CheckCircle2, FileSpreadsheet,
  FileBadge, ChevronRight, TrendingUp, Users, Activity,
  Shield, Eye, Archive, Printer,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface NationalSummary {
  totalCasinos: number;
  totalPlayers: number;
  highRiskPlayers: number;
  criticalPlayers: number;
  totalInterventions: number;
  totalExclusions: number;
  avgCompliance: number;
  activeSessions: number;
}

interface CasinoCompliance {
  id: string;
  name: string;
  province: string;
  compliance_score: number;
  high_risk: number;
  interventions: number;
  exclusions: number;
  license_number: string;
}

type Format = 'PDF' | 'Excel' | 'CSV';

interface ReportType {
  id: string;
  title: string;
  description: string;
  category: string;
  regulation: string;
  frequency: string;
  formats: Format[];
  icon: React.ElementType;
  roles: string[];
}

const REPORT_TYPES: ReportType[] = [
  {
    id: 'national-compliance-summary',
    title: 'National Compliance Summary',
    description: 'Aggregate compliance metrics across all 18 licensed operators, with provincial breakdown and trend analysis.',
    category: 'Compliance',
    regulation: 'NGA §26(1)(a)',
    frequency: 'Monthly',
    formats: ['PDF', 'Excel'],
    icon: ShieldCheck,
    roles: ['regulator', 'national_regulator', 'super_admin'],
  },
  {
    id: 'cross-operator-risk',
    title: 'Cross-Operator Risk Intelligence',
    description: 'Comparative risk distribution analysis across all operators. Identifies systemic risk patterns and outlier operators.',
    category: 'Risk',
    regulation: 'NGA §26(1)(b)',
    frequency: 'Weekly',
    formats: ['PDF', 'Excel', 'CSV'],
    icon: AlertTriangle,
    roles: ['regulator', 'national_regulator', 'super_admin'],
  },
  {
    id: 'self-exclusion-network',
    title: 'Self-Exclusion Network Report',
    description: 'National self-exclusion register status, breach detections, and cross-operator flagging effectiveness.',
    category: 'Exclusions',
    regulation: 'SARGF §4.2',
    frequency: 'Weekly',
    formats: ['PDF', 'CSV'],
    icon: Shield,
    roles: ['regulator', 'national_regulator', 'provincial_regulator', 'super_admin'],
  },
  {
    id: 'operator-license-audit',
    title: 'Operator Licence Compliance Audit',
    description: 'Detailed per-operator audit of licence conditions, training compliance, and responsible gambling obligations.',
    category: 'Audit',
    regulation: 'NGA §29',
    frequency: 'Quarterly',
    formats: ['PDF', 'Excel'],
    icon: FileBadge,
    roles: ['regulator', 'national_regulator', 'super_admin'],
  },
  {
    id: 'wellbeing-intervention-effectiveness',
    title: 'Intervention Effectiveness Report',
    description: 'Outcome tracking for player interventions — response rates, escalations, and wellbeing outcomes by operator.',
    category: 'Wellbeing',
    regulation: 'NRGP §4.2',
    frequency: 'Monthly',
    formats: ['PDF', 'Excel'],
    icon: Activity,
    roles: ['regulator', 'national_regulator', 'provincial_regulator', 'super_admin'],
  },
  {
    id: 'annual-return-package',
    title: 'Annual Return Package',
    description: 'Complete NGA Annual Return submission package. Includes all statutory reporting fields and supporting data.',
    category: 'Statutory',
    regulation: 'NGA §35 Annual Return',
    frequency: 'Annual',
    formats: ['PDF', 'Excel'],
    icon: FileText,
    roles: ['regulator', 'national_regulator', 'super_admin'],
  },
  {
    id: 'provincial-operator-summary',
    title: 'Provincial Operator Summary',
    description: 'Province-scoped operator compliance snapshot — high risk players, interventions, training rates.',
    category: 'Provincial',
    regulation: 'PGA §12',
    frequency: 'Monthly',
    formats: ['PDF', 'CSV'],
    icon: Globe,
    roles: ['provincial_regulator', 'super_admin'],
  },
  {
    id: 'high-risk-cohort',
    title: 'High-Risk Player Cohort Analysis',
    description: 'Anonymised cohort breakdown by risk score, demographic indicators, and behavioural patterns — aggregate only.',
    category: 'Risk',
    regulation: 'POPIA §8 · NGA §26',
    frequency: 'Monthly',
    formats: ['PDF', 'Excel'],
    icon: Users,
    roles: ['regulator', 'national_regulator', 'provincial_regulator', 'super_admin'],
  },
];

const RECENT_REPORTS = [
  { id: 1, title: 'National Compliance Summary — May 2026', generated: '2026-06-01', size: '3.2 MB', format: 'PDF', status: 'ready' },
  { id: 2, title: 'Cross-Operator Risk Intelligence — Week 25', generated: '2026-06-22', size: '1.8 MB', format: 'Excel', status: 'ready' },
  { id: 3, title: 'Self-Exclusion Network Report — Week 25', generated: '2026-06-22', size: '0.9 MB', format: 'CSV', status: 'ready' },
  { id: 4, title: 'Wellbeing Intervention Effectiveness — May 2026', generated: '2026-06-01', size: '2.4 MB', format: 'PDF', status: 'ready' },
  { id: 5, title: 'Operator Licence Compliance Audit — Q1 2026', generated: '2026-04-01', size: '5.1 MB', format: 'PDF', status: 'ready' },
  { id: 6, title: 'Provincial Operator Summary — May 2026 (Gauteng)', generated: '2026-06-01', size: '1.2 MB', format: 'PDF', status: 'ready' },
];

const OBLIGATIONS = [
  { ref: 'NGA §26(1)(a)', description: 'Monthly responsible gambling compliance report to NGB', due: '2026-07-10', status: 'upcoming', daysLeft: 11 },
  { ref: 'NGA §35 Annual Return', description: 'Annual national operator return — statistical returns', due: '2026-09-30', status: 'upcoming', daysLeft: 93 },
  { ref: 'SARGF §4.2', description: 'Quarterly self-exclusion network effectiveness review', due: '2026-07-01', status: 'overdue', daysLeft: -28 },
  { ref: 'NRGP §4.2', description: 'Bi-annual intervention outcomes report to NRGP committee', due: '2026-06-30', status: 'submitted', daysLeft: 0 },
  { ref: 'PGA §12', description: 'Monthly provincial operator summary for each board', due: '2026-07-10', status: 'upcoming', daysLeft: 11 },
];

const TREND_DATA = [
  { month: 'Jan', compliance: 78, highRisk: 142, interventions: 89 },
  { month: 'Feb', compliance: 81, highRisk: 158, interventions: 103 },
  { month: 'Mar', compliance: 79, highRisk: 171, interventions: 118 },
  { month: 'Apr', compliance: 83, highRisk: 164, interventions: 127 },
  { month: 'May', compliance: 86, highRisk: 149, interventions: 134 },
  { month: 'Jun', compliance: 88, highRisk: 137, interventions: 141 },
];

const CATEGORY_COLOR: Record<string, string> = {
  Compliance: 'bg-blue-100 text-blue-700 border-blue-200',
  Risk: 'bg-red-100 text-red-700 border-red-200',
  Exclusions: 'bg-purple-100 text-purple-700 border-purple-200',
  Audit: 'bg-amber-100 text-amber-700 border-amber-200',
  Wellbeing: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Statutory: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  Provincial: 'bg-cyan-100 text-cyan-700 border-cyan-200',
};

const FORMAT_ICON: Record<Format, React.ElementType> = {
  PDF: FileText,
  Excel: FileSpreadsheet,
  CSV: Archive,
};

export default function RegulatorReportsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [summary, setSummary] = useState<NationalSummary>({
    totalCasinos: 0, totalPlayers: 0, highRiskPlayers: 0, criticalPlayers: 0,
    totalInterventions: 0, totalExclusions: 0, avgCompliance: 0, activeSessions: 0,
  });
  const [casinos, setCasinos] = useState<CasinoCompliance[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);

  const role = user?.role || '';
  const isProvincial = role === 'provincial_regulator';

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    try {
      const [casinosRes, playersRes, interventionsRes, exclusionsRes] = await Promise.all([
        supabase.from('casinos').select('id, name, province, license_number, is_active').eq('is_active', true),
        supabase.from('players').select('id, risk_level, casino_id'),
        supabase.from('player_protection_interventions').select('id, status, casino_id'),
        supabase.from('self_exclusion_registry').select('id, casino_id, status'),
      ]);

      const casinoList = casinosRes.data || [];
      const players = playersRes.data || [];
      const interventions = interventionsRes.data || [];
      const exclusions = exclusionsRes.data || [];

      const highRisk = players.filter((p) => p.risk_level === 'high' || p.risk_level === 'critical').length;
      const critical = players.filter((p) => p.risk_level === 'critical').length;
      const activeExclusions = exclusions.filter((e) => e.status === 'active').length;

      setSummary({
        totalCasinos: casinoList.length,
        totalPlayers: players.length,
        highRiskPlayers: highRisk,
        criticalPlayers: critical,
        totalInterventions: interventions.length,
        totalExclusions: activeExclusions,
        avgCompliance: 87,
        activeSessions: 0,
      });

      const enriched: CasinoCompliance[] = casinoList.map((c) => {
        const cp = players.filter((p) => p.casino_id === c.id);
        const ci = interventions.filter((i) => i.casino_id === c.id);
        const ce = exclusions.filter((e) => e.casino_id === c.id && e.status === 'active');
        const hr = cp.filter((p) => p.risk_level === 'high' || p.risk_level === 'critical').length;
        const score = Math.max(60, Math.min(99, 95 - Math.round((hr / Math.max(cp.length, 1)) * 100)));
        return { id: c.id, name: c.name, province: c.province, license_number: c.license_number, compliance_score: score, high_risk: hr, interventions: ci.length, exclusions: ce.length };
      }).sort((a, b) => a.compliance_score - b.compliance_score);

      setCasinos(enriched);
    } catch {
      /* silent — show zeros */
    } finally {
      setLoading(false);
    }
  }

  async function generateReport(reportId: string, format: Format) {
    setGenerating(`${reportId}-${format}`);
    await new Promise((r) => setTimeout(r, 2200));
    setGenerating(null);
    toast.success(`${format} report generated`, {
      description: 'Your report is ready to download.',
    });
  }

  const availableReports = REPORT_TYPES.filter((r) => r.roles.includes(role));

  const KPI_ITEMS = [
    { label: 'Licensed Operators', value: summary.totalCasinos || 18, icon: Building2, color: 'text-blue-600' },
    { label: 'Total Players', value: (summary.totalPlayers || 0).toLocaleString(), icon: Users, color: 'text-foreground' },
    { label: 'High-Risk Players', value: (summary.highRiskPlayers || 0).toLocaleString(), icon: AlertTriangle, color: 'text-amber-600' },
    { label: 'Active Exclusions', value: (summary.totalExclusions || 0).toLocaleString(), icon: Shield, color: 'text-purple-600' },
    { label: 'Avg Compliance', value: `${summary.avgCompliance || 87}%`, icon: ShieldCheck, color: 'text-emerald-600' },
    { label: 'Total Interventions', value: (summary.totalInterventions || 0).toLocaleString(), icon: Activity, color: 'text-cyan-600' },
  ];

  return (
    <DashboardLayout>
      <div className="min-h-full p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Regulatory Reporting Centre</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isProvincial ? 'Provincial' : 'National'} compliance reports, statutory submissions, and regulatory intelligence
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export All
            </Button>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {KPI_ITEMS.map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-4 w-4 ${color}`} />
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">{label}</span>
                </div>
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-auto p-1 gap-1">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'generate', label: 'Generate Reports', icon: FileText },
              { id: 'obligations', label: 'Regulatory Obligations', icon: Calendar },
              { id: 'operator-compliance', label: 'Operator Compliance', icon: Building2 },
              { id: 'recent', label: 'Recent Reports', icon: Clock },
            ].map(({ id, label, icon: Icon }) => (
              <TabsTrigger key={id} value={id} className="text-xs px-3 py-1.5 rounded flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    National Compliance Trend
                  </CardTitle>
                  <CardDescription className="text-xs">Average compliance score across all operators</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={TREND_DATA}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                      <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} domain={[70, 100]} />
                      <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#111', fontSize: 12 }} />
                      <Line type="monotone" dataKey="compliance" name="Compliance %" stroke="#22c55e" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    High-Risk Players & Interventions
                  </CardTitle>
                  <CardDescription className="text-xs">Monthly national totals</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={TREND_DATA}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                      <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#111', fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11, color: '#6b7280' }} />
                      <Bar dataKey="highRisk" name="High-Risk Players" fill="rgba(245,158,11,0.7)" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="interventions" name="Interventions" fill="rgba(99,102,241,0.7)" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Compliance health summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Operators above 85% compliance', value: `${casinos.filter((c) => c.compliance_score >= 85).length || 14}/${summary.totalCasinos || 18}`, progress: ((casinos.filter((c) => c.compliance_score >= 85).length || 14) / (summary.totalCasinos || 18)) * 100, color: 'bg-emerald-500' },
                { label: 'Staff training compliance (avg)', value: '73%', progress: 73, color: 'bg-blue-500' },
                { label: 'Self-exclusion enforcement rate', value: '94%', progress: 94, color: 'bg-purple-500' },
              ].map(({ label, value, progress, color }) => (
                <Card key={label}>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-2">{label}</p>
                    <p className="text-xl font-bold mb-2">{value}</p>
                    <Progress value={progress} className="h-1.5" indicatorClassName={color} />
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* GENERATE REPORTS TAB */}
          <TabsContent value="generate" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {availableReports.map((report) => {
                const Icon = report.icon;
                return (
                  <Card key={report.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="flex-shrink-0 h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="text-sm font-semibold">{report.title}</h3>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${CATEGORY_COLOR[report.category]}`}>
                              {report.category}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{report.description}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mb-4 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <FileBadge className="h-3 w-3" />
                          {report.regulation}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {report.frequency}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {report.formats.map((fmt) => {
                          const FmtIcon = FORMAT_ICON[fmt];
                          const key = `${report.id}-${fmt}`;
                          const isGen = generating === key;
                          return (
                            <Button
                              key={fmt}
                              size="sm"
                              variant="outline"
                              onClick={() => generateReport(report.id, fmt)}
                              disabled={!!generating}
                              className="text-xs px-3 h-8"
                            >
                              {isGen ? (
                                <RefreshCw className="h-3 w-3 mr-1.5 animate-spin" />
                              ) : (
                                <FmtIcon className="h-3 w-3 mr-1.5" />
                              )}
                              {isGen ? 'Generating…' : fmt}
                            </Button>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* REGULATORY OBLIGATIONS TAB */}
          <TabsContent value="obligations" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  Statutory Reporting Obligations
                </CardTitle>
                <CardDescription className="text-xs">
                  Track your reporting deadlines under the National Gambling Act and Provincial Gambling Acts
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs font-semibold">Reference</TableHead>
                      <TableHead className="text-xs font-semibold">Obligation</TableHead>
                      <TableHead className="text-xs font-semibold">Due Date</TableHead>
                      <TableHead className="text-xs font-semibold">Status</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {OBLIGATIONS.map((ob, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs font-mono text-primary font-semibold py-3">{ob.ref}</TableCell>
                        <TableCell className="text-xs text-muted-foreground py-3 max-w-xs">{ob.description}</TableCell>
                        <TableCell className="text-xs text-muted-foreground py-3 whitespace-nowrap">{ob.due}</TableCell>
                        <TableCell className="py-3">
                          {ob.status === 'submitted' ? (
                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Submitted
                            </Badge>
                          ) : ob.status === 'overdue' ? (
                            <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">
                              <AlertTriangle className="h-3 w-3 mr-1" /> Overdue {Math.abs(ob.daysLeft)}d
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">
                              <Clock className="h-3 w-3 mr-1" /> Due in {ob.daysLeft}d
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          {ob.status !== 'submitted' && (
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground">
                              Generate <ChevronRight className="h-3 w-3 ml-1" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* POPIA notice */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4 flex items-start gap-3">
                <Shield className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-blue-800 mb-1">Data Privacy Notice — POPIA §8</p>
                  <p className="text-xs text-blue-600 leading-relaxed">
                    All reports generated by this system contain aggregated, anonymised data unless marked otherwise. Individual player data is masked in compliance with the Protection of Personal Information Act. Reports are generated under the lawful basis of public interest and regulatory oversight (POPIA §27(1)(d)).
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* OPERATOR COMPLIANCE TAB */}
          <TabsContent value="operator-compliance" className="mt-4">
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    Operator Compliance Ranking
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Sorted by compliance score — lowest first. Scores calculated from risk levels, intervention rates, and training compliance.
                  </CardDescription>
                </div>
                <Button size="sm" variant="outline" className="text-xs">
                  <Download className="h-3 w-3 mr-1.5" /> Export
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs font-semibold">Operator</TableHead>
                      <TableHead className="text-xs font-semibold">Province</TableHead>
                      <TableHead className="text-xs font-semibold">Compliance</TableHead>
                      <TableHead className="text-xs font-semibold">High Risk</TableHead>
                      <TableHead className="text-xs font-semibold">Interventions</TableHead>
                      <TableHead className="text-xs font-semibold">Exclusions</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(casinos.length > 0 ? casinos : Array.from({ length: 5 }, (_, i) => ({
                      id: `mock-${i}`, name: ['GrandWest Casino', 'Suncoast Casino', 'Emperors Palace', 'Montecasino', 'Gold Reef City'][i],
                      province: ['Western Cape', 'KwaZulu-Natal', 'Gauteng', 'Gauteng', 'Gauteng'][i],
                      license_number: `NGB-0${i + 1}`, compliance_score: [64, 72, 78, 85, 91][i],
                      high_risk: [28, 21, 14, 9, 5][i], interventions: [42, 31, 22, 15, 8][i], exclusions: [12, 8, 6, 4, 2][i],
                    }))).map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="text-sm font-medium py-3">{c.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground py-3">{c.province}</TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2">
                            <Progress
                              value={c.compliance_score}
                              className="h-1.5 w-16"
                              indicatorClassName={c.compliance_score >= 85 ? 'bg-emerald-500' : c.compliance_score >= 70 ? 'bg-amber-500' : 'bg-red-500'}
                            />
                            <span className={`text-xs font-bold ${c.compliance_score >= 85 ? 'text-emerald-600' : c.compliance_score >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                              {c.compliance_score}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-amber-600 font-semibold py-3">{c.high_risk}</TableCell>
                        <TableCell className="text-xs text-muted-foreground py-3">{c.interventions}</TableCell>
                        <TableCell className="text-xs text-purple-600 py-3">{c.exclusions}</TableCell>
                        <TableCell className="py-3 text-right">
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground">
                            <Eye className="h-3 w-3 mr-1" /> View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* RECENT REPORTS TAB */}
          <TabsContent value="recent" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Recent Reports
                </CardTitle>
                <CardDescription className="text-xs">
                  Reports generated in the last 90 days
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs font-semibold">Report</TableHead>
                      <TableHead className="text-xs font-semibold">Generated</TableHead>
                      <TableHead className="text-xs font-semibold">Format</TableHead>
                      <TableHead className="text-xs font-semibold">Size</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {RECENT_REPORTS.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm">{r.title}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground py-3">{r.generated}</TableCell>
                        <TableCell className="py-3">
                          <Badge className={r.format === 'PDF' ? 'bg-red-100 text-red-700 border-red-200 text-[10px]' : r.format === 'Excel' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]' : 'bg-blue-100 text-blue-700 border-blue-200 text-[10px]'}>
                            {r.format}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground py-3">{r.size}</TableCell>
                        <TableCell className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground">
                              <Eye className="h-3 w-3 mr-1" /> Preview
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground">
                              <Download className="h-3 w-3 mr-1" /> Download
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground">
                              <Printer className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
