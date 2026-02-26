'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Shield, AlertTriangle, Monitor, Clock, TrendingUp, TrendingDown, MapPin, Activity, BarChart3, Users, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts';
import {
  fetchOperatorRiskSummaries, fetchProvinceRiskSummaries, fetchInterventionSignals,
  fetchMinorRiskScores, getResponseStatusColor,
  type OperatorRiskSummary, type ProvinceRiskSummary
} from '@/lib/guardianLayerService';

const CASINO_NAMES: Record<string, string> = {
  '11111111-1111-1111-1111-111111111111': 'Royal Palace Casino',
  '22222222-2222-2222-2222-222222222222': 'Golden Dragon Gaming',
  '33333333-3333-3333-3333-333333333333': 'Silver Star Resort',
};

export default function RegulatorGuardianLayerPage() {
  const [activeTab, setActiveTab] = useState('national');
  const [operatorSummaries, setOperatorSummaries] = useState<OperatorRiskSummary[]>([]);
  const [provinceSummaries, setProvinceSummaries] = useState<ProvinceRiskSummary[]>([]);
  const [signals, setSignals] = useState<any[]>([]);
  const [riskScores, setRiskScores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [ops, prov, sig, rs] = await Promise.all([
          fetchOperatorRiskSummaries(),
          fetchProvinceRiskSummaries(),
          fetchInterventionSignals(undefined, 100),
          fetchMinorRiskScores(undefined, 200),
        ]);
        setOperatorSummaries(ops);
        setProvinceSummaries(prov);
        setSignals(sig);
        setRiskScores(rs);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const casinoIds = ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333'];

  const latestByOperator = casinoIds.map(id => {
    const latest = operatorSummaries.filter(o => o.casino_id === id)[0];
    const { casino_id: _skip, ...rest } = latest || {} as OperatorRiskSummary;
    return { casino_id: id, name: CASINO_NAMES[id], ...rest };
  });

  const nationalRiskIndex = latestByOperator.length > 0 && latestByOperator[0].underage_suspicion_rate
    ? (latestByOperator.reduce((acc, o) => acc + (Number(o.underage_suspicion_rate) || 0), 0) / latestByOperator.length).toFixed(3)
    : '0.000';

  const totalEscalations = signals.filter(s => s.escalation_stage >= 3).length;
  const avgResponseTime = signals.filter(s => s.response_time_minutes).length > 0
    ? (signals.filter(s => s.response_time_minutes).reduce((a, s) => a + (s.response_time_minutes || 0), 0) / signals.filter(s => s.response_time_minutes).length).toFixed(1)
    : '0.0';
  const resolvedRate = signals.length > 0
    ? ((signals.filter(s => s.casino_response_status === 'resolved' || s.casino_response_status === 'action_taken').length / signals.length) * 100).toFixed(1)
    : '0.0';

  const latestByProvince = ['Gauteng', 'Western Cape', 'KwaZulu-Natal'].map(prov => {
    return provinceSummaries.filter(p => p.province === prov)[0] || { province: prov };
  });

  const trendData = Array.from({ length: 12 }, (_, i) => {
    const month = new Date();
    month.setMonth(month.getMonth() - (11 - i));
    const label = month.toLocaleString('default', { month: 'short' });
    const monthNum = month.getMonth();
    const ops = casinoIds.map(id => operatorSummaries.filter(o => o.casino_id === id && new Date(o.summary_date).getMonth() === monthNum)[0]);
    const avgSuspicion = ops.filter(Boolean).length > 0
      ? ops.filter(Boolean).reduce((a, o) => a + (Number(o!.underage_suspicion_rate) || 0), 0) / ops.filter(Boolean).length
      : 0;
    const avgResponse = ops.filter(Boolean).length > 0
      ? ops.filter(Boolean).reduce((a, o) => a + (Number(o!.average_response_time_minutes) || 0), 0) / ops.filter(Boolean).length
      : 0;
    return { month: label, nationalRiskIndex: parseFloat(avgSuspicion.toFixed(3)), avgResponseTime: parseFloat(avgResponse.toFixed(1)) };
  });

  const operatorComplianceData = latestByOperator.map(op => ({
    name: op.name?.split(' ')[0] || 'Unknown',
    suspicionRate: Number(op.underage_suspicion_rate ?? 0),
    compliance: Number((op as any).escalation_compliance_percent ?? 0),
    deviceRisk: Number((op as any).device_risk_index ?? 0) * 100,
    response: Number((op as any).average_response_time_minutes ?? 0),
  }));

  const chartTooltipStyle = {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    color: 'hsl(var(--foreground))',
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-3 text-blue-500">
            <Shield className="w-8 h-8 animate-pulse" />
            <span className="text-lg font-medium">GuardianLayer Regulator View Loading...</span>
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
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-foreground">GuardianLayer</h1>
                    <Badge variant="outline" className="text-xs border-blue-500/40 text-blue-600 bg-blue-500/10">REGULATOR VIEW</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Independent AI Minor Risk Intelligence — National Compliance Oversight</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">National Minor Risk Index</div>
                <div className="text-3xl font-bold text-orange-500">{nationalRiskIndex}</div>
                <div className="text-xs text-muted-foreground">Composite Score</div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-6">
          {/* National KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'National Minor Risk Index', value: nationalRiskIndex, sub: 'Composite avg', color: 'text-orange-500', border: 'border-orange-500/20' },
              { label: 'Total Escalations', value: totalEscalations, sub: 'Stage 3+ signals', color: 'text-red-500', border: 'border-red-500/20' },
              { label: 'Avg Response Time', value: `${avgResponseTime}min`, sub: 'Across all operators', color: 'text-yellow-500', border: 'border-yellow-500/20' },
              { label: 'Resolution Rate', value: `${resolvedRate}%`, sub: 'Resolved + Action taken', color: 'text-green-500', border: 'border-green-500/20' },
            ].map(({ label, value, sub, color, border }) => (
              <Card key={label} className={`border ${border}`}>
                <CardContent className="p-4">
                  <div className={`text-2xl font-bold ${color}`}>{value}</div>
                  <div className="text-xs text-foreground mt-1">{label}</div>
                  <div className="text-xs text-muted-foreground">{sub}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6 flex-wrap h-auto gap-1 p-1">
              <TabsTrigger value="national" className="text-xs flex items-center gap-1">
                <BarChart3 className="w-3 h-3" />National Overview
              </TabsTrigger>
              <TabsTrigger value="operators" className="text-xs flex items-center gap-1">
                <Users className="w-3 h-3" />Operator Oversight
              </TabsTrigger>
              <TabsTrigger value="provinces" className="text-xs flex items-center gap-1">
                <MapPin className="w-3 h-3" />Province Risk Ranking
              </TabsTrigger>
              <TabsTrigger value="compliance" className="text-xs flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />Compliance Reports
              </TabsTrigger>
              <TabsTrigger value="trends" className="text-xs flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />Historical Trends
              </TabsTrigger>
            </TabsList>

            {/* National Overview */}
            <TabsContent value="national" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">National Minor Risk Index — 12 Month Trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={trendData}>
                        <defs>
                          <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#F97316" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                        <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                        <Tooltip contentStyle={chartTooltipStyle} />
                        <Area type="monotone" dataKey="nationalRiskIndex" stroke="#F97316" strokeWidth={2} fill="url(#riskGrad)" name="National Risk Index" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Operator Compliance Comparison</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={operatorComplianceData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                        <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                        <Tooltip contentStyle={chartTooltipStyle} />
                        <Legend />
                        <Bar dataKey="suspicionRate" fill="#F87171" name="Suspicion Rate %" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="compliance" fill="#34D399" name="Compliance %" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Intervention signal breakdown */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">National Intervention Signal Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                    {['pending', 'acknowledged', 'investigating', 'action_taken', 'resolved', 'dismissed'].map(status => {
                      const count = signals.filter(s => s.casino_response_status === status).length;
                      return (
                        <div key={status} className="text-center">
                          <div className="text-2xl font-bold text-foreground">{count}</div>
                          <Badge className={`text-xs border mt-1 ${getResponseStatusColor(status)}`}>{status.replace('_', ' ')}</Badge>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Operator Oversight */}
            <TabsContent value="operators" className="space-y-4">
              <div className="space-y-4">
                {latestByOperator.map((op, i) => (
                  <Card key={op.casino_id}>
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${i === 0 ? 'bg-red-500/20 text-red-500' : i === 1 ? 'bg-green-500/20 text-green-500' : 'bg-orange-500/20 text-orange-500'}`}>#{(op as any).national_risk_ranking || i + 1}</div>
                          <div>
                            <h3 className="text-foreground font-semibold">{op.name}</h3>
                            <p className="text-xs text-muted-foreground">National Ranking #{(op as any).national_risk_ranking || i + 1}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-orange-500">{Number((op as any).underage_suspicion_rate ?? 0).toFixed(3)}%</div>
                          <div className="text-xs text-muted-foreground">Underage Suspicion Rate</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
                        {[
                          { label: 'Device Risk Index', value: Number((op as any).device_risk_index ?? 0).toFixed(3), color: 'text-yellow-500' },
                          { label: 'Avg Response', value: `${Number((op as any).average_response_time_minutes ?? 0).toFixed(1)}min`, color: 'text-cyan-500' },
                          { label: 'Escalation Compliance', value: `${Number((op as any).escalation_compliance_percent ?? 0).toFixed(1)}%`, color: 'text-green-500' },
                          { label: 'Pending Interventions', value: String((op as any).interventions_pending ?? 0), color: 'text-red-500' },
                          { label: 'Total Interventions', value: String((op as any).total_interventions ?? 0), color: 'text-foreground' },
                        ].map(({ label, value, color }) => (
                          <div key={label} className="bg-muted/40 rounded-lg p-2">
                            <div className={`text-lg font-bold ${color}`}>{value}</div>
                            <div className="text-muted-foreground">{label}</div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Escalation Compliance</span>
                          <span className="text-green-500">{Number((op as any).escalation_compliance_percent ?? 0).toFixed(1)}%</span>
                        </div>
                        <Progress value={Number((op as any).escalation_compliance_percent ?? 0)} className="h-1.5" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Province Risk Ranking */}
            <TabsContent value="provinces" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {latestByProvince.sort((a, b) => (Number((b as any).province_risk_index ?? 0)) - (Number((a as any).province_risk_index ?? 0))).map((prov, i) => (
                  <Card key={prov.province} className={`border ${i === 0 ? 'border-red-500/30' : i === 1 ? 'border-orange-500/30' : 'border-yellow-500/30'}`}>
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-foreground font-semibold">{prov.province}</h3>
                        <Badge variant="outline" className={`border ${i === 0 ? 'border-red-500/40 text-red-600 bg-red-500/10' : i === 1 ? 'border-orange-500/40 text-orange-600 bg-orange-500/10' : 'border-yellow-500/40 text-yellow-600 bg-yellow-500/10'}`}>
                          Risk Rank #{i + 1}
                        </Badge>
                      </div>
                      <div className="space-y-3 text-xs">
                        {[
                          { label: 'Province Risk Index', value: Number((prov as any).province_risk_index ?? 0).toFixed(3), color: 'text-orange-500' },
                          { label: 'School-Hour Risk Score', value: Number((prov as any).school_hour_risk_score ?? 0).toFixed(3), color: 'text-yellow-500' },
                          { label: 'Total Flagged Sessions', value: String((prov as any).total_flagged_sessions ?? 0), color: 'text-foreground' },
                          { label: 'High-Risk Operators', value: String((prov as any).high_risk_operators ?? 0), color: 'text-red-500' },
                          { label: 'Avg Response Time', value: `${Number((prov as any).average_operator_response_time ?? 0).toFixed(1)}min`, color: 'text-cyan-500' },
                          { label: 'Compliance Rate', value: `${Number((prov as any).compliance_rate ?? 0).toFixed(1)}%`, color: 'text-green-500' },
                          { label: 'Holiday vs Term Diff', value: `${Number((prov as any).school_holiday_comparison ?? 0) > 0 ? '+' : ''}${Number((prov as any).school_holiday_comparison ?? 0).toFixed(3)}`, color: Number((prov as any).school_holiday_comparison ?? 0) > 0 ? 'text-red-500' : 'text-green-500' },
                        ].map(({ label, value, color }) => (
                          <div key={label} className="flex justify-between">
                            <span className="text-muted-foreground">{label}</span>
                            <span className={`font-bold ${color}`}>{value}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Province School-Hour Risk Trend — 12 Months</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={Array.from({ length: 12 }, (_, i) => {
                      const month = new Date();
                      month.setMonth(month.getMonth() - (11 - i));
                      const label = month.toLocaleString('default', { month: 'short' });
                      const monthNum = month.getMonth();
                      const getVal = (prov: string) => provinceSummaries.filter(p => p.province === prov && new Date(p.summary_date).getMonth() === monthNum)[0]?.school_hour_risk_score ?? 0;
                      return { month: label, Gauteng: getVal('Gauteng'), 'Western Cape': getVal('Western Cape'), 'KwaZulu-Natal': getVal('KwaZulu-Natal') };
                    })}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Legend />
                      <Line type="monotone" dataKey="Gauteng" stroke="#F87171" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="Western Cape" stroke="#34D399" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="KwaZulu-Natal" stroke="#FBBF24" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Compliance Reports */}
            <TabsContent value="compliance" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {latestByOperator.map(op => {
                  const opSignals = signals.filter(s => s.casino_id === op.casino_id);
                  const complianceRate = opSignals.length > 0
                    ? ((opSignals.filter(s => ['resolved', 'action_taken', 'acknowledged', 'investigating'].includes(s.casino_response_status)).length / opSignals.length) * 100).toFixed(1)
                    : '0.0';
                  return (
                    <Card key={op.casino_id}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">{op.name}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-center mb-3">
                          <div className="text-3xl font-bold text-green-500">{complianceRate}%</div>
                          <div className="text-xs text-muted-foreground">Escalation Compliance</div>
                        </div>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total Signals</span>
                            <span className="text-foreground">{opSignals.length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Responded</span>
                            <span className="text-green-500">{opSignals.filter(s => s.casino_response_status !== 'pending').length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Pending</span>
                            <span className="text-red-500">{opSignals.filter(s => s.casino_response_status === 'pending').length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Resolved</span>
                            <span className="text-blue-500">{opSignals.filter(s => s.casino_response_status === 'resolved').length}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            {/* Historical Trends */}
            <TabsContent value="trends" className="space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">National Minor Risk Index — Historical Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="riskAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#F97316" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="responseAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22D3EE" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#22D3EE" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                      <YAxis yAxisId="left" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Legend />
                      <Area yAxisId="left" type="monotone" dataKey="nationalRiskIndex" stroke="#F97316" strokeWidth={2} fill="url(#riskAreaGrad)" name="National Risk Index" />
                      <Area yAxisId="right" type="monotone" dataKey="avgResponseTime" stroke="#22D3EE" strokeWidth={2} fill="url(#responseAreaGrad)" name="Avg Response (min)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Monthly Operator Underage Suspicion Rate Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={Array.from({ length: 12 }, (_, i) => {
                      const month = new Date();
                      month.setMonth(month.getMonth() - (11 - i));
                      const label = month.toLocaleString('default', { month: 'short' });
                      const monthNum = month.getMonth();
                      const get = (id: string) => operatorSummaries.filter(o => o.casino_id === id && new Date(o.summary_date).getMonth() === monthNum)[0]?.underage_suspicion_rate ?? 0;
                      return { month: label, Royal: get('11111111-1111-1111-1111-111111111111'), Golden: get('22222222-2222-2222-2222-222222222222'), Silver: get('33333333-3333-3333-3333-333333333333') };
                    })}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Legend />
                      <Line type="monotone" dataKey="Royal" stroke="#F87171" strokeWidth={2} dot={false} name="Royal Palace" />
                      <Line type="monotone" dataKey="Golden" stroke="#FBBF24" strokeWidth={2} dot={false} name="Golden Dragon" />
                      <Line type="monotone" dataKey="Silver" stroke="#34D399" strokeWidth={2} dot={false} name="Silver Star" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}
