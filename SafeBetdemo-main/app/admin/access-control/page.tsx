'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Shield, ShieldCheck, Lock, Clock as Unlock, Users, Key, Network, Plus, CreditCard as Edit2, CircleCheck as CheckCircle2, Circle as XCircle, TriangleAlert as AlertTriangle, ChevronRight, RefreshCw, Fingerprint, Globe, Settings, Eye, Pen as PenSquare, Trash2, Download, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ABACPolicy {
  id: string;
  casino_id: string | null;
  policy_name: string;
  description: string | null;
  subject_role: string;
  resource: string;
  action: string;
  conditions: Record<string, unknown>;
  effect: 'allow' | 'deny';
  priority: number;
  is_active: boolean;
  created_at: string;
}

interface MFASetting {
  id: string;
  user_id: string;
  totp_enabled: boolean;
  sms_enabled: boolean;
  hardware_key_enabled: boolean;
  backup_codes_remaining: number;
  mfa_enforced: boolean;
  last_mfa_at: string | null;
}

interface IPAllowlist {
  id: string;
  casino_id: string | null;
  label: string;
  ip_cidr: string;
  ip_type: string;
  environment: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

interface Casino {
  id: string;
  name: string;
}

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-slate-900 text-white',
  national_regulator: 'bg-blue-700 text-white',
  provincial_regulator: 'bg-blue-500 text-white',
  casino_admin: 'bg-emerald-700 text-white',
  compliance_officer: 'bg-amber-700 text-white',
  analyst: 'bg-brand-700 text-white',
  staff: 'bg-slate-500 text-white',
  anonymous: 'bg-red-600 text-white',
};

const ACTION_ICONS: Record<string, React.FC<{ className?: string }>> = {
  read: Eye,
  write: PenSquare,
  delete: Trash2,
  export: Download,
  approve: CheckCircle2,
};

const RBAC_MATRIX = [
  { role: 'super_admin', label: 'Super Admin', permissions: { dashboard: true, players: true, interventions: true, compliance: true, security: true, api_keys: true, user_mgmt: true, reports: true, config: true } },
  { role: 'national_regulator', label: 'National Regulator', permissions: { dashboard: true, players: false, interventions: false, compliance: true, security: false, api_keys: false, user_mgmt: false, reports: true, config: false } },
  { role: 'provincial_regulator', label: 'Provincial Regulator', permissions: { dashboard: true, players: false, interventions: false, compliance: true, security: false, api_keys: false, user_mgmt: false, reports: true, config: false } },
  { role: 'casino_admin', label: 'Casino Admin', permissions: { dashboard: true, players: true, interventions: true, compliance: true, security: true, api_keys: true, user_mgmt: true, reports: true, config: false } },
  { role: 'compliance_officer', label: 'Compliance Officer', permissions: { dashboard: true, players: true, interventions: true, compliance: true, security: false, api_keys: false, user_mgmt: false, reports: true, config: false } },
  { role: 'analyst', label: 'Analyst', permissions: { dashboard: true, players: true, interventions: false, compliance: false, security: false, api_keys: false, user_mgmt: false, reports: true, config: false } },
  { role: 'staff', label: 'Staff', permissions: { dashboard: false, players: false, interventions: false, compliance: false, security: false, api_keys: false, user_mgmt: false, reports: false, config: false } },
];

const MATRIX_COLS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'players', label: 'Players' },
  { key: 'interventions', label: 'Interventions' },
  { key: 'compliance', label: 'Compliance' },
  { key: 'security', label: 'Security Log' },
  { key: 'api_keys', label: 'API Keys' },
  { key: 'user_mgmt', label: 'User Mgmt' },
  { key: 'reports', label: 'Reports' },
  { key: 'config', label: 'Config' },
];

