'use client';

import { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { useCasinoData } from '@/contexts/CasinoDataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCasinoSettings } from '@/contexts/CasinoSettingsContext';
import { interpolateMessage } from '@/lib/casinoSettings';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  ShieldCheck, TrendingUp, AlertTriangle, Users, DollarSign,
  Info, Zap, Brain, Clock, Send, CheckCircle2, Loader2,
  Monitor, MessageSquare, Smartphone, Mail, XCircle, Target,
} from 'lucide-react';
import { InterventionRegulatorView } from '@/components/analytics/InterventionRegulatorView';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  AreaChart, Area,
} from 'recharts';

// ── Model rates (static — not per-casino) ─────────────────────────────────────
const RETENTION_IMPACT      = 0.4;
const FRAUD_PREVENTION_RATE = 0.6;
const PREDICTION_WINDOW_MIN = 30;
const OUTCOME_SUCCESS_RATE  = 0.60;  // 60% of player outcomes are accepted

// Per-casino values (intervention_threshold, enabled_channels, cooldown_minutes,
// message_template) now come from CasinoSettingsContext — see settings hook below.

// ── Multi-channel dispatch ────────────────────────────────────────────────────
type Channel = 'in_app' | 'whatsapp' | 'sms' | 'email';
type ChannelStatus = 'pending' | 'sending' | 'sent' | 'failed';

const CHANNELS: Channel[] = ['in_app', 'whatsapp', 'sms', 'email'];

// Visual stagger between channel starts (ms) — purely for UX animation
// Real dispatch happens immediately after each channel's stagger delay
const CHANNEL_STAGGER_MS = 220;

const CHANNEL_ICON: Record<Channel, React.ElementType> = {
  in_app:   Monitor,
  whatsapp: MessageSquare,
  sms:      Smartphone,
  email:    Mail,
};

const CHANNEL_LABEL: Record<Channel, string> = {
  in_app: 'App', whatsapp: 'WA', sms: 'SMS', email: 'Email',
};

function riskWeight(score: number): number {
  if (score >= 85) return 1.0;
  if (score >= 70) return 0.6;
  if (score >= 40) return 0.2;
  return 0;
}

function formatRand(value: number): string {
  if (value >= 1_000_000) return `R ${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000)     return `R ${(value / 1_000).toFixed(1)}K`;
  return `R ${Math.round(value).toLocaleString()}`;
}

function saTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-ZA', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZone: 'Africa/Johannesburg',
  });
}

// ── Shared KPI card ───────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  badge?: string;
  badgeVariant?: 'default' | 'destructive' | 'outline' | 'secondary';
  tooltip: string;
  highlight?: boolean;
}

function MetricCard({ label, value, sub, icon: Icon, iconBg, iconColor, badge, badgeVariant = 'outline', tooltip, highlight }: MetricCardProps) {
  return (
    <Card className={`border-border ${highlight ? 'bg-red-950/20 border-red-800/40' : 'bg-card'}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
          <div className="flex items-center gap-1.5">
            {badge && <Badge variant={badgeVariant} className="text-xs">{badge}</Badge>}
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">{tooltip}</TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div className={`text-2xl font-bold tracking-tight ${highlight ? 'text-red-400' : 'text-foreground'}`}>{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
        <div className="text-xs text-muted-foreground/60 mt-0.5">{sub}</div>
      </CardContent>
    </Card>
  );
}

