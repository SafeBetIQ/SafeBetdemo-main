'use client';

// Shared KPI card matching the Live Casino Feed visual system (icon container,
// large value, label, supporting sub). Used by the Operator Dashboard so both
// surfaces read as the same product. No business logic — presentation only.

import type { ElementType } from 'react';

export function KpiCard({
  icon: Icon, value, label, sub, color = 'text-foreground', iconBg = 'bg-muted',
  badge, badgeColor, pulse,
}: {
  icon: ElementType;
  value: string;
  label: string;
  sub?: string;
  color?: string;
  iconBg?: string;
  badge?: string;
  badgeColor?: string;
  pulse?: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-4 flex flex-col gap-2 relative overflow-hidden">
      <div className="flex items-center justify-between">
        <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        {badge && <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeColor ?? 'bg-muted text-muted-foreground'}`}>{badge}</span>}
        {pulse && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
      </div>
      <div>
        <div className={`text-2xl font-bold tracking-tight ${color}`}>{value}</div>
        <div className="text-xs text-muted-foreground font-medium mt-0.5">{label}</div>
        {sub && <div className="text-xs text-muted-foreground/70 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}
