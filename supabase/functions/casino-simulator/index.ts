import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SA_FIRST_NAMES = [
  "Thabo","Sipho","Lerato","Nomvula","Kagiso","Zanele","Tshepo","Palesa",
  "Lungelo","Nokuthula","Bongani","Nandi","Siyabonga","Yolanda","Khaya",
  "Ayanda","Mandla","Lindiwe","Vusi","Nompumelelo","Andile","Thandeka",
  "Sifiso","Nonhlanhla","Musa","Sithembile","Sandile","Busisiwe","Lwazi","Nolwazi",
];
const SA_LAST_NAMES = [
  "Dlamini","Nkosi","Mthembu","Zulu","Ndlovu","Sithole","Mkhize","Ntuli",
  "Khumalo","Cele","Mahlangu","Molefe","Nkuna","Shabalala","Madlala",
  "Radebe","Vilakazi","Majola","Ngcobo","Mvubu","Buthelezi","Msomi",
  "Gumede","Xulu","Mkhwanazi","Mhlongo","Ntombela","Thusi","Nene","Zwane",
];

const GAME_TYPES = ["slots","slots","slots","blackjack","roulette","poker","baccarat"];
const MACHINE_TYPES = ["slot","slot","slot","table","rng","live_dealer"];

const HOUSE_EDGES: Record<string, number> = {
  slots: 0.055,
  blackjack: 0.005,
  roulette: 0.027,
  poker: 0.030,
  baccarat: 0.012,
};

const BASE_BET_SIZES: Record<string, number> = {
  slots: 50,
  blackjack: 300,
  roulette: 175,
  poker: 400,
  baccarat: 225,
};

