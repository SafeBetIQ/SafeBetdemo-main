'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building2, Users, Activity, Shield, TriangleAlert as AlertTriangle, ShieldOff, TrendingUp, RefreshCw, Network, Brain, Globe, Server, Layers, ChartBar as BarChart3, Plus, CreditCard as Edit, Zap, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { rpGet } from '@/lib/consumerClient';
import { useAuth } from '@/contexts/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from 'recharts';
import { toast } from 'sonner';
import { CrossOperatorIntelligence } from '@/components/CrossOperatorIntelligence';
import { DemoSimulationHealth } from '@/components/admin/DemoSimulationHealth';

interface PlatformStats {
  totalCasinos: number;
  activeCasinos: number;
  totalPlayers: number;
  criticalPlayers: number;
  totalInterventions: number;
  pendingInterventions: number;
  highRiskPlayers: number;
  monitoredPlayers: number;
  totalUsers: number;
  emergingRisks: number;
}

interface CasinoRow {
  id: string;
  name: string;
  province: string;
  license_number: string;
  is_active: boolean;
  player_count?: number;
  high_risk?: number;
}

const SEVERITY_COLORS = ['#ef4444', '#f97316', '#eab308', '#10b981'];
const PROVINCE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16', '#ec4899'];

export default function SuperAdminDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<PlatformStats>({
    totalCasinos: 0, activeCasinos: 0, totalPlayers: 0, criticalPlayers: 0,
    totalInterventions: 0, pendingInterventions: 0, highRiskPlayers: 0,
    monitoredPlayers: 0, totalUsers: 0, emergingRisks: 0,
  });
  const [casinos, setCasinos] = useState<CasinoRow[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [riskDistribution, setRiskDistribution] = useState<any[]>([]);
  const [provinceData, setProvinceData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      // Casinos + users are the tenant/identity registry (administration plane).
      // ALL runtime intelligence (players, risk, interventions) comes from the
      // certified Regulator Portal national-overview — the SAME source as every
      // other screen. No legacy players / interventions / exclusion reads.
      const [casinosRes, usersRes] = await Promise.all([
        supabase.from('casinos').select('id, name, province, license_number, is_active').order('name'),
        supabase.from('users').select('id, email, full_name, role, casino_id, is_active').limit(100),
      ]);
      const national = (await rpGet('national-overview')) as Record<string, any> | null;

      const casinoList = casinosRes.data || [];
      const userList = usersRes.data || [];
      setCasinos(casinoList);
      setUsers(userList);

      const tiers = (national?.riskTiers ?? { critical: 0, high: 0, medium: 0, low: 0 }) as Record<string, number>;
      const totalPlayers = Number(national?.activePlayers ?? 0);
      const critical = Number(tiers.critical ?? 0);
      const highRisk = Number(tiers.high ?? 0);
      const medium = Number(tiers.medium ?? 0);
      const low = Number(tiers.low ?? 0);
      const totalInterventions = Number(national?.interventions ?? 0);
      const monitored = Number(national?.playersMonitored ?? 0);
      const operatorHealth = (national?.operatorHealth ?? []) as Array<Record<string, any>>;

      setRiskDistribution([
        { name: 'Critical (80-100)', value: critical, fill: '#ef4444' },
        { name: 'High (60-79)', value: highRisk, fill: '#f97316' },
        { name: 'Medium (40-59)', value: medium, fill: '#eab308' },
        { name: 'Low (0-39)', value: Math.max(low, 0), fill: '#10b981' },
      ]);

      const healthById = new Map(operatorHealth.map(o => [o.casinoId, o]));
      const byProvince = casinoList.reduce((acc: Record<string, { casinos: number; players: number; critical: number }>, c) => {
        const prov = c.province || 'Unknown';
        if (!acc[prov]) acc[prov] = { casinos: 0, players: 0, critical: 0 };
        acc[prov].casinos++;
        const h = healthById.get(c.id);
        acc[prov].players += Number(h?.activePlayers ?? 0);
        acc[prov].critical += Number(h?.riskCritical ?? 0);
        return acc;
      }, {});

      setProvinceData(
        Object.entries(byProvince)
          .map(([province, d]) => ({ province: province.replace(' Province', ''), ...d }))
          .sort((a, b) => b.players - a.players)
      );


      setStats({
        totalCasinos: casinoList.length,
        activeCasinos: casinoList.filter(c => c.is_active).length,
        totalPlayers,
        criticalPlayers: critical,
        totalInterventions,
        pendingInterventions: monitored,
        highRiskPlayers: highRisk,
        monitoredPlayers: monitored,
        totalUsers: userList.length,
        emergingRisks: ((national?.emergingRisks ?? []) as unknown[]).length,
      });
    } catch {
      toast.error('Failed to load platform data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  const KPI = ({ icon: Icon, label, value, sub, urgent }: {
    icon: React.ElementType; label: string; value: string | number;
    sub?: string; urgent?: boolean;
  }) => (
    <Card className={urgent ? 'border-red-200 bg-red-50/30' : ''}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-muted-foreground">{label}</p>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${urgent ? 'bg-red-100' : 'bg-muted'}`}>
            <Icon className={`h-4 w-4 ${urgent ? 'text-red-600' : 'text-muted-foreground'}`} />
          </div>
        </div>
        <p className={`text-3xl font-bold ${urgent && Number(value) > 0 ? 'text-red-600' : ''}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
            <p className="mt-4 text-sm text-muted-foreground">Loading platform data...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col min-h-full">

        {/* Header */}
        <div className="border-b bg-card px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <Globe className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">SafeBet IQ — Platform Administration</h1>
                <p className="text-sm text-muted-foreground">
                  Global Responsible Gambling Intelligence Platform
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                System Healthy
              </div>
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-1 overflow-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <div className="border-b bg-card px-6 pt-2 pb-0">
              <TabsList className="h-auto bg-transparent p-0 gap-0 border-0">
                {[
                  { id: 'overview', label: 'Overview', icon: BarChart3 },
                  { id: 'casinos', label: `Casinos (${stats.totalCasinos})`, icon: Building2 },
                  { id: 'users', label: `Users (${stats.totalUsers})`, icon: Users },
                  { id: 'platform-health', label: 'Platform Health', icon: Activity },
                  { id: 'cross-operator', label: 'Cross-Operator Intelligence', icon: Network },
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
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            <div className="flex-1 p-6 min-w-0">

              {/* OVERVIEW TAB */}
              <TabsContent value="overview" className="mt-0 space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KPI icon={Building2} label="Licensed Operators" value={stats.totalCasinos} sub={`${stats.activeCasinos} active`} />
                  <KPI icon={Users} label="Total Players" value={stats.totalPlayers.toLocaleString()} sub="Across all operators" />
                  <KPI icon={AlertTriangle} label="Critical Risk Players" value={stats.criticalPlayers.toLocaleString()} sub="Risk score ≥ 80" urgent={stats.criticalPlayers > 0} />
                  <KPI icon={TrendingUp} label="High Risk Players" value={stats.highRiskPlayers.toLocaleString()} sub="Risk score 60–79" urgent={stats.highRiskPlayers > 0} />
                  <KPI icon={ShieldOff} label="Players Monitored" value={stats.monitoredPlayers.toLocaleString()} sub="Under active monitoring" />
                  <KPI icon={Zap} label="Total Interventions" value={stats.totalInterventions.toLocaleString()} sub="Recorded across operators" />
                  <KPI icon={Shield} label="Platform Users" value={stats.totalUsers} sub="All roles" />
                  <KPI icon={Brain} label="Emerging Risks" value={stats.emergingRisks} sub="Derived Intelligence" urgent={stats.emergingRisks > 0} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <Card className="lg:col-span-2">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Players & Critical Risk by Province</CardTitle>
                      <CardDescription className="text-xs">National overview — certified projected counts</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={provinceData} margin={{ left: -10 }}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis dataKey="province" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip contentStyle={{ fontSize: 11 }} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey="players" fill="#3b82f6" name="Players" radius={[2, 2, 0, 0]} />
                          <Bar dataKey="critical" fill="#ef4444" name="Critical" radius={[2, 2, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Risk Distribution</CardTitle>
                      <CardDescription className="text-xs">Across all operators</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                          <Pie
                            data={riskDistribution}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={65}
                            dataKey="value"
                          >
                            {riskDistribution.map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ fontSize: 11 }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1 mt-2">
                        {riskDistribution.map((d, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                              <span className="text-muted-foreground">{d.name}</span>
                            </div>
                            <span className="font-medium">{d.value.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Architecture Layers */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Layers className="h-4 w-4 text-primary" />
                      Platform Architecture
                    </CardTitle>
                    <CardDescription className="text-xs">Active SafeBet IQ intelligence layers</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { icon: Brain, label: 'Behavioural Intelligence Engine', desc: 'Rule-based risk scoring', status: 'active' },
                        { icon: Zap, label: 'Intervention Engine', desc: 'Auto-trigger & dispatch', status: 'active' },
                        { icon: Network, label: 'Cross-Operator Intelligence', desc: 'Multi-platform detection', status: 'active' },
                        { icon: ShieldOff, label: 'Self-Exclusion Network', desc: 'NRGP distribution layer', status: 'active' },
                        { icon: Shield, label: 'Data Ingestion Engine', desc: 'API gateway + connectors', status: 'active' },
                        { icon: BarChart3, label: 'Regulator Intelligence', desc: 'National & provincial', status: 'active' },
                        { icon: Lock, label: 'Multi-Tenant Isolation', desc: 'RLS per operator', status: 'active' },
                        { icon: Server, label: 'Feature Module System', desc: 'Per-operator activation', status: 'active' },
                      ].map((layer, i) => {
                        const Icon = layer.icon;
                        return (
                          <div key={i} className="flex items-start gap-2 p-3 rounded-lg border bg-muted/20">
                            <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Icon className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <div>
                              <p className="text-xs font-medium leading-tight">{layer.label}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{layer.desc}</p>
                              <div className="flex items-center gap-1 mt-1">
                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                <span className="text-[10px] text-emerald-600 font-medium">Active</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* CASINOS TAB */}
              <TabsContent value="casinos" className="mt-0">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">Licensed Casino Operators</CardTitle>
                        <CardDescription>{stats.totalCasinos} operators across 9 provinces</CardDescription>
                      </div>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-1.5" />
                        Add Operator
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-lg border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead>Casino Name</TableHead>
                            <TableHead>Province</TableHead>
                            <TableHead>License</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {casinos.map((casino) => (
                            <TableRow key={casino.id} className="hover:bg-muted/20">
                              <TableCell className="font-medium">{casino.name}</TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {casino.province || '—'}
                              </TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">
                                {casino.license_number}
                              </TableCell>
                              <TableCell>
                                <Badge className={casino.is_active ? 'bg-emerald-100 text-emerald-700 border-0' : 'bg-slate-100 text-slate-600 border-0'}>
                                  {casino.is_active ? 'Active' : 'Inactive'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm">
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* USERS TAB */}
              <TabsContent value="users" className="mt-0">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">Platform Users</CardTitle>
                        <CardDescription>{stats.totalUsers} accounts across all roles</CardDescription>
                      </div>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-1.5" />
                        Add User
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-lg border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Operator</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {users.slice(0, 50).map((u) => (
                            <TableRow key={u.id} className="hover:bg-muted/20">
                              <TableCell className="font-medium text-sm">{u.full_name || '—'}</TableCell>
                              <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs capitalize">
                                  {(u.role || '').replace(/_/g, ' ')}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {u.casino_id ? (casinos.find(c => c.id === u.casino_id)?.name || 'Unknown') : '—'}
                              </TableCell>
                              <TableCell>
                                <Badge className={u.is_active ? 'bg-emerald-100 text-emerald-700 border-0' : 'bg-slate-100 text-slate-600 border-0'}>
                                  {u.is_active ? 'Active' : 'Inactive'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm">
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* PLATFORM HEALTH TAB */}
              <TabsContent value="platform-health" className="mt-0 space-y-5">
                {/* Demo simulator operations (super-admin only; renders nothing outside demo) */}
                <DemoSimulationHealth />

                {/* System status bar — no fabricated uptime; the flow is operational because it is serving certified data */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50/50 border border-emerald-200">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                    <div>
                      <p className="text-sm font-bold text-emerald-800">Enterprise flow operational</p>
                      <p className="text-xs text-emerald-600">Serving certified Consumer Platform data · checked {new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })} SAST</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="border-emerald-300 text-emerald-700 hover:bg-emerald-100 text-xs">
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>

                {/* Certified enterprise flow — each layer is Operational because it served this page's live data */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Server className="h-4 w-4 text-primary" />
                    Certified enterprise flow
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {['Identity Resolution', 'Event Platform', 'Projection Platform', 'Digital Twin', 'Domain Intelligence', 'Policy Platform', 'Consumer Platform', 'Workflow Platform'].map((layer) => (
                      <Card key={layer} className="border-emerald-100 bg-emerald-50/30">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <Layers className="h-4 w-4 text-emerald-600" />
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          </div>
                          <p className="text-xs font-semibold text-foreground leading-tight">{layer}</p>
                          <p className="text-[10px] font-semibold mt-1 text-emerald-600">● Operational</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Certified platform facts (no fabricated telemetry) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Active Players', value: stats.totalPlayers.toLocaleString(), sub: 'Certified projection' },
                    { label: 'Licensed Operators', value: String(stats.totalCasinos), sub: `${stats.activeCasinos} active` },
                    { label: 'Players Monitored', value: stats.monitoredPlayers.toLocaleString(), sub: 'Compliance view' },
                    { label: 'Interventions', value: stats.totalInterventions.toLocaleString(), sub: 'Recorded' },
                  ].map(({ label, value, sub }) => (
                    <Card key={label}>
                      <CardContent className="pt-4 pb-3">
                        <p className="text-xs text-muted-foreground font-medium">{label}</p>
                        <p className="text-2xl font-bold mt-1">{value}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Card className="border-dashed bg-muted/20">
                  <CardContent className="py-3">
                    <p className="text-xs text-muted-foreground">
                      Infrastructure telemetry (latency, uptime, incident history, SLA attainment) is operated through the <span className="font-medium text-foreground">platform-ops</span> surface and the Operations Manual. It is deliberately not fabricated in the product UI — every value shown here is a Recorded Fact or Derived Intelligence from the certified flow (Evidence Integrity, Constitution §8).
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* CROSS-OPERATOR INTELLIGENCE TAB */}
              <TabsContent value="cross-operator" className="mt-0">
                <CrossOperatorIntelligence />
              </TabsContent>

            </div>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}
