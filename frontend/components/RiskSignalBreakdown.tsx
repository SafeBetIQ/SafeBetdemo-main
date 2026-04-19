'use client';

import { Clock, TrendingUp, DollarSign, Zap, Globe } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface Signal {
  key: string;
  label: string;
  score: number;
  weight: number;
  description: string;
  icon: React.ElementType;
  rawValue?: string;
}

interface RiskSignalBreakdownProps {
  sessionDurationScore: number;
  depositFrequencyScore: number;
  lossEscalationScore: number;
  betIntensityScore: number;
  crossOperatorScore: number;
  sessionMinutes?: number;
  depositCount24h?: number;
  netLoss?: number;
  largestBet?: number;
  crossOperatorFlags?: number;
  compact?: boolean;
}

const getSignalColor = (score: number) => {
  if (score >= 80) return { bar: 'bg-red-500', text: 'text-red-600', bg: 'bg-red-50 border-red-200' };
  if (score >= 60) return { bar: 'bg-orange-500', text: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' };
  if (score >= 40) return { bar: 'bg-amber-500', text: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' };
  return { bar: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' };
};

const getSignalLabel = (score: number) => {
  if (score >= 80) return 'Critical';
  if (score >= 60) return 'High';
  if (score >= 40) return 'Moderate';
  return 'Low';
};

export function RiskSignalBreakdown({
  sessionDurationScore,
  depositFrequencyScore,
  lossEscalationScore,
  betIntensityScore,
  crossOperatorScore,
  sessionMinutes,
  depositCount24h,
  netLoss,
  largestBet,
  crossOperatorFlags,
  compact = false,
}: RiskSignalBreakdownProps) {
  const signals: Signal[] = [
    {
      key: 'loss_escalation',
      label: 'Loss Escalation',
      score: lossEscalationScore,
      weight: 30,
      icon: TrendingUp,
      description: 'Detects chasing behaviour — increasing bets after consecutive losses. Highest-weighted signal due to strong correlation with problem gambling.',
      rawValue: netLoss != null ? `R${netLoss.toLocaleString()} net loss` : undefined,
    },
    {
      key: 'session_duration',
      label: 'Session Duration',
      score: sessionDurationScore,
      weight: 20,
      icon: Clock,
      description: 'Measures time spent in active sessions. Extended sessions correlate with fatigue-impaired decision-making and reduced self-control.',
      rawValue: sessionMinutes != null ? `${sessionMinutes} min` : undefined,
    },
    {
      key: 'deposit_frequency',
      label: 'Deposit Frequency',
      score: depositFrequencyScore,
      weight: 20,
      icon: DollarSign,
      description: 'Tracks number and velocity of deposits within rolling time windows. Multiple deposits in a short period indicate loss-chasing or impulsive behaviour.',
      rawValue: depositCount24h != null ? `${depositCount24h} deposits (24h)` : undefined,
    },
    {
      key: 'bet_intensity',
      label: 'Bet Intensity',
      score: betIntensityScore,
      weight: 20,
      icon: Zap,
      description: 'Compares current bet sizes against the player\'s established baseline. Sudden spikes in bet size indicate emotional or impulsive wagering.',
      rawValue: largestBet != null ? `R${largestBet.toLocaleString()} largest bet` : undefined,
    },
    {
      key: 'cross_operator',
      label: 'Cross-Operator Activity',
      score: crossOperatorScore,
      weight: 10,
      icon: Globe,
      description: 'Flags activity detected across multiple licensed operators. Players gambling at several platforms simultaneously show higher overall risk.',
      rawValue: crossOperatorFlags != null ? `${crossOperatorFlags} operator flag${crossOperatorFlags !== 1 ? 's' : ''}` : undefined,
    },
  ];

  if (compact) {
    return (
      <div className="space-y-2">
        {signals.map((signal) => {
          const colors = getSignalColor(signal.score);
          return (
            <div key={signal.key}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">{signal.label}</span>
                <span className={`font-semibold ${colors.text}`}>{signal.score}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${colors.bar}`}
                  style={{ width: `${signal.score}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {signals.map((signal) => {
        const colors = getSignalColor(signal.score);
        const Icon = signal.icon;
        return (
          <Tooltip key={signal.key}>
            <TooltipTrigger asChild>
              <div className={`rounded-lg border p-3 cursor-help transition-all hover:shadow-sm ${colors.bg}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${colors.text}`} />
                    <span className="text-sm font-medium">{signal.label}</span>
                    <span className="text-xs text-muted-foreground">({signal.weight}% weight)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {signal.rawValue && (
                      <span className="text-xs text-muted-foreground">{signal.rawValue}</span>
                    )}
                    <span className={`text-sm font-bold ${colors.text}`}>{signal.score}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${colors.bg} border ${colors.text}`}>
                      {getSignalLabel(signal.score)}
                    </span>
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-white/60 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${colors.bar}`}
                    style={{ width: `${signal.score}%` }}
                  />
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs">
              <p className="text-xs">{signal.description}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}

      <div className="mt-2 pt-2 border-t border-dashed">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Signal weights sum to 100%</span>
          <span>Weighted composite score</span>
        </div>
      </div>
    </div>
  );
}
