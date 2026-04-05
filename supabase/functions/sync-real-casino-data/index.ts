// ── DEPRECATED — sync-real-casino-data ───────────────────────────────────────
//
// This function previously queried the real `players` and `gaming_sessions`
// tables and then re-inserted Math.random()-generated rows into
// `demo_behavioral_insights`.  It has been retired because:
//
//   1. It had NO authentication check — any caller with the function URL could
//      trigger a full table wipe + re-insert of fake insight records.
//   2. The `demo_behavioral_insights` table is no longer read by any UI
//      component; behavioral intelligence now comes exclusively from
//      `behavioral_risk_profiles` written by the `risk-engine` function.
//   3. Mixing random noise into real-player-derived rows creates misleading
//      compliance data.
//
// The authoritative data pipeline is now:
//   casino-simulator  →  live_events (is_simulated: true)
//   risk-engine       →  behavioral_risk_profiles
//   CasinoDataContext →  all dashboards
//
// This endpoint now returns 410 Gone so stale callers fail loudly.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      error: "deprecated",
      message:
        "sync-real-casino-data has been retired. " +
        "Behavioral risk profiles are now written exclusively by the risk-engine " +
        "function in response to live_events. " +
        "Remove any cron schedules or webhooks pointing to this endpoint.",
    }),
    {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
