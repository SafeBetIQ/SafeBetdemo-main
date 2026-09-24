'use client';

// Governed KPI card for Responsible Profitability (B3). Reuses the KpiCard visual
// system (consistent dimensions) but is AVAILABILITY-AWARE: a suppressed / not-
// available / partial / stale metric renders "—" plus an honest state badge and an
// optional reason — never a zero-filled or fabricated figure (owner §5).

import type { ElementType } from 'react';
import { availabilityPresentation } from '@/lib/responsibleProfitability/dashboardView';

const TONE_CLASS: Record<string, string> = {
  default: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  secondary: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  outline: 'bg-muted text-muted-foreground',
  destructive: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

export function GovernedKpiCard({
  icon: Icon, label, availability, display, provenance, reason, sub,
}: {
  icon: ElementType;
  label: string;
  availability: string;         // MEASURABLE | PARTIAL | SUPPRESSED | NOT_AVAILABLE | STALE | UNAVAILABLE | ZERO
  display: string;              // already-governed display (e.g. "R 250 229", "48% (76/158)", "—")
  provenance?: string;
  reason?: string;
  sub?: string;
}) {
  const pres = availabilityPresentation(availability);
  const measurable = availability === 'MEASURABLE' || availability === 'PARTIAL' || availability === 'ZERO';
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-4 flex flex-col gap-2 relative overflow-hidden min-h-[112px]">
      <div className="flex items-center justify-between gap-2">
        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
          <Icon className="h-4 w-4 text-foreground" />
        </div>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${TONE_CLASS[pres.tone]}`}>{pres.label}</span>
      </div>
      <div>
        <div className={`text-2xl font-bold tracking-tight ${measurable ? 'text-foreground' : 'text-muted-foreground'}`}>
          {measurable ? display : '—'}
        </div>
        <div className="text-xs text-muted-foreground font-medium mt-0.5">{label}</div>
        {provenance && <div className="text-[11px] text-muted-foreground/70 mt-0.5">{provenance}</div>}
        {!measurable && reason && <div className="text-[11px] text-muted-foreground/70 mt-1 leading-snug">{reason}</div>}
        {measurable && sub && <div className="text-[11px] text-muted-foreground/70 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}
