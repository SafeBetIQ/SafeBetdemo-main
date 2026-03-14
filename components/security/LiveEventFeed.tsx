'use client';

import { useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ShieldAlert, TriangleAlert as AlertTriangle, Info, CircleAlert as AlertCircle, Lock, Zap, Eye, Activity } from 'lucide-react';

export interface SecurityEvent {
  id: string;
  event_type: string;
  severity: string;
  title: string;
  source_country: string | null;
  affected_system: string | null;
  source_ip_hash: string | null;
  created_at: string;
  casino_id: string | null;
}

interface Props {
  events: SecurityEvent[];
  maxRows?: number;
}

const SEV_CONFIG: Record<string, { dot: string; badge: string; icon: React.FC<{ className?: string }> }> = {
  critical: { dot: 'bg-red-500 animate-pulse', badge: 'bg-red-950 text-red-400 border-red-800', icon: AlertCircle },
  high: { dot: 'bg-orange-500', badge: 'bg-orange-950 text-orange-400 border-orange-800', icon: ShieldAlert },
  medium: { dot: 'bg-amber-500', badge: 'bg-amber-950 text-amber-400 border-amber-800', icon: AlertTriangle },
  low: { dot: 'bg-slate-500', badge: 'bg-slate-800 text-slate-400 border-slate-700', icon: Info },
  info: { dot: 'bg-blue-500', badge: 'bg-blue-950 text-blue-400 border-blue-800', icon: Info },
};

const TYPE_ICONS: Record<string, React.FC<{ className?: string }>> = {
  failed_auth: Lock,
  brute_force: ShieldAlert,
  api_abuse: Zap,
  rate_limit_exceeded: Activity,
  unauthorized_access: ShieldAlert,
  data_export: Eye,
  suspicious_query: AlertTriangle,
  session_hijack: Lock,
  role_escalation: ShieldAlert,
  anomalous_activity: Activity,
  pii_access: Eye,
  mass_data_access: Eye,
  admin_action: Info,
  token_expired: Lock,
  config_change: Info,
};

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export function LiveEventFeed({ events, maxRows = 12 }: Props) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [events]);

  const visible = events.slice(0, maxRows);

  return (
    <div ref={listRef} className="overflow-y-auto max-h-[380px] space-y-1 scrollbar-thin">
      {visible.length === 0 ? (
        <div className="text-center py-8 text-slate-600 text-sm">No events</div>
      ) : visible.map((ev, i) => {
        const sev = SEV_CONFIG[ev.severity] ?? SEV_CONFIG.info;
        const SevIcon = sev.icon;
        const TypeIcon = TYPE_ICONS[ev.event_type] ?? Activity;
        return (
          <div
            key={ev.id}
            className={cn(
              'flex items-start gap-3 px-3 py-2 rounded-lg border transition-all duration-300',
              'bg-slate-900/60 border-slate-800/60 hover:border-slate-700',
              i === 0 && 'border-slate-600 bg-slate-800/80',
            )}
          >
            <div className="flex items-center gap-1.5 pt-0.5 flex-shrink-0">
              <div className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', sev.dot)} />
              <TypeIcon className="h-3.5 w-3.5 text-slate-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-slate-200 truncate">{ev.title}</span>
                <Badge variant="outline" className={cn('text-xs px-1.5 py-0 border flex-shrink-0', sev.badge)}>
                  {ev.severity}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {ev.affected_system && (
                  <span className="text-xs text-slate-500 font-mono truncate max-w-[140px]">{ev.affected_system}</span>
                )}
                {ev.source_country && (
                  <span className="text-xs text-slate-600">{ev.source_country}</span>
                )}
              </div>
            </div>
            <span className="text-xs text-slate-600 flex-shrink-0 tabular-nums">{timeAgo(ev.created_at)}</span>
          </div>
        );
      })}
    </div>
  );
}
