import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ── Lookup tables ─────────────────────────────────────────────────────────────

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

const GAME_TYPES   = ["slots","slots","slots","blackjack","roulette","poker","baccarat"];
const MACHINE_TYPES = ["slot","slot","slot","table","rng","live_dealer"];

const HOUSE_EDGES: Record<string, number> = {
  slots: 0.055, blackjack: 0.005, roulette: 0.027, poker: 0.030, baccarat: 0.012,
};
const BASE_BET_SIZES: Record<string, number> = {
  slots: 50, blackjack: 300, roulette: 175, poker: 400, baccarat: 225,
};
const SPIN_RATES: Record<string, number> = {
  slots: 12, blackjack: 4, roulette: 3, poker: 2, baccarat: 5,
};

// ── Utility helpers ───────────────────────────────────────────────────────────

function rand(min: number, max: number) { return Math.random() * (max - min) + min; }
function randInt(min: number, max: number) { return Math.floor(rand(min, max + 1)); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function r5(n: number) { return Math.round(n / 5) * 5; }

function hashStr(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

function playerNameFor(playerId: string): string {
  const fi = hashStr(playerId) % SA_FIRST_NAMES.length;
  const li = hashStr(playerId + "L") % SA_LAST_NAMES.length;
  return `${SA_FIRST_NAMES[fi]} ${SA_LAST_NAMES[li]}`;
}

function machineIdFor(playerId: string, casinoId: string): string {
  return `M-${String((hashStr(playerId + casinoId) % 80) + 1).padStart(3, "0")}`;
}

// ── Archetype: deterministic per player — 70 % normal / 20 % at-risk / 10 % problem ──

function getArchetype(playerId: string): "normal" | "at_risk" | "problem" {
  const h = hashStr(playerId) % 10;
  if (h === 0) return "problem";  // 10 %
  if (h <= 2)  return "at_risk";  // 20 %
  return "normal";                // 70 %
}

// ── Row interfaces ────────────────────────────────────────────────────────────

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

// ── Per-archetype event generators ───────────────────────────────────────────

function makeBetRow(
  casinoId: string,
  playerId: string,
  sessionId: string | null,
  gameType: string,
  betAmount: number,
  outcome: "win" | "loss",
  sessionSecs: number,
  riskScore: number,
  riskFlags: string[],
  tsMs: number,
): LiveEventRow {
  const winAmount = outcome === "win" ? r5(betAmount * rand(0.8, 2.2)) : 0;
  return {
    id: crypto.randomUUID(),
    event_id: crypto.randomUUID(),
    event_type: "BET_PLACED",
    casino_id: casinoId,
    player_id: playerId,
    session_id: sessionId,
    game_id: `GAME-${gameType.toUpperCase()}-${randInt(1, 99)}`,
    machine_id: machineIdFor(playerId, casinoId),
    bet_amount: betAmount,
    win_amount: winAmount,
    balance_after: null,
    duration_seconds: sessionSecs,
    risk_score: riskScore,
    risk_flags: riskFlags,
    outcome,
    game_type: gameType,
    is_simulated: true,
    metadata: {
      player_name: playerNameFor(playerId),
      game_type: gameType,
      machine_type: MACHINE_TYPES[hashStr(playerId) % MACHINE_TYPES.length],
    },
    created_at: new Date(tsMs).toISOString(),
  };
}

function makeDepositRow(
  casinoId: string,
  playerId: string,
  sessionId: string | null,
  amount: number,
  tsMs: number,
): LiveEventRow {
  return {
    id: crypto.randomUUID(),
    event_id: crypto.randomUUID(),
    event_type: "DEPOSIT",
    casino_id: casinoId,
    player_id: playerId,
    session_id: sessionId,
    game_id: null,
    machine_id: null,
    bet_amount: 0,
    win_amount: 0,
    balance_after: amount,
    duration_seconds: 0,
    risk_score: 0,
    risk_flags: [],
    outcome: "active",
    game_type: "slots",
    is_simulated: true,
    metadata: { player_name: playerNameFor(playerId), ingest_source: "simulator" },
    created_at: new Date(tsMs).toISOString(),
  };
}

/** Generates a realistic event sequence for one player based on archetype. */
function generateArchetypeEvents(
  casinoId: string,
  playerId: string,
  sessionId: string | null,
  existingRisk: number,
  totalWagered: number,
  totalWon: number,
  totalBets: number,
): LiveEventRow[] {
  const archetype = getArchetype(playerId);
  const nowMs     = Date.now();
  const events: LiveEventRow[] = [];

  if (archetype === "problem") {
    // ── Problem player: rapid loss-chasing burst ────────────────────────────
    // 5–8 consecutive losses, timestamps within the last 90 s, escalating bets.
    const gameType  = pick(["slots", "slots", "blackjack", "roulette"]);
    const base      = BASE_BET_SIZES[gameType];
    const burstLen  = randInt(5, 8);
    let bet         = base * randInt(4, 8);  // start 4–8 × base

    // Large deposit before the burst
    events.push(makeDepositRow(casinoId, playerId, sessionId, randInt(5000, 20000),
      nowMs - (burstLen + 1) * 12000));

    for (let i = 0; i < burstLen; i++) {
      const tsMs = nowMs - (burstLen - i) * randInt(6000, 12000);
      events.push(makeBetRow(
        casinoId, playerId, sessionId, gameType,
        r5(bet), "loss",
        randInt(5500, 7200),  // 90–120 min session
        Math.min(100, randInt(75, 95) + i * 2),
        ["loss_chasing", "bet_escalation", "excessive_time", "rapid_high_stakes"],
        tsMs,
      ));
      bet = bet * (1.25 + Math.random() * 0.20); // 25–45 % escalation per loss
    }

  } else if (archetype === "at_risk") {
    // ── At-risk player: moderate escalation, extended session ───────────────
    const gameType = pick(GAME_TYPES);
    const base     = BASE_BET_SIZES[gameType];
    const count    = randInt(2, 3);
    let bet        = base * rand(1.5, 3.0);
    let consecutive = 0;

    // Occasional deposit spike
    if (Math.random() < 0.45) {
      events.push(makeDepositRow(casinoId, playerId, sessionId, randInt(1000, 3500),
        nowMs - count * 10000 - 5000));
    }

    for (let i = 0; i < count; i++) {
      const isLoss     = Math.random() < 0.65;
      const outcome: "win" | "loss" = isLoss ? "loss" : "win";
      const sessionSec = randInt(2700, 5400);  // 45–90 min

      const riskFlags: string[] = [];
      if (isLoss && consecutive >= 2)    riskFlags.push("loss_chasing");
      if (sessionSec > 2700)             riskFlags.push("excessive_time");
      if (bet > base * 2)                riskFlags.push("bet_escalation");

      events.push(makeBetRow(
        casinoId, playerId, sessionId, gameType,
        r5(bet), outcome, sessionSec,
        randInt(45, 72), riskFlags,
        nowMs - (count - i) * randInt(8000, 20000),
      ));

      if (isLoss) {
        consecutive++;
        bet = bet * (1.15 + Math.random() * 0.15);
      } else {
        consecutive = 0;
        bet = base * rand(0.8, 1.2);
      }
    }

  } else {
    // ── Normal player: single low-risk event ────────────────────────────────
    const EVENT_POOL = [
      ...Array(60).fill("BET_PLACED"),
      ...Array(10).fill("DEPOSIT"),
      ...Array(8).fill("WITHDRAWAL"),
      ...Array(12).fill("SESSION_START"),
      ...Array(10).fill("SESSION_END"),
    ];
    const eventType = pick(EVENT_POOL);
    const gameType  = pick(GAME_TYPES);
    const base      = BASE_BET_SIZES[gameType];
    const betBase   = r5(base * rand(0.4, 1.4));
    const isWin     = Math.random() > 0.45;
    const baseRisk  = (hashStr(playerId) % 30) + 5;

    if (eventType === "BET_PLACED") {
      events.push(makeBetRow(
        casinoId, playerId, sessionId, gameType,
        betBase, isWin ? "win" : "loss",
        randInt(120, 2400),
        Math.min(55, baseRisk + (isWin ? 0 : randInt(0, 8))),
        [],
        nowMs - randInt(0, 5000),
      ));
    } else {
      events.push({
        id: crypto.randomUUID(),
        event_id: crypto.randomUUID(),
        event_type: eventType,
        casino_id: casinoId,
        player_id: playerId,
        session_id: sessionId,
        game_id: null,
        machine_id: machineIdFor(playerId, casinoId),
        bet_amount: 0,
        win_amount: 0,
        balance_after:
          eventType === "DEPOSIT" ? randInt(200, 3000) :
          eventType === "WITHDRAWAL" ? randInt(0, 2000) : null,
        duration_seconds: randInt(120, 2400),
        risk_score: baseRisk,
        risk_flags: [],
        outcome: "active",
        game_type: gameType,
        is_simulated: true,
        metadata: { player_name: playerNameFor(playerId), ingest_source: "simulator" },
        created_at: new Date(nowMs - randInt(0, 5000)).toISOString(),
      });
    }
  }

  return events;
}

// ── HTTP handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url    = new URL(req.url);
    const action = url.searchParams.get("action") || "stats";

    // ── TICK: run SQL simulator ─────────────────────────────────────────────
    if (action === "tick") {
      const { data, error } = await supabase.rpc("simulate_live_feed");
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, result: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── BURST: archetype-aware realistic event generation ───────────────────
    if (action === "burst") {
      const casinoIdParam = url.searchParams.get("casino_id");
      const count = Math.min(parseInt(url.searchParams.get("count") || "20", 10), 100);

      if (!casinoIdParam) {
        return new Response(JSON.stringify({ error: "casino_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch active sessions
      const { data: sessions, error: sessErr } = await supabase
        .from("gaming_sessions")
        .select("id, player_id, casino_id, game_type, total_wagered, total_won, total_bets")
        .eq("casino_id", casinoIdParam)
        .eq("is_active", true)
        .limit(200);

      if (sessErr) throw sessErr;

      const activeSessions = sessions || [];

      if (activeSessions.length === 0) {
        await supabase.rpc("simulate_live_feed");
        return new Response(JSON.stringify({ success: true, inserted: 0, note: "no active sessions, triggered tick" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Pre-fetch player risk scores
      const playerIds = [...new Set(activeSessions.map((s: { player_id: string }) => s.player_id))];
      const playerRisks: Record<string, number> = {};
      if (playerIds.length > 0) {
        const { data: players } = await supabase
          .from("players")
          .select("id, risk_score")
          .in("id", playerIds);
        for (const p of (players || [])) {
          playerRisks[p.id] = p.risk_score || 0;
        }
      }

      // Partition sessions by archetype
      const problemSessions  = activeSessions.filter((s: { player_id: string }) => getArchetype(s.player_id) === "problem");
      const atRiskSessions   = activeSessions.filter((s: { player_id: string }) => getArchetype(s.player_id) === "at_risk");
      const normalSessions   = activeSessions.filter((s: { player_id: string }) => getArchetype(s.player_id) === "normal");

      const allEvents: LiveEventRow[] = [];

      // Always include at least 2 problem player bursts in a burst call
      const problemSlots = Math.max(2, Math.round(count * 0.10));
      const atRiskSlots  = Math.round(count * 0.20);
      const normalSlots  = count - problemSlots - atRiskSlots;

      function sessionFor(pool: typeof activeSessions, fallback: typeof activeSessions) {
        return pool.length > 0 ? pick(pool) : pick(fallback);
      }

      for (let i = 0; i < problemSlots; i++) {
        const s = sessionFor(problemSessions, activeSessions);
        const events = generateArchetypeEvents(
          s.casino_id, s.player_id, s.id,
          playerRisks[s.player_id] ?? randInt(40, 65),
          Number(s.total_wagered), Number(s.total_won), Number(s.total_bets),
        );
        allEvents.push(...events);
      }

      for (let i = 0; i < atRiskSlots; i++) {
        const s = sessionFor(atRiskSessions, activeSessions);
        const events = generateArchetypeEvents(
          s.casino_id, s.player_id, s.id,
          playerRisks[s.player_id] ?? randInt(20, 45),
          Number(s.total_wagered), Number(s.total_won), Number(s.total_bets),
        );
        allEvents.push(...events);
      }

      for (let i = 0; i < normalSlots; i++) {
        const s = sessionFor(normalSessions, activeSessions);
        const events = generateArchetypeEvents(
          s.casino_id, s.player_id, s.id,
          playerRisks[s.player_id] ?? randInt(5, 30),
          Number(s.total_wagered), Number(s.total_won), Number(s.total_bets),
        );
        allEvents.push(...events);
      }

      // Batch insert all events
      const { error: insertErr } = await supabase.from("live_events").insert(allEvents);
      if (insertErr) throw insertErr;

      // Upsert machine_activity for touched machines
      const machineMap: Record<string, {
        casino_id: string; machine_id: string; machine_type: string;
        player_id: string; risk_score: number; wagered: number;
      }> = {};

      for (const ev of allEvents) {
        if (!ev.machine_id || ev.event_type !== "BET_PLACED") continue;
        const key = `${ev.casino_id}:${ev.machine_id}`;
        if (!machineMap[key] || ev.risk_score > machineMap[key].risk_score) {
          machineMap[key] = {
            casino_id:   ev.casino_id,
            machine_id:  ev.machine_id,
            machine_type: ev.metadata?.machine_type as string ?? "slot",
            player_id:   ev.player_id,
            risk_score:  ev.risk_score,
            wagered:     ev.bet_amount,
          };
        }
      }

      const machineRows = Object.values(machineMap).map(m => ({
        id:                    crypto.randomUUID(),
        casino_id:             m.casino_id,
        machine_id:            m.machine_id,
        machine_type:          m.machine_type,
        current_player_id:     m.player_id,
        session_start:         new Date(Date.now() - randInt(60000, 3600000)).toISOString(),
        status:                "active",
        spins_per_minute:      Math.round(SPIN_RATES["slots"] * rand(0.6, 1.4) * 10) / 10,
        current_risk_score:    m.risk_score,
        total_wagered_session: m.wagered,
        is_simulated:          true,
        updated_at:            new Date().toISOString(),
        created_at:            new Date().toISOString(),
      }));

      if (machineRows.length > 0) {
        await supabase.from("machine_activity")
          .upsert(machineRows, { onConflict: "casino_id,machine_id" });
      }

      return new Response(
        JSON.stringify({ success: true, inserted: allEvents.length, machines_updated: machineRows.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── STATS: live aggregation ─────────────────────────────────────────────
    const [liveStatsRes, casinosRes, playerCountsRes] = await Promise.all([
      supabase.from("gaming_sessions")
        .select("casino_id, game_type, total_wagered, total_won, total_bets, duration")
        .eq("is_active", true),
      supabase.from("casinos").select("id, name"),
      supabase.from("players").select("casino_id").eq("is_active", true).eq("status", "active"),
    ]);

    if (liveStatsRes.error) throw liveStatsRes.error;
    if (casinosRes.error)   throw casinosRes.error;

    const liveStats   = liveStatsRes.data || [];
    const casinos     = casinosRes.data || [];
    const playerCounts = playerCountsRes.data || [];

    const casinoMap = Object.fromEntries(casinos.map((c: { id: string; name: string }) => [c.id, c.name]));
    const totalByPlayer: Record<string, number> = {};
    for (const p of playerCounts) totalByPlayer[p.casino_id] = (totalByPlayer[p.casino_id] || 0) + 1;

    const byGame: Record<string, { sessions: number; wagered: number; won: number; bets: number }> = {};
    const byCasino: Record<string, {
      casino_id: string; casino_name: string; live_players: number; total_players: number;
      live_pct: number; wagered_this_session: number; won_this_session: number;
      total_bets: number; avg_session_minutes: number; game_breakdown: Record<string, number>;
    }> = {};

    for (const s of liveStats) {
      const cid = s.casino_id;
      if (!byCasino[cid]) {
        byCasino[cid] = {
          casino_id: cid, casino_name: casinoMap[cid] || cid,
          live_players: 0, total_players: totalByPlayer[cid] || 0,
          live_pct: 0, wagered_this_session: 0, won_this_session: 0,
          total_bets: 0, avg_session_minutes: 0, game_breakdown: {},
        };
      }
      byCasino[cid].live_players++;
      byCasino[cid].wagered_this_session += Number(s.total_wagered);
      byCasino[cid].won_this_session     += Number(s.total_won);
      byCasino[cid].total_bets           += Number(s.total_bets);
      byCasino[cid].avg_session_minutes   =
        (byCasino[cid].avg_session_minutes * (byCasino[cid].live_players - 1) + Number(s.duration)) /
        byCasino[cid].live_players;
      byCasino[cid].game_breakdown[s.game_type] = (byCasino[cid].game_breakdown[s.game_type] || 0) + 1;

      if (!byGame[s.game_type]) byGame[s.game_type] = { sessions: 0, wagered: 0, won: 0, bets: 0 };
      byGame[s.game_type].sessions++;
      byGame[s.game_type].wagered += Number(s.total_wagered);
      byGame[s.game_type].won     += Number(s.total_won);
      byGame[s.game_type].bets    += Number(s.total_bets);
    }

    for (const cid in byCasino) {
      byCasino[cid].live_pct = byCasino[cid].total_players > 0
        ? Math.round((byCasino[cid].live_players / byCasino[cid].total_players) * 1000) / 10 : 0;
      byCasino[cid].wagered_this_session = Math.round(byCasino[cid].wagered_this_session * 100) / 100;
      byCasino[cid].won_this_session     = Math.round(byCasino[cid].won_this_session * 100) / 100;
      byCasino[cid].avg_session_minutes  = Math.round(byCasino[cid].avg_session_minutes * 10) / 10;
    }

    const totalLive    = liveStats.length;
    const totalWagered = liveStats.reduce((s: number, r: { total_wagered: number }) => s + Number(r.total_wagered), 0);
    const totalWon     = liveStats.reduce((s: number, r: { total_won: number }) => s + Number(r.total_won), 0);

    return new Response(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        summary: {
          total_live_players: totalLive,
          total_wagered_live: Math.round(totalWagered * 100) / 100,
          total_won_live:     Math.round(totalWon * 100) / 100,
          house_edge_live:    totalWagered > 0
            ? Math.round(((totalWagered - totalWon) / totalWagered) * 10000) / 100 : 0,
          casinos_active: Object.keys(byCasino).length,
        },
        by_casino: Object.values(byCasino).sort((a, b) => b.live_players - a.live_players),
        by_game:   byGame,
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
