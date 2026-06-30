'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Globe as Globe2, Building2, Users, TriangleAlert as AlertTriangle, Activity, Download, FileText, Shield, GraduationCap, TrendingUp, RefreshCw, Bell, ShieldOff, ChartBar as BarChart3, MapPin, CircleCheck as CheckCircle2, Circle as XCircle, Eye } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { NationalGamblingInsights } from '@/components/regulator/NationalGamblingInsights';
import { ModuleGuard } from '@/components/ModuleGuard';
import { HighRiskPlayerAnalytics } from '@/components/regulator/HighRiskPlayerAnalytics';
import { InterventionStatistics } from '@/components/regulator/InterventionStatistics';
import { toast } from 'sonner';

interface NationalSummary {
  totalCasinos: number;
  totalPlayers: number;
  highRiskPlayers: number;
  criticalPlayers: number;
  totalInterventions: number;
  totalExclusions: number;
  avgCompliance: number;
  nonCompliantOperators: number;
  activeSessions: number;
}

interface CasinoRow {
  id: string;
  name: string;
  province: string;
  license_number: string;
  is_active: boolean;
  player_count: number;
  high_risk: number;
  interventions: number;
  exclusions: number;
  compliance_score: number;
}

export default function NationalRegulatorDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [summary, setSummary] = useState<NationalSummary>({
    totalCasinos: 0, totalPlayers: 0, highRiskPlayers: 0, criticalPlayers: 0,
    totalInterventions: 0, totalExclusions: 0, avgCompliance: 0,
    nonCompliantOperators: 0, activeSessions: 0,
  });
  const [casinos, setCasinos] = useState<CasinoRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadSummary();
  }, [user]);

  async function loadSummary() {
    setLoading(true);
    try {
      const { data: casinoList } = await supabase
        .from('casinos')
        .select('id, name, province, license_number, is_active')
        .order('name');

      if (!casinoList || casinoList.length === 0) { setLoading(false); return; }
      const casinoIds = casinoList.map(c => c.id);

      const [
        playersRes, intRes, exclRes, sessRes, snapshotRes,
        totalPlayersRes, highRiskRes, criticalRes,
      ] = await Promise.all([
        supabase.from('players').select('casino_id, risk_score').in('casino_id', casinoIds).limit(5000),
        supabase.from('player_protection_interventions').select('casino_id').in('casino_id', casinoIds).limit(5000),
        supabase.from('self_exclusion_registry').select('casino_id').in('casino_id', casinoIds).eq('status', 'active').limit(2000),
        supabase.from('gaming_sessions').select('*', { count: 'exact', head: true }).in('casino_id', casinoIds).eq('is_active', true),
        supabase.from('compliance_snapshots').select('casino_id, compliance_score').in('casino_id', casinoIds).order('snapshot_date', { ascending: false }).limit(500),
        supabase.from('players').select('*', { count: 'exact', head: true }).in('casino_id', casinoIds),
        supabase.from('players').select('*', { count: 'exact', head: true }).in('casino_id', casinoIds).gte('risk_score', 60),
        supabase.from('players').select('*', { count: 'exact', head: true }).in('casino_id', casinoIds).gte('risk_score', 80),
      ]);

      const players      = playersRes.data || [];
      const interventions= intRes.data || [];
      const exclusions   = exclRes.data || [];
      const snapshots    = snapshotRes.data || [];

      // Latest snapshot score per casino (snapshots already ordered desc by date)
      const latestSnapMap = new Map<string, number>();
      for (const s of snapshots) {
        if (!latestSnapMap.has(s.casino_id)) latestSnapMap.set(s.casino_id, Number(s.compliance_score));
      }

      const casinoRows: CasinoRow[] = casinoList.map(c => {
        const cp = players.filter(p => p.casino_id === c.id);
        const ci = interventions.filter(i => i.casino_id === c.id).length;
        const ce = exclusions.filter(e => e.casino_id === c.id).length;
        const complianceScore = latestSnapMap.get(c.id) ?? 0;
        return {
          id: c.id,
          name: c.name,
          province: c.province || 'Unknown',
          license_number: c.license_number || 'N/A',
          is_active: c.is_active,
          player_count: cp.length,
          high_risk: cp.filter(p => p.risk_score >= 60).length,
          interventions: ci,
          exclusions: ce,
          compliance_score: complianceScore,
        };
      });
      setCasinos(casinoRows);

      const totalPlayers  = totalPlayersRes.count ?? players.length;
      const highRisk      = highRiskRes.count ?? players.filter(p => p.risk_score >= 60).length;
      const critical      = criticalRes.count ?? players.filter(p => p.risk_score >= 80).length;
      const avgCompliance    = casinoRows.length > 0 ? Math.round(casinoRows.reduce((s, c) => s + c.compliance_score, 0) / casinoRows.length) : 0;
      const nonCompliant     = casinoRows.filter(c => c.compliance_score < 80).length;

      setSummary({
        totalCasinos: casinoList.length,
        totalPlayers,
        highRiskPlayers: highRisk,
        criticalPlayers: critical,
        totalInterventions: interventions.length,
        totalExclusions: exclusions.length,
        avgCompliance,
        nonCompliantOperators: nonCompliant,
        activeSessions: sessRes.count ?? 0,
      });
    } catch (e) {
      toast.error('Failed to load regulator data');
    } finally {
      setLoading(false);
    }
  }

  const TABS = [
    { id: 'overview',       label: 'Overview',            icon: Globe2 },
    { id: 'gambling',       label: 'Gambling Behaviour',  icon: Activity },
    { id: 'high-risk',      label: 'High Risk Players',   icon: AlertTriangle, badge: summary.criticalPlayers },
    { id: 'interventions',  label: 'Interventions',       icon: Bell },
    { id: 'operators',      label: 'Licensed Operators',  icon: Building2 },
  ];

  return (
    <ModuleGuard slug="regulator-intelligence" fallbackHref="/regulator/dashboard">
    <DashboardLayout>
      <div className="flex min-h-full flex-col">

        {/* Header */}
        <div className="border-b bg-card px-6 py-4">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <Globe2 className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold">National Regulator Intelligence</h1>
                  <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">National</Badge>
                </div>
                <p className="text-sm text-muted-foreground">Are operators complying? Unified view of all licensed operators — compliance scores, active breaches, and intervention rates in one pane.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadSummary} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-1.5" />
                Export
              </Button>
              <Button size="sm">
                <FileText className="h-4 w-4 mr-1.5" />
                Audit Report
              </Button>
            </div>
          </div>

          {/* KPI Strip */}
          <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2 mt-4">
            {[
              { label: 'Operators',          value: summary.totalCasinos,              color: '' },
              { label: 'Total Players',      value: summary.totalPlayers.toLocaleString(), color: '' },
              { label: 'High Risk',          value: summary.highRiskPlayers.toLocaleString(), color: summary.highRiskPlayers > 0 ? 'text-orange-600' : '' },
              { label: 'Critical',           value: summary.criticalPlayers.toLocaleString(), color: summary.criticalPlayers > 0 ? 'text-red-600' : '' },
              { label: 'Active Sessions',    value: summary.activeSessions.toLocaleString(), color: 'text-emerald-600' },
              { label: 'Interventions',      value: summary.totalInterventions.toLocaleString(), color: '' },
              { label: 'Active Exclusions',  value: summary.totalExclusions.toLocaleString(), color: 'text-orange-600' },
              { label: 'Avg Compliance',     value: `${summary.avgCompliance}%`, color: summary.avgCompliance >= 80 ? 'text-emerald-600' : summary.avgCompliance >= 65 ? 'text-yellow-600' : 'text-red-600' },
              { label: 'Non-Compliant',      value: summary.nonCompliantOperators,    color: summary.nonCompliantOperators > 0 ? 'text-red-600' : 'text-emerald-600' },
            ].map(k => (
              <div key={k.label} className="flex flex-col px-2 py-2 rounded-lg bg-muted/30 border">
                <span className="text-[10px] text-muted-foreground mb-0.5">{k.label}</span>
                <span className={`text-base font-bold ${k.color}`}>{k.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-1 overflow-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <div className="border-b bg-card px-6 pt-2 pb-0">
              <TabsList className="h-auto bg-transparent p-0 gap-0 border-0">
                {TABS.map(tab => {
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
                      {tab.badge !== undefined && tab.badge > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                          {tab.badge}
                        </span>
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            <div className="flex-1 p-6 min-w-0">

              {/* Overview */}
              <TabsContent value="overview" className="mt-0 space-y-6">
                <div className="mb-2">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <Globe2 className="h-5 w-5 text-primary" />
                    Nationwide Overview
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Aggregate view across all {summary.totalCasinos} licensed operators in South Africa</p>
                </div>

                {/* Compliance Health Summary */}
                <div className="grid md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-4 pb-4">
                      <p className="text-xs text-muted-foreground mb-1">National Compliance Score</p>
                      <p className={`text-4xl font-bold mb-2 ${summary.avgCompliance >= 80 ? 'text-emerald-600' : summary.avgCompliance >= 65 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {summary.avgCompliance}%
                      </p>
                      <Progress value={summary.avgCompliance} className="h-2 mb-2" />
                      <p className="text-xs text-muted-foreground">Average across all operators</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-4">
                      <p className="text-xs text-muted-foreground mb-1">Operator Compliance Status</p>
                      <div className="flex items-end gap-3 mt-2">
                        <div>
                          <p className="text-4xl font-bold text-emerald-600">{summary.totalCasinos - summary.nonCompliantOperators}</p>
                          <p className="text-xs text-muted-foreground">Compliant</p>
                        </div>
                        <div>
                          <p className="text-4xl font-bold text-red-600">{summary.nonCompliantOperators}</p>
                          <p className="text-xs text-muted-foreground">Action required</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-4">
                      <p className="text-xs text-muted-foreground mb-1">National Risk Profile</p>
                      <div className="space-y-2 mt-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-red-600">Critical (80+)</span>
                          <span className="font-semibold">{summary.criticalPlayers.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-orange-600">High (60–79)</span>
                          <span className="font-semibold">{(summary.highRiskPlayers - summary.criticalPlayers).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Total high+critical</span>
                          <span className="font-semibold">{summary.highRiskPlayers.toLocaleString()} ({summary.totalPlayers > 0 ? Math.round((summary.highRiskPlayers / summary.totalPlayers) * 100) : 0}%)</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Quick operator table */}
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold">All Licensed Operators</p>
                      <Button variant="ghost" size="sm" className="text-xs" onClick={() => setActiveTab('operators')}>
                        Full View
                      </Button>
                    </div>
                    <div className="rounded-lg border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead>Operator</TableHead>
                            <TableHead className="hidden md:table-cell">Province</TableHead>
                            <TableHead>Players</TableHead>
                            <TableHead className="hidden sm:table-cell">High Risk</TableHead>
                            <TableHead className="hidden lg:table-cell">Interventions</TableHead>
                            <TableHead>Compliance</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {casinos.slice(0, 8).map(c => (
                            <TableRow key={c.id} className="hover:bg-muted/20">
                              <TableCell className="font-medium text-sm">{c.name}</TableCell>
                              <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{c.province}</TableCell>
                              <TableCell className="text-sm">{c.player_count.toLocaleString()}</TableCell>
                              <TableCell className="hidden sm:table-cell">
                                <Badge className={`border-0 text-xs ${c.high_risk > 20 ? 'bg-red-100 text-red-700' : c.high_risk > 5 ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>{c.high_risk}</Badge>
                              </TableCell>
                              <TableCell className="hidden lg:table-cell text-sm">{c.interventions}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${c.compliance_score}%`, backgroundColor: c.compliance_score >= 80 ? '#10b981' : c.compliance_score >= 60 ? '#eab308' : '#ef4444' }} />
                                  </div>
                                  <span className="text-xs font-mono">{c.compliance_score}%</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={`border-0 text-xs ${c.compliance_score >= 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                  {c.compliance_score >= 80 ? 'Compliant' : 'Action Req.'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Gambling Behaviour */}
              <TabsContent value="gambling" className="mt-0">
                <div className="mb-4">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    National Gambling Behaviour Insights
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Player volumes, risk trends, game activity and provincial breakdown across all operators
                  </p>
                </div>
                <NationalGamblingInsights label="nationwide" />
              </TabsContent>

              {/* High Risk Players */}
              <TabsContent value="high-risk" className="mt-0">
                <div className="mb-4">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-primary" />
                    High Risk Player Analytics
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    All players with risk score 60+ across every licensed operator — operator intervention coverage
                  </p>
                </div>
                <HighRiskPlayerAnalytics />
              </TabsContent>

              {/* Interventions */}
              <TabsContent value="interventions" className="mt-0">
                <div className="mb-4">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <Bell className="h-5 w-5 text-primary" />
                    Intervention Statistics
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    National intervention activity, delivery rates, success rates, and operator coverage gaps
                  </p>
                </div>
                <InterventionStatistics />
              </TabsContent>

              {/* Licensed Operators */}
              <TabsContent value="operators" className="mt-0">
                <div className="mb-4">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    Licensed Operators — Full Register
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    All {summary.totalCasinos} licensed casino operators registered with the National Gambling Board
                  </p>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {casinos.map(c => (
                    <Card key={c.id} className={`${!c.is_active ? 'opacity-60' : ''}`}>
                      <CardContent className="pt-4 pb-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-sm">{c.name}</p>
                            <p className="text-xs text-muted-foreground font-mono mt-0.5">{c.license_number}</p>
                          </div>
                          <Badge className={`border-0 text-xs ${c.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                            {c.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {c.province}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="bg-muted/40 rounded-lg p-2">
                            <p className="text-xs text-muted-foreground">Players</p>
                            <p className="font-bold">{c.player_count.toLocaleString()}</p>
                          </div>
                          <div className={`rounded-lg p-2 ${c.high_risk > 20 ? 'bg-red-50' : 'bg-muted/40'}`}>
                            <p className="text-xs text-muted-foreground">High Risk</p>
                            <p className={`font-bold ${c.high_risk > 20 ? 'text-red-600' : ''}`}>{c.high_risk}</p>
                          </div>
                          <div className="bg-muted/40 rounded-lg p-2">
                            <p className="text-xs text-muted-foreground">Interventions</p>
                            <p className="font-bold">{c.interventions}</p>
                          </div>
                          <div className="bg-muted/40 rounded-lg p-2">
                            <p className="text-xs text-muted-foreground">Exclusions</p>
                            <p className="font-bold">{c.exclusions}</p>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Training Compliance</span>
                            <span className={`font-medium ${c.compliance_score >= 80 ? 'text-emerald-600' : c.compliance_score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>{c.compliance_score}%</span>
                          </div>
                          <Progress value={c.compliance_score} className="h-1.5" />
                        </div>
                        <Badge className={`w-full justify-center border-0 text-xs ${c.compliance_score >= 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {c.compliance_score >= 80 ? 'Compliant' : 'Action Required'}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

            </div>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
    </ModuleGuard>
  );
}
