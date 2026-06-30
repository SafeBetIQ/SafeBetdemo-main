'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import {
  ArrowLeft, User, AlertTriangle, Shield, ShieldAlert, Clock, TrendingDown, Calendar,
  MessageSquare, FileText, Printer, CheckCircle2, XCircle, Moon, Activity,
  ChevronRight, Zap, Target, TriangleAlert, Info, Ban,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Player {
  id: string;
  player_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  risk_score: number;
  total_wagered: number;
  total_won: number;
  session_count: number;
  avg_session_duration: number;
  last_active: string;
  status: string;
  signup_date: string;
  casino_id: string;
}

interface PlayerSession {
  id: string;
  session_start: string;
  session_end: string | null;
  duration_minutes: number;
  total_wagered: number;
  total_won: number;
  net_result: number;
  is_late_night: boolean;
  total_bets: number;
}

interface Intervention {
  id: string;
  channel: string;
  message_content: string;
  status: string;
  created_at: string;
  delivered_at: string | null;
}

interface SelfExclusion {
  id: string;
  exclusion_type: string;
  duration_type: string;
  starts_at: string;
  ends_at: string | null;
  status: string;
  reason: string | null;
  created_at: string;
}

interface Casino {
  name: string;
}

interface RiskFactor {
  label: string;
  weight: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  value: string;
}

interface Recommendation {
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'STANDARD';
  action: string;
  steps: string[];
  regulatory: string;
}

type TimelineEventType = 'signup' | 'session' | 'risk' | 'intervention' | 'exclusion' | 'assessment';
interface TimelineEvent {
  id: string;
  ts: string;
  type: TimelineEventType;
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'critical' | 'success' | 'neutral';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(ts: string) {
  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(ts));
}

function fmtDate(ts: string) {
  return new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(ts));
}

function fmtCurrency(n: number) {
  return `R ${Math.abs(n).toLocaleString('en-ZA', { minimumFractionDigits: 0 })}`;
}

