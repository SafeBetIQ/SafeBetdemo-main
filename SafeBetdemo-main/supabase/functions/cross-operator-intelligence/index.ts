import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function ok(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function generatePseudonymToken(playerId: string, casinoId: string): string {
  const input = `${playerId}-${casinoId}-v1-safebet-cross-op-token`;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  let hash = 0n;
  for (let i = 0; i < data.length; i++) {
    hash = (hash * 31n + BigInt(data[i])) % (2n ** 64n);
  }
  return hash.toString(16).padStart(16, '0').repeat(4);
}

interface SignalScoreInput {
  operatorHops: number;
  concurrentMinutes: number;
  lossChaseAmount: number;
  depositEscalationPct: number;
  selfExclusionFlag: boolean;
  velocitySpikeRatio: number;
  multiPlatformCount: number;
}

function computeCrossOperatorScore(signals: SignalScoreInput): {
  score: number;
  breakdown: Record<string, number>;
  severity: string;
  flags: number;
} {
  let score = 0;
  let flags = 0;
  const breakdown: Record<string, number> = {};

  // Self-exclusion breach: immediate maximum
  if (signals.selfExclusionFlag) {
    breakdown.self_exclusion = 100;
    flags++;
    score = 100;
    return { score: 100, breakdown, severity: 'critical', flags };
  }

  // Operator hopping (0-100 based on number of hops)
  if (signals.operatorHops >= 4) { breakdown.operator_hops = 90; flags++; }
  else if (signals.operatorHops === 3) { breakdown.operator_hops = 70; flags++; }
  else if (signals.operatorHops === 2) { breakdown.operator_hops = 45; }
  else { breakdown.operator_hops = 0; }

  // Concurrent session overlap (0-100)
  if (signals.concurrentMinutes >= 60) { breakdown.concurrent_session = 95; flags++; }
  else if (signals.concurrentMinutes >= 30) { breakdown.concurrent_session = 75; flags++; }
  else if (signals.concurrentMinutes >= 10) { breakdown.concurrent_session = 45; }
  else { breakdown.concurrent_session = 0; }

  // Loss chasing across operators (0-100)
  if (signals.lossChaseAmount >= 10000) { breakdown.loss_chase = 95; flags++; }
  else if (signals.lossChaseAmount >= 5000) { breakdown.loss_chase = 80; flags++; }
  else if (signals.lossChaseAmount >= 2000) { breakdown.loss_chase = 55; }
  else if (signals.lossChaseAmount > 0) { breakdown.loss_chase = 30; }
  else { breakdown.loss_chase = 0; }

  // Deposit escalation across operators (0-100)
  if (signals.depositEscalationPct >= 400) { breakdown.deposit_escalation = 90; flags++; }
  else if (signals.depositEscalationPct >= 250) { breakdown.deposit_escalation = 65; }
  else if (signals.depositEscalationPct >= 150) { breakdown.deposit_escalation = 40; }
  else { breakdown.deposit_escalation = 0; }

  // Velocity spike ratio (0-100)
  if (signals.velocitySpikeRatio >= 4.0) { breakdown.velocity_spike = 85; flags++; }
  else if (signals.velocitySpikeRatio >= 3.0) { breakdown.velocity_spike = 65; }
  else if (signals.velocitySpikeRatio >= 2.0) { breakdown.velocity_spike = 40; }
  else { breakdown.velocity_spike = 0; }

  // Multi-platform count (0-100)
  if (signals.multiPlatformCount >= 4) { breakdown.multi_platform = 80; flags++; }
  else if (signals.multiPlatformCount === 3) { breakdown.multi_platform = 60; }
  else if (signals.multiPlatformCount === 2) { breakdown.multi_platform = 35; }
  else { breakdown.multi_platform = 0; }

  // Weighted composite
  const weights = {
    operator_hops: 0.25,
    concurrent_session: 0.20,
    loss_chase: 0.25,
    deposit_escalation: 0.15,
    velocity_spike: 0.10,
    multi_platform: 0.05,
  };

  score = Math.round(
    (breakdown.operator_hops || 0) * weights.operator_hops +
    (breakdown.concurrent_session || 0) * weights.concurrent_session +
    (breakdown.loss_chase || 0) * weights.loss_chase +
    (breakdown.deposit_escalation || 0) * weights.deposit_escalation +
    (breakdown.velocity_spike || 0) * weights.velocity_spike +
    (breakdown.multi_platform || 0) * weights.multi_platform
  );

  const severity =
    score >= 80 ? 'critical' :
    score >= 60 ? 'high' :
    score >= 40 ? 'medium' : 'low';

  return { score: Math.min(score, 100), breakdown, severity, flags };
}

function determineAlertType(signals: SignalScoreInput): string {
  if (signals.selfExclusionFlag) return 'self_exclusion_breach';
  if (signals.operatorHops >= 3 && signals.lossChaseAmount >= 3000) return 'cross_operator_high_risk';
  if (signals.lossChaseAmount >= 5000) return 'cross_operator_loss_chasing';
  if (signals.concurrentMinutes >= 20) return 'multi_platform_gambling';
  if (signals.operatorHops >= 2) return 'operator_hopping';
  if (signals.velocitySpikeRatio >= 3.0) return 'velocity_spike';
  if (signals.depositEscalationPct >= 250) return 'deposit_escalation';
  return 'multi_platform_gambling';
}

async function getOrCreatePseudonymToken(
  supabase: ReturnType<typeof createClient>,
  playerId: string,
  casinoId: string
): Promise<string> {
  const { data: existing } = await supabase
    .from('player_pseudonym_tokens')
    .select('pseudonym_token')
    .eq('player_id', playerId)
    .eq('casino_id', casinoId)
    .maybeSingle();

  if (existing?.pseudonym_token) {
    await supabase
      .from('player_pseudonym_tokens')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('player_id', playerId)
      .eq('casino_id', casinoId);
    return existing.pseudonym_token;
  }

  const token = generatePseudonymToken(playerId, casinoId);
  await supabase.from('player_pseudonym_tokens').insert({
    player_id: playerId,
    casino_id: casinoId,
    pseudonym_token: token,
    token_version: 1,
    is_active: true,
  });
  return token;
}

async function handleAnalyse(
  supabase: ReturnType<typeof createClient>,
  body: {
    player_id: string;
    casino_id: string;
    operator_hops?: number;
    concurrent_minutes?: number;
    loss_chase_amount?: number;
    deposit_escalation_pct?: number;
    self_exclusion_flag?: boolean;
    velocity_spike_ratio?: number;
    multi_platform_count?: number;
    operator_names?: string[];
    total_cross_op_deposits?: number;
    total_cross_op_losses?: number;
  }
) {
  const {
    player_id,
    casino_id,
    operator_hops = 0,
    concurrent_minutes = 0,
    loss_chase_amount = 0,
    deposit_escalation_pct = 0,
    self_exclusion_flag = false,
    velocity_spike_ratio = 0,
    multi_platform_count = 0,
    operator_names = [],
    total_cross_op_deposits = 0,
    total_cross_op_losses = 0,
  } = body;

  if (!player_id || !casino_id) {
    throw new Error('player_id and casino_id are required');
  }

  const signals: SignalScoreInput = {
    operatorHops: operator_hops,
    concurrentMinutes: concurrent_minutes,
    lossChaseAmount: loss_chase_amount,
    depositEscalationPct: deposit_escalation_pct,
    selfExclusionFlag: self_exclusion_flag,
    velocitySpikeRatio: velocity_spike_ratio,
    multiPlatformCount: multi_platform_count,
  };

  const { score, breakdown, severity, flags } = computeCrossOperatorScore(signals);
  const alertType = determineAlertType(signals);
  const pseudonymToken = await getOrCreatePseudonymToken(supabase, player_id, casino_id);

  // Log signal events
  const signalInserts = [];
  if (operator_hops > 0) {
    signalInserts.push({ player_id, casino_id, pseudonym_token: pseudonymToken, signal_type: 'operator_hop', signal_value: operator_hops, signal_score: breakdown.operator_hops || 0, source_operator: operator_names[0] || 'internal', evidence: { operator_names, hops: operator_hops } });
  }
  if (concurrent_minutes > 0) {
    signalInserts.push({ player_id, casino_id, pseudonym_token: pseudonymToken, signal_type: 'concurrent_session', signal_value: concurrent_minutes, signal_score: breakdown.concurrent_session || 0, source_operator: 'multi-operator', evidence: { overlap_minutes: concurrent_minutes, platforms: operator_names } });
  }
  if (loss_chase_amount > 0) {
    signalInserts.push({ player_id, casino_id, pseudonym_token: pseudonymToken, signal_type: 'loss_chase', signal_value: loss_chase_amount, signal_score: breakdown.loss_chase || 0, source_operator: operator_names[0] || 'internal', evidence: { loss_amount: loss_chase_amount, subsequent_operators: operator_hops } });
  }
  if (deposit_escalation_pct > 0) {
    signalInserts.push({ player_id, casino_id, pseudonym_token: pseudonymToken, signal_type: 'deposit_escalation', signal_value: total_cross_op_deposits, signal_score: breakdown.deposit_escalation || 0, source_operator: 'multi-operator', evidence: { escalation_pct: deposit_escalation_pct, total_deposits: total_cross_op_deposits } });
  }
  if (velocity_spike_ratio > 0) {
    signalInserts.push({ player_id, casino_id, pseudonym_token: pseudonymToken, signal_type: 'velocity_spike', signal_value: velocity_spike_ratio, signal_score: breakdown.velocity_spike || 0, source_operator: operator_names[0] || 'internal', evidence: { spike_ratio: velocity_spike_ratio } });
  }
  if (self_exclusion_flag) {
    signalInserts.push({ player_id, casino_id, pseudonym_token: pseudonymToken, signal_type: 'self_exclusion_flag', signal_value: 0, signal_score: 100, source_operator: 'NRG Registry', evidence: { violation_detected: true, register: 'NRGP' } });
  }

  if (signalInserts.length > 0) {
    await supabase.from('cross_operator_signal_log').insert(signalInserts);
  }

  // Update cross_operator_score on behavioral_risk_profiles (most recent profile)
  const { data: latestProfile } = await supabase
    .from('behavioral_risk_profiles')
    .select('id')
    .eq('player_id', player_id)
    .order('analyzed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestProfile?.id) {
    await supabase
      .from('behavioral_risk_profiles')
      .update({
        cross_operator_score: score,
        cross_operator_flags: flags,
        updated_at: new Date().toISOString(),
      })
      .eq('id', latestProfile.id);
  }

  // Create alert if score >= 40
  let alert = null;
  if (score >= 40) {
    const alertMessage = self_exclusion_flag
      ? 'CRITICAL: Player detected gambling despite active NRGP self-exclusion registration.'
      : `Cross-operator risk score of ${score} detected — ${alertType.replace(/_/g, ' ')} pattern identified across ${operator_hops + 1} operator(s).`;

    const recommendation = score >= 90
      ? 'Immediate manual compliance review required. Suspend account pending investigation.'
      : score >= 70
        ? 'Urgent intervention required. Contact player within 2 hours.'
        : score >= 55
          ? 'Schedule welfare check. Monitor activity for 48 hours.'
          : 'Send responsible gambling educational content.';

    const { data: newAlert } = await supabase
      .from('cross_operator_alerts')
      .insert({
        player_id,
        casino_id,
        pseudonym_token: pseudonymToken,
        alert_type: alertType,
        severity,
        status: 'new',
        detected_operators: Math.max(operator_hops + 1, 1),
        operator_names: operator_names.length > 0 ? operator_names : ['internal'],
        evidence: { ...breakdown, signals_input: signals },
        cross_operator_score: score,
        composite_risk_contribution: score * 0.10,
        platforms_detected: multi_platform_count || 1,
        total_cross_op_deposits,
        total_cross_op_losses,
        session_overlap_minutes: concurrent_minutes,
        self_exclusion_violation: self_exclusion_flag,
        alert_message: alertMessage,
        recommendation,
        auto_generated: true,
      })
      .select()
      .maybeSingle();
    alert = newAlert;
  }

  return { score, severity, flags, breakdown, alert, pseudonym_token: pseudonymToken };
}

async function handleGetAlerts(
  supabase: ReturnType<typeof createClient>,
  casinoId: string | null,
  status: string | null,
  severity: string | null
) {
  let query = supabase
    .from('cross_operator_alerts')
    .select(`
      *,
      player:players(id, player_id, risk_score)
    `)
    .order('detected_at', { ascending: false })
    .limit(100);

  if (casinoId) query = query.eq('casino_id', casinoId);
  if (status) query = query.eq('status', status);
  if (severity) query = query.eq('severity', severity);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function handleUpdateAlertStatus(
  supabase: ReturnType<typeof createClient>,
  alertId: string,
  status: string,
  reviewedBy: string,
  actionNotes: string | null
) {
  const updates: Record<string, unknown> = {
    status,
    reviewed_by: reviewedBy,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (actionNotes) updates.action_notes = actionNotes;
  if (status === 'actioned' || status === 'dismissed') {
    updates.resolved_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('cross_operator_alerts')
    .update(updates)
    .eq('id', alertId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function handleGetSignalLog(
  supabase: ReturnType<typeof createClient>,
  playerId: string | null,
  casinoId: string | null
) {
  let query = supabase
    .from('cross_operator_signal_log')
    .select('*')
    .order('reported_at', { ascending: false })
    .limit(200);

  if (playerId) query = query.eq('player_id', playerId);
  if (casinoId) query = query.eq('casino_id', casinoId);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (req.method === "POST") {
      const body = await req.json();

      if (action === "analyse") {
        const result = await handleAnalyse(supabase, body);
        return ok(result);
      }

      if (action === "update-status") {
        const { alert_id, status, reviewed_by, action_notes } = body;
        if (!alert_id || !status) return err("alert_id and status required");
        const result = await handleUpdateAlertStatus(supabase, alert_id, status, reviewed_by, action_notes);
        return ok(result);
      }

      return err("Unknown POST action — use ?action=analyse or ?action=update-status");
    }

    if (req.method === "GET") {
      const casinoId = url.searchParams.get("casino_id");
      const statusFilter = url.searchParams.get("status");
      const severityFilter = url.searchParams.get("severity");
      const playerId = url.searchParams.get("player_id");

      if (action === "alerts") {
        const data = await handleGetAlerts(supabase, casinoId, statusFilter, severityFilter);
        return ok(data);
      }

      if (action === "signal-log") {
        const data = await handleGetSignalLog(supabase, playerId, casinoId);
        return ok(data);
      }

      if (action === "stats") {
        let alertsQ = supabase.from('cross_operator_alerts').select('severity, status, alert_type, cross_operator_score, self_exclusion_violation');
        if (casinoId) alertsQ = alertsQ.eq('casino_id', casinoId);
        const { data: alerts } = await alertsQ;

        let tokensQ = supabase.from('player_pseudonym_tokens').select('id', { count: 'exact', head: true });
        if (casinoId) tokensQ = tokensQ.eq('casino_id', casinoId);
        const { count: tokenCount } = await tokensQ;

        const stats = {
          total_alerts: alerts?.length || 0,
          critical: alerts?.filter(a => a.severity === 'critical').length || 0,
          high: alerts?.filter(a => a.severity === 'high').length || 0,
          medium: alerts?.filter(a => a.severity === 'medium').length || 0,
          low: alerts?.filter(a => a.severity === 'low').length || 0,
          new: alerts?.filter(a => a.status === 'new').length || 0,
          reviewed: alerts?.filter(a => a.status === 'reviewed').length || 0,
          actioned: alerts?.filter(a => a.status === 'actioned').length || 0,
          dismissed: alerts?.filter(a => a.status === 'dismissed').length || 0,
          self_exclusion_breaches: alerts?.filter(a => a.self_exclusion_violation).length || 0,
          avg_cross_op_score: alerts && alerts.length > 0
            ? Math.round(alerts.reduce((s, a) => s + (a.cross_operator_score || 0), 0) / alerts.length)
            : 0,
          pseudonymised_players: tokenCount || 0,
          alert_types: alerts?.reduce((acc: Record<string, number>, a) => {
            acc[a.alert_type] = (acc[a.alert_type] || 0) + 1;
            return acc;
          }, {}) || {},
        };

        return ok(stats);
      }

      return err("Unknown GET action — use ?action=alerts, ?action=signal-log, or ?action=stats");
    }

    return err("Method not allowed", 405);

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Internal error";
    return err(message, 500);
  }
});
