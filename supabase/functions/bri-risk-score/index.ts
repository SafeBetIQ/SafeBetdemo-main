// ── bri-risk-score — READ-ONLY profile retrieval ─────────────────────────────
//
// GET  /bri-risk-score/{player_id}  →  returns behavioral_risk_profiles +
//                                       bri_signal_history for that player.
//
// POST /bri-risk-score              →  410 Gone (retired — use risk-engine).
//
// All new risk scores are written by the risk-engine function.

import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

// ── Deprecation notice ────────────────────────────────────────────────────────
//
// POST /bri-risk-score  →  DEPRECATED.  Use POST /risk-engine instead.
//
// The risk-engine function is the single authoritative risk scorer.  It reads
// live_events directly, applies the same composite model, and writes to
// behavioral_risk_profiles.  The session-summary POST path of this function
// is retained only for backward-compatibility and now returns 410 Gone.
//
// GET /bri-risk-score/{player_id}  →  still active.
// Reads behavioral_risk_profiles + bri_signal_history for a given player.
// (risk-engine does not expose a read endpoint.)

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // POST path retired — all scoring now goes through risk-engine
  if (req.method === 'POST') {
    return new Response(
      JSON.stringify({
        error: 'deprecated',
        message:
          'POST /bri-risk-score is retired. ' +
          'Send events to POST /risk-engine instead. ' +
          'risk-engine reads live_events, computes factor scores, and writes ' +
          'behavioral_risk_profiles as the single source of truth.',
      }),
      { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
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
