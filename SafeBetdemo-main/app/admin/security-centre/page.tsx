'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Shield, Lock, Smartphone, Eye, Clock, Users, AlertTriangle,
  CheckCircle2, Settings, RefreshCw, LogIn, LogOut, Globe, Key,
  ShieldCheck, ShieldAlert, Activity, Download, Info, Laptop,
  Monitor, Fingerprint, BarChart3,
} from 'lucide-react';

interface SessionEntry {
  id: string;
  device: string;
  location: string;
  ip: string;
  lastActive: string;
  current: boolean;
}

interface LoginHistoryEntry {
  id: string;
  event: 'success' | 'failed' | 'logout';
  device: string;
  location: string;
  ip: string;
  timestamp: string;
}

const MOCK_SESSIONS: SessionEntry[] = [
  { id: '1', device: 'Chrome · Windows 11', location: 'Sandton, ZA', ip: '41.x.x.x', lastActive: 'Just now', current: true },
  { id: '2', device: 'Safari · iPhone 15', location: 'Cape Town, ZA', ip: '102.x.x.x', lastActive: '3h ago', current: false },
];

const MOCK_HISTORY: LoginHistoryEntry[] = [
  { id: '1', event: 'success', device: 'Chrome · Windows 11', location: 'Sandton, ZA', ip: '41.x.x.x', timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString() },
  { id: '2', event: 'success', device: 'Safari · iPhone 15', location: 'Cape Town, ZA', ip: '102.x.x.x', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString() },
  { id: '3', event: 'failed', device: 'Firefox · Unknown', location: 'Johannesburg, ZA', ip: '196.x.x.x', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString() },
  { id: '4', event: 'success', device: 'Chrome · Windows 11', location: 'Sandton, ZA', ip: '41.x.x.x', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
  { id: '5', event: 'logout', device: 'Chrome · Windows 11', location: 'Sandton, ZA', ip: '41.x.x.x', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 25).toISOString() },
  { id: '6', event: 'success', device: 'Chrome · MacOS', location: 'Durban, ZA', ip: '154.x.x.x', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString() },
];

const SECURITY_POLICIES = [
  { category: 'Authentication', controls: [
    { label: 'Minimum password length', value: '12 characters', status: 'compliant' },
    { label: 'Password complexity requirement', value: 'Upper, lower, number, symbol', status: 'compliant' },
    { label: 'Password rotation period', value: '90 days', status: 'compliant' },
    { label: 'Account lockout after failed attempts', value: '5 attempts → 30 min lockout', status: 'compliant' },
    { label: 'Multi-Factor Authentication (MFA)', value: 'Required for all admin roles', status: 'warning' },
  ]},
  { category: 'Session Management', controls: [
    { label: 'Session timeout (idle)', value: '30 minutes', status: 'compliant' },
    { label: 'Maximum concurrent sessions', value: '3 per user', status: 'compliant' },
    { label: 'Session token rotation', value: 'Every 15 minutes', status: 'compliant' },
    { label: 'Force re-authentication for sensitive actions', value: 'Enabled', status: 'compliant' },
  ]},
  { category: 'Data Access', controls: [
    { label: 'Role-based access control', value: 'Multi-role RBAC', status: 'compliant' },
    { label: 'Row-level security', value: 'Per-casino tenant isolation', status: 'compliant' },
    { label: 'Data access audit logging', value: 'All access logged', status: 'compliant' },
    { label: 'PII data masking in logs', value: 'SHA-256 hashing applied', status: 'compliant' },
  ]},
  { category: 'Infrastructure', controls: [
    { label: 'Encryption in transit', value: 'TLS 1.3', status: 'compliant' },
    { label: 'Encryption at rest', value: 'AES-256', status: 'compliant' },
    { label: 'Database connection security', value: 'SSL required, IP allowlist', status: 'compliant' },
    { label: 'API rate limiting', value: 'Per-key, per-endpoint', status: 'compliant' },
  ]},
];

function formatTs(ts: string) {
  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(ts));
}

