'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Shield, AlertTriangle, Monitor, Brain, Clock, TrendingUp, TrendingDown, Minus, Zap, BarChart3, CheckCircle, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  fetchMinorRiskScores, fetchDeviceIntelligence, fetchIdentityDrift,
  fetchSchoolHourFlags, fetchInterventionSignals, fetchOperatorRiskSummaries,
  updateInterventionSignalStatus, getRiskCategoryBg, getResponseStatusColor,
  type MinorRiskScore, type DeviceIntelligence, type IdentityDrift,
  type InterventionSignal, type OperatorRiskSummary
} from '@/lib/guardianLayerService';

export default function CasinoGuardianLayerPage() {
  const casinoId = '11111111-1111-1111-1111-111111111111';
  const [activeTab, setActiveTab] = useState('dashboard');
  const [riskScores, setRiskScores] = useState<MinorRiskScore[]>([]);
  const [devices, setDevices] = useState<DeviceIntelligence[]>([]);
  const [drifts, setDrifts] = useState<IdentityDrift[]>([]);
  const [schoolFlags, setSchoolFlags] = useState<any[]>([]);
  const [signals, setSignals] = useState<InterventionSignal[]>([]);
  const [operatorSummary, setOperatorSummary] = useState<OperatorRiskSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [rs, dev, dr, sf, sig, ops] = await Promise.all([
          fetchMinorRiskScores(casinoId, 100),
          fetchDeviceIntelligence(casinoId, 50),
          fetchIdentityDrift(casinoId, 30),
          fetchSchoolHourFlags(casinoId, 50),
          fetchInterventionSignals(casinoId, 50),
          fetchOperatorRiskSummaries(casinoId),
        ]);
        setRiskScores(rs);
        setDevices(dev);
        setDrifts(dr);
        setSchoolFlags(sf);
        setSignals(sig);
        setOperatorSummary(ops[0] || null);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [casinoId]);

  const handleSignalResponse = async (signalId: string, status: string) => {
    try {
      await updateInterventionSignalStatus(signalId, status);
      setSignals(prev => prev.map(s => s.id === signalId ? { ...s, casino_response_status: status } : s));
    } catch (e) {
      console.error(e);
    }
  };

  const criticalCount = riskScores.filter(r => r.risk_category === 'Critical').length;
  const highCount = riskScores.filter(r => r.risk_category === 'High').length;
  const pendingSignals = signals.filter(s => s.casino_response_status === 'pending').length;
  const schoolHourActive = schoolFlags.filter(f => f.is_school_hours && f.is_weekday).length;

  const riskDistributionData = [
    { name: 'Critical (80-100)', value: criticalCount, fill: '#EF4444' },
    { name: 'High (60-79)', value: highCount, fill: '#F97316' },
    { name: 'Medium (30-59)', value: riskScores.filter(r => r.risk_category === 'Medium').length, fill: '#EAB308' },
    { name: 'Low (0-29)', value: riskScores.filter(r => r.risk_category === 'Low').length, fill: '#22C55E' },
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-3 text-cyan-500">
            <Shield className="w-8 h-8 animate-pulse" />
            <span className="text-lg font-medium text-foreground">GuardianLayer Loading...</span>
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
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-cyan-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-foreground">GuardianLayer</h1>
                    <Badge variant="outline" className="text-xs border-cyan-500/40 text-cyan-600 bg-cyan-500/10">CASINO VIEW</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Independent AI Minor Risk Engine — Intelligence Signals Only</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {pendingSignals > 0 && (
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-1.5 animate-pulse">
                    <AlertTriangle className="w-3 h-3 text-red-500" />
                    <span className="text-xs text-red-600 font-medium">{pendingSignals} Pending Signals</span>
                  </div>
                )}
                <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  <span className="text-xs text-green-600">AI Active</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 py-6">
          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
            {[
              { label: 'Critical Risk', value: criticalCount, color: 'text-red-500', border: 'border-red-500/30 bg-red-500/5' },
              { label: 'High Risk', value: highCount, color: 'text-orange-500', border: 'border-orange-500/30 bg-orange-500/5' },
              { label: 'High-Risk Devices', value: devices.filter(d => d.high_risk_device).length, color: 'text-yellow-500', border: 'border-yellow-500/30 bg-yellow-500/5' },
              { label: 'Identity Drifts', value: drifts.length, color: 'text-blue-500', border: 'border-blue-500/30 bg-blue-500/5' },
              { label: 'School-Hour Flags', value: schoolHourActive, color: 'text-cyan-500', border: 'border-cyan-500/30 bg-cyan-500/5' },
              { label: 'Pending Signals', value: pendingSignals, color: 'text-pink-500', border: 'border-pink-500/30 bg-pink-500/5' },
            ].map(({ label, value, color, border }) => (
              <Card key={label} className={`border ${border}`}>
                <CardContent className="p-3 text-center">
                  <div className={`text-2xl font-bold ${color}`}>{value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="dashboard" className="text-xs">
                <BarChart3 className="w-3 h-3 mr-1" />Dashboard
              </TabsTrigger>
              <TabsTrigger value="risk-scores" className="text-xs">
                <AlertTriangle className="w-3 h-3 mr-1" />Minor Risk Scores
              </TabsTrigger>
              <TabsTrigger value="devices" className="text-xs">
                <Monitor className="w-3 h-3 mr-1" />Device Intel
              </TabsTrigger>
              <TabsTrigger value="drift" className="text-xs">
                <Brain className="w-3 h-3 mr-1" />Identity Drift
              </TabsTrigger>
              <TabsTrigger value="school" className="text-xs">
                <Clock className="w-3 h-3 mr-1" />School Hours
              </TabsTrigger>
              <TabsTrigger value="signals" className="text-xs">
                <Zap className="w-3 h-3 mr-1" />Signals
              </TabsTrigger>
            </TabsList>

            {/* Dashboard Overview */}
            <TabsContent value="dashboard" className="space-y-6">
              {operatorSummary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Underage Suspicion Rate', value: `${Number(operatorSummary.underage_suspicion_rate).toFixed(3)}%`, color: 'text-orange-500' },
                    { label: 'Device Risk Index', value: Number(operatorSummary.device_risk_index).toFixed(3), color: 'text-yellow-500' },
                    { label: 'Avg Response Time', value: `${Number(operatorSummary.average_response_time_minutes).toFixed(1)}min`, color: 'text-cyan-500' },
                    { label: 'Escalation Compliance', value: `${Number(operatorSummary.escalation_compliance_percent).toFixed(1)}%`, color: 'text-green-500' },
                  ].map(({ label, value, color }) => (
                    <Card key={label}>
                      <CardContent className="p-4">
                        <div className={`text-2xl font-bold ${color}`}>{value}</div>
                        <div className="text-xs text-muted-foreground mt-1">{label}</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Risk Score Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {riskDistributionData.map(item => (
                        <div key={item.name}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">{item.name}</span>
                            <span className="font-bold text-foreground">{item.value}</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${riskScores.length ? (item.value / riskScores.length) * 100 : 0}%`, backgroundColor: item.fill }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Intervention Signal Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {['pending', 'acknowledged', 'investigating', 'action_taken', 'resolved', 'dismissed'].map(status => {
                        const count = signals.filter(s => s.casino_response_status === status).length;
                        const total = signals.length || 1;
                        return (
                          <div key={status}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-muted-foreground capitalize">{status.replace('_', ' ')}</span>
                              <span className="font-bold text-foreground">{count}</span>
                            </div>
                            <Progress value={(count / total) * 100} className="h-1.5" />
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Risk Scores */}
            <TabsContent value="risk-scores">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Minor Risk Score Engine</CardTitle>
                  <p className="text-xs text-muted-foreground">AI-calculated scores from 8 behavioral indicators. Not real player data.</p>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="text-left py-2 px-3">Player</th>
                          <th className="text-right py-2 px-3">Risk Score</th>
                          <th className="text-center py-2 px-3">Category</th>
                          <th className="text-center py-2 px-3">Trend</th>
                          <th className="text-right py-2 px-3">Delta</th>
                          <th className="text-right py-2 px-3">Vel.</th>
                          <th className="text-right py-2 px-3">React.</th>
                          <th className="text-right py-2 px-3">Micro-Bet</th>
                          <th className="text-center py-2 px-3">School-Hr</th>
                          <th className="text-right py-2 px-3">Loss-Chase</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {riskScores.map(rs => (
                          <tr key={rs.id} className="hover:bg-muted/40">
                            <td className="py-2 px-3 text-foreground">
                              {rs.players ? `${rs.players.first_name} ${rs.players.last_name}` : rs.player_id?.slice(0, 8)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-foreground">{Number(rs.risk_score).toFixed(3)}</td>
                            <td className="py-2 px-3 text-center">
                              <Badge className={`text-xs border ${getRiskCategoryBg(rs.risk_category)}`}>{rs.risk_category}</Badge>
                            </td>
                            <td className="py-2 px-3 text-center">
                              {rs.risk_trend === 'increasing' ? <TrendingUp className="w-3 h-3 text-red-500 mx-auto" /> : rs.risk_trend === 'decreasing' ? <TrendingDown className="w-3 h-3 text-green-500 mx-auto" /> : <Minus className="w-3 h-3 text-muted-foreground mx-auto" />}
                            </td>
                            <td className={`py-2 px-3 text-right font-mono ${Number(rs.risk_change_delta) > 0 ? 'text-red-500' : 'text-green-500'}`}>
                              {Number(rs.risk_change_delta) > 0 ? '+' : ''}{Number(rs.risk_change_delta).toFixed(3)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-muted-foreground">{Number(rs.betting_velocity_score).toFixed(1)}</td>
                            <td className="py-2 px-3 text-right font-mono text-muted-foreground">{Number(rs.reaction_time_score).toFixed(1)}</td>
                            <td className="py-2 px-3 text-right font-mono text-muted-foreground">{Number(rs.micro_bet_frequency).toFixed(1)}</td>
                            <td className="py-2 px-3 text-center">
                              {rs.school_hour_activity_flag ? <span className="text-yellow-500 font-bold">YES</span> : <span className="text-muted-foreground/40">—</span>}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-muted-foreground">{Number(rs.loss_chasing_score).toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Devices */}
            <TabsContent value="devices">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Device Intelligence Engine</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {devices.map(dev => (
                      <div key={dev.id} className={`bg-muted/30 border rounded-lg p-3 ${dev.high_risk_device ? 'border-red-500/30 bg-red-500/5' : 'border-border'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Monitor className={`w-4 h-4 ${dev.high_risk_device ? 'text-red-500' : 'text-muted-foreground'}`} />
                            <div>
                              <span className="font-mono text-cyan-600 text-sm">{dev.device_id}</span>
                              {dev.high_risk_device && <Badge className="ml-2 bg-red-500/10 text-red-500 border-red-500/30 text-xs">HIGH RISK</Badge>}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold text-orange-500">{Number(dev.device_identity_shift_score).toFixed(3)}</div>
                            <div className="text-xs text-muted-foreground">Shift Score</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-3 mt-2 text-xs text-muted-foreground">
                          <span>IP Consistency: <span className="text-foreground">{Number(dev.ip_consistency_score).toFixed(3)}</span></span>
                          <span>Shared Prob: <span className="text-yellow-500">{Number(dev.shared_device_probability).toFixed(3)}</span></span>
                          <span>Linked Accts: <span className="text-orange-500">{dev.linked_accounts_count}</span></span>
                          <span>Cluster: <span className="text-cyan-600">{dev.login_pattern_cluster?.replace('_', ' ') || '—'}</span></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Identity Drift */}
            <TabsContent value="drift">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Identity Drift AI — Behavioral Signature Changes</CardTitle>
                  <p className="text-xs text-muted-foreground">Detects when behavioral patterns change on the same device — possible account sharing indicator.</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {drifts.map(d => (
                      <div key={d.id} className={`bg-muted/30 border rounded-lg p-3 ${d.drift_threshold_exceeded ? 'border-orange-500/30 bg-orange-500/5' : 'border-border'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Brain className="w-4 h-4 text-blue-500" />
                            <span className="text-sm text-foreground">
                              {d.players ? `${d.players.first_name} ${d.players.last_name}` : d.player_id?.slice(0, 12)}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">on {d.device_id}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {d.intervention_recommended && (
                              <Badge variant="outline" className="border-orange-500/40 text-orange-500 bg-orange-500/10 text-xs">Intervention Recommended</Badge>
                            )}
                            <span className="text-lg font-bold text-orange-500">{Number(d.drift_score).toFixed(3)}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          {d.behavioral_signature_change && <Badge variant="outline" className="border-red-500/40 text-red-500 bg-red-500/10">Sig. Change</Badge>}
                          {d.time_of_day_shift && <Badge variant="outline" className="border-yellow-500/40 text-yellow-600 bg-yellow-500/10">Time Shift</Badge>}
                          {d.stake_size_shift && <Badge variant="outline" className="border-orange-500/40 text-orange-500 bg-orange-500/10">Stake Shift</Badge>}
                          {d.gameplay_pattern_deviation && <Badge variant="outline" className="border-blue-500/40 text-blue-500 bg-blue-500/10">Pattern Dev.</Badge>}
                          {d.drift_spike_detected && <Badge variant="outline" className="border-pink-500/40 text-pink-500 bg-pink-500/10">Spike Detected</Badge>}
                          {d.repeat_drift_flag && <Badge variant="outline" className="border-pink-500/40 text-pink-600 bg-pink-500/10">Repeat Flag</Badge>}
                          <span className="text-muted-foreground ml-auto">Cross-Acct Sim: <span className="text-foreground">{Number(d.cross_account_similarity_score).toFixed(3)}</span></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* School Hours */}
            <TabsContent value="school">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">School-Hour Monitoring Engine</CardTitle>
                  <p className="text-xs text-muted-foreground">Sessions flagged during 08:00–15:00 weekdays. Risk multiplier applied to scoring.</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {schoolFlags.filter(f => f.is_school_hours).slice(0, 20).map((f: any) => (
                      <div key={f.id} className="flex items-center justify-between bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-3 text-xs">
                          <Clock className="w-3 h-3 text-red-500" />
                          <span className="text-foreground">{f.players ? `${f.players.first_name} ${f.players.last_name}` : f.player_id?.slice(0, 12)}</span>
                          <span className="text-muted-foreground">{new Date(f.session_start).toLocaleString()}</span>
                          <Badge variant="outline" className="text-xs">{f.province}</Badge>
                          {f.within_school_zone && <Badge variant="outline" className="border-yellow-500/40 text-yellow-600 bg-yellow-500/10 text-xs">School Zone</Badge>}
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-muted-foreground">Ratio: <span className="text-foreground font-mono">{Number(f.school_hour_activity_ratio).toFixed(3)}</span></span>
                          <span className={`font-mono font-bold ${Number(f.risk_multiplier) > 1.5 ? 'text-red-500' : 'text-orange-500'}`}>
                            {Number(f.risk_multiplier).toFixed(3)}x
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Intervention Signals */}
            <TabsContent value="signals">
              <div className="mb-4 bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-4 text-xs text-cyan-700">
                <Shield className="w-4 h-4 inline mr-2 text-cyan-500" />
                <strong>GuardianLayer Compliance Note:</strong> These are AI intelligence signals only. GuardianLayer does NOT block players, modify bets, or control accounts. All actions are operator decisions.
              </div>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Intervention Signal System</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {signals.map(sig => (
                      <div key={sig.id} className="bg-muted/30 border border-border rounded-lg p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <Badge variant="outline" className={`text-xs ${sig.signal_type.includes('Compliance') ? 'border-red-500/40 text-red-500 bg-red-500/10' : sig.signal_type.includes('freeze') ? 'border-orange-500/40 text-orange-500 bg-orange-500/10' : 'border-yellow-500/40 text-yellow-600 bg-yellow-500/10'}`}>
                                {sig.signal_type}
                              </Badge>
                              <Badge variant="outline" className={`text-xs ${getResponseStatusColor(sig.casino_response_status)}`}>
                                {sig.casino_response_status.replace('_', ' ')}
                              </Badge>
                              {sig.escalation_stage >= 3 && <Badge variant="outline" className="border-red-500/40 text-red-500 bg-red-500/10 text-xs">Escalation Stage {sig.escalation_stage}</Badge>}
                            </div>
                            <p className="text-xs text-foreground mb-1">{sig.trigger_reason}</p>
                            <div className="flex gap-3 text-xs text-muted-foreground">
                              <span>Player: <span className="text-foreground">{sig.players ? `${sig.players.first_name} ${sig.players.last_name}` : sig.player_id?.slice(0, 8)}</span></span>
                              <span>Score: <span className="text-orange-500 font-bold">{Number(sig.risk_score).toFixed(3)}</span></span>
                            </div>
                          </div>
                          <div className="flex gap-2 ml-3">
                            {sig.casino_response_status === 'pending' && (
                              <>
                                <Button size="sm" onClick={() => handleSignalResponse(sig.id, 'acknowledged')} variant="outline" className="h-6 px-2 text-xs border-cyan-500/30 text-cyan-600 hover:bg-cyan-500/10">
                                  <Eye className="w-3 h-3 mr-1" />Acknowledge
                                </Button>
                                <Button size="sm" onClick={() => handleSignalResponse(sig.id, 'investigating')} variant="outline" className="h-6 px-2 text-xs border-yellow-500/30 text-yellow-600 hover:bg-yellow-500/10">
                                  Investigate
                                </Button>
                              </>
                            )}
                            {sig.casino_response_status === 'investigating' && (
                              <Button size="sm" onClick={() => handleSignalResponse(sig.id, 'action_taken')} variant="outline" className="h-6 px-2 text-xs border-green-500/30 text-green-600 hover:bg-green-500/10">
                                <CheckCircle className="w-3 h-3 mr-1" />Mark Action Taken
                              </Button>
                            )}
                          </div>
                        </div>
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
