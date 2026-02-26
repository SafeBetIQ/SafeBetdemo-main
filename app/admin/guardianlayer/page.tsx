'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Shield, AlertTriangle, Monitor, Brain, Clock, TrendingUp, TrendingDown, Minus, MapPin, Zap, Users, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  fetchMinorRiskScores, fetchDeviceIntelligence, fetchIdentityDrift,
  fetchSchoolHourFlags, fetchInterventionSignals, fetchOperatorRiskSummaries,
  fetchProvinceRiskSummaries, getRiskCategoryBg, getResponseStatusColor,
  type MinorRiskScore, type DeviceIntelligence, type IdentityDrift,
  type InterventionSignal, type OperatorRiskSummary, type ProvinceRiskSummary
} from '@/lib/guardianLayerService';

const CASINO_NAMES: Record<string, string> = {
  '11111111-1111-1111-1111-111111111111': 'Royal Palace Casino',
  '22222222-2222-2222-2222-222222222222': 'Golden Dragon Gaming',
  '33333333-3333-3333-3333-333333333333': 'Silver Star Resort',
};

export default function GuardianLayerAdminPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [riskScores, setRiskScores] = useState<MinorRiskScore[]>([]);
  const [devices, setDevices] = useState<DeviceIntelligence[]>([]);
  const [drifts, setDrifts] = useState<IdentityDrift[]>([]);
  const [schoolFlags, setSchoolFlags] = useState<any[]>([]);
  const [signals, setSignals] = useState<InterventionSignal[]>([]);
  const [operatorSummaries, setOperatorSummaries] = useState<OperatorRiskSummary[]>([]);
  const [provinceSummaries, setProvinceSummaries] = useState<ProvinceRiskSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [rs, dev, dr, sf, sig, ops, prov] = await Promise.all([
          fetchMinorRiskScores(undefined, 100),
          fetchDeviceIntelligence(undefined, 100),
          fetchIdentityDrift(undefined, 78),
          fetchSchoolHourFlags(undefined, 100),
          fetchInterventionSignals(undefined, 100),
          fetchOperatorRiskSummaries(),
          fetchProvinceRiskSummaries(),
        ]);
        setRiskScores(rs);
        setDevices(dev);
        setDrifts(dr);
        setSchoolFlags(sf);
        setSignals(sig);
        setOperatorSummaries(ops);
        setProvinceSummaries(prov);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const criticalCount = riskScores.filter(r => r.risk_category === 'Critical').length;
  const highCount = riskScores.filter(r => r.risk_category === 'High').length;
  const highRiskDevices = devices.filter(d => d.high_risk_device).length;
  const pendingSignals = signals.filter(s => s.casino_response_status === 'pending').length;
  const schoolHourFlags = schoolFlags.filter(f => f.is_school_hours && f.is_weekday).length;
  const escalations = signals.filter(s => s.escalation_stage >= 3).length;

  const latestByProvince = ['Gauteng', 'Western Cape', 'KwaZulu-Natal'].map(prov => {
    const latest = provinceSummaries.filter(p => p.province === prov)[0];
    return latest || { province: prov, province_risk_index: 0, school_hour_risk_score: 0, compliance_rate: 0 };
  });

  const trendData = Array.from({ length: 12 }, (_, i) => {
    const month = new Date();
    month.setMonth(month.getMonth() - (11 - i));
    const label = month.toLocaleString('default', { month: 'short' });
    const royal = operatorSummaries.find(o => o.casino_id === '11111111-1111-1111-1111-111111111111' && new Date(o.summary_date).getMonth() === month.getMonth());
    const golden = operatorSummaries.find(o => o.casino_id === '22222222-2222-2222-2222-222222222222' && new Date(o.summary_date).getMonth() === month.getMonth());
    const silver = operatorSummaries.find(o => o.casino_id === '33333333-3333-3333-3333-333333333333' && new Date(o.summary_date).getMonth() === month.getMonth());
    return {
      month: label,
      'Royal Palace': royal?.underage_suspicion_rate ?? 0,
      'Golden Dragon': golden?.underage_suspicion_rate ?? 0,
      'Silver Star': silver?.underage_suspicion_rate ?? 0,
    };
  });

  const latestOperatorData = ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333'].map(id => {
    const latest = operatorSummaries.filter(o => o.casino_id === id)[0];
    return {
      casino: CASINO_NAMES[id] || id,
      casino_id: id,
      suspicionRate: latest?.underage_suspicion_rate ?? 0,
      deviceRisk: latest?.device_risk_index ?? 0,
      responseTime: latest?.average_response_time_minutes ?? 0,
      compliance: latest?.escalation_compliance_percent ?? 0,
      interventions: latest?.total_interventions ?? 0,
      pending: latest?.interventions_pending ?? 0,
      ranking: latest?.national_risk_ranking ?? 0,
    };
  });

  const nationalRiskIndex = latestOperatorData.length > 0
    ? (latestOperatorData.reduce((acc, o) => acc + o.suspicionRate, 0) / latestOperatorData.length).toFixed(3)
    : '0.000';

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-3 text-cyan-500">
            <Shield className="w-8 h-8 animate-pulse" />
            <span className="text-lg font-medium text-foreground">GuardianLayer AI Loading...</span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-full bg-background">
        {/* Header */}
        <div className="border-b border-border bg-card px-6 py-5">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-cyan-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-foreground">GuardianLayer</h1>
                    <Badge variant="outline" className="text-xs border-cyan-500/40 text-cyan-600 bg-cyan-500/10">SUPER ADMIN</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">Independent AI Minor Risk Intelligence Engine — Compliance Oversight Layer</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  <span className="text-xs text-green-600 font-medium">AI Engine Active</span>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div>National Minor Risk Index</div>
                  <div className="text-xl font-bold text-orange-500">{nationalRiskIndex}</div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {['Independent AI Oversight Layer', 'Compliance Intelligence Infrastructure', 'Not a Gambling Platform', 'Not Payment Processing', 'Not a KYC Replacement', 'Designed for Licensed Operators'].map(label => (
                <span key={label} className="text-xs bg-muted border border-border text-muted-foreground px-2 py-0.5 rounded">
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            {[
              { label: 'Critical Risk Players', value: criticalCount, icon: AlertTriangle, color: 'text-red-500', bg: 'border-red-500/30 bg-red-500/5' },
              { label: 'High Risk Players', value: highCount, icon: TrendingUp, color: 'text-orange-500', bg: 'border-orange-500/30 bg-orange-500/5' },
              { label: 'High-Risk Devices', value: highRiskDevices, icon: Monitor, color: 'text-yellow-500', bg: 'border-yellow-500/30 bg-yellow-500/5' },
              { label: 'Identity Drift Alerts', value: drifts.length, icon: Brain, color: 'text-blue-500', bg: 'border-blue-500/30 bg-blue-500/5' },
              { label: 'School-Hour Flags', value: schoolHourFlags, icon: Clock, color: 'text-cyan-500', bg: 'border-cyan-500/30 bg-cyan-500/5' },
              { label: 'Pending Signals', value: pendingSignals, icon: Zap, color: 'text-pink-500', bg: 'border-pink-500/30 bg-pink-500/5' },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <Card key={label} className={`border ${bg}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Icon className={`w-4 h-4 ${color}`} />
                    <span className={`text-2xl font-bold ${color}`}>{value}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Main Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6 flex-wrap h-auto gap-1 p-1">
              {[
                { id: 'overview', label: 'Overview', icon: BarChart3 },
                { id: 'risk-scores', label: 'Minor Risk Dashboard', icon: AlertTriangle },
                { id: 'devices', label: 'Device Intelligence', icon: Monitor },
                { id: 'drift', label: 'Identity Drift AI', icon: Brain },
                { id: 'school', label: 'School-Hour Monitor', icon: Clock },
                { id: 'signals', label: 'Intervention Signals', icon: Zap },
                { id: 'heatmap', label: 'Risk Heatmap', icon: MapPin },
              ].map(({ id, label, icon: Icon }) => (
                <TabsTrigger key={id} value={id} className="text-xs flex items-center gap-1">
                  <Icon className="w-3 h-3" />{label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Overview */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-cyan-500" />
                      Underage Suspicion Rate — 12 Month Trend
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                        <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }} />
                        <Legend />
                        <Line type="monotone" dataKey="Royal Palace" stroke="#F87171" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="Golden Dragon" stroke="#FBBF24" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="Silver Star" stroke="#34D399" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users className="w-4 h-4 text-cyan-500" />
                      Operator Risk Comparison
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {latestOperatorData.map(op => (
                        <div key={op.casino_id} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-medium text-foreground">{op.casino}</span>
                            <span className="text-orange-500 font-bold">{op.suspicionRate.toFixed(3)}%</span>
                          </div>
                          <Progress value={Math.min(100, op.suspicionRate * 10)} className="h-1.5" />
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            <span>Device Risk: <span className="text-yellow-500">{op.deviceRisk.toFixed(3)}</span></span>
                            <span>Compliance: <span className="text-green-500">{op.compliance.toFixed(1)}%</span></span>
                            <span>Rank: <span className="text-cyan-500">#{op.ranking}</span></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-cyan-500" />
                    Province Risk Ranking
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {latestByProvince.map((prov, i) => (
                      <div key={prov.province} className="bg-muted/40 rounded-xl border border-border p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-semibold text-foreground">{prov.province}</span>
                          <Badge variant="outline" className={`text-xs ${i === 0 ? 'border-red-500/40 text-red-500 bg-red-500/10' : i === 1 ? 'border-yellow-500/40 text-yellow-600 bg-yellow-500/10' : 'border-orange-500/40 text-orange-500 bg-orange-500/10'}`}>
                            Rank #{i + 1}
                          </Badge>
                        </div>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Risk Index</span>
                            <span className="text-orange-500 font-bold">{prov.province_risk_index?.toFixed?.(3) ?? '0.000'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">School-Hour Risk</span>
                            <span className="text-yellow-500 font-bold">{prov.school_hour_risk_score?.toFixed?.(3) ?? '0.000'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Compliance Rate</span>
                            <span className="text-green-500 font-bold">{prov.compliance_rate?.toFixed?.(1) ?? '0.0'}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Minor Risk Dashboard */}
            <TabsContent value="risk-scores" className="space-y-4">
              <div className="grid grid-cols-4 gap-4 mb-4">
                {(['Critical', 'High', 'Medium', 'Low'] as const).map(cat => {
                  const count = riskScores.filter(r => r.risk_category === cat).length;
                  return (
                    <Card key={cat} className={`border ${cat === 'Critical' ? 'border-red-500/30 bg-red-500/5' : cat === 'High' ? 'border-orange-500/30 bg-orange-500/5' : cat === 'Medium' ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-green-500/30 bg-green-500/5'}`}>
                      <CardContent className="p-4 text-center">
                        <div className={`text-3xl font-bold ${cat === 'Critical' ? 'text-red-500' : cat === 'High' ? 'text-orange-500' : cat === 'Medium' ? 'text-yellow-500' : 'text-green-500'}`}>{count}</div>
                        <div className="text-xs text-muted-foreground mt-1">{cat}</div>
                        <div className="text-xs text-muted-foreground/60">{cat === 'Critical' ? '80-100' : cat === 'High' ? '60-79' : cat === 'Medium' ? '30-59' : '0-29'}</div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Minor Risk Score Engine — Player Records</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="text-left py-2 px-3">Player</th>
                          <th className="text-left py-2 px-3">Operator</th>
                          <th className="text-right py-2 px-3">Risk Score</th>
                          <th className="text-center py-2 px-3">Category</th>
                          <th className="text-center py-2 px-3">Trend</th>
                          <th className="text-right py-2 px-3">Delta</th>
                          <th className="text-center py-2 px-3">School-Hour</th>
                          <th className="text-right py-2 px-3">Loss Chase</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {riskScores.slice(0, 30).map(rs => (
                          <tr key={rs.id} className="hover:bg-muted/40">
                            <td className="py-2 px-3 text-foreground">
                              {rs.players ? `${rs.players.first_name} ${rs.players.last_name}` : rs.player_id.slice(0, 8)}
                            </td>
                            <td className="py-2 px-3 text-muted-foreground text-xs">{CASINO_NAMES[rs.casino_id] || 'Unknown'}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-foreground">{Number(rs.risk_score).toFixed(3)}</td>
                            <td className="py-2 px-3 text-center">
                              <Badge className={`text-xs border ${getRiskCategoryBg(rs.risk_category)}`}>{rs.risk_category}</Badge>
                            </td>
                            <td className="py-2 px-3 text-center">
                              {rs.risk_trend === 'increasing' ? <TrendingUp className="w-3 h-3 text-red-500 mx-auto" /> : rs.risk_trend === 'decreasing' ? <TrendingDown className="w-3 h-3 text-green-500 mx-auto" /> : <Minus className="w-3 h-3 text-muted-foreground mx-auto" />}
                            </td>
                            <td className={`py-2 px-3 text-right font-mono text-xs ${Number(rs.risk_change_delta) > 0 ? 'text-red-500' : 'text-green-500'}`}>
                              {Number(rs.risk_change_delta) > 0 ? '+' : ''}{Number(rs.risk_change_delta).toFixed(3)}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {rs.school_hour_activity_flag ? <span className="text-yellow-500 font-bold">YES</span> : <span className="text-muted-foreground/40">—</span>}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-foreground">{Number(rs.loss_chasing_score).toFixed(3)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Device Intelligence */}
            <TabsContent value="devices" className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <Card className="border-red-500/30 bg-red-500/5">
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-red-500">{devices.filter(d => d.high_risk_device).length}</div>
                    <div className="text-xs text-muted-foreground mt-1">High-Risk Devices</div>
                  </CardContent>
                </Card>
                <Card className="border-orange-500/30 bg-orange-500/5">
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-orange-500">{devices.filter(d => d.repeat_flagged).length}</div>
                    <div className="text-xs text-muted-foreground mt-1">Repeat Flagged</div>
                  </CardContent>
                </Card>
                <Card className="border-yellow-500/30 bg-yellow-500/5">
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-yellow-500">{devices.filter(d => d.session_overlap_detected).length}</div>
                    <div className="text-xs text-muted-foreground mt-1">Session Overlaps</div>
                  </CardContent>
                </Card>
                <Card className="border-cyan-500/30 bg-cyan-500/5">
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-cyan-500">{devices.length}</div>
                    <div className="text-xs text-muted-foreground mt-1">Total Devices Tracked</div>
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Device Intelligence Engine — Active Devices</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="text-left py-2 px-3">Device ID</th>
                          <th className="text-left py-2 px-3">Operator</th>
                          <th className="text-right py-2 px-3">Shift Score</th>
                          <th className="text-right py-2 px-3">Shared Prob.</th>
                          <th className="text-right py-2 px-3">IP Consistency</th>
                          <th className="text-center py-2 px-3">Accounts</th>
                          <th className="text-center py-2 px-3">Cluster</th>
                          <th className="text-center py-2 px-3">High Risk</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {devices.slice(0, 30).map(dev => (
                          <tr key={dev.id} className="hover:bg-muted/40">
                            <td className="py-2 px-3 font-mono text-cyan-600">{dev.device_id}</td>
                            <td className="py-2 px-3 text-muted-foreground">{CASINO_NAMES[dev.casino_id] || 'Unknown'}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-orange-500">{Number(dev.device_identity_shift_score).toFixed(3)}</td>
                            <td className="py-2 px-3 text-right font-mono text-foreground">{Number(dev.shared_device_probability).toFixed(3)}</td>
                            <td className="py-2 px-3 text-right font-mono text-foreground">{Number(dev.ip_consistency_score).toFixed(3)}</td>
                            <td className="py-2 px-3 text-center text-yellow-500">{dev.linked_accounts_count}</td>
                            <td className="py-2 px-3 text-center text-xs text-muted-foreground">{dev.login_pattern_cluster?.replace('_', ' ') || '—'}</td>
                            <td className="py-2 px-3 text-center">
                              {dev.high_risk_device ? <Badge className="bg-red-500/10 text-red-500 border-red-500/30 text-xs">HIGH RISK</Badge> : <span className="text-muted-foreground/40">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Identity Drift AI */}
            <TabsContent value="drift" className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <Card className="border-red-500/30 bg-red-500/5">
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-red-500">{drifts.filter(d => d.drift_threshold_exceeded).length}</div>
                    <div className="text-xs text-muted-foreground mt-1">Threshold Exceeded</div>
                  </CardContent>
                </Card>
                <Card className="border-orange-500/30 bg-orange-500/5">
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-orange-500">{drifts.filter(d => d.drift_spike_detected).length}</div>
                    <div className="text-xs text-muted-foreground mt-1">Drift Spikes</div>
                  </CardContent>
                </Card>
                <Card className="border-yellow-500/30 bg-yellow-500/5">
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-yellow-500">{drifts.filter(d => d.intervention_recommended).length}</div>
                    <div className="text-xs text-muted-foreground mt-1">Intervention Rec.</div>
                  </CardContent>
                </Card>
                <Card className="border-cyan-500/30 bg-cyan-500/5">
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-cyan-500">{drifts.filter(d => d.repeat_drift_flag).length}</div>
                    <div className="text-xs text-muted-foreground mt-1">Repeat Flags</div>
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Identity Drift AI — Behavioral Signature Changes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="text-left py-2 px-3">Player</th>
                          <th className="text-left py-2 px-3">Device</th>
                          <th className="text-right py-2 px-3">Drift Score</th>
                          <th className="text-center py-2 px-3">Sig. Change</th>
                          <th className="text-center py-2 px-3">Time Shift</th>
                          <th className="text-center py-2 px-3">Stake Shift</th>
                          <th className="text-right py-2 px-3">Cross-Acct Sim.</th>
                          <th className="text-center py-2 px-3">Intervention</th>
                          <th className="text-left py-2 px-3">Detected</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {drifts.slice(0, 30).map(d => (
                          <tr key={d.id} className="hover:bg-muted/40">
                            <td className="py-2 px-3 text-foreground">
                              {d.players ? `${d.players.first_name} ${d.players.last_name}` : d.player_id.slice(0, 8)}
                            </td>
                            <td className="py-2 px-3 font-mono text-cyan-600 text-xs">{d.device_id}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-orange-500">{Number(d.drift_score).toFixed(3)}</td>
                            <td className="py-2 px-3 text-center">{d.behavioral_signature_change ? <span className="text-red-500">YES</span> : <span className="text-muted-foreground/40">—</span>}</td>
                            <td className="py-2 px-3 text-center">{d.time_of_day_shift ? <span className="text-yellow-500">YES</span> : <span className="text-muted-foreground/40">—</span>}</td>
                            <td className="py-2 px-3 text-center">{d.stake_size_shift ? <span className="text-orange-500">YES</span> : <span className="text-muted-foreground/40">—</span>}</td>
                            <td className="py-2 px-3 text-right font-mono text-foreground">{Number(d.cross_account_similarity_score).toFixed(3)}</td>
                            <td className="py-2 px-3 text-center">
                              {d.intervention_recommended ? <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/30 text-xs">REC.</Badge> : <span className="text-muted-foreground/40">—</span>}
                            </td>
                            <td className="py-2 px-3 text-muted-foreground">{new Date(d.detected_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* School-Hour Monitoring */}
            <TabsContent value="school" className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {[
                  { label: 'School-Hour Sessions', value: schoolFlags.filter(f => f.is_school_hours).length, color: 'text-red-500', border: 'border-red-500/30 bg-red-500/5' },
                  { label: 'Weekday Flags', value: schoolFlags.filter(f => f.is_weekday && f.is_school_hours).length, color: 'text-orange-500', border: 'border-orange-500/30 bg-orange-500/5' },
                  { label: 'Within School Zone', value: schoolFlags.filter(f => f.within_school_zone).length, color: 'text-yellow-500', border: 'border-yellow-500/30 bg-yellow-500/5' },
                  { label: 'High Risk Multiplier (>1.5)', value: schoolFlags.filter(f => f.risk_multiplier > 1.5).length, color: 'text-cyan-500', border: 'border-cyan-500/30 bg-cyan-500/5' },
                ].map(({ label, value, color, border }) => (
                  <Card key={label} className={`border ${border}`}>
                    <CardContent className="p-4 text-center">
                      <div className={`text-3xl font-bold ${color}`}>{value}</div>
                      <div className="text-xs text-muted-foreground mt-1">{label}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">School-Hour Monitoring Engine — Session Flags</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="text-left py-2 px-3">Player</th>
                          <th className="text-left py-2 px-3">Province</th>
                          <th className="text-left py-2 px-3">Session Start</th>
                          <th className="text-center py-2 px-3">School Hours</th>
                          <th className="text-center py-2 px-3">Weekday</th>
                          <th className="text-center py-2 px-3">School Zone</th>
                          <th className="text-right py-2 px-3">Activity Ratio</th>
                          <th className="text-right py-2 px-3">Risk Multiplier</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {schoolFlags.slice(0, 30).map((f: any) => (
                          <tr key={f.id} className={`hover:bg-muted/40 ${f.is_school_hours && f.is_weekday ? 'bg-red-500/5' : ''}`}>
                            <td className="py-2 px-3 text-foreground">
                              {f.players ? `${f.players.first_name} ${f.players.last_name}` : f.player_id?.slice(0, 8)}
                            </td>
                            <td className="py-2 px-3 text-muted-foreground">{f.province || '—'}</td>
                            <td className="py-2 px-3 text-muted-foreground">{new Date(f.session_start).toLocaleString()}</td>
                            <td className="py-2 px-3 text-center">{f.is_school_hours ? <span className="text-red-500 font-bold">YES</span> : <span className="text-muted-foreground/40">—</span>}</td>
                            <td className="py-2 px-3 text-center">{f.is_weekday ? <span className="text-orange-500">YES</span> : <span className="text-muted-foreground/40">—</span>}</td>
                            <td className="py-2 px-3 text-center">{f.within_school_zone ? <span className="text-yellow-500">YES</span> : <span className="text-muted-foreground/40">—</span>}</td>
                            <td className="py-2 px-3 text-right font-mono text-foreground">{Number(f.school_hour_activity_ratio).toFixed(3)}</td>
                            <td className={`py-2 px-3 text-right font-mono font-bold ${Number(f.risk_multiplier) > 1.5 ? 'text-red-500' : Number(f.risk_multiplier) > 1.0 ? 'text-orange-500' : 'text-muted-foreground'}`}>
                              {Number(f.risk_multiplier).toFixed(3)}x
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Intervention Signals */}
            <TabsContent value="signals" className="space-y-4">
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-4">
                {['pending', 'acknowledged', 'investigating', 'action_taken', 'resolved', 'dismissed'].map(status => {
                  const count = signals.filter(s => s.casino_response_status === status).length;
                  return (
                    <Card key={status}>
                      <CardContent className="p-3 text-center">
                        <div className="text-xl font-bold text-foreground">{count}</div>
                        <Badge variant="outline" className={`text-xs mt-1 ${getResponseStatusColor(status)}`}>{status.replace('_', ' ')}</Badge>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Intervention Signal System — Independent Compliance Signals</CardTitle>
                  <p className="text-xs text-muted-foreground">GuardianLayer does NOT enforce blocking. These are intelligence signals only.</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {signals.slice(0, 20).map(sig => (
                      <div key={sig.id} className="bg-muted/30 border border-border rounded-lg p-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <Badge variant="outline" className={`text-xs ${sig.signal_type === 'Compliance escalation triggered' ? 'border-red-500/40 text-red-500 bg-red-500/10' : sig.signal_type === 'Temporary freeze suggested' ? 'border-orange-500/40 text-orange-500 bg-orange-500/10' : 'border-yellow-500/40 text-yellow-600 bg-yellow-500/10'}`}>
                                {sig.signal_type}
                              </Badge>
                              <Badge variant="outline" className={`text-xs ${getResponseStatusColor(sig.casino_response_status)}`}>
                                {sig.casino_response_status.replace('_', ' ')}
                              </Badge>
                              {sig.escalation_stage >= 3 && (
                                <Badge variant="outline" className="border-red-500/40 text-red-500 bg-red-500/10 text-xs">Stage {sig.escalation_stage} Escalation</Badge>
                              )}
                            </div>
                            <p className="text-xs text-foreground mb-1">{sig.trigger_reason}</p>
                            <div className="flex gap-4 text-xs text-muted-foreground">
                              <span>Player: <span className="text-foreground">{sig.players ? `${sig.players.first_name} ${sig.players.last_name}` : sig.player_id?.slice(0, 8)}</span></span>
                              <span>Operator: <span className="text-foreground">{CASINO_NAMES[sig.casino_id] || 'Unknown'}</span></span>
                              {sig.response_time_minutes && <span>Response: <span className="text-cyan-600">{sig.response_time_minutes}min</span></span>}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-lg font-bold text-orange-500">{Number(sig.risk_score).toFixed(3)}</div>
                            <div className="text-xs text-muted-foreground">{new Date(sig.created_at).toLocaleDateString()}</div>
                          </div>
                        </div>
                        {sig.action_taken && (
                          <div className="mt-2 text-xs bg-green-500/10 border border-green-500/30 rounded px-2 py-1 text-green-600">
                            Action: {sig.action_taken}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Risk Heatmap */}
            <TabsContent value="heatmap" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-cyan-500" />
                      Province Risk Heatmap — South Africa
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {latestByProvince.sort((a, b) => (b.province_risk_index || 0) - (a.province_risk_index || 0)).map((prov, i) => {
                        const riskPct = Math.min(100, ((prov.province_risk_index || 0) / 10) * 100);
                        return (
                          <div key={prov.province} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-foreground font-medium">{prov.province}</span>
                              <span className={`font-bold ${i === 0 ? 'text-red-500' : i === 1 ? 'text-orange-500' : 'text-yellow-500'}`}>
                                Risk Index: {prov.province_risk_index?.toFixed?.(3) ?? '0.000'}
                              </span>
                            </div>
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${i === 0 ? 'bg-gradient-to-r from-red-600 to-red-400' : i === 1 ? 'bg-gradient-to-r from-orange-600 to-orange-400' : 'bg-gradient-to-r from-yellow-600 to-yellow-400'}`} style={{ width: `${riskPct}%` }} />
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>School-Hour Risk: {prov.school_hour_risk_score?.toFixed?.(3) ?? '0.000'}</span>
                              <span>Compliance: {prov.compliance_rate?.toFixed?.(1) ?? '0.0'}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">School-Hour Activity by Province (12 Months)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={['Gauteng', 'Western Cape', 'KwaZulu-Natal'].map(prov => {
                        const data = provinceSummaries.filter(p => p.province === prov);
                        return {
                          province: prov.replace(' ', '\n'),
                          avgSchoolRisk: data.length > 0 ? data.reduce((a, b) => a + b.school_hour_risk_score, 0) / data.length : 0,
                          avgRiskIndex: data.length > 0 ? data.reduce((a, b) => a + b.province_risk_index, 0) / data.length : 0,
                        };
                      })}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="province" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                        <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }} />
                        <Legend />
                        <Bar dataKey="avgSchoolRisk" fill="#F87171" name="Avg School-Hour Risk" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="avgRiskIndex" fill="#FBBF24" name="Avg Risk Index" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Province Risk Summary — Current Month</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="text-left py-2 px-3">Province</th>
                          <th className="text-right py-2 px-3">Risk Index</th>
                          <th className="text-right py-2 px-3">School-Hour Score</th>
                          <th className="text-right py-2 px-3">Flagged Sessions</th>
                          <th className="text-center py-2 px-3">High-Risk Operators</th>
                          <th className="text-right py-2 px-3">Avg Response Time</th>
                          <th className="text-right py-2 px-3">Compliance Rate</th>
                          <th className="text-right py-2 px-3">Holiday Comparison</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {latestByProvince.map(prov => (
                          <tr key={prov.province} className="hover:bg-muted/40">
                            <td className="py-2 px-3 text-foreground font-medium">{prov.province}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-orange-500">{prov.province_risk_index?.toFixed?.(3) ?? '—'}</td>
                            <td className="py-2 px-3 text-right font-mono text-yellow-500">{prov.school_hour_risk_score?.toFixed?.(3) ?? '—'}</td>
                            <td className="py-2 px-3 text-right text-foreground">{(prov as any).total_flagged_sessions ?? '—'}</td>
                            <td className="py-2 px-3 text-center text-foreground">{(prov as any).high_risk_operators ?? '—'}</td>
                            <td className="py-2 px-3 text-right font-mono text-foreground">{(prov as any).average_operator_response_time?.toFixed?.(3) ?? '—'}min</td>
                            <td className="py-2 px-3 text-right text-green-500 font-bold">{prov.compliance_rate?.toFixed?.(1) ?? '—'}%</td>
                            <td className={`py-2 px-3 text-right font-mono ${((prov as any).school_holiday_comparison ?? 0) > 0 ? 'text-red-500' : 'text-green-500'}`}>
                              {((prov as any).school_holiday_comparison ?? 0) > 0 ? '+' : ''}{(prov as any).school_holiday_comparison?.toFixed?.(3) ?? '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
