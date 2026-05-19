'use client';
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Shield, ShieldAlert, ShieldCheck, TriangleAlert as AlertTriangle, CircleAlert as AlertCircle, Info, Search, RefreshCw, CircleCheck as CheckCircle2, Clock, Lock, LogIn, LogOut, UserX, Key, Database, Activity, Eye, ChevronRight, Filter, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PaginationControls } from '@/components/ui/pagination-controls';

interface SecurityEvent {
  id: string;
  event_type: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  source: string | null;
  actor_email_hash: string | null;
  ip_hash: string | null;
  resource: string | null;
  details: Record<string, unknown> | null;
  resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
}

interface Casino {
  id: string;
  name: string;
}

interface EventStats {
  total: number;
  unresolved: number;
  critical: number;
  high: number;
  last24h: number;
}

const SEVERITY_CONFIG: Record<string, { label: string; className: string; icon: React.FC<{ className?: string }> }> = {
  info: { label: 'Info', className: 'bg-blue-100 text-blue-700 border-blue-200', icon: Info },
  low: { label: 'Low', className: 'bg-slate-100 text-slate-700 border-slate-200', icon: Shield },
  medium: { label: 'Medium', className: 'bg-amber-100 text-amber-700 border-amber-200', icon: AlertTriangle },
  high: { label: 'High', className: 'bg-orange-100 text-orange-700 border-orange-200', icon: ShieldAlert },
  critical: { label: 'Critical', className: 'bg-red-100 text-red-700 border-red-200', icon: AlertCircle },
};

const EVENT_TYPE_CONFIG: Record<string, { label: string; icon: React.FC<{ className?: string }> }> = {
  login_success: { label: 'Login Success', icon: LogIn },
  login_failed: { label: 'Login Failed', icon: LogOut },
  logout: { label: 'Logout', icon: LogOut },
  api_auth_failed: { label: 'API Auth Failed', icon: Key },
  api_rate_limit: { label: 'Rate Limit', icon: Activity },
  data_export: { label: 'Data Export', icon: Download },
  data_access: { label: 'Data Access', icon: Eye },
  permission_denied: { label: 'Permission Denied', icon: UserX },
  config_change: { label: 'Config Change', icon: Database },
  self_exclusion: { label: 'Self Exclusion', icon: ShieldCheck },
  suspicious_activity: { label: 'Suspicious Activity', icon: AlertTriangle },
  system_error: { label: 'System Error', icon: AlertCircle },
};

