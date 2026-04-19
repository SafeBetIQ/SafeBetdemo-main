'use client';

import { useState, useEffect, useRef } from 'react';
import { ChartBar as BarChart3, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCasinoData } from '@/contexts/CasinoDataContext';

interface HourBucket {
  label: string;
  wagered: number;
  events: number;
  players: Set<string>;
}

function buildHourlyBuckets(events: Array<{ created_at: string; bet_amount: number; player_id: string }>): HourBucket[] {
  const now = Date.now();
  const buckets: HourBucket[] = Array.from({ length: 12 }, (_, i) => {
    const t = new Date(now - (11 - i) * 3600000);
    return {
      label: t.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Johannesburg' }).slice(0, 5),
      wagered: 0,
      events: 0,
      players: new Set(),
    };
  });

  events.forEach(e => {
    const age = now - new Date(e.created_at).getTime();
    const hourIdx = Math.floor(age / 3600000);
    const bucketIdx = 11 - hourIdx;
    if (bucketIdx >= 0 && bucketIdx < 12) {
      buckets[bucketIdx].wagered += e.bet_amount;
      buckets[bucketIdx].events++;
      buckets[bucketIdx].players.add(e.player_id);
    }
  });

  return buckets;
}

export function LiveActivityChart() {
  const { data } = useCasinoData();
  const [buckets, setBuckets] = useState<HourBucket[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const rebuild = () => {
      setBuckets(buildHourlyBuckets(data.liveEvents));
    };
    rebuild();
    timerRef.current = setInterval(rebuild, 10000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [data.liveEvents]);

  const maxWagered = Math.max(...buckets.map(b => b.wagered), 1);
  const maxEvents = Math.max(...buckets.map(b => b.events), 1);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
            <BarChart3 className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Hourly Activity</h3>
            <p className="text-xs text-muted-foreground">Wagered &amp; events per hour (rolling 12h)</p>
          </div>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>Rolling 12-hour bar chart showing total wagered (blue) and event count (amber) bucketed by hour. Hover each bar for a breakdown of wagered amount, event count, and unique players in that hour.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="p-4">
        <div className="flex items-end gap-1 h-32">
          {buckets.map((bucket, i) => {
            const wagerPct = (bucket.wagered / maxWagered) * 100;
            const eventPct = (bucket.events / maxEvents) * 100;
            const isLast = i === buckets.length - 1;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group cursor-default">
                <div className="relative w-full flex items-end gap-0.5 h-24">
                  <div
                    className={`flex-1 rounded-t-sm transition-all duration-500 ${isLast ? 'bg-primary' : 'bg-primary/30'}`}
                    style={{ height: `${Math.max(wagerPct, 2)}%` }}
                  />
                  <div
                    className={`w-1.5 rounded-t-sm transition-all duration-500 ${isLast ? 'bg-amber-500' : 'bg-amber-400/50'}`}
                    style={{ height: `${Math.max(eventPct, 2)}%` }}
                  />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:flex flex-col items-center bg-popover border border-border rounded-md shadow-lg px-2 py-1 text-[10px] whitespace-nowrap z-10 gap-0.5">
                    <span className="font-semibold text-foreground">{bucket.label}</span>
                    <span className="text-muted-foreground">R {bucket.wagered.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    <span className="text-muted-foreground">{bucket.events} events · {bucket.players.size} players</span>
                  </div>
                </div>
                <span className="text-[9px] text-muted-foreground">{bucket.label}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-sm bg-primary/60 inline-block" />
            Wagered (R)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-2 rounded-sm bg-amber-400 inline-block" />
            Events
          </div>
        </div>
      </div>
    </div>
  );
}