function riskBadgeClass(level: string): string {
  if (level === 'critical') return 'bg-red-600 text-white border-0';
  if (level === 'high')     return 'bg-orange-500 text-white border-0';
  if (level === 'moderate') return 'bg-yellow-500 text-white border-0';
  return 'bg-emerald-600 text-white border-0';
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export function RevenueDashboard() {
  const { data } = useCasinoData();
  const { user } = useAuth();
  const casinoId = (user as any)?.casino_id as string | undefined;

  // Per-casino settings — loaded from casino_settings, live-updated via Supabase Realtime
  const { settings } = useCasinoSettings();

  // Use a ref so async callbacks (triggerIntervention) always read the LATEST
  // settings without needing to be in the useCallback dependency array.
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  const { activePlayers, liveEvents } = data;

  // ── Per-player sent tracking (in-memory, session-scoped) ──────────────────
  const sentAtRef = useRef<Map<string, number>>(new Map());

  // ── Row-level UI state ────────────────────────────────────────────────────
  const [rowState, setRowState]         = useState<Record<string, 'idle' | 'sending' | 'sent' | 'skipped'>>({});
  const [channelStates, setChannelStates] = useState<Record<string, Record<Channel, ChannelStatus>>>({});
  const [outcomeState, setOutcomeState]   = useState<Record<string, 'accepted' | 'declined'>>({});

  // ── Session-level counters ────────────────────────────────────────────────
  const [predictiveCount, setPredictiveCount] = useState(0);
  const [resolvedCount,   setResolvedCount]   = useState(0);
  const [successCount,    setSuccessCount]     = useState(0);

  // ── Velocity + aggregation map — single pass over liveEvents ─────────────
  const playerVelocityMap = useMemo(() => {
    type VEntry = { totalBet: number; betCount: number; firstSeen: number; lastSeen: number };
    const map = new Map<string, VEntry>();

    for (const e of liveEvents) {
      if (!e.bet_amount || e.bet_amount <= 0) continue;
      const ts = new Date(e.created_at).getTime();
      const existing = map.get(e.player_id);
      if (existing) {
        existing.totalBet += e.bet_amount;
        existing.betCount += 1;
        if (ts < existing.firstSeen) existing.firstSeen = ts;
        if (ts > existing.lastSeen)  existing.lastSeen  = ts;
      } else {
        map.set(e.player_id, { totalBet: e.bet_amount, betCount: 1, firstSeen: ts, lastSeen: ts });
      }
    }

    const enriched = new Map<string, { totalBet: number; betCount: number; avgBet: number; betsPerMinute: number }>();
    for (const [pid, v] of Array.from(map)) {
      const spanMs     = Math.max(v.lastSeen - v.firstSeen, 0);
      const spanMin    = spanMs > 0 ? spanMs / 60_000 : 1;
      const betsPerMin = Math.min(v.betCount / spanMin, 10);
      enriched.set(pid, {
        totalBet:      v.totalBet,
        betCount:      v.betCount,
        avgBet:        v.totalBet / v.betCount,
        betsPerMinute: betsPerMin,
      });
    }
    return enriched;
  }, [liveEvents]);

  // ── Historical: Revenue Saved ─────────────────────────────────────────────
  const revenueSavedPlayers = useMemo(
    () => activePlayers.filter(p => p.risk_score >= 70 && p.intervention_triggered),
    [activePlayers]
  );
  const totalRevenueSaved = useMemo(() =>
    revenueSavedPlayers.reduce((sum, p) => {
      const v = playerVelocityMap.get(p.player_id);
      return sum + (v ? v.totalBet * RETENTION_IMPACT : 0);
    }, 0),
    [revenueSavedPlayers, playerVelocityMap]
  );

  // ── Historical: Loss Prevented ────────────────────────────────────────────
  const lossPreventedPlayers = useMemo(
    () => activePlayers.filter(p => p.risk_score >= 85),
    [activePlayers]
  );
  const totalLossPrevented = useMemo(() =>
    lossPreventedPlayers.reduce((sum, p) => {
      const v = playerVelocityMap.get(p.player_id);
      return sum + (v ? v.totalBet : 0);
    }, 0),
    [lossPreventedPlayers, playerVelocityMap]
  );

  // ── Historical: Fraud Prevented ───────────────────────────────────────────
  const fraudEvents = useMemo(
    () => liveEvents.filter(e => Array.isArray(e.risk_flags) && e.risk_flags.includes('rapid_high_stakes')),
    [liveEvents]
  );
  const totalFraudPrevented = useMemo(
    () => fraudEvents.reduce((sum, e) => sum + e.bet_amount * FRAUD_PREVENTION_RATE, 0),
    [fraudEvents]
  );

  const activeHighRiskCount = useMemo(
    () => activePlayers.filter(p => p.risk_score >= 70).length,
    [activePlayers]
  );
  const totalImpact = totalRevenueSaved + totalLossPrevented + totalFraudPrevented;

  const avgBetAcrossEvents = useMemo(() => {
    const betting = liveEvents.filter(e => e.bet_amount > 0);
    return betting.length > 0
      ? betting.reduce((s, e) => s + e.bet_amount, 0) / betting.length
      : 0;
  }, [liveEvents]);

  // ── Predictive: per-player predicted loss ────────────────────────────────
  const playerPredictions = useMemo(() => {
    return activePlayers
      .map(p => {
        const v         = playerVelocityMap.get(p.player_id);
        const weight    = riskWeight(p.risk_score);
        const avgBet    = v?.avgBet         ?? 0;
        const rate      = v?.betsPerMinute  ?? 0;
        const predicted = Math.round(avgBet * rate * PREDICTION_WINDOW_MIN * weight);
        return {
          player_id:    p.player_id,
          display_name: p.display_name,
          risk_score:   p.risk_score,
          risk_level:   p.risk_level,
          avgBet,
          betsPerMinute: rate,
          predictedLoss: predicted,
          needsAction:   predicted >= settings.intervention_threshold,
        };
      })
      .filter(p => p.predictedLoss > 0)
      .sort((a, b) => b.predictedLoss - a.predictedLoss);
  }, [activePlayers, playerVelocityMap, settings.intervention_threshold]);

  const totalPredictedAtRisk = useMemo(
    () => playerPredictions.reduce((s, p) => s + p.predictedLoss, 0),
    [playerPredictions]
  );

  const immediateActionPlayers = useMemo(
    () => playerPredictions.filter(p => p.needsAction),
    [playerPredictions]
  );

  // ── Chart data ────────────────────────────────────────────────────────────
  const historicalChartData = useMemo(() =>
    liveEvents.slice(0, 20).reverse().map(e => {
      const w = e.risk_score >= 85 ? 1.0 : e.risk_score >= 70 ? RETENTION_IMPACT : e.risk_score >= 40 ? 0.15 : 0;
      return { time: saTime(e.created_at), protectionValue: Math.round(e.bet_amount * w), riskScore: e.risk_score };
    }),
    [liveEvents]
  );

  const predictionChartData = useMemo(() =>
    playerPredictions.slice(0, 20).map(p => ({
      player:        p.display_name.split(' ')[0] + ' ' + (p.display_name.split(' ')[1]?.[0] ?? '') + '.',
      predictedLoss: p.predictedLoss,
      riskScore:     p.risk_score,
      threshold:     settings.intervention_threshold,
    })),
    [playerPredictions, settings.intervention_threshold]
  );

  // ── INTERVENTION ENGINE ───────────────────────────────────────────────────
  //
  // triggerIntervention(player):
  //   1. In-memory dedup: if sent within DEDUP_WINDOW_MS, skip silently.
  //   2. DB dedup: query intervention_history for same player, same casino,
  //      triggered_at within last 10 min — skip if found.
  //   3. Insert row into intervention_history.
  //   4. Show toast, update rowState, increment predictiveCount.
  //
  // All DB writes are scoped by casino_id (RLS enforces this at the DB level too).

  const triggerIntervention = useCallback(async (player: typeof immediateActionPlayers[number]) => {
    if (!casinoId) {
      toast.error('Cannot trigger intervention: casino ID unavailable');
      return;
    }

    const pid = player.player_id;

    // Read settings at the moment of trigger (settingsRef always has latest values)
    const s             = settingsRef.current;
    const cooldownMs    = s.cooldown_minutes * 60 * 1000;
    const activeChannels = s.enabled_channels as Channel[];

    // ── In-memory dedup ───────────────────────────────────────────────────
    const lastSent = sentAtRef.current.get(pid);
    if (lastSent && Date.now() - lastSent < cooldownMs) {
      const remaining = Math.ceil((cooldownMs - (Date.now() - lastSent)) / 60_000);
      toast.info(`Cooling off — ${remaining} min remaining for ${player.display_name}`);
      setRowState(st => ({ ...st, [pid]: 'skipped' }));
      return;
    }

    setRowState(st => ({ ...st, [pid]: 'sending' }));

    // ── DB dedup — cross-session safety ──────────────────────────────────
    const tenMinAgo = new Date(Date.now() - cooldownMs).toISOString();
    const { data: existing, error: checkErr } = await supabase
      .from('intervention_history')
      .select('id')
      .eq('player_id', pid)
      .eq('casino_id', casinoId)
      .gte('triggered_at', tenMinAgo)
      .limit(1)
      .maybeSingle();

    if (checkErr) {
      console.error('Dedup check failed:', checkErr.message);
    }

    if (existing) {
      toast.info(`Already dispatched to ${player.display_name} within the last ${s.cooldown_minutes} minutes`);
      sentAtRef.current.set(pid, Date.now());
      setRowState(st => ({ ...st, [pid]: 'skipped' }));
      return;
    }

    // ── Insert intervention_history ───────────────────────────────────────
    const triggerReason =
      `Predictive model: projected loss of ${formatRand(player.predictedLoss)} ` +
      `in next ${PREDICTION_WINDOW_MIN} min at ${player.betsPerMinute.toFixed(1)} bets/min ` +
      `(risk score ${player.risk_score})`;

    const { data: inserted, error: insertErr } = await supabase
      .from('intervention_history')
      .insert({
        player_id:             pid,
        casino_id:             casinoId,
        intervention_type:     'predictive_intervention',
        trigger_reason:        triggerReason,
        risk_score_at_trigger: player.risk_score,
        delivery_method:       'in_app',
        channels_attempted:    CHANNELS,
        message_sent:
          `SafeBet IQ Alert: Our responsible gambling AI has detected elevated risk. ` +
          `Please consider taking a break. Support: 0800 006 008.`,
        dispatch_status:       'pending',
        auto_triggered:        true,
        triggered_at:          new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertErr || !inserted) {
      console.error('Intervention insert failed:', insertErr?.message);
      toast.error(`Failed to create intervention for ${player.display_name}: ${insertErr?.message}`);
      setRowState(s => ({ ...s, [pid]: 'idle' }));
      return;
    }

    const interventionId = inserted.id;
    sentAtRef.current.set(pid, Date.now());
    setPredictiveCount(c => c + 1);

    // ── Build recipient map ───────────────────────────────────────────────
    // Generated once so the same addresses are used in both the queue insert
    // and the real dispatch call.
    const demoPhone = `+2760${Math.floor(1000000 + Math.random() * 9000000)}`;
    const recipientMap: Record<Channel, string> = {
      in_app:   pid,
      whatsapp: demoPhone,
      sms:      demoPhone,
      email:    `player-${pid.slice(-6)}@demo.safebet.iq`,
    };

    // ── Insert delivery queue rows (one per enabled channel) ─────────────
    // Use the casino's message template with variable substitution
    const baseMsg = interpolateMessage(s.message_template, {
      player: player.display_name,
      risk:   player.risk_score,
      amount: formatRand(player.predictedLoss).replace('R ', ''),
    });

    const { data: queueRows } = await supabase
      .from('intervention_delivery_queue')
      .insert(
        activeChannels.map(ch => ({
          intervention_id:   interventionId,
          casino_id:         casinoId,
          player_id:         pid,
          channel:           ch,
          status:            'pending',
          message_body:      baseMsg,
          recipient_address: recipientMap[ch] ?? pid,
          attempts:          0,
          scheduled_at:      new Date().toISOString(),
        }))
      )
      .select('id, channel');

    // Map channel → queue row id for status updates
    const queueIdMap = Object.fromEntries(
      (queueRows ?? []).map(r => [r.channel as Channel, r.id as string])
    ) as Record<Channel, string>;

    // ── Initialise channel states for ENABLED channels only ────────────────
    const initState = Object.fromEntries(
      activeChannels.map(ch => [ch, 'pending' as ChannelStatus])
    ) as Record<Channel, ChannelStatus>;
    setChannelStates(cs => ({ ...cs, [pid]: initState }));

    toast.info(
      `Dispatching to ${activeChannels.length} channel${activeChannels.length > 1 ? 's' : ''} — ${player.display_name}`,
      { description: activeChannels.map(c => CHANNEL_LABEL[c] ?? c).join(' · '), duration: 3000 }
    );

    // ── Real dispatch per channel (staggered start, parallel) ────────────
    // Local maps avoid stale closure — written inside each per-channel fn.
    const channelResults = new Map<Channel, ChannelStatus>(
      CHANNELS.map(ch => [ch, 'pending'])
    );
    const sidMap = new Map<Channel, string | undefined>();

    const dispatchChannel = async (ch: Channel, idx: number) => {
      // Brief stagger so channel pills animate sequentially (visual only)
      await new Promise<void>(r => setTimeout(r, idx * CHANNEL_STAGGER_MS));
      setChannelStates(s => ({ ...s, [pid]: { ...s[pid], [ch]: 'sending' } }));

      // ── Call the server-side API route (keeps Twilio credentials off the client) ──
      const attemptDispatch = async () => {
        const res = await fetch('/api/interventions/dispatch', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ channel: ch, recipient: recipientMap[ch], message: baseMsg }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ success: boolean; sid?: string; error?: string }>;
      };

      let result: { success: boolean; sid?: string; error?: string };
      let attempts = 1;

      try {
        result = await attemptDispatch();
        if (!result.success) {
          // ── Retry once after 3 seconds ───────────────────────────────────
          console.warn(`[dispatch] ${ch} failed (attempt 1) — ${result.error} — retrying in 3s`);
          await new Promise<void>(r => setTimeout(r, 3000));
          result = await attemptDispatch();
          attempts = 2;
        }
      } catch (err) {
        console.warn(`[dispatch] ${ch} threw (attempt 1) — ${err} — retrying in 3s`);
        await new Promise<void>(r => setTimeout(r, 3000));
        try {
          result = await attemptDispatch();
          attempts = 2;
        } catch (retryErr) {
          result  = { success: false, error: String(retryErr) };
          attempts = 2;
        }
      }

      const finalStatus: ChannelStatus = result.success ? 'sent' : 'failed';
      channelResults.set(ch, finalStatus);
      sidMap.set(ch, result.sid);
      setChannelStates(s => ({ ...s, [pid]: { ...s[pid], [ch]: finalStatus } }));

      if (result.success) {
        console.log(`[dispatch] ${ch} sent — SID: ${result.sid ?? 'n/a'} → player …${pid.slice(-6)}`);
      } else {
        console.error(`[dispatch] ${ch} failed — ${result.error} → player …${pid.slice(-6)}`);
      }

      // ── Persist result to delivery queue ──────────────────────────────────
      const qid = queueIdMap[ch];
      if (qid) {
        await supabase
          .from('intervention_delivery_queue')
          .update({
            status:              finalStatus,
            attempts,
            provider_message_id: result.sid ?? null,
            error_message:       result.error ?? null,
            sent_at:             result.success ? new Date().toISOString() : null,
            failed_at:           !result.success ? new Date().toISOString() : null,
            provider_response:   { sid: result.sid, success: result.success, channel: ch },
          })
          .eq('id', qid);
      }
    };

    // Run all ENABLED channels in parallel (each awaits its own stagger + API call)
    await Promise.all(activeChannels.map((ch, idx) => dispatchChannel(ch, idx)));

    // ── Update intervention_history with final dispatch status ─────────────
    const sentCount = Array.from(channelResults.values()).filter(st => st === 'sent').length;
    const dispatchStatus =
      sentCount === activeChannels.length ? 'sent'
      : sentCount > 0                     ? 'partial'
      :                                     'failed';

    // Primary SID: prefer whatsapp, then sms, then in_app (for audit log)
    const primarySid =
      sidMap.get('whatsapp') ?? sidMap.get('sms') ?? sidMap.get('in_app');

    await supabase
      .from('intervention_history')
      .update({
        dispatch_status:    dispatchStatus,
        channels_attempted: activeChannels,
        twilio_sid:         primarySid ?? null,
      })
      .eq('id', interventionId);

    setRowState(s => ({ ...s, [pid]: 'sent' }));

    toast.success(
      `Dispatched — ${player.display_name}`,
      {
        description: `${sentCount}/${CHANNELS.length} channels delivered · Risk ${player.risk_score} · ${formatRand(player.predictedLoss)} at risk`,
        duration: 5000,
      }
    );

    // ── Outcome simulation — 60% acceptance rate, fires 2s after dispatch ─
    await new Promise(r => setTimeout(r, 2000));

    const accepted: boolean = Math.random() < OUTCOME_SUCCESS_RATE;
    const response: 'accepted' | 'declined' = accepted ? 'accepted' : 'declined';

    await supabase
      .from('intervention_history')
      .update({
        player_response:         response,
        intervention_successful: accepted,
        resolved_at:             new Date().toISOString(),
      })
      .eq('id', interventionId);

    setOutcomeState(s => ({ ...s, [pid]: response }));
    setResolvedCount(c => c + 1);
    if (accepted) setSuccessCount(c => c + 1);

    toast[accepted ? 'success' : 'info'](
      `Outcome: ${player.display_name} ${accepted ? 'accepted' : 'declined'}`,
      {
        description: accepted
          ? `Intervention accepted · ${sentCount}/${CHANNELS.length} channels · risk score may reduce`
          : `Player declined · case flagged for manual review`,
        duration: 6000,
      }
    );
  }, [casinoId]);

  // Trigger ALL immediate-action players that haven't been sent yet
  const triggerAll = useCallback(async () => {
    const cooldownMs = settingsRef.current.cooldown_minutes * 60 * 1000;
    const pending = immediateActionPlayers.filter(p => {
      const last = sentAtRef.current.get(p.player_id);
      return !last || Date.now() - last >= cooldownMs;
    });

    if (pending.length === 0) {
      toast.info('All immediate-action players already have active interventions');
      return;
    }

    toast.info(`Triggering ${pending.length} intervention${pending.length > 1 ? 's' : ''}…`);
    for (const p of pending) {
      await triggerIntervention(p);
    }
  }, [immediateActionPlayers, triggerIntervention]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <TooltipProvider>
      <div className="space-y-6">

        {/* ── Hero KPI ──────────────────────────────────────────────────────── */}
        <Card className="bg-gradient-to-br from-emerald-950/40 to-card border-emerald-800/40">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <ShieldCheck className="h-5 w-5 text-emerald-400" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">Total Revenue Protected</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground/50 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm text-xs">
                      Revenue Saved = actual wagers × {RETENTION_IMPACT} (intervened players). Loss Prevented = actual wagers (risk ≥ 85). Fraud Prevented = rapid_high_stakes bet amounts × {FRAUD_PREVENTION_RATE}.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="text-4xl font-bold text-emerald-400 tracking-tight">
                  {formatRand(totalImpact)}
                </div>
                <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap">
                  <span>{activePlayers.length} active players</span>
                  <span>·</span>
                  <span>{liveEvents.length} events</span>
                  <span>·</span>
                  <span>avg bet {formatRand(avgBetAcrossEvents)}</span>
                  <span>·</span>
                  <span>{fraudEvents.length} fraud signals</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-700/40 text-xs">
                  <Zap className="h-3 w-3 mr-1" />
                  Live · Updates with every event
                </Badge>
                {immediateActionPlayers.length > 0 && (
                  <Badge variant="destructive" className="text-xs animate-pulse">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {immediateActionPlayers.length} immediate interventions
                  </Badge>
                )}
                {predictiveCount > 0 && (
                  <Badge className="bg-violet-500/20 text-violet-400 border-violet-700/40 text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {predictiveCount} predictive sent
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Historical KPI grid ───────────────────────────────────────────── */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">Historical Protection</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Revenue Saved"
              value={formatRand(totalRevenueSaved)}
              sub={`${revenueSavedPlayers.length} players · intervention triggered`}
              icon={TrendingUp} iconBg="bg-blue-500/10" iconColor="text-blue-400"
              badge={revenueSavedPlayers.length > 0 ? `${revenueSavedPlayers.length} players` : undefined}
              tooltip={`Risk ≥ 70, intervention triggered. SUM(player.total_bet × ${RETENTION_IMPACT}).`}
            />
            <MetricCard
              label="Loss Prevented"
              value={formatRand(totalLossPrevented)}
              sub={`${lossPreventedPlayers.length} players · risk ≥ 85`}
              icon={ShieldCheck} iconBg="bg-amber-500/10" iconColor="text-amber-400"
              badge={lossPreventedPlayers.length > 0 ? 'Critical' : undefined}
              badgeVariant={lossPreventedPlayers.length > 0 ? 'destructive' : 'outline'}
              tooltip="Risk ≥ 85. SUM(player.actual total wagered in event window)."
            />
            <MetricCard
              label="Fraud Prevented"
              value={formatRand(totalFraudPrevented)}
              sub={`${fraudEvents.length} rapid_high_stakes events`}
              icon={AlertTriangle} iconBg="bg-red-500/10" iconColor="text-red-400"
              badge={fraudEvents.length > 0 ? `${fraudEvents.length} events` : undefined}
              badgeVariant={fraudEvents.length > 0 ? 'destructive' : 'outline'}
              tooltip={`Events flagged "rapid_high_stakes". SUM(event.bet_amount × ${FRAUD_PREVENTION_RATE}).`}
            />
            <MetricCard
              label="Active High-Risk Players"
              value={String(activeHighRiskCount)}
              sub={`of ${activePlayers.length} active · risk ≥ 70`}
              icon={Users} iconBg="bg-violet-500/10" iconColor="text-violet-400"
              badge={activeHighRiskCount > 0 ? 'Needs attention' : 'Clear'}
              badgeVariant={activeHighRiskCount > 0 ? 'destructive' : 'secondary'}
              tooltip="Active players (last 10 min) with risk ≥ 70."
            />
          </div>
        </div>

        {/* ── Predictive KPI grid ───────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
              Predictive Revenue Intelligence
            </h2>
            <Badge className="bg-violet-500/20 text-violet-400 border-violet-700/40 text-xs gap-1">
              <Brain className="h-3 w-3" />
              {PREDICTION_WINDOW_MIN}-min forecast
            </Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 mb-4">
            <MetricCard
              label="Predicted Revenue at Risk"
              value={formatRand(totalPredictedAtRisk)}
              sub={`${playerPredictions.length} players · next ${PREDICTION_WINDOW_MIN} min`}
              icon={Brain} iconBg="bg-violet-500/10" iconColor="text-violet-400"
              badge={totalPredictedAtRisk > 0 ? 'Forecast' : 'No risk'}
              badgeVariant={totalPredictedAtRisk > settings.intervention_threshold ? 'destructive' : 'secondary'}
              highlight={totalPredictedAtRisk > settings.intervention_threshold * 3}
              tooltip={`SUM(avgBet × betsPerMinute × ${PREDICTION_WINDOW_MIN} × riskWeight). All from real liveEvents data.`}
            />
            <MetricCard
              label="Immediate Interventions Required"
              value={String(immediateActionPlayers.length)}
              sub={`predicted loss > ${formatRand(settings.intervention_threshold)} each`}
              icon={AlertTriangle}
              iconBg={immediateActionPlayers.length > 0 ? 'bg-red-500/10' : 'bg-muted'}
              iconColor={immediateActionPlayers.length > 0 ? 'text-red-400' : 'text-muted-foreground'}
              badge={immediateActionPlayers.length > 0 ? 'Act now' : 'Clear'}
              badgeVariant={immediateActionPlayers.length > 0 ? 'destructive' : 'secondary'}
              highlight={immediateActionPlayers.length > 0}
              tooltip={`Players whose 30-min predicted loss exceeds R${settings.intervention_threshold.toLocaleString()}.`}
            />
            <MetricCard
              label="Avg Predicted Loss / Player"
              value={playerPredictions.length > 0 ? formatRand(totalPredictedAtRisk / playerPredictions.length) : 'R 0'}
              sub={`across ${playerPredictions.length} modelled players`}
              icon={Clock} iconBg="bg-orange-500/10" iconColor="text-orange-400"
              tooltip={`Mean predictedLoss across players with risk ≥ 40 and active betting history.`}
            />
            {/* ── Predictive interventions triggered ── */}
            <MetricCard
              label="Interventions Triggered (Predictive)"
              value={String(predictiveCount)}
              sub="this session · multi-channel dispatch"
              icon={Send}
              iconBg={predictiveCount > 0 ? 'bg-emerald-500/10' : 'bg-muted'}
              iconColor={predictiveCount > 0 ? 'text-emerald-400' : 'text-muted-foreground'}
              badge={predictiveCount > 0 ? `${predictiveCount} sent` : 'None yet'}
              badgeVariant={predictiveCount > 0 ? 'default' : 'outline'}
              tooltip="Count of predictive_intervention rows inserted this session. Each insert fans out to 4 delivery channels (App · WhatsApp · SMS · Email) with dedup window of 10 minutes."
            />
            {/* ── Intervention success rate ── */}
            <MetricCard
              label="Intervention Success Rate"
              value={resolvedCount > 0 ? `${Math.round((successCount / resolvedCount) * 100)}%` : '—'}
              sub={resolvedCount > 0 ? `${successCount} accepted of ${resolvedCount} resolved` : 'No outcomes yet'}
              icon={Target}
              iconBg={successCount > 0 ? 'bg-teal-500/10' : 'bg-muted'}
              iconColor={successCount > 0 ? 'text-teal-400' : 'text-muted-foreground'}
              badge={resolvedCount > 0
                ? `${Math.round((successCount / resolvedCount) * 100)}%`
                : 'Pending'}
              badgeVariant={resolvedCount > 0 && (successCount / resolvedCount) >= 0.6 ? 'default' : 'outline'}
              tooltip="Percentage of dispatched interventions where the player responded 'accepted'. Outcome is simulated 2 seconds after dispatch at a 60% acceptance rate. Persisted to intervention_history.intervention_successful."
            />
          </div>

          {/* ── Prediction trend chart ──────────────────────────────────────── */}
          <Card className="bg-card border-border mb-4">
            <CardHeader className="pb-2 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Predicted Revenue at Risk — Per Player</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    avgBet × betsPerMinute × {PREDICTION_WINDOW_MIN} min × riskWeight · threshold R{settings.intervention_threshold.toLocaleString()}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="gap-1 text-xs">
                  <div className="h-2 w-2 rounded-full bg-violet-400 animate-pulse" />
                  Live forecast
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {predictionChartData.length === 0 ? (
                <div className="flex items-center justify-center h-52 text-muted-foreground text-sm">
                  <div className="text-center">
                    <Brain className="h-8 w-8 opacity-30 mx-auto mb-2" />
                    <p>No active players with risk ≥ 40</p>
                    <p className="text-xs opacity-60 mt-1">Forecast populates as risky betting events arrive</p>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={predictionChartData} margin={{ top: 4, right: 8, bottom: 24, left: 0 }}>
                    <defs>
                      <linearGradient id="predGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="player" fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} interval={0} angle={-30} textAnchor="end" height={44} />
                    <YAxis fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => v >= 1000 ? `R${(v / 1000).toFixed(0)}K` : `R${v}`} width={52} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(value: number, name: string) => {
                        if (name === 'predictedLoss') return [`R ${value.toLocaleString()}`, 'Predicted Loss'];
                        if (name === 'threshold')     return [`R ${value.toLocaleString()}`, 'Action Threshold'];
                        if (name === 'riskScore')     return [value, 'Risk Score'];
                        return [value, name];
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} formatter={v =>
                      v === 'predictedLoss' ? 'Predicted Loss (R)' :
                      v === 'threshold'     ? `Threshold (R${settings.intervention_threshold.toLocaleString()})` :
                      'Risk Score'
                    } />
                    <Area type="monotone" dataKey="predictedLoss" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#predGradient)" dot={{ r: 3, fill: '#8b5cf6' }} activeDot={{ r: 5 }} />
                    <Line  type="monotone" dataKey="threshold"     stroke="#ef4444" strokeWidth={1.5} strokeDasharray="6 3" dot={false} />
                    <Line  type="monotone" dataKey="riskScore"     stroke="#f97316" strokeWidth={1}   strokeDasharray="3 2" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* ── Immediate intervention player table ─────────────────────────── */}
          {immediateActionPlayers.length > 0 && (
            <Card className="bg-red-950/10 border-red-800/30">
              <CardHeader className="pb-2 border-b border-red-800/30">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="text-sm font-semibold text-red-400 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Immediate Intervention Required
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Players projected to exceed R{settings.intervention_threshold.toLocaleString()} loss in the next {PREDICTION_WINDOW_MIN} minutes
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive" className="animate-pulse text-xs">
                      {immediateActionPlayers.length} {immediateActionPlayers.length === 1 ? 'player' : 'players'}
                    </Badge>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="text-xs h-7 gap-1.5"
                      onClick={triggerAll}
                    >
                      <Send className="h-3 w-3" />
                      Intervene All
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-red-800/20">
                  {immediateActionPlayers.map(p => {
                    const state = rowState[p.player_id] ?? 'idle';
                    const isSending = state === 'sending';
                    const isSent    = state === 'sent';
                    const isSkipped = state === 'skipped';

                    return (
                      <div key={p.player_id} className="flex items-center justify-between px-4 py-3 gap-4 flex-wrap">
                        {/* Player identity */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                            isSent
                              ? 'bg-emerald-900/40 border-emerald-700/40 text-emerald-300'
                              : 'bg-red-900/40 border-red-700/40 text-red-300'
                          }`}>
                            {p.display_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold truncate">{p.display_name}</span>
                              {isSent && (
                                <Badge className="bg-emerald-600 text-white border-0 text-[10px] px-1.5 gap-1">
                                  <CheckCircle2 className="h-2.5 w-2.5" />
                                  Intervention Sent
                                </Badge>
                              )}
                              {isSkipped && (
                                <Badge variant="secondary" className="text-[10px] px-1.5">
                                  Cooling off
                                </Badge>
                              )}
                            </div>
                            <div className="text-[10px] font-mono text-muted-foreground">{p.player_id.slice(-8)}</div>
                          </div>
                        </div>

                        {/* Metrics + action */}
                        <div className="flex items-center gap-3 flex-wrap">
                          <Badge className={`text-xs ${riskBadgeClass(p.risk_level)}`}>
                            {p.risk_level} · {p.risk_score}
                          </Badge>
                          <div className="text-xs text-muted-foreground">
                            <span className="font-medium">{formatRand(p.avgBet)}</span> avg ·{' '}
                            <span className="font-medium">{p.betsPerMinute.toFixed(1)}</span>/min
                          </div>
                          <div className="text-sm font-bold text-red-400">{formatRand(p.predictedLoss)}</div>

                          {/* Channel status pills — only enabled channels, visible from 'sending' */}
                          {(isSending || isSent) && channelStates[p.player_id] && (
                            <div className="flex items-center gap-1">
                              {(settings.enabled_channels as Channel[]).map(ch => {
                                const chStatus = channelStates[p.player_id]?.[ch] ?? 'pending';
                                const Icon = CHANNEL_ICON[ch];
                                return (
                                  <span
                                    key={ch}
                                    title={`${ch}: ${chStatus}`}
                                    className={`inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded transition-colors ${
                                      chStatus === 'sent'    ? 'bg-emerald-100 text-emerald-700' :
                                      chStatus === 'failed'  ? 'bg-red-100 text-red-700' :
                                      chStatus === 'sending' ? 'bg-amber-100 text-amber-700' :
                                      'bg-muted text-muted-foreground'
                                    }`}
                                  >
                                    <Icon className="h-2.5 w-2.5" />
                                    {CHANNEL_LABEL[ch]}
                                    {chStatus === 'sending' && <Loader2 className="h-2 w-2 animate-spin ml-0.5" />}
                                    {chStatus === 'sent'    && <CheckCircle2 className="h-2 w-2 ml-0.5" />}
                                    {chStatus === 'failed'  && <XCircle className="h-2 w-2 ml-0.5" />}
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          {/* Outcome badge */}
                          {outcomeState[p.player_id] === 'accepted' && (
                            <Badge className="bg-emerald-600 text-white border-0 text-[10px] px-1.5 gap-1">
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              Accepted
                            </Badge>
                          )}
                          {outcomeState[p.player_id] === 'declined' && (
                            <Badge className="bg-slate-600 text-white border-0 text-[10px] px-1.5 gap-1">
                              <XCircle className="h-2.5 w-2.5" />
                              Declined
                            </Badge>
                          )}

                          {!isSent && !isSkipped && (
                            <Button
                              size="sm"
                              variant="destructive"
                              className="text-xs h-7 gap-1.5"
                              disabled={isSending}
                              onClick={() => triggerIntervention(p)}
                            >
                              {isSending
                                ? <><Loader2 className="h-3 w-3 animate-spin" /> Dispatching…</>
                                : <><Send className="h-3 w-3" /> Intervene</>
                              }
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Intervention audit log (regulator view) ─────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
              Intervention Audit Log
            </h2>
            <Badge variant="outline" className="text-xs">
              Full lifecycle · regulator-ready
            </Badge>
          </div>
          <InterventionRegulatorView casinoId={casinoId} limit={50} />
        </div>

        {/* ── Historical protection chart ───────────────────────────────────── */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Revenue Protected Over Time</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Actual bet_amount × risk_weight per event (last {historicalChartData.length} events)
                </CardDescription>
              </div>
              <Badge variant="outline" className="gap-1 text-xs">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {historicalChartData.length === 0 ? (
              <div className="flex items-center justify-center h-52 text-muted-foreground text-sm">
                <div className="text-center">
                  <DollarSign className="h-8 w-8 opacity-30 mx-auto mb-2" />
                  <p>Waiting for live events…</p>
                  <p className="text-xs opacity-60 mt-1">Chart updates on every incoming bet</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={historicalChartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} interval="preserveStartEnd" />
                  <YAxis fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => v >= 1000 ? `R${(v / 1000).toFixed(0)}K` : `R${v}`} width={52} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value: number, name: string) => {
                      if (name === 'protectionValue') return [`R ${value.toLocaleString()}`, 'Protection Value'];
                      if (name === 'riskScore')       return [value, 'Risk Score'];
                      return [value, name];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} formatter={v => v === 'protectionValue' ? 'Protection Value (R)' : 'Risk Score'} />
                  <Line type="monotone" dataKey="protectionValue" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="riskScore"       stroke="#f97316" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* ── Methodology footer ────────────────────────────────────────────── */}
        <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground space-y-2">
          <div className="font-semibold text-foreground/70">Revenue Protection Methodology</div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            <div className="space-y-0.5">
              <div className="font-medium text-foreground/60">Historical</div>
              <div>Revenue Saved = SUM(player.total_bet × {RETENTION_IMPACT}) — intervened players (risk ≥ 70)</div>
              <div>Loss Prevented = SUM(player.total_bet) — critical players (risk ≥ 85)</div>
              <div>Fraud Prevented = SUM(event.bet_amount × {FRAUD_PREVENTION_RATE}) — rapid_high_stakes</div>
            </div>
            <div className="space-y-0.5">
              <div className="font-medium text-foreground/60">Predictive + Intervention Engine</div>
              <div>Predicted Loss = avgBet × betsPerMinute × {PREDICTION_WINDOW_MIN} min × riskWeight(score)</div>
              <div>riskWeight: ≥85→1.0 · ≥70→0.6 · ≥40→0.2 · &lt;40→0 · betsPerMinute capped at 10</div>
              <div>Threshold: R{settings.intervention_threshold.toLocaleString()} · Cooldown: {settings.cooldown_minutes} min · Channels: {settings.enabled_channels.join(', ')}</div>
              <div>Dispatch: App (Supabase Realtime) · WhatsApp &amp; SMS (Twilio) · 1 retry on failure after 3s</div>
              <div>Outcome: 60% acceptance simulation · twilio_sid stored · config from casino_settings (per-casino, live-synced)</div>
            </div>
          </div>
          <div className="opacity-60">All monetary values from liveEvents.bet_amount. Interventions scoped by casino_id (RLS enforced).</div>
        </div>

      </div>
    </TooltipProvider>
  );
}
