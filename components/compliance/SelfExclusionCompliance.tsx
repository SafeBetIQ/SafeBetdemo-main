'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { ShieldOff, Clock, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, Search, RefreshCw, Circle as XCircle, UserCheck, BookOpen, PhoneCall, Network, Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell
} from 'recharts';

interface Exclusion {
  id: string;
  player_id: string;
  exclusion_type: string;
  exclusion_start_date: string;
  exclusion_end_date: string;
  minimum_period_months: number;
  is_permanent?: boolean;
  treatment_required: boolean;
  counseling_sessions_completed: number;
  counseling_sessions_required: number;
  reinstatement_requested: boolean;
  reinstatement_date: string | null;
  status: string;
  notes: string | null;
  players?: { first_name: string; last_name: string; player_id: string; email: string };
}

interface NetworkEvent {
  id: string;
  pseudonym_token: string;
  exclusion_type: string;
  duration_months: number;
  status: string;
  broadcast_at: string | null;
  created_at: string;
}

interface SelfExclusionComplianceProps {
  casinoId: string;
}

const STATUS_CONFIG: Record<string, { badge: string; label: string }> = {
  active:    { badge: 'bg-red-100 text-red-700',       label: 'Active' },
  completed: { badge: 'bg-emerald-100 text-emerald-700', label: 'Completed' },
  breached:  { badge: 'bg-orange-100 text-orange-700', label: 'Breached' },
  extended:  { badge: 'bg-blue-100 text-blue-700',     label: 'Extended' },
};

const EXCLUSION_TYPE_LABELS: Record<string, string> = {
  self_requested:    'Self-Requested',
  operator_initiated:'Operator Initiated',
  regulatory_order:  'Regulatory Order',
  voluntary_self_exclusion: 'Voluntary',
  family_requested:  'Family Requested',
  national_register: 'National Register',
};