export default function SecurityCentrePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [enablingMfa, setEnablingMfa] = useState(false);

  const overallScore = 87;

  function handleEnableMfa() {
    setEnablingMfa(true);
    setTimeout(() => {
      setMfaEnabled(true);
      setEnablingMfa(false);
      toast.success('MFA enabled. Scan the QR code with your authenticator app.');
    }, 1500);
  }

  function handleRevokeSession(sessionId: string) {
    toast.success('Session revoked. The device has been signed out.');
  }

  return (
    <DashboardLayout>
      <div className="flex min-h-full flex-col">

        {/* Header */}
        <div className="border-b bg-card px-6 py-4">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <Shield className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold">Security Centre</h1>
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    ISO 27001
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Authentication · Session management · Security policies · Access reviews
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-1.5" />
                Security Report
              </Button>
            </div>
          </div>

          {/* Security Score Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
            {[
              { label: 'Security Score', value: `${overallScore}%`, color: 'text-emerald-600' },
              { label: 'Open Issues', value: '1', color: 'text-yellow-600' },
              { label: 'Active Sessions', value: MOCK_SESSIONS.length.toString(), color: '' },
              { label: 'Failed Logins (24h)', value: '1', color: MOCK_HISTORY.filter(h => h.event === 'failed').length > 3 ? 'text-red-600' : '' },
            ].map(k => (
              <div key={k.label} className="flex flex-col px-3 py-2 rounded-lg bg-muted/30 border">
                <span className="text-[10px] text-muted-foreground mb-0.5">{k.label}</span>
                <span className={`text-lg font-bold ${k.color}`}>{k.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-1 overflow-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <div className="border-b bg-card px-6 pt-2 pb-0">
              <TabsList className="h-auto bg-transparent p-0 gap-0 border-0">
                {[
                  { id: 'overview', label: 'Security Overview', icon: BarChart3 },
                  { id: 'mfa', label: 'MFA', icon: Smartphone },
                  { id: 'sessions', label: 'Sessions', icon: Monitor },
                  { id: 'history', label: 'Login History', icon: Clock },
                  { id: 'policies', label: 'Security Policies', icon: Shield },
                  { id: 'access', label: 'Access Review', icon: Users },
                ].map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-none border-b-2 transition-colors ${isActive ? 'border-primary text-foreground bg-transparent' : 'border-transparent text-muted-foreground hover:text-foreground bg-transparent'}`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{tab.label}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            <div className="flex-1 p-6 min-w-0">

              {/* ── OVERVIEW ── */}
              <TabsContent value="overview" className="mt-0 space-y-6">
                {/* Security Score Card */}
                <div className="grid md:grid-cols-3 gap-4">
                  <Card className="md:col-span-1">
                    <CardContent className="pt-6 pb-6 text-center">
                      <div className="relative w-28 h-28 mx-auto mb-4">
                        <svg className="w-28 h-28 -rotate-90" viewBox="0 0 120 120">
                          <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
                          <circle cx="60" cy="60" r="50" fill="none" stroke="#10b981" strokeWidth="10"
                            strokeDasharray={`${2 * Math.PI * 50 * overallScore / 100} ${2 * Math.PI * 50 * (1 - overallScore / 100)}`}
                            strokeLinecap="round" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-3xl font-bold text-emerald-600">{overallScore}</span>
                          <span className="text-xs text-muted-foreground">/ 100</span>
                        </div>
                      </div>
                      <p className="text-sm font-semibold">Security Score</p>
                      <p className="text-xs text-muted-foreground mt-1">Good — 1 issue to address</p>
                      <Badge className="mt-2 bg-emerald-100 text-emerald-700 border-0 text-xs">ISO 27001 Aligned</Badge>
                    </CardContent>
                  </Card>

                  <Card className="md:col-span-2">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Security Checklist</CardTitle>
                      <CardDescription className="text-xs">Actions to improve your security posture</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {[
                        { label: 'Enable Multi-Factor Authentication', done: mfaEnabled, priority: 'High', action: () => setActiveTab('mfa') },
                        { label: 'All admin users have MFA active', done: false, priority: 'High', action: () => setActiveTab('access') },
                        { label: 'Review active sessions', done: true, priority: 'Medium', action: () => setActiveTab('sessions') },
                        { label: 'Password policy compliant', done: true, priority: 'High', action: () => setActiveTab('policies') },
                        { label: 'Row-level security active', done: true, priority: 'Critical', action: null },
                        { label: 'Audit logging enabled', done: true, priority: 'Critical', action: null },
                        { label: 'TLS 1.3 encryption in transit', done: true, priority: 'Critical', action: null },
                        { label: 'API keys rotated in last 90 days', done: true, priority: 'High', action: null },
                      ].map((item, i) => (
                        <div key={i} className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors ${!item.done ? 'bg-yellow-50/50 border-yellow-200' : 'bg-muted/20'}`}>
                          <div className="flex items-center gap-2.5">
                            {item.done ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                            )}
                            <span className={`text-xs ${!item.done ? 'font-medium' : 'text-muted-foreground'}`}>{item.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${item.priority === 'Critical' ? 'border-red-200 text-red-600' : item.priority === 'High' ? 'border-orange-200 text-orange-600' : 'border-slate-200 text-slate-600'}`}>
                              {item.priority}
                            </Badge>
                            {!item.done && item.action && (
                              <Button variant="ghost" size="sm" className="h-6 text-xs text-primary" onClick={item.action}>Fix →</Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>

                {/* Security Standards */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />Security Standards & Certifications</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-4 gap-3">
                      {[
                        { standard: 'ISO 27001:2022', scope: 'Information security management', status: 'Aligned', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
                        { standard: 'POPIA', scope: 'Personal data protection', status: 'Compliant', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
                        { standard: 'NGA §33', scope: 'Data security obligations', status: 'Compliant', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
                        { standard: 'OWASP Top 10', scope: 'Application security', status: 'Addressed', color: 'text-blue-600 bg-blue-50 border-blue-200' },
                      ].map((s, i) => (
                        <div key={i} className={`p-3 rounded-lg border text-center ${s.color}`}>
                          <p className="text-sm font-bold">{s.standard}</p>
                          <p className="text-xs mt-0.5 opacity-70">{s.scope}</p>
                          <Badge className={`mt-2 border-0 text-[10px] ${s.color.replace('border-', 'bg-').split(' ').slice(0, 2).join(' ')}`}>{s.status}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── MFA ── */}
              <TabsContent value="mfa" className="mt-0 space-y-4">
                <div>
                  <h2 className="text-base font-semibold flex items-center gap-2"><Smartphone className="h-5 w-5 text-primary" />Multi-Factor Authentication</h2>
                  <p className="text-sm text-muted-foreground">Protect your account with a second factor beyond your password</p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <Card className={mfaEnabled ? 'border-emerald-200 bg-emerald-50/20' : 'border-yellow-200 bg-yellow-50/20'}>
                    <CardContent className="pt-6 pb-6 text-center">
                      {mfaEnabled ? (
                        <>
                          <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                          <p className="text-lg font-bold text-emerald-700">MFA is Active</p>
                          <p className="text-xs text-muted-foreground mt-1">Your account is protected with authenticator app MFA</p>
                          <div className="mt-4 space-y-2">
                            <Button variant="outline" size="sm" className="w-full">Manage Authenticator</Button>
                            <Button variant="ghost" size="sm" className="w-full text-red-600">Disable MFA</Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-3" />
                          <p className="text-lg font-bold">MFA Not Enabled</p>
                          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                            Enable MFA to protect your account. Required for all Casino Admin and Compliance Officer roles under NGA §33.
                          </p>
                          <Button className="mt-4 w-full" onClick={handleEnableMfa} disabled={enablingMfa}>
                            {enablingMfa ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Smartphone className="h-4 w-4 mr-2" />}
                            {enablingMfa ? 'Setting up...' : 'Enable MFA'}
                          </Button>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Supported MFA Methods</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {[
                        { method: 'Authenticator App', desc: 'Google Authenticator, Authy, Microsoft Authenticator', recommended: true, supported: true },
                        { method: 'SMS One-Time Code', desc: 'Sent to your registered mobile number', recommended: false, supported: true },
                        { method: 'Hardware Security Key', desc: 'YubiKey or FIDO2 compatible device', recommended: false, supported: false },
                        { method: 'Backup Recovery Codes', desc: 'One-time use codes for account recovery', recommended: false, supported: true },
                      ].map((m, i) => (
                        <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${m.supported ? '' : 'opacity-50'}`}>
                          <Fingerprint className={`h-5 w-5 mt-0.5 flex-shrink-0 ${m.supported ? 'text-primary' : 'text-muted-foreground'}`} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{m.method}</p>
                              {m.recommended && <Badge className="bg-primary/10 text-primary border-0 text-[10px]">Recommended</Badge>}
                              {!m.supported && <Badge variant="outline" className="text-[10px]">Coming soon</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>

                <Card className="border-blue-200 bg-blue-50/20">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-3">
                      <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-blue-800">MFA Compliance Requirement</p>
                        <p className="text-xs text-blue-700 mt-1">
                          Multi-Factor Authentication is required for all Casino Administrator and Compliance Officer accounts under the National Gambling Act §33 data security provisions and ISO 27001:2022 control A.9.4.2. Accounts without MFA may be flagged in regulatory audits.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── SESSIONS ── */}
              <TabsContent value="sessions" className="mt-0 space-y-4">
                <div>
                  <h2 className="text-base font-semibold flex items-center gap-2"><Monitor className="h-5 w-5 text-primary" />Active Sessions</h2>
                  <p className="text-sm text-muted-foreground">{MOCK_SESSIONS.length} devices currently signed in to your account</p>
                </div>

                <div className="space-y-3">
                  {MOCK_SESSIONS.map(session => (
                    <Card key={session.id} className={session.current ? 'border-primary/30 bg-primary/5' : ''}>
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                              {session.device.includes('iPhone') || session.device.includes('Android') ? (
                                <Smartphone className="h-5 w-5 text-muted-foreground" />
                              ) : (
                                <Laptop className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">{session.device}</p>
                                {session.current && <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Current session</Badge>}
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{session.location}</span>
                                <span className="font-mono">{session.ip}</span>
                                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{session.lastActive}</span>
                              </div>
                            </div>
                          </div>
                          {!session.current && (
                            <Button variant="outline" size="sm" className="text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleRevokeSession(session.id)}>
                              Revoke
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50">
                  Sign Out All Other Sessions
                </Button>
              </TabsContent>

              {/* ── LOGIN HISTORY ── */}
              <TabsContent value="history" className="mt-0 space-y-4">
                <div>
                  <h2 className="text-base font-semibold flex items-center gap-2"><Clock className="h-5 w-5 text-primary" />Login History</h2>
                  <p className="text-sm text-muted-foreground">Last {MOCK_HISTORY.length} authentication events for your account</p>
                </div>

                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="w-28">Event</TableHead>
                          <TableHead>Device</TableHead>
                          <TableHead className="hidden sm:table-cell">Location</TableHead>
                          <TableHead className="hidden md:table-cell font-mono">IP (masked)</TableHead>
                          <TableHead>Timestamp</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {MOCK_HISTORY.map(entry => (
                          <TableRow key={entry.id} className={`text-sm ${entry.event === 'failed' ? 'bg-red-50/20' : ''}`}>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                {entry.event === 'success' && <><LogIn className="h-3.5 w-3.5 text-emerald-500" /><Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Login</Badge></>}
                                {entry.event === 'failed' && <><AlertTriangle className="h-3.5 w-3.5 text-red-500" /><Badge className="bg-red-100 text-red-700 border-0 text-xs">Failed</Badge></>}
                                {entry.event === 'logout' && <><LogOut className="h-3.5 w-3.5 text-slate-500" /><Badge className="bg-slate-100 text-slate-600 border-0 text-xs">Logout</Badge></>}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">{entry.device}</TableCell>
                            <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{entry.location}</TableCell>
                            <TableCell className="hidden md:table-cell font-mono text-xs text-muted-foreground">{entry.ip}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{formatTs(entry.timestamp)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── POLICIES ── */}
              <TabsContent value="policies" className="mt-0 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold flex items-center gap-2"><Shield className="h-5 w-5 text-primary" />Security Policies</h2>
                    <p className="text-sm text-muted-foreground">Platform-wide security controls and their compliance status</p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-1.5" />
                    Policy Report
                  </Button>
                </div>

                <div className="space-y-4">
                  {SECURITY_POLICIES.map((section, i) => (
                    <Card key={i}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">{section.category}</CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <Table>
                          <TableBody>
                            {section.controls.map((control, j) => (
                              <TableRow key={j} className={`text-sm ${control.status === 'warning' ? 'bg-yellow-50/30' : ''}`}>
                                <TableCell className="py-2.5 text-xs text-muted-foreground">{control.label}</TableCell>
                                <TableCell className="py-2.5 text-xs font-medium">{control.value}</TableCell>
                                <TableCell className="py-2.5 text-right">
                                  {control.status === 'compliant' ? (
                                    <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs flex items-center gap-1 w-fit ml-auto">
                                      <CheckCircle2 className="h-3 w-3" />
                                      Compliant
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-yellow-100 text-yellow-700 border-0 text-xs flex items-center gap-1 w-fit ml-auto">
                                      <AlertTriangle className="h-3 w-3" />
                                      Action Needed
                                    </Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              {/* ── ACCESS REVIEW ── */}
              <TabsContent value="access" className="mt-0 space-y-4">
                <div>
                  <h2 className="text-base font-semibold flex items-center gap-2"><Users className="h-5 w-5 text-primary" />Access Review</h2>
                  <p className="text-sm text-muted-foreground">Review and audit user roles and permissions — ISO 27001 A.9.2.5 periodic access review</p>
                </div>

                <Card className="border-blue-200 bg-blue-50/20">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-3">
                      <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-blue-800">
                        <span className="font-semibold">Periodic Access Review:</span> ISO 27001:2022 control A.9.2.5 requires that user access rights are reviewed at regular intervals (minimum quarterly). This review should identify any users with excessive permissions, inactive accounts, or role changes.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid md:grid-cols-3 gap-4">
                  {[
                    { role: 'Super Admin', count: 2, mfaActive: 2, lastReview: '2026-06-01', status: 'current' },
                    { role: 'Casino Admin', count: 4, mfaActive: 2, lastReview: '2026-06-01', status: 'action' },
                    { role: 'Compliance Officer', count: 6, mfaActive: 4, lastReview: '2026-06-01', status: 'action' },
                    { role: 'National Regulator', count: 3, mfaActive: 3, lastReview: '2026-06-01', status: 'current' },
                    { role: 'Provincial Regulator', count: 9, mfaActive: 9, lastReview: '2026-06-01', status: 'current' },
                    { role: 'Staff', count: 47, mfaActive: 0, lastReview: '2026-06-01', status: 'current' },
                  ].map((r, i) => (
                    <Card key={i} className={r.status === 'action' ? 'border-yellow-200' : ''}>
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start justify-between">
                          <p className="text-sm font-semibold">{r.role}</p>
                          <Badge className={`border-0 text-xs ${r.status === 'current' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {r.status === 'current' ? 'OK' : 'Action'}
                          </Badge>
                        </div>
                        <div className="mt-3 space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Users</span>
                            <span className="font-medium">{r.count}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">MFA Active</span>
                            <span className={`font-medium ${r.mfaActive < r.count ? 'text-yellow-600' : 'text-emerald-600'}`}>
                              {r.mfaActive} / {r.count}
                            </span>
                          </div>
                          <div>
                            <Progress value={(r.mfaActive / r.count) * 100} className="h-1 mt-1" />
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Last review</span>
                            <span>{r.lastReview}</span>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" className="w-full mt-3 h-7 text-xs">Review Access</Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

            </div>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}
