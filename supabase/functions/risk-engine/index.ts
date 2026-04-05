import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
  score: number;   // contribution to final risk score
  label: string;   // machine-readable flag name
  detail: string;  // human-readable explanation
}

// ── Factor A: Loss Chasing (0–30 pts) ────────────────────────────────────────
// Consecutive losses + escalating bet size = highest-weight signal

function scoreLossChasing(
  recentBets: { bet_amount: number; outcome: string | null }[],
): FactorResult {
  const label = "loss_chasing";
  if (recentBets.length < 2) return { score: 0, label, detail: "insufficient history" };

  // Count consecutive losses from most recent backwards
  let consecutive = 0;
  for (const bet of recentBets) {
    if (bet.outcome === "loss") consecutive++;
    else break;
  }

  // Check whether bets are escalating within the losing streak (10% tolerance)
  const streak = recentBets.slice(0, Math.max(consecutive, 0));
  const escalating =
    streak.length >= 2 &&
    streak.every((b, i) => i === 0 || Number(b.bet_amount) >= Number(streak[i - 1].bet_amount) * 0.90);

  if (consecutive >= 3 && escalating) {
    const score = Math.min(30, 15 + (consecutive - 3) * 3); // 15 → 30 as streak grows
    return { score, label, detail: `${consecutive} consecutive losses with escalating bets (+${score}pts)` };
  }
  if (consecutive >= 3) return { score: 10, label, detail: `${consecutive} consecutive losses` };
  if (consecutive >= 2) return { score: 4, label, detail: `${consecutive} consecutive losses` };
  return { score: 0, label, detail: "no consecutive loss pattern" };
}

// ── Factor B: Rapid Betting (0–20 pts) ───────────────────────────────────────
// > 10 bets in a 2-minute window signals impulsive control loss

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
// Compares today's deposit total against the player's 30-day daily average

function scoreDepositSpike(deposits24h: number, avgDailyDeposit: number): FactorResult {
  const label = "deposit_spike";

  if (avgDailyDeposit > 0) {
    const ratio = deposits24h / avgDailyDeposit;
    if (ratio >= 3) return { score: 20, label, detail: `Today R${deposits24h.toFixed(0)} is ${ratio.toFixed(1)}× daily avg` };
    if (ratio >= 2) return { score: 15, label, detail: `Today R${deposits24h.toFixed(0)} is ${ratio.toFixed(1)}× daily avg` };
    if (ratio >= 1.5) return { score: 8, label, detail: `Today R${deposits24h.toFixed(0)} is ${ratio.toFixed(1)}× daily avg` };
  }

  // No history — flag large absolute deposits
  if (deposits24h > 10_000) return { score: 20, label, detail: `Large deposit today: R${deposits24h.toFixed(0)} (no baseline)` };
  if (deposits24h > 5_000)  return { score: 10, label, detail: `Elevated deposit today: R${deposits24h.toFixed(0)}` };
  return { score: 0, label, detail: "deposit volume normal" };
}

// ── Factor E: Cross-Operator (0–25 pts) ──────────────────────────────────────
// Carries forward cross-operator intelligence already computed by the
// cross-operator-intelligence function; boosts if active SEN exclusion exists

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

// ── Level and action mapping ──────────────────────────────────────────────────

function mapLevel(score: number): "low" | "moderate" | "high" | "critical" {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 30) return "moderate";
  return "low";
}

function mapAction(level: string): string {
  const map: Record<string, string> = {
    critical: "block",
    high: "intervene",
    moderate: "notify",
    low: "monitor",
  };
  return map[level] ?? "monitor";
}

// ── Confidence ────────────────────────────────────────────────────────────────
// Grows with data richness and number of fired signals

