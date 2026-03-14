'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UserX, FileDown, CreditCard as Edit2, CircleAlert as AlertCircle, CircleCheck as CheckCircle2, Clock, Circle as XCircle, Plus, Search, Database, FileText, Eye, Trash2, UserCheck, Calendar, Lock, ShieldOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DSR {
  id: string;
  casino_id: string;
  request_type: string;
  player_token: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'on_hold';
  legal_basis: string | null;
  submitted_at: string;
  deadline_at: string | null;
  completed_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
}

interface RetentionPolicy {
  id: string;
  policy_name: string;
  data_category: string;
  retention_days: number;
  legal_basis: string | null;
  regulatory_reference: string | null;
  auto_delete_enabled: boolean;
}

interface ROPA {
  id: string;
  casino_id: string;
  activity_name: string;
  purpose: string;
  legal_basis: string;
  data_categories: string[];
  data_subjects: string[];
  recipients: string[];
  third_country: boolean;
  retention_period: string | null;
  security_measures: string[];
  dpo_reviewed: boolean;
  dpo_reviewed_at: string | null;
  created_at: string;
}

const DSR_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  access:             { label: 'Access',           icon: Eye,      color: 'text-blue-600 bg-blue-50 border-blue-200' },
  erasure:            { label: 'Erasure',          icon: Trash2,   color: 'text-red-600 bg-red-50 border-red-200' },
  rectification:      { label: 'Rectification',   icon: Edit2,    color: 'text-amber-600 bg-amber-50 border-amber-200' },
  portability:        { label: 'Portability',      icon: FileDown, color: 'text-teal-600 bg-teal-50 border-teal-200' },
  restriction:        { label: 'Restriction',      icon: Lock,     color: 'text-orange-600 bg-orange-50 border-orange-200' },
  objection:          { label: 'Objection',        icon: ShieldOff,color: 'text-slate-600 bg-slate-50 border-slate-200' },
  automated_decision: { label: 'Auto. Decision',  icon: AlertCircle, color: 'text-purple-600 bg-purple-50 border-purple-200' },
};

const DSR_STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  pending:     { label: 'Pending',     icon: Clock,        color: 'text-amber-600' },
  in_progress: { label: 'In Progress', icon: Clock,        color: 'text-blue-600' },
  completed:   { label: 'Completed',   icon: CheckCircle2, color: 'text-emerald-600' },
  rejected:    { label: 'Rejected',    icon: XCircle,      color: 'text-red-600' },
  on_hold:     { label: 'On Hold',     icon: AlertCircle,  color: 'text-slate-500' },
};

const isOverdue = (deadline: string | null, status: string) => {
  if (!deadline || status === 'completed' || status === 'rejected') return false;
  return new Date(deadline) < new Date();
};

const daysRemaining = (deadline: string | null) => {
  if (!deadline) return null;
  const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  return diff;
};