function formatEventType(eventType: string): string {
  return EVENT_TYPE_CONFIG[eventType]?.label ?? eventType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getEventIcon(eventType: string) {
  return EVENT_TYPE_CONFIG[eventType]?.icon ?? Shield;
}

function formatTimestamp(ts: string): string {
  return new Intl.DateTimeFormat('en-ZA', {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(new Date(ts));
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const PAGE_SIZE = 50;

export default function SecurityAuditLogPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [eventsCount, setEventsCount] = useState(0);
  const [page, setPage] = useState(0);
  const [casinos, setCasinos] = useState<Casino[]>([]);
  const [uniqueSources, setUniqueSources] = useState<string[]>([]);
  const [stats, setStats] = useState<EventStats>({ total: 0, unresolved: 0, critical: 0, high: 0, last24h: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedCasino, setSelectedCasino] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolving, setResolving] = useState(false);

  const isSuperAdmin = user?.role === 'super_admin';

  const loadCasinos = useCallback(async () => {
    const { data } = await supabase.from('casinos').select('id, name').eq('is_active', true).order('name');
    if (data) setCasinos(data);
  }, []);

  const loadStats = useCallback(async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const [total, unresolved, critical, high, last24h, sources] = await Promise.all([
      supabase.from('security_events').select('*', { count: 'exact', head: true }),
      supabase.from('security_events').select('*', { count: 'exact', head: true }).eq('resolved', false),
      supabase.from('security_events').select('*', { count: 'exact', head: true }).eq('severity', 'critical').eq('resolved', false),
      supabase.from('security_events').select('*', { count: 'exact', head: true }).eq('severity', 'high').eq('resolved', false),
      supabase.from('security_events').select('*', { count: 'exact', head: true }).gte('created_at', yesterday),
      supabase.from('security_events').select('source').order('source'),
    ]);
    setStats({
      total: total.count ?? 0,
      unresolved: unresolved.count ?? 0,
      critical: critical.count ?? 0,
      high: high.count ?? 0,
      last24h: last24h.count ?? 0,
    });
    const srcs = Array.from(new Set((sources.data ?? []).map((e: any) => e.source).filter(Boolean))) as string[];
    setUniqueSources(srcs);
  }, []);

  const loadEvents = useCallback(async (isRefresh = false) => {
    if (isRefresh) { setRefreshing(true); } else { setLoading(true); }

    try {
      const offset = page * PAGE_SIZE;
      let query = supabase
        .from('security_events')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (severityFilter !== 'all') query = query.eq('severity', severityFilter);
      if (sourceFilter !== 'all') query = query.eq('source', sourceFilter);
      if (statusFilter === 'resolved') query = query.eq('resolved', true);
      if (statusFilter === 'unresolved') query = query.eq('resolved', false);

      const { data, count, error } = await query;
      if (error) throw error;
      setEvents(data ?? []);
      setEventsCount(count ?? 0);
    } catch (err) {
      console.error('Failed to load security events:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [severityFilter, sourceFilter, statusFilter, page]);

  useEffect(() => { loadCasinos(); loadStats(); }, [loadCasinos, loadStats]);
  useEffect(() => { loadEvents(); }, [loadEvents]);

  const handleSeverityChange = (v: string) => { setSeverityFilter(v); setPage(0); };
  const handleSourceChange = (v: string) => { setSourceFilter(v); setPage(0); };
  const handleStatusChange = (v: string) => { setStatusFilter(v); setPage(0); };

  const filteredEvents = events.filter(event => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !event.event_type.toLowerCase().includes(q) &&
        !(event.source ?? '').toLowerCase().includes(q) &&
        !(event.resource ?? '').toLowerCase().includes(q) &&
        !(event.actor_email_hash ?? '').toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const handleResolve = async () => {
    if (!selectedEvent || !resolutionNotes.trim()) return;
    setResolving(true);

    const { error } = await supabase
      .from('security_events')
      .update({
        resolved: true,
        resolved_by: user?.email ?? 'unknown',
        resolved_at: new Date().toISOString(),
        resolution_notes: resolutionNotes.trim(),
      })
      .eq('id', selectedEvent.id);

    if (!error) {
      setResolveDialogOpen(false);
      setSelectedEvent(null);
      setResolutionNotes('');
      loadStats();
      loadEvents(true);
    }
    setResolving(false);
  };

  const statCards = [
    {
      label: 'Total Events',
      value: stats.total,
      icon: Activity,
      className: 'text-slate-700',
      bg: 'bg-slate-50',
    },
    {
      label: 'Unresolved',
      value: stats.unresolved,
      icon: Clock,
      className: 'text-amber-700',
      bg: 'bg-amber-50',
    },
    {
      label: 'Critical (Open)',
      value: stats.critical,
      icon: AlertCircle,
      className: 'text-red-700',
      bg: 'bg-red-50',
    },
    {
      label: 'High (Open)',
      value: stats.high,
      icon: ShieldAlert,
      className: 'text-orange-700',
      bg: 'bg-orange-50',
    },
    {
      label: 'Last 24 Hours',
      value: stats.last24h,
      icon: RefreshCw,
      className: 'text-blue-700',
      bg: 'bg-blue-50',
    },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Lock className="h-6 w-6 text-slate-700" />
              Security Audit Log
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Tamper-evident append-only log — ISO 27001 Annex A.16 / A.12.4 compliance
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadEvents(true)}
            disabled={refreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.label} className={cn('border', card.bg)}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={cn('p-2 rounded-lg bg-white shadow-sm', card.className)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className={cn('text-2xl font-bold', card.className)}>{card.value.toLocaleString()}</div>
                    <div className="text-xs text-slate-500">{card.label}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-amber-700 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              <span className="font-semibold">Append-only integrity guarantee:</span> Events in this log cannot be
              modified or deleted through the application. All entries are timestamped server-side. Access to this
              log is restricted to Super Admins and Compliance Officers per ISO 27001 A.9.2 and POPIA s.8.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search events, sources, actors..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="h-4 w-4 text-slate-400" />
                <Select value={severityFilter} onValueChange={handleSeverityChange}>
                  <SelectTrigger className="h-9 w-36">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sourceFilter} onValueChange={handleSourceChange}>
                  <SelectTrigger className="h-9 w-40">
                    <SelectValue placeholder="Source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    {uniqueSources.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={handleStatusChange}>
                  <SelectTrigger className="h-9 w-36">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="unresolved">Unresolved</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-12 text-center text-slate-500">
                <Activity className="h-8 w-8 mx-auto mb-3 animate-pulse text-slate-300" />
                Loading security events...
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <ShieldCheck className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                <p className="font-medium text-slate-600">No events found</p>
                <p className="text-sm mt-1">Try adjusting your filters or search query</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="w-32">Severity</TableHead>
                      <TableHead className="w-48">Event Type</TableHead>
                      <TableHead className="w-32">Source</TableHead>
                      <TableHead>Resource / Actor</TableHead>
                      <TableHead className="w-40">Timestamp</TableHead>
                      <TableHead className="w-28">Status</TableHead>
                      <TableHead className="w-20 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEvents.map((event) => {
                      const sevConfig = SEVERITY_CONFIG[event.severity] ?? SEVERITY_CONFIG.info;
                      const SevIcon = sevConfig.icon;
                      const EventIcon = getEventIcon(event.event_type);
                      return (
                        <TableRow
                          key={event.id}
                          className={cn(
                            'cursor-pointer hover:bg-slate-50 transition-colors',
                            event.severity === 'critical' && !event.resolved && 'bg-red-50/40',
                            event.severity === 'high' && !event.resolved && 'bg-orange-50/30',
                          )}
                          onClick={() => setSelectedEvent(event)}
                        >
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn('flex items-center gap-1 w-fit text-xs font-medium', sevConfig.className)}
                            >
                              <SevIcon className="h-3 w-3" />
                              {sevConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <EventIcon className="h-4 w-4 text-slate-400 flex-shrink-0" />
                              <span className="text-sm font-medium text-slate-700">
                                {formatEventType(event.event_type)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-slate-600 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                              {event.source ?? '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {event.resource && (
                                <div className="text-slate-700 font-medium truncate max-w-[200px]">{event.resource}</div>
                              )}
                              {event.actor_email_hash && (
                                <div className="text-xs text-slate-400 font-mono truncate max-w-[200px]">
                                  actor: {event.actor_email_hash.slice(0, 16)}...
                                </div>
                              )}
                              {event.ip_hash && (
                                <div className="text-xs text-slate-400 font-mono">
                                  ip: {event.ip_hash.slice(0, 12)}...
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs">
                              <div className="text-slate-700 font-mono">{formatTimestamp(event.created_at)}</div>
                              <div className="text-slate-400">{timeAgo(event.created_at)}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {event.resolved ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs flex items-center gap-1 w-fit">
                                <CheckCircle2 className="h-3 w-3" />
                                Resolved
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs flex items-center gap-1 w-fit">
                                <Clock className="h-3 w-3" />
                                Open
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <ChevronRight className="h-4 w-4 text-slate-400 ml-auto" />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="border-t bg-slate-50">
              <div className="flex items-center justify-between px-4 pt-2 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Tamper-evident — append only
                </span>
              </div>
              <PaginationControls
                page={page}
                pageSize={PAGE_SIZE}
                total={eventsCount}
                onPageChange={setPage}
                loading={loading || refreshing}
                className="border-t-0 bg-slate-50"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {selectedEvent && !resolveDialogOpen && (
        <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {(() => {
                  const SevIcon = SEVERITY_CONFIG[selectedEvent.severity]?.icon ?? Shield;
                  return <SevIcon className={cn('h-5 w-5', {
                    'text-red-600': selectedEvent.severity === 'critical',
                    'text-orange-600': selectedEvent.severity === 'high',
                    'text-amber-600': selectedEvent.severity === 'medium',
                    'text-slate-600': selectedEvent.severity === 'low',
                    'text-blue-600': selectedEvent.severity === 'info',
                  })} />;
                })()}
                Security Event Detail
              </DialogTitle>
              <DialogDescription>
                Event ID: <span className="font-mono text-xs">{selectedEvent.id}</span>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Event Type</div>
                  <div className="font-medium">{formatEventType(selectedEvent.event_type)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Severity</div>
                  <Badge
                    variant="outline"
                    className={cn('text-xs', SEVERITY_CONFIG[selectedEvent.severity]?.className)}
                  >
                    {SEVERITY_CONFIG[selectedEvent.severity]?.label ?? selectedEvent.severity}
                  </Badge>
                </div>
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Source</div>
                  <div className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">{selectedEvent.source ?? '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Timestamp</div>
                  <div className="font-mono text-xs">{formatTimestamp(selectedEvent.created_at)}</div>
                </div>
                {selectedEvent.resource && (
                  <div className="col-span-2">
                    <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Resource</div>
                    <div className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">{selectedEvent.resource}</div>
                  </div>
                )}
                {selectedEvent.actor_email_hash && (
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Actor (Hashed)</div>
                    <div className="font-mono text-xs bg-slate-100 px-2 py-1 rounded truncate">{selectedEvent.actor_email_hash}</div>
                  </div>
                )}
                {selectedEvent.ip_hash && (
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">IP Address (Hashed)</div>
                    <div className="font-mono text-xs bg-slate-100 px-2 py-1 rounded truncate">{selectedEvent.ip_hash}</div>
                  </div>
                )}
              </div>
              {selectedEvent.details && Object.keys(selectedEvent.details).length > 0 && (
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Event Details</div>
                  <pre className="text-xs bg-slate-900 text-slate-100 p-3 rounded-lg overflow-auto max-h-48 font-mono">
                    {JSON.stringify(selectedEvent.details, null, 2)}
                  </pre>
                </div>
              )}
              {selectedEvent.resolved ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-700 font-semibold text-sm mb-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Resolved
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs text-green-800">
                    <div>
                      <div className="text-green-600 uppercase tracking-wide mb-0.5">Resolved By</div>
                      <div>{selectedEvent.resolved_by ?? '—'}</div>
                    </div>
                    <div>
                      <div className="text-green-600 uppercase tracking-wide mb-0.5">Resolved At</div>
                      <div className="font-mono">{selectedEvent.resolved_at ? formatTimestamp(selectedEvent.resolved_at) : '—'}</div>
                    </div>
                    {selectedEvent.resolution_notes && (
                      <div className="col-span-2">
                        <div className="text-green-600 uppercase tracking-wide mb-0.5">Resolution Notes</div>
                        <div>{selectedEvent.resolution_notes}</div>
                      </div>
                    )}
                  </div>
                </div>
              ) : isSuperAdmin ? (
                <div className="flex justify-end pt-2 border-t">
                  <Button
                    onClick={() => {
                      setResolveDialogOpen(true);
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-white gap-2"
                    size="sm"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Mark as Resolved
                  </Button>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs text-slate-500 flex items-center gap-2">
                  <Lock className="h-3 w-3" />
                  Only Super Admins can resolve security events.
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {selectedEvent && resolveDialogOpen && (
        <Dialog open={resolveDialogOpen} onOpenChange={() => { setResolveDialogOpen(false); setResolutionNotes(''); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Resolve Security Event
              </DialogTitle>
              <DialogDescription>
                Provide resolution notes to close this event. This action is logged.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-slate-50 border rounded p-3 text-sm">
                <div className="font-medium text-slate-700">{formatEventType(selectedEvent.event_type)}</div>
                <div className="text-xs text-slate-400 font-mono mt-1">{selectedEvent.id}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">
                  Resolution Notes <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={resolutionNotes}
                  onChange={e => setResolutionNotes(e.target.value)}
                  placeholder="Describe how this event was investigated and resolved..."
                  className="w-full min-h-[100px] text-sm border border-slate-200 rounded-md p-3 resize-none focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" size="sm" onClick={() => { setResolveDialogOpen(false); setResolutionNotes(''); }}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleResolve}
                  disabled={!resolutionNotes.trim() || resolving}
                  className="bg-green-700 hover:bg-green-600 text-white gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {resolving ? 'Resolving...' : 'Confirm Resolution'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}
