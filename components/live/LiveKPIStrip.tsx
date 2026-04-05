'use client';

import { useEffect, useRef, useState } from 'react';
import { TrendingUp, Users, Zap, Activity, Shield, DollarSign, Info, Radio, Database, CalendarDays } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCasinoData, PeriodMetrics } from '@/contexts/CasinoDataContext';

// ─── Animated counter ────────────────────────────────────────────────────────

function AnimatedNumber({ value, prefix = '', decimals = 0 }: { value: number; prefix?: string; decimals?: number }) {
  const [displayed, setDisplayed] = useState(value);
  const prevRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start = prevRef.current;
    const end = value;
    if (Math.abs(end - start) < 0.01) return;
    const duration = 600;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplayed(start + (end - start) * ease);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        prevRef.current = end;
      }
    };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value]);

  const formatted = decimals > 0 ? displayed.toFixed(decimals) : Math.round(displayed).toLocaleString();
  return <span>{prefix}{formatted}</span>;
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ElementType;
  label: string;
  value: number;
  prefix?: string;
  decimals?: number;
  sub?: string;
  color: string;
  iconBg: string;
  trend?: 'up';
  badge?: string;
  badgeColor?: string;
  pulse?: boolean;
  tooltip: string;
}

function KpiCard({ icon: Icon, label, value, prefix, decimals, sub, color, iconBg, trend, badge, badgeColor, pulse, tooltip }: KpiCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-4 flex flex-col gap-2 relative overflow-hidden">
      <div className="flex items-center justify-between">
        <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <div className="flex items-center gap-1.5">
          {badge && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeColor}`}>
              {badge}
            </span>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs"><p>{tooltip}</p></TooltipContent>
          </Tooltip>
        </div>
      </div>
      <div>
        <div className={`text-2xl font-bold tracking-tight ${color}`}>
          <AnimatedNumber value={value} prefix={prefix} decimals={decimals} />
        </div>
        <div className="text-xs text-muted-foreground font-medium mt-0.5">{label}</div>
        {sub && <div className="text-xs text-muted-foreground/70 mt-0.5">{sub}</div>}
      </div>
      {pulse && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
      {trend === 'up' && <TrendingUp className="absolute bottom-2 right-2 h-3 w-3 text-emerald-500 opacity-60" />}
    </div>
  );
}

// ─── Period filter ────────────────────────────────────────────────────────────

type Period = 'session' | 'today' | '30days';

const PERIODS: { key: Period; label: string; icon: React.ElementType }[] = [
  { key: 'session', label: 'Live Session', icon: Radio },
  { key: 'today',   label: 'Today',        icon: Database },
  { key: '30days',  label: 'Last 30 Days', icon: CalendarDays },
];

// ─── Strip ────────────────────────────────────────────────────────────────────

export function LiveKPIStrip() {
  const { data } = useCasinoData();
  const { kpi, machines, sessionWagered, todayMetrics, thirtyDayMetrics } = data;
  const [period, setPeriod] = useState<Period>('session');

  const activeMachines = machines.filter(m => m.status === 'active').length;
  const totalMachines  = machines.length;

  // Derive display values from the selected period
  const isSession = period === 'session';
  const m: PeriodMetrics = period === 'today' ? todayMetrics : thirtyDayMetrics;
  const periodTag = period === 'today' ? '(Today)' : '(30d)';

  const playersValue  = isSession ? kpi.active_players   : m.uniquePlayers;
  const eventsValue   = isSession ? kpi.events_per_min   : m.totalEvents;
  const wageredValue  = isSession ? sessionWagered        : m.totalWagered;
  const ggrValue      = isSession ? kpi.total_wagered - kpi.total_won : m.ggr;
  const avgBetValue   = isSession ? kpi.avg_bet_size      : m.avgBetSize;
  const riskValue     = isSession ? kpi.risk_critical     : m.riskCritical;

  const winRate = isSession
    ? (kpi.total_wagered > 0 ? (kpi.total_won / kpi.total_wagered) * 100 : 0)
    : (m.totalWagered > 0 ? (m.totalWon / m.totalWagered) * 100 : 0);

  return (
    <TooltipProvider>
      {/* Period filter */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {PERIODS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                period === key
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          {isSession
            ? 'Realtime · frontend only · resets on refresh'
            : period === 'today'
            ? 'DB · midnight → now · refreshed every 60s'
            : 'DB · rolling 30-day window · refreshed every 60s'}
        </span>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          icon={Users}
          label={isSession ? 'Active Players' : `Unique Players ${periodTag}`}
          value={playersValue}
          color="text-blue-600"
          iconBg="bg-blue-100"
          badge={isSession ? 'Live' : undefined}
          badgeColor="bg-emerald-100 text-emerald-700"
          pulse={isSession}
          trend={isSession ? 'up' : undefined}
          tooltip={
            isSession
              ? 'Unique players with events in the current Realtime window. Updates on every incoming event.'
              : `Distinct players who placed at least one bet ${period === 'today' ? 'today' : 'in the last 30 days'}. Sourced from the database.`
          }
        />
        <KpiCard
          icon={Zap}
          label={isSession ? 'Events / Min' : `Total Events ${periodTag}`}
          value={eventsValue}
          color="text-amber-600"
          iconBg="bg-amber-100"
          sub={isSession ? 'Bets, spins, sessions' : period === 'today' ? 'BET_PLACED events today' : 'BET_PLACED events (30d)'}
          pulse={isSession}
          tooltip={
            isSession
              ? 'Total events in the last 60-second rolling window — bets, deposits, withdrawals, session starts/ends.'
              : `Total BET_PLACED events recorded in the database ${period === 'today' ? 'since midnight' : 'over the last 30 days'}.`
          }
        />
        <KpiCard
          icon={DollarSign}
          label={isSession ? 'Live Wagered (Session)' : `Total Wagered ${periodTag}`}
          value={wageredValue}
          prefix="R "
          color={isSession ? 'text-emerald-600' : 'text-foreground'}
          iconBg={isSession ? 'bg-emerald-100' : 'bg-muted'}
          sub={isSession ? 'Since dashboard opened' : period === 'today' ? 'Audited · resets midnight' : 'Rolling 30-day window'}
          badge={isSession ? 'Live' : undefined}
          badgeColor="bg-emerald-100 text-emerald-700"
          pulse={isSession}
          trend={isSession ? 'up' : undefined}
          tooltip={
            isSession
              ? 'BET_PLACED total accumulated in this browser session since the dashboard was opened. Starts at zero on every page load — never stored in the database.'
              : `Persistent sum of all BET_PLACED amounts ${period === 'today' ? 'recorded today (from midnight SAST)' : 'over the last 30 days'}. Refreshed from Supabase every 60 seconds — suitable for compliance reporting.`
          }
        />
        <KpiCard
          icon={TrendingUp}
          label={`GGR${isSession ? '' : ' ' + periodTag}`}
          value={ggrValue}
          prefix="R "
          color={ggrValue >= 0 ? 'text-emerald-600' : 'text-red-500'}
          iconBg={ggrValue >= 0 ? 'bg-emerald-100' : 'bg-red-100'}
          sub={`Win rate ${winRate.toFixed(1)}%`}
          tooltip="Gross Gaming Revenue = Total Wagered − Total Won. Represents the operator's theoretical revenue before costs. Win rate shows the percentage returned to players."
        />
        <KpiCard
          icon={Activity}
          label={`Avg Bet Size${isSession ? '' : ' ' + periodTag}`}
          value={avgBetValue}
          prefix="R "
          decimals={0}
          color="text-foreground"
          iconBg="bg-muted"
          sub={isSession ? 'Across all games' : 'Per BET_PLACED event'}
          tooltip="Mean bet size across BET_PLACED events in the selected period. Higher values may indicate VIP or high-roller activity warranting closer monitoring."
        />
        <KpiCard
          icon={Shield}
          label={`Critical Risk${isSession ? '' : ' ' + periodTag}`}
          value={riskValue}
          color={riskValue > 0 ? 'text-red-600' : 'text-muted-foreground'}
          iconBg={riskValue > 0 ? 'bg-red-100' : 'bg-muted'}
          badge={riskValue > 0 ? 'Alert' : undefined}
          badgeColor="bg-red-100 text-red-700"
          sub={isSession ? `${activeMachines}/${totalMachines} machines active` : `Risk score ≥ 80`}
          pulse={isSession && riskValue > 0}
          tooltip={
            isSession
              ? 'Players with a risk score ≥ 80 in the current Realtime window. These players have triggered responsible gambling flags requiring immediate attention.'
              : `Count of BET_PLACED events with risk score ≥ 80 ${period === 'today' ? 'today' : 'over the last 30 days'} — useful for compliance trend analysis.`
          }
        />
      </div>
    </TooltipProvider>
  );
}
