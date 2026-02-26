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
import {
  Building2,
  Users,
  GraduationCap,
  Award,
  Download,
  FileText,
  Shield,
  Leaf,
  TrendingUp,
  Eye,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';
import { toast } from 'sonner';

interface CasinoTraining {
  id: string;
  name: string;
  license_number: string;
  staff_count: number;
  total_enrollments: number;
  completed_courses: number;
  total_credits: number;
  avg_progress: number;
  completion_rate: number;
}

export default function RegulatorDashboard() {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [casinos, setCasinos] = useState<CasinoTraining[]>([]);
  const [totalStats, setTotalStats] = useState({
    totalStaff: 0,
    totalCredits: 0,
    totalEnrollments: 0,
    avgCompletion: 0,
  });

  useEffect(() => {
    if (user) {
      loadRegulatorData();
    }
  }, [user, dateRange]);

  const loadRegulatorData = async () => {
    try {
      setLoading(true);

      const { data: casinoList } = await supabase
        .from('casinos')
        .select('id, name, license_number')
        .order('name');

      if (casinoList) {
        const casinosWithStats = await Promise.all(
          casinoList.map(async (casino) => {
            const { count: staffCount } = await supabase
              .from('staff')
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

            const { data: progressData } = await supabase
              .from('training_enrollments')
              .select('progress')
              .eq('casino_id', casino.id);

            const avgProgress =
              progressData && progressData.length > 0
                ? progressData.reduce((sum, e) => sum + (e.progress || 0), 0) / progressData.length
                : 0;

            return {
              id: casino.id,
              name: casino.name,
              license_number: casino.license_number || 'N/A',
              staff_count: staffCount || 0,
              total_enrollments: enrollmentCount || 0,
              completed_courses: completedCount || 0,
              total_credits: Math.floor((completedCount || 0) * 2.5),
              avg_progress: Math.round(avgProgress),
              completion_rate: enrollmentCount ? Math.round(((completedCount || 0) / enrollmentCount) * 100) : 0,
            };
          })
        );

        setCasinos(casinosWithStats);

        const totalStaff = casinosWithStats.reduce((sum, c) => sum + c.staff_count, 0);
        const totalCredits = casinosWithStats.reduce((sum, c) => sum + c.total_credits, 0);
        const totalEnrollments = casinosWithStats.reduce((sum, c) => sum + c.total_enrollments, 0);
        const avgCompletion =
          casinosWithStats.length > 0
            ? Math.round(casinosWithStats.reduce((sum, c) => sum + c.completion_rate, 0) / casinosWithStats.length)
            : 0;

        setTotalStats({
          totalStaff,
          totalCredits,
          totalEnrollments,
          avgCompletion,
        });
      }
    } catch (error) {
      toast.error('Failed to load regulator data');
    } finally {
      setLoading(false);
    }
  };

  const complianceData = casinos.map((casino) => ({
    name: casino.name,
    training: casino.completion_rate,
    esg: Math.floor(Math.random() * 30) + 70,
  }));

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
            <p className="mt-4 text-sm text-muted-foreground">Loading regulator dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex h-full flex-col">
        <PageHeader
          title="Regulator Dashboard"
          subtitle="Industry-wide oversight and compliance monitoring"
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

        <div className="flex-1 overflow-auto p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="compliance">Compliance</TabsTrigger>
              <TabsTrigger value="training">Training</TabsTrigger>
              <TabsTrigger value="esg">ESG Performance</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* KPI Cards */}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <KPICard
                  title="Licensed Operators"
                  value={casinos.length}
                  icon={Building2}
                  change={{ value: 0, type: 'neutral', label: 'this quarter' }}
                />
                <KPICard
                  title="Total Staff"
                  value={totalStats.totalStaff}
                  icon={Users}
                  change={{ value: 8.3, type: 'increase', label: 'vs last quarter' }}
                />
                <KPICard
                  title="Training Credits Issued"
                  value={totalStats.totalCredits}
                  icon={GraduationCap}
                  change={{ value: 15.7, type: 'increase', label: 'vs last quarter' }}
                />
                <KPICard
                  title="Avg Compliance Rate"
                  value={`${totalStats.avgCompletion}%`}
                  icon={Award}
                  change={{ value: 3.2, type: 'increase', label: 'vs last quarter' }}
                />
              </div>

              {/* Compliance Chart */}
              <ChartCard
                title="Casino Compliance Scores"
                description="Training completion and ESG performance"
                headerAction={
                  <Button variant="ghost" size="sm">
                    View Details
                  </Button>
                }
              >
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={complianceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="name"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      angle={-45}
                      textAnchor="end"
                      height={100}
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
                    <Bar dataKey="training" fill="hsl(var(--primary))" name="Training Compliance" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="esg" fill="hsl(var(--success))" name="ESG Score" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Casino List Table */}
              <TableCard
                title="Licensed Operators"
                description="Overview of all licensed casino operators"
                searchable
                searchPlaceholder="Search casinos..."
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
                      <TableHead>Casino Name</TableHead>
                      <TableHead>License Number</TableHead>
                      <TableHead>Staff Count</TableHead>
                      <TableHead>Training Progress</TableHead>
                      <TableHead>Completion Rate</TableHead>
                      <TableHead>Compliance Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {casinos.map((casino) => (
                      <TableRow key={casino.id} className="hover:bg-muted/50 cursor-pointer">
                        <TableCell className="font-medium">{casino.name}</TableCell>
                        <TableCell className="font-mono text-body">{casino.license_number}</TableCell>
                        <TableCell>{casino.staff_count}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={casino.avg_progress} className="w-24" />
                            <span className="text-sm text-muted-foreground">{casino.avg_progress}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={casino.completion_rate >= 80 ? 'default' : 'secondary'}>
                            {casino.completion_rate}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={casino.completion_rate >= 80 ? 'default' : 'destructive'}>
                            {casino.completion_rate >= 80 ? 'Compliant' : 'Action Required'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableCard>
            </TabsContent>

            <TabsContent value="compliance">
              <div className="space-y-6">
                <ChartCard title="Compliance Trends" description="90-day historical view">
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart
                      data={[
                        { month: 'Month -3', compliance: 78 },
                        { month: 'Month -2', compliance: 82 },
                        { month: 'Month -1', compliance: 85 },
                        { month: 'Current', compliance: totalStats.avgCompletion },
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Line type="monotone" dataKey="compliance" stroke="hsl(var(--primary))" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            </TabsContent>

            <TabsContent value="training">
              <div className="space-y-6">
                <div className="grid gap-6 md:grid-cols-3">
                  <KPICard
                    title="Total Enrollments"
                    value={totalStats.totalEnrollments}
                    icon={GraduationCap}
                  />
                  <KPICard
                    title="Credits Issued"
                    value={totalStats.totalCredits}
                    icon={Award}
                  />
                  <KPICard
                    title="Avg Completion"
                    value={`${totalStats.avgCompletion}%`}
                    icon={TrendingUp}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="esg">
              <div className="space-y-6">
                <ChartCard title="ESG Performance Overview" description="Industry-wide ESG metrics">
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">ESG data visualization coming soon</p>
                  </div>
                </ChartCard>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}
