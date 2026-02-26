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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  Building2,
  Users,
  Activity,
  DollarSign,
  Plus,
  Edit,
  Trash2,
  Download,
  Package,
  TrendingUp,
  AlertCircle,
  Gamepad2,
  Target,
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { toast } from 'sonner';
import PlatformRevenueProtectionAnalytics from '@/components/PlatformRevenueProtectionAnalytics';
import { SaaSWellbeingGamesManagement } from '@/components/SaaSWellbeingGamesManagement';

type Casino = {
  id: string;
  name: string;
  license_number: string;
  contact_email: string;
  is_active: boolean;
  simulation_mode: boolean;
  created_at: string;
};

type User = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  casino_id: string | null;
  is_active: boolean;
};

export default function SuperAdminDashboard() {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [activeTab, setActiveTab] = useState('overview');
  const [casinos, setCasinos] = useState<Casino[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCasinoDialog, setShowCasinoDialog] = useState(false);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, dateRange]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [casinosData, usersData] = await Promise.all([
        supabase.from('casinos').select('*').order('name'),
        supabase.from('users').select('*').order('email'),
      ]);

      if (casinosData.data) setCasinos(casinosData.data);
      if (usersData.data) setUsers(usersData.data);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const platformTrend = [
    { month: 'Jan', revenue: 450000, users: 120, casinos: 8 },
    { month: 'Feb', revenue: 520000, users: 145, casinos: 9 },
    { month: 'Mar', revenue: 580000, users: 168, casinos: 10 },
    { month: 'Apr', revenue: 640000, users: 192, casinos: 11 },
    { month: 'May', revenue: 720000, users: 215, casinos: 12 },
    { month: 'Jun', revenue: 810000, users: 238, casinos: 13 },
  ];

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
      <div className="flex h-full flex-col">
        <PageHeader
          title="Platform Administration"
          subtitle="Manage casinos, users, and platform-wide settings"
          actions={
            <>
              <DateRangePicker value={dateRange} onChange={setDateRange} />
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Dialog open={showCasinoDialog} onOpenChange={setShowCasinoDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Casino
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Casino</DialogTitle>
                    <DialogDescription>Create a new casino operator account</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Casino Name</Label>
                      <Input id="name" placeholder="Enter casino name" />
                    </div>
                    <div>
                      <Label htmlFor="license">License Number</Label>
                      <Input id="license" placeholder="Enter license number" />
                    </div>
                    <div>
                      <Label htmlFor="email">Contact Email</Label>
                      <Input id="email" type="email" placeholder="contact@casino.com" />
                    </div>
                    <Button className="w-full">Create Casino</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          }
        />

        <div className="flex-1 overflow-auto p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="casinos">Casinos</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="wellbeing-games">Nova IQ</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* KPI Cards */}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <KPICard
                  title="Total Casinos"
                  value={casinos.length}
                  change={{ value: 8.3, type: 'increase', label: 'vs last month' }}
                  icon={Building2}
                />
                <KPICard
                  title="Active Users"
                  value={users.filter((u) => u.is_active).length}
                  change={{ value: 12.5, type: 'increase', label: 'vs last month' }}
                  icon={Users}
                />
                <KPICard
                  title="Platform Revenue"
                  value="810K"
                  valuePrefix="R "
                  change={{ value: 15.3, type: 'increase', label: 'vs last month' }}
                  icon={DollarSign}
                />
                <KPICard
                  title="System Health"
                  value="99.8%"
                  change={{ value: 0.2, type: 'increase', label: 'uptime' }}
                  icon={Activity}
                />
              </div>

              {/* Platform Growth Chart */}
              <ChartCard
                title="Platform Growth"
                description="6-month overview"
                headerAction={<Button variant="ghost" size="sm">View Details</Button>}
              >
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={platformTrend}>
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
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} name="Revenue (R)" />
                    <Line type="monotone" dataKey="users" stroke="hsl(var(--chart-2))" strokeWidth={2} name="Users" />
                    <Line type="monotone" dataKey="casinos" stroke="hsl(var(--chart-3))" strokeWidth={2} name="Casinos" />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Nova IQ Quick Access */}
              <ChartCard
                title="Nova IQ Platform"
                description="Off-platform behavioral check-in system"
                headerAction={
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('wellbeing-games')}>
                    View Full Dashboard
                  </Button>
                }
              >
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Total Sessions</span>
                        <Gamepad2 className="h-4 w-4 text-primary" />
                      </div>
                      <p className="text-2xl font-bold text-foreground">-</p>
                      <p className="text-xs text-muted-foreground mt-1">Across all casinos</p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Avg Engagement</span>
                        <Target className="h-4 w-4 text-primary" />
                      </div>
                      <p className="text-2xl font-bold text-foreground">-</p>
                      <p className="text-xs text-muted-foreground mt-1">Completion rate</p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Active Games</span>
                        <Activity className="h-4 w-4 text-primary" />
                      </div>
                      <p className="text-2xl font-bold text-foreground">8</p>
                      <p className="text-xs text-muted-foreground mt-1">Game concepts available</p>
                    </div>
                  </div>
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-sm mb-3">Platform Differentiators</h4>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2 text-sm">
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 mt-0.5">
                          <span className="text-primary text-xs">✓</span>
                        </div>
                        <span className="text-muted-foreground">
                          <strong>Off-Platform Engagement:</strong> Reach players outside the casino environment
                        </span>
                      </div>
                      <div className="flex items-start gap-2 text-sm">
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 mt-0.5">
                          <span className="text-primary text-xs">✓</span>
                        </div>
                        <span className="text-muted-foreground">
                          <strong>Proactive Risk Detection:</strong> Identify behavioral patterns before escalation
                        </span>
                      </div>
                      <div className="flex items-start gap-2 text-sm">
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 mt-0.5">
                          <span className="text-primary text-xs">✓</span>
                        </div>
                        <span className="text-muted-foreground">
                          <strong>Competitive Advantage:</strong> Unique feature not available in traditional RG systems
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </ChartCard>

              {/* Recent Activity */}
              <TableCard
                title="Recent Activity"
                description="Latest platform events"
                searchable
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Event Type</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No recent activity
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableCard>
            </TabsContent>

            <TabsContent value="casinos" className="space-y-6">
              <TableCard
                title="Casino Operators"
                description={`Managing ${casinos.length} casino operators`}
                searchable
                searchPlaceholder="Search casinos..."
                headerAction={
                  <Button onClick={() => setShowCasinoDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Casino
                  </Button>
                }
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Casino Name</TableHead>
                      <TableHead>License Number</TableHead>
                      <TableHead>Contact Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {casinos.map((casino) => (
                      <TableRow key={casino.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium text-foreground">{casino.name}</TableCell>
                        <TableCell className="font-mono text-muted-foreground">{casino.license_number}</TableCell>
                        <TableCell className="text-muted-foreground">{casino.contact_email}</TableCell>
                        <TableCell>
                          <Badge variant={casino.is_active ? 'default' : 'secondary'}>
                            {casino.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={casino.simulation_mode ? 'outline' : 'default'}>
                            {casino.simulation_mode ? 'Demo' : 'Live'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(casino.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableCard>
            </TabsContent>

            <TabsContent value="users" className="space-y-6">
              <TableCard
                title="Platform Users"
                description={`Managing ${users.length} user accounts`}
                searchable
                searchPlaceholder="Search users..."
                headerAction={
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add User
                  </Button>
                }
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Casino</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((usr) => (
                      <TableRow key={usr.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium text-foreground">{usr.full_name || 'N/A'}</TableCell>
                        <TableCell className="text-muted-foreground">{usr.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {usr.role?.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {usr.casino_id ? casinos.find((c) => c.id === usr.casino_id)?.name || 'Unknown' : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={usr.is_active ? 'default' : 'secondary'}>
                            {usr.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableCard>
            </TabsContent>

            <TabsContent value="wellbeing-games">
              <SaaSWellbeingGamesManagement />
            </TabsContent>

            <TabsContent value="analytics">
              <PlatformRevenueProtectionAnalytics />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}