const SPIN_RATES: Record<string, number> = {
  slots: 12,
  blackjack: 4,
  roulette: 3,
  poker: 2,
  baccarat: 5,
};

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function randInt(min: number, max: number) {
  return Math.floor(rand(min, max + 1));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function hashStr(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

function machineId(playerId: string, casinoId: string): string {
  const n = (hashStr(playerId + casinoId) % 80) + 1;
  return `M-${String(n).padStart(3, "0")}`;
}

function machineTypeFor(playerId: string): string {
  return MACHINE_TYPES[hashStr(playerId) % MACHINE_TYPES.length];
}

function playerNameFor(playerId: string): string {
  const fi = hashStr(playerId) % SA_FIRST_NAMES.length;
  const li = hashStr(playerId + "L") % SA_LAST_NAMES.length;
  return `${SA_FIRST_NAMES[fi]} ${SA_LAST_NAMES[li]}`;
}

interface LiveEventRow {
  id: string;
  event_id: string;
  event_type: string;
  casino_id: string;
  player_id: string;
  session_id: string | null;
  game_id: string | null;
  machine_id: string | null;
  bet_amount: number;
  win_amount: number;
  balance_after: number | null;
  duration_seconds: number;
  risk_score: number;
  risk_flags: string[];
  outcome: "win" | "loss" | "push" | "active";
  game_type: string;
  is_simulated: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

function generateEvent(
  casinoId: string,
  playerId: string,
  sessionId: string | null,
  baseRisk: number,
  totalWagered: number,
  totalWon: number,
  totalBets: number,
): LiveEventRow {
  const gameType = pick(GAME_TYPES);
  const betBase = BASE_BET_SIZES[gameType];
  const betAmount = Math.round(betBase * rand(0.5, 2.5) / 5) * 5;
  const edge = HOUSE_EDGES[gameType];
  const isWin = Math.random() > edge * 2.5;
  const winAmount = isWin ? Math.round(betAmount * rand(0.8, 2.8) / 5) * 5 : 0;
  const outcome: "win" | "loss" = isWin ? "win" : "loss";

  const netRatio = totalWagered > 0 ? totalWon / totalWagered : 0.5;
  const flagLossChasing = totalWagered > 2000 && netRatio < 0.4 && Math.random() < 0.6;
  const flagExcessiveTime = totalBets > 40 && Math.random() < 0.4;
  const flagBetEscalation = totalBets > 30 && betAmount > betBase * 2 && Math.random() < 0.5;
  const flagRapidHighStakes = betAmount > betBase * 3 && Math.random() < 0.3;

  const riskFlags: string[] = [];
  if (flagLossChasing) riskFlags.push("loss_chasing");
  if (flagExcessiveTime) riskFlags.push("excessive_time");
  if (flagBetEscalation) riskFlags.push("bet_escalation");
  if (flagRapidHighStakes) riskFlags.push("rapid_high_stakes");

  const riskBoost =
    (flagLossChasing ? 15 : 0) +
    (flagExcessiveTime ? 8 : 0) +
    (flagBetEscalation ? 10 : 0) +
    (flagRapidHighStakes ? 12 : 0) +
    randInt(0, 8);

  const riskScore = Math.min(100, Math.max(0, baseRisk + riskBoost));

  const mId = machineId(playerId, casinoId);
  const playerName = playerNameFor(playerId);

  // Event type mix: 60% BET_PLACED · 10% DEPOSIT · 8% WITHDRAWAL · 12% SESSION_START · 10% SESSION_END
  const EVENT_POOL = [
    ...Array(60).fill("BET_PLACED"),
    ...Array(10).fill("DEPOSIT"),
    ...Array(8).fill("WITHDRAWAL"),
    ...Array(12).fill("SESSION_START"),
    ...Array(10).fill("SESSION_END"),
  ];
  const eventType = pick(EVENT_POOL);
  const isBet = eventType === "BET_PLACED";

  return {
    id: crypto.randomUUID(),
    event_id: crypto.randomUUID(),
    event_type: eventType,
    casino_id: casinoId,
    player_id: playerId,
    session_id: sessionId,
    game_id: `GAME-${gameType.toUpperCase()}-${randInt(1, 99)}`,
    machine_id: mId,
    bet_amount: isBet ? betAmount : 0,
    win_amount: isBet ? winAmount : 0,
    balance_after: eventType === "DEPOSIT" ? randInt(500, 10000) : eventType === "WITHDRAWAL" ? randInt(0, 5000) : null,
    duration_seconds: randInt(30, 7200),
    risk_score: riskScore,
    risk_flags: riskFlags,
    outcome: isBet ? outcome : "active",
    game_type: gameType,
    is_simulated: true,
    metadata: {
      player_name: playerName,
      game_type: gameType,
      machine_type: machineTypeFor(playerId),
    },
    created_at: new Date(Date.now() - randInt(0, 25000)).toISOString(),
  };
}

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

    // ----------------------------------------------------------------
    // TICK: run the SQL simulator function
    // ----------------------------------------------------------------
    if (action === "tick") {
      const { data, error } = await supabase.rpc("simulate_live_feed");
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, result: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ----------------------------------------------------------------
    // BURST: generate N realistic live_events using active sessions
    // ----------------------------------------------------------------
    if (action === "burst") {
      const casinoIdParam = url.searchParams.get("casino_id");
      const count = Math.min(parseInt(url.searchParams.get("count") || "20", 10), 100);

      if (!casinoIdParam) {
        return new Response(JSON.stringify({ error: "casino_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch active sessions for this casino (up to 200 for variety)
      const { data: sessions, error: sessErr } = await supabase
        .from("gaming_sessions")
        .select("id, player_id, casino_id, game_type, total_wagered, total_won, total_bets")
        .eq("casino_id", casinoIdParam)
        .eq("is_active", true)
        .limit(200);

      if (sessErr) throw sessErr;

      // Fetch player risk scores
      const playerIds = [...new Set((sessions || []).map((s: { player_id: string }) => s.player_id))];
      let playerRisks: Record<string, number> = {};

      if (playerIds.length > 0) {
        const { data: players } = await supabase
          .from("players")
          .select("id, risk_score")
          .in("id", playerIds);

        for (const p of (players || [])) {
          playerRisks[p.id] = p.risk_score || 0;
        }
      }

      const activeSessions = sessions || [];

      if (activeSessions.length === 0) {
        // No active sessions — try to kick off the simulator first
        await supabase.rpc("simulate_live_feed");
        return new Response(JSON.stringify({ success: true, inserted: 0, note: "no active sessions, triggered tick" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Generate events spread across active sessions
      const events: LiveEventRow[] = [];
      for (let i = 0; i < count; i++) {
        const session = activeSessions[i % activeSessions.length];
        events.push(generateEvent(
          session.casino_id,
          session.player_id,
          session.id,
          playerRisks[session.player_id] ?? randInt(10, 65),
          Number(session.total_wagered),
          Number(session.total_won),
          Number(session.total_bets),
        ));
      }

      // Batch insert
      const { error: insertErr } = await supabase
        .from("live_events")
        .insert(events);

      if (insertErr) throw insertErr;

      // Also upsert machine_activity for all touched machines
      const machineMap: Record<string, {
        casino_id: string;
        machine_id: string;
        machine_type: string;
        player_id: string;
        session_start: string;
        spins_per_minute: number;
        risk_score: number;
        wagered: number;
      }> = {};

      for (const ev of events) {
        if (!ev.machine_id) continue;
        const key = `${ev.casino_id}:${ev.machine_id}`;
        if (!machineMap[key] || ev.risk_score > machineMap[key].risk_score) {
          machineMap[key] = {
            casino_id: ev.casino_id,
            machine_id: ev.machine_id,
            machine_type: ev.metadata?.machine_type as string ?? "slot",
            player_id: ev.player_id,
            session_start: new Date(Date.now() - randInt(60000, 3600000)).toISOString(),
            spins_per_minute: SPIN_RATES[ev.game_type] * rand(0.6, 1.4),
            risk_score: ev.risk_score,
            wagered: ev.bet_amount,
          };
        }
      }

      const machineRows = Object.values(machineMap).map(m => ({
        id: crypto.randomUUID(),
        casino_id: m.casino_id,
        machine_id: m.machine_id,
        machine_type: m.machine_type,
        current_player_id: m.player_id,
        session_start: m.session_start,
        status: "active",
        spins_per_minute: Math.round(m.spins_per_minute * 10) / 10,
        current_risk_score: m.risk_score,
        total_wagered_session: m.wagered,
        is_simulated: true,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      }));

      if (machineRows.length > 0) {
        await supabase
          .from("machine_activity")
          .upsert(machineRows, { onConflict: "casino_id,machine_id" });
      }

      return new Response(
        JSON.stringify({ success: true, inserted: events.length, machines_updated: machineRows.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ----------------------------------------------------------------
    // STATS: live aggregation across all casinos
    // ----------------------------------------------------------------
    const [liveStatsRes, casinosRes, playerCountsRes] = await Promise.all([
      supabase
        .from("gaming_sessions")
        .select("casino_id, game_type, total_wagered, total_won, total_bets, duration")
        .eq("is_active", true),
      supabase.from("casinos").select("id, name"),
      supabase.from("players").select("casino_id").eq("is_active", true).eq("status", "active"),
    ]);

    if (liveStatsRes.error) throw liveStatsRes.error;
    if (casinosRes.error) throw casinosRes.error;

    const liveStats = liveStatsRes.data || [];
    const casinos = casinosRes.data || [];
    const playerCounts = playerCountsRes.data || [];

    const casinoMap = Object.fromEntries(casinos.map((c: { id: string; name: string }) => [c.id, c.name]));
    const totalByPlayer: Record<string, number> = {};
    for (const p of playerCounts) {
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

    for (const s of liveStats) {
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

    const totalLive = liveStats.length;
    const totalWagered = liveStats.reduce((s: number, r: { total_wagered: number }) => s + Number(r.total_wagered), 0);
    const totalWon = liveStats.reduce((s: number, r: { total_won: number }) => s + Number(r.total_won), 0);

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