function riskConfig(score: number) {
  if (score >= 85) return { label: 'Critical', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-800' };
  if (score >= 70) return { label: 'High', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-800' };
  if (score >= 50) return { label: 'Medium', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-800' };
  return { label: 'Low', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', badge: 'bg-green-100 text-green-800' };
}

function weightConfig(w: RiskFactor['weight']) {
  const map = {
    critical: 'bg-red-100 text-red-800 border-red-200',
    high: 'bg-orange-100 text-orange-800 border-orange-200',
    medium: 'bg-amber-100 text-amber-800 border-amber-200',
    low: 'bg-slate-100 text-slate-700 border-slate-200',
  };
  return map[w];
}

function computeRiskFactors(player: Player, sessions: PlayerSession[]): RiskFactor[] {
  const factors: RiskFactor[] = [];
  const wagered = Number(player.total_wagered) || 0;
  const won = Number(player.total_won) || 0;
  const loss = wagered - won;
  const lossRate = wagered > 0 ? loss / wagered : 0;
  const lateNight = sessions.filter(s => s.is_late_night).length;

  const daysSinceSignup = Math.max(1, (Date.now() - new Date(player.signup_date).getTime()) / 86400000);
  const sessPerWeek = (player.session_count / daysSinceSignup) * 7;

  const sessionsByDay: Record<string, number> = {};
  sessions.forEach(s => {
    const d = s.session_start.slice(0, 10);
    sessionsByDay[d] = (sessionsByDay[d] || 0) + 1;
  });
  const maxSameDay = Math.max(0, ...Object.values(sessionsByDay));

  if (lossRate > 0.55) {
    factors.push({
      label: 'High loss rate',
      weight: lossRate > 0.75 ? 'critical' : 'high',
      description: `Player loses ${Math.round(lossRate * 100)}% of wagers on average, significantly above the 30% population median.`,
      value: `${Math.round(lossRate * 100)}% loss rate`,
    });
  }

  if (player.avg_session_duration > 60) {
    factors.push({
      label: 'Extended session duration',
      weight: player.avg_session_duration > 120 ? 'critical' : 'high',
      description: `Average session of ${player.avg_session_duration} minutes exceeds the 45-minute responsible gambling guideline.`,
      value: `${player.avg_session_duration} min avg`,
    });
  }

  if (lateNight > 1) {
    factors.push({
      label: 'Late-night gambling',
      weight: lateNight > 4 ? 'high' : 'medium',
      description: `${lateNight} sessions recorded between 00:00–06:00, a strong predictor of disordered gambling behaviour.`,
      value: `${lateNight} late-night sessions`,
    });
  }

  if (sessPerWeek > 4) {
    factors.push({
      label: 'High visit frequency',
      weight: sessPerWeek > 8 ? 'critical' : 'high',
      description: `${sessPerWeek.toFixed(1)} sessions per week — the population 90th percentile is 3.5 sessions/week.`,
      value: `${sessPerWeek.toFixed(1)} sessions/week`,
    });
  }

  if (loss > 5000) {
    factors.push({
      label: 'Significant cumulative losses',
      weight: loss > 20000 ? 'critical' : loss > 10000 ? 'high' : 'medium',
      description: `Net financial loss of ${fmtCurrency(loss)} since registration — a key indicator of gambling harm.`,
      value: `${fmtCurrency(loss)} net loss`,
    });
  }

  if (maxSameDay >= 3) {
    factors.push({
      label: 'Multiple same-day sessions',
      weight: maxSameDay >= 5 ? 'critical' : 'high',
      description: `Up to ${maxSameDay} separate gambling sessions recorded within a single calendar day — indicative of chasing behaviour.`,
      value: `${maxSameDay} in one day`,
    });
  }

  if (wagered > 30000) {
    factors.push({
      label: 'High wagering volume',
      weight: wagered > 60000 ? 'critical' : 'medium',
      description: `Total wagered of ${fmtCurrency(wagered)} places this player in the top 5% by lifetime spend.`,
      value: fmtCurrency(wagered),
    });
  }

  return factors;
}

function getRecommendation(score: number, interventions: Intervention[]): Recommendation {
  const hasIntervention = interventions.length > 0;

  if (score >= 85) {
    return {
      priority: 'URGENT',
      action: 'Immediate responsible gambling intervention required',
      steps: [
        'Contact player directly within 24 hours via preferred channel',
        'Consider temporary deposit limit reduction or session time cap',
        'Escalate to compliance officer — log formal welfare check',
        'Submit NRGP notification if high-risk pattern continues beyond 7 days',
        'Offer self-exclusion options with direct counselling referral',
      ],
      regulatory: 'NRGP Regulation 6(1)(a) — mandatory welfare action threshold exceeded',
    };
  }
  if (score >= 70) {
    return {
      priority: 'HIGH',
      action: 'Escalated monitoring and welfare outreach required',
      steps: [
        hasIntervention
          ? 'Review outcome of previous intervention before next contact'
          : 'Issue responsible gambling message via SMS or in-app notification',
        'Schedule formal welfare check within 48 hours',
        'Review and consider reducing deposit/spending limits',
        'Log all actions in compliance record for audit trail',
      ],
      regulatory: 'NRGP Regulation 6(1)(b) — enhanced due diligence required',
    };
  }
  if (score >= 50) {
    return {
      priority: 'MEDIUM',
      action: 'Enhanced monitoring — schedule 30-day compliance review',
      steps: [
        'Continue automated risk score monitoring',
        'Prompt player to review responsible gambling tools at next login',
        'Schedule compliance review in 30 days',
        'Document in player record',
      ],
      regulatory: 'NRGP Guidelines s.4 — standard monitoring obligations',
    };
  }
  return {
    priority: 'STANDARD',
    action: 'Continue standard monitoring — no immediate action required',
    steps: [
      'Automated monitoring active — no manual action needed',
      'Re-assess if risk score increases above 50',
    ],
    regulatory: 'No regulatory action required at current risk level',
  };
}

function buildTimeline(
  player: Player,
  sessions: PlayerSession[],
  interventions: Intervention[],
  exclusions: SelfExclusion[],
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  events.push({
    id: 'signup',
    ts: player.signup_date,
    type: 'signup',
    title: 'Account registered',
    body: `Player ${player.first_name} ${player.last_name} (${player.player_id}) registered on the platform.`,
    severity: 'info',
  });

  // Add sessions (most recent 10, chronological)
  const sorted = [...sessions].sort((a, b) => new Date(a.session_start).getTime() - new Date(b.session_start).getTime());
  const recent = sorted.slice(-10);

  recent.forEach((s, i) => {
    const net = Number(s.net_result);
    const loss = net < 0;
    events.push({
      id: `session-${i}`,
      ts: s.session_start,
      type: 'session',
      title: `Gambling session — ${s.duration_minutes} min${s.is_late_night ? ' (late night)' : ''}`,
      body: `Wagered ${fmtCurrency(Number(s.total_wagered))}, won ${fmtCurrency(Number(s.total_won))}. Net ${loss ? 'loss' : 'gain'}: ${fmtCurrency(net)}. ${Number(s.total_bets)} bets placed.${s.is_late_night ? ' ⚠ Late-night session.' : ''}`,
      severity: s.is_late_night ? 'warning' : loss && Number(s.total_wagered) > 5000 ? 'warning' : 'neutral',
    });
  });

  // Risk milestones derived from score
  if (player.risk_score >= 70) {
    events.push({
      id: 'risk-flag',
      ts: player.last_active,
      type: 'risk',
      title: `Risk score elevated to ${player.risk_score}/100`,
      body: `AI model flagged player as ${riskConfig(player.risk_score).label.toUpperCase()} risk based on cumulative behavioural patterns. Regulatory action threshold ${player.risk_score >= 85 ? 'exceeded' : 'approaching'}.`,
      severity: player.risk_score >= 85 ? 'critical' : 'warning',
    });
  }

  interventions.forEach((iv, i) => {
    events.push({
      id: `iv-${i}`,
      ts: iv.created_at,
      type: 'intervention',
      title: `Intervention — ${iv.channel.toUpperCase()} (${iv.status})`,
      body: iv.message_content,
      severity: iv.status === 'delivered' ? 'success' : 'warning',
    });
  });

  exclusions.forEach((ex, i) => {
    events.push({
      id: `excl-${i}`,
      ts: ex.created_at,
      type: 'exclusion',
      title: `Self-exclusion — ${ex.exclusion_type} (${ex.status})`,
      body: `Duration: ${ex.duration_type}. ${ex.reason ? `Reason: ${ex.reason}.` : ''}${ex.ends_at ? ` Expires: ${fmtDate(ex.ends_at)}.` : ''}`,
      severity: 'info',
    });
  });

  // Current assessment
  events.push({
    id: 'assessment',
    ts: new Date().toISOString(),
    type: 'assessment',
    title: 'Investigation assessment generated',
    body: `Automated investigation report generated. Risk score: ${player.risk_score}/100 (${riskConfig(player.risk_score).label}). Regulatory review ${player.risk_score >= 70 ? 'required' : 'not required at this time'}.`,
    severity: player.risk_score >= 85 ? 'critical' : player.risk_score >= 70 ? 'warning' : 'info',
  });

  return events.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
}

// ─── Severity icon for timeline ───────────────────────────────────────────────

function TimelineIcon({ type, severity }: { type: TimelineEventType; severity: TimelineEvent['severity'] }) {
  const base = 'h-5 w-5 flex-shrink-0';
  if (type === 'signup') return <User className={cn(base, 'text-blue-600')} />;
  if (type === 'exclusion') return <Ban className={cn(base, 'text-purple-600')} />;
  if (type === 'intervention') return <MessageSquare className={cn(base, severity === 'success' ? 'text-green-600' : 'text-amber-600')} />;
  if (type === 'risk') return <TriangleAlert className={cn(base, severity === 'critical' ? 'text-red-600' : 'text-orange-600')} />;
  if (type === 'assessment') return <Target className={cn(base, 'text-slate-600')} />;
  // session
  return <Activity className={cn(base, severity === 'warning' ? 'text-amber-500' : 'text-slate-400')} />;
}

function dotColor(severity: TimelineEvent['severity']) {
  return {
    critical: 'bg-red-500 ring-red-200',
    warning: 'bg-amber-500 ring-amber-200',
    success: 'bg-green-500 ring-green-200',
    info: 'bg-blue-500 ring-blue-200',
    neutral: 'bg-slate-300 ring-slate-100',
  }[severity];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InvestigatePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);

  const [player, setPlayer] = useState<Player | null>(null);
  const [sessions, setSessions] = useState<PlayerSession[]>([]);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [exclusions, setExclusions] = useState<SelfExclusion[]>([]);
  const [casino, setCasino] = useState<Casino | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!params?.id) return;
    setLoading(true);
    try {
      const [pRes, sRes, iRes, eRes] = await Promise.all([
        supabase.from('players').select('*').eq('id', params.id).single(),
        supabase.from('player_sessions').select('*').eq('player_id', params.id).order('session_start', { ascending: false }).limit(30),
        supabase.from('interventions').select('*').eq('player_id', params.id).order('created_at', { ascending: false }),
        supabase.from('self_exclusions').select('*').eq('player_id', params.id).order('created_at', { ascending: false }),
      ]);

      if (pRes.error || !pRes.data) { setNotFound(true); return; }

      const p = pRes.data as Player;
      setPlayer(p);
      setSessions((sRes.data ?? []) as PlayerSession[]);
      setInterventions((iRes.data ?? []) as Intervention[]);
      setExclusions((eRes.data ?? []) as SelfExclusion[]);

      if (p.casino_id) {
        const cRes = await supabase.from('casinos').select('name').eq('id', p.casino_id).single();
        if (cRes.data) setCasino(cRes.data as Casino);
      }
    } finally {
      setLoading(false);
    }
  }, [params?.id]);

  useEffect(() => { load(); }, [load]);

  const handlePrint = () => window.print();

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full min-h-[400px]">
          <div className="text-center space-y-3">
            <div className="h-8 w-8 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-500">Loading investigation…</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (notFound || !player) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full min-h-[400px]">
          <div className="text-center space-y-4">
            <User className="h-12 w-12 text-slate-300 mx-auto" />
            <p className="font-medium text-slate-600">Player not found</p>
            <Button variant="outline" onClick={() => router.push('/casino/players')}>Back to Players</Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const rc = riskConfig(player.risk_score);
  const wagered = Number(player.total_wagered) || 0;
  const won = Number(player.total_won) || 0;
  const netLoss = wagered - won;
  const lossRate = wagered > 0 ? (netLoss / wagered) * 100 : 0;
  const lateNightCount = sessions.filter(s => s.is_late_night).length;
  const riskFactors = computeRiskFactors(player, sessions);
  const recommendation = getRecommendation(player.risk_score, interventions);
  const timeline = buildTimeline(player, sessions, interventions, exclusions);

  // Session trend data for chart (last 10 sessions, chronological)
  const chartData = [...sessions]
    .sort((a, b) => new Date(a.session_start).getTime() - new Date(b.session_start).getTime())
    .slice(-10)
    .map((s, i) => ({
      session: `S${i + 1}`,
      wagered: Number(s.total_wagered),
      won: Number(s.total_won),
      loss: Math.max(0, Number(s.total_wagered) - Number(s.total_won)),
      duration: s.duration_minutes,
    }));

  const priorityConfig = {
    URGENT: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-800', badge: 'bg-red-600 text-white', icon: AlertTriangle },
    HIGH: { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-800', badge: 'bg-orange-500 text-white', icon: ShieldAlert },
    MEDIUM: { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-800', badge: 'bg-amber-500 text-white', icon: Shield },
    STANDARD: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', badge: 'bg-slate-500 text-white', icon: CheckCircle2 },
  }[recommendation.priority];

  return (
    <DashboardLayout>
      <div className="print:hidden">
        {/* ── Page header ─────────────────────────────────────────────── */}
        <div className={cn('border-b px-6 py-4', rc.bg, rc.border)}>
          <div className="flex items-start justify-between gap-4 max-w-[1400px] mx-auto">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => router.push('/casino/players')} className="gap-1 text-slate-600">
                <ArrowLeft className="h-4 w-4" /> Players
              </Button>
              <ChevronRight className="h-4 w-4 text-slate-400" />
              <span className="text-sm text-slate-500">Investigation</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
                <Printer className="h-4 w-4" />
                Evidence Pack
              </Button>
            </div>
          </div>

          <div className="mt-3 max-w-[1400px] mx-auto">
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex items-center gap-3">
                <div className={cn('h-14 w-14 rounded-full flex items-center justify-center text-xl font-bold', rc.bg, 'border-2', rc.border, rc.color)}>
                  {player.first_name[0]}{player.last_name[0]}
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900">{player.first_name} {player.last_name}</h1>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <span className="text-xs font-mono text-slate-500">{player.player_id}</span>
                    {casino && <span className="text-xs text-slate-400">· {casino.name}</span>}
                    <Badge variant="outline" className={cn('text-xs', rc.badge)}>{rc.label} Risk</Badge>
                    <Badge variant="outline" className={cn('text-xs', player.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-600')}>
                      {player.status}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="ml-auto flex flex-wrap gap-6 text-sm">
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide">Risk Score</div>
                  <div className={cn('text-3xl font-black', rc.color)}>{player.risk_score}<span className="text-sm font-normal text-slate-400">/100</span></div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide">Total Wagered</div>
                  <div className="text-lg font-bold text-slate-800">{fmtCurrency(wagered)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide">Net Loss</div>
                  <div className="text-lg font-bold text-red-700">{fmtCurrency(netLoss)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide">Sessions</div>
                  <div className="text-lg font-bold text-slate-800">{player.session_count}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide">Last Active</div>
                  <div className="text-sm font-medium text-slate-700">{fmtDate(player.last_active)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Main content ────────────────────────────────────────────── */}
        <div className="p-6 max-w-[1400px] mx-auto space-y-8">

          {/* Recommended Action — always first, most important */}
          <Card className={cn('border-2', priorityConfig.border, priorityConfig.bg)}>
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className={cn('px-3 py-1 rounded-full text-xs font-bold tracking-wider flex items-center gap-1.5 self-start', priorityConfig.badge)}>
                  <priorityConfig.icon className="h-3.5 w-3.5" />
                  {recommendation.priority} PRIORITY
                </div>
                <div className="flex-1">
                  <h2 className={cn('text-base font-bold', priorityConfig.text)}>{recommendation.action}</h2>
                  <ul className={cn('mt-3 space-y-1.5 text-sm', priorityConfig.text)}>
                    {recommendation.steps.map((step, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="font-bold opacity-60 flex-shrink-0">{i + 1}.</span>
                        {step}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex items-center gap-1.5 text-xs opacity-70">
                    <FileText className="h-3 w-3" />
                    {recommendation.regulatory}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Two-column: AI risk analysis (left) + Identity (right) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* AI Risk Factors */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500" />
                <h2 className="text-base font-bold text-slate-900">AI Risk Analysis — Why this score?</h2>
                <Badge variant="outline" className={cn('text-xs ml-auto', rc.badge)}>{player.risk_score}/100</Badge>
              </div>

              {riskFactors.length === 0 ? (
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-4 flex items-center gap-3 text-green-700 text-sm">
                    <CheckCircle2 className="h-5 w-5" />
                    No significant risk factors detected at this time.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {riskFactors.map((f, i) => (
                    <Card key={i} className="border-slate-200">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-sm text-slate-800">{f.label}</span>
                              <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 leading-5', weightConfig(f.weight))}>
                                {f.weight.toUpperCase()}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">{f.description}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className="text-sm font-bold text-slate-700">{f.value}</span>
                          </div>
                        </div>
                        {/* Weight bar */}
                        <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all', {
                              'bg-red-500': f.weight === 'critical',
                              'bg-orange-500': f.weight === 'high',
                              'bg-amber-400': f.weight === 'medium',
                              'bg-slate-400': f.weight === 'low',
                            })}
                            style={{ width: { critical: '100%', high: '75%', medium: '50%', low: '25%' }[f.weight] }}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Summary stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                {[
                  { label: 'Loss Rate', value: `${Math.round(lossRate)}%`, warn: lossRate > 55 },
                  { label: 'Avg Session', value: `${player.avg_session_duration} min`, warn: player.avg_session_duration > 60 },
                  { label: 'Late Night', value: `${lateNightCount} sessions`, warn: lateNightCount > 1 },
                  { label: 'Net Loss', value: fmtCurrency(netLoss), warn: netLoss > 5000 },
                ].map(s => (
                  <div key={s.label} className={cn('rounded-lg border p-3 text-center', s.warn ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200')}>
                    <div className={cn('text-lg font-bold', s.warn ? 'text-amber-700' : 'text-slate-700')}>{s.value}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Identity card */}
            <div className="space-y-4">
              <Card className="border-slate-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4 text-slate-500" /> Player Identity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {[
                    { label: 'Full Name', value: `${player.first_name} ${player.last_name}` },
                    { label: 'Player ID', value: player.player_id, mono: true },
                    { label: 'Email', value: player.email },
                    { label: 'Phone', value: player.phone ?? 'Not provided' },
                    { label: 'Casino', value: casino?.name ?? player.casino_id, mono: !casino },
                    { label: 'Status', value: player.status, capitalize: true },
                    { label: 'Registered', value: fmtDate(player.signup_date) },
                    { label: 'Last Active', value: fmtDate(player.last_active) },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between items-start gap-2">
                      <span className="text-slate-500 flex-shrink-0">{row.label}</span>
                      <span className={cn('text-right text-slate-800 font-medium break-all', row.mono && 'font-mono text-xs', row.capitalize && 'capitalize')}>
                        {row.value}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Quick stats */}
              <Card className="border-slate-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4 text-slate-500" /> Activity Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {[
                    { label: 'Total Wagered', value: fmtCurrency(wagered) },
                    { label: 'Total Won', value: fmtCurrency(won) },
                    { label: 'Net Result', value: `-${fmtCurrency(netLoss)}`, red: true },
                    { label: 'Sessions', value: player.session_count.toString() },
                    { label: 'Avg Duration', value: `${player.avg_session_duration} min` },
                    { label: 'Interventions', value: interventions.length.toString() },
                    { label: 'Exclusions', value: exclusions.length.toString() },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between">
                      <span className="text-slate-500">{row.label}</span>
                      <span className={cn('font-semibold', row.red ? 'text-red-600' : 'text-slate-800')}>{row.value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ── Investigation Timeline ───────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-5">
              <Clock className="h-5 w-5 text-slate-500" />
              <h2 className="text-base font-bold text-slate-900">Investigation Timeline</h2>
              <span className="text-xs text-slate-400 ml-1">({timeline.length} events)</span>
            </div>

            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-[19px] top-2 bottom-2 w-px bg-slate-200" />

              <div className="space-y-4">
                {timeline.map((event, i) => (
                  <div key={event.id} className="flex gap-4 relative">
                    {/* Dot */}
                    <div className={cn('h-10 w-10 rounded-full border-2 border-white ring-2 flex items-center justify-center flex-shrink-0 z-10 bg-white', dotColor(event.severity))}>
                      <TimelineIcon type={event.type} severity={event.severity} />
                    </div>
                    {/* Content */}
                    <div className={cn('flex-1 rounded-lg border p-3 mb-1', {
                      'bg-red-50 border-red-200': event.severity === 'critical',
                      'bg-amber-50 border-amber-200': event.severity === 'warning',
                      'bg-green-50 border-green-200': event.severity === 'success',
                      'bg-blue-50 border-blue-200': event.severity === 'info',
                      'bg-white border-slate-200': event.severity === 'neutral',
                    })}>
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-sm text-slate-800">{event.title}</span>
                        <span className="text-[11px] text-slate-400 flex-shrink-0 font-mono">{fmt(event.ts)}</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{event.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Session History ──────────────────────────────────────── */}
          {sessions.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <TrendingDown className="h-5 w-5 text-slate-500" />
                <h2 className="text-base font-bold text-slate-900">Session Analysis</h2>
                <span className="text-xs text-slate-400 ml-1">({sessions.length} sessions)</span>
              </div>

              {chartData.length > 1 && (
                <Card className="mb-4 border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-slate-600">Wagered vs Won — Last {chartData.length} Sessions</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="session" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`} />
                        <RechartsTooltip formatter={(v: number) => `R${v.toLocaleString()}`} />
                        <Bar dataKey="wagered" name="Wagered" fill="#94a3b8" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="won" name="Won" fill="#34d399" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              <Card className="border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {['Date / Time', 'Duration', 'Wagered', 'Won', 'Net Result', 'Bets', 'Flags'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sessions.slice(0, 15).map(s => {
                        const net = Number(s.net_result);
                        return (
                          <tr key={s.id} className={cn('hover:bg-slate-50', s.is_late_night && 'bg-purple-50/40')}>
                            <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{fmt(s.session_start)}</td>
                            <td className="px-4 py-2.5">
                              <span className={cn('font-medium', s.duration_minutes > 90 ? 'text-red-600' : s.duration_minutes > 60 ? 'text-amber-600' : 'text-slate-700')}>
                                {s.duration_minutes} min
                              </span>
                            </td>
                            <td className="px-4 py-2.5 font-medium text-slate-700">{fmtCurrency(Number(s.total_wagered))}</td>
                            <td className="px-4 py-2.5 text-green-700 font-medium">{fmtCurrency(Number(s.total_won))}</td>
                            <td className="px-4 py-2.5">
                              <span className={cn('font-bold', net < 0 ? 'text-red-600' : 'text-green-600')}>
                                {net < 0 ? '−' : '+'}{fmtCurrency(net)}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-slate-600">{Number(s.total_bets)}</td>
                            <td className="px-4 py-2.5">
                              {s.is_late_night && (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">
                                  <Moon className="h-2.5 w-2.5" /> Late night
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {sessions.length > 15 && (
                  <div className="px-4 py-2 border-t bg-slate-50 text-xs text-slate-400">
                    Showing 15 of {sessions.length} sessions
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ── Interventions ────────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="h-5 w-5 text-slate-500" />
              <h2 className="text-base font-bold text-slate-900">Interventions & Responsible Gambling Actions</h2>
            </div>

            {interventions.length === 0 ? (
              <Card className="border-slate-200 bg-slate-50">
                <CardContent className="p-5 flex items-center gap-3 text-slate-500 text-sm">
                  <Info className="h-5 w-5 flex-shrink-0" />
                  No responsible gambling interventions recorded for this player.
                  {player.risk_score >= 70 && (
                    <span className="ml-2 text-amber-700 font-medium">⚠ Intervention recommended given current risk level.</span>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {interventions.map(iv => (
                  <Card key={iv.id} className="border-slate-200">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs uppercase">{iv.channel}</Badge>
                            <Badge variant="outline" className={cn('text-xs', {
                              'bg-green-50 text-green-700 border-green-200': iv.status === 'delivered',
                              'bg-amber-50 text-amber-700 border-amber-200': iv.status === 'sent',
                              'bg-slate-100 text-slate-600': iv.status === 'pending',
                            })}>{iv.status}</Badge>
                          </div>
                          <p className="text-sm text-slate-700 mt-1">{iv.message_content}</p>
                        </div>
                        <div className="text-xs text-slate-400 font-mono flex-shrink-0">{fmt(iv.created_at)}</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* ── Self-Exclusion ────────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Ban className="h-5 w-5 text-slate-500" />
              <h2 className="text-base font-bold text-slate-900">Self-Exclusion History</h2>
            </div>
            {exclusions.length === 0 ? (
              <Card className="border-slate-200 bg-slate-50">
                <CardContent className="p-5 flex items-center gap-3 text-slate-500 text-sm">
                  <XCircle className="h-5 w-5 flex-shrink-0" />
                  No self-exclusion records found for this player.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {exclusions.map(ex => (
                  <Card key={ex.id} className="border-slate-200">
                    <CardContent className="p-4 text-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-semibold capitalize text-slate-800">{ex.exclusion_type} — {ex.duration_type}</div>
                          {ex.reason && <p className="text-slate-500 mt-1">{ex.reason}</p>}
                          <div className="flex gap-4 mt-2 text-xs text-slate-400">
                            <span>Started: {fmtDate(ex.starts_at)}</span>
                            {ex.ends_at && <span>Ends: {fmtDate(ex.ends_at)}</span>}
                          </div>
                        </div>
                        <Badge variant="outline" className="capitalize text-xs">{ex.status}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── Evidence Pack (print-only + screen preview) ────────────── */}
      <div ref={printRef} className="print:block hidden print:p-8 text-sm font-sans">
        <EvidencePack
          player={player}
          casino={casino}
          sessions={sessions}
          interventions={interventions}
          exclusions={exclusions}
          riskFactors={riskFactors}
          recommendation={recommendation}
          timeline={timeline}
          netLoss={netLoss}
          lossRate={lossRate}
        />
      </div>

      {/* Screen-visible evidence pack preview (below main content) */}
      <div className="print:hidden">
        <div className="px-6 pb-8 max-w-[1400px] mx-auto">
          <Card className="border-2 border-dashed border-slate-300 bg-slate-50">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2 text-slate-600">
                <FileText className="h-4 w-4" />
                Evidence Pack — Regulator-Ready Export
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-500 mb-4">
                Click "Evidence Pack" in the header to open the browser print dialog. Select "Save as PDF" to generate a regulator-ready evidence document containing: player identity, risk score analysis, complete timeline, session history, interventions, and compliance recommendation.
              </p>
              <div className="bg-white border border-slate-200 rounded-lg p-4 text-xs font-mono text-slate-600 space-y-1">
                <div className="font-bold text-slate-800 text-sm mb-2">EVIDENCE PACK CONTENTS</div>
                <div>✓ Player identity and registration details</div>
                <div>✓ Risk score: {player.risk_score}/100 ({rc.label})</div>
                <div>✓ {riskFactors.length} risk factors identified</div>
                <div>✓ {timeline.length}-event investigation timeline</div>
                <div>✓ {sessions.length} session records with financials</div>
                <div>✓ {interventions.length} intervention records</div>
                <div>✓ {exclusions.length} self-exclusion records</div>
                <div>✓ Regulatory recommendation: {recommendation.priority} priority</div>
                <div>✓ Generated: {new Intl.DateTimeFormat('en-ZA').format(new Date())}</div>
              </div>
              <Button onClick={handlePrint} className="mt-4 gap-2" size="sm">
                <Printer className="h-4 w-4" />
                Generate Evidence Pack (PDF)
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

// ─── Evidence Pack Component (print layout) ───────────────────────────────────

function EvidencePack({
  player, casino, sessions, interventions, exclusions,
  riskFactors, recommendation, timeline, netLoss, lossRate,
}: {
  player: Player;
  casino: Casino | null;
  sessions: PlayerSession[];
  interventions: Intervention[];
  exclusions: SelfExclusion[];
  riskFactors: RiskFactor[];
  recommendation: Recommendation;
  timeline: TimelineEvent[];
  netLoss: number;
  lossRate: number;
}) {
  const rc = riskConfig(player.risk_score);
  const wagered = Number(player.total_wagered) || 0;
  const won = Number(player.total_won) || 0;
  const lateNight = sessions.filter(s => s.is_late_night).length;

  return (
    <div className="space-y-8 text-slate-900 max-w-[900px] mx-auto">
      {/* Header */}
      <div className="border-b-2 border-slate-900 pb-4">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-400 mb-1">SAFEBETIQ — PLAYER INVESTIGATION REPORT</div>
            <h1 className="text-2xl font-black">{player.first_name} {player.last_name}</h1>
            <div className="text-slate-500 mt-1 space-x-3 text-sm">
              <span>{player.player_id}</span>
              <span>·</span>
              <span>{casino?.name ?? 'Unknown Casino'}</span>
              <span>·</span>
              <span className="capitalize">{player.status}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-4xl font-black" style={{ color: player.risk_score >= 85 ? '#dc2626' : player.risk_score >= 70 ? '#ea580c' : '#ca8a04' }}>
              {player.risk_score}
            </div>
            <div className="text-xs text-slate-400">RISK SCORE /100</div>
            <div className="font-bold text-sm mt-1 uppercase">{rc.label} RISK</div>
          </div>
        </div>
        <div className="flex gap-6 mt-4 text-xs text-slate-500">
          <span>Generated: {new Intl.DateTimeFormat('en-ZA', { dateStyle: 'full', timeStyle: 'short' }).format(new Date())}</span>
          <span>Registered: {fmtDate(player.signup_date)}</span>
          <span>Last active: {fmtDate(player.last_active)}</span>
        </div>
      </div>

      {/* Regulatory Recommendation */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 border-b pb-1">Regulatory Recommendation</h2>
        <div className="bg-slate-100 rounded p-4">
          <div className="font-bold text-base mb-2">[{recommendation.priority}] {recommendation.action}</div>
          <ol className="space-y-1 text-sm">
            {recommendation.steps.map((s, i) => (
              <li key={i}>{i + 1}. {s}</li>
            ))}
          </ol>
          <div className="mt-3 text-xs text-slate-500 italic">{recommendation.regulatory}</div>
        </div>
      </div>

      {/* Financial Summary */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 border-b pb-1">Financial Summary</h2>
        <div className="grid grid-cols-4 gap-4 text-center">
          {[
            { label: 'Total Wagered', value: fmtCurrency(wagered) },
            { label: 'Total Won', value: fmtCurrency(won) },
            { label: 'Net Loss', value: fmtCurrency(netLoss) },
            { label: 'Loss Rate', value: `${Math.round(lossRate)}%` },
          ].map(s => (
            <div key={s.label} className="border border-slate-200 rounded p-3">
              <div className="font-bold text-lg">{s.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-4 text-center mt-3">
          {[
            { label: 'Sessions', value: player.session_count.toString() },
            { label: 'Avg Duration', value: `${player.avg_session_duration} min` },
            { label: 'Late-Night Sessions', value: lateNight.toString() },
            { label: 'Interventions', value: interventions.length.toString() },
          ].map(s => (
            <div key={s.label} className="border border-slate-200 rounded p-3">
              <div className="font-bold text-lg">{s.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Risk Factors */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 border-b pb-1">AI Risk Analysis</h2>
        {riskFactors.length === 0 ? (
          <p className="text-sm text-slate-500">No significant risk factors detected.</p>
        ) : (
          <div className="space-y-2">
            {riskFactors.map((f, i) => (
              <div key={i} className="flex gap-3 items-start border border-slate-200 rounded p-3">
                <span className="text-xs font-bold uppercase bg-slate-800 text-white px-2 py-0.5 rounded flex-shrink-0">{f.weight}</span>
                <div>
                  <div className="font-semibold text-sm">{f.label} — {f.value}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{f.description}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 border-b pb-1">Investigation Timeline</h2>
        <div className="space-y-2">
          {timeline.map((event) => (
            <div key={event.id} className="flex gap-3 items-start">
              <span className="text-[11px] font-mono text-slate-400 flex-shrink-0 w-32 pt-0.5">{new Date(event.ts).toLocaleDateString('en-ZA')}</span>
              <div className="flex-1 border-l-2 border-slate-200 pl-3">
                <div className="font-semibold text-sm">{event.title}</div>
                <div className="text-xs text-slate-500 mt-0.5">{event.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sessions */}
      {sessions.length > 0 && (
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 border-b pb-1">Session History (most recent {Math.min(sessions.length, 10)})</h2>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100">
                {['Date / Time', 'Duration', 'Wagered', 'Won', 'Net Result', 'Flags'].map(h => (
                  <th key={h} className="text-left p-2 border border-slate-200 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.slice(0, 10).map(s => (
                <tr key={s.id} className="border border-slate-200">
                  <td className="p-2 border font-mono">{fmt(s.session_start)}</td>
                  <td className="p-2 border">{s.duration_minutes} min</td>
                  <td className="p-2 border">{fmtCurrency(Number(s.total_wagered))}</td>
                  <td className="p-2 border">{fmtCurrency(Number(s.total_won))}</td>
                  <td className="p-2 border font-bold" style={{ color: Number(s.net_result) < 0 ? '#dc2626' : '#16a34a' }}>
                    {Number(s.net_result) < 0 ? '−' : '+'}{fmtCurrency(Number(s.net_result))}
                  </td>
                  <td className="p-2 border">{s.is_late_night ? 'Late night' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Interventions */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 border-b pb-1">Interventions</h2>
        {interventions.length === 0 ? (
          <p className="text-sm text-slate-500">No interventions recorded.</p>
        ) : interventions.map(iv => (
          <div key={iv.id} className="border border-slate-200 rounded p-3 mb-2 text-sm">
            <div className="flex justify-between">
              <span className="font-semibold uppercase">{iv.channel} — {iv.status}</span>
              <span className="text-xs text-slate-400 font-mono">{fmt(iv.created_at)}</span>
            </div>
            <p className="text-slate-600 mt-1 text-xs">{iv.message_content}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-300 pt-4 text-xs text-slate-400 flex justify-between">
        <span>SafeBet IQ — Confidential Regulatory Document</span>
        <span>Generated by {player.player_id} investigation module</span>
      </div>
    </div>
  );
}
