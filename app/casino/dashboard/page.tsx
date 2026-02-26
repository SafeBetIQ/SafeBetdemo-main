'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { CasinoAdminGuard } from '@/components/CasinoAdminGuard';
import { PageHeader } from '@/components/saas/PageHeader';
import { KPICard } from '@/components/saas/KPICard';
import { ChartCard } from '@/components/saas/ChartCard';
import { TableCard } from '@/components/saas/TableCard';
import { DateRangePicker, type DateRange } from '@/components/saas/DateRangePicker';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  TrendingUp,
  Shield,
  Users,
  AlertTriangle,
  Download,
  FileText,
  DollarSign,
  Activity,
  Info,
  GraduationCap,
  Award,
  CheckCircle,
  BookOpen,
  Clock,
  ArrowRight,
  Send,
  Plug,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatPercentage } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import RevenueProtectionDashboard from '@/components/RevenueProtectionDashboard';
import { toast } from 'sonner';
import { EmbeddedTrainingAcademy } from '@/components/EmbeddedTrainingAcademy';
import { WellbeingGamesDashboardWidget } from '@/components/WellbeingGamesDashboardWidget';
import { SendNovaIQInvitation } from '@/components/SendNovaIQInvitation';

export default function CasinoDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [activeTab, setActiveTab] = useState('overview');
  const [revenueData, setRevenueData] = useState<any>(null);
  const [protectionEvents, setProtectionEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user, dateRange]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      const casinoId = user?.casino_id;
      console.log('🔍 Casino Dashboard - User:', user);
      console.log('🔍 Casino Dashboard - Casino ID:', casinoId);

      if (!casinoId) {
        console.error('❌ No casino_id found for user');
        toast.error('No casino assigned to your account');
        return;
      }

      // Get monthly aggregated data
      const { data: monthlyData, error: monthlyError } = await supabase
        .from('revenue_protection_monthly')
        .select('*')
        .eq('casino_id', casinoId)
        .order('month', { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log('📊 Monthly Data:', monthlyData, 'Error:', monthlyError);

      // Calculate aggregated metrics from events
      const { data: allEvents, count: eventsCount, error: eventsError } = await supabase
        .from('revenue_protection_events')
        .select('*, players(player_id, first_name, last_name)', { count: 'exact' })
        .eq('casino_id', casinoId);

      console.log('📊 Protection Events:', eventsCount, 'Error:', eventsError);

      if (monthlyData) {
        const revenueDataObj = {
          total_revenue_protected: Math.round(Number(monthlyData.total_protected_zar) || 0),
          roi: Number(monthlyData.roi_multiple) || 8.5,
          total_interventions: monthlyData.events_count || 0,
          players_protected: monthlyData.players_protected_count || 0
        };
        console.log('✅ Setting revenue data from monthly:', revenueDataObj);
        setRevenueData(revenueDataObj);
      } else if (allEvents) {
        const totalProtected = allEvents.reduce((sum, event) => sum + (Number(event.financial_impact_zar) || 0), 0);
        const uniquePlayers = new Set(allEvents.map(e => e.player_id)).size;

        const revenueDataObj = {
          total_revenue_protected: Math.round(totalProtected),
          roi: 8.5,
          total_interventions: eventsCount || 0,
          players_protected: uniquePlayers
        };
        console.log('✅ Setting revenue data from events:', revenueDataObj);
        setRevenueData(revenueDataObj);
      } else {
        console.warn('⚠️ No monthly data or events found');
      }

      // Get recent events for the table
      const { data: recentEvents, error: recentError } = await supabase
        .from('revenue_protection_events')
        .select('*, players(player_id, first_name, last_name)')
        .eq('casino_id', casinoId)
        .order('created_at', { ascending: false })
        .limit(10);

      console.log('📋 Recent Events:', recentEvents?.length || 0, 'Error:', recentError);

      if (recentEvents) {
        setProtectionEvents(recentEvents);
      }
    } catch (error) {
      console.error('❌ Dashboard Error:', error);
      toast.error('Failed to load dashboard data: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const trendData = [
    { name: 'Week 1', revenue: 125000, protected: 15000 },
    { name: 'Week 2', revenue: 132000, protected: 18000 },
    { name: 'Week 3', revenue: 145000, protected: 22000 },
    { name: 'Week 4', revenue: 158000, protected: 25000 },
  ];

  const protectionBreakdown = [
    { category: 'VIP Retention', value: 45000, percentage: 38 },
    { category: 'Fraud Prevention', value: 35000, percentage: 29 },
    { category: 'Chargeback Avoidance', value: 25000, percentage: 21 },
    { category: 'Dropout Prevention', value: 15000, percentage: 12 },
  ];

  const getRiskBadgeVariant = (risk: string) => {
    switch (risk.toLowerCase()) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'default';
      case 'medium':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
            <p className="mt-4 text-sm text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <CasinoAdminGuard>
    <DashboardLayout>
      <TooltipProvider>
      <div className="flex h-full flex-col">
        <PageHeader
          title="Casino Dashboard"
          subtitle="Monitor revenue protection, player behavior, and compliance metrics"
          actions={
            <>
              <DateRangePicker value={dateRange} onChange={setDateRange} />
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button>
                <FileText className="mr-2 h-4 w-4" />
                Generate Report
              </Button>
            </>
          }
        />

        <div className="flex-1 overflow-auto p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="revenue-protection">Revenue Protection</TabsTrigger>
              <TabsTrigger value="wellbeing-games">Nova IQ</TabsTrigger>
              <TabsTrigger value="training">Training Academy</TabsTrigger>
              <TabsTrigger value="integrations">Platform Integrations</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* KPI Cards */}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <KPICard
                  title="Revenue Protected"
                  value={revenueData?.total_revenue_protected || 0}
                  valuePrefix="R "
                  change={{ value: 12.5, type: 'increase', label: 'vs last month' }}
                  icon={DollarSign}
                  tooltip="Total revenue protected through AI-driven interventions that prevented player losses, fraud, chargebacks, and churn."
                />
                <KPICard
                  title="ROI"
                  value={revenueData?.roi || 0}
                  valueSuffix="x"
                  change={{ value: 8.2, type: 'increase', label: 'vs last month' }}
                  icon={TrendingUp}
                  tooltip="Return on Investment - how many times the SafeBet IQ platform cost is recovered through revenue protection and player retention."
                />
                <KPICard
                  title="Protection Events"
                  value={revenueData?.total_interventions || 0}
                  change={{ value: 15.3, type: 'increase', label: 'vs last month' }}
                  icon={Shield}
                  tooltip="Total number of AI-detected risk events where interventions were triggered to protect revenue and player wellbeing."
                />
                <KPICard
                  title="Players Protected"
                  value={revenueData?.players_protected || 0}
                  change={{ value: 7.8, type: 'increase', label: 'vs last month' }}
                  icon={Users}
                  tooltip="Unique number of players who received AI-driven interventions to prevent harmful gambling behavior or account issues."
                />
              </div>

              {/* Charts Row */}
              <div className="grid gap-6 lg:grid-cols-2">
                <ChartCard
                  title="Revenue Protection Trend"
                  description="Revenue protected over time"
                  tooltip="Weekly trends showing the amount of revenue successfully protected through AI interventions, fraud prevention, and player retention strategies."
                  headerAction={
                    <Button variant="ghost" size="sm">View Details</Button>
                  }
                >
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="name"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="protected"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        name="Protected Revenue"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard
                  title="Protection Event Breakdown"
                  description="Categories of revenue protection"
                  tooltip="Distribution of revenue protection across different categories: VIP retention programs, fraud detection, chargeback prevention, and player dropout interventions."
                  headerAction={
                    <Button variant="ghost" size="sm">View All</Button>
                  }
                >
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={protectionBreakdown} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis
                        type="category"
                        dataKey="category"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        width={150}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar
                        dataKey="value"
                        fill="hsl(var(--primary))"
                        radius={[0, 8, 8, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              {/* Recent Protection Events Table */}
              <TableCard
                title="Recent Protection Events"
                description="Latest interventions and their impact"
                tooltip="Real-time log of AI-detected risk events, including player details, risk levels, intervention types, and the estimated financial impact of each action taken."
                searchable
                searchPlaceholder="Search events..."
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
                      <TableHead>Date/Time</TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead>Risk Type</TableHead>
                      <TableHead>Intervention</TableHead>
                      <TableHead className="text-right">Impact (R)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Analyst</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {protectionEvents.map((event, idx) => (
                      <TableRow key={idx} className="hover:bg-muted/50 cursor-pointer">
                        <TableCell className="text-muted-foreground">
                          {new Date(event.created_at).toLocaleString('en-ZA', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-foreground">
                            {event.players?.first_name && event.players?.last_name
                              ? `${event.players.first_name} ${event.players.last_name}`
                              : '—'}
                          </div>
                          {event.players?.player_id && (
                            <div className="font-mono text-xs text-muted-foreground">{event.players.player_id}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={event.player_risk_before >= 70 ? 'destructive' : event.player_risk_before >= 50 ? 'default' : 'secondary'}>
                            {event.player_risk_before >= 70 ? 'High' : event.player_risk_before >= 50 ? 'Medium' : 'Low'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-foreground capitalize">
                          {event.event_type.replace(/_/g, ' ')}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-primary">
                          R {Math.round(Number(event.financial_impact_zar) || 0).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {event.player_risk_after < event.player_risk_before ? 'Success' : 'Pending'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">AI System</TableCell>
                      </TableRow>
                    ))}
                    {protectionEvents.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No protection events found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableCard>

              {/* Quick Access Cards */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Top Drivers Panel */}
                <ChartCard
                  title="Top Protection Drivers This Month"
                  description="Key factors contributing to revenue protection"
                  tooltip="The most impactful revenue protection categories this month, showing which AI-driven strategies are delivering the highest return and preventing the most revenue loss."
                >
                  <div className="space-y-4">
                    {protectionBreakdown.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Activity className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{item.category}</p>
                            <p className="text-sm text-muted-foreground">
                              R {item.value.toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="h-2 w-32 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${item.percentage}%` }}
                            />
                          </div>
                          <span className="text-foreground font-semibold w-12 text-right">
                            {formatPercentage(item.percentage)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ChartCard>

                {/* Nova IQ Quick Access */}
                <ChartCard
                  title="Nova IQ"
                  description="Proactive player behavioral check-ins"
                  tooltip="Off-platform behavioral assessments that help identify at-risk players early through interactive games and psychological testing."
                  headerAction={
                    <Button variant="ghost" size="sm" onClick={() => setActiveTab('wellbeing-games')}>
                      View All <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  }
                >
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-muted rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 cursor-help">
                                  <span className="text-sm text-muted-foreground">Invitations Sent</span>
                                  <Info className="h-3 w-3 text-muted-foreground" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p>Total Nova IQ assessment invitations sent to players via WhatsApp or email. Players receive a secure link to complete their behavioral check-in.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <Send className="h-4 w-4 text-primary" />
                        </div>
                        <p className="text-2xl font-bold text-foreground">-</p>
                      </div>
                      <div className="p-4 bg-muted rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 cursor-help">
                                  <span className="text-sm text-muted-foreground">Completed</span>
                                  <Info className="h-3 w-3 text-muted-foreground" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p>Players who fully completed their Nova IQ behavioral assessment session. Completed assessments generate behavioral risk insights and intervention recommendations.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <CheckCircle className="h-4 w-4 text-primary" />
                        </div>
                        <p className="text-2xl font-bold text-foreground">-</p>
                      </div>
                    </div>
                    <div className="border-t pt-4">
                      <h4 className="font-semibold text-sm mb-3">Key Benefits</h4>
                      <ul className="space-y-2">
                        <li className="flex items-start gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-primary mt-0.5" />
                          <span className="text-muted-foreground">Early detection of risky behavior patterns</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-primary mt-0.5" />
                          <span className="text-muted-foreground">Off-platform engagement with players</span>
                        </li>
                        <li className="flex items-start gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-primary mt-0.5" />
                          <span className="text-muted-foreground">Compliance evidence for regulators</span>
                        </li>
                      </ul>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <SendNovaIQInvitation casinoId={user?.casino_id} onSuccess={loadDashboardData} />
                      <Button
                        variant="outline"
                        onClick={() => setActiveTab('wellbeing-games')}
                      >
                        View Dashboard
                      </Button>
                    </div>
                  </div>
                </ChartCard>
              </div>
            </TabsContent>

            <TabsContent value="revenue-protection">
              <RevenueProtectionDashboard />
            </TabsContent>

            <TabsContent value="wellbeing-games" className="space-y-6">
              <WellbeingGamesDashboardWidget />
            </TabsContent>

            <TabsContent value="training" className="space-y-6">
              <EmbeddedTrainingAcademy casinoId={user?.casino_id || ''} />
            </TabsContent>

            <TabsContent value="integrations" className="space-y-6">
              <div className="rounded-lg border bg-card p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Plug className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">Platform Integrations</h2>
                    <p className="text-sm text-muted-foreground">
                      Connect your casino platform to SafeBet IQ for seamless data synchronization
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-center py-12">
                  <Button
                    size="lg"
                    onClick={() => router.push('/casino/integrations')}
                    className="gap-2"
                  >
                    <Plug className="h-5 w-5" />
                    Open Integration Manager
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-8 grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg border bg-muted/50 p-4">
                    <h3 className="font-semibold text-foreground mb-2">Real-time Sync</h3>
                    <p className="text-sm text-muted-foreground">
                      Automatically sync player data, betting activity, and transactions in real-time
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/50 p-4">
                    <h3 className="font-semibold text-foreground mb-2">Secure Webhooks</h3>
                    <p className="text-sm text-muted-foreground">
                      Receive instant notifications for risk events and intervention triggers
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/50 p-4">
                    <h3 className="font-semibold text-foreground mb-2">RESTful API</h3>
                    <p className="text-sm text-muted-foreground">
                      Full API access for custom integrations and data management
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      </TooltipProvider>
    </DashboardLayout>
    </CasinoAdminGuard>
  );
}
