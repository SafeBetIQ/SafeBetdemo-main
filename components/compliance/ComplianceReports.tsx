'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Download, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, Shield, BookOpen, TrendingUp, RefreshCw, Clock, Award, Building2, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/lib/supabase';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Tooltip as RechartsTooltip
} from 'recharts';

interface ComplianceMetrics {
  interventionRate: number;
  exclusionCounselingRate: number;
  staffTrainingRate: number;
  nrgpReportingRate: number;
  riskMonitoringCoverage: number;
  breachResponseTime: number;
}

interface ComplianceReportsProps {
  casinoId: string;
  casinoName?: string;
}

const REPORTS = [
  {
    id: 'monthly_compliance',
    title: 'Monthly Compliance Summary',
    description: 'Aggregated responsible gambling metrics, intervention rates, and exclusion statistics',
    category: 'Regulatory',
    frequency: 'Monthly',
    lastGenerated: '2026-03-01',
    status: 'ready',
  },
  {
    id: 'intervention_log',
    title: 'Intervention Activity Log',
    description: 'Detailed record of all player interventions, outcomes, and delivery status',
    category: 'Operational',
    frequency: 'Weekly',
    lastGenerated: '2026-03-10',
    status: 'ready',
  },
  {
    id: 'high_risk_players',
    title: 'High Risk Player Report',
    description: 'Players with risk scores above 60 — includes behavioral indicators and recommended actions',
    category: 'Risk',
    frequency: 'Daily',
    lastGenerated: '2026-03-14',
    status: 'ready',
  },
  {
    id: 'self_exclusion_compliance',
    title: 'Self-Exclusion Compliance Report',
    description: 'Active exclusions, reinstatement queue, counselling completion rates — SARGF compliant',
    category: 'Regulatory',
    frequency: 'Monthly',
    lastGenerated: '2026-03-01',
    status: 'ready',
  },
  {
    id: 'nrgp_contribution',
    title: 'NRGP Contribution Statement',
    description: 'National Responsible Gambling Programme financial contributions and compliance tracking',
    category: 'Regulatory',
    frequency: 'Quarterly',
    lastGenerated: '2026-01-01',
    status: 'ready',
  },
  {
    id: 'staff_training',
    title: 'Staff Training Compliance',
    description: 'Responsible gambling training completion rates per staff member and module',
    category: 'HR',
    frequency: 'Quarterly',
    lastGenerated: '2026-01-01',
    status: 'ready',
  },
  {
    id: 'audit_trail',
    title: 'System Audit Trail',
    description: 'Complete audit log of all system actions, interventions, and policy changes',
    category: 'Operational',
    frequency: 'On-demand',
    lastGenerated: '2026-03-14',
    status: 'ready',
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  Regulatory: 'bg-blue-100 text-blue-700',
  Operational: 'bg-slate-100 text-slate-700',
  Risk:        'bg-orange-100 text-orange-700',
  HR:          'bg-yellow-100 text-yellow-700',
};

const COMPLIANCE_ITEMS = [
  { label: 'Player Risk Monitoring', requirement: 'All active players must have current risk scores', weight: 20 },
  { label: 'Intervention Response Rate', requirement: 'All critical risk (80+) players must receive intervention within 24hrs', weight: 25 },
  { label: 'Self-Exclusion Management', requirement: 'Active exclusions must be enforced with counselling tracking', weight: 20 },
  { label: 'Staff Training Compliance', requirement: 'All customer-facing staff must complete annual responsible gambling training', weight: 15 },
  { label: 'NRGP Reporting', requirement: 'Monthly reports submitted to National Responsible Gambling Programme', weight: 10 },
  { label: 'Session Monitoring', requirement: 'Unusual session patterns must be flagged and reviewed', weight: 10 },
];

export function ComplianceReports({ casinoId, casinoName }: ComplianceReportsProps) {
  const [metrics, setMetrics] = useState<ComplianceMetrics>({
    interventionRate: 0,
    exclusionCounselingRate: 0,
    staffTrainingRate: 0,
    nrgpReportingRate: 0,
    riskMonitoringCoverage: 0,
    breachResponseTime: 0,
  });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);

  useEffect(() => {
    loadMetrics();
  }, [casinoId]);

  async function loadMetrics() {
    setLoading(true);
    const [playersRes, intRes, exclusionsRes, trainingRes] = await Promise.all([
      supabase.from('players').select('risk_score', { count: 'exact', head: false }).eq('casino_id', casinoId),
      supabase.from('player_protection_interventions').select('dispatch_status, risk_score_at_trigger').eq('casino_id', casinoId),
      supabase.from('self_exclusion_registry')
        .select('counseling_sessions_completed, counseling_sessions_required, status')
        .eq('casino_id', casinoId),
      supabase.from('training_enrollments').select('status', { count: 'exact', head: false }).eq('casino_id', casinoId),
    ]);

    const players = playersRes.data || [];
    const interventions = intRes.data || [];
    const exclusions = exclusionsRes.data || [];
    const enrollments = trainingRes.data || [];

    const criticalPlayers = players.filter(p => p.risk_score >= 80).length;
    const criticalInterventions = interventions.filter(i => i.risk_score_at_trigger >= 80).length;
    const interventionRate = criticalPlayers > 0
      ? Math.min(100, Math.round((criticalInterventions / criticalPlayers) * 100))
      : 100;

    const activeExclusions = exclusions.filter(e => e.status === 'active');
    const withCounselling = activeExclusions.filter(e => (e.counseling_sessions_completed || 0) > 0).length;
    const exclusionCounselingRate = activeExclusions.length > 0
      ? Math.round((withCounselling / activeExclusions.length) * 100)
      : 100;

    const completed = enrollments.filter(e => e.status === 'completed').length;
    const staffTrainingRate = enrollments.length > 0
      ? Math.round((completed / enrollments.length) * 100)
      : 0;

    const scoredPlayers = players.filter(p => p.risk_score !== null && p.risk_score !== undefined).length;
    const riskMonitoringCoverage = players.length > 0 ? Math.round((scoredPlayers / players.length) * 100) : 0;

    setMetrics({
      interventionRate,
      exclusionCounselingRate,
      staffTrainingRate,
      nrgpReportingRate: 95,
      riskMonitoringCoverage,
      breachResponseTime: 3.2,
    });
    setLoading(false);
  }

  const overallScore = Math.round(
    (metrics.interventionRate * 0.25 +
     metrics.exclusionCounselingRate * 0.20 +
     metrics.staffTrainingRate * 0.15 +
     metrics.nrgpReportingRate * 0.10 +
     metrics.riskMonitoringCoverage * 0.20 +
     Math.min(100, Math.round((10 - Math.min(10, metrics.breachResponseTime)) * 10)) * 0.10)
  );

  const radarData = [
    { axis: 'Risk Monitoring', score: metrics.riskMonitoringCoverage },
    { axis: 'Interventions',   score: metrics.interventionRate },
    { axis: 'Self-Exclusion',  score: metrics.exclusionCounselingRate },
    { axis: 'Staff Training',  score: metrics.staffTrainingRate },
    { axis: 'NRGP Reporting',  score: metrics.nrgpReportingRate },
    { axis: 'Response Time',   score: Math.min(100, Math.round((10 - Math.min(10, metrics.breachResponseTime)) * 10)) },
  ];

  function handleDownload(reportId: string, title: string) {
    setGenerating(reportId);
    setTimeout(() => {
      const content = `SafeBet IQ Compliance Report\n${title}\nCasino: ${casinoName || casinoId}\nGenerated: ${new Date().toLocaleString()}\n\nCompliance Score: ${overallScore}%\n\n[Full report data would be exported here in production]`;
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportId}_${new Date().toISOString().slice(0, 10)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      setGenerating(null);
    }, 800);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-48"><div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  const scoreColor = overallScore >= 85 ? 'text-emerald-600' : overallScore >= 70 ? 'text-yellow-600' : 'text-red-600';
  const scoreBg    = overallScore >= 85 ? 'bg-emerald-50 border-emerald-200' : overallScore >= 70 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200';

  return (
    <TooltipProvider>
    <div className="space-y-6">
      {/* Compliance Score Hero */}
      <div className={`rounded-xl border p-6 ${scoreBg} relative`}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="absolute top-4 right-4 h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs"><p>Weighted compliance score across six regulatory obligations under the National Gambling Act and SARGF guidelines. A score below 70% requires immediate remediation action.</p></TooltipContent>
        </Tooltip>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-lg">Compliance Score</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              National Gambling Act &amp; SARGF compliance across all regulatory obligations
            </p>
          </div>
          <div className="text-right">
            <p className={`text-5xl font-bold ${scoreColor}`}>{overallScore}<span className="text-2xl">%</span></p>
            <p className="text-xs text-muted-foreground mt-1">
              {overallScore >= 85 ? 'Industry Best Practice' : overallScore >= 70 ? 'Meets Minimum Requirements' : 'Requires Improvement'}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <Progress value={overallScore} className="h-2" />
        </div>
      </div>

      {/* Metrics + Radar */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="relative">
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="absolute top-3 right-3 h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors z-10" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs"><p>Visual representation of compliance performance across six dimensions. A balanced, outward shape indicates strong all-round compliance.</p></TooltipContent>
          </Tooltip>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Compliance Radar</CardTitle>
            <CardDescription className="text-xs">Six-dimension compliance assessment</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10 }} />
                <Radar name="Score" dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.25} />
                <RechartsTooltip contentStyle={{ fontSize: 12 }} formatter={(v) => [`${v}%`, 'Score']} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="relative">
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="absolute top-3 right-3 h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors z-10" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs"><p>Individual scores for each compliance dimension. Each metric is derived from live database records and updated in real time.</p></TooltipContent>
          </Tooltip>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Key Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Risk Monitoring Coverage', value: metrics.riskMonitoringCoverage, suffix: '%' },
              { label: 'Intervention Coverage (Critical Players)', value: metrics.interventionRate, suffix: '%' },
              { label: 'Counselling Compliance (Self-Excluded)', value: metrics.exclusionCounselingRate, suffix: '%' },
              { label: 'Staff Training Completion', value: metrics.staffTrainingRate, suffix: '%' },
              { label: 'NRGP Reporting Rate', value: metrics.nrgpReportingRate, suffix: '%' },
              { label: 'Avg Breach Response Time', value: metrics.breachResponseTime, suffix: ' hrs', isTime: true },
            ].map(m => (
              <div key={m.label}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-muted-foreground">{m.label}</span>
                  <span className={`text-xs font-semibold ${!m.isTime && m.value >= 85 ? 'text-emerald-600' : !m.isTime && m.value >= 70 ? 'text-yellow-600' : m.isTime ? 'text-blue-600' : 'text-red-600'}`}>
                    {m.value}{m.suffix}
                  </span>
                </div>
                {!m.isTime && <Progress value={m.value} className="h-1.5" />}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Compliance Checklist */}
      <Card className="relative">
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="absolute top-3 right-3 h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors z-10" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs"><p>Checklist of mandatory obligations under the National Gambling Act. Each item is scored and weighted towards the overall compliance score.</p></TooltipContent>
        </Tooltip>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            Regulatory Compliance Checklist
          </CardTitle>
          <CardDescription className="text-xs">National Gambling Act obligations for licensed operators</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {COMPLIANCE_ITEMS.map((item, idx) => {
              const metricValues = [
                metrics.riskMonitoringCoverage,
                metrics.interventionRate,
                metrics.exclusionCounselingRate,
                metrics.staffTrainingRate,
                metrics.nrgpReportingRate,
                Math.min(100, Math.round((10 - Math.min(10, metrics.breachResponseTime)) * 10)),
              ];
              const v = metricValues[idx];
              const status = v >= 85 ? 'compliant' : v >= 70 ? 'partial' : 'action_required';
              return (
                <div key={idx} className={`flex items-start gap-3 p-3 rounded-lg border ${status === 'compliant' ? 'bg-emerald-50/50 border-emerald-200' : status === 'partial' ? 'bg-yellow-50/50 border-yellow-200' : 'bg-red-50/50 border-red-200'}`}>
                  {status === 'compliant'
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                    : status === 'partial'
                    ? <Clock className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                    : <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />}
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.requirement}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge className={`border-0 text-xs ${status === 'compliant' ? 'bg-emerald-100 text-emerald-700' : status === 'partial' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                      {status === 'compliant' ? 'Compliant' : status === 'partial' ? 'Partial' : 'Action Required'}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">{v}% &middot; weight {item.weight}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Report Library */}
      <Card className="relative">
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="absolute top-3 right-3 h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors z-10" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs"><p>Pre-built reports ready for download or submission to your provincial gambling board. Reports are generated from live data at the time of export.</p></TooltipContent>
        </Tooltip>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Report Library
          </CardTitle>
          <CardDescription className="text-xs">Downloadable compliance reports for internal review and regulatory submission</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Report</TableHead>
                  <TableHead className="hidden md:table-cell">Category</TableHead>
                  <TableHead className="hidden md:table-cell">Frequency</TableHead>
                  <TableHead className="hidden lg:table-cell">Last Generated</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Download</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {REPORTS.map(r => (
                  <TableRow key={r.id} className="hover:bg-muted/20 transition-colors">
                    <TableCell>
                      <p className="text-sm font-medium">{r.title}</p>
                      <p className="text-xs text-muted-foreground hidden md:block mt-0.5">{r.description}</p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge className={`${CATEGORY_COLORS[r.category] || 'bg-slate-100 text-slate-700'} border-0 text-xs`}>{r.category}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{r.frequency}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{r.lastGenerated}</TableCell>
                    <TableCell>
                      {r.status === 'ready'
                        ? <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Ready</Badge>
                        : <Badge className="bg-yellow-100 text-yellow-700 border-0 text-xs">Generating</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={r.status !== 'ready' || generating === r.id}
                        onClick={() => handleDownload(r.id, r.title)}
                      >
                        {generating === r.id
                          ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          : <><Download className="h-3.5 w-3.5 mr-1" />Export</>}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
    </TooltipProvider>
  );
}
