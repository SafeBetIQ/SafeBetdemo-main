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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const casinoId = pathParts[pathParts.length - 1];

    if (req.method === 'GET' && casinoId && casinoId !== 'esg-report') {
      const { data: esgScores, error: scoresError } = await supabase
        .from('esg_compliance_scores')
        .select('*')
        .eq('casino_id', casinoId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (scoresError) throw scoresError;

      const { data: casino, error: casinoError } = await supabase
        .from('casinos')
        .select('name')
        .eq('id', casinoId)
        .single();

      if (casinoError) throw casinoError;

      const latestScore = esgScores[0] || null;

      return new Response(
        JSON.stringify({
          success: true,
          casinoId,
          casinoName: casino?.name,
          latestScore,
          grade: latestScore?.esg_grade || 'N/A',
          totalScore: latestScore?.total_esg_score || 0
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const {
        casino_id,
        player_id,
        wellbeing_index,
        humanity_score,
        recovery_rate,
        promo_risk_level,
        carbon_score,
        total_esg_score,
        esg_grade,
        ethical_revenue_percentage,
        intervention_success_rate,
        self_correction_rate,
        reporting_period_start,
        reporting_period_end
      } = body;

      const { data: newScore, error } = await supabase
        .from('esg_compliance_scores')
        .insert({
          casino_id,
          player_id,
          wellbeing_index,
          humanity_score,
          recovery_rate,
          promo_risk_level,
          carbon_score,
          total_esg_score,
          esg_grade,
          ethical_revenue_percentage,
          intervention_success_rate,
          self_correction_rate,
          reporting_period_start,
          reporting_period_end
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({
          success: true,
          score: newScore
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
