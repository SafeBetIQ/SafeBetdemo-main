'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { KPICard } from '@/components/saas/KPICard';
import { ChartCard } from '@/components/saas/ChartCard';
import { TableCard } from '@/components/saas/TableCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Gamepad2,
  Users,
  Target,
  TrendingUp,
  Send,
  CheckCircle,
  Eye,
  BarChart3,
  Calendar,
  Activity,
  AlertTriangle,
  Shield,
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import DetailedSessionViewer from '@/components/wellbeing-games/DetailedSessionViewer';

export function SaaSWellbeingGamesManagement() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [casinos, setCasinos] = useState<any[]>([]);
  const [selectedCasino, setSelectedCasino] = useState<string>('all');
  const [sessions, setSessions] = useState<any[]>([]);
  const [gameConcepts, setGameConcepts] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showSessionViewer, setShowSessionViewer] = useState(false);
  const [engagementData, setEngagementData] = useState<any[]>([]);
  const [riskDistribution, setRiskDistribution] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [selectedCasino]);

  async function loadData() {
    setLoading(true);

    const [casinosRes, conceptsRes, sessionsRes, invitationsRes, insightsRes] = await Promise.all([
      supabase.from('casinos').select('id, name').eq('is_active', true).order('name'),
      supabase.from('wellbeing_game_concepts').select('*').eq('active', true),
      supabase
        .from('wellbeing_game_sessions')
        .select(`
          *,
          player:players(first_name, last_name),
          casino:casinos(name),
          game_concept:wellbeing_game_concepts(name)
        `)
        .order('started_at', { ascending: false })
        .limit(100),
      supabase.from('wellbeing_game_invitations').select('*'),
      supabase.from('wellbeing_game_insights').select('*')
    ]);

    setCasinos(casinosRes.data || []);
    setGameConcepts(conceptsRes.data || []);

    let filteredSessions = sessionsRes.data || [];
    let filteredInvitations = invitationsRes.data || [];
    let filteredInsights = insightsRes.data || [];

    if (selectedCasino !== 'all') {
      filteredSessions = filteredSessions.filter(s => s.casino_id === selectedCasino);
      filteredInvitations = filteredInvitations.filter(i => i.casino_id === selectedCasino);
      filteredInsights = filteredInsights.filter(i => i.casino_id === selectedCasino);
    }

    setSessions(filteredSessions);

    const totalInvitations = filteredInvitations.length;
    const completedSessions = filteredSessions.filter(s => s.completed_at).length;
    const engagementRate = totalInvitations > 0 ? (completedSessions / totalInvitations) * 100 : 0;
    const avgRiskScore = filteredSessions.length > 0
      ? filteredSessions.reduce((sum, s) => sum + (s.behaviour_risk_index || 0), 0) / filteredSessions.length
      : 0;

    const highRiskSessions = filteredSessions.filter(s => s.behaviour_risk_index >= 70).length;
    const activeInsights = filteredInsights.filter(i => i.severity === 'critical' || i.severity === 'warning').length;

    setStats({
      totalInvitations,
      completedSessions,
      engagementRate: Math.round(engagementRate),
      avgRiskScore: Math.round(avgRiskScore),
      highRiskSessions,
      activeInsights,
    });

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return date.toISOString().split('T')[0];
    });

    const engagementByDay = last7Days.map(date => {
      const dayInvitations = filteredInvitations.filter(inv =>
        inv.created_at?.startsWith(date)
      ).length;
      const daySessions = filteredSessions.filter(sess =>
        sess.started_at?.startsWith(date)
      ).length;
      return {
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        invitations: dayInvitations,
        completed: daySessions,
      };
    });

    setEngagementData(engagementByDay);

    const riskBuckets = [
      { name: 'Low (0-40)', value: 0, color: '#10b981' },
      { name: 'Medium (40-70)', value: 0, color: '#f59e0b' },
      { name: 'High (70+)', value: 0, color: '#ef4444' },
    ];

    filteredSessions.forEach(session => {
      const risk = session.behaviour_risk_index || 0;
      if (risk < 40) riskBuckets[0].value++;
      else if (risk < 70) riskBuckets[1].value++;
      else riskBuckets[2].value++;
    });

    setRiskDistribution(riskBuckets);

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-48 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header with Casino Filter */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Gamepad2 className="h-6 w-6 text-primary" />
              Nova IQ Management
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Platform-wide behavioral check-in analytics and management
            </p>
          </div>
          <Select value={selectedCasino} onValueChange={setSelectedCasino}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Select casino" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Casinos</SelectItem>
              {casinos.map((casino) => (
                <SelectItem key={casino.id} value={casino.id}>
                  {casino.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <KPICard
            title="Total Invitations"
            value={stats?.totalInvitations || 0}
            icon={Send}
            change={{ value: 12.5, type: 'increase', label: 'vs last month' }}
          />
          <KPICard
            title="Completed Sessions"
            value={stats?.completedSessions || 0}
            icon={CheckCircle}
            change={{ value: 8.2, type: 'increase', label: 'vs last month' }}
          />
          <KPICard
            title="Engagement Rate"
            value={`${stats?.engagementRate || 0}%`}
            icon={Target}
            change={{ value: 5.1, type: 'increase', label: 'vs last month' }}
          />
          <KPICard
            title="Avg Risk Score"
            value={stats?.avgRiskScore || 0}
            icon={Activity}
            change={{ value: 3.2, type: 'decrease', label: 'vs last month' }}
          />
          <KPICard
            title="High Risk Players"
            value={stats?.highRiskSessions || 0}
            icon={AlertTriangle}
            change={{ value: 2.1, type: 'decrease', label: 'vs last month' }}
          />
          <KPICard
            title="Active Insights"
            value={stats?.activeInsights || 0}
            icon={Shield}
            change={{ value: 1.5, type: 'increase', label: 'new this week' }}
          />
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Engagement Trend */}
          <ChartCard
            title="7-Day Engagement Trend"
            description="Invitations sent vs sessions completed"
          >
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={engagementData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
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
                  dataKey="invitations"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  name="Invitations"
                />
                <Line
                  type="monotone"
                  dataKey="completed"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  name="Completed"
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Risk Distribution */}
          <ChartCard
            title="Risk Score Distribution"
            description="Player risk levels across sessions"
          >
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={riskDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value, percent }) =>
                    `${name}: ${value} (${(percent * 100).toFixed(0)}%)`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {riskDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Game Concepts Table */}
        <TableCard
          title="Available Game Concepts"
          description={`${gameConcepts.length} active wellbeing game templates`}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Game Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Difficulty</TableHead>
                <TableHead>Sessions</TableHead>
                <TableHead>Avg Risk Score</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gameConcepts.map((game) => {
                const gameSessions = sessions.filter(s => s.game_concept_id === game.id);
                const avgRisk = gameSessions.length > 0
                  ? Math.round(gameSessions.reduce((sum, s) => sum + (s.behaviour_risk_index || 0), 0) / gameSessions.length)
                  : 0;
                return (
                  <TableRow key={game.id}>
                    <TableCell className="font-medium">{game.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{game.mechanics_type}</Badge>
                    </TableCell>
                    <TableCell>{game.duration_minutes} min</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          game.difficulty_level === 'easy'
                            ? 'default'
                            : game.difficulty_level === 'medium'
                            ? 'secondary'
                            : 'destructive'
                        }
                      >
                        {game.difficulty_level}
                      </Badge>
                    </TableCell>
                    <TableCell>{gameSessions.length}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          avgRisk < 40
                            ? 'default'
                            : avgRisk < 70
                            ? 'secondary'
                            : 'destructive'
                        }
                      >
                        {avgRisk}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={game.active ? 'default' : 'secondary'}>
                        {game.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableCard>

        {/* Recent Sessions Table */}
        <TableCard
          title="Recent Player Sessions"
          description="Latest wellbeing game completions across all casinos"
          searchable
          searchPlaceholder="Search by player name..."
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Player</TableHead>
                <TableHead>Casino</TableHead>
                <TableHead>Game</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Risk Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.slice(0, 20).map((session) => {
                const duration = session.completed_at
                  ? Math.round(
                      (new Date(session.completed_at).getTime() -
                        new Date(session.started_at).getTime()) /
                        60000
                    )
                  : null;

                return (
                  <TableRow key={session.id}>
                    <TableCell className="font-medium">
                      {session.player?.first_name} {session.player?.last_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {session.casino?.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {session.game_concept?.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(session.started_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {duration ? `${duration} min` : '-'}
                    </TableCell>
                    <TableCell>
                      {session.behaviour_risk_index !== null ? (
                        <Badge
                          variant={
                            session.behaviour_risk_index < 40
                              ? 'default'
                              : session.behaviour_risk_index < 70
                              ? 'secondary'
                              : 'destructive'
                          }
                        >
                          {Math.round(session.behaviour_risk_index)}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={session.completed_at ? 'default' : 'secondary'}
                      >
                        {session.completed_at ? 'Completed' : 'In Progress'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedSessionId(session.id);
                          setShowSessionViewer(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableCard>

        {/* Platform Benefits */}
        <ChartCard
          title="Platform-Wide Benefits"
          description="How wellbeing games strengthen the SafeBet IQ platform"
        >
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-1">Proactive Risk Management</h4>
                <p className="text-xs text-muted-foreground">
                  Off-platform behavioral assessments enable early intervention before
                  problems escalate, protecting both players and casino revenue.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-1">Enhanced Compliance</h4>
                <p className="text-xs text-muted-foreground">
                  Demonstrate proactive player welfare initiatives to regulators with
                  comprehensive audit trails and analytics.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-1">Competitive Advantage</h4>
                <p className="text-xs text-muted-foreground">
                  Unique off-platform engagement tools differentiate SafeBet IQ from
                  traditional monitoring-only systems.
                </p>
              </div>
            </div>
          </div>
        </ChartCard>
      </div>

      <DetailedSessionViewer
        sessionId={selectedSessionId}
        open={showSessionViewer}
        onClose={() => setShowSessionViewer(false)}
      />
    </>
  );
}
