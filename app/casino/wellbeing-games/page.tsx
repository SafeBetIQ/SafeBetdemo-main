'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Mail,
  MessageSquare,
  TrendingUp,
  Users,
  Clock,
  Target,
  AlertCircle,
  CheckCircle2,
  Send,
  BarChart3,
  Eye,
  FileDown,
  Lightbulb,
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import DetailedSessionViewer from '@/components/wellbeing-games/DetailedSessionViewer';
import { generateWellbeingReport } from '@/lib/wellbeingGameAnalytics';
import { SendNovaIQInvitation } from '@/components/SendNovaIQInvitation';

export default function WellbeingGamesPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [gameConcepts, setGameConcepts] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showSessionViewer, setShowSessionViewer] = useState(false);
  const [insights, setInsights] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  async function loadDashboardData() {
    setLoading(true);

    const { data: staffData } = await supabase
      .from('staff')
      .select('casino_id')
      .eq('auth_user_id', user?.id)
      .single();

    if (!staffData) {
      setLoading(false);
      return;
    }

    const casinoId = staffData.casino_id;

    const [conceptsRes, campaignsRes, sessionsRes, invitationsRes, insightsRes] = await Promise.all([
      supabase.from('wellbeing_game_concepts').select('*').eq('active', true),
      supabase.from('wellbeing_game_campaigns').select('*').eq('casino_id', casinoId),
      supabase
        .from('wellbeing_game_sessions')
        .select(`
          *,
          player:players(first_name, last_name),
          game_concept:wellbeing_game_concepts(name)
        `)
        .eq('casino_id', casinoId)
        .order('started_at', { ascending: false })
        .limit(10),
      supabase.from('wellbeing_game_invitations').select('status').eq('player_id', casinoId),
      supabase
        .from('wellbeing_game_insights')
        .select('*')
        .eq('casino_id', casinoId)
        .order('created_at', { ascending: false })
        .limit(5)
    ]);

    setGameConcepts(conceptsRes.data || []);
    setCampaigns(campaignsRes.data || []);
    setRecentSessions(sessionsRes.data || []);
    setInsights(insightsRes.data || []);

    const invitations = invitationsRes.data || [];
    const totalInvitations = invitations.length;
    const completedInvitations = invitations.filter(i => i.status === 'completed').length;
    const openedInvitations = invitations.filter(i => i.status === 'opened').length;
    const engagementRate = totalInvitations > 0 ? (completedInvitations / totalInvitations) * 100 : 0;

    setStats({
      totalInvitations,
      completedInvitations,
      openedInvitations,
      engagementRate: Math.round(engagementRate),
      activeCampaigns: campaignsRes.data?.filter(c => c.active).length || 0,
    });

    setLoading(false);
  }

  function viewSessionDetails(sessionId: string) {
    setSelectedSessionId(sessionId);
    setShowSessionViewer(true);
  }

  async function exportReport() {
    const { data: staffData } = await supabase
      .from('staff')
      .select('casino_id, casino:casinos(name)')
      .eq('auth_user_id', user?.id)
      .single();

    if (!staffData) return;

    const report = await generateWellbeingReport(staffData.casino_id, 'casino');

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wellbeing-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function sendTestInvitation(gameConceptId: string) {
    const { data: staffData } = await supabase
      .from('staff')
      .select('casino_id')
      .eq('auth_user_id', user?.id)
      .single();

    if (!staffData) return;

    const { data: players } = await supabase
      .from('players')
      .select('id')
      .eq('casino_id', staffData.casino_id)
      .limit(1)
      .single();

    if (!players) return;

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-wellbeing-invitation`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          player_id: players.id,
          game_concept_id: gameConceptId,
          channel: 'email',
          expires_in_hours: 72,
        }),
      }
    );

    if (response.ok) {
      const result = await response.json();
      alert(`Test invitation sent! Game URL: ${result.game_url}`);
      loadDashboardData();
    } else {
      alert('Failed to send invitation');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 p-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-gray-400">Loading wellbeing games dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Nova IQ</h1>
            <p className="text-gray-400">
              Off-platform behavioral check-ins for proactive responsible gambling
            </p>
          </div>
          <div className="flex gap-2">
            <SendNovaIQInvitation
              casinoId={user?.casino_id}
              onSuccess={loadDashboardData}
            />
            <Button
              onClick={exportReport}
              variant="outline"
              className="border-slate-700 hover:bg-slate-800 text-white"
            >
              <FileDown className="w-4 h-4 mr-2" />
              Export Report
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Total Invitations</CardTitle>
              <Send className="w-4 h-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats?.totalInvitations || 0}</div>
              <p className="text-xs text-gray-500 mt-1">Sent to players</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Engagement Rate</CardTitle>
              <Target className="w-4 h-4 text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats?.engagementRate || 0}%</div>
              <p className="text-xs text-gray-500 mt-1">Completion rate</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Completed Games</CardTitle>
              <CheckCircle2 className="w-4 h-4 text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats?.completedInvitations || 0}</div>
              <p className="text-xs text-gray-500 mt-1">Successfully finished</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Active Campaigns</CardTitle>
              <BarChart3 className="w-4 h-4 text-orange-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats?.activeCampaigns || 0}</div>
              <p className="text-xs text-gray-500 mt-1">Running now</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="games" className="space-y-4">
          <TabsList className="bg-slate-900 border border-slate-800">
            <TabsTrigger value="games" className="data-[state=active]:bg-slate-800">
              Available Tools
            </TabsTrigger>
            <TabsTrigger value="sessions" className="data-[state=active]:bg-slate-800">
              Recent Sessions
            </TabsTrigger>
            <TabsTrigger value="insights" className="data-[state=active]:bg-slate-800">
              AI Insights
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="data-[state=active]:bg-slate-800">
              Campaigns
            </TabsTrigger>
          </TabsList>

          <TabsContent value="games" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {gameConcepts.map((game) => (
                <Card key={game.id} className="bg-slate-900 border-slate-800">
                  <CardHeader>
                    <CardTitle className="text-white">{game.name}</CardTitle>
                    <CardDescription className="text-gray-400">
                      {game.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-300">{game.duration_minutes} minutes</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {game.mechanics_type.replace('_', ' ')}
                      </Badge>
                      <Button
                        onClick={() => sendTestInvitation(game.id)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        size="sm"
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Send Test Invitation
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="sessions" className="space-y-4">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white">Recent Game Sessions</CardTitle>
                <CardDescription className="text-gray-400">
                  Latest player wellbeing check-ins
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentSessions.length === 0 ? (
                    <p className="text-gray-500 text-sm">No sessions yet</p>
                  ) : (
                    recentSessions.map((session) => (
                      <div
                        key={session.id}
                        className="flex items-center justify-between p-3 bg-slate-800 rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="text-white font-medium">
                            {session.player?.first_name} {session.player?.last_name}
                          </p>
                          <p className="text-sm text-gray-400">{session.game_concept?.name}</p>
                        </div>
                        <div className="flex items-center gap-3">
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
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => viewSessionDetails(session.id)}
                            className="border-slate-700 hover:bg-slate-700"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))
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
                  Recent AI Insights
                </CardTitle>
                <CardDescription className="text-gray-400">
                  AI-generated behavioral insights from player sessions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
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

          <TabsContent value="campaigns" className="space-y-4">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white">Active Campaigns</CardTitle>
                <CardDescription className="text-gray-400">
                  Manage your wellbeing game campaigns
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {campaigns.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500 mb-4">No campaigns configured yet</p>
                      <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                        Create Campaign
                      </Button>
                    </div>
                  ) : (
                    campaigns.map((campaign) => (
                      <div
                        key={campaign.id}
                        className="flex items-center justify-between p-3 bg-slate-800 rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="text-white font-medium">{campaign.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {campaign.trigger_type.replace('_', ' ')}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {campaign.channel === 'email' ? <Mail className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
                              {campaign.channel}
                            </Badge>
                          </div>
                        </div>
                        <div>
                          {campaign.active ? (
                            <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline">Paused</Badge>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Compliance Benefits</CardTitle>
            <CardDescription className="text-gray-400">
              How wellbeing games strengthen your responsible gambling program
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-800 rounded-lg">
                <TrendingUp className="w-8 h-8 text-blue-400 mb-3" />
                <h3 className="text-white font-semibold mb-2">Early Detection</h3>
                <p className="text-sm text-gray-400">
                  Identify behavioral risk patterns before they escalate
                </p>
              </div>
              <div className="p-4 bg-slate-800 rounded-lg">
                <Users className="w-8 h-8 text-green-400 mb-3" />
                <h3 className="text-white font-semibold mb-2">Proactive Engagement</h3>
                <p className="text-sm text-gray-400">
                  Reach players outside the casino environment
                </p>
              </div>
              <div className="p-4 bg-slate-800 rounded-lg">
                <CheckCircle2 className="w-8 h-8 text-purple-400 mb-3" />
                <h3 className="text-white font-semibold mb-2">Regulator Evidence</h3>
                <p className="text-sm text-gray-400">
                  Demonstrate proactive compliance efforts
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <DetailedSessionViewer
        sessionId={selectedSessionId}
        open={showSessionViewer}
        onClose={() => setShowSessionViewer(false)}
      />
    </div>
  );
}
