'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/lib/supabase';
import { Clock, DollarSign, TrendingDown, TrendingUp, Activity, ShieldAlert, CircleCheck as CheckCircle, Circle as XCircle, Calendar, Target, ChartBar as BarChart3 } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface PlayerHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  player: any;
}

interface Session {
  id: string;
  game_type: string;
  start_time: string;
  end_time: string | null;
  duration: number;
  total_bets: number;
  total_wagered: number;
  total_won: number;
  net_result: number;
  risk_score_change: number;
  is_active: boolean;
}

interface Intervention {
  id: string;
  intervention_type: string;
  trigger_reason: string;
  risk_score_at_trigger: number;
  delivery_method: string;
  dispatch_status: string | null;
  intervention_successful: boolean;
  auto_triggered: boolean;
  triggered_at: string;
  message_sent: string | null;
}

interface SignalPoint {
  recorded_at: string;
  risk_score: number;
  session_duration_score: number;
  loss_escalation_score: number;
  deposit_frequency_score: number;
}

export function PlayerHistorySheet({ open, onOpenChange, player }: PlayerHistorySheetProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [signalHistory, setSignalHistory] = useState<SignalPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && player?.id) {
      loadHistory();
    }
  }, [open, player?.id]);

  async function loadHistory() {
    setLoading(true);
    const [sessRes, intRes, sigRes] = await Promise.all([
      supabase
        .from('gaming_sessions')
        .select('*')
        .eq('player_id', player.id)
        .order('start_time', { ascending: false })
        .limit(50),
      supabase
        .from('intervention_history')
        .select('*')
        .eq('player_id', player.id)
        .order('triggered_at', { ascending: false })
        .limit(30),
      supabase
        .from('bri_signal_history')
        .select('*')
        .eq('player_id', player.id)
        .order('recorded_at', { ascending: false })
        .limit(30),
    ]);
    setSessions(sessRes.data || []);
    setInterventions(intRes.data || []);
    setSignalHistory([...(sigRes.data || [])].reverse());
    setLoading(false);
  }

  if (!player) return null;

  const trendData = signalHistory.map((h) => ({
    date: new Date(h.recorded_at).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' }),
    risk: h.risk_score,
    loss: h.loss_escalation_score,
    session: h.session_duration_score,
  }));

  const totalWagered = sessions.reduce((s, x) => s + Number(x.total_wagered || 0), 0);
  const totalNet = sessions.reduce((s, x) => s + Number(x.net_result || 0), 0);
  const avgDuration = sessions.length
    ? Math.round(sessions.reduce((s, x) => s + (x.duration || 0), 0) / sessions.length)
    : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted font-semibold text-sm uppercase">
              {player.first_name?.[0]}{player.last_name?.[0]}
            </div>
            <div>
              <div>{player.first_name} {player.last_name}</div>
              <div className="font-mono text-xs font-normal text-muted-foreground">{player.player_id}</div>
            </div>
          </SheetTitle>
          <SheetDescription>Full player history — sessions, interventions &amp; risk signals</SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-2.5 mb-5">
              {[
                { label: 'Sessions', value: sessions.length, icon: Activity },
                { label: 'Total Wagered', value: `R${totalWagered.toLocaleString()}`, icon: DollarSign },
                { label: 'Avg Duration', value: `${avgDuration}m`, icon: Clock },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="rounded-lg border bg-card p-3 text-center">
                  <Icon className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                  <div className="text-base font-semibold tabular-nums">{value}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>

            <Tabs defaultValue="sessions">
              <TabsList className="w-full mb-4">
                <TabsTrigger value="sessions" className="flex-1">
                  Sessions
                  {sessions.length > 0 && (
                    <Badge variant="secondary" className="ml-1.5 text-xs">{sessions.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="interventions" className="flex-1">
                  Interventions
                  {interventions.length > 0 && (
                    <Badge variant="secondary" className="ml-1.5 text-xs">{interventions.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="signals" className="flex-1">Risk Trend</TabsTrigger>
              </TabsList>

              {/* Sessions Tab */}
              <TabsContent value="sessions" className="space-y-2.5 mt-0">
                {sessions.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">No session history available</div>
                ) : (
                  sessions.map((s) => {
                    const net = Number(s.net_result || 0);
                    return (
                      <div key={s.id} className="rounded-lg border bg-card p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium capitalize">{s.game_type || 'Casino'}</span>
                            {s.is_active && (
                              <Badge className="text-xs py-0 bg-emerald-100 text-emerald-800">Live</Badge>
                            )}
                          </div>
                          <span className={`text-sm font-semibold tabular-nums ${net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {net >= 0 ? '+' : ''}R{Math.abs(net).toLocaleString()}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{s.duration || 0}m</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            <span>{s.total_bets || 0} bets</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            <span>R{Number(s.total_wagered || 0).toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(s.start_time).toLocaleString('en-ZA', {
                            day: '2-digit', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
                {sessions.length > 0 && (
                  <div className="pt-2 border-t text-xs text-muted-foreground flex justify-between">
                    <span>Net across all sessions</span>
                    <span className={`font-semibold ${totalNet >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {totalNet >= 0 ? '+' : ''}R{Math.abs(totalNet).toLocaleString()}
                    </span>
                  </div>
                )}
              </TabsContent>

              {/* Interventions Tab */}
              <TabsContent value="interventions" className="space-y-2.5 mt-0">
                {interventions.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">No interventions recorded</div>
                ) : (
                  interventions.map((i) => (
                    <div key={i.id} className="rounded-lg border bg-card p-3.5 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <ShieldAlert className="h-4 w-4 text-orange-500 shrink-0" />
                          <span className="text-sm font-medium capitalize">{i.intervention_type?.replace(/_/g, ' ') || 'Intervention'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {i.intervention_successful
                            ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                            : <XCircle className="h-3.5 w-3.5 text-muted-foreground" />}
                          <Badge variant="outline" className="text-xs py-0">
                            Risk {i.risk_score_at_trigger}
                          </Badge>
                        </div>
                      </div>
                      {i.trigger_reason && (
                        <p className="text-xs text-muted-foreground leading-relaxed">{i.trigger_reason}</p>
                      )}
                      {i.message_sent && (
                        <p className="text-xs bg-muted/40 rounded p-2 leading-relaxed">{i.message_sent}</p>
                      )}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="capitalize">{i.delivery_method?.replace(/_/g, ' ') || '—'}</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(i.triggered_at).toLocaleDateString('en-ZA', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>

              {/* Risk Trend Tab */}
              <TabsContent value="signals" className="mt-0">
                {trendData.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">No signal history available</div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold">Risk Signal History</span>
                      <span className="text-xs text-muted-foreground ml-auto">{trendData.length} data points</span>
                    </div>
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                          <defs>
                            <linearGradient id="histRiskGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" fontSize={9} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                          <YAxis domain={[0, 100]} fontSize={9} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '6px',
                              fontSize: '11px',
                            }}
                          />
                          <Area type="monotone" dataKey="risk" stroke="#ef4444" strokeWidth={2}
                            fill="url(#histRiskGrad)" name="Risk Score" />
                          <Area type="monotone" dataKey="loss" stroke="#f97316" strokeWidth={1.5}
                            fill="none" name="Loss Escalation" strokeDasharray="4 2" />
                          <Area type="monotone" dataKey="session" stroke="#3b82f6" strokeWidth={1.5}
                            fill="none" name="Session Duration" strokeDasharray="2 3" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    <Separator className="my-4" />

                    <div className="space-y-2">
                      {signalHistory.slice().reverse().slice(0, 8).map((h, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs py-1.5 border-b border-dashed border-muted last:border-0">
                          <span className="text-muted-foreground">
                            {new Date(h.recorded_at).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-muted-foreground">Loss: <span className="text-foreground font-medium">{h.loss_escalation_score}</span></span>
                            <span className="text-muted-foreground">Session: <span className="text-foreground font-medium">{h.session_duration_score}</span></span>
                            <span className={`font-semibold ${h.risk_score >= 60 ? 'text-red-600' : h.risk_score >= 40 ? 'text-amber-600' : 'text-emerald-600'}`}>
                              {h.risk_score}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
