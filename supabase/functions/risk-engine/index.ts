import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// ── Security: this endpoint is INTERNAL ONLY ──────────────────────────────────
// All requests must carry a valid HMAC-SHA256 signature produced by
// call_risk_engine() in PostgreSQL. Unsigned requests are rejected and logged.
// CORS is intentionally disabled — browser access is not permitted.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000; // 5 minutes replay window

// Constant-time hex comparison — prevents timing-oracle attacks on HMAC
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

async function verifyHmacSignature(
  rawBody: string,
  timestamp: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const message = `${timestamp}.${rawBody}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  const expectedHex = Array.from(new Uint8Array(sigBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return secureCompare(expectedHex, signature);
}

// ── Payload types ─────────────────────────────────────────────────────────────

interface EventPayload {
  player_id: string;
  casino_id: string;
  event_id?: string;
  bet_amount: number;
  win_amount: number;
  duration_seconds: number;
  event_type: string;
  session_id?: string | null;
  game_type?: string | null;
  created_at: string;
}

interface FactorResult {
  score: number;
  label: string;
  detail: string;
}

// ── Factor A: Loss Chasing (0–30 pts) ────────────────────────────────────────

function scoreLossChasing(
  recentBets: { bet_amount: number; outcome: string | null }[],
): FactorResult {
  const label = "loss_chasing";
  if (recentBets.length < 2) return { score: 0, label, detail: "insufficient history" };

  let consecutive = 0;
  for (const bet of recentBets) {
    if (bet.outcome === "loss") consecutive++;
    else break;
  }

  const streak = recentBets.slice(0, Math.max(consecutive, 0));
  const escalating =
    streak.length >= 2 &&
    streak.every((b, i) => i === 0 || Number(b.bet_amount) >= Number(streak[i - 1].bet_amount) * 0.90);

  if (consecutive >= 3 && escalating) {
    const score = Math.min(30, 15 + (consecutive - 3) * 3);
    return { score, label, detail: `${consecutive} consecutive losses with escalating bets (+${score}pts)` };
  }
  if (consecutive >= 3) return { score: 10, label, detail: `${consecutive} consecutive losses` };
  if (consecutive >= 2) return { score: 4, label, detail: `${consecutive} consecutive losses` };
  return { score: 0, label, detail: "no consecutive loss pattern" };
}

// ── Factor B: Rapid Betting (0–20 pts) ───────────────────────────────────────

function scoreRapidBetting(
  recentBets: { created_at: string }[],
  eventTime: string,
): FactorResult {
  const label = "rapid_betting";
  const cutoff = new Date(eventTime).getTime() - 2 * 60 * 1000;
  const count = recentBets.filter((b) => new Date(b.created_at).getTime() >= cutoff).length;

  if (count > 20) return { score: 20, label, detail: `${count} bets in 2 min (critical velocity)` };
  if (count > 15) return { score: 15, label, detail: `${count} bets in 2 min` };
  if (count > 10) return { score: 10, label, detail: `${count} bets in 2 min` };
  if (count > 6)  return { score: 5,  label, detail: `${count} bets in 2 min` };
  return { score: 0, label, detail: `${count} bets in 2 min — within normal range` };
}

// ── Factor C: Session Duration (0–20 pts) ────────────────────────────────────

function scoreSessionDuration(durationSeconds: number): FactorResult {
  const label = "session_duration";
  const mins = Math.round(durationSeconds / 60);

  if (durationSeconds > 90 * 60) return { score: 20, label, detail: `${mins}min session (>90min threshold)` };
  if (durationSeconds > 45 * 60) return { score: 10, label, detail: `${mins}min session (>45min threshold)` };
  return { score: 0, label, detail: `${mins}min session — normal` };
}

// ── Factor D: Deposit Spike (0–20 pts) ───────────────────────────────────────

function scoreDepositSpike(deposits24h: number, avgDailyDeposit: number): FactorResult {
  const label = "deposit_spike";

  if (avgDailyDeposit > 0) {
    const ratio = deposits24h / avgDailyDeposit;
    if (ratio >= 3)   return { score: 20, label, detail: `Today R${deposits24h.toFixed(0)} is ${ratio.toFixed(1)}× daily avg` };
    if (ratio >= 2)   return { score: 15, label, detail: `Today R${deposits24h.toFixed(0)} is ${ratio.toFixed(1)}× daily avg` };
    if (ratio >= 1.5) return { score: 8,  label, detail: `Today R${deposits24h.toFixed(0)} is ${ratio.toFixed(1)}× daily avg` };
  }

  if (deposits24h > 10_000) return { score: 20, label, detail: `Large deposit today: R${deposits24h.toFixed(0)} (no baseline)` };
  if (deposits24h > 5_000)  return { score: 10, label, detail: `Elevated deposit today: R${deposits24h.toFixed(0)}` };
  return { score: 0, label, detail: "deposit volume normal" };
}

// ── Factor E: Cross-Operator (0–25 pts) ──────────────────────────────────────

function scoreCrossOperator(existingCrossOpScore: number, senExclusionActive: boolean): FactorResult {
  const label = "cross_operator";

  if (senExclusionActive) {
    return { score: 25, label, detail: "Player active while under SEN self-exclusion order" };
  }
  if (existingCrossOpScore >= 60) {
    return { score: 15, label, detail: `Prior cross-operator intelligence flag (score: ${existingCrossOpScore})` };
  }
  if (existingCrossOpScore > 0) {
    const score = Math.round(existingCrossOpScore * 0.25);
    return { score, label, detail: `Cross-operator activity on record (score: ${existingCrossOpScore})` };
  }
  return { score: 0, label, detail: "no cross-operator signals" };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapLevel(score: number): "low" | "moderate" | "high" | "critical" {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 30) return "moderate";
  return "low";
}

function mapAction(level: string): string {
  return ({ critical: "block", high: "intervene", moderate: "notify", low: "monitor" })[level] ?? "monitor";
}

function computeConfidence(dataPoints: number, signalCount: number): number {
  const base      = 0.50;
  const dataBonus = Math.min(dataPoints / 200, 0.25);
  const sigBonus  = Math.min(signalCount * 0.08, 0.22);
  return parseFloat(Math.min(0.97, base + dataBonus + sigBonus).toFixed(2));
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // INTERNAL ENDPOINT — no CORS, no browser access
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── UPGRADE 2+3: HMAC signature verification ────────────────────────────────
  const timestamp = req.headers.get("x-timestamp");
  const signature = req.headers.get("x-signature");
  const ip        = req.headers.get("x-forwarded-for") ?? "unknown";

  if (!timestamp || !signature) {
    console.error("[risk-engine] SECURITY: missing headers", { ip, hasTimestamp: !!timestamp, hasSignature: !!signature });
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Replay attack protection — reject requests older than 5 minutes
  const requestTimeMs = parseInt(timestamp, 10) * 1000;
  const driftMs       = Math.abs(Date.now() - requestTimeMs);
  if (isNaN(requestTimeMs) || driftMs > MAX_TIMESTAMP_DRIFT_MS) {
    console.error("[risk-engine] SECURITY: timestamp rejected", { ip, timestamp, driftMs });
    return new Response(JSON.stringify({ error: "Request expired" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Read raw body — signature is computed over the exact bytes sent by PostgreSQL
  const rawBody = await req.text();

  const hmacSecret = Deno.env.get("RISK_ENGINE_HMAC_SECRET");
  if (!hmacSecret) {
    console.error("[risk-engine] RISK_ENGINE_HMAC_SECRET not configured");
    return new Response(JSON.stringify({ error: "Internal configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const isValid = await verifyHmacSignature(rawBody, timestamp, signature, hmacSecret);
  if (!isValid) {
    console.error("[risk-engine] SECURITY: invalid HMAC signature", { ip, timestamp });
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  // ── End HMAC verification ───────────────────────────────────────────────────

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let event: EventPayload;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { player_id, casino_id, bet_amount, win_amount, duration_seconds, created_at, session_id } = event;

    if (!player_id || !casino_id) {
      return new Response(JSON.stringify({ error: "player_id and casino_id required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── Gather behavioral context (parallel) ─────────────────────────────────

    const windowStart24h = new Date(new Date(created_at).getTime() - 24 * 60 * 60 * 1000).toISOString();
    const windowStart30d = new Date(new Date(created_at).getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [recentBetsRes, deposits24hRes, historicDepositsRes, prevProfileRes, senRes] = await Promise.all([
      supabase
        .from("live_events")
        .select("bet_amount, win_amount, outcome, created_at")
        .eq("player_id", player_id)
        .eq("casino_id", casino_id)
        .eq("event_type", "BET_PLACED")
        .order("created_at", { ascending: false })
        .limit(25),

      supabase
        .from("live_events")
        .select("bet_amount")
        .eq("player_id", player_id)
        .eq("event_type", "DEPOSIT")
        .gte("created_at", windowStart24h),

      supabase
        .from("live_events")
        .select("bet_amount")
        .eq("player_id", player_id)
        .eq("event_type", "DEPOSIT")
        .gte("created_at", windowStart30d),

      supabase
        .from("behavioral_risk_profiles")
        .select("risk_score, cross_operator_score, score_delta")
        .eq("player_id", player_id)
        .order("analyzed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),

      supabase
        .from("sen_exclusion_events")
        .select("id")
        .eq("player_id", player_id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle(),
    ]);

    const recentBets       = recentBetsRes.data ?? [];
    const deposits24h      = (deposits24hRes.data ?? []).reduce((s: number, d: { bet_amount: string }) => s + Number(d.bet_amount), 0);
    const historicDeposits = historicDepositsRes.data ?? [];
    const avgDailyDeposit  = historicDeposits.length > 0
      ? historicDeposits.reduce((s: number, d: { bet_amount: string }) => s + Number(d.bet_amount), 0) / 30
      : 0;
    const prevProfile    = prevProfileRes.data;
    const existingCrossOp = Number(prevProfile?.cross_operator_score ?? 0);
    const senActive       = senRes.data != null;

    // ── Score factors ─────────────────────────────────────────────────────────

    const lcResult = scoreLossChasing(recentBets);
    const rbResult = scoreRapidBetting(recentBets, created_at);
    const sdResult = scoreSessionDuration(duration_seconds);
    const dsResult = scoreDepositSpike(deposits24h, avgDailyDeposit);
    const coResult = scoreCrossOperator(existingCrossOp, senActive);

    const factors    = [lcResult, rbResult, sdResult, dsResult, coResult];
    const finalScore = Math.min(100, factors.reduce((s, f) => s + f.score, 0));
    const level      = mapLevel(finalScore);
    const action     = mapAction(level);

    const activeFactors = factors.filter((f) => f.score > 0);
    const factorLabels  = activeFactors.map((f) => f.label);
    const factorDetails = activeFactors.map((f) => f.detail);
    const confidence    = computeConfidence(recentBets.length + historicDeposits.length, activeFactors.length);

    const rationale =
      level === "critical"  ? `Critical behavioural risk: ${factorDetails.join("; ") || "multiple concurrent signals"}. Immediate intervention required.`
      : level === "high"    ? `High risk: ${factorDetails.join("; ") || "elevated signals"}. Intervention advised.`
      : level === "moderate"? `Moderate risk: ${factorDetails.join("; ") || "emerging patterns — monitor closely"}.`
      : "Behavioural patterns within normal parameters.";

    const cutoff2Min      = new Date(new Date(created_at).getTime() - 2 * 60 * 1000).getTime();
    const betsIn2Min      = recentBets.filter((b) => new Date(b.created_at).getTime() >= cutoff2Min).length;
    const bettingVelocity = parseFloat((betsIn2Min / 2).toFixed(1));
    const previousScore   = prevProfile?.risk_score ?? finalScore;

    // ── Persist risk profile ──────────────────────────────────────────────────

    const { data: profile, error: profileErr } = await supabase
      .from("behavioral_risk_profiles")
      .insert({
        player_id,
        session_id:               session_id ?? null,
        casino_id,
        risk_score:               finalScore,
        risk_level:               level,
        impulse_level:            lcResult.score,
        betting_velocity:         bettingVelocity,
        session_duration_minutes: Math.round(duration_seconds / 60),
        loss_escalation_score:    lcResult.score,
        session_duration_score:   sdResult.score,
        deposit_frequency_score:  dsResult.score,
        bet_intensity_score:      rbResult.score,
        cross_operator_score:     coResult.score,
        risk_rationale:           rationale,
        previous_risk_score:      previousScore,
        score_delta:              finalScore - previousScore,
        intervention_triggered:   finalScore >= 70,
        signal_weights: {
          loss_chasing: 0.30, rapid_betting: 0.20,
          session_duration: 0.20, deposit_spike: 0.20, cross_operator: 0.25,
        },
        analyzed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (profileErr) console.error("[risk-engine] profile insert:", profileErr.message);

    // ── Intervention trigger ──────────────────────────────────────────────────

    if (finalScore >= 70) {
      const interventionType = finalScore >= 80 ? "contact_support" : "break_suggestion";
      const message = finalScore >= 80
        ? `CRITICAL — Risk score ${finalScore}: ${rationale} Immediate operator review required.`
        : `Responsible gambling alert: Your session has triggered a risk review (score ${finalScore}). Please consider taking a break.`;

      const { error: ivErr } = await supabase.from("intervention_history").insert({
        player_id, casino_id,
        risk_profile_id:       profile?.id ?? null,
        intervention_type:     interventionType,
        trigger_reason:        `Risk engine (score ${finalScore}): ${factorLabels.join(", ") || "composite signal"}`,
        risk_score_at_trigger: finalScore,
        delivery_method:       "in_app",
        message_sent:          message,
        auto_triggered:        true,
        dispatch_status:       "pending",
        triggered_at:          new Date().toISOString(),
      });

      if (ivErr) console.error("[risk-engine] intervention insert:", ivErr.message);
    }

    return new Response(
      JSON.stringify({
        success:               true,
        risk_score:            finalScore,
        risk_level:            level,
        risk_factors:          factorLabels,
        confidence,
        recommended_action:    action,
        rationale,
        factor_breakdown: {
          loss_chasing:     lcResult.score,
          rapid_betting:    rbResult.score,
          session_duration: sdResult.score,
          deposit_spike:    dsResult.score,
          cross_operator:   coResult.score,
        },
        profile_id:            profile?.id ?? null,
        intervention_triggered: finalScore >= 70,
      }),
      { headers: { "Content-Type": "application/json" } },
    );

  } catch (err) {
    console.error("[risk-engine] unhandled error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
