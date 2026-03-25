'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Mail, MessageSquare, TrendingUp, Users, Clock, Target, CircleCheck as CheckCircle2, Send, ChartBar as BarChart3, Eye, FileDown, Lightbulb, Brain, Sparkles, Activity } from 'lucide-react';
import DetailedSessionViewer from '@/components/wellbeing-games/DetailedSessionViewer';
import { generateWellbeingReport } from '@/lib/wellbeingGameAnalytics';
import { SendNovaIQInvitation } from '@/components/SendNovaIQInvitation';
import { PageHeader } from '@/components/saas/PageHeader';
import { KPICard } from '@/components/saas/KPICard';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DashboardLayout } from '@/components/DashboardLayout';

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
      .maybeSingle();

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
        .select(`*, player:players(first_name, last_name), game_concept:wellbeing_game_concepts(name)`)
        .eq('casino_id', casinoId)
        .order('started_at', { ascending: false })
        .limit(10),
      supabase.from('wellbeing_game_invitations').select('status').eq('casino_id', casinoId),
      supabase
        .from('wellbeing_game_insights')
        .select('*')
        .eq('casino_id', casinoId)
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    setGameConcepts(conceptsRes.data || []);
    setCampaigns(campaignsRes.data || []);
    setRecentSessions(sessionsRes.data || []);
    setInsights(insightsRes.data || []);

    const invitations = invitationsRes.data || [];
    const totalInvitations = invitations.length;
    const completedInvitations = invitations.filter(i => i.status === 'completed').length;
    const engagementRate = totalInvitations > 0 ? (completedInvitations / totalInvitations) * 100 : 0;

    setStats({
      totalInvitations,
      completedInvitations,
      openedInvitations: invitations.filter(i => i.status === 'opened').length,
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
      .maybeSingle();

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
      .maybeSingle();

    if (!staffData) return;

    const { data: players } = await supabase
      .from('players')
      .select('id')
      .eq('casino_id', staffData.casino_id)
      .limit(1)
      .maybeSingle();

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

  function getRiskBadgeVariant(bri: number) {
    if (bri < 40) return 'success';
    if (bri < 70) return 'warning';
    return 'destructive';
  }

  function getRiskLabel(bri: number) {
    if (bri < 40) return 'Low Risk';
    if (bri < 70) return 'Moderate';
    return 'High Risk';
  }

  return (
    <DashboardLayout>
      <TooltipProvider>
      <div className="flex flex-col min-h-full">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="text-muted-foreground text-sm">Loading Nova IQ dashboard...</div>
          </div>
        ) : (<>
        <PageHeader
          title="Nova IQ"
          subtitle="Off-platform behavioral check-ins for proactive responsible gambling"
          actions={
            <div className="flex gap-2">
              <SendNovaIQInvitation
                casinoId={user?.casino_id}
                onSuccess={loadDashboardData}
              />
              <Button
                onClick={exportReport}
                variant="outline"
                size="sm"
              >
                <FileDown className="w-4 h-4 mr-2" />
                Export Report
              </Button>
            </div>
          }
        />

        <div className="flex-1 p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Total Invitations"
              value={stats?.totalInvitations ?? 0}
              icon={Send}
              tooltip="Total Nova IQ check-in invitations sent to players"
            />
            <KPICard
              title="Engagement Rate"
              value={stats?.engagementRate ?? 0}
              valueSuffix="%"
              icon={Target}
              tooltip="Percentage of invited players who completed a session"
            />
            <KPICard
              title="Completed Sessions"
              value={stats?.completedInvitations ?? 0}
              icon={CheckCircle2}
              tooltip="Number of fully completed wellbeing game sessions"
            />
            <KPICard
              title="Active Campaigns"
              value={stats?.activeCampaigns ?? 0}
              icon={BarChart3}
              tooltip="Currently running automated invitation campaigns"
            />
          </div>

          <Tabs defaultValue="games" className="space-y-4">
            <TabsList>
              <TabsTrigger value="games">Available Tools</TabsTrigger>
              <TabsTrigger value="sessions">Recent Sessions</TabsTrigger>
              <TabsTrigger value="insights">AI Insights</TabsTrigger>
              <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            </TabsList>

            <TabsContent value="games" className="space-y-4">
              {gameConcepts.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <Brain className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-heading-3 mb-2">No game tools available</h3>
                    <p className="text-body text-muted-foreground max-w-sm">
                      Wellbeing game concepts will appear here once they are configured.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {gameConcepts.map((game) => (
                    <Card key={game.id} className="card-elevation flex flex-col">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                            <Sparkles className="h-5 w-5" />
                          </div>
                          <Badge variant="outline" className="text-xs capitalize">
                            {game.mechanics_type?.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                        <CardTitle className="text-heading-3 mt-3">{game.name}</CardTitle>
                        <CardDescription className="text-body">
                          {game.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="mt-auto space-y-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          <span>{game.duration_minutes} minutes</span>
                        </div>
                        <Button
                          onClick={() => sendTestInvitation(game.id)}
                          className="w-full"
                          size="sm"
                        >
                          <Send className="w-4 h-4 mr-2" />
                          Send Test Invitation
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="sessions" className="space-y-4">
              <Card className="card-elevation">
                <CardHeader>
                  <CardTitle className="text-heading-3 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-primary" />
                    Recent Game Sessions
                  </CardTitle>
                  <CardDescription>Latest player wellbeing check-ins and behavioral scores</CardDescription>
                </CardHeader>
                <CardContent>
                  {recentSessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Activity className="h-10 w-10 text-muted-foreground mb-3" />
                      <p className="text-body text-muted-foreground">No sessions recorded yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {recentSessions.map((session) => (
                        <div
                          key={session.id}
                          className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {session.player?.first_name} {session.player?.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground">{session.game_concept?.name}</p>
                          </div>
                          <div className="flex items-center gap-3 ml-4 shrink-0">
                            <div className="text-right">
                              {session.behaviour_risk_index !== null ? (
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                  session.behaviour_risk_index < 40
                                    ? 'bg-success/10 text-success'
                                    : session.behaviour_risk_index < 70
                                    ? 'bg-warning/10 text-warning'
                                    : 'bg-destructive/10 text-destructive'
                                }`}>
                                  {getRiskLabel(session.behaviour_risk_index)} · {Math.round(session.behaviour_risk_index)}
                                </span>
                              ) : (
                                <Badge variant="secondary">Processing</Badge>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(session.started_at).toLocaleDateString()}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => viewSessionDetails(session.id)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="insights" className="space-y-4">
              <Card className="card-elevation">
                <CardHeader>
                  <CardTitle className="text-heading-3 flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-primary" />
                    AI Behavioral Insights
                  </CardTitle>
                  <CardDescription>AI-generated insights from player wellbeing sessions</CardDescription>
                </CardHeader>
                <CardContent>
                  {insights.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Lightbulb className="h-10 w-10 text-muted-foreground mb-3" />
                      <p className="text-body text-muted-foreground">No insights generated yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {insights.map((insight) => (
                        <div
                          key={insight.id}
                          className="rounded-lg border border-border bg-muted/20 p-4"
                        >
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <h4 className="text-sm font-semibold text-foreground">{insight.title}</h4>
                            <Badge
                              variant={
                                insight.severity === 'info'
                                  ? 'secondary'
                                  : insight.severity === 'warning'
                                  ? 'outline'
                                  : 'destructive'
                              }
                              className="shrink-0 capitalize"
                            >
                              {insight.severity}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{insight.description}</p>
                          {insight.recommendation && (
                            <div className="mt-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
                              <p className="text-xs text-foreground">
                                <span className="font-semibold text-primary">Recommendation: </span>
                                {insight.recommendation}
                              </p>
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            {new Date(insight.created_at).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="campaigns" className="space-y-4">
              <Card className="card-elevation">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-heading-3">Campaigns</CardTitle>
                      <CardDescription>Automated wellbeing invitation campaigns</CardDescription>
                    </div>
                    {campaigns.length > 0 && (
                      <Button size="sm">Create Campaign</Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {campaigns.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <BarChart3 className="h-10 w-10 text-muted-foreground mb-3" />
                      <h3 className="text-sm font-semibold mb-1">No campaigns configured</h3>
                      <p className="text-xs text-muted-foreground mb-4 max-w-sm">
                        Set up automated campaigns to send Nova IQ invitations based on player behavior triggers.
                      </p>
                      <Button size="sm">Create Campaign</Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {campaigns.map((campaign) => (
                        <div
                          key={campaign.id}
                          className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{campaign.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs capitalize">
                                {campaign.trigger_type?.replace(/_/g, ' ')}
                              </Badge>
                              <Badge variant="outline" className="text-xs flex items-center gap-1">
                                {campaign.channel === 'email'
                                  ? <Mail className="w-3 h-3" />
                                  : <MessageSquare className="w-3 h-3" />
                                }
                                {campaign.channel}
                              </Badge>
                            </div>
                          </div>
                          <div className="ml-4 shrink-0">
                            {campaign.active ? (
                              <span className="inline-flex items-center rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                                Active
                              </span>
                            ) : (
                              <Badge variant="secondary">Paused</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="card-elevation">
              <CardContent className="p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold mb-1">Early Detection</h3>
                <p className="text-xs text-muted-foreground">
                  Identify behavioral risk patterns before they escalate within the casino environment.
                </p>
              </CardContent>
            </Card>
            <Card className="card-elevation">
              <CardContent className="p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success mb-4">
                  <Users className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold mb-1">Proactive Engagement</h3>
                <p className="text-xs text-muted-foreground">
                  Reach players in a non-intrusive way outside of the active gambling environment.
                </p>
              </CardContent>
            </Card>
            <Card className="card-elevation">
              <CardContent className="p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10 text-info mb-4">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold mb-1">Regulator Evidence</h3>
                <p className="text-xs text-muted-foreground">
                  Demonstrate proactive responsible gambling compliance to regulatory bodies.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        <DetailedSessionViewer
          sessionId={selectedSessionId}
          open={showSessionViewer}
          onClose={() => setShowSessionViewer(false)}
        />
        </>)}
      </div>
      </TooltipProvider>
    </DashboardLayout>
  );
}
