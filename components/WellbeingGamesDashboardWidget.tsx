'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { KPICard } from '@/components/saas/KPICard';
import { ChartCard } from '@/components/saas/ChartCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Target,
  CheckCircle2,
  Send,
  Eye,
  Clock,
  Users,
  Activity,
  ArrowRight,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import DetailedSessionViewer from '@/components/wellbeing-games/DetailedSessionViewer';
import { SendNovaIQInvitation } from '@/components/SendNovaIQInvitation';

export function WellbeingGamesDashboardWidget() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [gameConcepts, setGameConcepts] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showSessionViewer, setShowSessionViewer] = useState(false);
  const [recentInsights, setRecentInsights] = useState<any[]>([]);

  useEffect(() => {
    if (user?.casino_id) {
      loadData();
    }
  }, [user]);

  async function loadData() {
    setLoading(true);

    const casinoId = user?.casino_id;
    if (!casinoId) {
      setLoading(false);
      return;
    }

    const [conceptsRes, sessionsRes, invitationsRes, insightsRes] = await Promise.all([
      supabase
        .from('wellbeing_game_concepts')
        .select('*')
        .eq('active', true)
        .order('name')
        .limit(5),
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
      supabase
        .from('wellbeing_game_invitations')
        .select('status, player_id')
        .eq('casino_id', casinoId),
      supabase
        .from('wellbeing_game_insights')
        .select('*')
        .eq('casino_id', casinoId)
        .order('created_at', { ascending: false })
        .limit(3)
    ]);

    setGameConcepts(conceptsRes.data || []);
    setRecentSessions(sessionsRes.data || []);
    setRecentInsights(insightsRes.data || []);

    const invitations = invitationsRes.data || [];
    const totalInvitations = invitations.length;
    const completedInvitations = invitations.filter(i => i.status === 'completed').length;
    const pendingInvitations = invitations.filter(i => i.status === 'pending').length;
    const uniquePlayers = new Set(invitations.map(i => i.player_id)).size;
    const engagementRate = totalInvitations > 0 ? (completedInvitations / totalInvitations) * 100 : 0;

    setStats({
      totalInvitations,
      completedInvitations,
      pendingInvitations,
      uniquePlayers,
      engagementRate: Math.round(engagementRate),
    });

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Nova IQ Assessments</h2>
            <p className="text-sm text-muted-foreground">Send off-platform behavioral check-ins to players</p>
          </div>
          <SendNovaIQInvitation casinoId={user?.casino_id} onSuccess={loadData} />
        </div>

        {/* KPI Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Total Invitations"
            value={stats?.totalInvitations || 0}
            change={{ value: 12.5, type: 'increase', label: 'vs last month' }}
            icon={Send}
            tooltip="Total wellbeing game invitations sent to players for behavioral check-ins and risk assessment."
          />
          <KPICard
            title="Engagement Rate"
            value={stats?.engagementRate || 0}
            valueSuffix="%"
            change={{ value: 8.3, type: 'increase', label: 'vs last month' }}
            icon={Target}
            tooltip="Percentage of players who completed wellbeing games after receiving invitations."
          />
          <KPICard
            title="Completed Assessments"
            value={stats?.completedInvitations || 0}
            change={{ value: 15.7, type: 'increase', label: 'vs last month' }}
            icon={CheckCircle2}
            tooltip="Total number of successfully completed assessments with behavioral insights generated."
          />
          <KPICard
            title="Players Engaged"
            value={stats?.uniquePlayers || 0}
            change={{ value: 10.2, type: 'increase', label: 'vs last month' }}
            icon={Users}
            tooltip="Unique number of players who have participated in wellbeing games for behavioral assessment."
          />
        </div>

        {/* Recent Insights */}
        {recentInsights.length > 0 && (
          <ChartCard
            title="Recent AI Insights"
            description="Latest behavioral insights from player sessions"
            tooltip="AI-generated insights from wellbeing game sessions that help identify risk patterns and recommend interventions."
          >
            <div className="space-y-3">
              {recentInsights.map((insight) => (
                <div
                  key={insight.id}
                  className="p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm text-foreground">{insight.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {insight.description}
                      </p>
                    </div>
                    <Badge
                      variant={
                        insight.severity === 'info'
                          ? 'default'
                          : insight.severity === 'warning'
                          ? 'secondary'
                          : 'destructive'
                      }
                    >
                      {insight.severity}
                    </Badge>
                  </div>
                  {insight.recommendation && (
                    <div className="mt-3 p-3 bg-primary/10 rounded border border-primary/20">
                      <p className="text-xs text-foreground">
                        <strong className="text-primary">Recommendation:</strong> {insight.recommendation}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ChartCard>
        )}

        {/* Two Column Layout */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Available Tools */}
          <ChartCard
            title="Available Tools"
            description="Quick-launch wellbeing check-in games"
            tooltip="Interactive games designed to assess player behavior, impulse control, and risk awareness through engaging gameplay."
            headerAction={
              <Button variant="ghost" size="sm" onClick={() => router.push('/casino/wellbeing-games')}>
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            }
          >
            <div className="space-y-2">
              {gameConcepts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No games available</p>
              ) : (
                gameConcepts.map((game) => (
                  <div
                    key={game.id}
                    className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm text-foreground">{game.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {game.duration_minutes} min
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {game.mechanics_type.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                    <Button size="sm" variant="outline">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </ChartCard>

          {/* Recent Sessions */}
          <ChartCard
            title="Recent Sessions"
            description="Latest player wellbeing check-ins"
            tooltip="Recently completed wellbeing game sessions with risk scores and behavioral insights."
            headerAction={
              <Button variant="ghost" size="sm" onClick={() => router.push('/casino/wellbeing-games')}>
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            }
          >
            <div className="space-y-2">
              {recentSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No sessions yet</p>
              ) : (
                recentSessions.slice(0, 5).map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm text-foreground">
                        {session.player?.first_name} {session.player?.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {session.game_concept?.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
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
                    </div>
                  </div>
                ))
              )}
            </div>
          </ChartCard>
        </div>

        {/* Compliance Benefits */}
        <ChartCard
          title="Compliance Benefits"
          description="How wellbeing games strengthen your responsible gambling program"
          tooltip="Key compliance advantages of implementing off-platform behavioral assessments through interactive wellbeing games."
        >
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-start gap-3 p-4 border border-border rounded-lg">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-foreground">Early Detection</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Identify behavioral risk patterns before they escalate into problem gambling
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 border border-border rounded-lg">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-foreground">Proactive Engagement</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Reach players outside the casino environment for unbiased assessments
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 border border-border rounded-lg">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-foreground">Regulator Evidence</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Demonstrate proactive compliance efforts with documented player wellbeing initiatives
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
