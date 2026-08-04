'use client';

// Certified-snapshot age indicator. Shows how long ago the CERTIFIED snapshot
// was taken (from the pipeline `as_of` timestamp — never the browser render
// time) and the absolute time in Afric/Johannesburg (SAST). The relative label
// re-renders every few seconds without mutating the underlying metric, and the
// row is marked stale once the snapshot exceeds `staleAfterSeconds`. A tooltip
// explains that small differences between pages can occur when two pages hold
// snapshots with different timestamps.

import { useEffect, useState } from 'react';

const SAST = 'Africa/Johannesburg';

function relative(sec: number): string {
  if (sec < 0) return 'just now';
  if (sec < 60) return `${sec} second${sec === 1 ? '' : 's'} ago`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.floor(m / 60);
  return `${h} hour${h === 1 ? '' : 's'} ago`;
}

export function SnapshotAge({
  asOf,
  staleAfterSeconds = 120,
  className = '',
}: {
  asOf: string | number | Date | null | undefined;
  staleAfterSeconds?: number;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  if (!asOf) {
    return <span className={`text-[11px] text-muted-foreground ${className}`}>Certified snapshot: —</span>;
  }
  const t = new Date(asOf);
  if (Number.isNaN(t.getTime())) {
    return <span className={`text-[11px] text-muted-foreground ${className}`}>Certified snapshot: —</span>;
  }
  const ageSec = Math.floor((now - t.getTime()) / 1000);
  const stale = ageSec > staleAfterSeconds;
  const abs = new Intl.DateTimeFormat('en-ZA', {
    timeZone: SAST, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(t);

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] ${stale ? 'text-amber-600' : 'text-muted-foreground'} ${className}`}
      title={`Certified snapshot: ${abs} SAST. Metrics reflect the certified pipeline at this instant. Small differences between pages can occur when their snapshots have different timestamps.`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${stale ? 'bg-amber-500' : 'bg-emerald-500'}`} />
      Updated {relative(ageSec)}
      {stale && <span className="font-medium">· stale</span>}
      <span className="hidden md:inline text-muted-foreground/70">· {abs} SAST</span>
    </span>
  );
}