function computeConfidence(dataPoints: number, signalCount: number): number {
  const base      = 0.50;
  const dataBonus = Math.min(dataPoints / 200, 0.25); // +0–0.25 from data volume
  const sigBonus  = Math.min(signalCount * 0.08, 0.22); // +0.08 per active signal
  return parseFloat(Math.min(0.97, base + dataBonus + sigBonus).toFixed(2));
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST required" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const event: EventPayload = await req.json();
    const { player_id, casino_id, bet_amount, win_amount, duration_seconds, created_at, session_id } = event;

    if (!player_id || !casino_id) {
      return new Response(JSON.stringify({ error: "player_id and casino_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Gather behavioral context (all in parallel) ───────────────────────────

    const windowStart24h  = new Date(new Date(created_at).getTime() - 24 * 60 * 60 * 1000).toISOString();
    const windowStart30d  = new Date(new Date(created_at).getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [recentBetsRes, deposits24hRes, historicDepositsRes, prevProfileRes, senRes] = await Promise.all([
      // Last 25 BET_PLACED events — window for loss-chasing + rapid-betting analysis
      supabase
        .from("live_events")
        .select("bet_amount, win_amount, outcome, created_at")
        .eq("player_id", player_id)
        .eq("casino_id", casino_id)
        .eq("event_type", "BET_PLACED")
        .order("created_at", { ascending: false })
        .limit(25),

      // Deposit events in last 24h (for spike detection)
      supabase
        .from("live_events")
        .select("bet_amount")
        .eq("player_id", player_id)
        .eq("event_type", "DEPOSIT")
        .gte("created_at", windowStart24h),

      // 30-day deposit history (for daily average baseline)
      supabase
        .from("live_events")
        .select("bet_amount")
        .eq("player_id", player_id)
        .eq("event_type", "DEPOSIT")
        .gte("created_at", windowStart30d),

      // Most recent risk profile (carry-forward cross-operator score)
      supabase
        .from("behavioral_risk_profiles")
        .select("risk_score, cross_operator_score, score_delta")
        .eq("player_id", player_id)
        .order("analyzed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),

      // Active SEN self-exclusion (cross-operator signal — no FK risk, text match on player_id)
      supabase
        .from("sen_exclusion_events")
        .select("id")
        .eq("player_id", player_id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle(),
    ]);

    const recentBets        = recentBetsRes.data ?? [];
    const deposits24h       = (deposits24hRes.data ?? []).reduce((s: number, d: { bet_amount: string }) => s + Number(d.bet_amount), 0);
    const historicDeposits  = historicDepositsRes.data ?? [];
    const avgDailyDeposit   = historicDeposits.length > 0
      ? historicDeposits.reduce((s: number, d: { bet_amount: string }) => s + Number(d.bet_amount), 0) / 30
      : 0;
    const prevProfile       = prevProfileRes.data;
    const existingCrossOp   = Number(prevProfile?.cross_operator_score ?? 0);
    const senActive         = senRes.data != null;

    // ── Score each factor independently ──────────────────────────────────────

    const lcResult = scoreLossChasing(recentBets);
    const rbResult = scoreRapidBetting(recentBets, created_at);
    const sdResult = scoreSessionDuration(duration_seconds);
    const dsResult = scoreDepositSpike(deposits24h, avgDailyDeposit);
    const coResult = scoreCrossOperator(existingCrossOp, senActive);

    const factors = [lcResult, rbResult, sdResult, dsResult, coResult];

    const finalScore = Math.min(100, factors.reduce((s, f) => s + f.score, 0));
    const level      = mapLevel(finalScore);
    const action     = mapAction(level);

    const activeFactors = factors.filter((f) => f.score > 0);
    const factorLabels  = activeFactors.map((f) => f.label);
    const factorDetails = activeFactors.map((f) => f.detail);

    const confidence = computeConfidence(
      recentBets.length + historicDeposits.length,
      activeFactors.length,
    );

    const rationale =
      level === "critical" ? `Critical behavioural risk: ${factorDetails.join("; ") || "multiple concurrent signals"}. Immediate intervention required.`
      : level === "high"   ? `High risk: ${factorDetails.join("; ") || "elevated signals"}. Intervention advised.`
      : level === "moderate" ? `Moderate risk: ${factorDetails.join("; ") || "emerging patterns — monitor closely"}.`
      : "Behavioural patterns within normal parameters.";

    // ── Compute bet velocity for storage ─────────────────────────────────────
    // bets per minute over the last 2-minute window (stored as betting_velocity)
    const cutoff2Min = new Date(new Date(created_at).getTime() - 2 * 60 * 1000).getTime();
    const betsIn2Min = recentBets.filter((b) => new Date(b.created_at).getTime() >= cutoff2Min).length;
    const bettingVelocity = parseFloat((betsIn2Min / 2).toFixed(1)); // bets/min

    // ── Persist to behavioral_risk_profiles ──────────────────────────────────

    const previousScore = prevProfile?.risk_score ?? finalScore;

    const { data: profile, error: profileErr } = await supabase
      .from("behavioral_risk_profiles")
      .insert({
        player_id,
        session_id: session_id ?? null,
        casino_id,
        risk_score:               finalScore,
        risk_level:               level,
        impulse_level:            lcResult.score,        // loss-chasing intensity as impulse proxy
        betting_velocity:         bettingVelocity,
        session_duration_minutes: Math.round(duration_seconds / 60),
        loss_escalation_score:    lcResult.score,
        session_duration_score:   sdResult.score,
        deposit_frequency_score:  dsResult.score,
        bet_intensity_score:      rbResult.score,        // rapid betting as intensity proxy
        cross_operator_score:     coResult.score,
        risk_rationale:           rationale,
        previous_risk_score:      previousScore,
        score_delta:              finalScore - previousScore,
        intervention_triggered:   finalScore >= 70,
        signal_weights: {
          loss_chasing:     0.30,
          rapid_betting:    0.20,
          session_duration: 0.20,
          deposit_spike:    0.20,
          cross_operator:   0.25,
        },
        analyzed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (profileErr) {
      // Non-fatal — log and continue; score is still returned
      console.error("[risk-engine] behavioral_risk_profiles insert:", profileErr.message);
    }

    // ── Intervention trigger (score ≥ 70) ────────────────────────────────────

    if (finalScore >= 70) {
      const interventionType = finalScore >= 80 ? "contact_support" : "break_suggestion";
      const message = finalScore >= 80
        ? `CRITICAL — Risk score ${finalScore}: ${rationale} Immediate operator review required.`
        : `Responsible gambling alert: Your session has triggered a risk review (score ${finalScore}). Please consider taking a break.`;

      const { error: ivErr } = await supabase
        .from("intervention_history")
        .insert({
          player_id,
          casino_id,
          risk_profile_id:      profile?.id ?? null,
          intervention_type:    interventionType,
          trigger_reason:       `Risk engine (score ${finalScore}): ${factorLabels.join(", ") || "composite signal"}`,
          risk_score_at_trigger: finalScore,
          delivery_method:      "in_app",
          message_sent:         message,
          auto_triggered:       true,
          dispatch_status:      "pending",
          triggered_at:         new Date().toISOString(),
        });

      if (ivErr) {
        console.error("[risk-engine] intervention_history insert:", ivErr.message);
      }
    }

    // ── Response ─────────────────────────────────────────────────────────────

    return new Response(
      JSON.stringify({
        success:              true,
        risk_score:           finalScore,
        risk_level:           level,
        risk_factors:         factorLabels,
        confidence,
        recommended_action:   action,
        rationale,
        factor_breakdown: {
          loss_chasing:     lcResult.score,
          rapid_betting:    rbResult.score,
          session_duration: sdResult.score,
          deposit_spike:    dsResult.score,
          cross_operator:   coResult.score,
        },
        profile_id: profile?.id ?? null,
        intervention_triggered: finalScore >= 70,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err) {
    console.error("[risk-engine] unhandled error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
