import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface SessionSignals {
  session_minutes: number;
  total_bets: number;
  total_wagered: number;
  net_loss: number;
  deposit_count_24h: number;
  largest_bet: number;
  avg_bet: number;
  previous_bets?: number[];
}

function computeSignalScores(signals: SessionSignals) {
  const SESSION_THRESHOLD_CRITICAL = 180;
  const SESSION_THRESHOLD_HIGH = 120;
  const SESSION_THRESHOLD_MODERATE = 60;

  const DEPOSIT_CRITICAL = 4;
  const DEPOSIT_HIGH = 3;
  const DEPOSIT_MODERATE = 2;

  const sessionDurationScore = Math.min(
    signals.session_minutes >= SESSION_THRESHOLD_CRITICAL ? 85 + Math.min((signals.session_minutes - SESSION_THRESHOLD_CRITICAL) / 10, 15) :
    signals.session_minutes >= SESSION_THRESHOLD_HIGH ? 65 + ((signals.session_minutes - SESSION_THRESHOLD_HIGH) / SESSION_THRESHOLD_CRITICAL) * 20 :
    signals.session_minutes >= SESSION_THRESHOLD_MODERATE ? 40 + ((signals.session_minutes - SESSION_THRESHOLD_MODERATE) / SESSION_THRESHOLD_HIGH) * 25 :
    (signals.session_minutes / SESSION_THRESHOLD_MODERATE) * 40,
    100
  );

  const depositFrequencyScore = Math.min(
    signals.deposit_count_24h >= DEPOSIT_CRITICAL ? 85 + Math.min((signals.deposit_count_24h - DEPOSIT_CRITICAL) * 5, 15) :
    signals.deposit_count_24h >= DEPOSIT_HIGH ? 65 + (signals.deposit_count_24h - DEPOSIT_HIGH) * 20 :
    signals.deposit_count_24h >= DEPOSIT_MODERATE ? 40 + (signals.deposit_count_24h - DEPOSIT_MODERATE) * 25 :
    signals.deposit_count_24h * 20,
    100
  );

  const lossRatio = signals.total_wagered > 0 ? signals.net_loss / signals.total_wagered : 0;
  const betEscalation = signals.avg_bet > 0 ? signals.largest_bet / signals.avg_bet : 1;
  const lossEscalationScore = Math.min(
    (lossRatio >= 0.7 ? 80 : lossRatio >= 0.5 ? 60 : lossRatio >= 0.3 ? 40 : lossRatio * 100) +
    (betEscalation >= 3 ? 20 : betEscalation >= 2 ? 10 : betEscalation >= 1.5 ? 5 : 0),
    100
  );

  const avgBetBaseline = signals.total_wagered / Math.max(signals.total_bets, 1);
  const intensity = avgBetBaseline > 0 ? signals.largest_bet / avgBetBaseline : 1;
  const betIntensityScore = Math.min(
    intensity >= 4 ? 85 + Math.min((intensity - 4) * 5, 15) :
    intensity >= 3 ? 65 + (intensity - 3) * 20 :
    intensity >= 2 ? 40 + (intensity - 2) * 25 :
    (intensity - 1) * 40,
    100
  );

  return {
    sessionDurationScore: Math.round(Math.max(sessionDurationScore, 0)),
    depositFrequencyScore: Math.round(Math.max(depositFrequencyScore, 0)),
    lossEscalationScore: Math.round(Math.max(lossEscalationScore, 0)),
    betIntensityScore: Math.round(Math.max(betIntensityScore, 0)),
  };
}

