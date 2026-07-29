'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { RiskSignalBreakdown } from '@/components/RiskSignalBreakdown';
import { TooltipProvider } from '@/components/ui/tooltip';
import { TriangleAlert as AlertTriangle, TrendingDown, TrendingUp, Clock, DollarSign, Target, Activity, Minus, Calendar, ChartBar as BarChart3 } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatPlayerId, playerAvatarChars } from '@/lib/playerIdentity';

interface PlayerRiskProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  player: any;
  signalHistory?: any[];
  onIntervene?: () => void;
  onViewHistory?: () => void;
}

const getRiskConfig = (score: number) => {
  if (score >= 80) return {
    label: 'Critical Intervention Required',
    color: 'text-red-600',
    bg: 'bg-red-50 border-red-200',
    bar: 'bg-red-500',
    badge: 'destructive' as const,
    pulse: 'bg-red-500',
  };
  if (score >= 60) return {
    label: 'High Risk',
    color: 'text-orange-600',
    bg: 'bg-orange-50 border-orange-200',
    bar: 'bg-orange-500',
    badge: 'default' as const,
    pulse: 'bg-orange-500',
  };
  if (score >= 40) return {
    label: 'Moderate Risk',
    color: 'text-amber-600',
    bg: 'bg-amber-50 border-amber-200',
    bar: 'bg-amber-500',
    badge: 'secondary' as const,
    pulse: 'bg-amber-400',
  };
  return {
    label: 'Low Risk',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 border-emerald-200',
    bar: 'bg-emerald-500',
    badge: 'outline' as const,
    pulse: 'bg-emerald-500',
  };
};

const DeltaIcon = ({ delta }: { delta: number }) => {
  if (delta > 5) return <TrendingUp className="h-3.5 w-3.5 text-red-500" />;
  if (delta < -5) return <TrendingDown className="h-3.5 w-3.5 text-emerald-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
};

