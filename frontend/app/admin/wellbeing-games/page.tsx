'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Shield,
  TrendingUp,
  Users,
  Eye,
  FileDown,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  Search,
  Building2,
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import DetailedSessionViewer from '@/components/wellbeing-games/DetailedSessionViewer';
import { generateWellbeingReport } from '@/lib/wellbeingGameAnalytics';
import { formatPercentage } from '@/lib/utils';
import { SendNovaIQInvitation } from '@/components/SendNovaIQInvitation';

export default function AdminWellbeingGamesPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [allSessions, setAllSessions] = useState<any[]>([]);
  const [casinoBreakdown, setCasinoBreakdown] = useState<any[]>([]);
  const [insights, setInsights] = useState<any[]>([]);
  const [riskTrends, setRiskTrends] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showSessionViewer, setShowSessionViewer] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (user) {
      loadAdminData();
    }
  }, [user]);

  async function loadAdminData() {
    setLoading(true);

    const [sessionsRes, invitationsRes, campaignsRes, insightsRes, casinosRes, riskScoresRes] =
      await Promise.all([
        supabase
          .from('wellbeing_game_sessions')
          .select(`
            *,
            player:players(first_name, last_name, email),
            game_concept:wellbeing_game_concepts(name),
            casino:casinos(name)
          `)
          .order('started_at', { ascending: false }),
        supabase.from('wellbeing_game_invitations').select('*'),
        supabase.from('wellbeing_game_campaigns').select('*, casino:casinos(name)'),
        supabase
          .from('wellbeing_game_insights')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase.from('casinos').select('id, name'),
        supabase.from('wellbeing_risk_scores').select('*'),
      ]);

    const sessions = sessionsRes.data || [];
    const invitations = invitationsRes.data || [];
    const campaigns = campaignsRes.data || [];
    const allInsights = insightsRes.data || [];
    const casinos = casinosRes.data || [];
    const riskScores = riskScoresRes.data || [];

    setAllSessions(sessions);
    setInsights(allInsights);

    const totalInvitations = invitations.length;
    const completedSessions = sessions.filter((s) => s.completed_at).length;
    const engagementRate =
      totalInvitations > 0 ? (completedSessions / totalInvitations) * 100 : 0;
    const activeCampaigns = campaigns.filter((c) => c.active).length;

    const avgRiskIndex =
      riskScores.length > 0
        ? riskScores.reduce((sum, r) => sum + (r.behaviour_risk_index || 0), 0) /
          riskScores.length
        : 0;

    const highRiskCount = riskScores.filter((r) => r.behaviour_risk_index > 70).length;
    const mediumRiskCount = riskScores.filter(
      (r) => r.behaviour_risk_index >= 40 && r.behaviour_risk_index <= 70
    ).length;
    const lowRiskCount = riskScores.filter((r) => r.behaviour_risk_index < 40).length;

    setStats({
      totalInvitations,
      completedSessions,
      engagementRate: Math.round(engagementRate),
      activeCampaigns,
      avgRiskIndex: Math.round(avgRiskIndex * 10) / 10,
      totalCasinos: casinos.length,
      totalPlayers: sessions.length,
      highRiskCount,
      mediumRiskCount,
      lowRiskCount,
    });

    const casinoStatsData = casinos.map((casino) => {
      const casinoSessions = sessions.filter((s: any) => s.casino_id === casino.id);
      const casinoInvitations = invitations.filter((inv: any) => {
        const session = sessions.find((s: any) => s.invitation_id === inv.id);
        return session?.casino_id === casino.id;
      });
      const casinoCampaigns = campaigns.filter((c: any) => c.casino_id === casino.id);
      const casinoRiskScores = casinoSessions
        .filter((s: any) => s.behaviour_risk_index !== null)
        .map((s: any) => s.behaviour_risk_index);
      const avgRisk =
        casinoRiskScores.length > 0
          ? casinoRiskScores.reduce((sum: number, r: number) => sum + r, 0) /
            casinoRiskScores.length
          : 0;

      return {
        casino_id: casino.id,
        casino_name: casino.name,
        invitations_sent: casinoInvitations.length,
        sessions_completed: casinoSessions.filter((s: any) => s.completed_at).length,
        active_campaigns: casinoCampaigns.filter((c: any) => c.active).length,
        avg_risk: Math.round(avgRisk),
        engagement_rate:
          casinoInvitations.length > 0
            ? Math.round(
                (casinoSessions.filter((s: any) => s.completed_at).length /
                  casinoInvitations.length) *
                  100
              )
            : 0,
      };
    });

    setCasinoBreakdown(casinoStatsData);

    const last30Days = [...Array(30)].map((_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      const dateStr = date.toISOString().split('T')[0];

      const dayScores = riskScores.filter((r) => r.calculated_at?.split('T')[0] === dateStr);

      return {
        date: dateStr,
        avgRisk:
          dayScores.length > 0
            ? Math.round(
                dayScores.reduce((sum, r) => sum + (r.behaviour_risk_index || 0), 0) /
                  dayScores.length
              )
            : 0,
        count: dayScores.length,
      };
    });

    setRiskTrends(last30Days);
    setLoading(false);
  }

  function viewSessionDetails(sessionId: string) {
    setSelectedSessionId(sessionId);
    setShowSessionViewer(true);
  }

  async function exportFullReport() {
    const report = await generateWellbeingReport('all', 'super_admin');

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wellbeing-full-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filteredSessions = allSessions.filter((session) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      session.player?.first_name?.toLowerCase().includes(search) ||
      session.player?.last_name?.toLowerCase().includes(search) ||
      session.player?.email?.toLowerCase().includes(search) ||
      session.casino?.name?.toLowerCase().includes(search)
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 p-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-gray-400">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  const riskDistribution = [
    { name: 'Low Risk', value: stats?.lowRiskCount || 0, color: '#10b981' },
    { name: 'Medium Risk', value: stats?.mediumRiskCount || 0, color: '#f59e0b' },
    { name: 'High Risk', value: stats?.highRiskCount || 0, color: '#ef4444' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Nova IQ - Admin Overview
            </h1>
            <p className="text-gray-400">
              Complete visibility across all casino operators
            </p>
          </div>
          <div className="flex gap-2">
            <SendNovaIQInvitation onSuccess={loadAdminData} />
            <Button
              onClick={exportFullReport}
              variant="outline"
              className="border-slate-700 hover:bg-slate-800 text-white"
            >
              <FileDown className="w-4 h-4 mr-2" />
              Export Full Report
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">
                Total Casinos
              </CardTitle>
              <Building2 className="w-4 h-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats?.totalCasinos || 0}</div>
              <p className="text-xs text-gray-500 mt-1">Active operators</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">
                Total Sessions
              </CardTitle>
              <Users className="w-4 h-4 text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {stats?.completedSessions || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">Completed</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">
                Engagement Rate
              </CardTitle>
              <TrendingUp className="w-4 h-4 text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {stats?.engagementRate || 0}%
              </div>
              <p className="text-xs text-gray-500 mt-1">Industry average</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">
                Avg Risk Index
              </CardTitle>
              <AlertTriangle className="w-4 h-4 text-orange-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {stats?.avgRiskIndex || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">Out of 100</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Risk Distribution</CardTitle>
              <CardDescription className="text-gray-400">
                Behavioral risk levels across all sessions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={riskDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${formatPercentage(percent * 100)}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {riskDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Risk Trend (30 Days)</CardTitle>
              <CardDescription className="text-gray-400">
                Average behavioral risk index over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={riskTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="date"
                    stroke="#64748b"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => new Date(value).getDate().toString()}
                  />
                  <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgRisk"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="casinos" className="space-y-4">
          <TabsList className="bg-slate-900 border border-slate-800">
            <TabsTrigger value="casinos">Casino Breakdown</TabsTrigger>
            <TabsTrigger value="sessions">All Sessions</TabsTrigger>
            <TabsTrigger value="insights">AI Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="casinos" className="space-y-4">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white">Casino Performance</CardTitle>
                <CardDescription className="text-gray-400">
                  Wellbeing game metrics by operator
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {casinoBreakdown.map((casino, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-6 gap-4 p-4 bg-slate-800 rounded-lg"
                    >
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Casino</p>
                        <p className="text-white font-medium">{casino.casino_name}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-gray-400 mb-1">Invitations</p>
                        <p className="text-white font-semibold">{casino.invitations_sent}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-gray-400 mb-1">Completed</p>
                        <p className="text-white font-semibold">{casino.sessions_completed}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-gray-400 mb-1">Campaigns</p>
                        <p className="text-white font-semibold">{casino.active_campaigns}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-gray-400 mb-1">Avg Risk</p>
                        <Badge
                          variant={
                            casino.avg_risk < 40
                              ? 'default'
                              : casino.avg_risk < 70
                              ? 'secondary'
                              : 'destructive'
                          }
                        >
                          {casino.avg_risk}
                        </Badge>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-gray-400 mb-1">Engagement</p>
                        <Badge
                          variant={
                            casino.engagement_rate >= 70
                              ? 'default'
                              : casino.engagement_rate >= 40
                              ? 'secondary'
                              : 'outline'
                          }
                        >
                          {casino.engagement_rate}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {casinoBreakdown.length === 0 && (
                    <p className="text-gray-500 text-center py-8">No data available</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sessions" className="space-y-4">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white">All Game Sessions</CardTitle>
                <CardDescription className="text-gray-400">
                  Complete session history across all casinos
                </CardDescription>
                <div className="mt-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search by player name, email, or casino..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {filteredSessions.slice(0, 50).map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-3 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
                    >
                      <div className="flex-1 grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-white font-medium text-sm">
                            {session.player?.first_name} {session.player?.last_name}
                          </p>
                          <p className="text-xs text-gray-400">{session.player?.email}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">{session.casino?.name}</p>
                          <p className="text-xs text-gray-500">{session.game_concept?.name}</p>
                        </div>
                        <div className="text-right">
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
                              Risk: {Math.round(session.behaviour_risk_index)}
                            </Badge>
                          ) : (
                            <Badge variant="outline">Processing</Badge>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(session.started_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => viewSessionDetails(session.id)}
                        className="ml-3 border-slate-700 hover:bg-slate-700"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  {filteredSessions.length === 0 && (
                    <p className="text-gray-500 text-center py-8">No sessions found</p>
                  )}
                  {filteredSessions.length > 50 && (
                    <p className="text-gray-400 text-center text-sm py-4">
                      Showing first 50 of {filteredSessions.length} results
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="insights" className="space-y-4">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-yellow-400" />
                  All AI Insights
                </CardTitle>
                <CardDescription className="text-gray-400">
                  AI-generated behavioral insights from all sessions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {insights.length === 0 ? (
                    <p className="text-gray-500 text-sm">No insights generated yet</p>
                  ) : (
                    insights.map((insight) => (
                      <div
                        key={insight.id}
                        className="p-4 bg-slate-800 rounded-lg border border-slate-700"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="text-white font-semibold mb-1">{insight.title}</h4>
                            <p className="text-sm text-gray-400">{insight.description}</p>
                          </div>
                          <Badge
                            variant={
                              insight.severity === 'info'
                                ? 'default'
                                : insight.severity === 'warning'
                                ? 'secondary'
                                : 'destructive'
                            }
                            className="ml-3"
                          >
                            {insight.severity}
                          </Badge>
                        </div>
                        {insight.recommendation && (
                          <div className="mt-3 p-3 bg-blue-900/20 border border-blue-500/30 rounded">
                            <p className="text-sm text-blue-300">
                              <strong>Recommendation:</strong> {insight.recommendation}
                            </p>
                          </div>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          {new Date(insight.created_at).toLocaleString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <DetailedSessionViewer
        sessionId={selectedSessionId}
        open={showSessionViewer}
        onClose={() => setShowSessionViewer(false)}
      />
    </div>
  );
}
