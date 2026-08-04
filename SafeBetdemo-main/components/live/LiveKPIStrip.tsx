'use client';

import { useEffect, useRef, useState } from 'react';
import { TrendingUp, Users, Zap, Activity, Shield, DollarSign } from 'lucide-react';
import { useCasinoData } from '@/contexts/CasinoDataContext';
import { SnapshotAge } from '@/components/SnapshotAge';

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
      const current = start + (end - start) * ease;
      setDisplayed(current);
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

  const formatted = decimals > 0
    ? displayed.toFixed(decimals)
    : Math.round(displayed).toLocaleString();

  return <span>{prefix}{formatted}</span>;
}

interface KpiCardProps {
  icon: React.ElementType;
  label: string;
  value: number;
  /** When set, renders this string instead of the numeric value (e.g. "Unavailable"). */
  displayValue?: string;
  prefix?: string;
  decimals?: number;
  sub?: string;
  color: string;
  iconBg: string;
  trend?: 'up' | 'down' | 'neutral';
  badge?: string;
  badgeColor?: string;
  pulse?: boolean;
}

function KpiCard({ icon: Icon, label, value, displayValue, prefix, decimals, sub, color, iconBg, trend, badge, badgeColor, pulse }: KpiCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-4 flex flex-col gap-2 relative overflow-hidden">
      <div className="flex items-center justify-between">
        <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        {badge && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeColor}`}>
            {badge}
          </span>
        )}
      </div>
      <div>
        <div className={`text-2xl font-bold tracking-tight ${color}`}>
          {displayValue !== undefined
            ? <span>{displayValue}</span>
            : <AnimatedNumber value={value} prefix={prefix} decimals={decimals} />}
        </div>
        <div className="text-xs text-muted-foreground font-medium mt-0.5">{label}</div>
        {sub && <div className="text-xs text-muted-foreground/70 mt-0.5">{sub}</div>}
      </div>
      {pulse && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
      {trend === 'up' && <TrendingUp className="absolute bottom-2 right-2 h-3 w-3 text-emerald-500 opacity-60" />}
    </div>
  );
}

export function LiveKPIStrip() {
  const { data } = useCasinoData();
  const { kpi, machines, interventions } = data;

  const activeMachines = machines.filter(m => m.status === 'active').length;
  const totalMachines = machines.length;
  const winRate = kpi.total_wagered > 0 ? (kpi.total_won / kpi.total_wagered) * 100 : 0;
  const ggr = kpi.total_wagered - kpi.total_won;

  return (
    <div className="space-y-2">
    <div className="flex items-center justify-end gap-2 text-[11px] text-muted-foreground/70">
      <SnapshotAge asOf={kpi.snapshot_at} />
      <span className="hidden lg:inline">· active-now uses the freshness window</span>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {/* Certified freshness-based active-now (NOT observed). observed = active_now + idle + stale. */}
      <KpiCard
        icon={Users}
        label="Active Players"
        value={kpi.players_active_now}
        sub={`${(kpi.active_players ?? 0).toLocaleString()} observed · active within freshness window`}
        color="text-blue-600"
        iconBg="bg-blue-100"
        badge="Live"
        badgeColor="bg-emerald-100 text-emerald-700"
        pulse
        trend="up"
      />
      <KpiCard
        icon={Zap}
        label="Events / Min"
        value={kpi.events_per_min}
        color="text-amber-600"
        iconBg="bg-amber-100"
        sub="Bets, spins, sessions"
        pulse
      />
      <KpiCard
        icon={DollarSign}
        label="Total Wagered"
        value={kpi.total_wagered}
        prefix="R "
        color="text-foreground"
        iconBg="bg-muted"
        sub="Session total"
        trend="up"
      />
      <KpiCard
        icon={TrendingUp}
        label="GGR"
        value={ggr}
        prefix="R "
        color={ggr >= 0 ? 'text-emerald-600' : 'text-red-500'}
        iconBg={ggr >= 0 ? 'bg-emerald-100' : 'bg-red-100'}
        sub={`Win rate ${winRate.toFixed(1)}%`}
      />
      {/* Avg bet size from certified bets in the served window; show Unavailable (not a false R0). */}
      <KpiCard
        icon={Activity}
        label="Avg Bet Size"
        value={kpi.avg_bet_size}
        displayValue={kpi.avg_bet_size > 0 ? undefined : 'Unavailable'}
        prefix="R "
        decimals={0}
        color="text-foreground"
        iconBg="bg-muted"
        sub={kpi.avg_bet_size > 0 ? 'Certified · served window' : 'No certified bets in window'}
      />
      <KpiCard
        icon={Shield}
        label="AI Interventions"
        value={interventions.length}
        color={interventions.length > 0 ? 'text-red-600' : 'text-muted-foreground'}
        iconBg={interventions.length > 0 ? 'bg-red-100' : 'bg-muted'}
        badge={kpi.risk_critical > 0 ? `${kpi.risk_critical} Critical` : undefined}
        badgeColor="bg-red-100 text-red-700"
        sub={`${activeMachines}/${totalMachines} machines active`}
        pulse={interventions.length > 0}
      />
    </div>
    </div>
  );
}
