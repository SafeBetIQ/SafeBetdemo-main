'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  RefreshCw, CheckCircle2, XCircle, Clock, Smartphone,
  Mail, MessageSquare, Monitor, ShieldCheck, Loader2, FileText,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface InterventionRecord {
  id: string;
  player_id: string;
  intervention_type: string;
  delivery_method: string | null;
  channels_attempted: string[] | null;
  dispatch_status: string | null;
  player_response: string | null;
  intervention_successful: boolean | null;
  risk_score_at_trigger: number;
  triggered_at: string;
  resolved_at: string | null;
  trigger_reason: string | null;
}

// ── Config maps ───────────────────────────────────────────────────────────────

const CHANNEL_ICON: Record<string, React.ElementType> = {
  in_app:   Monitor,
  whatsapp: MessageSquare,
  sms:      Smartphone,
  email:    Mail,
};

const CHANNEL_LABEL: Record<string, string> = {
  in_app: 'App', whatsapp: 'WA', sms: 'SMS', email: 'Email',
};

const DISPATCH_CONFIG: Record<string, { label: string; cls: string }> = {
  pending:  { label: 'Pending',    cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  sending:  { label: 'Sending',    cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  sent:     { label: 'Sent',       cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  partial:  { label: 'Partial',    cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  failed:   { label: 'Failed',     cls: 'bg-red-100 text-red-700 border-red-200' },
  cancelled:{ label: 'Cancelled',  cls: 'bg-muted text-muted-foreground border-border' },
};

const RESPONSE_CONFIG: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  accepted: { label: 'Accepted', icon: CheckCircle2, cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  declined: { label: 'Declined', icon: XCircle,     cls: 'bg-red-100 text-red-700 border-red-200' },
  ignored:  { label: 'Ignored',  icon: Clock,       cls: 'bg-muted text-muted-foreground border-border' },
  deferred: { label: 'Deferred', icon: Clock,       cls: 'bg-amber-100 text-amber-700 border-amber-200' },
};

function dispatchCfg(status: string | null) {
  return DISPATCH_CONFIG[status ?? 'pending'] ?? DISPATCH_CONFIG.pending;
}

function responseCfg(response: string | null) {
  return RESPONSE_CONFIG[response ?? ''] ?? null;
}

function riskColor(score: number) {
  if (score >= 80) return 'bg-red-600 text-white border-0';
  if (score >= 60) return 'bg-orange-500 text-white border-0';
  if (score >= 40) return 'bg-yellow-500 text-white border-0';
  return 'bg-muted text-muted-foreground';
}

function saTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-ZA', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZone: 'Africa/Johannesburg',
  });
}

function saDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: '2-digit', month: 'short',
    timeZone: 'Africa/Johannesburg',
  });
}

