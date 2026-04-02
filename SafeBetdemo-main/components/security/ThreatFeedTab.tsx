'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LiveEventFeed } from './LiveEventFeed';
import { SEV_CONFIG, formatEventType } from '@/components/security/securityUtils';
import type { SecurityEvent } from '@/components/security/securityUtils';

interface Props {
  events: SecurityEvent[];
}

export function ThreatFeedTab({ events }: Props) {
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('all');

  const filtered = events.filter(ev => {
    if (severity !== 'all' && ev.severity !== severity) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!ev.title.toLowerCase().includes(q) && !ev.event_type.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const byCountry = Object.entries(
    events.reduce((acc, e) => {
      if (e.source_country) acc[e.source_country] = (acc[e.source_country] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const maxCountryCount = byCountry[0]?.[1] ?? 1;

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search events by title or type..."
            className="pl-9 h-9 bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-600 text-sm" />
        </div>
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="h-9 w-40 bg-slate-900 border-slate-700 text-slate-300 text-xs">
            <SelectValue placeholder="All Severities" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700">
            {['all', 'critical', 'high', 'medium', 'low', 'info'].map(s => (
              <SelectItem key={s} value={s} className="text-xs text-slate-300">
                {s === 'all' ? 'All Severities' : s.charAt(0).toUpperCase() + s.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wide">
            Live Security Event Feed
            <span className="flex items-center gap-1 text-emerald-400 normal-case">
              <Radio className="h-3 w-3 animate-pulse" /> Live
            </span>
          </div>
          <div className="text-xs text-slate-600">{filtered.length} events</div>
        </div>
        <LiveEventFeed events={filtered} maxRows={40} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-4">Events by Source Country</div>
          {byCountry.map(([country, count]) => {
            const isRisky = ['CN', 'RU', 'NG', 'BR', 'IN', 'PK'].includes(country);
            return (
              <div key={country} className="flex items-center gap-3 mb-2.5">
                <div className={cn('text-xs font-mono font-bold w-8 text-right', isRisky ? 'text-red-400' : 'text-slate-400')}>
                  {country}
                </div>
                <div className="flex-1 bg-slate-800 rounded-full h-1.5">
                  <div className={cn('h-1.5 rounded-full', isRisky ? 'bg-red-500' : 'bg-blue-500')}
                    style={{ width: `${(count / maxCountryCount) * 100}%` }} />
                </div>
                <div className="text-xs text-slate-500 tabular-nums w-8 text-right">{count}</div>
                {isRisky && <Badge className="bg-red-900/60 text-red-300 border-red-700 text-xs px-1.5">Risk</Badge>}
              </div>
            );
          })}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-4">Severity Distribution</div>
          {['critical', 'high', 'medium', 'low', 'info'].map(sev => {
            const count = events.filter(e => e.severity === sev).length;
            const pct = events.length > 0 ? (count / events.length) * 100 : 0;
            const cfg = SEV_CONFIG[sev];
            return (
              <div key={sev} className="flex items-center gap-3 mb-3">
                <div className={cn('h-2 w-2 rounded-full flex-shrink-0', cfg.dot)} />
                <div className="text-xs text-slate-400 capitalize w-16">{sev}</div>
                <div className="flex-1 bg-slate-800 rounded-full h-1.5">
                  <div className={cn('h-1.5 rounded-full', cfg.dot)} style={{ width: `${pct}%` }} />
                </div>
                <div className="text-xs text-slate-500 tabular-nums w-24 text-right">
                  {count} ({pct.toFixed(0)}%)
                </div>
              </div>
            );
          })}
          <div className="mt-3 pt-3 border-t border-slate-800">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-3">Top Event Types</div>
            {Object.entries(
              events.reduce((acc, e) => { acc[e.event_type] = (acc[e.event_type] ?? 0) + 1; return acc; }, {} as Record<string, number>)
            ).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between mb-1.5">
                <code className="text-xs text-slate-400 bg-slate-800/60 px-1.5 py-0.5 rounded">{type}</code>
                <span className="text-xs text-slate-500 tabular-nums">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
