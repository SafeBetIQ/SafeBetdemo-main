import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getIdentityService } from "../../../lib/playerIdentity/index.ts";
import { getEventPlatform, type CasinoEventDraft } from "../../../lib/eventPlatform/index.ts";
import { verifyPrincipal, principalMayAccessCasino } from "../../../lib/security/principal.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ─── Identity Resolution ──────────────────────────────────────────────────────
// Player identity comes from the Identity Resolution Service (lib/playerIdentity
// + safebet_identity_map). The simulator models a stable population of synthetic
// casino patrons; the same patron reference always resolves to the same
// anonymous SB-PLR-XXXXXXXX id — across ticks, cold starts, and consumers.
// No player names are ever created, stored, or transmitted by this service.

const SYNTHETIC_PATRON_POOL_SIZE = 150;

function syntheticPatronRef(): string {
  return `demo-patron-${Math.floor(Math.random() * SYNTHETIC_PATRON_POOL_SIZE) + 1}`;
}

const GAME_TYPES = ["slots","slots","slots","blackjack","roulette","poker","baccarat","live_dealer"];

const GAME_TO_MACHINE_TYPE: Record<string, string> = {
  slots: "slot", blackjack: "table", roulette: "table",
  poker: "table", baccarat: "table", live_dealer: "live_dealer",
};

const HOUSE_EDGES: Record<string, number> = {
  slots: 0.055, blackjack: 0.005, roulette: 0.027, poker: 0.030,
  baccarat: 0.012, live_dealer: 0.025,
};

const BASE_BET_SIZES: Record<string, number> = {
  slots: 50, blackjack: 300, roulette: 175, poker: 400, baccarat: 225, live_dealer: 350,
};

const SPINS_PER_MINUTE: Record<string, number> = {
  slots: 12, blackjack: 4, roulette: 3, poker: 2, baccarat: 6, live_dealer: 5,
};

const FLOOR_ZONES = ["Zone A – Slots","Zone B – Tables","Zone C – VIP","Zone D – Live","Zone E – RNG"];

