'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Shield, ShieldCheck, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, Circle as XCircle, RefreshCw, TrendingUp, Globe, Award, FileText, ChartBar as BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComplianceSnapshot {
  id: string;
  casino_id: string;
  framework: string;
  total_controls: number;
  compliant: number;
  non_compliant: number;
  partial: number;
  not_assessed: number;
  compliance_score: number;
  snapshot_date: string;
}

interface Casino {
  id: string;
  name: string;
  province: string | null;
}

const FRAMEWORK_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  ISO27001: { label: 'ISO 27001', color: 'text-slate-800', bg: 'bg-slate-50', border: 'border-slate-200' },
  POPIA: { label: 'POPIA', color: 'text-amber-800', bg: 'bg-amber-50', border: 'border-amber-200' },
};

function scoreColor(score: number) {
  if (score >= 85) return 'text-emerald-700';
  if (score >= 70) return 'text-amber-700';
  return 'text-red-700';
}

function scoreBg(score: number) {
  if (score >= 85) return 'bg-emerald-50 border-emerald-200';
  if (score >= 70) return 'bg-amber-50 border-amber-200';
  return 'bg-red-50 border-red-200';
}

export default function ComplianceOverviewPage() {
  const [snapshots, setSnapshots] = useState<ComplianceSnapshot[]>([]);
  const [casinos, setCasinos] = useState<Casino[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCasino, setSelectedCasino] = useState('all');
  const [selectedFramework, setSelectedFramework] = useState('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    const [snapsRes, casinosRes] = await Promise.all([
      supabase.from('compliance_snapshots').select('*').order('snapshot_date', { ascending: false }).limit(2000),
      supabase.from('casinos').select('id, name, province').eq('is_active', true).order('name'),
    ]);
    if (snapsRes.data) setSnapshots(snapsRes.data);
    if (casinosRes.data) setCasinos(casinosRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const latestPerCasinoFramework = (() => {
    const seen = new Set<string>();
    const result: ComplianceSnapshot[] = [];
    for (const s of snapshots) {
      const key = `${s.casino_id}:${s.framework}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(s);
      }
    }
    return result;
  })();

  const filtered = latestPerCasinoFramework.filter(s => {
    if (selectedCasino !== 'all' && s.casino_id !== selectedCasino) return false;
    if (selectedFramework !== 'all' && s.framework !== selectedFramework) return false;
    return true;
  });

  const platformScores = (['ISO27001', 'POPIA'] as const).map(fw => {
    const fwSnaps = latestPerCasinoFramework.filter(s => s.framework === fw);
    const avg = fwSnaps.length > 0 ? fwSnaps.reduce((sum, s) => sum + s.compliance_score, 0) / fwSnaps.length : 0;
    return { framework: fw, score: Math.round(avg * 10) / 10 };
  });

  const overallScore = platformScores.length > 0
    ? Math.round(platformScores.reduce((s, f) => s + f.score, 0) / platformScores.length * 10) / 10
    : 0;

  const trendData = (() => {
    const dates = Array.from(new Set(snapshots.map(s => s.snapshot_date))).sort().slice(-12);
    return dates.map(date => {
      const row: Record<string, unknown> = { date: new Date(date).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' }) };
      for (const fw of ['ISO27001', 'POPIA']) {
        const fwSnaps = snapshots.filter(s => s.snapshot_date === date && s.framework === fw);
        if (fwSnaps.length > 0) {
          row[fw] = Math.round(fwSnaps.reduce((sum, s) => sum + s.compliance_score, 0) / fwSnaps.length);
        }
      }
      return row;
    });
  })();

  const casinoRankings = casinos.map(c => {
    const cSnaps = latestPerCasinoFramework.filter(s => s.casino_id === c.id);
    const avg = cSnaps.length > 0 ? cSnaps.reduce((sum, s) => sum + s.compliance_score, 0) / cSnaps.length : 0;
    return { ...c, score: Math.round(avg * 10) / 10, snapsCount: cSnaps.length };
  }).sort((a, b) => b.score - a.score);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Award className="h-6 w-6 text-slate-700" />
              Global Compliance Overview
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Platform-wide compliance posture across ISO 27001 and POPIA
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadData} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm text-slate-400 uppercase tracking-wide">Overall Platform Compliance Score</div>
              <div className={cn('text-5xl font-bold mt-1', overallScore >= 85 ? 'text-emerald-400' : overallScore >= 70 ? 'text-amber-400' : 'text-red-400')}>
                {overallScore}%
              </div>
            </div>
            <ShieldCheck className={cn('h-16 w-16', overallScore >= 85 ? 'text-emerald-400' : 'text-amber-400')} />
          </div>
          <Progress value={overallScore} className="h-2 bg-slate-700" />
          <div className="grid grid-cols-2 gap-4 mt-4">
            {platformScores.map(ps => {
              const fw = FRAMEWORK_CONFIG[ps.framework];
              return (
                <div key={ps.framework} className="text-center">
                  <div className={cn('text-2xl font-bold', ps.score >= 85 ? 'text-emerald-400' : ps.score >= 70 ? 'text-amber-400' : 'text-red-400')}>
                    {ps.score}%
                  </div>
                  <div className="text-xs text-slate-400">{fw?.label ?? ps.framework}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {platformScores.map(ps => {
            const fw = FRAMEWORK_CONFIG[ps.framework];
            return (
              <Card key={ps.framework} className={cn('border', fw?.border)}>
                <CardContent className={cn('p-4', fw?.bg)}>
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">{fw?.label}</div>
                  <div className={cn('text-3xl font-bold', scoreColor(ps.score))}>{ps.score}%</div>
                  <Progress value={ps.score} className="h-1.5 mt-2" />
                  <div className="text-xs text-slate-500 mt-1">
                    {latestPerCasinoFramework.filter(s => s.framework === ps.framework).length} operators tracked
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Compliance Score Trend (90 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                  <YAxis domain={[50, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={v => `${v}%`} />
                  <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v: number) => `${v}%`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="ISO27001" stroke="#1e293b" dot={false} name="ISO 27001" />
                  <Line type="monotone" dataKey="POPIA" stroke="#f59e0b" dot={false} name="POPIA" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Operator Rankings</CardTitle>
              <CardDescription className="text-xs">Average compliance score across all frameworks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 p-4">
              {casinoRankings.slice(0, 8).map((c, i) => (
                <div key={c.id} className="flex items-center gap-3">
                  <div className="text-xs text-slate-400 w-4 text-right">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-slate-700 truncate">{c.name}</div>
                    <Progress value={c.score} className="h-1 mt-0.5" />
                  </div>
                  <div className={cn('text-xs font-bold w-10 text-right', scoreColor(c.score))}>
                    {c.score}%
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base">Operator Compliance Detail</CardTitle>
                <CardDescription>Latest compliance scores per operator and framework</CardDescription>
              </div>
              <div className="flex gap-2">
                <Select value={selectedCasino} onValueChange={setSelectedCasino}>
                  <SelectTrigger className="h-9 w-48 text-xs"><SelectValue placeholder="All Operators" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Operators</SelectItem>
                    {casinos.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={selectedFramework} onValueChange={setSelectedFramework}>
                  <SelectTrigger className="h-9 w-36 text-xs"><SelectValue placeholder="All Frameworks" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Frameworks</SelectItem>
                    <SelectItem value="ISO27001">ISO 27001</SelectItem>
                    <SelectItem value="POPIA">POPIA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Operator</TableHead>
                  <TableHead>Framework</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead className="text-center">Compliant</TableHead>
                  <TableHead className="text-center">Non-Compliant</TableHead>
                  <TableHead className="text-center">Partial</TableHead>
                  <TableHead className="text-center">Not Assessed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-400">Loading...</TableCell></TableRow>
                ) : filtered.slice(0, 50).map(s => {
                  const casino = casinos.find(c => c.id === s.casino_id);
                  const fw = FRAMEWORK_CONFIG[s.framework];
                  return (
                    <TableRow key={s.id} className="text-sm">
                      <TableCell className="font-medium text-slate-800">{casino?.name ?? 'Unknown'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('text-xs', fw?.bg, fw?.border, fw?.color)}>
                          {fw?.label ?? s.framework}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={cn('text-sm font-bold', scoreColor(s.compliance_score))}>
                          {s.compliance_score.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">{s.compliant}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">{s.non_compliant}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">{s.partial}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-xs">{s.not_assessed}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
