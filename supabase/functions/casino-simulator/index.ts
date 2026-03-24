import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "stats";

    if (action === "tick") {
      // Manually trigger one simulation tick
      const { data, error } = await supabase.rpc("simulate_live_feed");
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, result: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default: return live stats across all casinos
    const { data: liveStats, error: statsError } = await supabase
      .from("gaming_sessions")
      .select("casino_id, game_type, total_wagered, total_won, total_bets, duration, start_time")
      .eq("is_active", true);

    if (statsError) throw statsError;

    const { data: casinos, error: casinoError } = await supabase
      .from("casinos")
      .select("id, name");

    if (casinoError) throw casinoError;

    const { data: playerCounts, error: pcError } = await supabase
      .from("players")
      .select("casino_id")
      .eq("is_active", true)
      .eq("status", "active");

    if (pcError) throw pcError;

    const casinoMap = Object.fromEntries((casinos || []).map((c: { id: string; name: string }) => [c.id, c.name]));

    const totalByPlayer: Record<string, number> = {};
    for (const p of (playerCounts || [])) {
      totalByPlayer[p.casino_id] = (totalByPlayer[p.casino_id] || 0) + 1;
    }

    const byGame: Record<string, { sessions: number; wagered: number; won: number; bets: number }> = {};
    const byCasino: Record<string, {
      casino_id: string;
      casino_name: string;
      live_players: number;
      total_players: number;
      live_pct: number;
      wagered_this_session: number;
      won_this_session: number;
      total_bets: number;
      avg_session_minutes: number;
      game_breakdown: Record<string, number>;
    }> = {};

    for (const s of (liveStats || [])) {
      const cid = s.casino_id;
      if (!byCasino[cid]) {
        byCasino[cid] = {
          casino_id: cid,
          casino_name: casinoMap[cid] || cid,
          live_players: 0,
          total_players: totalByPlayer[cid] || 0,
          live_pct: 0,
          wagered_this_session: 0,
          won_this_session: 0,
          total_bets: 0,
          avg_session_minutes: 0,
          game_breakdown: {},
        };
      }
      byCasino[cid].live_players++;
      byCasino[cid].wagered_this_session += Number(s.total_wagered);
      byCasino[cid].won_this_session += Number(s.total_won);
      byCasino[cid].total_bets += Number(s.total_bets);
      byCasino[cid].avg_session_minutes =
        (byCasino[cid].avg_session_minutes * (byCasino[cid].live_players - 1) + Number(s.duration)) /
        byCasino[cid].live_players;
      byCasino[cid].game_breakdown[s.game_type] = (byCasino[cid].game_breakdown[s.game_type] || 0) + 1;

      if (!byGame[s.game_type]) byGame[s.game_type] = { sessions: 0, wagered: 0, won: 0, bets: 0 };
      byGame[s.game_type].sessions++;
      byGame[s.game_type].wagered += Number(s.total_wagered);
      byGame[s.game_type].won += Number(s.total_won);
      byGame[s.game_type].bets += Number(s.total_bets);
    }

    for (const cid in byCasino) {
      byCasino[cid].live_pct = byCasino[cid].total_players > 0
        ? Math.round((byCasino[cid].live_players / byCasino[cid].total_players) * 1000) / 10
        : 0;
      byCasino[cid].wagered_this_session = Math.round(byCasino[cid].wagered_this_session * 100) / 100;
      byCasino[cid].won_this_session = Math.round(byCasino[cid].won_this_session * 100) / 100;
      byCasino[cid].avg_session_minutes = Math.round(byCasino[cid].avg_session_minutes * 10) / 10;
    }

    const totalLive = (liveStats || []).length;
    const totalWagered = (liveStats || []).reduce((s: number, r: { total_wagered: string | number }) => s + Number(r.total_wagered), 0);
    const totalWon = (liveStats || []).reduce((s: number, r: { total_won: string | number }) => s + Number(r.total_won), 0);

    return new Response(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        summary: {
          total_live_players: totalLive,
          total_wagered_live: Math.round(totalWagered * 100) / 100,
          total_won_live: Math.round(totalWon * 100) / 100,
          house_edge_live: totalWagered > 0
            ? Math.round(((totalWagered - totalWon) / totalWagered) * 10000) / 100
            : 0,
          casinos_active: Object.keys(byCasino).length,
        },
        by_casino: Object.values(byCasino).sort((a, b) => b.live_players - a.live_players),
        by_game: byGame,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
