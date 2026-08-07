'use client';

// Compact posture panel: one card replacing four large per-state cards. Shows
// rows + an optional segmented status bar + a discreet reconciliation badge and
// drill-down link. Matches the Live Feed card system.

import Link from 'next/link';
import { CircleCheck, CircleAlert } from 'lucide-react';

export function ReconciliationBadge({ ok, label = 'Reconciled' }: { ok: boolean; label?: string }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
      <CircleCheck className="h-3 w-3" /> {label}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600">
      <CircleAlert className="h-3 w-3" /> Integrity warning
    </span>
  );
}

export interface PostureRow { label: string; value: string; color?: string; barColor?: string; segment?: number }

export function PostureSummaryCard({
  title, rows, total, reconciled, note, href, hrefLabel,
}: {
  title: string;
  rows: PostureRow[];
  total?: PostureRow;              // emphasised total row (e.g. Observed / Open / Allocated)
  reconciled: boolean;
  note?: string;
  href?: string;
  hrefLabel?: string;
}) {
  const segTotal = rows.reduce((a, r) => a + (r.segment ?? 0), 0) || 1;
  const showBar = rows.some((r) => r.segment != null);
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
        <ReconciliationBadge ok={reconciled} />
      </div>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              {r.barColor && <span className={`h-2 w-2 rounded-full ${r.barColor}`} />}{r.label}
            </span>
            <span className={`font-semibold tabular-nums ${r.color ?? 'text-foreground'}`}>{r.value}</span>
          </div>
        ))}
      </div>
      {showBar && (
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
          {rows.filter((r) => r.segment != null).map((r) => (
            <div key={r.label} className={r.barColor ?? 'bg-muted-foreground'} style={{ width: `${((r.segment ?? 0) / segTotal) * 100}%` }} />
          ))}
        </div>
      )}
      {total && (
        <div className="flex items-center justify-between border-t pt-2 text-sm">
          <span className="font-medium">{total.label}</span>
          <span className="font-bold tabular-nums">{total.value}</span>
        </div>
      )}
      {note && <p className="text-[11px] text-muted-foreground/70">{note}</p>}
      {href && (
        <Link href={href} className="text-[11px] font-medium text-primary hover:underline mt-auto">
          {hrefLabel ?? 'View details'} →
        </Link>
      )}
    </div>
  );
}
