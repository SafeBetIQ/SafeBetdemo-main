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
import { Progress } from '@/components/ui/progress';
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
import { ShieldCheck, ShieldAlert, Shield, CircleCheck as CheckCircle2, Circle as XCircle, TriangleAlert as AlertTriangle, Clock, CircleMinus as MinusCircle, Search, ChevronDown, ChevronUp, FileText, ChartBar as BarChart2, Lock, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Framework {
  id: string;
  code: string;
  full_name: string;
  jurisdiction: string;
  version: string;
}

interface Control {
  id: string;
  framework_id: string;
  casino_id: string;
  control_id: string;
  control_name: string;
  category: string;
  description: string;
  status: 'not_assessed' | 'compliant' | 'non_compliant' | 'partial' | 'not_applicable' | 'in_progress';
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  owner_email: string | null;
  evidence_notes: string | null;
  last_assessed: string | null;
  next_review: string | null;
}

interface Casino {
  id: string;
  name: string;
}

const STATUS_CONFIG = {
  not_assessed:   { label: 'Not Assessed',   icon: Clock,        color: 'text-slate-400',  bg: 'bg-slate-50 dark:bg-slate-900',   badge: 'secondary' },
  compliant:      { label: 'Compliant',       icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950', badge: 'default' },
  non_compliant:  { label: 'Non-Compliant',   icon: XCircle,      color: 'text-red-600',    bg: 'bg-red-50 dark:bg-red-950',       badge: 'destructive' },
  partial:        { label: 'Partial',         icon: AlertTriangle,color: 'text-amber-600',  bg: 'bg-amber-50 dark:bg-amber-950',   badge: 'secondary' },
  not_applicable: { label: 'N/A',             icon: MinusCircle,  color: 'text-slate-400',  bg: 'bg-slate-50 dark:bg-slate-900',   badge: 'outline' },
  in_progress:    { label: 'In Progress',     icon: Clock,        color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-950',     badge: 'secondary' },
};

const RISK_CONFIG = {
  low:      { label: 'Low',      color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  medium:   { label: 'Medium',   color: 'text-amber-600 bg-amber-50 border-amber-200' },
  high:     { label: 'High',     color: 'text-orange-600 bg-orange-50 border-orange-200' },
  critical: { label: 'Critical', color: 'text-red-600 bg-red-50 border-red-200' },
};

const FRAMEWORK_ICONS: Record<string, React.ElementType> = {
  ISO27001: Lock,
  SOC2: ShieldCheck,
  GDPR: Globe,
  POPIA: Shield,
};

const FRAMEWORK_COLORS: Record<string, string> = {
  ISO27001: 'from-blue-600 to-blue-700',
  SOC2:     'from-slate-600 to-slate-700',
  GDPR:     'from-sky-600 to-sky-700',
  POPIA:    'from-teal-600 to-teal-700',
};

export default function ComplianceDashboardPage() {
  const { user } = useAuth();
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [casinos, setCasinos] = useState<Casino[]>([]);
  const [selectedCasino, setSelectedCasino] = useState<string>('all');
  const [selectedFramework, setSelectedFramework] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editControl, setEditControl] = useState<Control | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const isSuperAdmin = user?.role === 'super_admin';

  const loadData = useCallback(async () => {
    setLoading(true);
    const [{ data: fw }, { data: ctrl }, { data: cas }] = await Promise.all([
      supabase.from('compliance_frameworks').select('*').order('code'),
      supabase.from('compliance_controls').select('*').order('control_id'),
      isSuperAdmin
        ? supabase.from('casinos').select('id, name').eq('is_active', true).order('name')
        : supabase.from('casinos').select('id, name').eq('is_active', true).order('name'),
    ]);
    setFrameworks(fw ?? []);
    setControls(ctrl ?? []);
    setCasinos(cas ?? []);
    setLoading(false);
  }, [isSuperAdmin]);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredControls = controls.filter(c => {
    if (selectedCasino !== 'all' && c.casino_id !== selectedCasino) return false;
    if (selectedFramework !== 'all' && c.framework_id !== selectedFramework) return false;
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return c.control_id.toLowerCase().includes(q) || c.control_name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q);
    }
    return true;
  });

  const getFrameworkStats = (frameworkId: string) => {
    const casinoControls = selectedCasino === 'all'
      ? controls.filter(c => c.framework_id === frameworkId)
      : controls.filter(c => c.framework_id === frameworkId && c.casino_id === selectedCasino);

    const total = casinoControls.length;
    if (total === 0) return { total: 0, compliant: 0, nonCompliant: 0, partial: 0, notAssessed: 0, score: 0 };
    const compliant = casinoControls.filter(c => c.status === 'compliant').length;
    const nonCompliant = casinoControls.filter(c => c.status === 'non_compliant').length;
    const partial = casinoControls.filter(c => c.status === 'partial').length;
    const applicable = casinoControls.filter(c => c.status !== 'not_applicable').length;
    const score = applicable > 0 ? Math.round(((compliant + partial * 0.5) / applicable) * 100) : 0;
    return { total, compliant, nonCompliant, partial, notAssessed: casinoControls.filter(c => c.status === 'not_assessed').length, score };
  };

  const handleSaveControl = async () => {
    if (!editControl) return;
    setSaving(true);
    await supabase.from('compliance_controls').update({
      status: editControl.status,
      risk_level: editControl.risk_level,
      owner_email: editControl.owner_email,
      evidence_notes: editControl.evidence_notes,
      last_assessed: editControl.status !== 'not_assessed' ? new Date().toISOString() : editControl.last_assessed,
      updated_at: new Date().toISOString(),
    }).eq('id', editControl.id);
    setSaving(false);
    setEditControl(null);
    loadData();
  };

  const overallScore = (() => {
    const applicable = controls.filter(c => c.status !== 'not_applicable' && (selectedCasino === 'all' || c.casino_id === selectedCasino));
    if (!applicable.length) return 0;
    const scored = applicable.filter(c => c.status === 'compliant').length + applicable.filter(c => c.status === 'partial').length * 0.5;
    return Math.round((scored / applicable.length) * 100);
  })();

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-900 dark:bg-slate-100">
              <ShieldCheck className="w-5 h-5 text-white dark:text-slate-900" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Compliance Dashboard</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">ISO 27001 · SOC 2 · GDPR · POPIA control status</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          {isSuperAdmin && (
            <Select value={selectedCasino} onValueChange={setSelectedCasino}>
              <SelectTrigger className="w-48 h-9 text-sm">
                <SelectValue placeholder="All Operators" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Operators</SelectItem>
                {casinos.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={selectedFramework} onValueChange={setSelectedFramework}>
            <SelectTrigger className="w-40 h-9 text-sm">
              <SelectValue placeholder="All Frameworks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Frameworks</SelectItem>
              {frameworks.map(f => <SelectItem key={f.id} value={f.id}>{f.code}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 h-9 text-sm">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search controls..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
        </div>

        {/* Overall Score Banner */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-900 to-slate-800 p-5 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">Overall Compliance Score</p>
            <p className="text-4xl font-bold text-white mt-1">{overallScore}%</p>
            <p className="text-slate-400 text-sm mt-1">
              {controls.filter(c => c.status === 'compliant' && (selectedCasino === 'all' || c.casino_id === selectedCasino)).length} compliant of{' '}
              {controls.filter(c => c.status !== 'not_applicable' && (selectedCasino === 'all' || c.casino_id === selectedCasino)).length} applicable controls
            </p>
          </div>
          <div className="text-right hidden sm:block">
            <div className="flex gap-4">
              {[
                { label: 'Compliant',    value: controls.filter(c => c.status === 'compliant'     && (selectedCasino === 'all' || c.casino_id === selectedCasino)).length, color: 'text-emerald-400' },
                { label: 'Non-Compliant',value: controls.filter(c => c.status === 'non_compliant' && (selectedCasino === 'all' || c.casino_id === selectedCasino)).length, color: 'text-red-400' },
                { label: 'In Progress',  value: controls.filter(c => c.status === 'in_progress'   && (selectedCasino === 'all' || c.casino_id === selectedCasino)).length, color: 'text-blue-400' },
                { label: 'Not Assessed', value: controls.filter(c => c.status === 'not_assessed'  && (selectedCasino === 'all' || c.casino_id === selectedCasino)).length, color: 'text-slate-400' },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
                  <p className="text-slate-500 text-xs">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Framework Score Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {frameworks.map(fw => {
            const stats = getFrameworkStats(fw.id);
            const Icon = FRAMEWORK_ICONS[fw.code] ?? Shield;
            const grad = FRAMEWORK_COLORS[fw.code] ?? 'from-slate-600 to-slate-700';
            return (
              <Card
                key={fw.id}
                className={cn(
                  'cursor-pointer transition-all hover:shadow-md border',
                  selectedFramework === fw.id ? 'ring-2 ring-slate-900 dark:ring-white' : 'border-slate-200 dark:border-slate-800'
                )}
                onClick={() => setSelectedFramework(selectedFramework === fw.id ? 'all' : fw.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className={cn('p-2 rounded-lg bg-gradient-to-br text-white', grad)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <Badge variant="outline" className="text-xs">{fw.jurisdiction}</Badge>
                  </div>
                  <CardTitle className="text-base mt-2">{fw.code}</CardTitle>
                  <CardDescription className="text-xs leading-snug">{fw.full_name}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div className="flex items-end justify-between">
                    <span className="text-3xl font-bold text-slate-900 dark:text-white">{stats.score}%</span>
                    <span className="text-xs text-slate-500">{stats.compliant}/{stats.total} controls</span>
                  </div>
                  <Progress value={stats.score} className="h-1.5" />
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <span className="text-emerald-600">{stats.compliant} compliant</span>
                    <span className="text-red-500">{stats.nonCompliant} failed</span>
                    <span className="text-amber-500">{stats.partial} partial</span>
                    <span className="text-slate-400">{stats.notAssessed} unassessed</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Controls Table */}
        <Card className="border border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-slate-500" />
                Controls ({filteredControls.length})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-900">
                    <TableHead className="w-24 text-xs">Control ID</TableHead>
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs hidden md:table-cell">Category</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs hidden sm:table-cell">Risk</TableHead>
                    <TableHead className="text-xs hidden lg:table-cell">Last Assessed</TableHead>
                    <TableHead className="w-16 text-xs">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 7 }).map((_, j) => (
                          <TableCell key={j}><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : filteredControls.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                        No controls match your filters
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredControls.map(ctrl => {
                      const s = STATUS_CONFIG[ctrl.status];
                      const r = RISK_CONFIG[ctrl.risk_level];
                      const SIcon = s.icon;
                      return (
                        <TableRow key={ctrl.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                          <TableCell className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-400">
                            {ctrl.control_id}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm font-medium text-slate-900 dark:text-white">{ctrl.control_name}</p>
                              <p className="text-xs text-slate-400 truncate max-w-xs hidden md:block">{ctrl.description}</p>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <span className="text-xs text-slate-500">{ctrl.category}</span>
                          </TableCell>
                          <TableCell>
                            <div className={cn('flex items-center gap-1.5 text-xs font-medium', s.color)}>
                              <SIcon className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">{s.label}</span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <span className={cn('text-xs px-1.5 py-0.5 rounded border font-medium', r.color)}>
                              {r.label}
                            </span>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <span className="text-xs text-slate-400">
                              {ctrl.last_assessed ? new Date(ctrl.last_assessed).toLocaleDateString() : '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setEditControl({ ...ctrl })}
                            >
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Control Dialog */}
      <Dialog open={!!editControl} onOpenChange={open => !open && setEditControl(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {editControl?.control_id} — {editControl?.control_name}
            </DialogTitle>
          </DialogHeader>
          {editControl && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-slate-500">{editControl.description}</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Status</label>
                  <Select
                    value={editControl.status}
                    onValueChange={v => setEditControl({ ...editControl, status: v as Control['status'] })}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Risk Level</label>
                  <Select
                    value={editControl.risk_level}
                    onValueChange={v => setEditControl({ ...editControl, risk_level: v as Control['risk_level'] })}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(RISK_CONFIG).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Control Owner (email)</label>
                <Input
                  className="h-9 text-sm"
                  placeholder="owner@casino.co.za"
                  value={editControl.owner_email ?? ''}
                  onChange={e => setEditControl({ ...editControl, owner_email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Evidence Notes</label>
                <textarea
                  className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-400"
                  rows={3}
                  placeholder="Describe evidence collected or actions taken..."
                  value={editControl.evidence_notes ?? ''}
                  onChange={e => setEditControl({ ...editControl, evidence_notes: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setEditControl(null)}>Cancel</Button>
                <Button size="sm" onClick={handleSaveControl} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Control'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
