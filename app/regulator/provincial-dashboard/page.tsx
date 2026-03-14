'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { MapPin, Building2, Users, TriangleAlert as AlertTriangle, Activity, Download, FileText, Shield, ShieldCheck, RefreshCw, Bell, Globe as Globe2, TrendingUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { NationalGamblingInsights } from '@/components/regulator/NationalGamblingInsights';
import { HighRiskPlayerAnalytics } from '@/components/regulator/HighRiskPlayerAnalytics';
import { InterventionStatistics } from '@/components/regulator/InterventionStatistics';
import { toast } from 'sonner';

interface RegulatorProfile {
  full_name: string;
  organisation_name: string;
  province: string;
  license_authority: string;
  jurisdiction_type: string;
}

interface ProvincialSummary {
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

interface CasinoCard {
  id: string;
  name: string;
  license_number: string;
  is_active: boolean;
  player_count: number;
  high_risk: number;
  critical: number;
  interventions: number;
  exclusions: number;
  training_rate: number;
}

export default function ProvincialRegulatorDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [profile, setProfile] = useState<RegulatorProfile | null>(null);
  const [summary, setSummary] = useState<ProvincialSummary>({
    totalCasinos: 0, totalPlayers: 0, highRiskPlayers: 0, criticalPlayers: 0,
    totalInterventions: 0, totalExclusions: 0, avgCompliance: 0,
    nonCompliantOperators: 0, activeSessions: 0,
  });
  const [casinos, setCasinos] = useState<CasinoCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    try {
      let province = '';
      if (user?.id) {
        const { data: p } = await supabase
          .from('regulators')
          .select('full_name, organisation_name, province, license_authority, jurisdiction_type')
          .eq('user_id', user.id)
          .maybeSingle();
        if (p) { setProfile(p); province = p.province || ''; }
      }

      let casinoQuery = supabase.from('casinos').select('id, name, license_number, province, is_active');
      if (province) casinoQuery = casinoQuery.eq('province', province);
      const { data: casinoList } = await casinoQuery.order('name');
      if (!casinoList || casinoList.length === 0) { setLoading(false); return; }

      const casinoIds = casinoList.map(c => c.id);
      const [playersRes, intRes, exclRes, sessRes, enrollRes] = await Promise.all([
        supabase.from('players').select('casino_id, risk_level').in('casino_id', casinoIds),
        supabase.from('player_protection_interventions').select('casino_id').in('casino_id', casinoIds),
        supabase.from('self_exclusion_registry').select('casino_id').in('casino_id', casinoIds).eq('status', 'active'),
        supabase.from('gaming_sessions').select('casino_id').in('casino_id', casinoIds).eq('is_active', true),
        supabase.from('training_enrollments').select('casino_id, status').in('casino_id', casinoIds),
      ]);

      const players      = playersRes.data || [];
      const interventions= intRes.data || [];
      const exclusions   = exclRes.data || [];
      const sessions     = sessRes.data || [];
      const enrollments  = enrollRes.data || [];

      const cards: CasinoCard[] = casinoList.map(c => {
        const cp  = players.filter(p => p.casino_id === c.id);
        const ci  = interventions.filter(i => i.casino_id === c.id).length;
        const ce  = exclusions.filter(e => e.casino_id === c.id).length;
        const enr = enrollments.filter(e => e.casino_id === c.id);
        const done = enr.filter(e => e.status === 'completed').length;
        return {
          id: c.id, name: c.name,
          license_number: c.license_number || 'N/A',
          is_active: c.is_active,
          player_count: cp.length,
          high_risk: cp.filter(p => p.risk_level === 'high' || p.risk_level === 'critical').length,
          critical: cp.filter(p => p.risk_level === 'critical').length,
          interventions: ci, exclusions: ce,
          training_rate: enr.length > 0 ? Math.round((done / enr.length) * 100) : 0,
        };
      });
      setCasinos(cards);

      const avgCompliance = cards.length > 0 ? Math.round(cards.reduce((s, c) => s + c.training_rate, 0) / cards.length) : 0;
      setSummary({
        totalCasinos: cards.length,
        totalPlayers: players.length,
        highRiskPlayers: players.filter(p => p.risk_level === 'high' || p.risk_level === 'critical').length,
        criticalPlayers: players.filter(p => p.risk_level === 'critical').length,
        totalInterventions: interventions.length,
        totalExclusions: exclusions.length,
        avgCompliance,
        nonCompliantOperators: cards.filter(c => c.training_rate < 80).length,
        activeSessions: sessions.length,
      });
    } catch (e) {
      toast.error('Failed to load provincial dashboard data');
    } finally {
      setLoading(false);
    }
  }

  const province  = profile?.province || '';
  const authority = profile?.license_authority || '';
  const orgName   = profile?.organisation_name || 'Provincial Gambling Board';

  const TABS = [
    { id: 'overview',       label: 'Overview',           icon: MapPin },
    { id: 'gambling',       label: 'Gambling Behaviour', icon: Activity },
    { id: 'high-risk',      label: 'High Risk Players',  icon: AlertTriangle, badge: summary.criticalPlayers },
    { id: 'interventions',  label: 'Interventions',      icon: Bell },
    { id: 'operators',      label: 'Operators',          icon: Building2 },
  ];

  return (
    <DashboardLayout>
      <div className="flex h-full flex-col">

        {/* Header */}
        <div className="border-b bg-card px-6 py-4">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <MapPin className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold">{province ? `${province} Regulator Intelligence` : 'Provincial Regulator Intelligence'}</h1>
                  <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Provincial</Badge>
                  {authority && (
                    <Badge className="bg-slate-100 text-slate-600 border-0 text-xs flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" />{authority}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{orgName} · {casinos.length} licensed operator{casinos.length !== 1 ? 's' : ''} in your jurisdiction</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
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
              { label: 'Operators',        value: summary.totalCasinos,                          color: '' },
              { label: 'Total Players',    value: summary.totalPlayers.toLocaleString(),          color: '' },
              { label: 'High Risk',        value: summary.highRiskPlayers.toLocaleString(),       color: summary.highRiskPlayers > 0 ? 'text-orange-600' : '' },
              { label: 'Critical',         value: summary.criticalPlayers.toLocaleString(),       color: summary.criticalPlayers > 0 ? 'text-red-600' : '' },
              { label: 'Active Sessions',  value: summary.activeSessions.toLocaleString(),        color: 'text-emerald-600' },
              { label: 'Interventions',    value: summary.totalInterventions.toLocaleString(),    color: '' },
              { label: 'Exclusions',       value: summary.totalExclusions.toLocaleString(),       color: 'text-orange-600' },
              { label: 'Avg Compliance',   value: `${summary.avgCompliance}%`,                   color: summary.avgCompliance >= 80 ? 'text-emerald-600' : summary.avgCompliance >= 65 ? 'text-yellow-600' : 'text-red-600' },
              { label: 'Non-Compliant',    value: summary.nonCompliantOperators,                  color: summary.nonCompliantOperators > 0 ? 'text-red-600' : 'text-emerald-600' },
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

            <div className="flex-1 overflow-auto p-6">

              {/* Overview */}
              <TabsContent value="overview" className="mt-0 space-y-6">
                <div className="mb-2">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    {province} Provincial Overview
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Jurisdictional compliance and player protection across {casinos.length} operator{casinos.length !== 1 ? 's' : ''} in {province || 'your province'}
                  </p>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-4 pb-4">
                      <p className="text-xs text-muted-foreground mb-1">Provincial Compliance Score</p>
                      <p className={`text-4xl font-bold mb-2 ${summary.avgCompliance >= 80 ? 'text-emerald-600' : summary.avgCompliance >= 65 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {summary.avgCompliance}%
                      </p>
                      <Progress value={summary.avgCompliance} className="h-2 mb-2" />
                      <p className="text-xs text-muted-foreground">Average across operators in {province}</p>
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
                      <p className="text-xs text-muted-foreground mb-1">Provincial Risk Profile</p>
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

                {/* Operator cards quick summary */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {casinos.slice(0, 6).map(c => (
                    <Card key={c.id}>
                      <CardContent className="pt-3 pb-3 space-y-2">
                        <div className="flex items-start justify-between">
                          <p className="font-semibold text-sm">{c.name}</p>
                          <Badge className={`border-0 text-xs ${c.training_rate >= 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {c.training_rate >= 80 ? 'Compliant' : 'Action Req.'}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 text-center">
                          <div className="bg-muted/40 rounded p-1.5">
                            <p className="text-[10px] text-muted-foreground">Players</p>
                            <p className="text-sm font-bold">{c.player_count}</p>
                          </div>
                          <div className={`rounded p-1.5 ${c.high_risk > 10 ? 'bg-orange-50' : 'bg-muted/40'}`}>
                            <p className="text-[10px] text-muted-foreground">High Risk</p>
                            <p className={`text-sm font-bold ${c.high_risk > 10 ? 'text-orange-600' : ''}`}>{c.high_risk}</p>
                          </div>
                          <div className="bg-muted/40 rounded p-1.5">
                            <p className="text-[10px] text-muted-foreground">Interventions</p>
                            <p className="text-sm font-bold">{c.interventions}</p>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] mb-1">
                            <span className="text-muted-foreground">Training</span>
                            <span className="font-medium">{c.training_rate}%</span>
                          </div>
                          <Progress value={c.training_rate} className="h-1" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {casinos.length > 6 && (
                    <Card className="border-dashed flex items-center justify-center">
                      <CardContent className="py-6 text-center">
                        <p className="text-sm text-muted-foreground">+{casinos.length - 6} more operators</p>
                        <Button variant="outline" size="sm" className="mt-2 text-xs" onClick={() => setActiveTab('operators')}>
                          View All
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>

              {/* Gambling Behaviour */}
              <TabsContent value="gambling" className="mt-0">
                <div className="mb-4">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    {province} Gambling Behaviour Insights
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Player volumes, risk trends, and game activity for operators in {province || 'your province'}
                  </p>
                </div>
                <NationalGamblingInsights province={province} label={province} />
              </TabsContent>

              {/* High Risk Players */}
              <TabsContent value="high-risk" className="mt-0">
                <div className="mb-4">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-primary" />
                    High Risk Player Analytics
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Players with risk score 60+ at operators in {province || 'your province'} — intervention coverage
                  </p>
                </div>
                <HighRiskPlayerAnalytics province={province} />
              </TabsContent>

              {/* Interventions */}
              <TabsContent value="interventions" className="mt-0">
                <div className="mb-4">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <Bell className="h-5 w-5 text-primary" />
                    Intervention Statistics
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Intervention activity, delivery rates, and coverage gaps across {province || 'your province'} operators
                  </p>
                </div>
                <InterventionStatistics province={province} />
              </TabsContent>

              {/* Operators */}
              <TabsContent value="operators" className="mt-0">
                <div className="mb-4">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    Licensed Operators — {province}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    All {casinos.length} licensed operators under {orgName} jurisdiction
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
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="bg-muted/40 rounded-lg p-2">
                            <p className="text-xs text-muted-foreground">Players</p>
                            <p className="font-bold">{c.player_count.toLocaleString()}</p>
                          </div>
                          <div className={`rounded-lg p-2 ${c.high_risk > 10 ? 'bg-orange-50' : 'bg-muted/40'}`}>
                            <p className="text-xs text-muted-foreground">High Risk</p>
                            <p className={`font-bold ${c.high_risk > 10 ? 'text-orange-600' : ''}`}>{c.high_risk}</p>
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
                            <span className={`font-medium ${c.training_rate >= 80 ? 'text-emerald-600' : c.training_rate >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>{c.training_rate}%</span>
                          </div>
                          <Progress value={c.training_rate} className="h-1.5" />
                        </div>
                        <Badge className={`w-full justify-center border-0 text-xs ${c.training_rate >= 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {c.training_rate >= 80 ? 'Compliant' : 'Action Required'}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                  {casinos.length === 0 && (
                    <div className="col-span-3 text-center py-16 text-muted-foreground text-sm">
                      No operators found in your jurisdiction
                    </div>
                  )}
                </div>
              </TabsContent>

            </div>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}
