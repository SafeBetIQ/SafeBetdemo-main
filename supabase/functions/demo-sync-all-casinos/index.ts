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

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: userData } = await supabase
      .from('users')
      .select('user_role')
      .eq('id', user.id)
      .single();

    if (!userData || !['RISK_ANALYST', 'EXECUTIVE'].includes(userData.user_role)) {
      return new Response(
        JSON.stringify({ error: 'Access denied. RISK_ANALYST or EXECUTIVE role required.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    const demoPlayers = [];
    const demoInsights = [];
    const demoESGScores = [];

    for (const casino of casinos) {
      const playerCount = Math.floor(Math.random() * 500) + 100;
      const atRiskCount = Math.floor(playerCount * (Math.random() * 0.15 + 0.05));

      for (let i = 0; i < Math.min(playerCount, 50); i++) {
        const playerId = `P_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
        const riskScore = Math.floor(Math.random() * 100);
        const personas = ['casual', 'regular', 'high_roller', 'at_risk'];
        
        demoPlayers.push({
          casino_id: casino.id,
          player_id: playerId,
          avg_session_time: Math.floor(Math.random() * 300) + 30,
          avg_bet_amount: Math.floor(Math.random() * 1000) + 50,
          deposit_frequency: ['daily', 'weekly', 'monthly'][Math.floor(Math.random() * 3)],
          win_loss_ratio: (Math.random() * 2).toFixed(2),
          total_sessions: Math.floor(Math.random() * 100) + 1,
          total_wagered: Math.floor(Math.random() * 100000) + 1000,
          persona_type: personas[Math.floor(Math.random() * personas.length)],
          risk_score: riskScore,
          bri_score: Math.floor(Math.random() * 100),
          first_seen: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
          last_active: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        });

        if (Math.random() > 0.7) {
          demoInsights.push({
            player_id: playerId,
            casino_id: casino.id,
            impulse_level: Math.floor(Math.random() * 100),
            cognitive_fatigue_index: Math.floor(Math.random() * 100),
            personality_shift: ['stable', 'minor', 'moderate', 'significant'][Math.floor(Math.random() * 4)],
            predicted_escalation: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)],
            session_velocity_change: (Math.random() * 200 - 100).toFixed(2),
            loss_chasing_detected: Math.random() > 0.8,
            impulse_vs_intent_ratio: (Math.random() * 2.5).toFixed(2),
            reaction_time_ms: Math.floor(Math.random() * 2000) + 500,
            decision_stability_score: Math.floor(Math.random() * 100),
            recovery_indicator: Math.random() > 0.7,
            next_7_day_risk_forecast: Math.floor(Math.random() * 100),
            intervention_recommended: riskScore >= 75,
            recommended_action: riskScore >= 75 ? 'Immediate contact recommended' : 'Continue monitoring',
            analysis_timestamp: new Date().toISOString(),
          });
        }
      }

      const wellbeingIndex = Math.floor(Math.random() * 40) + 55;
      const humanityScore = Math.floor(Math.random() * 40) + 60;
      const recoveryRate = (Math.random() * 30 + 55).toFixed(2);
      const responsibleMarketing = Math.floor(Math.random() * 40) + 60;
      const carbonScore = Math.floor(Math.random() * 50) + 50;
      
      const totalESG = Math.floor(
        (wellbeingIndex * 0.3) + 
        (humanityScore * 0.3) + 
        (parseFloat(recoveryRate) * 0.2) + 
        (responsibleMarketing * 0.1) + 
        (carbonScore * 0.1)
      );

      let esgGrade = 'C';
      if (totalESG >= 90) esgGrade = 'A+';
      else if (totalESG >= 85) esgGrade = 'A';
      else if (totalESG >= 75) esgGrade = 'B+';
      else if (totalESG >= 70) esgGrade = 'B';
      else if (totalESG >= 60) esgGrade = 'C+';
      else if (totalESG >= 50) esgGrade = 'D';
      else esgGrade = 'F';

      demoESGScores.push({
        casino_id: casino.id,
        total_players: playerCount,
        active_players: Math.floor(playerCount * 0.7),
        at_risk_players: atRiskCount,
        avg_risk_score: (Math.random() * 40 + 30).toFixed(2),
        wellbeing_index: wellbeingIndex,
        humanity_score: humanityScore,
        recovery_rate: recoveryRate,
        intervention_success_rate: (Math.random() * 30 + 60).toFixed(2),
        responsible_marketing_score: responsibleMarketing,
        promo_risk_level: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
        auto_exclusion_effectiveness: (Math.random() * 20 + 75).toFixed(2),
        carbon_score: carbonScore,
        server_efficiency_rating: ['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)],
        total_esg_score: totalESG,
        esg_grade: esgGrade,
        revenue_stability_score: Math.floor(Math.random() * 40) + 60,
        player_lifetime_value_trend: ['growing', 'stable', 'declining'][Math.floor(Math.random() * 3)],
        reporting_period: 'monthly',
        period_start: new Date(new Date().setDate(1)).toISOString(),
        period_end: new Date().toISOString(),
      });
    }

    await supabase.from('demo_players').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('demo_behavioral_insights').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('demo_esg_scores').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    const { error: playersError } = await supabase.from('demo_players').insert(demoPlayers);
    const { error: insightsError } = await supabase.from('demo_behavioral_insights').insert(demoInsights);
    const { error: esgError } = await supabase.from('demo_esg_scores').insert(demoESGScores);

    if (playersError || insightsError || esgError) {
      throw new Error(`Insert errors: ${JSON.stringify({ playersError, insightsError, esgError })}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Demo data synchronized successfully',
        stats: {
          casinos: casinos.length,
          players: demoPlayers.length,
          insights: demoInsights.length,
          esgScores: demoESGScores.length,
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