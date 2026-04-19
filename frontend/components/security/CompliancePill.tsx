'use client';

import { cn } from '@/lib/utils';
import { CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, Circle as XCircle, Clock } from 'lucide-react';

interface Props {
  framework: string;
  score: number;
  controls: number;
  compliant: number;
}

export function CompliancePill({ framework, score, controls, compliant }: Props) {
  const status = score >= 85 ? 'pass' : score >= 70 ? 'warning' : 'fail';
  const Icon = status === 'pass' ? CheckCircle2 : status === 'warning' ? AlertTriangle : XCircle;

  const config = {
    pass: { bar: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/5' },
    warning: { bar: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/5' },
    fail: { bar: 'bg-red-500', text: 'text-red-400', border: 'border-red-500/30', bg: 'bg-red-500/5' },
  }[status];

  return (
    <div className={cn('p-3 rounded-lg border', config.bg, config.border)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">{framework}</span>
        <div className={cn('flex items-center gap-1', config.text)}>
          <Icon className="h-3.5 w-3.5" />
          <span className="text-sm font-bold tabular-nums">{score.toFixed(0)}%</span>
        </div>
      </div>
      <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', config.bar)} style={{ width: `${score}%` }} />
      </div>
      <div className="text-xs text-slate-600 mt-1">{compliant}/{controls} controls compliant</div>
    </div>
  );
}
