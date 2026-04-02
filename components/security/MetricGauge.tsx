'use client';

import { cn } from '@/lib/utils';

interface Props {
  label: string;
  value: number | string;
  unit?: string;
  status?: 'normal' | 'warning' | 'critical';
  sublabel?: string;
  pulse?: boolean;
}

const STATUS_COLORS = {
  normal: 'text-emerald-400',
  warning: 'text-amber-400',
  critical: 'text-red-400',
};

const STATUS_BG = {
  normal: 'bg-emerald-500/10 border-emerald-500/20',
  warning: 'bg-amber-500/10 border-amber-500/20',
  critical: 'bg-red-500/10 border-red-500/20',
};

export function MetricGauge({ label, value, unit, status = 'normal', sublabel, pulse }: Props) {
  return (
    <div className={cn(
      'p-3 rounded-lg border flex flex-col items-center justify-center text-center gap-0.5',
      STATUS_BG[status],
      pulse && status === 'critical' && 'animate-pulse',
    )}>
      <div className="text-xs text-slate-500 uppercase tracking-wide leading-none">{label}</div>
      <div className={cn('text-2xl font-bold tabular-nums leading-tight', STATUS_COLORS[status])}>
        {value}{unit && <span className="text-sm ml-0.5">{unit}</span>}
      </div>
      {sublabel && <div className="text-xs text-slate-600 leading-none">{sublabel}</div>}
    </div>
  );
}