function computeCompositeScore(scores: {
  sessionDurationScore: number;
  depositFrequencyScore: number;
  lossEscalationScore: number;
  betIntensityScore: number;
  crossOperatorScore: number;
}): { score: number; level: string; rationale: string } {
  const composite = Math.round(
    scores.lossEscalationScore * 0.30 +
    scores.sessionDurationScore * 0.20 +
    scores.depositFrequencyScore * 0.20 +
    scores.betIntensityScore * 0.20 +
    scores.crossOperatorScore * 0.10
  );

  const drivers: string[] = [];
  if (scores.lossEscalationScore >= 60) drivers.push(`loss escalation (${scores.lossEscalationScore})`);
  if (scores.sessionDurationScore >= 60) drivers.push(`extended session (${scores.sessionDurationScore})`);
  if (scores.depositFrequencyScore >= 60) drivers.push(`high deposit frequency (${scores.depositFrequencyScore})`);
  if (scores.betIntensityScore >= 60) drivers.push(`bet intensity spike (${scores.betIntensityScore})`);
  if (scores.crossOperatorScore >= 40) drivers.push(`cross-operator activity (${scores.crossOperatorScore})`);

  const level =
    composite >= 80 ? 'critical' :
    composite >= 60 ? 'high' :
    composite >= 40 ? 'moderate' : 'low';

  const rationale =
    level === 'critical' ? `Critical risk: ${drivers.length > 0 ? drivers.join(', ') : 'multiple signals at high severity'}. Immediate intervention required.` :
    level === 'high' ? `High risk: ${drivers.length > 0 ? drivers.join(', ') : 'elevated signal activity'}. Cooling-off period advised.` :
    level === 'moderate' ? `Moderate risk: Emerging patterns — ${drivers.length > 0 ? drivers.join(', ') : 'monitor closely'}.` :
    'Low risk: Behavioral patterns within normal parameters.';

  return { score: composite, level, rationale };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const playerId = pathParts[pathParts.length - 1];

    if (req.method === 'GET' && playerId && playerId !== 'bri-risk-score') {
      const [profilesRes, historyRes] = await Promise.all([
        supabase
          .from('behavioral_risk_profiles')
          .select('*')
          .eq('player_id', playerId)
          .order('analyzed_at', { ascending: false })
          .limit(10),
        supabase
          .from('bri_signal_history')
          .select('*')
          .eq('player_id', playerId)
          .order('recorded_at', { ascending: false })
          .limit(30),
      ]);

      if (profilesRes.error) throw profilesRes.error;

      const latest = profilesRes.data?.[0];

      return new Response(
        JSON.stringify({
          success: true,
          playerId,
          profiles: profilesRes.data,
          signalHistory: historyRes.data || [],
          latestScore: latest?.risk_score || 0,
          latestLevel: latest?.risk_level || 'low',
          signals: latest ? {
            sessionDuration: latest.session_duration_score || 0,
            depositFrequency: latest.deposit_frequency_score || 0,
            lossEscalation: latest.loss_escalation_score || 0,
            betIntensity: latest.bet_intensity_score || 0,
            crossOperator: latest.cross_operator_score || 0,
          } : null,
          rationale: latest?.risk_rationale || null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const {
        player_id,
        session_id,
        casino_id,
        session_minutes = 0,
        total_bets = 0,
        total_wagered = 0,
        net_loss = 0,
        deposit_count_24h = 0,
        largest_bet = 0,
        avg_bet = 0,
        cross_operator_score = 0,
        cross_operator_flags = 0,
        impulse_level,
        betting_velocity,
        reaction_time_ms,
        fatigue_index,
        personality_shift_score,
        emotional_state,
        advised_break,
        intervention_triggered,
      } = body;

      const signalScores = computeSignalScores({
        session_minutes,
        total_bets,
        total_wagered,
        net_loss,
        deposit_count_24h,
        largest_bet,
        avg_bet,
      });

      const { score, level, rationale } = computeCompositeScore({
        ...signalScores,
        crossOperatorScore: cross_operator_score,
      });

      const { data: previousProfile } = await supabase
        .from('behavioral_risk_profiles')
        .select('risk_score')
        .eq('player_id', player_id)
        .order('analyzed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const previousScore = previousProfile?.risk_score || score;
      const scoreDelta = score - previousScore;

      const { data: newProfile, error } = await supabase
        .from('behavioral_risk_profiles')
        .insert({
          player_id,
          session_id,
          casino_id,
          risk_score: score,
          risk_level: level,
          impulse_level: impulse_level ?? signalScores.betIntensityScore,
          betting_velocity,
          session_duration_minutes: session_minutes,
          reaction_time_ms,
          fatigue_index,
          personality_shift_score,
          emotional_state,
          advised_break,
          intervention_triggered,
          session_duration_score: signalScores.sessionDurationScore,
          deposit_frequency_score: signalScores.depositFrequencyScore,
          loss_escalation_score: signalScores.lossEscalationScore,
          bet_intensity_score: signalScores.betIntensityScore,
          cross_operator_score,
          cross_operator_flags,
          risk_rationale: rationale,
          previous_risk_score: previousScore,
          score_delta: scoreDelta,
          signal_weights: { session_duration: 0.20, deposit_frequency: 0.20, loss_escalation: 0.30, bet_intensity: 0.20, cross_operator: 0.10 },
        })
        .select()
        .single();

      if (error) throw error;

      await supabase.from('bri_signal_history').insert({
        player_id,
        casino_id,
        risk_score: score,
        risk_level: level,
        session_duration_score: signalScores.sessionDurationScore,
        deposit_frequency_score: signalScores.depositFrequencyScore,
        loss_escalation_score: signalScores.lossEscalationScore,
        bet_intensity_score: signalScores.betIntensityScore,
        cross_operator_score,
        session_minutes,
        total_bets,
        total_wagered,
        net_loss,
        deposit_count_24h,
        largest_bet,
        avg_bet,
      });

      return new Response(
        JSON.stringify({
          success: true,
          profile: newProfile,
          computedScore: score,
          computedLevel: level,
          signals: signalScores,
          rationale,
          scoreDelta,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