export function PlayerRiskProfileSheet({
  open,
  onOpenChange,
  player,
  signalHistory = [],
  onIntervene,
  onViewHistory,
}: PlayerRiskProfileSheetProps) {
  const score = player?.risk_score ?? 0;
  const riskConfig = getRiskConfig(score);
  const session = player?.currentSession;
  const profile = player?.riskProfile;

  const betVelocity = session
    ? ((session.total_bets || 0) / Math.max(session.duration || 1, 1) * 60).toFixed(1)
    : '0.0';

  const delta = profile?.score_delta ?? 0;

  const trendData = signalHistory.length > 0
    ? signalHistory.slice(-14).map((h: any) => ({
        date: new Date(h.recorded_at).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' }),
        risk: h.risk_score,
        session: h.session_duration_score,
        loss: h.loss_escalation_score,
        deposit: h.deposit_frequency_score,
      }))
    : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <TooltipProvider>
          {player && (
            <>
              <SheetHeader className="pb-4">
                <SheetTitle className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted font-semibold text-sm uppercase">
                    {playerAvatarChars(player.player_id ?? player.id)}
                  </div>
                  <div>
                    <div className="font-mono">{formatPlayerId(player.player_id ?? player.id)}</div>
                    <div className="text-xs font-normal text-muted-foreground">SafeBet IQ Player ID</div>
                  </div>
                </SheetTitle>
                <SheetDescription>Behavioral risk profile — live analysis</SheetDescription>
              </SheetHeader>

              {/* Risk Score Banner */}
              <div className={`rounded-xl border p-4 mb-5 ${riskConfig.bg}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1">
                      Composite Risk Score
                    </div>
                    <div className={`text-5xl font-bold tabular-nums ${riskConfig.color}`}>{score}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">out of 100</div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                    <Badge variant={riskConfig.badge} className="text-xs px-2 py-0.5">
                      {riskConfig.label}
                    </Badge>
                    <div className="flex items-center gap-1.5">
                      <div className={`h-2 w-2 rounded-full animate-pulse ${riskConfig.pulse}`} />
                      <span className="text-xs text-muted-foreground">Active Session</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <DeltaIcon delta={delta} />
                      <span className={delta > 5 ? 'text-red-500' : delta < -5 ? 'text-emerald-600' : 'text-muted-foreground'}>
                        {delta > 0 ? `+${delta}` : delta} vs prior
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 h-2.5 w-full rounded-full bg-white/60 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${riskConfig.bar}`}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>

              {/* Signal Breakdown */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold">Risk Signal Breakdown</span>
                  <span className="text-xs text-muted-foreground">Weighted composite</span>
                </div>
                <RiskSignalBreakdown
                  sessionDurationScore={profile?.session_duration_score ?? Math.min(score + 3, 100)}
                  depositFrequencyScore={profile?.deposit_frequency_score ?? Math.max(score - 8, 0)}
                  lossEscalationScore={profile?.loss_escalation_score ?? Math.min(score + 7, 100)}
                  betIntensityScore={profile?.bet_intensity_score ?? Math.max(score - 5, 0)}
                  crossOperatorScore={profile?.cross_operator_score ?? (score >= 60 ? 35 : 10)}
                  sessionMinutes={session?.duration}
                  depositCount24h={profile?.deposits_analyzed}
                  netLoss={session?.total_wagered ? session.total_wagered * 0.3 : undefined}
                  largestBet={session?.total_wagered ? session.total_wagered / Math.max(session.total_bets || 1, 1) * 2 : undefined}
                  crossOperatorFlags={profile?.cross_operator_flags ?? 0}
                />
              </div>

              {/* 14-Day Risk Trend */}
              {trendData.length > 0 && (
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">14-Day Risk Trend</span>
                  </div>
                  <div className="h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                        <defs>
                          <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
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
                        <Area
                          type="monotone"
                          dataKey="risk"
                          stroke="#ef4444"
                          strokeWidth={2}
                          fill="url(#riskGrad)"
                          name="Risk Score"
                        />
                        <Area
                          type="monotone"
                          dataKey="loss"
                          stroke="#f97316"
                          strokeWidth={1.5}
                          fill="none"
                          name="Loss Escalation"
                          strokeDasharray="4 2"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <Separator className="my-4" />

              {/* Session Stats */}
              <div className="mb-5">
                <div className="text-sm font-semibold mb-3">Current Session Metrics</div>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { label: 'Duration', value: `${session?.duration || 0} min`, icon: Clock },
                    { label: 'Bet Velocity', value: `${betVelocity}/min`, icon: Activity },
                    { label: 'Session Wager', value: `R${(session?.total_wagered || 0).toLocaleString()}`, icon: DollarSign },
                    { label: 'Total Bets', value: String(session?.total_bets || 0), icon: Target },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="rounded-lg border bg-card p-3">
                      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                        <Icon className="h-3.5 w-3.5" />
                        <span className="text-xs">{label}</span>
                      </div>
                      <div className="text-base font-semibold">{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Player Details */}
              <div className="mb-5 space-y-2 text-sm">
                <div className="text-sm font-semibold mb-2">Player Information</div>
                {[
                  { label: 'Email', value: player.email || '—' },
                  { label: 'Total Wagered', value: `R${(player.total_wagered || 0).toLocaleString()}` },
                  { label: 'Sessions Analyzed', value: String(profile?.sessions_analyzed ?? '—') },
                  {
                    label: 'Last Active',
                    value: player.last_active
                      ? new Date(player.last_active).toLocaleDateString('en-ZA')
                      : '—',
                  },
                  { label: 'Self Excluded', value: player.self_excluded ? 'Yes' : 'No' },
                  {
                    label: 'Cross-Operator Flags',
                    value: (profile?.cross_operator_flags ?? 0) > 0
                      ? `${profile.cross_operator_flags} flag(s)`
                      : 'None',
                  },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between py-1 border-b border-dashed border-muted last:border-0">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </div>

              {/* Risk Rationale */}
              {profile?.risk_rationale && (
                <div className="mb-5 p-3 rounded-lg bg-muted/40 border">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                    AI Risk Rationale
                  </div>
                  <p className="text-xs text-foreground leading-relaxed">{profile.risk_rationale}</p>
                </div>
              )}

              <Separator className="my-4" />

              {/* Actions */}
              <div className="flex flex-col gap-2">
                {score >= 60 && (
                  <Button className="w-full" onClick={onIntervene}>
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Send Intervention
                  </Button>
                )}
                <Button variant="outline" className="w-full" onClick={onViewHistory}>
                  <Calendar className="mr-2 h-4 w-4" />
                  View Full History
                </Button>
              </div>
            </>
          )}
        </TooltipProvider>
      </SheetContent>
    </Sheet>
  );
}