export default function AccessControlPage() {
  const { user } = useAuth();
  const [policies, setPolicies] = useState<ABACPolicy[]>([]);
  const [mfaSettings, setMfaSettings] = useState<MFASetting[]>([]);
  const [ipAllowlists, setIPAllowlists] = useState<IPAllowlist[]>([]);
  const [casinos, setCasinos] = useState<Casino[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('rbac-matrix');

  const [selectedCasino, setSelectedCasino] = useState('all');
  const [effectFilter, setEffectFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [addIPDialog, setAddIPDialog] = useState(false);
  const [newIP, setNewIP] = useState({ label: '', ip_cidr: '', ip_type: 'ipv4', environment: 'all', notes: '', casino_id: '' });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [casinosRes, policiesRes, ipRes] = await Promise.all([
      supabase.from('casinos').select('id, name').eq('is_active', true).order('name'),
      supabase.from('abac_policies').select('*').order('priority').limit(200),
      supabase.from('ip_allowlists').select('*').order('created_at', { ascending: false }).limit(200),
    ]);
    if (casinosRes.data) setCasinos(casinosRes.data);
    if (policiesRes.data) setPolicies(policiesRes.data);
    if (ipRes.data) setIPAllowlists(ipRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredPolicies = policies.filter(p => {
    if (effectFilter !== 'all' && p.effect !== effectFilter) return false;
    if (roleFilter !== 'all' && p.subject_role !== roleFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!p.policy_name.toLowerCase().includes(q) && !p.resource.toLowerCase().includes(q) && !p.subject_role.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const mfaStats = {
    enforced: mfaSettings.filter(m => m.mfa_enforced).length,
    totpEnabled: mfaSettings.filter(m => m.totp_enabled).length,
    smsEnabled: mfaSettings.filter(m => m.sms_enabled).length,
    hardwareKey: mfaSettings.filter(m => m.hardware_key_enabled).length,
  };

  const handleAddIP = async () => {
    const { error } = await supabase.from('ip_allowlists').insert({
      ...newIP,
      casino_id: newIP.casino_id || null,
      is_active: true,
    });
    if (!error) {
      setAddIPDialog(false);
      setNewIP({ label: '', ip_cidr: '', ip_type: 'ipv4', environment: 'all', notes: '', casino_id: '' });
      loadData();
    }
  };

  const toggleIPActive = async (id: string, current: boolean) => {
    await supabase.from('ip_allowlists').update({ is_active: !current }).eq('id', id);
    loadData();
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Shield className="h-6 w-6 text-slate-700" />
              Access Control Management
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              RBAC + ABAC policy management — Zero Trust architecture per ISO 27001 A.9 / POPIA s.14
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => loadData()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'ABAC Policies', value: policies.length, icon: Shield, color: 'text-slate-700' },
            { label: 'Active Policies', value: policies.filter(p => p.is_active).length, icon: ShieldCheck, color: 'text-emerald-700' },
            { label: 'Deny Rules', value: policies.filter(p => p.effect === 'deny').length, icon: XCircle, color: 'text-red-700' },
            { label: 'IP Allowlists', value: ipAllowlists.filter(ip => ip.is_active).length, icon: Network, color: 'text-blue-700' },
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
            <TabsTrigger value="rbac-matrix">RBAC Matrix</TabsTrigger>
            <TabsTrigger value="abac-policies">ABAC Policies</TabsTrigger>
            <TabsTrigger value="mfa">MFA Settings</TabsTrigger>
            <TabsTrigger value="ip-allowlist">IP Allowlist</TabsTrigger>
          </TabsList>

          <TabsContent value="rbac-matrix" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Role Permission Matrix</CardTitle>
                <CardDescription>Read-only view of baseline RBAC permissions per role — enforced via Supabase RLS</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="w-48">Role</TableHead>
                        {MATRIX_COLS.map(col => (
                          <TableHead key={col.key} className="text-center text-xs">{col.label}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {RBAC_MATRIX.map(row => (
                        <TableRow key={row.role}>
                          <TableCell>
                            <Badge className={cn('text-xs font-medium', ROLE_COLORS[row.role] ?? 'bg-slate-200 text-slate-700')}>
                              {row.label}
                            </Badge>
                          </TableCell>
                          {MATRIX_COLS.map(col => (
                            <TableCell key={col.key} className="text-center">
                              {(row.permissions as Record<string, boolean>)[col.key] ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto" />
                              ) : (
                                <XCircle className="h-4 w-4 text-slate-300 mx-auto" />
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="p-4 bg-blue-50 border-t border-blue-100 text-xs text-blue-800 flex items-start gap-2">
                  <Lock className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>
                    All permissions above are enforced at the database layer via PostgreSQL Row Level Security (RLS) policies.
                    Application-level checks are secondary. Data isolation is guaranteed even for direct database access.
                    Policy changes require a Super Admin and generate an immutable audit log entry.
                  </span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="abac-policies" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">Attribute-Based Access Control Policies</CardTitle>
                    <CardDescription>Fine-grained policies evaluated in addition to RBAC</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Search policies..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="h-8 w-48 text-sm"
                    />
                    <Select value={effectFilter} onValueChange={setEffectFilter}>
                      <SelectTrigger className="h-8 w-28 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Effects</SelectItem>
                        <SelectItem value="allow">Allow</SelectItem>
                        <SelectItem value="deny">Deny</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                      <SelectTrigger className="h-8 w-40 text-xs">
                        <SelectValue placeholder="All Roles" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                        <SelectItem value="national_regulator">National Regulator</SelectItem>
                        <SelectItem value="casino_admin">Casino Admin</SelectItem>
                        <SelectItem value="compliance_officer">Compliance Officer</SelectItem>
                        <SelectItem value="analyst">Analyst</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Policy Name</TableHead>
                      <TableHead>Subject Role</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Effect</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-400">Loading policies...</TableCell></TableRow>
                    ) : filteredPolicies.map(policy => {
                      const ActionIcon = ACTION_ICONS[policy.action] ?? Shield;
                      return (
                        <TableRow key={policy.id} className="text-sm">
                          <TableCell>
                            <div className="font-medium text-slate-800">{policy.policy_name}</div>
                            {policy.description && <div className="text-xs text-slate-400 mt-0.5">{policy.description}</div>}
                          </TableCell>
                          <TableCell>
                            <Badge className={cn('text-xs', ROLE_COLORS[policy.subject_role] ?? 'bg-slate-100 text-slate-700')}>
                              {policy.subject_role.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">{policy.resource}</code>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-xs">
                              <ActionIcon className="h-3.5 w-3.5 text-slate-500" />
                              <span className="capitalize">{policy.action}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('text-xs', policy.effect === 'allow' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200')}>
                              {policy.effect === 'allow' ? <CheckCircle2 className="h-3 w-3 mr-1 inline" /> : <XCircle className="h-3 w-3 mr-1 inline" />}
                              {policy.effect.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs font-mono text-slate-500">{policy.priority}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('text-xs', policy.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-500 border-slate-200')}>
                              {policy.is_active ? 'Active' : 'Disabled'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mfa" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Fingerprint className="h-5 w-5" />
                    MFA Policy Configuration
                  </CardTitle>
                  <CardDescription>Multi-Factor Authentication enforcement settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { label: 'Super Admins', required: true, methods: ['TOTP', 'Hardware Key'], note: 'Mandatory — no exceptions' },
                    { label: 'National Regulators', required: true, methods: ['TOTP', 'SMS', 'Hardware Key'], note: 'Mandatory per POPIA s.22' },
                    { label: 'Provincial Regulators', required: true, methods: ['TOTP', 'SMS'], note: 'Mandatory per governance policy' },
                    { label: 'Casino Admins', required: true, methods: ['TOTP', 'SMS'], note: 'Mandatory per operator agreement' },
                    { label: 'Compliance Officers', required: true, methods: ['TOTP', 'SMS'], note: 'Required for audit access' },
                    { label: 'Staff', required: false, methods: ['TOTP'], note: 'Recommended, not enforced' },
                  ].map(row => (
                    <div key={row.label} className="flex items-start justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <div className="text-sm font-medium text-slate-800">{row.label}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{row.note}</div>
                        <div className="flex gap-1 mt-1">
                          {row.methods.map(m => (
                            <Badge key={m} variant="outline" className="text-xs bg-white">{m}</Badge>
                          ))}
                        </div>
                      </div>
                      <Badge className={cn('text-xs', row.required ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600')}>
                        {row.required ? 'Required' : 'Optional'}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    Hardware Security Key Support
                  </CardTitle>
                  <CardDescription>FIDO2 / WebAuthn hardware key configuration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-slate-900 rounded-lg p-4 text-slate-100 text-sm font-mono space-y-2">
                    <div className="text-slate-400 text-xs">FIDO2 / WebAuthn Configuration</div>
                    <div><span className="text-blue-400">rp_id:</span> safebetiq.com</div>
                    <div><span className="text-blue-400">attestation:</span> direct</div>
                    <div><span className="text-blue-400">authenticator:</span> cross-platform</div>
                    <div><span className="text-blue-400">resident_key:</span> required (admins)</div>
                    <div><span className="text-blue-400">user_verification:</span> required</div>
                    <div><span className="text-blue-400">algorithms:</span> ES256, RS256</div>
                  </div>
                  <div className="space-y-2">
                    {[
                      { label: 'YubiKey 5 Series', supported: true },
                      { label: 'Google Titan Key', supported: true },
                      { label: 'FEITIAN ePass', supported: true },
                      { label: 'Touch ID / Face ID (passkey)', supported: true },
                      { label: 'Windows Hello', supported: true },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between text-sm p-2 bg-slate-50 rounded">
                        <span className="text-slate-700">{item.label}</span>
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                          <CheckCircle2 className="h-3 w-3 mr-1 inline" />Supported
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Session Security Controls
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Session Timeout', value: '30 minutes', detail: 'Inactivity auto-logout', status: 'enforced' },
                      { label: 'Max Sessions', value: '3 concurrent', detail: 'Per user account', status: 'enforced' },
                      { label: 'JWT Expiry', value: '1 hour', detail: 'Access token lifetime', status: 'enforced' },
                      { label: 'Refresh Window', value: '7 days', detail: 'Refresh token lifetime', status: 'enforced' },
                      { label: 'Login Lockout', value: '5 attempts', detail: 'Then 15-min lockout', status: 'enforced' },
                      { label: 'IP Binding', value: 'Soft check', detail: 'Alert on IP change', status: 'monitoring' },
                      { label: 'Device Trust', value: 'Fingerprint', detail: 'SHA-256 hashed', status: 'enforced' },
                      { label: 'SSO Support', value: 'OIDC / SAML', detail: 'Enterprise SSO ready', status: 'available' },
                    ].map(ctrl => (
                      <div key={ctrl.label} className="p-3 bg-slate-50 rounded-lg">
                        <div className="text-xs text-slate-500 uppercase tracking-wide">{ctrl.label}</div>
                        <div className="text-sm font-bold text-slate-800 mt-1">{ctrl.value}</div>
                        <div className="text-xs text-slate-500">{ctrl.detail}</div>
                        <Badge className={cn('text-xs mt-2', {
                          'bg-green-100 text-green-700': ctrl.status === 'enforced',
                          'bg-amber-100 text-amber-700': ctrl.status === 'monitoring',
                          'bg-blue-100 text-blue-700': ctrl.status === 'available',
                        })}>
                          {ctrl.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="ip-allowlist" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Globe className="h-5 w-5" />
                      IP Allowlist Management
                    </CardTitle>
                    <CardDescription>Restrict API access to trusted IP ranges per casino operator</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setAddIPDialog(true)} className="gap-2 bg-slate-800 hover:bg-slate-700 text-white">
                    <Plus className="h-4 w-4" />
                    Add IP Range
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Label</TableHead>
                      <TableHead>IP / CIDR</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Environment</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Toggle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-400">Loading...</TableCell></TableRow>
                    ) : ipAllowlists.map(ip => (
                      <TableRow key={ip.id} className="text-sm">
                        <TableCell className="font-medium text-slate-800">{ip.label}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-slate-100 px-2 py-0.5 rounded font-mono">{ip.ip_cidr}</code>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{ip.ip_type.toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">{ip.environment}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 max-w-[200px] truncate">{ip.notes ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('text-xs', ip.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-400')}>
                            {ip.is_active ? 'Active' : 'Disabled'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => toggleIPActive(ip.id, ip.is_active)}
                          >
                            {ip.is_active ? 'Disable' : 'Enable'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={addIPDialog} onOpenChange={setAddIPDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add IP Range</DialogTitle>
            <DialogDescription>Add a trusted IP address or CIDR range to the allowlist</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Label</label>
              <Input value={newIP.label} onChange={e => setNewIP(p => ({ ...p, label: e.target.value }))} placeholder="e.g. Primary Office" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">IP / CIDR</label>
              <Input value={newIP.ip_cidr} onChange={e => setNewIP(p => ({ ...p, ip_cidr: e.target.value }))} placeholder="e.g. 196.25.1.0/24" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Type</label>
                <Select value={newIP.ip_type} onValueChange={v => setNewIP(p => ({ ...p, ip_type: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ipv4">IPv4</SelectItem>
                    <SelectItem value="ipv6">IPv6</SelectItem>
                    <SelectItem value="cidr">CIDR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Environment</label>
                <Select value={newIP.environment} onValueChange={v => setNewIP(p => ({ ...p, environment: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Casino (optional)</label>
              <Select value={newIP.casino_id} onValueChange={v => setNewIP(p => ({ ...p, casino_id: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Platform-wide" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Platform-wide</SelectItem>
                  {casinos.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Notes</label>
              <Input value={newIP.notes} onChange={e => setNewIP(p => ({ ...p, notes: e.target.value }))} placeholder="Optional description" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={() => setAddIPDialog(false)}>Cancel</Button>
              <Button size="sm" onClick={handleAddIP} disabled={!newIP.label || !newIP.ip_cidr} className="bg-slate-800 hover:bg-slate-700 text-white">
                Add IP Range
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
