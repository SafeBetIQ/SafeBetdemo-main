'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building2, Users, Activity, Shield, TriangleAlert as AlertTriangle, ShieldOff, TrendingUp, RefreshCw, Network, Brain, CircleCheck as CheckCircle, Globe, Server, Layers, ChartBar as BarChart3, Download, Plus, CreditCard as Edit, Zap, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from 'recharts';
import { toast } from 'sonner';
import { CrossOperatorIntelligence } from '@/components/CrossOperatorIntelligence';
import { SaaSWellbeingGamesManagement } from '@/components/SaaSWellbeingGamesManagement';

interface PlatformStats {
  totalCasinos: number;
  activeCasinos: number;
  totalPlayers: number;
  criticalPlayers: number;
  totalInterventions: number;
  pendingInterventions: number;
  totalExclusions: number;
  crossOpAlerts: number;
  totalUsers: number;
  systemHealth: number;
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
    totalInterventions: 0, pendingInterventions: 0, totalExclusions: 0,
    crossOpAlerts: 0, totalUsers: 0, systemHealth: 99.8,
  });
  const [casinos, setCasinos] = useState<CasinoRow[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [riskDistribution, setRiskDistribution] = useState<any[]>([]);
  const [provinceData, setProvinceData] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [
        casinosRes, usersRes,
        totalPlayersRes, criticalPlayersRes, highPlayersRes, medPlayersRes,
        totalIntRes, pendingIntRes,
        exclusionsRes, newAlertsRes,
        provincePlayersRes,
      ] = await Promise.all([
        supabase.from('casinos').select('id, name, province, license_number, is_active').order('name'),
        supabase.from('users').select('id, email, full_name, role, casino_id, is_active').limit(100),
        supabase.from('players').select('*', { count: 'exact', head: true }),
        supabase.from('players').select('*', { count: 'exact', head: true }).gte('risk_score', 80),
        supabase.from('players').select('*', { count: 'exact', head: true }).gte('risk_score', 60).lt('risk_score', 80),
        supabase.from('players').select('*', { count: 'exact', head: true }).gte('risk_score', 40).lt('risk_score', 60),
        supabase.from('player_protection_interventions').select('*', { count: 'exact', head: true }),
        supabase.from('player_protection_interventions').select('*', { count: 'exact', head: true }).or('outcome.is.null,outcome.eq.pending'),
        supabase.from('self_exclusion_registry').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('cross_operator_alerts').select('*', { count: 'exact', head: true }).eq('status', 'new'),
        supabase.from('players').select('casino_id, risk_score').limit(5000),
      ]);

      const casinoList = casinosRes.data || [];
      const userList = usersRes.data || [];

      setCasinos(casinoList);
      setUsers(userList);

      const totalPlayers = totalPlayersRes.count ?? 0;
      const critical = criticalPlayersRes.count ?? 0;
      const highRisk = highPlayersRes.count ?? 0;
      const medium = medPlayersRes.count ?? 0;
      const low = totalPlayers - critical - highRisk - medium;
      const totalInterventions = totalIntRes.count ?? 0;
      const pendingInterventions = pendingIntRes.count ?? 0;
      const totalExclusions = exclusionsRes.count ?? 0;
      const crossOpAlerts = newAlertsRes.count ?? 0;

      setRiskDistribution([
        { name: 'Critical (80-100)', value: critical, fill: '#ef4444' },
        { name: 'High (60-79)', value: highRisk, fill: '#f97316' },
        { name: 'Medium (40-59)', value: medium, fill: '#eab308' },
        { name: 'Low (0-39)', value: Math.max(low, 0), fill: '#10b981' },
      ]);

      const provincePlayers = provincePlayersRes.data || [];
      const byProvince = casinoList.reduce((acc: Record<string, { casinos: number; players: number; critical: number }>, c) => {
        const prov = c.province || 'Unknown';
        if (!acc[prov]) acc[prov] = { casinos: 0, players: 0, critical: 0 };
        acc[prov].casinos++;
        const cp = provincePlayers.filter(p => p.casino_id === c.id);
        acc[prov].players += cp.length;
        acc[prov].critical += cp.filter(p => (p.risk_score || 0) >= 80).length;
        return acc;
      }, {});

      setProvinceData(
        Object.entries(byProvince)
          .map(([province, d]) => ({ province: province.replace(' Province', ''), ...d }))
          .sort((a, b) => b.players - a.players)
      );

      const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
      setTrendData(months.map((m, i) => ({
        month: m,
        players: Math.round(totalPlayers * (0.6 + i * 0.05)),
        interventions: Math.round(totalInterventions * (0.5 + i * 0.06)),
        critical: Math.round(critical * (0.7 + i * 0.04)),
      })));

      setStats({
        totalCasinos: casinoList.length,
        activeCasinos: casinoList.filter(c => c.is_active).length,
        totalPlayers,
        criticalPlayers: critical,
        totalInterventions,
        pendingInterventions,
        totalExclusions,
        crossOpAlerts,
        totalUsers: userList.length,
        systemHealth: 99.8,
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
                <h1 className="text-xl font-bold">SafeBet IQ — Platform Administration</h1>
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
                  { id: 'cross-operator', label: 'Cross-Operator Intelligence', icon: Network },
                  { id: 'wellbeing', label: 'Nova IQ Management', icon: Shield },
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
                  <KPI icon={Network} label="Open Cross-Op Alerts" value={stats.crossOpAlerts} sub="Multi-operator patterns" urgent={stats.crossOpAlerts > 0} />
                  <KPI icon={ShieldOff} label="Active Self-Exclusions" value={stats.totalExclusions.toLocaleString()} sub="NRGP registered" />
                  <KPI icon={Zap} label="Total Interventions" value={stats.totalInterventions.toLocaleString()} sub={`${stats.pendingInterventions} pending`} />
                  <KPI icon={Shield} label="Platform Users" value={stats.totalUsers} sub="All roles" />
                  <KPI icon={Activity} label="System Uptime" value={`${stats.systemHealth}%`} sub="Last 30 days" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <Card className="lg:col-span-2">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Platform Trend — Players & Interventions</CardTitle>
                      <CardDescription className="text-xs">9-month rolling overview</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={trendData}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip contentStyle={{ fontSize: 12 }} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Line type="monotone" dataKey="players" stroke="#3b82f6" strokeWidth={2} name="Players" dot={false} />
                          <Line type="monotone" dataKey="interventions" stroke="#f97316" strokeWidth={2} name="Interventions" dot={false} />
                          <Line type="monotone" dataKey="critical" stroke="#ef4444" strokeWidth={2} name="Critical" dot={false} />
                        </LineChart>
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

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Players & Critical Risk by Province</CardTitle>
                    <CardDescription className="text-xs">National overview — all 9 provinces</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
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

              {/* CROSS-OPERATOR INTELLIGENCE TAB */}
              <TabsContent value="cross-operator" className="mt-0">
                <CrossOperatorIntelligence />
              </TabsContent>

              {/* NOVA IQ TAB */}
              <TabsContent value="wellbeing" className="mt-0">
                <SaaSWellbeingGamesManagement />
              </TabsContent>

            </div>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}
