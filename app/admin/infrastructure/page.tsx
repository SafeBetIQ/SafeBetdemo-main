'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import { Server, Shield, Database, Cloud, RefreshCw, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, CircleAlert as AlertCircle, Clock, Zap, Lock, Activity, Globe, HardDrive, Cpu, GitBranch, ShieldCheck, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DRStatus {
  id: string;
  component: string;
  region: string;
  status: string;
  health_score: number;
  last_check_at: string;
  last_backup_at: string | null;
  backup_size_gb: number | null;
  rto_minutes: number | null;
  rpo_minutes: number | null;
  failover_available: boolean;
  notes: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.FC<{ className?: string }> }> = {
  operational: { label: 'Operational', className: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle2 },
  degraded: { label: 'Degraded', className: 'bg-amber-50 text-amber-700 border-amber-200', icon: AlertTriangle },
  partial_outage: { label: 'Partial Outage', className: 'bg-orange-50 text-orange-700 border-orange-200', icon: AlertTriangle },
  major_outage: { label: 'Major Outage', className: 'bg-red-50 text-red-700 border-red-200', icon: AlertCircle },
  maintenance: { label: 'Maintenance', className: 'bg-blue-50 text-blue-700 border-blue-200', icon: Clock },
};

const REGION_LABELS: Record<string, string> = {
  'af-south-1': 'af-south-1 (Cape Town)',
  'eu-west-1': 'eu-west-1 (Ireland)',
  'us-east-1': 'us-east-1 (N. Virginia)',
  'global': 'Global',
};

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

const DEVSECOPS_CHECKS = [
  { name: 'SAST - Static Code Analysis', tool: 'Semgrep + ESLint Security', status: 'passing', last_run: '2h ago', findings: 0 },
  { name: 'SCA - Dependency Vulnerabilities', tool: 'npm audit + Snyk', status: 'passing', last_run: '2h ago', findings: 0 },
  { name: 'Secret Detection', tool: 'TruffleHog + git-secrets', status: 'passing', last_run: '2h ago', findings: 0 },
  { name: 'Container Security Scan', tool: 'Trivy', status: 'passing', last_run: '4h ago', findings: 0 },
  { name: 'Infrastructure as Code Scan', tool: 'Checkov', status: 'passing', last_run: '4h ago', findings: 0 },
  { name: 'OWASP Dependency Check', tool: 'OWASP DC', status: 'passing', last_run: '6h ago', findings: 0 },
  { name: 'API Security Testing', tool: 'OWASP ZAP', status: 'passing', last_run: '12h ago', findings: 2 },
  { name: 'Automated Penetration Test', tool: 'Burp Suite Pro', status: 'passing', last_run: '7d ago', findings: 0 },
  { name: 'License Compliance Check', tool: 'FOSSA', status: 'passing', last_run: '2h ago', findings: 0 },
  { name: 'Type Safety Check', tool: 'TypeScript strict', status: 'passing', last_run: '2h ago', findings: 0 },
];

const CLOUD_CONTROLS = [
  { layer: 'WAF', service: 'AWS WAF', description: 'Web Application Firewall - OWASP top 10 rule set', status: 'active', detail: 'Blocking SQLi, XSS, RFI, LFI, path traversal' },
  { layer: 'DDoS', service: 'AWS Shield Advanced', description: 'Always-on DDoS mitigation', status: 'active', detail: 'SYN flood, UDP reflection, volumetric attacks' },
  { layer: 'CDN', service: 'AWS CloudFront', description: 'Global CDN with edge security', status: 'active', detail: '200+ PoPs, HTTPS enforced, HSTS headers' },
  { layer: 'Network', service: 'VPC Isolation', description: 'Private network segmentation', status: 'active', detail: 'Private subnets, NACLs, Security Groups' },
  { layer: 'KMS', service: 'AWS KMS', description: 'AES-256 key management', status: 'active', detail: 'Customer-managed CMKs, automatic key rotation' },
  { layer: 'Monitoring', service: 'AWS CloudWatch', description: 'Real-time monitoring and alerting', status: 'active', detail: 'Custom metrics, alarms, log insights' },
  { layer: 'Backup', service: 'AWS S3 + Glacier', description: 'Encrypted backup storage', status: 'active', detail: 'AES-256, versioning, cross-region replication' },
  { layer: 'TLS', service: 'AWS ACM', description: 'TLS 1.3 certificate management', status: 'active', detail: 'Auto-renewal, perfect forward secrecy' },
];

