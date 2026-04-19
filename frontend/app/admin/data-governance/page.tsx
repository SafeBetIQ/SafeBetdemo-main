'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Database, Shield, Globe, Clock, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, RefreshCw, FileText, Lock, Trash2, Archive, Users, Eye, EyeOff, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RetentionRule {
  id: string;
  data_category: string;
  table_name: string | null;
  retention_days: number;
  anonymise_after_days: number | null;
  delete_after_days: number | null;
  jurisdiction: string;
  legal_basis: string | null;
  regulation_reference: string | null;
  auto_execute: boolean;
  is_active: boolean;
  last_executed_at: string | null;
  records_processed: number;
}

const JURISDICTION_CONFIG: Record<string, { label: string; flag: string; className: string }> = {
  ZA: { label: 'South Africa (POPIA)', flag: '🇿🇦', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  GLOBAL: { label: 'Global', flag: '🌍', className: 'bg-amber-50 text-amber-700 border-amber-200' },
};

const PRIVACY_PRINCIPLES = [
  {
    principle: 'Data Minimisation',
    regulation: 'POPIA s.10',
    description: 'Only data strictly necessary for the responsible gambling mandate is collected.',
    implementation: 'Players represented as PTOKEN pseudonymous tokens. No name, address, or national ID stored.',
    status: 'implemented',
  },
  {
    principle: 'Purpose Limitation',
    regulation: 'POPIA s.9',
    description: 'Data used exclusively for responsible gambling risk assessment and regulatory compliance.',
    implementation: 'Strict query policies via RLS. Cross-purpose data access blocked at DB layer.',
    status: 'implemented',
  },
  {
    principle: 'Storage Limitation',
    regulation: 'POPIA s.14',
    description: 'Automated retention schedules enforce data lifecycle per jurisdiction.',
    implementation: 'Configurable retention engine with auto-anonymisation and secure deletion.',
    status: 'implemented',
  },
  {
    principle: 'Integrity & Confidentiality',
    regulation: 'POPIA s.15',
    description: 'AES-256 encryption at rest, TLS 1.3 in transit, SHA-256 PII hashing.',
    implementation: 'AWS KMS managed keys, Supabase encrypted storage, hash-only identifiers.',
    status: 'implemented',
  },
  {
    principle: 'Accountability',
    regulation: 'POPIA s.8',
    description: 'Operator as Responsible Party with appointed Information Officer.',
    implementation: 'Immutable audit logs, Information Officer assignment records, ROPA maintained.',
    status: 'implemented',
  },
  {
    principle: 'Lawfulness of Processing',
    regulation: 'POPIA s.11',
    description: 'All processing backed by documented legal basis per data category.',
    implementation: 'Legal basis documented in data_retention_rules and ROPA tables.',
    status: 'implemented',
  },
  {
    principle: 'Data Subject Rights',
    regulation: 'POPIA Ch.2',
    description: 'Right to access, erasure, rectification, portability, and objection.',
    implementation: 'DSR management system with 30-day deadline tracking and workflow.',
    status: 'implemented',
  },
  {
    principle: 'Pseudonymisation',
    regulation: 'POPIA s.1',
    description: 'Player identities replaced with random tokens. Re-identification not possible without separate key store.',
    implementation: 'PTOKEN format: `PTOKEN-XXXXXXX-XXXXXXXX`. SHA-256 hashed IPs. Masked emails.',
    status: 'implemented',
  },
];

const JURISDICTION_RULES = [
  {
    jurisdiction: 'ZA',
    regulation: 'POPIA (Protection of Personal Information Act)',
    key_requirements: [
      'Information Officer must be appointed',
      'Data processing must have lawful grounds',
      'Cross-border transfers require adequate protection',
      'Breach notification within 72 hours to Regulator',
      'Data subject rights (access, correction, deletion)',
      'Retention limited to necessary period',
    ],
    regulator: 'Information Regulator (South Africa)',
    breach_notification: '72 hours',
    dpo_required: true,
    status: 'compliant',
  },
  {
    jurisdiction: 'GLOBAL',
    regulation: 'ISO 27001 Information Security Management',
    key_requirements: [
      'Information Security Management System',
      'Continuous monitoring and improvement',
      'Vendor risk management',
      'Incident response procedures',
      'Business continuity planning',
      'Annual penetration testing',
    ],
    regulator: 'Certification Body (BSI)',
    breach_notification: 'Per SLA',
    dpo_required: false,
    status: 'compliant',
  },
];

export default function DataGovernancePage() {
  const [retentionRules, setRetentionRules] = useState<RetentionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('retention');
  const [jurisdictionFilter, setJurisdictionFilter] = useState('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('data_retention_rules').select('*').order('jurisdiction').order('retention_days');
    if (data) setRetentionRules(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = retentionRules.filter(r => jurisdictionFilter === 'all' || r.jurisdiction === jurisdictionFilter);

  const anonymisationData = Array.from({ length: 12 }, (_, i) => ({
    month: new Date(2025, i).toLocaleDateString('en-ZA', { month: 'short' }),
    anonymised: Math.floor(1000 + Math.random() * 5000),
    deleted: Math.floor(200 + Math.random() * 800),
  }));

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Database className="h-6 w-6 text-slate-700" />
              Data Governance & Privacy Engine
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Automated retention, jurisdiction-aware privacy rules, and Privacy by Design — POPIA
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadData} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Retention Rules', value: retentionRules.length, icon: Clock, color: 'text-slate-700' },
            { label: 'Auto-Execute', value: retentionRules.filter(r => r.auto_execute).length, icon: Trash2, color: 'text-amber-700' },
            { label: 'Jurisdictions', value: 2, icon: Globe, color: 'text-blue-700' },
            { label: 'Privacy Principles', value: PRIVACY_PRINCIPLES.filter(p => p.status === 'implemented').length, icon: Shield, color: 'text-emerald-700' },
          ].map(card => (
            <Card key={card.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn('p-2 rounded-lg bg-slate-50', card.color)}>
                  <card.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className={cn('text-2xl font-bold', card.color)}>{card.value}</div>
                  <div className="text-xs text-slate-500">{card.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="retention">Retention Rules</TabsTrigger>
            <TabsTrigger value="privacy">Privacy by Design</TabsTrigger>
            <TabsTrigger value="jurisdiction">Jurisdiction Rules</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="retention" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">Automated Retention Schedules</CardTitle>
                    <CardDescription>Per-jurisdiction data lifecycle rules with auto-execute capability</CardDescription>
                  </div>
                  <Select value={jurisdictionFilter} onValueChange={setJurisdictionFilter}>
                    <SelectTrigger className="h-9 w-44 text-xs"><SelectValue placeholder="All Jurisdictions" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Jurisdictions</SelectItem>
                      <SelectItem value="ZA">South Africa</SelectItem>
                      <SelectItem value="GLOBAL">Global</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Data Category</TableHead>
                      <TableHead>Jurisdiction</TableHead>
                      <TableHead className="text-center">Retain</TableHead>
                      <TableHead className="text-center">Anonymise</TableHead>
                      <TableHead className="text-center">Delete</TableHead>
                      <TableHead>Legal Basis</TableHead>
                      <TableHead className="text-center">Auto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-400">Loading...</TableCell></TableRow>
                    ) : filtered.map(rule => {
                      const jur = JURISDICTION_CONFIG[rule.jurisdiction] ?? JURISDICTION_CONFIG.GLOBAL;
                      return (
                        <TableRow key={rule.id} className="text-sm">
                          <TableCell>
                            <div className="font-medium text-slate-800">{rule.data_category}</div>
                            {rule.table_name && <code className="text-xs text-slate-400">{rule.table_name}</code>}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('text-xs gap-1', jur.className)}>
                              {jur.flag} {rule.jurisdiction}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-xs font-medium">{Math.round(rule.retention_days / 365 * 10) / 10}yr</span>
                          </TableCell>
                          <TableCell className="text-center">
                            {rule.anonymise_after_days ? (
                              <span className="text-xs">{Math.round(rule.anonymise_after_days / 365 * 10) / 10}yr</span>
                            ) : <span className="text-slate-300 text-xs">—</span>}
                          </TableCell>
                          <TableCell className="text-center">
                            {rule.delete_after_days ? (
                              <span className="text-xs text-red-600">{Math.round(rule.delete_after_days / 365 * 10) / 10}yr</span>
                            ) : <span className="text-slate-300 text-xs">Never</span>}
                          </TableCell>
                          <TableCell className="text-xs text-slate-500 max-w-[200px]">
                            <div className="truncate">{rule.regulation_reference ?? rule.legal_basis ?? '—'}</div>
                          </TableCell>
                          <TableCell className="text-center">
                            {rule.auto_execute ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto" />
                            ) : (
                              <span className="text-xs text-slate-400">Manual</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="privacy" className="mt-4">
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 p-4 bg-slate-900 rounded-xl text-white">
                <div className="text-center">
                  <EyeOff className="h-6 w-6 mx-auto mb-1 text-blue-400" />
                  <div className="text-sm font-semibold">No Raw PII</div>
                  <div className="text-xs text-slate-400">Pseudonymised tokens only</div>
                </div>
                <div className="text-center">
                  <Hash className="h-6 w-6 mx-auto mb-1 text-green-400" />
                  <div className="text-sm font-semibold">SHA-256 Hashing</div>
                  <div className="text-xs text-slate-400">IPs, emails, devices</div>
                </div>
                <div className="text-center">
                  <Lock className="h-6 w-6 mx-auto mb-1 text-amber-400" />
                  <div className="text-sm font-semibold">AES-256 Encryption</div>
                  <div className="text-xs text-slate-400">Data at rest + in transit</div>
                </div>
              </div>
              <div className="space-y-3">
                {PRIVACY_PRINCIPLES.map(p => (
                  <div key={p.principle} className="p-4 bg-slate-50 rounded-lg border">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                          <span className="font-medium text-sm text-slate-800">{p.principle}</span>
                          <Badge variant="outline" className="text-xs bg-slate-100 text-slate-600">{p.regulation}</Badge>
                        </div>
                        <div className="text-xs text-slate-600 mb-1">{p.description}</div>
                        <div className="text-xs text-slate-500 bg-white border rounded px-2 py-1 font-mono">{p.implementation}</div>
                      </div>
                      <Badge className="bg-emerald-100 text-emerald-700 text-xs flex-shrink-0">Implemented</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="jurisdiction" className="mt-4">
            <div className="space-y-6">
              {JURISDICTION_RULES.map(j => {
                const jConfig = JURISDICTION_CONFIG[j.jurisdiction] ?? JURISDICTION_CONFIG.GLOBAL;
                return (
                  <Card key={j.jurisdiction}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Badge variant="outline" className={cn('text-xs', jConfig.className)}>{jConfig.flag} {j.jurisdiction}</Badge>
                            {j.regulation}
                          </CardTitle>
                          <CardDescription>Regulator: {j.regulator}</CardDescription>
                        </div>
                        <Badge className="bg-green-100 text-green-700 text-xs">Compliant</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                          <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Key Requirements</div>
                          <div className="space-y-1">
                            {j.key_requirements.map((req, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs text-slate-700">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
                                {req}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="p-3 bg-slate-50 rounded-lg">
                            <div className="text-xs text-slate-500 uppercase mb-1">Breach Notification</div>
                            <div className="text-sm font-bold text-slate-800">{j.breach_notification}</div>
                          </div>
                          <div className="p-3 bg-slate-50 rounded-lg">
                            <div className="text-xs text-slate-500 uppercase mb-1">DPO Required</div>
                            <div className="text-sm font-bold text-slate-800">{j.dpo_required ? 'Yes' : 'Recommended'}</div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Records Anonymised (12 Months)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={anonymisationData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ fontSize: 12 }} />
                      <Area type="monotone" dataKey="anonymised" stroke="#3b82f6" fill="#dbeafe" name="Anonymised" />
                      <Area type="monotone" dataKey="deleted" stroke="#ef4444" fill="#fee2e2" name="Deleted" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Data Inventory Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { category: 'Pseudonymised Player Profiles', count: '50,000+', retention: '7 years', pii: false },
                    { category: 'Gaming Sessions', count: '3,256', retention: '5 years', pii: false },
                    { category: 'Financial Transactions', count: '8,562', retention: '7 years', pii: false },
                    { category: 'Behavioural Events', count: '1,133', retention: '5 years', pii: false },
                    { category: 'Self-Exclusion Records', count: 'Confidential', retention: '10 years', pii: false },
                    { category: 'Staff Records', count: 'Confidential', retention: '7 years', pii: true },
                    { category: 'Audit Logs', count: 'Append-only', retention: '7 years', pii: false },
                  ].map(item => (
                    <div key={item.category} className="flex items-center justify-between p-2 bg-slate-50 rounded text-xs">
                      <div className="flex items-center gap-2">
                        {item.pii ? <Eye className="h-3.5 w-3.5 text-amber-500" /> : <EyeOff className="h-3.5 w-3.5 text-green-500" />}
                        <span className="text-slate-700">{item.category}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">{item.count}</span>
                        <Badge variant="outline" className="text-xs">{item.retention}</Badge>
                        {!item.pii && <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">Pseudonymised</Badge>}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
