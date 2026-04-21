import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// ══════════════════════════════════════════════════════════════════════════════
// SafeBet IQ — Risk Engine Edge Function
// INTERNAL ONLY — not accessible from browser or external callers.
//
// Security layers:
//   1. HMAC-SHA256 dual-key verification (active + previous for rotation window)
//   2. Timestamp replay protection (±5 min window)
//   3. Distributed DB-backed rate limiting (cross-instance, atomic)
//   4. In-memory pre-filter (fast-path reject before DB round-trip)
//   5. Constant-time signature comparison (no timing oracle)
//   6. Minimal service-role surface (explicit columns, bounded queries, no *)
// ══════════════════════════════════════════════════════════════════════════════

const MAX_TIMESTAMP_DRIFT_MS  = 5 * 60 * 1000;
const IP_HARD_LIMIT           = 60;   // distributed limit: 60 req/min/IP
const IP_PREFILTER_LIMIT      = 120;  // in-memory pre-filter (2× — catches obvious floods before DB)
const IP_PREFILTER_WINDOW_MS  = 60 * 1000;
const IP_MAP_MAX_SIZE         = 10_000;

// ── In-memory pre-filter (fast-path flood protection before DB round-trip) ────
// This is intentionally generous — the DB-backed check is authoritative.
// Purpose: reject obvious bot floods without incurring a DB call per request.
const ipPrefilterMap = new Map<string, number[]>();

function prefilterIp(ip: string): boolean {
  const now  = Date.now();
  const hits = (ipPrefilterMap.get(ip) ?? []).filter((t) => now - t < IP_PREFILTER_WINDOW_MS);
  hits.push(now);
  ipPrefilterMap.set(ip, hits);
  if (ipPrefilterMap.size > IP_MAP_MAX_SIZE) {
    const cutoff = now - IP_PREFILTER_WINDOW_MS;
    for (const [k, v] of ipPrefilterMap) {
      if (v.at(-1)! < cutoff) ipPrefilterMap.delete(k);
    }
  }
  return hits.length <= IP_PREFILTER_LIMIT;
}

// ── Distributed rate limit check (DB-backed — cross-instance authoritative) ──
interface RateLimitResult { allowed: boolean; count: number; limit: number; }

async function checkDistributedRateLimit(
  supabase: ReturnType<typeof createClient>,
  ip: string,
): Promise<RateLimitResult> {
  try {
    const key = `risk-engine:ip:${ip}`;
    const { data, error } = await supabase.rpc("check_distributed_rate_limit", {
      p_key:            key,
      p_limit:          IP_HARD_LIMIT,
      p_window_seconds: 60,
    });
    if (error) throw error;
    return data as RateLimitResult;
  } catch (err) {
    // Fail open — never block legitimate traffic on rate-limit DB failure
    console.warn("[risk-engine] distributed rate limit check failed — failing open", {
      error: String(err),
    });
    return { allowed: true, count: 0, limit: IP_HARD_LIMIT };
  }
}

// ── FIX 1: Constant-time hex comparison (prevents timing-oracle attacks) ─────
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

