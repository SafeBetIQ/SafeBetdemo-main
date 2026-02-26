'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { PageHeader } from '@/components/saas/PageHeader';
import { KPICard } from '@/components/saas/KPICard';
import { ChartCard } from '@/components/saas/ChartCard';
import { TableCard } from '@/components/saas/TableCard';
import { DateRangePicker, type DateRange } from '@/components/saas/DateRangePicker';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ESGPerformanceCard } from '@/components/ESGPerformanceCard';
import { NRGPContributionTracker } from '@/components/NRGPContributionTracker';
import { SelfExclusionMonitor } from '@/components/SelfExclusionMonitor';
import { EmployeeTrainingTracker } from '@/components/EmployeeTrainingTracker';
import { InterventionEffectivenessCard } from '@/components/InterventionEffectivenessCard';
import KingIVESGDashboard from '@/components/KingIVESGDashboard';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  Leaf,
  Heart,
  Award,
  TrendingUp,
  Shield,
  Download,
  FileText,
  Building2,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TooltipProvider } from '@/components/ui/tooltip';

interface Casino {
  id: string;
  name: string;
}

export default function ESGPerformancePage() {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [esgData, setESGData] = useState<any>(null);
  const [casinos, setCasinos] = useState<Casino[]>([]);
  const [selectedCasinoId, setSelectedCasinoId] = useState<string>('');
  const [isAdminOrRegulator, setIsAdminOrRegulator] = useState(false);

  useEffect(() => {
    async function initializePage() {
      if (!user) return;

      const role = (user as any).role;
      const isAdmin = role === 'super_admin' || role === 'regulator';
      setIsAdminOrRegulator(isAdmin);

      if (isAdmin) {
        const { data: casinoList } = await supabase
          .from('casinos')
          .select('id, name')
          .order('name');

        if (casinoList && casinoList.length > 0) {
          setCasinos(casinoList);
          setSelectedCasinoId(casinoList[0].id);
        }
      } else {
        setSelectedCasinoId((user as any).casino_id);
      }
    }

    initializePage();
  }, [user]);

  useEffect(() => {
    async function fetchESGData() {
      if (!selectedCasinoId) return;

      try {
        setLoading(true);

        const { data: metrics } = await supabase
          .from('esg_metrics')
          .select('*')
          .eq('casino_id', selectedCasinoId)
          .eq('period_type', 'annual')
          .order('reporting_period', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (metrics) {
          setESGData(metrics);
        }
      } catch (error) {
      } finally {
        setLoading(false);
      }
    }

    fetchESGData();
  }, [selectedCasinoId]);

  const trendData = [
    { month: 'Jan', environmental: 82, social: 78, governance: 85 },
    { month: 'Feb', environmental: 83, social: 80, governance: 86 },
    { month: 'Mar', environmental: 85, social: 82, governance: 87 },
    { month: 'Apr', environmental: 84, social: 83, governance: 88 },
    { month: 'May', environmental: 86, social: 85, governance: 89 },
    { month: 'Jun', environmental: 87, social: 86, governance: 90 },
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
            <p className="mt-4 text-sm text-muted-foreground">Loading ESG data...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <TooltipProvider>
        <div className="flex h-full flex-col">
          <PageHeader
            title="ESG Compliance"
            subtitle="Environmental, Social, and Governance performance tracking"
            actions={
              <>
                {isAdminOrRegulator && casinos.length > 0 && (
                  <Select value={selectedCasinoId} onValueChange={setSelectedCasinoId}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Select casino" />
                    </SelectTrigger>
                    <SelectContent>
                      {casinos.map((casino) => (
                        <SelectItem key={casino.id} value={casino.id}>
                          {casino.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <DateRangePicker value={dateRange} onChange={setDateRange} />
                <Button variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Export Report
                </Button>
                <Button>
                  <FileText className="mr-2 h-4 w-4" />
                  Generate Certificate
                </Button>
              </>
            }
        />

        <div className="flex-1 overflow-auto p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="king-iv">King IV</TabsTrigger>
              <TabsTrigger value="detailed">Detailed Metrics</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* KPI Cards */}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <KPICard
                  title="Overall ESG Score"
                  value={esgData?.overall_esg_score || 0}
                  valueSuffix="/100"
                  change={{ value: 3.2, type: 'increase', label: 'vs last quarter' }}
                  icon={Award}
                  tooltip="Composite score measuring overall Environmental, Social, and Governance performance across all metrics"
                />
                <KPICard
                  title="Environmental"
                  value={esgData?.environmental_score || 0}
                  valueSuffix="/100"
                  change={{ value: 2.1, type: 'increase', label: 'vs last quarter' }}
                  icon={Leaf}
                  tooltip="Environmental impact score including carbon footprint, energy efficiency, and resource management"
                />
                <KPICard
                  title="Social"
                  value={esgData?.social_score || 0}
                  valueSuffix="/100"
                  change={{ value: 4.5, type: 'increase', label: 'vs last quarter' }}
                  icon={Heart}
                  tooltip="Social responsibility metrics including player wellbeing, NRGP contributions, and community impact"
                />
                <KPICard
                  title="Governance"
                  value={esgData?.governance_score || 0}
                  valueSuffix="/100"
                  change={{ value: 1.8, type: 'increase', label: 'vs last quarter' }}
                  icon={Shield}
                  tooltip="Governance effectiveness including board diversity, training completion, and compliance standards"
                />
              </div>

              {/* ESG Trend Chart */}
              <ChartCard
                title="ESG Performance Trends"
                description="6-month historical view"
                tooltip="Historical trend analysis showing Environmental, Social, and Governance scores over the past 6 months"
                headerAction={
                  <Button variant="ghost" size="sm">
                    View Details
                  </Button>
                }
              >
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="month"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
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
                    <Line
                      type="monotone"
                      dataKey="environmental"
                      stroke="hsl(var(--success))"
                      strokeWidth={2}
                      name="Environmental"
                    />
                    <Line
                      type="monotone"
                      dataKey="social"
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={2}
                      name="Social"
                    />
                    <Line
                      type="monotone"
                      dataKey="governance"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      name="Governance"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Component Cards Row */}
              <div className="grid gap-6 lg:grid-cols-2">
                <ESGPerformanceCard
                  title="Social Impact"
                  description="Key social responsibility metrics"
                  tooltip="Tracks player engagement and contributions to the National Responsible Gambling Programme"
                  metrics={[
                    { label: 'Active Players', value: '12,500', icon: 'users', trend: 'up', change: '+5%' },
                    { label: 'NRGP Contribution', value: 'R 125K', icon: 'dollar', trend: 'up', change: '+12%' },
                  ]}
                />
                <ESGPerformanceCard
                  title="Governance"
                  description="Compliance and training"
                  tooltip="Measures staff training completion rates and effectiveness of player interventions"
                  metrics={[
                    { label: 'Training Completion', value: '89%', icon: 'award', trend: 'up', change: '+3%' },
                    { label: 'Intervention Success', value: '87%', icon: 'heart', trend: 'up', change: '+2%' },
                  ]}
                />
              </div>
            </TabsContent>

            <TabsContent value="king-iv">
              <KingIVESGDashboard casinoId={selectedCasinoId} />
            </TabsContent>

            <TabsContent value="detailed" className="space-y-6">
              <TableCard
                title="Detailed ESG Metrics"
                description="All tracked environmental, social, and governance indicators"
                tooltip="Comprehensive breakdown of all ESG metrics including current values, targets, and performance trends"
                searchable
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
                      <TableHead>Metric</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Current Value</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Trend</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Carbon Footprint</TableCell>
                      <TableCell>
                        <Badge variant="outline">Environmental</Badge>
                      </TableCell>
                      <TableCell>245 tons CO₂</TableCell>
                      <TableCell>200 tons CO₂</TableCell>
                      <TableCell>
                        <Badge variant="secondary">On Track</Badge>
                      </TableCell>
                      <TableCell>
                        <TrendingUp className="h-4 w-4 text-success" />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Training Completion</TableCell>
                      <TableCell>
                        <Badge variant="outline">Social</Badge>
                      </TableCell>
                      <TableCell>89%</TableCell>
                      <TableCell>95%</TableCell>
                      <TableCell>
                        <Badge variant="secondary">On Track</Badge>
                      </TableCell>
                      <TableCell>
                        <TrendingUp className="h-4 w-4 text-success" />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Board Diversity</TableCell>
                      <TableCell>
                        <Badge variant="outline">Governance</Badge>
                      </TableCell>
                      <TableCell>45%</TableCell>
                      <TableCell>50%</TableCell>
                      <TableCell>
                        <Badge variant="secondary">On Track</Badge>
                      </TableCell>
                      <TableCell>
                        <TrendingUp className="h-4 w-4 text-success" />
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableCard>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      </TooltipProvider>
    </DashboardLayout>
  );
}