export function SelfExclusionCompliance({ casinoId }: SelfExclusionComplianceProps) {
  const [exclusions, setExclusions] = useState<Exclusion[]>([]);
  const [networkEvents, setNetworkEvents] = useState<NetworkEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadData();
  }, [casinoId]);

  async function loadData() {
    setLoading(true);
    const [exRes, netRes] = await Promise.all([
      supabase.from('self_exclusion_registry')
        .select('*, players(first_name, last_name, player_id, email)')
        .eq('casino_id', casinoId)
        .order('created_at', { ascending: false }),
      supabase.from('sen_exclusion_events')
        .select('id, pseudonym_token, exclusion_type, duration_months, status, broadcast_at, created_at')
        .eq('submitting_casino_id', casinoId)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);
    setExclusions(exRes.data || []);
    setNetworkEvents(netRes.data || []);
    setLoading(false);
  }

  const filtered = exclusions.filter(e => {
    if (!search) return true;
    const name = `${e.players?.first_name} ${e.players?.last_name} ${e.players?.email} ${e.players?.player_id}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const active       = exclusions.filter(e => e.status === 'active').length;
  const completed    = exclusions.filter(e => e.status === 'completed').length;
  const breached     = exclusions.filter(e => e.status === 'breached').length;
  const reinstatementPending = exclusions.filter(e => e.reinstatement_requested && e.status === 'active').length;

  const withCounselling = exclusions.filter(e => e.status === 'active' && (e.counseling_sessions_completed || 0) > 0).length;
  const counsellingRate = active > 0 ? Math.round((withCounselling / active) * 100) : 100;

  const avgCounsellingProgress = exclusions.filter(e => e.status === 'active' && e.treatment_required).reduce((sum, e) => {
    const required = e.counseling_sessions_required || 6;
    const completed = e.counseling_sessions_completed || 0;
    return sum + Math.min(100, Math.round((completed / required) * 100));
  }, 0) / (exclusions.filter(e => e.status === 'active' && e.treatment_required).length || 1);

  const typeBreakdown = Object.entries(
    exclusions.reduce((acc: Record<string, number>, e) => {
      const k = EXCLUSION_TYPE_LABELS[e.exclusion_type] || e.exclusion_type;
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, count]) => ({ name, count }));

  const today = new Date();
  const expiringWithin30 = exclusions.filter(e => {
    if (e.status !== 'active') return false;
    const end = new Date(e.exclusion_end_date);
    const diff = (end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  });

  if (loading) {
    return <div className="flex items-center justify-center h-48"><div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-red-200 bg-red-50/40">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-red-600 flex items-center gap-1 mb-1">
              <ShieldOff className="h-3.5 w-3.5" /> Active Exclusions
            </p>
            <p className="text-3xl font-bold text-red-600">{active}</p>
            <p className="text-xs text-muted-foreground">Currently excluded</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Completed
            </p>
            <p className="text-3xl font-bold text-emerald-600">{completed}</p>
            <p className="text-xs text-muted-foreground">Successfully served</p>
          </CardContent>
        </Card>
        <Card className={reinstatementPending > 0 ? 'border-blue-200 bg-blue-50/40' : ''}>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-blue-600 flex items-center gap-1 mb-1">
              <UserCheck className="h-3.5 w-3.5" /> Reinstatement Pending
            </p>
            <p className="text-3xl font-bold text-blue-600">{reinstatementPending}</p>
            <p className="text-xs text-muted-foreground">Awaiting review</p>
          </CardContent>
        </Card>
        <Card className={breached > 0 ? 'border-orange-200 bg-orange-50/40' : ''}>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-orange-600 flex items-center gap-1 mb-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Breached
            </p>
            <p className="text-3xl font-bold text-orange-600">{breached}</p>
            <p className="text-xs text-muted-foreground">Violations detected</p>
          </CardContent>
        </Card>
      </div>

      {/* SARGF Counselling + Type Breakdown */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              SARGF Counselling Compliance
            </CardTitle>
            <CardDescription className="text-xs">Mandatory counselling sessions before reinstatement consideration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-4xl font-bold text-primary">{counsellingRate}<span className="text-xl">%</span></p>
                <p className="text-xs text-muted-foreground mt-1">Active exclusions with counselling initiated</p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p>{withCounselling} of {active} enrolled</p>
              </div>
            </div>
            <Progress value={counsellingRate} className="h-2" />
            <div className="p-3 rounded-lg bg-muted/30 border text-xs text-muted-foreground">
              <strong className="text-foreground">SARGF Requirement:</strong> Minimum 6 counselling sessions required before any reinstatement consideration under the South African Responsible Gambling Foundation guidelines.
            </div>
            {exclusions.filter(e => e.status === 'active' && e.treatment_required).slice(0, 4).map(e => {
              const pct = Math.min(100, Math.round(((e.counseling_sessions_completed || 0) / (e.counseling_sessions_required || 6)) * 100));
              return (
                <div key={e.id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium">{e.players?.first_name} {e.players?.last_name}</span>
                    <span className="text-muted-foreground">{e.counseling_sessions_completed}/{e.counseling_sessions_required} sessions</span>
                  </div>
                  <Progress value={pct} className="h-1" />
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Exclusions by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={typeBreakdown} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={100} />
                <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} name="Count">
                  {typeBreakdown.map((_, i) => (
                    <Cell key={i} fill={['#ef4444','#f97316','#eab308','#3b82f6','#10b981'][i % 5]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Expiring soon alert */}
      {expiringWithin30.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/40">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-700">
                  {expiringWithin30.length} exclusion{expiringWithin30.length > 1 ? 's' : ''} expiring within 30 days
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Review counselling completion and reinstatement eligibility before exclusion end dates.
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {expiringWithin30.slice(0, 5).map(e => (
                    <Badge key={e.id} className="bg-blue-100 text-blue-700 border-0 text-xs">
                      {e.players?.first_name} {e.players?.last_name} · {e.exclusion_end_date}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Network Events */}
      {networkEvents.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Network className="h-4 w-4 text-primary" />
              SafeBet IQ Network Events
            </CardTitle>
            <CardDescription className="text-xs">Exclusion events submitted to the cross-operator protection network</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {networkEvents.slice(0, 5).map(e => (
                <div key={e.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${e.status === 'broadcast' ? 'bg-emerald-500' : e.status === 'validated' ? 'bg-blue-500' : 'bg-yellow-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{EXCLUSION_TYPE_LABELS[e.exclusion_type] || e.exclusion_type}</p>
                    <p className="text-xs text-muted-foreground font-mono">{e.pseudonym_token.slice(0, 12)}... · {e.duration_months}m</p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge className={`border-0 text-xs ${e.status === 'broadcast' ? 'bg-emerald-100 text-emerald-700' : e.status === 'validated' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {e.status}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-0.5">{new Date(e.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Exclusion Register */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-sm">Self-Exclusion Register</CardTitle>
              <CardDescription className="text-xs mt-0.5">All exclusion records for this operator — NRGP compliant</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Search..." className="pl-8 h-8 text-xs w-40" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Button variant="outline" size="sm" onClick={loadData} className="h-8 w-8 p-0">
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Player</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="hidden md:table-cell">Period</TableHead>
                  <TableHead className="hidden lg:table-cell">Counselling</TableHead>
                  <TableHead className="hidden md:table-cell">End Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Reinstatement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                      {exclusions.length === 0 ? 'No self-exclusion records' : 'No matching records'}
                    </TableCell>
                  </TableRow>
                ) : filtered.slice(0, 50).map(e => {
                  const statusCfg = STATUS_CONFIG[e.status] || STATUS_CONFIG.active;
                  const counselPct = Math.min(100, Math.round(((e.counseling_sessions_completed || 0) / (e.counseling_sessions_required || 6)) * 100));
                  const daysRemaining = Math.max(0, Math.round((new Date(e.exclusion_end_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
                  return (
                    <TableRow key={e.id} className="hover:bg-muted/20">
                      <TableCell>
                        <p className="text-sm font-medium">{e.players?.first_name} {e.players?.last_name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{e.players?.player_id}</p>
                      </TableCell>
                      <TableCell className="text-xs">{EXCLUSION_TYPE_LABELS[e.exclusion_type] || e.exclusion_type}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{e.minimum_period_months}m min</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {e.treatment_required ? (
                          <div className="flex items-center gap-2">
                            <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${counselPct}%` }} />
                            </div>
                            <span className="text-xs font-mono">{e.counseling_sessions_completed}/{e.counseling_sessions_required}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <p className="text-xs">{e.exclusion_end_date}</p>
                        {e.status === 'active' && (
                          <p className={`text-xs ${daysRemaining <= 30 ? 'text-orange-500 font-medium' : 'text-muted-foreground'}`}>
                            {daysRemaining}d remaining
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${statusCfg.badge} border-0 text-xs`}>{statusCfg.label}</Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {e.reinstatement_requested ? (
                          <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">Requested</Badge>
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground/30" />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
