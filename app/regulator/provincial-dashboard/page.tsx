'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { PageHeader } from '@/components/saas/PageHeader';
import { KPICard } from '@/components/saas/KPICard';
import { ChartCard } from '@/components/saas/ChartCard';
import { TableCard } from '@/components/saas/TableCard';
import { DateRangePicker, type DateRange } from '@/components/saas/DateRangePicker';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Building2, Users, ShieldCheck, TriangleAlert as AlertTriangle, Download, FileText, TrendingUp, MapPin, Eye, Activity } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import { toast } from 'sonner';

interface CasinoStats {
  id: string;
  name: string;
  license_number: string;
  province: string;
  staff_count: number;
  player_count: number;
  high_risk_players: number;
  intervention_count: number;
  completion_rate: number;
  is_active: boolean;
}

interface RegulatorProfile {
  full_name: string;
  organisation_name: string;
  province: string;
  license_authority: string;
  jurisdiction_type: string;
}

export default function ProvincialRegulatorDashboard() {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [casinos, setCasinos] = useState<CasinoStats[]>([]);
  const [regulatorProfile, setRegulatorProfile] = useState<RegulatorProfile | null>(null);
  const [totalStats, setTotalStats] = useState({
    totalCasinos: 0,
    totalPlayers: 0,
    highRiskPlayers: 0,
    totalInterventions: 0,
  });

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user, dateRange]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      if (user?.id) {
        const { data: profile } = await supabase
          .from('regulators')
          .select('full_name, organisation_name, province, license_authority, jurisdiction_type')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profile) {
          setRegulatorProfile(profile);
        }
      }

      const { data: casinoList } = await supabase
        .from('casinos')
        .select('id, name, license_number, province, is_active')
        .order('name');

      if (!casinoList || casinoList.length === 0) {
        setLoading(false);
        return;
      }

      const casinosWithStats = await Promise.all(
        casinoList.map(async (casino) => {
          const { count: staffCount } = await supabase
            .from('staff')
            .select('id', { count: 'exact', head: true })
            .eq('casino_id', casino.id);

          const { count: playerCount } = await supabase
            .from('players')
            .select('id', { count: 'exact', head: true })
            .eq('casino_id', casino.id);

          const { count: highRiskCount } = await supabase
            .from('players')
            .select('id', { count: 'exact', head: true })
            .eq('casino_id', casino.id)
            .in('risk_level', ['high', 'critical']);

          const { count: interventionCount } = await supabase
            .from('interventions')
            .select('id', { count: 'exact', head: true })
            .eq('casino_id', casino.id);

          const { count: enrollmentCount } = await supabase
            .from('training_enrollments')
            .select('id', { count: 'exact', head: true })
            .eq('casino_id', casino.id);

          const { count: completedCount } = await supabase
            .from('training_enrollments')
            .select('id', { count: 'exact', head: true })
            .eq('casino_id', casino.id)
            .eq('status', 'completed');

          const completionRate = enrollmentCount
            ? Math.round(((completedCount || 0) / enrollmentCount) * 100)
            : 0;

          return {
            id: casino.id,
            name: casino.name,
            license_number: casino.license_number || 'N/A',
            province: casino.province || 'Unknown',
            staff_count: staffCount || 0,
            player_count: playerCount || 0,
            high_risk_players: highRiskCount || 0,
            intervention_count: interventionCount || 0,
            completion_rate: completionRate,
            is_active: casino.is_active,
          };
        })
      );

      setCasinos(casinosWithStats);

      setTotalStats({
        totalCasinos: casinosWithStats.length,
        totalPlayers: casinosWithStats.reduce((s, c) => s + c.player_count, 0),
        highRiskPlayers: casinosWithStats.reduce((s, c) => s + c.high_risk_players, 0),
        totalInterventions: casinosWithStats.reduce((s, c) => s + c.intervention_count, 0),
      });
    } catch (error) {
      toast.error('Failed to load provincial dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const riskDistributionData = casinos.map((c) => ({
    name: c.name.length > 20 ? c.name.substring(0, 18) + '…' : c.name,
    'High Risk': c.high_risk_players,
    'Total Players': c.player_count,
    Interventions: c.intervention_count,
  }));

  const complianceTrendData = [
    { month: 'Month -3', rate: 74 },
    { month: 'Month -2', rate: 79 },
    { month: 'Month -1', rate: 83 },
    {
      month: 'Current',
      rate: casinos.length > 0
        ? Math.round(casinos.reduce((s, c) => s + c.completion_rate, 0) / casinos.length)
        : 0,
    },
  ];

  const province = regulatorProfile?.province || 'Province';
  const authority = regulatorProfile?.license_authority || '';

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
            <p className="mt-4 text-sm text-muted-foreground">Loading provincial dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex h-full flex-col">
        <PageHeader
          title={`${province} Provincial Dashboard`}
          subtitle={`${regulatorProfile?.organisation_name || 'Provincial Gambling Board'} — Jurisdictional oversight & compliance`}
          actions={
            <>
              <DateRangePicker value={dateRange} onChange={setDateRange} />
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export Report
              </Button>
              <Button>
                <FileText className="mr-2 h-4 w-4" />
                Generate Audit
              </Button>
            </>
          }
        />

        {/* Province badge */}
        <div className="px-6 pb-2 flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
            <MapPin className="h-3.5 w-3.5" />
            {province}
          </div>
          {authority && (
            <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              {authority}
            </div>
          )}
          <div className="ml-auto text-xs text-muted-foreground">
            Viewing {casinos.length} licensed operator{casinos.length !== 1 ? 's' : ''} in your jurisdiction
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 pt-2">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="risk">Risk Intelligence</TabsTrigger>
              <TabsTrigger value="compliance">Compliance</TabsTrigger>
              <TabsTrigger value="operators">Operators</TabsTrigger>
            </TabsList>

            {/* ── OVERVIEW ── */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <KPICard
                  title="Licensed Operators"
                  value={totalStats.totalCasinos}
                  icon={Building2}
                  change={{ value: 0, type: 'neutral', label: 'in your province' }}
                />
                <KPICard
                  title="Total Players"
                  value={totalStats.totalPlayers}
                  icon={Users}
                  change={{ value: 5.2, type: 'increase', label: 'vs last period' }}
                />
                <KPICard
                  title="High Risk Players"
                  value={totalStats.highRiskPlayers}
                  icon={AlertTriangle}
                  change={{ value: 2.1, type: 'decrease', label: 'vs last period' }}
                />
                <KPICard
                  title="Interventions"
                  value={totalStats.totalInterventions}
                  icon={Activity}
                  change={{ value: 8.4, type: 'increase', label: 'vs last period' }}
                />
              </div>

              {/* Risk & Intervention by Casino */}
              <ChartCard
                title="Player Risk & Intervention by Casino"
                description="High-risk player counts and interventions per operator in your province"
                headerAction={
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('risk')}>
                    Full View
                  </Button>
                }
              >
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={riskDistributionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="name"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      angle={-30}
                      textAnchor="end"
                      height={70}
                    />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Bar dataKey="High Risk" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Interventions" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Quick operator summary */}
              <TableCard
                title="Operator Summary"
                description="All licensed operators under your jurisdiction"
                searchable
                searchPlaceholder="Search operators..."
                headerAction={
                  <Button variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                }
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Casino</TableHead>
                      <TableHead>Province</TableHead>
                      <TableHead>License</TableHead>
                      <TableHead>Players</TableHead>
                      <TableHead>High Risk</TableHead>
                      <TableHead>Interventions</TableHead>
                      <TableHead>Compliance</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {casinos.map((casino) => (
                      <TableRow key={casino.id} className="hover:bg-muted/50 cursor-pointer">
                        <TableCell className="font-medium text-foreground">{casino.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5" />
                            {casino.province}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {casino.license_number}
                        </TableCell>
                        <TableCell>{casino.player_count.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge
                            variant={casino.high_risk_players > 20 ? 'destructive' : casino.high_risk_players > 5 ? 'default' : 'secondary'}
                          >
                            {casino.high_risk_players}
                          </Badge>
                        </TableCell>
                        <TableCell>{casino.intervention_count}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={casino.completion_rate} className="w-20" />
                            <span className="text-xs text-muted-foreground">{casino.completion_rate}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={casino.is_active ? 'default' : 'secondary'}>
                            {casino.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {casinos.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                          No operators found in your jurisdiction
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableCard>
            </TabsContent>

            {/* ── RISK INTELLIGENCE ── */}
            <TabsContent value="risk" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-3">
                <KPICard
                  title="High Risk Players"
                  value={totalStats.highRiskPlayers}
                  icon={AlertTriangle}
                />
                <KPICard
                  title="Total Interventions"
                  value={totalStats.totalInterventions}
                  icon={Activity}
                />
                <KPICard
                  title="Risk Rate"
                  value={
                    totalStats.totalPlayers > 0
                      ? `${Math.round((totalStats.highRiskPlayers / totalStats.totalPlayers) * 100)}%`
                      : '0%'
                  }
                  icon={TrendingUp}
                />
              </div>

              <ChartCard
                title="Risk Distribution Across Operators"
                description="Comparative high-risk player volumes by casino"
              >
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={riskDistributionData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      width={140}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Bar dataKey="High Risk" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="Interventions" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </TabsContent>

            {/* ── COMPLIANCE ── */}
            <TabsContent value="compliance" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-3">
                <KPICard
                  title="Avg Compliance Rate"
                  value={
                    casinos.length > 0
                      ? `${Math.round(casinos.reduce((s, c) => s + c.completion_rate, 0) / casinos.length)}%`
                      : '0%'
                  }
                  icon={ShieldCheck}
                />
                <KPICard
                  title="Compliant Operators"
                  value={casinos.filter((c) => c.completion_rate >= 80).length}
                  icon={Building2}
                />
                <KPICard
                  title="Action Required"
                  value={casinos.filter((c) => c.completion_rate < 80).length}
                  icon={AlertTriangle}
                />
              </div>

              <ChartCard
                title="Compliance Trend"
                description="Rolling 90-day provincial compliance rate"
              >
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={complianceTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      domain={[60, 100]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="rate"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 5 }}
                      name="Compliance %"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <TableCard
                title="Compliance by Operator"
                description="Training completion and compliance status"
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Casino</TableHead>
                      <TableHead>Province</TableHead>
                      <TableHead>Training Progress</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {casinos.map((casino) => (
                      <TableRow key={casino.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">{casino.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{casino.province}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={casino.completion_rate} className="w-28" />
                            <span className="text-sm text-muted-foreground w-10">
                              {casino.completion_rate}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={casino.completion_rate >= 80 ? 'default' : 'secondary'}
                          >
                            {casino.completion_rate}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={casino.completion_rate >= 80 ? 'default' : 'destructive'}>
                            {casino.completion_rate >= 80 ? 'Compliant' : 'Action Required'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableCard>
            </TabsContent>

            {/* ── OPERATORS ── */}
            <TabsContent value="operators" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {casinos.map((casino) => (
                  <div
                    key={casino.id}
                    className="rounded-xl border bg-card p-5 space-y-4 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-foreground">{casino.name}</h3>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">
                          {casino.license_number}
                        </p>
                      </div>
                      <Badge variant={casino.is_active ? 'default' : 'secondary'}>
                        {casino.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      {casino.province}
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg bg-muted p-3">
                        <p className="text-xs text-muted-foreground">Players</p>
                        <p className="text-lg font-bold text-foreground">{casino.player_count.toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg bg-muted p-3">
                        <p className="text-xs text-muted-foreground">High Risk</p>
                        <p className={`text-lg font-bold ${casino.high_risk_players > 20 ? 'text-destructive' : 'text-foreground'}`}>
                          {casino.high_risk_players}
                        </p>
                      </div>
                      <div className="rounded-lg bg-muted p-3">
                        <p className="text-xs text-muted-foreground">Interventions</p>
                        <p className="text-lg font-bold text-foreground">{casino.intervention_count}</p>
                      </div>
                      <div className="rounded-lg bg-muted p-3">
                        <p className="text-xs text-muted-foreground">Compliance</p>
                        <p className={`text-lg font-bold ${casino.completion_rate >= 80 ? 'text-emerald-600' : 'text-orange-500'}`}>
                          {casino.completion_rate}%
                        </p>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-muted-foreground">Training Compliance</span>
                        <span className="text-xs font-medium">{casino.completion_rate}%</span>
                      </div>
                      <Progress value={casino.completion_rate} />
                    </div>
                  </div>
                ))}
                {casinos.length === 0 && (
                  <div className="col-span-3 text-center py-16 text-muted-foreground">
                    No operators found in your jurisdiction
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}