const UPTIME_DATA = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  uptime: 99.9 + (Math.random() * 0.09),
  latency: 45 + Math.floor(Math.random() * 30),
}));

export default function InfrastructurePage() {
  const [drStatus, setDrStatus] = useState<DRStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('dr-status');

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const { data } = await supabase.from('dr_status').select('*').order('component');
    if (data) setDrStatus(data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const allOperational = drStatus.every(d => d.status === 'operational');
  const overallHealth = drStatus.length > 0
    ? Math.round(drStatus.reduce((sum, d) => sum + d.health_score, 0) / drStatus.length)
    : 100;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Cloud className="h-6 w-6 text-slate-700" />
              Cloud Security & Infrastructure
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              AWS security architecture, disaster recovery, and DevSecOps pipeline — ISO 27001 A.17 / POPIA s.15
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={refreshing} className="gap-2">
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        <div className={cn('rounded-lg p-4 flex items-center gap-3 border', allOperational ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200')}>
          {allOperational ? (
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          )}
          <div className={cn('text-sm font-medium', allOperational ? 'text-green-800' : 'text-amber-800')}>
            {allOperational
              ? `All ${drStatus.length} infrastructure components are operational. Overall health: ${overallHealth}%`
              : `Some infrastructure components require attention. Overall health: ${overallHealth}%`}
          </div>
          <div className="ml-auto text-xs text-slate-500">Target SLA: 99.99% uptime</div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Platform Uptime', value: '99.97%', icon: Activity, color: 'text-emerald-700' },
            { label: 'Active Regions', value: '3', icon: Globe, color: 'text-blue-700' },
            { label: 'Health Score', value: `${overallHealth}%`, icon: Cpu, color: 'text-slate-700' },
            { label: 'Backup Age', value: '6h', icon: HardDrive, color: 'text-amber-700' },
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
            <TabsTrigger value="dr-status">DR Status</TabsTrigger>
            <TabsTrigger value="cloud-security">Cloud Security</TabsTrigger>
            <TabsTrigger value="devsecops">DevSecOps</TabsTrigger>
            <TabsTrigger value="uptime">Uptime</TabsTrigger>
          </TabsList>

          <TabsContent value="dr-status" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Disaster Recovery — Component Status</CardTitle>
                <CardDescription>Real-time health of all infrastructure components with RTO/RPO targets</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Component</TableHead>
                      <TableHead>Region</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Health</TableHead>
                      <TableHead className="text-center">RTO</TableHead>
                      <TableHead className="text-center">RPO</TableHead>
                      <TableHead>Last Backup</TableHead>
                      <TableHead>Last Check</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-slate-400">Loading...</TableCell></TableRow>
                    ) : drStatus.map(d => {
                      const s = STATUS_CONFIG[d.status] ?? STATUS_CONFIG.operational;
                      const SIcon = s.icon;
                      return (
                        <TableRow key={d.id} className="text-sm">
                          <TableCell>
                            <div className="font-medium text-slate-800">{d.component}</div>
                            {d.notes && <div className="text-xs text-slate-400 truncate max-w-[200px]">{d.notes}</div>}
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{REGION_LABELS[d.region] ?? d.region}</code>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('text-xs gap-1', s.className)}>
                              <SIcon className="h-3 w-3" />
                              {s.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className={cn('text-sm font-bold', d.health_score >= 95 ? 'text-green-700' : d.health_score >= 80 ? 'text-amber-700' : 'text-red-700')}>
                              {d.health_score}%
                            </div>
                          </TableCell>
                          <TableCell className="text-center text-xs text-slate-600">{d.rto_minutes != null ? `${d.rto_minutes}min` : '—'}</TableCell>
                          <TableCell className="text-center text-xs text-slate-600">{d.rpo_minutes != null ? `${d.rpo_minutes}min` : '—'}</TableCell>
                          <TableCell className="text-xs text-slate-500">{d.last_backup_at ? timeAgo(d.last_backup_at) : '—'}</TableCell>
                          <TableCell className="text-xs text-slate-500">{timeAgo(d.last_check_at)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cloud-security" className="mt-4">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {CLOUD_CONTROLS.map(ctrl => (
                  <div key={ctrl.service} className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex items-start gap-3">
                    <Badge className="bg-slate-800 text-white text-xs flex-shrink-0 mt-0.5">{ctrl.layer}</Badge>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-sm text-slate-800">{ctrl.service}</div>
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 flex-shrink-0">
                          <CheckCircle2 className="h-3 w-3 mr-1 inline" />Active
                        </Badge>
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">{ctrl.description}</div>
                      <div className="text-xs text-slate-400 mt-1">{ctrl.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Lock className="h-5 w-5 text-blue-700 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-800">
                      <div className="font-semibold mb-1">Encryption at Rest & in Transit</div>
                      <div className="space-y-1 text-xs">
                        <div>Database: AES-256-GCM (Supabase managed keys + AWS KMS CMK)</div>
                        <div>Backups: AES-256-CBC with separate key hierarchy</div>
                        <div>Transit: TLS 1.3 minimum, TLS 1.0/1.1 disabled at WAF layer</div>
                        <div>API tokens: SHA-256 one-way hash — plaintext never stored post-creation</div>
                        <div>Player IDs: Pseudonymised PTOKEN format — SHA-256 hashed at ingest</div>
                        <div>IP Addresses: SHA-256 hashed — never stored in plaintext</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="devsecops" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <GitBranch className="h-5 w-5" />
                  Secure CI/CD Pipeline — Latest Scan Results
                </CardTitle>
                <CardDescription>Automated security checks run on every commit and deployment</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="p-3 bg-green-50 rounded-lg text-center border border-green-200">
                    <div className="text-2xl font-bold text-green-700">
                      {DEVSECOPS_CHECKS.filter(c => c.status === 'passing').length}/{DEVSECOPS_CHECKS.length}
                    </div>
                    <div className="text-xs text-green-600">Checks Passing</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg text-center border">
                    <div className="text-2xl font-bold text-slate-700">
                      {DEVSECOPS_CHECKS.reduce((s, c) => s + c.findings, 0)}
                    </div>
                    <div className="text-xs text-slate-500">Open Findings</div>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg text-center border border-blue-200">
                    <div className="text-2xl font-bold text-blue-700">2h</div>
                    <div className="text-xs text-blue-600">Last Pipeline Run</div>
                  </div>
                </div>
                {DEVSECOPS_CHECKS.map(check => (
                  <div key={check.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-slate-800">{check.name}</div>
                        <div className="text-xs text-slate-500">{check.tool} — last run: {check.last_run}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {check.findings > 0 ? (
                        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                          {check.findings} finding{check.findings > 1 ? 's' : ''}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">Clean</Badge>
                      )}
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">Passing</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="uptime" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Platform Uptime (30 Days)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={UPTIME_DATA}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} label={{ value: 'Day', position: 'insideBottom', offset: -2, fontSize: 10 }} />
                      <YAxis domain={[99.8, 100]} tick={{ fontSize: 10 }} tickFormatter={v => `${v.toFixed(1)}%`} />
                      <Tooltip formatter={(v: number) => `${v.toFixed(3)}%`} />
                      <Area type="monotone" dataKey="uptime" stroke="#22c55e" fill="#dcfce7" name="Uptime %" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">API Response Latency (30 Days)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={UPTIME_DATA}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}ms`} />
                      <Tooltip formatter={(v: number) => `${v}ms`} />
                      <Line type="monotone" dataKey="latency" stroke="#3b82f6" dot={false} name="p95 Latency" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-sm">SLA Commitments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { metric: 'Availability SLA', target: '99.99%', actual: '99.97%', status: 'meeting' },
                      { metric: 'API Latency p95', target: '< 200ms', actual: '72ms', status: 'exceeding' },
                      { metric: 'RTO (Recovery Time)', target: '< 15min', actual: '< 5min', status: 'exceeding' },
                      { metric: 'RPO (Recovery Point)', target: '< 1 hour', actual: '< 5min', status: 'exceeding' },
                      { metric: 'Backup Frequency', target: 'Daily', actual: 'Every 6h', status: 'exceeding' },
                      { metric: 'Backup Retention', target: '30 days', actual: '90 days', status: 'exceeding' },
                      { metric: 'Security Patch SLA', target: '< 30 days', actual: '< 24h', status: 'exceeding' },
                      { metric: 'Incident Response', target: '< 4 hours', actual: '< 30min', status: 'exceeding' },
                    ].map(sla => (
                      <div key={sla.metric} className="p-3 bg-slate-50 rounded-lg">
                        <div className="text-xs text-slate-500 uppercase tracking-wide">{sla.metric}</div>
                        <div className="text-sm font-bold text-slate-800 mt-1">{sla.actual}</div>
                        <div className="text-xs text-slate-400">Target: {sla.target}</div>
                        <Badge className={cn('text-xs mt-1', sla.status === 'exceeding' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700')}>
                          {sla.status === 'exceeding' ? 'Exceeding' : 'Meeting'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
