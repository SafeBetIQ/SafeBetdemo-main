'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Bell, CircleCheck as CheckCircle2, Circle as XCircle, Clock, TrendingUp, Send, Activity, Shield, TriangleAlert as AlertTriangle, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
  LineChart, Line, PieChart, Pie, Legend
} from 'recharts';

interface OperatorInterventionStats {
  casino_id: string;
  casino_name: string;
  province: string;
  total: number;
  sent: number;
  pending: number;
  failed: number;
  successful: number;
  auto_triggered: number;
  high_risk_coverage: number;
  high_risk_count: number;
}

interface InterventionStatisticsProps {
  province?: string;
}

const TYPE_LABELS: Record<string, string> = {
  responsible_gambling_message: 'RG Message',
  cooling_off_suggestion:       'Cool-Off',
  deposit_limit_recommendation: 'Deposit Limit',
  self_exclusion_referral:      'Self-Exclusion',
  helpline_referral:            'Helpline',
  follow_up_check:              'Follow-up',
  account_review:               'Account Review',
};

const COLORS = ['#3b82f6','#10b981','#f97316','#eab308','#ef4444','#8b5cf6','#06b6d4'];

export function InterventionStatistics({ province }: InterventionStatisticsProps) {
  const [operatorStats, setOperatorStats] = useState<OperatorInterventionStats[]>([]);
  const [typeBreakdown, setTypeBreakdown] = useState<{ name: string; count: number }[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<{ month: string; total: number; successful: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [province]);

  async function loadData() {
    setLoading(true);

    let casinoQuery = supabase.from('casinos').select('id, name, province').eq('is_active', true);
    if (province) casinoQuery = casinoQuery.eq('province', province);
    const { data: casinoList } = await casinoQuery.order('name');
    if (!casinoList || casinoList.length === 0) { setLoading(false); return; }

    const casinoIds = casinoList.map(c => c.id);

    const [intRes, playersRes] = await Promise.all([
      supabase.from('player_protection_interventions')
        .select('casino_id, dispatch_status, intervention_successful, auto_triggered, intervention_type, triggered_at')
        .in('casino_id', casinoIds),
      supabase.from('players')
        .select('casino_id, risk_level')
        .in('casino_id', casinoIds)
        .in('risk_level', ['high', 'critical']),
    ]);

    const interventions = intRes.data || [];
    const highRiskPlayers = playersRes.data || [];

    const casinoMap = Object.fromEntries(casinoList.map(c => [c.id, c]));

    const statsMap: Record<string, OperatorInterventionStats> = {};
    for (const c of casinoList) {
      const highRisk = highRiskPlayers.filter(p => p.casino_id === c.id).length;
      statsMap[c.id] = {
        casino_id: c.id,
        casino_name: c.name,
        province: c.province,
        total: 0, sent: 0, pending: 0, failed: 0, successful: 0, auto_triggered: 0,
        high_risk_count: highRisk,
        high_risk_coverage: 0,
      };
    }

    for (const i of interventions) {
      const s = statsMap[i.casino_id];
      if (!s) continue;
      s.total++;
      if (i.dispatch_status === 'sent' || i.dispatch_status === 'delivered') s.sent++;
      else if (i.dispatch_status === 'pending') s.pending++;
      else if (i.dispatch_status === 'failed') s.failed++;
      if (i.intervention_successful === true) s.successful++;
      if (i.auto_triggered) s.auto_triggered++;
    }

    for (const s of Object.values(statsMap)) {
      s.high_risk_coverage = s.high_risk_count > 0
        ? Math.min(100, Math.round((s.total / s.high_risk_count) * 100))
        : (s.total > 0 ? 100 : 0);
    }

    setOperatorStats(Object.values(statsMap).sort((a, b) => b.total - a.total));

    const typeCounts: Record<string, number> = {};
    for (const i of interventions) {
      const k = TYPE_LABELS[i.intervention_type] || i.intervention_type;
      typeCounts[k] = (typeCounts[k] || 0) + 1;
    }
    setTypeBreakdown(Object.entries(typeCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count));

    const now = new Date();
    const trend = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now);
      d.setMonth(d.getMonth() - (5 - i));
      const label = d.toLocaleString('en-ZA', { month: 'short' });
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthInts = interventions.filter(int => int.triggered_at && int.triggered_at.startsWith(monthStr));
      return {
        month: label,
        total: monthInts.length,
        successful: monthInts.filter(int => int.intervention_successful === true).length,
      };
    });
    setMonthlyTrend(trend);

    setLoading(false);
  }

  const totals = operatorStats.reduce((acc, s) => ({
    total: acc.total + s.total,
    sent: acc.sent + s.sent,
    pending: acc.pending + s.pending,
    failed: acc.failed + s.failed,
    successful: acc.successful + s.successful,
    autoTriggered: acc.autoTriggered + s.auto_triggered,
  }), { total: 0, sent: 0, pending: 0, failed: 0, successful: 0, autoTriggered: 0 });

  const successRate    = totals.total > 0 ? Math.round((totals.successful / totals.total) * 100) : 0;
  const deliveryRate   = totals.total > 0 ? Math.round((totals.sent / totals.total) * 100) : 0;
  const autoRate       = totals.total > 0 ? Math.round((totals.autoTriggered / totals.total) * 100) : 0;
  const noCoverageCount = operatorStats.filter(s => s.high_risk_count > 0 && s.total === 0).length;

  if (loading) {
    return <div className="flex items-center justify-center h-48"><div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Interventions', value: totals.total,             icon: Bell,         color: '' },
          { label: 'Sent / Delivered',    value: totals.sent,              icon: Send,         color: 'text-blue-600' },
          { label: 'Successful',          value: totals.successful,        icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'Pending',             value: totals.pending,           icon: Clock,        color: totals.pending > 0 ? 'text-yellow-600' : '' },
          { label: 'Failed',              value: totals.failed,            icon: XCircle,      color: totals.failed > 0 ? 'text-red-600' : '' },
          { label: 'Auto-Triggered',      value: `${autoRate}%`,           icon: Zap,          color: '' },
        ].map(k => {
          const Icon = k.icon;
          return (
            <Card key={k.label}>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center gap-1 mb-1">
                  <Icon className="h-3 w-3 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                </div>
                <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* No coverage alert */}
      {noCoverageCount > 0 && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800">
              {noCoverageCount} operator{noCoverageCount > 1 ? 's have' : ' has'} high-risk players with zero interventions
            </p>
            <p className="text-xs text-red-700 mt-0.5">
              This constitutes a compliance breach. Operators are required to take action on players with elevated risk scores.
            </p>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Monthly Intervention Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthlyTrend} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="total"      stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Total" />
                <Line type="monotone" dataKey="successful" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="Successful" strokeDasharray="4 2" />
                <Legend iconSize={10} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Interventions by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={typeBreakdown.slice(0, 7)} layout="vertical" margin={{ left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={90} />
                <RechartsTooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} name="Count">
                  {typeBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Rate Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        {[
          { label: 'Delivery Rate', value: deliveryRate, description: 'Interventions successfully sent to players', threshold: 85 },
          { label: 'Success Rate', value: successRate, description: 'Interventions that resulted in risk score reduction', threshold: 60 },
          { label: 'Automation Rate', value: autoRate, description: 'Interventions triggered automatically by AI engine', threshold: 50 },
        ].map(r => (
          <Card key={r.label}>
            <CardContent className="pt-4 pb-4">
              <div className="flex justify-between mb-2">
                <p className="text-sm font-medium">{r.label}</p>
                <p className={`text-lg font-bold ${r.value >= r.threshold ? 'text-emerald-600' : r.value >= r.threshold * 0.7 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {r.value}%
                </p>
              </div>
              <Progress value={r.value} className="h-2 mb-2" />
              <p className="text-xs text-muted-foreground">{r.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Operator Breakdown Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Intervention Coverage by Operator</CardTitle>
          <CardDescription className="text-xs">Compliance view — operators with high-risk players must show intervention activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Operator</TableHead>
                  {!province && <TableHead className="hidden lg:table-cell">Province</TableHead>}
                  <TableHead>Total</TableHead>
                  <TableHead className="hidden md:table-cell">Sent</TableHead>
                  <TableHead className="hidden md:table-cell">Successful</TableHead>
                  <TableHead className="hidden lg:table-cell">Pending</TableHead>
                  <TableHead className="hidden lg:table-cell">Failed</TableHead>
                  <TableHead>Coverage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operatorStats.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">No intervention data</TableCell></TableRow>
                ) : operatorStats.map(s => {
                  const successPct = s.total > 0 ? Math.round((s.successful / s.total) * 100) : 0;
                  const coverageStatus = s.high_risk_count === 0 ? 'na' : s.high_risk_coverage >= 80 ? 'good' : s.high_risk_coverage >= 50 ? 'partial' : 'poor';
                  return (
                    <TableRow key={s.casino_id} className={`hover:bg-muted/20 ${coverageStatus === 'poor' ? 'bg-red-50/30' : ''}`}>
                      <TableCell className="font-medium text-sm">{s.casino_name}</TableCell>
                      {!province && <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{s.province}</TableCell>}
                      <TableCell className="text-sm">{s.total}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">{s.sent}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">{s.successful}</Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {s.pending > 0 ? <Badge className="bg-yellow-100 text-yellow-700 border-0 text-xs">{s.pending}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {s.failed > 0 ? <Badge className="bg-red-100 text-red-700 border-0 text-xs">{s.failed}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {coverageStatus === 'na' ? (
                          <span className="text-xs text-muted-foreground">N/A</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full" style={{
                                width: `${s.high_risk_coverage}%`,
                                backgroundColor: coverageStatus === 'good' ? '#10b981' : coverageStatus === 'partial' ? '#eab308' : '#ef4444'
                              }} />
                            </div>
                            <Badge className={`border-0 text-xs ${coverageStatus === 'good' ? 'bg-emerald-100 text-emerald-700' : coverageStatus === 'partial' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                              {s.high_risk_coverage}%
                            </Badge>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