// Privacy-by-design intervention messages — no player names used
const INTERVENTION_MESSAGES: Record<string, string> = {
  WhatsApp: "SafeBet IQ: Our responsible gambling system has detected extended gaming activity. Would you like a cooling-off period? Reply BREAK to pause for 24h.",
  SMS: "SafeBet IQ Alert: A responsible gambling check has been triggered. Call 0800-4-27-787 (free).",
  Email: "SafeBet IQ: Our responsible gambling engine has flagged your recent session. Please review your limits or contact our support team.",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rand(min: number, max: number) { return Math.random() * (max - min) + min; }
function randInt(min: number, max: number) { return Math.floor(rand(min, max + 1)); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function hashStr(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

function machineIdFor(playerId: string, casinoId: string): string {
  const n = (hashStr(playerId + casinoId) % 80) + 1;
  return `M-${String(n).padStart(3, "0")}`;
}

function floorZoneFor(machineId: string): string {
  const n = parseInt(machineId.slice(2));
  return FLOOR_ZONES[Math.min(Math.floor(n / 18), FLOOR_ZONES.length - 1)];
}

// ─── Active session shape returned by Supabase query ─────────────────────────

interface ActiveSession {
  id: string;
  player_id: string;
  casino_id: string;
  game_type: string;
  total_wagered: number;
  total_won: number;
  total_bets: number;
}

// ─── Event row interface ──────────────────────────────────────────────────────

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

// ─── Generate a single BET_PLACED event from an active session ────────────────

function generateBetEvent(
  casinoId: string,
  playerId: string,
  sessionId: string,
  baseRisk: number,
  totalWagered: number,
  totalWon: number,
  totalBets: number,
): LiveEventRow {
  const gameType = pick(GAME_TYPES);
  const betBase = BASE_BET_SIZES[gameType];
  const betAmount = Math.round(betBase * rand(0.5, 2.5) / 5) * 5;
  const edge = HOUSE_EDGES[gameType];
  const isJackpot = Math.random() < 0.003;
  const isWin = isJackpot || Math.random() > edge * 2.5;
  const winAmount = isJackpot
    ? betAmount * randInt(25, 100)
    : isWin ? Math.round(betAmount * rand(0.8, 2.8) / 5) * 5 : 0;

  const netRatio = totalWagered > 0 ? totalWon / totalWagered : 0.5;
  const lossChasing = totalWagered > 2000 && netRatio < 0.4 && Math.random() < 0.5;
  const excessiveTime = totalBets > 40 && Math.random() < 0.35;
  const betEscalation = totalBets > 25 && betAmount > betBase * 2 && Math.random() < 0.4;
  const rapidHighStakes = betAmount > betBase * 3 && Math.random() < 0.25;

  const riskFlags: string[] = [];
  if (lossChasing) riskFlags.push("loss_chasing");
  if (excessiveTime) riskFlags.push("excessive_time");
  if (betEscalation) riskFlags.push("bet_escalation");
  if (rapidHighStakes) riskFlags.push("rapid_high_stakes");

  const riskBoost =
    (lossChasing ? 15 : 0) + (excessiveTime ? 8 : 0) +
    (betEscalation ? 10 : 0) + (rapidHighStakes ? 12 : 0) + randInt(0, 8);
  const riskScore = Math.min(100, Math.max(0, baseRisk + riskBoost));

  const machineId = machineIdFor(playerId, casinoId);
  const simDuration = totalBets * (60 / (SPINS_PER_MINUTE[gameType] ?? 4));

  return {
    id: crypto.randomUUID(),
    event_id: crypto.randomUUID(),
    event_type: isJackpot ? "JACKPOT" : "BET_PLACED",
    casino_id: casinoId,
    player_id: playerId,
    session_id: sessionId,
    game_id: `GAME-${gameType.toUpperCase()}-${randInt(1, 99)}`,
    machine_id: machineId,
    bet_amount: betAmount,
    win_amount: winAmount,
    balance_after: null,
    duration_seconds: Math.round(simDuration),
    risk_score: riskScore,
    risk_flags: riskFlags,
    outcome: isWin ? "win" : "loss",
    game_type: gameType,
    is_simulated: true,
    metadata: {
      game_type: gameType,
      machine_type: GAME_TO_MACHINE_TYPE[gameType] ?? "slot",
      is_jackpot: isJackpot,
      bet_count: totalBets + 1,
    },
    created_at: new Date(Date.now() - randInt(0, 15000)).toISOString(),
  };
}

// ─── Generate a lifecycle sequence for a brand-new session ───────────────────

function generateSessionLifecycle(
  casinoId: string,
  playerId: string,
  baseRisk: number,
): LiveEventRow[] {
  const events: LiveEventRow[] = [];
  const sessionId = crypto.randomUUID();
  const gameType = pick(GAME_TYPES);
  const machineId = machineIdFor(playerId, casinoId);
  const isVIP = baseRisk < 30 && Math.random() < 0.1;
  const initialBalance = randInt(500, 15000);
  const location = floorZoneFor(machineId);
  const machineType = GAME_TO_MACHINE_TYPE[gameType] ?? "slot";
  const now = Date.now();
  let t = now - randInt(60000, 300000); // session started 1-5 min ago

  // CARD_INSERT — authentication event triggers identity resolution
  events.push({
    id: crypto.randomUUID(), event_id: crypto.randomUUID(),
    event_type: "CARD_INSERT", casino_id: casinoId, player_id: playerId,
    session_id: sessionId, game_id: null, machine_id: machineId,
    bet_amount: 0, win_amount: 0, balance_after: initialBalance,
    duration_seconds: 0, risk_score: baseRisk, risk_flags: [],
    outcome: "active", game_type: gameType, is_simulated: true,
    metadata: { is_vip: isVIP, casino_entry: true },
    created_at: new Date(t).toISOString(),
  });
  t += randInt(3000, 8000);

  // MACHINE_ALLOCATED
  events.push({
    id: crypto.randomUUID(), event_id: crypto.randomUUID(),
    event_type: "MACHINE_ALLOCATED", casino_id: casinoId, player_id: playerId,
    session_id: sessionId, game_id: null, machine_id: machineId,
    bet_amount: 0, win_amount: 0, balance_after: initialBalance,
    duration_seconds: 0, risk_score: baseRisk, risk_flags: [],
    outcome: "active", game_type: gameType, is_simulated: true,
    metadata: { machine_type: machineType, casino_floor_location: location, game_type: gameType },
    created_at: new Date(t).toISOString(),
  });
  t += randInt(3000, 6000);

  // SESSION_START
  events.push({
    id: crypto.randomUUID(), event_id: crypto.randomUUID(),
    event_type: "SESSION_START", casino_id: casinoId, player_id: playerId,
    session_id: sessionId, game_id: `GAME-${gameType.toUpperCase()}-${randInt(1,99)}`,
    machine_id: machineId, bet_amount: 0, win_amount: 0,
    balance_after: initialBalance, duration_seconds: 0,
    risk_score: baseRisk, risk_flags: [], outcome: "active",
    game_type: gameType, is_simulated: true,
    metadata: { game_type: gameType, initial_balance: initialBalance, denomination: pick([1,2,5,10,20,50]), is_vip: isVIP },
    created_at: new Date(t).toISOString(),
  });

  return events;
}

// ─── Edge function handler ────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);

    // Phase 4.1 least privilege: producing events requires a VERIFIED
    // principal. Anon keys and tampered tokens are refused.
    const principal = await verifyPrincipal(supabase, req.headers.get("Authorization"), serviceRoleKey);
    if (!principal) {
      return new Response(JSON.stringify({ error: "authentication required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "stats";

    // ── TICK: run DB-side simulation function (admin/internal only) ─────────
    if (action === "tick") {
      if (!principal.isServiceRole && principal.role !== "super_admin") {
        return new Response(JSON.stringify({ error: "administrator access required" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await supabase.rpc("simulate_live_feed");
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, result: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── BURST: generate N lifecycle-aware events ────────────────────────────
    if (action === "burst") {
      const casinoIdParam = url.searchParams.get("casino_id");
      const count = Math.min(parseInt(url.searchParams.get("count") || "20", 10), 100);

      if (!casinoIdParam) {
        return new Response(JSON.stringify({ error: "casino_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Producing for a casino requires that casino to be inside the
      // principal's tenant scope (same matrix as the RLS predicate).
      const { data: casinoRow } = await supabase
        .from("casinos").select("id, jurisdiction, province")
        .eq("id", casinoIdParam).maybeSingle();
      if (!casinoRow || !principalMayAccessCasino(principal, casinoRow)) {
        return new Response(JSON.stringify({ error: "casino outside principal scope" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch active sessions
      const sessionsResult = await supabase
        .from("gaming_sessions")
        .select("id, player_id, casino_id, game_type, total_wagered, total_won, total_bets")
        .eq("casino_id", casinoIdParam)
        .eq("is_active", true)
        .limit(200);

      if (sessionsResult.error) throw sessionsResult.error;

      const activeSessions: ActiveSession[] = (sessionsResult.data ?? []) as ActiveSession[];
      const playerIds = [...new Set(activeSessions.map((s: ActiveSession) => s.player_id))];
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
      const allEvents: LiveEventRow[] = [];

      if (activeSessions.length === 0) {
        // No active sessions — trigger the DB-side tick to create some
        await supabase.rpc("simulate_live_feed");

        // Generate lifecycle events for stable synthetic patrons resolved
        // through the Identity Resolution Service
        for (let i = 0; i < Math.min(count, 5); i++) {
          const playerId = await getIdentityService().resolveIdentity(syntheticPatronRef(), { casinoId: casinoIdParam, client: supabase });
          const baseRisk = randInt(10, 65);
          const lifecycleEvents = generateSessionLifecycle(casinoIdParam, playerId, baseRisk);
          allEvents.push(...lifecycleEvents);
        }
      } else {
        // Generate bet events spread across active sessions
        const betCount = Math.round(count * 0.75);
        for (let i = 0; i < betCount; i++) {
          const session = activeSessions[i % activeSessions.length];
          allEvents.push(generateBetEvent(
            session.casino_id,
            session.player_id,
            session.id,
            playerRisks[session.player_id] ?? randInt(10, 65),
            Number(session.total_wagered),
            Number(session.total_won),
            Number(session.total_bets),
          ));
        }

        // Inject a few lifecycle events (new session starts, risk alerts)
        const lifecycleCount = count - betCount;
        for (let i = 0; i < lifecycleCount; i++) {
          const session = pick(activeSessions);
          const risk = playerRisks[session.player_id] ?? randInt(30, 75);
          const shouldAlert = risk >= 65 && Math.random() < 0.5;

          if (shouldAlert) {
            const machineId = machineIdFor(session.player_id, session.casino_id);
            const channel = pick(["WhatsApp", "SMS", "Email"]);
            allEvents.push({
              id: crypto.randomUUID(), event_id: crypto.randomUUID(),
              event_type: risk >= 80 ? "INTERVENTION_TRIGGERED" : "RISK_ALERT",
              casino_id: session.casino_id, player_id: session.player_id,
              session_id: session.id, game_id: null, machine_id: machineId,
              bet_amount: 0, win_amount: 0, balance_after: null,
              duration_seconds: randInt(1800, 7200),
              risk_score: risk, risk_flags: ["ai_flagged", "pattern_detected"],
              outcome: "active", game_type: session.game_type, is_simulated: true,
              metadata: {
                alert_reason: pick(["loss_chasing_pattern","prolonged_session","rapid_bet_escalation"]),
                model_version: "SafeBet-AI-v2.4",
                ...(risk >= 80 ? { channel, message: INTERVENTION_MESSAGES[channel] } : {}),
              },
              created_at: new Date(Date.now() - randInt(0, 8000)).toISOString(),
            });
          } else {
            // New session lifecycle — resolve a stable synthetic patron via the IRS
            const newPlayerId = await getIdentityService().resolveIdentity(syntheticPatronRef(), { casinoId: session.casino_id, client: supabase });
            const lifecycleEvents = generateSessionLifecycle(session.casino_id, newPlayerId, randInt(10, 60));
            allEvents.push(...lifecycleEvents);
          }
        }
      }

      // Ingest every event ONCE through the Enterprise Event Platform:
      // validate → enrich → version → persist (casino_event_log, append-only;
      // persisting IS the realtime distribution).
      // The simulator is a producer only — it never writes event stores directly.
      if (allEvents.length > 0) {
        const drafts: CasinoEventDraft[] = allEvents.map((r) => ({
          eventType: r.event_type,
          occurredAt: r.created_at,
          safeBetPlayerId: r.player_id,
          sessionId: r.session_id,
          machineId: r.machine_id,
          correlationId: r.session_id ?? undefined,
          payload: {
            game_id: r.game_id,
            bet_amount: r.bet_amount,
            win_amount: r.win_amount,
            balance_after: r.balance_after,
            duration_seconds: r.duration_seconds,
            risk_score: r.risk_score,
            risk_flags: r.risk_flags,
            outcome: r.outcome,
            game_type: r.game_type,
            is_simulated: r.is_simulated,
            metadata: r.metadata,
          },
        }));
        await getEventPlatform().ingestBatch(drafts, {
          casinoId: casinoIdParam,
          producer: "casino-simulator",
          client: supabase,
        });
      }

      // Runtime state (projection_* tables + legacy machine_activity /
      // live_kpi_snapshots mirrors) is produced exclusively by the
      // Enterprise Projection Platform inside ingestBatch above.
      // The simulator is a producer of events only.

      return new Response(
        JSON.stringify({
          success: true,
          inserted: allEvents.length,
          machines_updated: new Set(allEvents.filter(e => e.machine_id).map(e => e.machine_id)).size,
          breakdown: {
            bet_events: allEvents.filter(e => ["BET_PLACED","JACKPOT"].includes(e.event_type)).length,
            lifecycle_events: allEvents.filter(e => ["CARD_INSERT","MACHINE_ALLOCATED","SESSION_START","RISK_ALERT","INTERVENTION_TRIGGERED"].includes(e.event_type)).length,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── STATS: live aggregation across all casinos ──────────────────────────
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
      casino_id: string; casino_name: string; live_players: number; total_players: number;
      live_pct: number; wagered_this_session: number; won_this_session: number;
      total_bets: number; avg_session_minutes: number; game_breakdown: Record<string, number>;
    }> = {};

    for (const s of liveStats) {
      const cid = s.casino_id;
      if (!byCasino[cid]) {
        byCasino[cid] = {
          casino_id: cid, casino_name: casinoMap[cid] || cid,
          live_players: 0, total_players: totalByPlayer[cid] || 0, live_pct: 0,
          wagered_this_session: 0, won_this_session: 0, total_bets: 0,
          avg_session_minutes: 0, game_breakdown: {},
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
        ? Math.round((byCasino[cid].live_players / byCasino[cid].total_players) * 1000) / 10 : 0;
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
            ? Math.round(((totalWagered - totalWon) / totalWagered) * 10000) / 100 : 0,
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
