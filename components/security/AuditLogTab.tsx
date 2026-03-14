'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Lock, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SEV_CONFIG, formatEventType } from '@/app/security-command-center/page';
import type { SecurityEvent } from '@/app/security-command-center/page';

interface Props {
  events: SecurityEvent[];
}

export function AuditLogTab({ events }: Props) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');

  const eventTypes = Array.from(new Set(events.map(e => e.event_type))).sort();

  const filtered = events.filter(ev => {
    if (type !== 'all' && ev.event_type !== type) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!ev.title.toLowerCase().includes(q) && !ev.event_type.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search audit log by title, event type..."
            className="pl-9 h-9 bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-600 text-sm" />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-9 w-48 bg-slate-900 border-slate-700 text-slate-300 text-xs">
            <SelectValue placeholder="All Event Types" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700 max-h-64">
            <SelectItem value="all" className="text-xs text-slate-300">All Event Types</SelectItem>
            {eventTypes.map(t => (
              <SelectItem key={t} value={t} className="text-xs text-slate-300">{formatEventType(t)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-emerald-400" />
            <div className="text-xs text-slate-400 uppercase tracking-wide">Immutable Audit Log</div>
            <Badge className="bg-emerald-900/60 text-emerald-300 border-emerald-700 text-xs">Tamper-Evident</Badge>
            <Badge className="bg-blue-900/60 text-blue-300 border-blue-700 text-xs">Append-Only</Badge>
          </div>
          <div className="text-xs text-slate-600">{filtered.length} entries</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60">
                {['Timestamp (SAST)', 'Event Type', 'Title', 'Severity', 'Actor Hash', 'IP Hash', 'System', 'Country'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-slate-500 font-medium uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 60).map(ev => {
                const sev = SEV_CONFIG[ev.severity] ?? SEV_CONFIG.info;
                return (
                  <tr key={ev.id} className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                    <td className="px-4 py-2 font-mono text-slate-500 whitespace-nowrap">
                      {new Date(ev.created_at).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'medium' })}
                    </td>
                    <td className="px-4 py-2">
                      <code className="text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">{ev.event_type}</code>
                    </td>
                    <td className="px-4 py-2 text-slate-300 max-w-[200px] truncate">{ev.title}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5">
                        <div className={cn('h-1.5 w-1.5 rounded-full', sev.dot)} />
                        <span className={cn('capitalize', sev.text)}>{ev.severity}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 font-mono text-slate-600">
                      {ev.source_ip_hash ? ev.source_ip_hash.slice(0, 10) + '…' : '—'}
                    </td>
                    <td className="px-4 py-2 font-mono text-slate-600">
                      {ev.source_ip_hash ? ev.source_ip_hash.slice(10, 20) + '…' : '—'}
                    </td>
                    <td className="px-4 py-2 text-slate-400">{ev.affected_system ?? '—'}</td>
                    <td className="px-4 py-2">
                      {ev.source_country ? (
                        <span className={cn('font-mono', ['CN','RU','NG','BR','IN'].includes(ev.source_country) ? 'text-red-400' : 'text-slate-500')}>
                          {ev.source_country}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-600">No audit log entries match the current filter</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 bg-slate-800/20 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-600">
            All entries are append-only and cryptographically protected. Modification is prevented at the database layer via RLS.
          </span>
          {filtered.length > 60 && (
            <span className="text-xs text-slate-600">Showing 60 of {filtered.length}</span>
          )}
        </div>
      </div>
    </div>
  );
}
