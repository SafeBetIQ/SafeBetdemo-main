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
    const playerId = pathParts[pathParts.length - 1];

    if (req.method === 'GET' && playerId && playerId !== 'bri-risk-score') {
      const { data: riskProfiles, error } = await supabase
        .from('behavioral_risk_profiles')
        .select('*')
        .eq('player_id', playerId)
        .order('analyzed_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      return new Response(
        JSON.stringify({
          success: true,
          playerId,
          profiles: riskProfiles,
          latestScore: riskProfiles[0]?.risk_score || 0,
          latestLevel: riskProfiles[0]?.risk_level || 'low'
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
        player_id,
        session_id,
        casino_id,
        risk_score,
        risk_level,
        impulse_level,
        betting_velocity,
        session_duration_minutes,
        reaction_time_ms,
        fatigue_index,
        personality_shift_score,
        emotional_state,
        advised_break,
        intervention_triggered
      } = body;

      const { data: newProfile, error } = await supabase
        .from('behavioral_risk_profiles')
        .insert({
          player_id,
          session_id,
          casino_id,
          risk_score,
          risk_level,
          impulse_level,
          betting_velocity,
          session_duration_minutes,
          reaction_time_ms,
          fatigue_index,
          personality_shift_score,
          emotional_state,
          advised_break,
          intervention_triggered
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({
          success: true,
          profile: newProfile
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
