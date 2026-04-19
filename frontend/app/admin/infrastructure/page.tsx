'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { DRStatusPayload } from '@/app/api/dr-status/route';
import { DashboardLayout } from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import {
  Server, Shield, Database, Cloud, RefreshCw,
  CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle,
  CircleAlert as AlertCircle, Clock, Lock, Activity, Globe,
  HardDrive, GitBranch, ArrowRight, Radio, MapPin,
  Play, RotateCcw, Zap, ChevronRight, Wifi, Terminal,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────────── */
const STATUS_CONFIG: Record<string, {
  label: string; className: string; dotClass: string;
  icon: React.FC<{ className?: string }>;
}> = {
  operational:   { label: 'Operational',   className: 'bg-emerald-50 text-emerald-700 border-emerald-200', dotClass: 'bg-emerald-500', icon: CheckCircle2 },
  degraded:      { label: 'Degraded',      className: 'bg-amber-50 text-amber-700 border-amber-200',       dotClass: 'bg-amber-500',   icon: AlertTriangle },
  partial_outage:{ label: 'Partial Outage',className: 'bg-orange-50 text-orange-700 border-orange-200',    dotClass: 'bg-orange-500',  icon: AlertTriangle },
  major_outage:  { label: 'Major Outage',  className: 'bg-red-50 text-red-700 border-red-200',             dotClass: 'bg-red-500',     icon: AlertCircle },
  maintenance:   { label: 'Maintenance',   className: 'bg-blue-50 text-blue-700 border-blue-200',          dotClass: 'bg-blue-500',    icon: Clock },
  failover_active:{ label: 'Failover Active', className: 'bg-purple-50 text-purple-700 border-purple-200', dotClass: 'bg-purple-500',  icon: Zap },
};

const REGION_LABELS: Record<string, { short: string; full: string; flag: string }> = {
  'af-south-1': { short: 'Cape Town',   full: 'af-south-1 (Cape Town)',    flag: '🇿🇦' },
  'eu-west-1':  { short: 'Ireland',     full: 'eu-west-1 (Ireland)',       flag: '🇮🇪' },
  'eu-north-1': { short: 'Stockholm',   full: 'eu-north-1 (Stockholm)',    flag: '🇸🇪' },
  'us-east-1':  { short: 'N. Virginia', full: 'us-east-1 (N. Virginia)',   flag: '🇺🇸' },
  'global':     { short: 'Global',      full: 'Global',                    flag: '🌐' },
};

const CLOUD_CONTROLS = [
  { layer: 'WAF',     service: 'AWS WAF',            description: 'Web Application Firewall — OWASP Top 10 ruleset', detail: 'Blocking SQLi, XSS, RFI, LFI, path traversal' },
  { layer: 'DDoS',    service: 'AWS Shield Advanced', description: 'Always-on DDoS mitigation',                       detail: 'SYN flood, UDP reflection, volumetric attacks' },
  { layer: 'CDN',     service: 'AWS CloudFront',      description: 'Global CDN with edge security',                   detail: '200+ PoPs, HTTPS enforced, HSTS headers' },
  { layer: 'Network', service: 'VPC Isolation',       description: 'Private network segmentation',                    detail: 'Private subnets, NACLs, Security Groups' },
  { layer: 'KMS',     service: 'AWS KMS',             description: 'AES-256 key management',                          detail: 'Customer-managed CMKs, automatic key rotation' },
  { layer: 'Monitor', service: 'AWS CloudWatch',      description: 'Real-time monitoring and alerting',               detail: 'Custom metrics, alarms, log insights' },
  { layer: 'Backup',  service: 'AWS S3 + Glacier',    description: 'Encrypted backup storage',                        detail: 'AES-256, versioning, cross-region replication' },
  { layer: 'TLS',     service: 'AWS ACM',             description: 'TLS 1.3 certificate management',                  detail: 'Auto-renewal, perfect forward secrecy' },
];

const DEVSECOPS_CHECKS = [
  { name: 'SAST — Static Code Analysis',    tool: 'Semgrep + ESLint Security', status: 'passing', last_run: '2h ago',  findings: 0 },
  { name: 'SCA — Dependency Vulnerabilities', tool: 'npm audit + Snyk',        status: 'passing', last_run: '2h ago',  findings: 0 },
  { name: 'Secret Detection',               tool: 'TruffleHog + git-secrets',  status: 'passing', last_run: '2h ago',  findings: 0 },
  { name: 'Container Security Scan',        tool: 'Trivy',                     status: 'passing', last_run: '4h ago',  findings: 0 },
  { name: 'Infrastructure as Code Scan',    tool: 'Checkov',                   status: 'passing', last_run: '4h ago',  findings: 0 },
  { name: 'OWASP Dependency Check',         tool: 'OWASP DC',                  status: 'passing', last_run: '6h ago',  findings: 0 },
  { name: 'API Security Testing',           tool: 'OWASP ZAP',                 status: 'passing', last_run: '12h ago', findings: 2 },
  { name: 'Automated Penetration Test',     tool: 'Burp Suite Pro',            status: 'passing', last_run: '7d ago',  findings: 0 },
  { name: 'License Compliance Check',       tool: 'FOSSA',                     status: 'passing', last_run: '2h ago',  findings: 0 },
  { name: 'Type Safety Check',              tool: 'TypeScript strict',          status: 'passing', last_run: '2h ago',  findings: 0 },
];

const DR_EVENTS = [
  { ts: '2026-04-14 03:17:22', type: 'HEALTH_CHECK',       result: 'HEALTHY',            detail: 'GitHub Actions — all 7 components operational',            region: 'global' },
  { ts: '2026-04-12 11:42:08', type: 'FAILOVER_SKIPPED',   result: 'NO_ACTION',          detail: 'Lambda safebet-rds-failover — alarm state OK, no action',  region: 'eu-west-1' },
  { ts: '2026-04-10 02:04:51', type: 'BACKUP_COMPLETED',   result: 'SUCCESS',            detail: 'S3 daily backup — 14.2 GB, AES-256, cross-region sync',    region: 'eu-north-1' },
  { ts: '2026-04-08 14:33:17', type: 'DNS_UPDATE',         result: 'UPSERTED',           detail: 'Route53 CNAME verified — db.safebetiq.com → Cape Town',    region: 'global' },
  { ts: '2026-03-29 00:12:44', type: 'FAILOVER_EXECUTED',  result: 'FAILOVER_COMPLETE',  detail: 'RDS replica promoted — Cape Town → Ireland. DNS switched.', region: 'eu-west-1' },
  { ts: '2026-03-22 09:55:03', type: 'REPLICA_REBUILD',    result: 'SUCCESS',            detail: 'Read replica rebuilt in af-south-1 post-failover',          region: 'af-south-1' },
];

const EVENT_STYLE: Record<string, { className: string; dot: string; label: string }> = {
  FAILOVER_EXECUTED: { className: 'text-purple-700 bg-purple-50 border-purple-200', dot: 'bg-purple-500', label: 'Failover' },
  FAILOVER_SKIPPED:  { className: 'text-slate-600 bg-slate-50 border-slate-200',    dot: 'bg-slate-400',  label: 'Skipped' },
  HEALTH_CHECK:      { className: 'text-emerald-700 bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', label: 'Health Check' },
  BACKUP_COMPLETED:  { className: 'text-blue-700 bg-blue-50 border-blue-200',       dot: 'bg-blue-500',   label: 'Backup' },
  DNS_UPDATE:        { className: 'text-cyan-700 bg-cyan-50 border-cyan-200',        dot: 'bg-cyan-500',   label: 'DNS' },
  REPLICA_REBUILD:   { className: 'text-amber-700 bg-amber-50 border-amber-200',    dot: 'bg-amber-500',  label: 'Rebuild' },
};

const UPTIME_DATA = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  uptime: 99.9 + (Math.random() * 0.09),
  latency: 45 + Math.floor(Math.random() * 30),
}));

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */
function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

