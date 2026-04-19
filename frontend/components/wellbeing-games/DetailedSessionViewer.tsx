'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Brain,
  Clock,
  MousePointer,
  Target,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  Award,
} from 'lucide-react';

interface DetailedSessionViewerProps {
  sessionId: string | null;
  open: boolean;
  onClose: () => void;
}

export default function DetailedSessionViewer({
  sessionId,
  open,
  onClose,
}: DetailedSessionViewerProps) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [insights, setInsights] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const [telemetry, setTelemetry] = useState<any[]>([]);

  useEffect(() => {
    if (sessionId && open) {
      loadSessionDetails();
    }
  }, [sessionId, open]);

  async function loadSessionDetails() {
    setLoading(true);

    const [sessionRes, insightsRes, badgesRes, telemetryRes] = await Promise.all([
      supabase
        .from('wellbeing_game_sessions')
        .select(`
          *,
          player:players(first_name, last_name, email),
          game_concept:wellbeing_game_concepts(name, description),
          casino:casinos(name)
        `)
        .eq('id', sessionId)
        .single(),
      supabase
        .from('wellbeing_game_insights')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false }),
      supabase
        .from('wellbeing_player_badges')
        .select('*, badge:wellbeing_game_badges(*)')
        .eq('session_id', sessionId),
      supabase
        .from('wellbeing_game_telemetry_events')
        .select('*')
        .eq('session_id', sessionId)
        .order('event_sequence', { ascending: true })
        .limit(100),
    ]);

    setSession(sessionRes.data);
    setInsights(insightsRes.data || []);
    setBadges(badgesRes.data || []);
    setTelemetry(telemetryRes.data || []);
    setLoading(false);
  }

  if (!open) return null;

  const getRiskColor = (risk: number) => {
    if (risk < 40) return 'text-green-400';
    if (risk < 70) return 'text-orange-400';
    return 'text-red-400';
  };

  const getRiskBadgeVariant = (risk: number) => {
    if (risk < 40) return 'default';
    if (risk < 70) return 'secondary';
    return 'destructive';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] bg-slate-900 border-slate-800">
        <DialogHeader>
          <DialogTitle className="text-2xl text-white">
            Session Details
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {loading ? 'Loading...' : `${session?.player?.first_name} ${session?.player?.last_name} - ${session?.game_concept?.name}`}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-gray-400">Loading session data...</div>
        ) : (
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-gray-400">Risk Index</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${getRiskColor(session?.behaviour_risk_index || 0)}`}>
                      {Math.round(session?.behaviour_risk_index || 0)}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-gray-400">Balance Score</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-400">
                      {Math.round(session?.balance_score || 0)}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-gray-400">Hesitation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-400">
                      {session?.hesitation_score || 0}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-gray-400">Consistency</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-400">
                      {session?.consistency_score || 0}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Tabs defaultValue="choices" className="w-full">
                <TabsList className="bg-slate-800 border border-slate-700">
                  <TabsTrigger value="choices">Player Choices</TabsTrigger>
                  <TabsTrigger value="insights">AI Insights</TabsTrigger>
                  <TabsTrigger value="telemetry">Telemetry</TabsTrigger>
                  <TabsTrigger value="badges">Badges</TabsTrigger>
                </TabsList>

                <TabsContent value="choices" className="space-y-4 mt-4">
                  <Card className="bg-slate-800 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <Target className="w-5 h-5" />
                        Decision Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {session?.choices_made && session.choices_made.length > 0 ? (
                        <div className="space-y-3">
                          {session.choices_made.map((choice: any, index: number) => (
                            <div
                              key={index}
                              className="p-4 bg-slate-900 rounded-lg border border-slate-700"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <p className="text-white font-medium mb-1">
                                    Scenario {choice.scenario_id || index + 1}
                                  </p>
                                  <p className="text-sm text-gray-400">
                                    {choice.scenario_description || 'No description'}
                                  </p>
                                </div>
                                <Badge
                                  variant={
                                    choice.risk_level === 'safe'
                                      ? 'default'
                                      : choice.risk_level === 'moderate'
                                      ? 'secondary'
                                      : 'destructive'
                                  }
                                >
                                  {choice.risk_level || 'unknown'}
                                </Badge>
                              </div>
                              <div className="mt-3 p-3 bg-slate-950 rounded border border-slate-600">
                                <p className="text-sm text-gray-300">
                                  <span className="text-gray-400">Choice:</span>{' '}
                                  {choice.choice_text || choice.choice || 'N/A'}
                                </p>
                                {choice.decision_time_ms && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    <Clock className="w-3 h-3 inline mr-1" />
                                    {(choice.decision_time_ms / 1000).toFixed(1)}s
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">No choices recorded</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="insights" className="space-y-4 mt-4">
                  {insights.length > 0 ? (
                    insights.map((insight) => (
                      <Card
                        key={insight.id}
                        className="bg-slate-800 border-slate-700"
                      >
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <Lightbulb className="w-5 h-5 text-yellow-400" />
                              <CardTitle className="text-white">{insight.title}</CardTitle>
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
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="text-gray-300">{insight.description}</p>
                          {insight.recommendation && (
                            <div className="p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                              <p className="text-sm text-blue-300">
                                <span className="font-semibold">Recommendation:</span>{' '}
                                {insight.recommendation}
                              </p>
                            </div>
                          )}
                          {insight.evidence && insight.evidence.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs text-gray-400 mb-1">Evidence:</p>
                              <ul className="text-xs text-gray-500 space-y-1">
                                {insight.evidence.map((ev: string, i: number) => (
                                  <li key={i}>• {ev}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <Card className="bg-slate-800 border-slate-700">
                      <CardContent className="py-8 text-center">
                        <p className="text-gray-500">No AI insights generated yet</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="telemetry" className="space-y-4 mt-4">
                  <Card className="bg-slate-800 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <MousePointer className="w-5 h-5" />
                        Behavioral Telemetry
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {telemetry.length > 0 ? (
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {telemetry.map((event, index) => (
                            <div
                              key={event.id}
                              className="p-2 bg-slate-900 rounded text-xs border border-slate-700"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-gray-400">
                                  #{event.event_sequence} - {event.event_type}
                                </span>
                                {event.hesitation_detected && (
                                  <Badge variant="secondary" className="text-xs">
                                    Hesitation
                                  </Badge>
                                )}
                              </div>
                              {event.hover_duration_ms && (
                                <p className="text-gray-500 mt-1">
                                  Hover: {event.hover_duration_ms}ms
                                </p>
                              )}
                              {event.time_on_scenario_ms && (
                                <p className="text-gray-500">
                                  Time on scenario: {(event.time_on_scenario_ms / 1000).toFixed(1)}s
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">No telemetry data recorded</p>
                      )}
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-3 gap-4">
                    <Card className="bg-slate-800 border-slate-700">
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <p className="text-xs text-gray-400 mb-1">Events Tracked</p>
                          <p className="text-xl font-bold text-white">{telemetry.length}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-slate-800 border-slate-700">
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <p className="text-xs text-gray-400 mb-1">Risk Escalation</p>
                          <p className="text-xl font-bold">
                            {session?.risk_escalation_detected ? (
                              <span className="text-red-400">Yes</span>
                            ) : (
                              <span className="text-green-400">No</span>
                            )}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-slate-800 border-slate-700">
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <p className="text-xs text-gray-400 mb-1">Speed Variance</p>
                          <p className="text-xl font-bold text-white">
                            {session?.decision_speed_variance?.toFixed(1) || '0.0'}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="badges" className="space-y-4 mt-4">
                  {badges.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4">
                      {badges.map((badge) => (
                        <Card
                          key={badge.id}
                          className="bg-slate-800 border-slate-700"
                        >
                          <CardContent className="pt-6">
                            <div className="flex items-start gap-3">
                              <Award className="w-10 h-10 text-yellow-400" />
                              <div>
                                <h4 className="text-white font-semibold">
                                  {badge.badge.name}
                                </h4>
                                <p className="text-sm text-gray-400 mt-1">
                                  {badge.badge.description}
                                </p>
                                <Badge className="mt-2 text-xs" variant="outline">
                                  {badge.badge.tier}
                                </Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card className="bg-slate-800 border-slate-700">
                      <CardContent className="py-8 text-center">
                        <p className="text-gray-500">No badges earned in this session</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>

              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Session Metadata</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-400">Casino</p>
                      <p className="text-white font-medium">{session?.casino?.name}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Player Email</p>
                      <p className="text-white font-medium">{session?.player?.email}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Started At</p>
                      <p className="text-white font-medium">
                        {new Date(session?.started_at).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">Completed At</p>
                      <p className="text-white font-medium">
                        {session?.completed_at
                          ? new Date(session.completed_at).toLocaleString()
                          : 'In progress'}
                      </p>
                    </div>
                    {session?.device_info && Object.keys(session.device_info).length > 0 && (
                      <div className="col-span-2">
                        <p className="text-gray-400">Device</p>
                        <p className="text-white font-medium">
                          {session.device_info.browser || 'Unknown'} on{' '}
                          {session.device_info.platform || 'Unknown'}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
