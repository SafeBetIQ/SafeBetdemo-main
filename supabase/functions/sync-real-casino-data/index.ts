import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: casinos } = await supabase
      .from('casinos')
      .select('id, name')
      .eq('is_active', true);

    if (!casinos || casinos.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No active casinos found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const demoESGScores = [];
    const demoBehavioralInsights = [];

    for (const casino of casinos) {
      const { data: players } = await supabase
        .from('players')
        .select('*')
        .eq('casino_id', casino.id);

      const { data: sessions } = await supabase
        .from('gaming_sessions')
        .select('*')
        .eq('casino_id', casino.id);

      const totalPlayers = players?.length || 0;
      const activePlayers = players?.filter(p => p.is_active)?.length || 0;
      const atRiskPlayers = players?.filter(p => p.risk_score >= 70)?.length || 0;

      const avgRiskScore = players && players.length > 0
        ? players.reduce((sum, p) => sum + (p.risk_score || 0), 0) / players.length
        : 0;

      const totalSessions = sessions?.length || 0;
      const avgSessionDuration = sessions && sessions.length > 0
        ? sessions.reduce((sum, s) => sum + (s.duration || 0), 0) / sessions.length
        : 0;

      const totalWagered = players && players.length > 0
        ? players.reduce((sum, p) => sum + parseFloat(p.total_wagered || '0'), 0)
        : 0;

      const totalWon = players && players.length > 0
        ? players.reduce((sum, p) => sum + parseFloat(p.total_won || '0'), 0)
        : 0;

      const wellbeingIndex = Math.max(0, Math.min(100, 100 - (avgRiskScore * 0.8)));
      const humanityScore = Math.max(0, Math.min(100, 100 - (atRiskPlayers / Math.max(totalPlayers, 1) * 200)));
      const recoveryRate = atRiskPlayers > 0 ? ((atRiskPlayers * 0.3) / atRiskPlayers * 100) : 85;
      const interventionSuccessRate = 75 + (Math.random() * 15);
      const responsibleMarketingScore = 75 + (Math.random() * 20);
      const carbonScore = 60 + (Math.random() * 30);

      const totalESG = Math.floor(
        (wellbeingIndex * 0.3) +
        (humanityScore * 0.3) +
        (recoveryRate * 0.2) +
        (responsibleMarketingScore * 0.1) +
        (carbonScore * 0.1)
      );

      let esgGrade = 'C';
      if (totalESG >= 90) esgGrade = 'A+';
      else if (totalESG >= 85) esgGrade = 'A';
      else if (totalESG >= 80) esgGrade = 'A-';
      else if (totalESG >= 75) esgGrade = 'B+';
      else if (totalESG >= 70) esgGrade = 'B';
      else if (totalESG >= 65) esgGrade = 'B-';
      else if (totalESG >= 60) esgGrade = 'C+';
      else if (totalESG >= 50) esgGrade = 'C';
      else if (totalESG >= 40) esgGrade = 'D';
      else esgGrade = 'F';

      demoESGScores.push({
        casino_id: casino.id,
        total_players: totalPlayers,
        active_players: activePlayers,
        at_risk_players: atRiskPlayers,
        avg_risk_score: avgRiskScore.toFixed(2),
        wellbeing_index: Math.round(wellbeingIndex),
        humanity_score: Math.round(humanityScore),
        recovery_rate: recoveryRate.toFixed(2),
        intervention_success_rate: interventionSuccessRate.toFixed(2),
        responsible_marketing_score: Math.round(responsibleMarketingScore),
        promo_risk_level: avgRiskScore < 50 ? 'low' : avgRiskScore < 70 ? 'medium' : 'high',
        auto_exclusion_effectiveness: (80 + Math.random() * 15).toFixed(2),
        carbon_score: Math.round(carbonScore),
        server_efficiency_rating: totalESG >= 75 ? 'A' : totalESG >= 60 ? 'B' : 'C',
        total_esg_score: totalESG,
        esg_grade: esgGrade,
        revenue_stability_score: Math.round(70 + Math.random() * 25),
        player_lifetime_value_trend: totalWagered > 1000000000 ? 'growing' : 'stable',
        reporting_period: 'monthly',
        period_start: new Date(new Date().setDate(1)).toISOString(),
        period_end: new Date().toISOString(),
      });

      if (players) {
        for (const player of players.filter(p => p.risk_score >= 60)) {
          const impulseLevel = Math.min(100, player.risk_score + Math.floor(Math.random() * 20 - 10));
          const cognitiveFatigue = Math.min(100, Math.floor(avgSessionDuration / 60) + Math.floor(Math.random() * 30));

          demoBehavioralInsights.push({
            player_id: player.player_id,
            casino_id: casino.id,
            impulse_level: impulseLevel,
            cognitive_fatigue_index: cognitiveFatigue,
            personality_shift: player.risk_score >= 80 ? 'significant' : player.risk_score >= 70 ? 'moderate' : 'minor',
            predicted_escalation: player.risk_score >= 85 ? 'critical' : player.risk_score >= 75 ? 'high' : 'medium',
            session_velocity_change: (Math.random() * 50 - 25).toFixed(2),
            loss_chasing_detected: player.risk_score >= 75,
            impulse_vs_intent_ratio: (1 + (player.risk_score / 100)).toFixed(2),
            reaction_time_ms: Math.floor(500 + Math.random() * 1500),
            decision_stability_score: Math.max(0, 100 - player.risk_score),
            recovery_indicator: player.risk_score < 70,
            next_7_day_risk_forecast: Math.min(100, player.risk_score + Math.floor(Math.random() * 20 - 5)),
            intervention_recommended: player.risk_score >= 75,
            recommended_action: player.risk_score >= 85 ? 'Immediate intervention required' :
                               player.risk_score >= 75 ? 'Contact within 24 hours' :
                               'Continue monitoring',
            analysis_timestamp: new Date().toISOString(),
          });
        }
      }
    }

    await supabase.from('demo_esg_scores').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('demo_behavioral_insights').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    const { error: esgError } = await supabase.from('demo_esg_scores').insert(demoESGScores);
    const { error: insightsError } = demoBehavioralInsights.length > 0
      ? await supabase.from('demo_behavioral_insights').insert(demoBehavioralInsights)
      : { error: null };

    if (esgError || insightsError) {
      throw new Error(`Insert errors: ${JSON.stringify({ esgError, insightsError })}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Real casino data synchronized successfully',
        stats: {
          casinos: casinos.length,
          esgScores: demoESGScores.length,
          behavioralInsights: demoBehavioralInsights.length,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});