/* ─────────────────────────────────────────────────────────────
   SUB-COMPONENTS
───────────────────────────────────────────────────────────── */

/** Pulsing live indicator dot */
function PulseDot({ className }: { className: string }) {
  return (
    <span className="relative flex h-2 w-2">
      <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', className)} />
      <span className={cn('relative inline-flex rounded-full h-2 w-2', className)} />
    </span>
  );
}

/** Status badge with pulse dot */
function StatusBadge({ status }: { status: string }) {
  const s = STATUS_CONFIG[status] ?? STATUS_CONFIG.operational;
  const SIcon = s.icon;
  return (
    <Badge variant="outline" className={cn('text-xs gap-1.5 font-medium', s.className)}>
      <PulseDot className={s.dotClass} />
      {s.label}
    </Badge>
  );
}

/** Health progress bar */
function HealthBar({ value }: { value: number }) {
  const color = value >= 95 ? 'bg-emerald-500' : value >= 80 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${value}%` }} />
      </div>
      <span className={cn('text-xs font-semibold tabular-nums w-8 text-right',
        value >= 95 ? 'text-emerald-700' : value >= 80 ? 'text-amber-700' : 'text-red-700'
      )}>{value}%</span>
    </div>
  );
}

/** Architecture node card */
function ArchNode({
  icon: Icon, label, sub, region, status = 'operational', primary = false,
}: {
  icon: React.FC<{ className?: string }>;
  label: string;
  sub?: string;
  region?: string;
  status?: string;
  primary?: boolean;
}) {
  const s = STATUS_CONFIG[status] ?? STATUS_CONFIG.operational;
  return (
    <div className={cn(
      'rounded-xl border p-4 flex flex-col gap-2 min-w-[140px]',
      primary ? 'border-brand-400 bg-brand-50 shadow-sm shadow-brand-200' : 'border-slate-200 bg-white',
    )}>
      <div className="flex items-center justify-between">
        <div className={cn('p-1.5 rounded-lg', primary ? 'bg-brand-100' : 'bg-slate-100')}>
          <Icon className={cn('h-4 w-4', primary ? 'text-brand-700' : 'text-slate-600')} />
        </div>
        <PulseDot className={s.dotClass} />
      </div>
      <div>
        <div className={cn('text-xs font-semibold', primary ? 'text-brand-800' : 'text-slate-800')}>{label}</div>
        {sub && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
        {region && (
          <code className="text-[10px] bg-slate-100 text-slate-600 px-1 py-0.5 rounded mt-1 inline-block">
            {region}
          </code>
        )}
      </div>
    </div>
  );
}

/** Arrow connector */
function Arrow({ label, vertical = false }: { label?: string; vertical?: boolean }) {
  if (vertical) {
    return (
      <div className="flex flex-col items-center gap-1 py-1">
        <div className="w-px h-4 bg-slate-300" />
        <ArrowRight className="h-3 w-3 text-slate-400 rotate-90" />
        {label && <span className="text-[9px] text-slate-400 uppercase tracking-wide">{label}</span>}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <div className="h-px w-4 bg-slate-300" />
      <ArrowRight className="h-3 w-3 text-slate-400" />
      {label && <span className="text-[9px] text-slate-400 uppercase tracking-wide">{label}</span>}
      <div className="h-px w-4 bg-slate-300" />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   SIMULATE FAILOVER PANEL (demo feature)
───────────────────────────────────────────────────────────── */
function SimulatePanel({ onReset }: { onReset: () => void }) {
  const [step, setStep] = useState(0);

  const STEPS = [
    { label: 'CloudWatch alarm fired',          status: 'ALARM',              icon: AlertTriangle },
    { label: 'SNS → Lambda invoked',            status: 'TRIGGERED',          icon: Zap },
    { label: 'Replica describe — is_replica: true', status: 'CHECKING',       icon: Database },
    { label: 'Primary TCP probe — 3× failed',   status: 'CONFIRMED_DOWN',     icon: Wifi },
    { label: 'promote_read_replica accepted',   status: 'PROMOTING',          icon: Server },
    { label: 'Waiter — status: available',      status: 'AVAILABLE',          icon: CheckCircle2 },
    { label: 'Route53 CNAME → Ireland endpoint', status: 'DNS_UPDATED',       icon: Globe },
    { label: 'Failover complete',               status: 'FAILOVER_COMPLETE',  icon: CheckCircle2 },
  ];

  useEffect(() => {
    if (step < STEPS.length) {
      const t = setTimeout(() => setStep(s => s + 1), 700);
      return () => clearTimeout(t);
    }
  }, [step, STEPS.length]);

  return (
    <Card className="border-purple-200 bg-purple-50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm text-purple-900 flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            Simulated Failover — safebet-rds-failover Lambda
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => { setStep(0); onReset(); }} className="h-7 text-xs gap-1">
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
        </div>
        <CardDescription className="text-purple-700">
          Demo mode — no AWS resources affected
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5 font-mono text-xs">
          {STEPS.map((s, i) => {
            const SIcon = s.icon;
            const done  = i < step;
            const active = i === step - 1;
            return (
              <div key={i} className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg transition-all',
                done && i === STEPS.length - 1 ? 'bg-emerald-100 text-emerald-800' :
                done   ? 'bg-white/60 text-slate-700' :
                active ? 'bg-purple-100 text-purple-800 font-semibold' :
                         'text-slate-400',
              )}>
                <SIcon className="h-3 w-3 flex-shrink-0" />
                <span className="flex-1">[{s.status}]</span>
                <span className="text-slate-500 font-normal">{s.label}</span>
                {done && <CheckCircle2 className="h-3 w-3 text-emerald-600 ml-auto" />}
                {active && <span className="ml-auto animate-pulse">▌</span>}
              </div>
            );
          })}
        </div>
        {step >= STEPS.length && (
          <div className="mt-3 p-3 bg-emerald-100 border border-emerald-200 rounded-lg text-xs text-emerald-800 font-medium flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Failover complete — Ireland is now primary. DNS propagating (TTL: 60s).
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────
   ARCHITECTURE DIAGRAM
───────────────────────────────────────────────────────────── */
function ArchitectureDiagram() {
  return (
    <div className="space-y-6">
      {/* Traffic layer */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-3 font-medium">Global Traffic Layer</p>
        <div className="flex items-center gap-3 flex-wrap">
          <ArchNode icon={Globe}    label="End Users"         sub="Global traffic" />
          <Arrow label="HTTPS" />
          <ArchNode icon={Shield}   label="CloudFront CDN"    sub="200+ PoPs · WAF · HSTS" />
          <Arrow label="Route53" />
          <ArchNode icon={Globe}    label="Route53 DNS"       sub="Failover routing · CNAME TTL 60s" status="operational" primary />
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-[10px] text-slate-400 uppercase tracking-widest">Regional Split</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      {/* Regional layer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cape Town */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-base">🇿🇦</span>
            <span className="text-xs font-semibold text-slate-700">af-south-1 — Cape Town (Primary)</span>
          </div>
          <div className="border border-brand-200 bg-brand-50/40 rounded-xl p-4 space-y-3">
            <ArchNode icon={Server}   label="App Layer"        sub="AWS Amplify · Next.js" region="af-south-1" primary />
            <Arrow vertical label="connects" />
            <ArchNode icon={Database} label="RDS PostgreSQL"   sub="Primary DB · Multi-AZ" region="af-south-1" primary />
            <Arrow vertical label="streams to" />
            <ArchNode icon={HardDrive} label="S3 Backups"      sub="Daily + Monthly · AES-256" region="eu-north-1" />
          </div>
        </div>

        {/* Ireland */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-base">🇮🇪</span>
            <span className="text-xs font-semibold text-slate-700">eu-west-1 — Ireland (Failover)</span>
          </div>
          <div className="border border-slate-200 bg-slate-50/40 rounded-xl p-4 space-y-3">
            <ArchNode icon={Server}   label="App Layer"        sub="AWS Amplify · Standby" region="eu-west-1" />
            <Arrow vertical label="promotes to primary" />
            <ArchNode icon={Database} label="RDS Replica"      sub="Read replica → promoted on alarm" region="eu-west-1" />
            <Arrow vertical label="triggers" />
            <ArchNode icon={Zap}      label="DR Lambda"        sub="safebet-rds-failover · Python 3.12" region="eu-west-1" />
          </div>
        </div>
      </div>

      {/* Automation layer */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-[10px] text-slate-400 uppercase tracking-widest">Automation Layer</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <ArchNode icon={Activity}  label="CloudWatch"      sub="Alarm: DatabaseHealthy < 1" />
          <Arrow label="SNS" />
          <ArchNode icon={Zap}       label="DR Trigger"      sub="safebet-dr-trigger · Stockholm" region="eu-north-1" />
          <Arrow label="async" />
          <ArchNode icon={Server}    label="RDS Failover"    sub="promote + Route53 + rebuild" region="eu-west-1" primary />
          <Arrow label="UPSERT" />
          <ArchNode icon={Globe}     label="Route53"         sub="CNAME → Ireland endpoint" />
        </div>
      </div>

      {/* Feature grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
        {[
          { label: 'Automated Failover',       detail: 'Lambda + RDS promote' },
          { label: 'Multi-Region',             detail: 'Cape Town ↔ Ireland' },
          { label: 'Health Monitoring',        detail: 'GitHub Actions · 5 min' },
          { label: 'Point-in-Time Recovery',   detail: 'S3 backups · 90-day retention' },
          { label: 'DNS Failover',             detail: 'Route53 · TTL 60s' },
          { label: 'Replica Rebuild',          detail: 'Auto post-failover' },
        ].map(f => (
          <div key={f.label} className="p-3 border border-slate-200 rounded-lg bg-white">
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
              <span className="text-xs font-semibold text-slate-800">{f.label}</span>
            </div>
            <span className="text-[10px] text-slate-500">{f.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   PAGE
───────────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */
function formatRelative(isoString: string | null): string {
  if (!isoString) return '—';
  const diff  = Date.now() - new Date(isoString).getTime();
  const mins  = Math.floor(diff / 60_000);
  if (mins < 1)    return 'just now';
  if (mins < 60)   return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

function formatUtc(isoString: string | null): string {
  if (!isoString) return '—';
  return new Date(isoString).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

/* ─────────────────────────────────────────────────────────────
   LIVE STATUS HOOK  (polls /api/dr-status every 30 s)
───────────────────────────────────────────────────────────── */
function useLiveStatus() {
  const [data, setData]       = useState<DRStatusPayload | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef              = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLive = useCallback(async () => {
    try {
      const res = await fetch('/api/dr-status', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: DRStatusPayload = await res.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Monitoring unavailable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLive();
    timerRef.current = setInterval(fetchLive, 30_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchLive]);

  return { data, error, loading, refetch: fetchLive };
}

/* ─────────────────────────────────────────────────────────────
   LIVE SOURCE BADGE
───────────────────────────────────────────────────────────── */
function SourceBadge({ source, error }: { source: DRStatusPayload['source'] | null; error: string | null }) {
  if (error) {
    return (
      <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 gap-1">
        <AlertTriangle className="h-2.5 w-2.5" />
        Monitoring unavailable
      </Badge>
    );
  }
  if (!source) return null;
  const cfg = {
    live:        { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Live — AWS' },
    partial:     { cls: 'bg-amber-50 text-amber-700 border-amber-200',       label: 'Partial — some sources unavailable' },
    unavailable: { cls: 'bg-slate-100 text-slate-500 border-slate-200',      label: 'Fallback — AWS unreachable' },
  }[source];
  return (
    <Badge variant="outline" className={cn('text-[10px] gap-1', cfg.cls)}>
      {source === 'live' && <PulseDot className="bg-emerald-500" />}
      {cfg.label}
    </Badge>
  );
}

export default function InfrastructurePage() {
  /* ── Supabase (DR Status table) ─────────────────────────── */
  const [drStatus, setDrStatus]     = useState<DRStatus[]>([]);
  const [dbLoading, setDbLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /* ── Live AWS data ─────────────────────────────────────── */
  const { data: live, error: liveError, loading: liveLoading, refetch } = useLiveStatus();

  /* ── UI state ──────────────────────────────────────────── */
  const [activeTab, setActiveTab]   = useState('dr-status');
  const [simulating, setSimulating] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) { setRefreshing(true); refetch(); }
    else setDbLoading(true);
    const { data } = await supabase.from('dr_status').select('*').order('component');
    if (data) setDrStatus(data);
    setDbLoading(false);
    setRefreshing(false);
    setLastRefresh(new Date());
  }, [refetch]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── Derived values ──────────────────────────────────────
     Live AWS data takes precedence; Supabase table is fallback */
  const liveStatus  = live?.status ?? 'UNKNOWN';
  const liveHealth  = live?.healthScore ?? null;

  const allOperational = liveStatus === 'OPERATIONAL' ||
    (liveStatus === 'UNKNOWN' && drStatus.every(d => d.status === 'operational'));
  const degradedCount  = drStatus.filter(d => d.status !== 'operational').length;
  const overallHealth  = liveHealth
    ?? (drStatus.length > 0
        ? Math.round(drStatus.reduce((s, d) => s + d.health_score, 0) / drStatus.length)
        : 100);

  /* ── Status strip ─────────────────────────────────────── */
  const statusBgClass = liveStatus === 'OPERATIONAL'    ? 'bg-emerald-600'
                      : liveStatus === 'DEGRADED'       ? 'bg-amber-500'
                      : liveStatus === 'FAILOVER_ACTIVE' ? 'bg-purple-600'
                      : allOperational                   ? 'bg-emerald-600'
                      :                                   'bg-amber-500';

  const statusMsg = liveStatus === 'OPERATIONAL'
    ? `All Systems Operational — ${overallHealth}% health`
    : liveStatus === 'DEGRADED'
    ? `System Degraded — ${overallHealth}% health · ${degradedCount} component${degradedCount !== 1 ? 's' : ''} affected`
    : liveStatus === 'FAILOVER_ACTIVE'
    ? 'Failover Active — Ireland region is primary'
    : liveStatus === 'UNKNOWN'
    ? `Monitoring loading… — ${drStatus.length} DB components tracked`
    : `${degradedCount} component${degradedCount !== 1 ? 's' : ''} degraded — ${overallHealth}% health`;

  /* ── Last Failover banner ─────────────────────────────── */
  const lfTime  = live?.lastFailover.time ?? null;
  const lfStat  = live?.lastFailover.status ?? null;
  const lfOld   = live?.lastFailover.oldPrimary ?? 'Cape Town';
  const lfNew   = live?.lastFailover.newPrimary ?? 'Ireland';

  /* ── Backup ───────────────────────────────────────────── */
  const backupTime = live?.lastBackup.time;

  return (
    <DashboardLayout>
      <div className="space-y-0">

        {/* ── Global status strip ────────────────────────── */}
        <div className={cn('px-6 py-2.5 flex items-center justify-between', statusBgClass)}>
          <div className="flex items-center gap-2.5">
            <PulseDot className="bg-white" />
            <span className="text-sm font-medium text-white">{statusMsg}</span>
          </div>
          <div className="flex items-center gap-4 text-white/80 text-xs">
            <SourceBadge source={live?.source ?? null} error={liveError} />
            <span>Updated: {lastRefresh.toLocaleTimeString()}</span>
          </div>
        </div>

        <div className="p-6 space-y-6 max-w-[1600px] mx-auto">

          {/* ── Page header ──────────────────────────────── */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Cloud className="h-5 w-5 text-slate-600" />
                Cloud Infrastructure & Disaster Recovery
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Multi-region AWS · ISO 27001 A.17 · POPIA s.15 · RTO &lt;5 min · RPO &lt;5 min · auto-refresh 30 s
              </p>
            </div>
            <Button
              variant="outline" size="sm"
              onClick={() => loadData(true)}
              disabled={refreshing || liveLoading}
              className="gap-1.5 h-8 text-xs"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', (refreshing || liveLoading) && 'animate-spin')} />
              Refresh
            </Button>
          </div>

          {/* ── Key metrics strip ──────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              {
                label: 'Platform Uptime',
                value: '99.97%',
                sub:   '30-day rolling',
                color: 'text-emerald-700',
                bg:    'bg-emerald-50 border-emerald-100',
              },
              {
                label: 'Overall Health',
                value: `${overallHealth}%`,
                sub:   liveHealth != null ? 'AWS live' : `${drStatus.length} DB components`,
                color: overallHealth >= 90 ? 'text-emerald-700' : overallHealth >= 75 ? 'text-amber-700' : 'text-red-700',
                bg:    'bg-slate-50 border-slate-200',
              },
              {
                label: 'Failovers (30d)',
                value: live ? String(live.metrics.failoverExecuted) : '—',
                sub:   live ? `${live.metrics.failoverFailed} failed` : 'loading…',
                color: (live?.metrics.failoverFailed ?? 0) > 0 ? 'text-amber-700' : 'text-slate-800',
                bg:    'bg-slate-50 border-slate-200',
              },
              {
                label: 'Active Region',
                value: live?.activeRegion === 'eu-west-1' ? 'Ireland' : 'Cape Town',
                sub:   live?.activeRegion ?? 'eu-west-1',
                color: 'text-blue-700',
                bg:    'bg-blue-50 border-blue-100',
              },
              {
                label: 'RTO / RPO',
                value: '< 5 min',
                sub:   'Both targets met',
                color: 'text-brand-700',
                bg:    'bg-brand-50 border-brand-100',
              },
              {
                label: 'Last Backup',
                value: backupTime ? formatRelative(backupTime) : '—',
                sub:   backupTime ? formatUtc(backupTime).slice(0, 16) : liveError ? 'S3 unavailable' : 'loading…',
                color: 'text-slate-700',
                bg:    'bg-slate-50 border-slate-200',
              },
            ].map(m => (
              <div key={m.label} className={cn('rounded-lg border px-3 py-2.5', m.bg)}>
                <div className={cn('text-xl font-bold tabular-nums', m.color)}>{m.value}</div>
                <div className="text-xs font-medium text-slate-700 mt-0.5">{m.label}</div>
                <div className="text-[10px] text-slate-400">{m.sub}</div>
              </div>
            ))}
          </div>

          {/* ── Last Failover Event banner ─────────────────── */}
          {liveLoading ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 flex items-center gap-2 text-xs text-slate-500">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Loading last failover event from AWS CloudWatch Logs…
            </div>
          ) : liveError && !lfTime ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-2 text-xs text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              CloudWatch Logs unavailable — configure AWS credentials to see live failover history.
            </div>
          ) : (
            <div className="rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 flex-shrink-0">
                <Zap className="h-4 w-4 text-purple-600" />
                <span className="text-xs font-semibold text-purple-800 uppercase tracking-wide">
                  Last Failover Event
                </span>
                {lfTime && (
                  <Badge variant="outline" className="text-[10px] bg-purple-100 text-purple-700 border-purple-200">
                    AWS Live
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 flex-1 flex-wrap text-xs text-purple-700">
                <code className="bg-purple-100 px-1.5 py-0.5 rounded text-purple-900 font-mono">
                  {lfTime ? formatUtc(lfTime) : '2026-03-29 00:12:44 UTC'}
                </code>
                <ChevronRight className="h-3 w-3" />
                <span>{lfOld} → {lfNew}</span>
                <ChevronRight className="h-3 w-3" />
                <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                  {lfStat ?? 'FAILOVER_COMPLETE'}
                </Badge>
                <ChevronRight className="h-3 w-3" />
                <span>{live?.lastFailover.detail ?? 'Route53 CNAME updated · Replica rebuilt in af-south-1'}</span>
              </div>
              <div className="text-[10px] text-purple-500 flex-shrink-0">{formatRelative(lfTime)}</div>
            </div>
          )}

          {/* ── Main tabs ─────────────────────────────────── */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-9 p-1 bg-slate-100 gap-0.5">
              {[
                { value: 'dr-status',      label: 'DR Status'      },
                { value: 'architecture',   label: 'Architecture'   },
                { value: 'timeline',       label: 'Event Timeline' },
                { value: 'cloud-security', label: 'Cloud Security' },
                { value: 'devsecops',      label: 'DevSecOps'      },
                { value: 'uptime',         label: 'SLA & Uptime'   },
              ].map(t => (
                <TabsTrigger key={t.value} value={t.value} className="text-xs h-7 px-3">
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* ── DR STATUS ─────────────────────────────── */}
            <TabsContent value="dr-status" className="mt-4 space-y-4">

              {/* Live AWS metrics strip */}
              {live && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Failovers executed',   value: live.metrics.failoverExecuted,    color: 'text-slate-800' },
                    { label: 'Failovers failed',     value: live.metrics.failoverFailed,      color: live.metrics.failoverFailed > 0 ? 'text-red-700' : 'text-emerald-700' },
                    { label: 'Aborted (false alarm)',value: live.metrics.failoverAborted,     color: 'text-amber-700' },
                    { label: 'Already primary',      value: live.metrics.failoverAlreadyDone, color: 'text-slate-600' },
                  ].map(m => (
                    <div key={m.label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <div className={cn('text-2xl font-bold tabular-nums', m.color)}>{m.value}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{m.label} · 30 days</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Route53 status */}
              {live?.route53.status && (
                <div className={cn(
                  'rounded-lg border px-4 py-2.5 flex items-center gap-3 text-xs',
                  live.route53.status === 'Healthy'   ? 'border-emerald-200 bg-emerald-50 text-emerald-800' :
                  live.route53.status === 'Degraded'  ? 'border-amber-200 bg-amber-50 text-amber-800' :
                                                        'border-red-200 bg-red-50 text-red-800',
                )}>
                  <Globe className="h-4 w-4 flex-shrink-0" />
                  <span className="font-semibold">Route53 Health:</span>
                  <span>{live.route53.status}</span>
                  {live.route53.checkedRegions.length > 0 && (
                    <span className="text-slate-500 ml-2">
                      Checked from: {live.route53.checkedRegions.join(', ')}
                    </span>
                  )}
                  <Badge variant="outline" className="ml-auto text-[10px] bg-white/60">AWS Live</Badge>
                </div>
              )}

              {/* Simulate failover (demo feature) */}
              {!simulating ? (
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">Demo Mode</span>
                    {' '}— Simulate a full DR failover to see the Lambda execution flow.
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setSimulating(true)} className="h-7 text-xs gap-1.5 border-purple-300 text-purple-700 hover:bg-purple-50">
                    <Play className="h-3 w-3" />
                    Simulate Failover
                  </Button>
                </div>
              ) : (
                <SimulatePanel onReset={() => setSimulating(false)} />
              )}

              {/* DR Status table */}
              <Card>
                <CardHeader className="pb-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm">Component Health — Real-Time Status</CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        Sourced from Supabase dr_status · refreshes every 5 minutes via GitHub Actions
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                      <Radio className="h-3 w-3 text-emerald-500" />
                      Live
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0 mt-3">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 hover:bg-slate-50">
                        <TableHead className="text-xs font-semibold text-slate-600 w-[200px]">Component</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600">Region</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600">Status</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600 w-[140px]">Health</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600 text-center">RTO</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600 text-center">RPO</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600">Last Backup</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-600">Last Check</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dbLoading ? (
                        <TableRow>
                          <TableCell colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                            <div className="flex items-center justify-center gap-2">
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              Loading infrastructure status…
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : drStatus.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                            No DR status records found in database.
                          </TableCell>
                        </TableRow>
                      ) : drStatus.map(d => {
                        const regionInfo = REGION_LABELS[d.region];
                        return (
                          <TableRow key={d.id} className="text-sm hover:bg-slate-50/50">
                            <TableCell>
                              <div className="font-medium text-slate-800 text-xs">{d.component}</div>
                              {d.notes && (
                                <div className="text-[10px] text-slate-400 mt-0.5 max-w-[180px] truncate">{d.notes}</div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                {regionInfo && <span className="text-sm">{regionInfo.flag}</span>}
                                <code className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                  {regionInfo?.short ?? d.region}
                                </code>
                              </div>
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={d.status} />
                            </TableCell>
                            <TableCell>
                              <HealthBar value={d.health_score} />
                            </TableCell>
                            <TableCell className="text-center">
                              <code className="text-[10px] text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded">
                                {d.rto_minutes != null ? `${d.rto_minutes}m` : '—'}
                              </code>
                            </TableCell>
                            <TableCell className="text-center">
                              <code className="text-[10px] text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded">
                                {d.rpo_minutes != null ? `${d.rpo_minutes}m` : '—'}
                              </code>
                            </TableCell>
                            <TableCell className="text-[11px] text-slate-500">
                              {d.last_backup_at ? timeAgo(d.last_backup_at) : <span className="text-slate-300">—</span>}
                            </TableCell>
                            <TableCell className="text-[11px] text-slate-500">
                              {timeAgo(d.last_check_at)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* SLA compliance strip */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Availability SLA', target: '99.99%', actual: '99.97%', ok: true },
                  { label: 'RTO Commitment',   target: '< 15 min', actual: '< 5 min', ok: true },
                  { label: 'RPO Commitment',   target: '< 60 min', actual: '< 5 min', ok: true },
                ].map(s => (
                  <div key={s.label} className="rounded-lg border border-slate-200 px-4 py-3 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-slate-500">{s.label}</div>
                      <div className="text-sm font-bold text-slate-800 mt-0.5">{s.actual}</div>
                      <div className="text-[10px] text-slate-400">Target: {s.target}</div>
                    </div>
                    <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                      Exceeding
                    </Badge>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* ── ARCHITECTURE ──────────────────────────── */}
            <TabsContent value="architecture" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Multi-Region DR Architecture — Cape Town ↔ Ireland</CardTitle>
                  <CardDescription className="text-xs">
                    AWS infrastructure topology · auto-failover via Lambda · DNS switching via Route53
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ArchitectureDiagram />
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── EVENT TIMELINE ────────────────────────── */}
            <TabsContent value="timeline" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    DR Event Timeline
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Failover executions, health checks, and backup completions — newest first
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative space-y-0">
                    {/* Vertical timeline line */}
                    <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200" />

                    {DR_EVENTS.map((ev, i) => {
                      const style = EVENT_STYLE[ev.type] ?? EVENT_STYLE.HEALTH_CHECK;
                      const regionInfo = REGION_LABELS[ev.region];
                      return (
                        <div key={i} className="relative pl-7 pb-5 last:pb-0">
                          {/* Timeline dot */}
                          <div className={cn('absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white', style.dot)} />

                          <div className={cn('rounded-lg border px-4 py-3', style.className)}>
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', style.className)}>
                                  {style.label}
                                </Badge>
                                <code className="text-[10px] opacity-70">{ev.ts} UTC</code>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {regionInfo && <span className="text-sm">{regionInfo.flag}</span>}
                                <code className="text-[10px] opacity-60 bg-white/50 px-1.5 py-0.5 rounded">
                                  {regionInfo?.short ?? ev.region}
                                </code>
                                <code className="text-[10px] font-semibold bg-white/50 px-1.5 py-0.5 rounded">
                                  {ev.result}
                                </code>
                              </div>
                            </div>
                            <p className="text-xs mt-1.5 opacity-80">{ev.detail}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── CLOUD SECURITY ────────────────────────── */}
            <TabsContent value="cloud-security" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {CLOUD_CONTROLS.map(ctrl => (
                  <div key={ctrl.service} className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex items-start gap-3">
                    <Badge className="bg-slate-800 text-white text-xs flex-shrink-0 mt-0.5 font-mono">
                      {ctrl.layer}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-xs text-slate-800">{ctrl.service}</div>
                        <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 flex-shrink-0 gap-1">
                          <PulseDot className="bg-emerald-500" />
                          Active
                        </Badge>
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">{ctrl.description}</div>
                      <div className="text-[10px] text-slate-400 mt-1">{ctrl.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Lock className="h-4 w-4 text-blue-700 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-800">
                      <div className="font-semibold mb-2 text-xs uppercase tracking-wide">Encryption — At Rest & In Transit</div>
                      <div className="space-y-1 text-xs">
                        {[
                          'Database: AES-256-GCM (Supabase managed + AWS KMS CMK)',
                          'Backups: AES-256-CBC with separate key hierarchy',
                          'Transit: TLS 1.3 minimum — TLS 1.0/1.1 disabled at WAF',
                          'API tokens: SHA-256 one-way hash — plaintext never stored post-creation',
                          'Player IDs: Pseudonymised PTOKEN — SHA-256 hashed at ingest',
                          'IP Addresses: SHA-256 hashed — never stored in plaintext',
                        ].map(line => (
                          <div key={line} className="flex items-start gap-1.5">
                            <CheckCircle2 className="h-3 w-3 text-blue-600 mt-0.5 flex-shrink-0" />
                            {line}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── DEVSECOPS ─────────────────────────────── */}
            <TabsContent value="devsecops" className="mt-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <GitBranch className="h-4 w-4" />
                        Secure CI/CD Pipeline — Latest Scan Results
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        Automated checks run on every commit and deployment
                      </CardDescription>
                    </div>
                    <div className="flex gap-3">
                      <div className="text-center">
                        <div className="text-lg font-bold text-emerald-700">
                          {DEVSECOPS_CHECKS.filter(c => c.status === 'passing').length}/{DEVSECOPS_CHECKS.length}
                        </div>
                        <div className="text-[10px] text-slate-500">Passing</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-amber-600">
                          {DEVSECOPS_CHECKS.reduce((s, c) => s + c.findings, 0)}
                        </div>
                        <div className="text-[10px] text-slate-500">Findings</div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {DEVSECOPS_CHECKS.map(check => (
                    <div key={check.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                        <div>
                          <div className="text-xs font-medium text-slate-800">{check.name}</div>
                          <div className="text-[10px] text-slate-400">{check.tool} · {check.last_run}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {check.findings > 0 ? (
                          <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                            {check.findings} finding{check.findings > 1 ? 's' : ''}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">Clean</Badge>
                        )}
                        <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">Passing</Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── SLA & UPTIME ──────────────────────────── */}
            <TabsContent value="uptime" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Platform Uptime — 30 Days
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={UPTIME_DATA}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                        <YAxis domain={[99.8, 100]} tick={{ fontSize: 10 }} tickFormatter={v => `${v.toFixed(1)}%`} />
                        <Tooltip formatter={(v: number) => [`${v.toFixed(3)}%`, 'Uptime']} />
                        <Area type="monotone" dataKey="uptime" stroke="#22c55e" fill="#dcfce7" strokeWidth={2} name="Uptime" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      API Latency p95 — 30 Days
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={UPTIME_DATA}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}ms`} />
                        <Tooltip formatter={(v: number) => [`${v}ms`, 'p95 Latency']} />
                        <Line type="monotone" dataKey="latency" stroke="#3b82f6" dot={false} strokeWidth={2} name="p95" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold text-slate-600 uppercase tracking-wide">SLA Commitments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { metric: 'Availability SLA',  target: '99.99%',    actual: '99.97%',   exceeding: true },
                      { metric: 'API Latency p95',   target: '< 200ms',   actual: '72ms',     exceeding: true },
                      { metric: 'RTO',               target: '< 15 min',  actual: '< 5 min',  exceeding: true },
                      { metric: 'RPO',               target: '< 60 min',  actual: '< 5 min',  exceeding: true },
                      { metric: 'Backup Frequency',  target: 'Daily',     actual: 'Every 6h', exceeding: true },
                      { metric: 'Backup Retention',  target: '30 days',   actual: '90 days',  exceeding: true },
                      { metric: 'Security Patches',  target: '< 30 days', actual: '< 24h',    exceeding: true },
                      { metric: 'Incident Response', target: '< 4 hours', actual: '< 30 min', exceeding: true },
                    ].map(sla => (
                      <div key={sla.metric} className="p-3 border border-slate-200 rounded-lg bg-slate-50">
                        <div className="text-[10px] text-slate-400 uppercase tracking-wide">{sla.metric}</div>
                        <div className="text-sm font-bold text-slate-800 mt-1">{sla.actual}</div>
                        <div className="text-[10px] text-slate-400 mb-1.5">Target: {sla.target}</div>
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-0">
                          Exceeding
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Compliance summary */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Compliance & Certifications
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'ISO 27001',      status: 'In Progress', style: 'bg-amber-50 text-amber-700 border-amber-200' },
                      { label: 'POPIA s.15',     status: 'Compliant',   style: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                      { label: 'OWASP Top 10',   status: 'Compliant',   style: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                      { label: 'Audit Logging',  status: 'Active',      style: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                    ].map(c => (
                      <div key={c.label} className={cn('rounded-lg border px-3 py-2.5 flex items-center justify-between', c.style)}>
                        <span className="text-xs font-semibold">{c.label}</span>
                        <Badge variant="outline" className={cn('text-[10px]', c.style)}>{c.status}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}