async function computeHmac(rawBody: string, timestamp: string, secret: string): Promise<string> {
  const message = `${timestamp}.${rawBody}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false, ["sign"],
  );
  const sigBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(sigBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── FIX 3: Dual-secret HMAC verification (supports rotation window) ───────────
// Tries the active secret first. Falls back to the previous secret if active
// fails — this covers the window between DB rotation and Edge Function update.
// Logs a structured warning if the previous secret is used so rotation
// completion can be monitored.
async function verifySignature(
  rawBody:   string,
  timestamp: string,
  signature: string,
  active:    string,
  previous:  string | undefined,
): Promise<{ valid: boolean; usedPrevious: boolean }> {
  const activeHmac = await computeHmac(rawBody, timestamp, active);
  if (secureCompare(activeHmac, signature)) {
    return { valid: true, usedPrevious: false };
  }
  if (previous) {
    const prevHmac = await computeHmac(rawBody, timestamp, previous);
    if (secureCompare(prevHmac, signature)) {
      return { valid: true, usedPrevious: true };
    }
  }
  return { valid: false, usedPrevious: false };
}

// ── Payload type ──────────────────────────────────────────────────────────────
interface EventPayload {
  player_id:        string;
  casino_id:        string;
  event_id?:        string;
  bet_amount:       number;
  win_amount:       number;
  duration_seconds: number;
  event_type:       string;
  session_id?:      string | null;
  game_type?:       string | null;
  created_at:       string;
}

interface FactorResult { score: number; label: string; detail: string; }

// ── Risk scoring factors ──────────────────────────────────────────────────────

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
  const streak = recentBets.slice(0, consecutive);
  const escalating = streak.length >= 2 &&
    streak.every((b, i) => i === 0 || Number(b.bet_amount) >= Number(streak[i - 1].bet_amount) * 0.90);
  if (consecutive >= 3 && escalating) {
    const score = Math.min(30, 15 + (consecutive - 3) * 3);
    return { score, label, detail: `${consecutive} consecutive losses with escalating bets` };
  }
  if (consecutive >= 3) return { score: 10, label, detail: `${consecutive} consecutive losses` };
  if (consecutive >= 2) return { score: 4,  label, detail: `${consecutive} consecutive losses` };
  return { score: 0, label, detail: "no consecutive loss pattern" };
}

function scoreRapidBetting(recentBets: { created_at: string }[], eventTime: string): FactorResult {
  const label  = "rapid_betting";
  const cutoff = new Date(eventTime).getTime() - 2 * 60 * 1000;
  const count  = recentBets.filter((b) => new Date(b.created_at).getTime() >= cutoff).length;
  if (count > 20) return { score: 20, label, detail: `${count} bets in 2 min (critical velocity)` };
  if (count > 15) return { score: 15, label, detail: `${count} bets in 2 min` };
  if (count > 10) return { score: 10, label, detail: `${count} bets in 2 min` };
  if (count > 6)  return { score: 5,  label, detail: `${count} bets in 2 min` };
  return { score: 0, label, detail: `${count} bets in 2 min — normal` };
}

function scoreSessionDuration(durationSeconds: number): FactorResult {
  const label = "session_duration";
  const mins  = Math.round(durationSeconds / 60);
  if (durationSeconds > 90 * 60) return { score: 20, label, detail: `${mins}min session (>90min)` };
  if (durationSeconds > 45 * 60) return { score: 10, label, detail: `${mins}min session (>45min)` };
  return { score: 0, label, detail: `${mins}min — normal` };
}

function scoreDepositSpike(deposits24h: number, avgDailyDeposit: number): FactorResult {
  const label = "deposit_spike";
  if (avgDailyDeposit > 0) {
    const ratio = deposits24h / avgDailyDeposit;
    if (ratio >= 3)   return { score: 20, label, detail: `R${deposits24h.toFixed(0)} is ${ratio.toFixed(1)}× daily avg` };
    if (ratio >= 2)   return { score: 15, label, detail: `R${deposits24h.toFixed(0)} is ${ratio.toFixed(1)}× daily avg` };
    if (ratio >= 1.5) return { score: 8,  label, detail: `R${deposits24h.toFixed(0)} is ${ratio.toFixed(1)}× daily avg` };
  }
  if (deposits24h > 10_000) return { score: 20, label, detail: `Large deposit: R${deposits24h.toFixed(0)}` };
  if (deposits24h > 5_000)  return { score: 10, label, detail: `Elevated deposit: R${deposits24h.toFixed(0)}` };
  return { score: 0, label, detail: "deposit volume normal" };
}

function scoreCrossOperator(crossOpScore: number, senActive: boolean): FactorResult {
  const label = "cross_operator";
  if (senActive)          return { score: 25, label, detail: "Active under SEN self-exclusion" };
  if (crossOpScore >= 60) return { score: 15, label, detail: `Cross-operator flag (score: ${crossOpScore})` };
  if (crossOpScore > 0)   return { score: Math.round(crossOpScore * 0.25), label, detail: `Cross-operator activity (score: ${crossOpScore})` };
  return { score: 0, label, detail: "no cross-operator signals" };
}

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
  return parseFloat(Math.min(0.97, 0.50 + Math.min(dataPoints / 200, 0.25) + Math.min(signalCount * 0.08, 0.22)).toFixed(2));
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Internal endpoint — no CORS, no browser access
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { "Content-Type": "application/json" },
    });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";

  // ── Layer 1: In-memory pre-filter (fast-path flood rejection) ─────────────
  if (!prefilterIp(ip)) {
    console.error("[risk-engine] ABUSE: pre-filter threshold exceeded", { ip });
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429, headers: { "Content-Type": "application/json", "Retry-After": "60" },
    });
  }

  // ── Layer 2: Signature header presence (cheap check before any DB work) ───
  const timestamp = req.headers.get("x-timestamp");
  const signature = req.headers.get("x-signature");

  if (!timestamp || !signature) {
    console.error("[risk-engine] SECURITY: missing auth headers", {
      ip,
      hasTimestamp: !!timestamp,
      hasSignature: !!signature,
    });
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  // Replay attack protection
  const requestTimeMs = parseInt(timestamp, 10) * 1000;
  const driftMs       = Math.abs(Date.now() - requestTimeMs);
  if (isNaN(requestTimeMs) || driftMs > MAX_TIMESTAMP_DRIFT_MS) {
    console.error("[risk-engine] SECURITY: timestamp out of window", {
      ip,
      driftMs,
      maxAllowed: MAX_TIMESTAMP_DRIFT_MS,
    });
    return new Response(JSON.stringify({ error: "Request expired" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  // Read raw body before any parsing — signature is computed over raw bytes
  const rawBody = await req.text();

  // ── Layer 3: HMAC dual-secret verification ────────────────────────────────
  const activeSecret   = Deno.env.get("RISK_ENGINE_HMAC_SECRET");
  const previousSecret = Deno.env.get("RISK_ENGINE_HMAC_SECRET_PREV");

  if (!activeSecret) {
    console.error("[risk-engine] RISK_ENGINE_HMAC_SECRET not configured");
    return new Response(JSON.stringify({ error: "Internal configuration error" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  const { valid, usedPrevious } = await verifySignature(
    rawBody, timestamp, signature, activeSecret, previousSecret ?? undefined,
  );

  if (!valid) {
    console.error("[risk-engine] SECURITY: invalid HMAC signature", { ip, timestamp });
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  if (usedPrevious) {
    console.warn("[risk-engine] ROTATION: previous secret used — complete Edge Function secret update now", {
      ts: new Date().toISOString(),
    });
  }

  // ── FIX 4: Minimal service-role client — created once, reused below ───────
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // ── Layer 4: Distributed IP rate limit (authoritative, cross-instance) ────
  const rl = await checkDistributedRateLimit(supabase, ip);
  if (!rl.allowed) {
    console.error("[risk-engine] ABUSE: distributed rate limit exceeded", {
      ip, count: rl.count, limit: rl.limit,
    });
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429, headers: { "Content-Type": "application/json", "Retry-After": "60" },
    });
  }
  if (rl.count > rl.limit * 0.75) {
    console.warn("[risk-engine] SUSPICIOUS: IP approaching distributed limit", { ip, count: rl.count });
  }

  // ── Parse payload ─────────────────────────────────────────────────────────
  let event: EventPayload;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const { player_id, casino_id, bet_amount, win_amount, duration_seconds, created_at, session_id } = event;

  if (!player_id || !casino_id) {
    return new Response(JSON.stringify({ error: "player_id and casino_id required" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const windowStart24h = new Date(new Date(created_at).getTime() - 86_400_000).toISOString();
    const windowStart30d = new Date(new Date(created_at).getTime() - 2_592_000_000).toISOString();

    // FIX 4: All queries use explicit columns, casino_id + player_id scope, hard limits
    const [recentBetsRes, deposits24hRes, historicDepositsRes, prevProfileRes, senRes] = await Promise.all([
      supabase
        .from("live_events")
        // Explicit columns only — no wildcard
        .select("bet_amount, outcome, created_at")
        .eq("player_id", player_id)
        .eq("casino_id", casino_id)       // FIX 4: casino scope enforced
        .eq("event_type", "BET_PLACED")
        .order("created_at", { ascending: false })
        .limit(25),                        // FIX 4: hard limit

      supabase
        .from("live_events")
        .select("bet_amount")
        .eq("player_id", player_id)
        .eq("casino_id", casino_id)
        .eq("event_type", "DEPOSIT")
        .gte("created_at", windowStart24h)
        .limit(100),

      supabase
        .from("live_events")
        .select("bet_amount")
        .eq("player_id", player_id)
        .eq("casino_id", casino_id)
        .eq("event_type", "DEPOSIT")
        .gte("created_at", windowStart30d)
        .limit(200),

      supabase
        .from("behavioral_risk_profiles")
        // Explicit minimal columns — no wildcard
        .select("risk_score, cross_operator_score")
        .eq("player_id", player_id)
        .eq("casino_id", casino_id)       // FIX 4: casino scope enforced
        .order("analyzed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),

      supabase
        .from("sen_exclusion_events")
        .select("id")                     // existence check only — minimal data
        .eq("player_id", player_id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle(),
    ]);

    const recentBets      = recentBetsRes.data      ?? [];
    const deposits24h     = (deposits24hRes.data    ?? []).reduce((s: number, d: { bet_amount: string }) => s + Number(d.bet_amount), 0);
    const historicDeps    = historicDepositsRes.data ?? [];
    const avgDailyDeposit = historicDeps.length > 0
      ? historicDeps.reduce((s: number, d: { bet_amount: string }) => s + Number(d.bet_amount), 0) / 30
      : 0;
    const prevProfile  = prevProfileRes.data;
    const crossOpScore = Number(prevProfile?.cross_operator_score ?? 0);
    const senActive    = senRes.data != null;

    // ── Score factors ───────────────────────────────────────────────────────
    const lcResult = scoreLossChasing(recentBets);
    const rbResult = scoreRapidBetting(recentBets, created_at);
    const sdResult = scoreSessionDuration(duration_seconds);
    const dsResult = scoreDepositSpike(deposits24h, avgDailyDeposit);
    const coResult = scoreCrossOperator(crossOpScore, senActive);

    const factors      = [lcResult, rbResult, sdResult, dsResult, coResult];
    const finalScore   = Math.min(100, factors.reduce((s, f) => s + f.score, 0));
    const level        = mapLevel(finalScore);
    const action       = mapAction(level);
    const activeFactors = factors.filter((f) => f.score > 0);
    const factorLabels  = activeFactors.map((f) => f.label);
    const factorDetails = activeFactors.map((f) => f.detail);
    const confidence    = computeConfidence(recentBets.length + historicDeps.length, activeFactors.length);

    const rationale =
      level === "critical"   ? `Critical: ${factorDetails.join("; ") || "multiple concurrent signals"}. Immediate intervention required.`
      : level === "high"     ? `High risk: ${factorDetails.join("; ") || "elevated signals"}. Intervention advised.`
      : level === "moderate" ? `Moderate: ${factorDetails.join("; ") || "emerging patterns"}.`
      : "Patterns within normal parameters.";

    const cutoff2Min      = new Date(new Date(created_at).getTime() - 120_000).getTime();
    const bettingVelocity = parseFloat(
      (recentBets.filter((b) => new Date(b.created_at).getTime() >= cutoff2Min).length / 2).toFixed(1),
    );
    const previousScore = prevProfile?.risk_score ?? finalScore;

    // ── Persist — explicit columns, no wildcard inserts ──────────────────────
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
        signal_weights:           { loss_chasing: 0.30, rapid_betting: 0.20, session_duration: 0.20, deposit_spike: 0.20, cross_operator: 0.25 },
        analyzed_at:              new Date().toISOString(),
      })
      .select("id")   // minimal return — only need the ID
      .single();

    if (profileErr) {
      // Log error code + message — never the full row data
      console.error("[risk-engine] profile insert failed", { code: profileErr.code, message: profileErr.message });
    }

    // ── Intervention (score ≥ 70) ─────────────────────────────────────────────
    if (finalScore >= 70) {
      const interventionType = finalScore >= 80 ? "contact_support" : "break_suggestion";
      const message = finalScore >= 80
        ? `CRITICAL — Risk score ${finalScore}: ${rationale} Immediate operator review required.`
        : `Responsible gambling alert: Session risk review triggered (score ${finalScore}). Please consider a break.`;

      const { error: ivErr } = await supabase.from("intervention_history").insert({
        player_id, casino_id,
        risk_profile_id:       profile?.id ?? null,
        intervention_type:     interventionType,
        trigger_reason:        `Risk engine score ${finalScore}: ${factorLabels.join(", ") || "composite"}`,
        risk_score_at_trigger: finalScore,
        delivery_method:       "in_app",
        message_sent:          message,
        auto_triggered:        true,
        dispatch_status:       "pending",
        triggered_at:          new Date().toISOString(),
      });

      if (ivErr) {
        console.error("[risk-engine] intervention insert failed", { code: ivErr.code, message: ivErr.message });
      }
    }

    return new Response(
      JSON.stringify({
        success:                true,
        risk_score:             finalScore,
        risk_level:             level,
        risk_factors:           factorLabels,
        confidence,
        recommended_action:     action,
        rationale,
        factor_breakdown:       { loss_chasing: lcResult.score, rapid_betting: rbResult.score, session_duration: sdResult.score, deposit_spike: dsResult.score, cross_operator: coResult.score },
        profile_id:             profile?.id ?? null,
        intervention_triggered: finalScore >= 70,
      }),
      { headers: { "Content-Type": "application/json" } },
    );

  } catch (err) {
    // Never expose error internals — structured error code only
    const errorId = crypto.randomUUID();
    console.error("[risk-engine] unhandled error", { errorId, message: String(err) });
    return new Response(
      JSON.stringify({ error: "Internal server error", ref: errorId }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