function timeAgo(iso: string) {
  const secs = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60)  return `${secs}s ago`;
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.round(secs / 3600)}h ago`;
  return `${Math.round(secs / 86400)}d ago`;
}

// ── Row ───────────────────────────────────────────────────────────────────────

function InterventionRow({ record }: { record: InterventionRecord }) {
  const dispatch   = dispatchCfg(record.dispatch_status);
  const responseCf = responseCfg(record.player_response);
  const channels   = record.channels_attempted?.length
    ? record.channels_attempted
    : record.delivery_method
    ? [record.delivery_method]
    : [];
  const isResolved  = record.intervention_successful !== null;

  return (
    <tr className="border-b border-border/50 hover:bg-muted/20 transition-colors text-xs">
      {/* Player */}
      <td className="px-4 py-3 font-mono text-muted-foreground whitespace-nowrap">
        {record.player_id.slice(-8).toUpperCase()}
      </td>

      {/* Type */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="font-medium capitalize">
          {record.intervention_type.replace(/_/g, ' ')}
        </span>
      </td>

      {/* Risk score */}
      <td className="px-4 py-3">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${riskColor(record.risk_score_at_trigger)}`}>
          {record.risk_score_at_trigger}
        </span>
      </td>

      {/* Channels */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 flex-wrap">
          {channels.length === 0 && (
            <span className="text-muted-foreground">—</span>
          )}
          {channels.map(ch => {
            const Icon = CHANNEL_ICON[ch] ?? Monitor;
            return (
              <span
                key={ch}
                title={ch}
                className="inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
              >
                <Icon className="h-2.5 w-2.5" />
                {CHANNEL_LABEL[ch] ?? ch}
              </span>
            );
          })}
        </div>
      </td>

      {/* Dispatch status */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${dispatch.cls}`}>
          {dispatch.label}
        </span>
      </td>

      {/* Outcome */}
      <td className="px-4 py-3 whitespace-nowrap">
        {responseCf ? (
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${responseCf.cls}`}>
            <responseCf.icon className="h-2.5 w-2.5" />
            {responseCf.label}
          </span>
        ) : isResolved ? (
          <span className="text-[10px] text-muted-foreground">No response</span>
        ) : (
          <span className="text-[10px] text-muted-foreground italic">Awaiting…</span>
        )}
      </td>

      {/* Success */}
      <td className="px-4 py-3 text-center">
        {record.intervention_successful === true  && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mx-auto" />}
        {record.intervention_successful === false && <XCircle      className="h-3.5 w-3.5 text-red-500 mx-auto" />}
        {record.intervention_successful === null  && <span className="text-[10px] text-muted-foreground">—</span>}
      </td>

      {/* Timestamp */}
      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
        <div>{saDate(record.triggered_at)} {saTime(record.triggered_at)}</div>
        <div className="text-[10px] opacity-60">{timeAgo(record.triggered_at)}</div>
      </td>
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface InterventionRegulatorViewProps {
  /** Optional casino_id — if provided, filters to that casino. Omit for regulator (all casinos). */
  casinoId?: string;
  /** How many records to fetch (default 50) */
  limit?: number;
}

export function InterventionRegulatorView({ casinoId, limit = 50 }: InterventionRegulatorViewProps) {
  const [records, setRecords]     = useState<InterventionRecord[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from('intervention_history')
      .select([
        'id',
        'player_id',
        'intervention_type',
        'delivery_method',
        'channels_attempted',
        'dispatch_status',
        'player_response',
        'intervention_successful',
        'risk_score_at_trigger',
        'triggered_at',
        'resolved_at',
        'trigger_reason',
      ].join(', '))
      .order('triggered_at', { ascending: false })
      .limit(limit);

    if (casinoId) {
      query = query.eq('casino_id', casinoId);
    }

    const { data, error: err } = await query;

    if (err) {
      setError(err.message);
    } else {
      setRecords((data ?? []) as unknown as InterventionRecord[]);
    }
    setLoading(false);
    setLastRefresh(new Date());
  }, [casinoId, limit]);

  useEffect(() => { load(); }, [load]);

  // ── Derived stats ─────────────────────────────────────────────────────────

  const total      = records.length;
  const resolved   = records.filter(r => r.intervention_successful !== null).length;
  const successful = records.filter(r => r.intervention_successful === true).length;
  const pending    = records.filter(r => r.dispatch_status === 'pending').length;
  const successRate = resolved > 0 ? Math.round((successful / resolved) * 100) : null;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3 border-b border-border">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <FileText className="h-4.5 w-4.5 text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">Intervention Audit Log</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Full lifecycle — trigger · dispatch · outcome · compliance
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Summary badges */}
            <Badge variant="outline" className="text-xs gap-1">
              {total} total
            </Badge>
            {pending > 0 && (
              <Badge className="bg-amber-500 text-white border-0 text-xs">
                {pending} pending
              </Badge>
            )}
            {successRate !== null && (
              <Badge
                className={`text-xs border-0 ${successRate >= 60 ? 'bg-emerald-600' : 'bg-orange-500'} text-white`}
              >
                <ShieldCheck className="h-3 w-3 mr-1" />
                {successRate}% success
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={load}
              disabled={loading}
              className="h-7 text-xs gap-1.5"
            >
              {loading
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <RefreshCw className="h-3 w-3" />
              }
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-4 gap-px bg-border mt-3 rounded-lg overflow-hidden">
          {[
            { label: 'Total',      value: total,     color: 'text-foreground' },
            { label: 'Resolved',   value: resolved,  color: resolved > 0 ? 'text-blue-400' : 'text-muted-foreground' },
            { label: 'Successful', value: successful, color: successful > 0 ? 'text-emerald-400' : 'text-muted-foreground' },
            { label: 'Success %',  value: successRate !== null ? `${successRate}%` : '—', color: successRate !== null && successRate >= 60 ? 'text-emerald-400' : 'text-muted-foreground' },
          ].map(item => (
            <div key={item.label} className="bg-card px-3 py-2 text-center">
              <div className={`text-base font-bold ${item.color}`}>{item.value}</div>
              <div className="text-[9px] text-muted-foreground">{item.label}</div>
            </div>
          ))}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading && records.length === 0 ? (
          <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading intervention history…
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-32 text-red-500 text-sm px-6 text-center">
            {error}
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm gap-2">
            <FileText className="h-7 w-7 opacity-30" />
            <span>No interventions recorded yet</span>
            <span className="text-xs opacity-60">Trigger one from the predictive engine above</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 text-left">Player</th>
                  <th className="px-4 py-2.5 text-left">Type</th>
                  <th className="px-4 py-2.5 text-left">Risk</th>
                  <th className="px-4 py-2.5 text-left">Channels</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                  <th className="px-4 py-2.5 text-left">Outcome</th>
                  <th className="px-4 py-2.5 text-center">Success</th>
                  <th className="px-4 py-2.5 text-left">Triggered</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => <InterventionRow key={r.id} record={r} />)}
              </tbody>
            </table>
            <div className="px-4 py-2.5 text-[10px] text-muted-foreground flex justify-between border-t border-border bg-muted/10">
              <span>Showing {records.length} most recent · SAST {lastRefresh.toLocaleTimeString('en-ZA', { timeZone: 'Africa/Johannesburg' })}</span>
              <span>intervention_history · RLS-enforced · casino-scoped</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