export default function PrivacyCentrePage() {
  const { user } = useAuth();
  const [dsrs, setDsrs] = useState<DSR[]>([]);
  const [policies, setPolicies] = useState<RetentionPolicy[]>([]);
  const [ropa, setRopa] = useState<ROPA[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [newDSR, setNewDSR] = useState<Partial<DSR> | null>(null);
  const [editRopa, setEditRopa] = useState<ROPA | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [{ data: d }, { data: p }, { data: r }] = await Promise.all([
      supabase.from('data_subject_requests').select('*').order('submitted_at', { ascending: false }),
      supabase.from('data_retention_policies').select('*').order('data_category'),
      supabase.from('data_processing_activities').select('*').order('activity_name'),
    ]);
    setDsrs(d ?? []);
    setPolicies(p ?? []);
    setRopa(r ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredDSRs = dsrs.filter(d => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    if (typeFilter !== 'all' && d.request_type !== typeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return d.player_token.toLowerCase().includes(q) || d.request_type.toLowerCase().includes(q);
    }
    return true;
  });

  const stats = {
    total: dsrs.length,
    pending: dsrs.filter(d => d.status === 'pending').length,
    overdue: dsrs.filter(d => isOverdue(d.deadline_at, d.status)).length,
    completedThisMonth: dsrs.filter(d => d.status === 'completed' && d.completed_at && new Date(d.completed_at) > new Date(Date.now() - 30 * 86400000)).length,
  };

  const handleCreateDSR = async () => {
    if (!newDSR?.request_type || !newDSR.player_token) return;
    setSaving(true);
    const deadline = new Date(Date.now() + 30 * 86400000).toISOString();
    await supabase.from('data_subject_requests').insert({
      request_type: newDSR.request_type,
      player_token: newDSR.player_token,
      status: 'pending',
      submitted_at: new Date().toISOString(),
      deadline_at: deadline,
      notes: newDSR.notes ?? null,
    });
    setSaving(false);
    setNewDSR(null);
    loadData();
  };

  const handleUpdateDSRStatus = async (id: string, status: DSR['status']) => {
    await supabase.from('data_subject_requests').update({
      status,
      completed_at: ['completed', 'rejected'].includes(status) ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    loadData();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-900 dark:bg-slate-100">
            <UserCheck className="w-5 h-5 text-white dark:text-slate-900" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Privacy Centre</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Data subject rights · Consent · Retention · ROPA — GDPR &amp; POPIA compliance</p>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total DSRs',      value: stats.total,              icon: FileText,     color: 'text-slate-600' },
            { label: 'Pending',          value: stats.pending,            icon: Clock,        color: 'text-amber-600' },
            { label: 'Overdue',          value: stats.overdue,            icon: AlertCircle,  color: 'text-red-600' },
            { label: 'Completed (30d)',  value: stats.completedThisMonth, icon: CheckCircle2, color: 'text-emerald-600' },
          ].map(s => {
            const Icon = s.icon;
            return (
              <Card key={s.label} className="border border-slate-200 dark:border-slate-800">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={cn('p-2 rounded-lg bg-slate-100 dark:bg-slate-800', s.color)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{s.value}</p>
                    <p className="text-xs text-slate-500">{s.label}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Tabs defaultValue="dsr" className="space-y-4">
          <TabsList className="h-9">
            <TabsTrigger value="dsr" className="text-xs">Data Subject Requests</TabsTrigger>
            <TabsTrigger value="retention" className="text-xs">Retention Policies</TabsTrigger>
            <TabsTrigger value="ropa" className="text-xs">Processing Activities (ROPA)</TabsTrigger>
          </TabsList>

          {/* ── DSR TAB ───────────────────────────────────── */}
          <TabsContent value="dsr" className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex flex-wrap gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {Object.entries(DSR_STATUS_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {Object.entries(DSR_TYPE_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative">
                  <Search className="absolute left-2 top-1.5 w-3.5 h-3.5 text-slate-400" />
                  <Input
                    placeholder="Search token..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-7 h-8 text-xs w-44"
                  />
                </div>
              </div>
              <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setNewDSR({})}>
                <Plus className="w-3.5 h-3.5" /> New Request
              </Button>
            </div>

            <Card className="border border-slate-200 dark:border-slate-800">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-900">
                      <TableHead className="text-xs">Player Token</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs hidden md:table-cell">Submitted</TableHead>
                      <TableHead className="text-xs">Deadline</TableHead>
                      <TableHead className="text-xs">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 6 }).map((_, j) => (
                            <TableCell key={j}><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : filteredDSRs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-slate-400 text-sm">
                          No data subject requests found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredDSRs.map(dsr => {
                        const typeConf = DSR_TYPE_CONFIG[dsr.request_type];
                        const statusConf = DSR_STATUS_CONFIG[dsr.status];
                        const TypeIcon = typeConf?.icon ?? FileText;
                        const StatusIcon = statusConf?.icon ?? Clock;
                        const overdue = isOverdue(dsr.deadline_at, dsr.status);
                        const days = daysRemaining(dsr.deadline_at);
                        return (
                          <TableRow key={dsr.id} className={cn('hover:bg-slate-50 dark:hover:bg-slate-900/50', overdue && 'bg-red-50/50 dark:bg-red-950/20')}>
                            <TableCell>
                              <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                                {dsr.player_token.substring(0, 20)}...
                              </code>
                            </TableCell>
                            <TableCell>
                              <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border font-medium', typeConf?.color)}>
                                <TypeIcon className="w-3 h-3" />
                                {typeConf?.label ?? dsr.request_type}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className={cn('flex items-center gap-1 text-xs font-medium', statusConf?.color)}>
                                <StatusIcon className="w-3.5 h-3.5" />
                                {statusConf?.label}
                              </span>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-xs text-slate-500">
                              {new Date(dsr.submitted_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              {dsr.deadline_at ? (
                                <span className={cn('text-xs font-medium', overdue ? 'text-red-600' : days !== null && days <= 5 ? 'text-amber-600' : 'text-slate-500')}>
                                  {overdue ? `${Math.abs(days ?? 0)}d overdue` : days !== null ? `${days}d left` : '—'}
                                </span>
                              ) : '—'}
                            </TableCell>
                            <TableCell>
                              {dsr.status === 'pending' && (
                                <div className="flex gap-1">
                                  <Button variant="outline" size="sm" className="h-6 text-xs px-2"
                                    onClick={() => handleUpdateDSRStatus(dsr.id, 'in_progress')}>Start</Button>
                                  <Button variant="outline" size="sm" className="h-6 text-xs px-2"
                                    onClick={() => handleUpdateDSRStatus(dsr.id, 'completed')}>Complete</Button>
                                </div>
                              )}
                              {dsr.status === 'in_progress' && (
                                <Button variant="outline" size="sm" className="h-6 text-xs px-2"
                                  onClick={() => handleUpdateDSRStatus(dsr.id, 'completed')}>Complete</Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── RETENTION TAB ─────────────────────────────── */}
          <TabsContent value="retention">
            <Card className="border border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="w-4 h-4 text-slate-500" />
                  Data Retention Schedule
                </CardTitle>
                <CardDescription className="text-xs">
                  Retention periods set in accordance with FICA, POPIA, NGA, ISO 27001, and GDPR requirements.
                  Anonymisation replaces deletion where legally permissible.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-900">
                      <TableHead className="text-xs">Data Category</TableHead>
                      <TableHead className="text-xs">Retention Period</TableHead>
                      <TableHead className="text-xs hidden md:table-cell">Legal Basis</TableHead>
                      <TableHead className="text-xs hidden lg:table-cell">Regulation</TableHead>
                      <TableHead className="text-xs">Auto-Delete</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {policies.map(p => {
                      const years = Math.round(p.retention_days / 365 * 10) / 10;
                      return (
                        <TableRow key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                          <TableCell>
                            <div>
                              <p className="text-sm font-medium text-slate-900 dark:text-white capitalize">
                                {p.data_category.replace(/_/g, ' ')}
                              </p>
                              {p.policy_name && <p className="text-xs text-slate-400">{p.policy_name}</p>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-semibold text-slate-900 dark:text-white">
                              {years} {years === 1 ? 'year' : 'years'}
                            </span>
                            <span className="text-xs text-slate-400 ml-1">({p.retention_days} days)</span>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-xs text-slate-500">{p.legal_basis ?? '—'}</TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {p.regulatory_reference ? (
                              <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{p.regulatory_reference}</code>
                            ) : '—'}
                          </TableCell>
                          <TableCell>
                            <span className={cn('text-xs font-medium', p.auto_delete_enabled ? 'text-red-600' : 'text-slate-400')}>
                              {p.auto_delete_enabled ? 'Enabled' : 'Manual'}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Privacy-by-Design Statement */}
            <div className="mt-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 p-4">
              <div className="flex gap-3">
                <Lock className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">Privacy-by-Design Implementation</p>
                  <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
                    <li>No raw personal identity data stored — all player references use pseudonymised PTOKEN identifiers</li>
                    <li>Email addresses masked in display layer using <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">mask_email()</code> database function</li>
                    <li>IP addresses stored as SHA-256 hashes only — never in plaintext</li>
                    <li>API tokens stored as SHA-256 hashes — plaintext shown once at creation, never persisted</li>
                    <li>All data access subject to Row Level Security — operators see only their own data</li>
                    <li>Cross-operator intelligence uses anonymised aggregate signals, not individual records</li>
                  </ul>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── ROPA TAB ──────────────────────────────────── */}
          <TabsContent value="ropa">
            <Card className="border border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-500" />
                  Record of Processing Activities
                </CardTitle>
                <CardDescription className="text-xs">
                  GDPR Article 30 — Register of all data processing activities. Maintained per operator.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-900">
                      <TableHead className="text-xs">Activity</TableHead>
                      <TableHead className="text-xs">Purpose</TableHead>
                      <TableHead className="text-xs hidden md:table-cell">Legal Basis</TableHead>
                      <TableHead className="text-xs hidden lg:table-cell">Retention</TableHead>
                      <TableHead className="text-xs">3rd Country</TableHead>
                      <TableHead className="text-xs">DPO Review</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ropa.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-slate-400 text-sm">
                          No ROPA entries found
                        </TableCell>
                      </TableRow>
                    ) : (
                      ropa.map(r => (
                        <TableRow key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                          <TableCell>
                            <p className="text-sm font-medium text-slate-900 dark:text-white">{r.activity_name}</p>
                            {r.data_categories?.length > 0 && (
                              <div className="flex gap-1 mt-1 flex-wrap">
                                {r.data_categories.slice(0, 2).map(dc => (
                                  <span key={dc} className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-400">{dc}</span>
                                ))}
                                {r.data_categories.length > 2 && <span className="text-xs text-slate-400">+{r.data_categories.length - 2}</span>}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600 dark:text-slate-400 max-w-xs">
                            {r.purpose}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-xs text-slate-500">{r.legal_basis}</TableCell>
                          <TableCell className="hidden lg:table-cell text-xs text-slate-500">{r.retention_period ?? '—'}</TableCell>
                          <TableCell>
                            <span className={cn('text-xs font-medium', r.third_country ? 'text-amber-600' : 'text-slate-400')}>
                              {r.third_country ? 'Yes' : 'No'}
                            </span>
                          </TableCell>
                          <TableCell>
                            {r.dpo_reviewed ? (
                              <span className="flex items-center gap-1 text-xs text-emerald-600">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {r.dpo_reviewed_at ? new Date(r.dpo_reviewed_at).toLocaleDateString() : 'Yes'}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-amber-600">
                                <Clock className="w-3.5 h-3.5" /> Pending
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* New DSR Dialog */}
      <Dialog open={!!newDSR} onOpenChange={open => !open && setNewDSR(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserX className="w-4 h-4" /> New Data Subject Request
            </DialogTitle>
          </DialogHeader>
          {newDSR && (
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Request Type *</label>
                <Select onValueChange={v => setNewDSR({ ...newDSR, request_type: v })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select type..." /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DSR_TYPE_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Player Token *</label>
                <Input
                  className="h-9 text-sm font-mono"
                  placeholder="PTOKEN-XXXXXXX-XXXXXXXX"
                  onChange={e => setNewDSR({ ...newDSR, player_token: e.target.value })}
                />
                <p className="text-xs text-slate-400">Pseudonymised player token — no personal data required</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Notes</label>
                <textarea
                  className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-400"
                  rows={3}
                  placeholder="Request context and details..."
                  onChange={e => setNewDSR({ ...newDSR, notes: e.target.value })}
                />
              </div>
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
                <p className="text-xs text-amber-700 dark:text-amber-300 flex items-start gap-1.5">
                  <Calendar className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  30-day response deadline will be set automatically (GDPR Art. 12 / POPIA s.23)
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setNewDSR(null)}>Cancel</Button>
                <Button size="sm" onClick={handleCreateDSR} disabled={saving || !newDSR.request_type || !newDSR.player_token}>
                  {saving ? 'Creating...' : 'Create Request'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
