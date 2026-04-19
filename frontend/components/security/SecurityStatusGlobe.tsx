'use client';

import { cn } from '@/lib/utils';
import { ShieldCheck, ShieldAlert, Shield } from 'lucide-react';

interface Props {
  score: number;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

const THREAT_CONFIG = {
  low: { color: 'text-emerald-400', ring: 'ring-emerald-500/40', glow: 'shadow-emerald-500/30', bg: 'bg-emerald-500/10', label: 'SECURE', icon: ShieldCheck },
  medium: { color: 'text-amber-400', ring: 'ring-amber-500/40', glow: 'shadow-amber-500/30', bg: 'bg-amber-500/10', label: 'ATTENTION', icon: Shield },
  high: { color: 'text-orange-400', ring: 'ring-orange-500/40', glow: 'shadow-orange-500/30', bg: 'bg-orange-500/10', label: 'ELEVATED', icon: ShieldAlert },
  critical: { color: 'text-red-400', ring: 'ring-red-500/40', glow: 'shadow-red-500/30', bg: 'bg-red-500/10', label: 'CRITICAL', icon: ShieldAlert },
};

export function SecurityStatusGlobe({ score, threatLevel, label, size = 'md' }: Props) {
  const cfg = THREAT_CONFIG[threatLevel];
  const Icon = cfg.icon;

  const sizeMap = {
    sm: { outer: 'h-20 w-20', inner: 'h-16 w-16', icon: 'h-6 w-6', score: 'text-lg', ring: 'ring-2' },
    md: { outer: 'h-32 w-32', inner: 'h-28 w-28', icon: 'h-10 w-10', score: 'text-3xl', ring: 'ring-4' },
    lg: { outer: 'h-44 w-44', inner: 'h-40 w-40', icon: 'h-14 w-14', score: 'text-5xl', ring: 'ring-4' },
  };
  const s = sizeMap[size];

  return (
    <div className="flex flex-col items-center gap-3">
      <div className={cn('relative flex items-center justify-center rounded-full', s.outer, cfg.bg, s.ring, cfg.ring, 'shadow-lg', cfg.glow,
        threatLevel === 'critical' && 'animate-pulse'
      )}>
        <div className={cn('flex flex-col items-center justify-center rounded-full', s.inner)}>
          <Icon className={cn(s.icon, cfg.color)} />
          <span className={cn('font-bold tabular-nums', s.score, cfg.color)}>{score}</span>
          <span className="text-xs text-slate-400 mt-0.5 tracking-wider uppercase">/ 100</span>
        </div>
        <div className={cn('absolute inset-0 rounded-full opacity-20 animate-ping', cfg.bg)} style={{ animationDuration: '3s' }} />
      </div>
      <div className="text-center">
        <div className={cn('text-xs font-bold tracking-[0.2em] uppercase', cfg.color)}>{cfg.label}</div>
        {label && <div className="text-xs text-slate-500 mt-0.5">{label}</div>}
      </div>
    </div>
  );
}
