'use client';
export const dynamic = "force-dynamic";

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { CasinoAdminGuard } from '@/components/CasinoAdminGuard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, Users, TriangleAlert as AlertTriangle, Activity, Download, RefreshCw, ShieldOff, Bell, FileText, ChartBar as BarChart3, Building2, TrendingUp, Clock, CircleCheck as CheckCircle2, Zap, Network } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PlayerRiskMonitor } from '@/components/compliance/PlayerRiskMonitor';
import { InterventionAlerts } from '@/components/compliance/InterventionAlerts';
import { ComplianceReports } from '@/components/compliance/ComplianceReports';
import { SessionBehaviourAnalytics } from '@/components/compliance/SessionBehaviourAnalytics';
import { SelfExclusionCompliance } from '@/components/compliance/SelfExclusionCompliance';
import { ModuleGuard } from '@/components/ModuleGuard';

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

export default function CasinoDashboardPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('risk-monitoring');
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

  const casinoId = user?.casino_id || '';

  useEffect(() => {
    if (casinoId) {
      loadSummary();
    }
  }, [casinoId]);

  async function loadSummary() {
    setLoadingSummary(true);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [playerCountRes, playerStatsRes, intRes, sessionsRes, exclRes, casinoRes, networkRes] = await Promise.all([
      supabase.from('players').select('*', { count: 'exact', head: true }).eq('casino_id', casinoId),
      supabase.from('players').select('risk_score').eq('casino_id', casinoId),
      supabase.from('player_protection_interventions').select('outcome, intervention_date').eq('casino_id', casinoId).limit(2000),
      supabase.from('gaming_sessions').select('*', { count: 'exact', head: true }).eq('casino_id', casinoId).eq('is_active', true),
      supabase.from('self_exclusion_registry').select('status').eq('casino_id', casinoId).eq('status', 'active'),
      supabase.from('casinos').select('name').eq('id', casinoId).maybeSingle(),
      supabase.from('sen_breach_detections').select('status').or(`detecting_casino_id.eq.${casinoId},originating_casino_id.eq.${casinoId}`).eq('status', 'open'),
    ]);

    const totalPlayers = playerCountRes.count ?? 0;
    const playerScores = playerStatsRes.data || [];
    const interventions = intRes.data || [];
    const todayInt = interventions.filter(i => new Date(i.intervention_date) >= todayStart);

    if (casinoRes.data?.name) setCasinoName(casinoRes.data.name);

    const critical = playerScores.filter(p => p.risk_score >= 80).length;
    const pending  = interventions.filter(i => !i.outcome || i.outcome === 'pending').length;

    // Simple compliance estimate
    const coveragePct = playerScores.length > 0 ? Math.min(100, Math.round((playerScores.filter(p => p.risk_score != null).length / playerScores.length) * 100)) : 100;
    const interventionCoverage = critical > 0 ? Math.min(100, Math.round((interventions.filter(i => i.outcome && i.outcome !== 'pending').length / critical) * 100)) : 100;
    const complianceScore = Math.round((coveragePct + interventionCoverage) / 2);

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
      badge: summary.openBreaches > 0 ? summary.openBreaches : summary.activeExclusions > 0 ? summary.activeExclusions : undefined,
      badgeClass: summary.openBreaches > 0 ? 'bg-red-500' : 'bg-orange-500',
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
                  <p className="text-sm text-muted-foreground">{casinoName || 'Casino'} · National Gambling Act compliance</p>
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
                const isBreachCard = k.label === 'Open Breaches' && summary.openBreaches > 0;
                return (
                  <div
                    key={k.label}
                    onClick={isBreachCard ? () => setActiveTab('self-exclusion') : undefined}
                    className={`flex flex-col items-start px-3 py-2 rounded-lg bg-muted/30 border ${isBreachCard ? 'cursor-pointer hover:border-red-400 hover:bg-red-50/30 transition-colors' : ''}`}
                  >
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
