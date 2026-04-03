import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ─── Idempotency ─────────────────────────────────────────────────────────────

/**
 * Try to claim a (casino_id, request_id) slot atomically.
 *
 * Returns:
 *   { claimed: true }                             — first time; caller must process
 *   { claimed: false, row: IngestRequest }        — duplicate; row has cached response (if completed)
 */
interface IngestRequest {
  id: string;
  status: "pending" | "completed" | "failed";
  response_status: number | null;
  response_body: string | null;
}

async function claimIdempotencySlot(
  supabase: ReturnType<typeof createClient>,
  casinoId: string,
  requestId: string,
  endpoint: string,
): Promise<{ claimed: true } | { claimed: false; row: IngestRequest }> {
  // Single atomic INSERT … ON CONFLICT DO NOTHING.
  // If the row already exists the insert silently no-ops and returns no rows.
  const { data: inserted, error: insertError } = await supabase
    .from("ingest_requests")
    .insert({ casino_id: casinoId, request_id: requestId, endpoint, status: "pending" })
    .select("id, status, response_status, response_body")
    .maybeSingle();

  if (insertError) {
    // 23505 = unique_violation — the race lost, treat as duplicate
    if (insertError.code === "23505") {
      const { data: existing } = await supabase
        .from("ingest_requests")
        .select("id, status, response_status, response_body")
        .eq("casino_id", casinoId)
        .eq("request_id", requestId)
        .maybeSingle();

      if (existing) return { claimed: false, row: existing as IngestRequest };
    }
    // Any other DB error: log and allow processing to continue rather than
    // blocking ingest entirely. The idempotency guarantee degrades gracefully.
    console.error("idempotency_claim_error", insertError);
    return { claimed: true };
  }

  if (!inserted) {
    // ON CONFLICT DO NOTHING fired — row exists
    const { data: existing } = await supabase
      .from("ingest_requests")
      .select("id, status, response_status, response_body")
      .eq("casino_id", casinoId)
      .eq("request_id", requestId)
      .maybeSingle();

    if (existing) return { claimed: false, row: existing as IngestRequest };
    // Row disappeared between ops (extremely unlikely) — allow processing
    return { claimed: true };
  }

  return { claimed: true };
}

/**
 * After processing completes, persist the response so replays return it verbatim.
 * Failures also update status so the caller can retry.
 */
async function finaliseIdempotencySlot(
  supabase: ReturnType<typeof createClient>,
  casinoId: string,
  requestId: string,
  responseStatus: number,
  responseBody: string,
  success: boolean,
): Promise<void> {
  await supabase
    .from("ingest_requests")
    .update({
      status: success ? "completed" : "failed",
      response_status: responseStatus,
      response_body: responseBody,
      completed_at: new Date().toISOString(),
    })
    .eq("casino_id", casinoId)
    .eq("request_id", requestId);
}

/**
 * Build the idempotent replay response for a duplicate completed request.
 * Pending/failed duplicates are retryable — we return 409 so the caller
 * knows not to discard the retry.
 */
function buildIdempotentResponse(row: IngestRequest): Response {
  if (row.status === "completed" && row.response_status && row.response_body) {
    // Return the exact original response, plus idempotency marker
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(row.response_body);
    } catch {
      body = { raw: row.response_body };
    }
    return new Response(
      JSON.stringify({ ...body, idempotent: true }),
      {
        status: row.response_status,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Idempotent-Replay": "true" },
      },
    );
  }

  if (row.status === "pending") {
    // Original request still in-flight (or crashed before completing).
    // Return 409 so the casino platform can back off and retry.
    return new Response(
      JSON.stringify({ error: "Request is still being processed. Retry after a short delay.", request_id: row.id }),
      { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // status === 'failed': allow the caller to resubmit
  // We do NOT return a cached failure — the caller should retry with the
  // same X-Request-ID and we will re-claim the slot.
  // (Failed rows are overwritten by a fresh insert when status = failed.)
  return new Response(
    JSON.stringify({ error: "Previous attempt failed. Resubmit to retry.", request_id: row.id }),
    { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function authenticateRequest(
  supabase: ReturnType<typeof createClient>,
  casinoId: string | null,
  apiKey: string | null
): Promise<{ valid: boolean; tokenId?: string; error?: string }> {
  if (!casinoId || !apiKey) {
    return { valid: false, error: "Missing X-Casino-ID or X-API-Key header" };
  }

  const keyHash = await sha256Hex(apiKey);

  const { data, error } = await supabase
    .from("api_tokens")
    .select("id, casino_id, is_active, expires_at, scopes")
    .eq("token_hash", keyHash)
    .eq("casino_id", casinoId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    await logSecurityEvent(supabase, {
      event_type: "api_auth_failed",
      severity: "medium",
      source: "api-ingest",
      ip_hash: null,
      resource: `casino:${casinoId}`,
      details: { reason: "invalid_token", casino_id: casinoId },
    });
    return { valid: false, error: "Invalid or disabled API key" };
  }

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { valid: false, error: "API key has expired" };
  }

  await supabase
    .from("api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return { valid: true, tokenId: data.id };
}

async function checkRateLimit(
  supabase: ReturnType<typeof createClient>,
  casinoId: string,
  endpoint: string
): Promise<{ allowed: boolean; remaining: number }> {
  const windowMinutes = 1;
  const maxRequests = 100;
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  try {
    const { data, error } = await supabase
      .from("api_rate_limits")
      .select("id, request_count, window_start")
      .eq("casino_id", casinoId)
      .eq("endpoint", endpoint)
      .gte("window_start", windowStart)
      .order("window_start", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return { allowed: true, remaining: maxRequests };

    if (!data) {
      await supabase.from("api_rate_limits").insert({
        casino_id: casinoId,
        endpoint,
        request_count: 1,
        window_start: new Date().toISOString(),
        window_minutes: windowMinutes,
      });
      return { allowed: true, remaining: maxRequests - 1 };
    }

    if (data.request_count >= maxRequests) {
      await logSecurityEvent(supabase, {
        event_type: "api_rate_limit",
        severity: "low",
        source: "api-ingest",
        ip_hash: null,
        resource: endpoint,
        details: { casino_id: casinoId, request_count: data.request_count, limit: maxRequests },
      });
      return { allowed: false, remaining: 0 };
    }

    await supabase
      .from("api_rate_limits")
      .update({ request_count: data.request_count + 1 })
      .eq("id", data.id);

    return { allowed: true, remaining: maxRequests - data.request_count - 1 };
  } catch (_err) {
    return { allowed: true, remaining: maxRequests };
  }
}

async function logSecurityEvent(
  supabase: ReturnType<typeof createClient>,
  event: {
    event_type: string;
    severity: string;
    source: string;
    ip_hash: string | null;
    resource: string | null;
    details: Record<string, unknown>;
    actor_email_hash?: string | null;
  }
): Promise<void> {
  try {
    await supabase.from("security_events").insert({
      event_type: event.event_type,
      severity: event.severity,
      source: event.source,
      ip_hash: event.ip_hash,
      resource: event.resource,
      details: event.details,
      actor_email_hash: event.actor_email_hash ?? null,
      resolved: false,
      created_at: new Date().toISOString(),
    });
  } catch (_err) {
    console.error("Failed to log security event:", _err);
  }
}

async function logAuditEvent(
  supabase: ReturnType<typeof createClient>,
  action: string,
  details: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.from("audit_logs").insert({
      action,
      details,
      created_at: new Date().toISOString(),
    });
  } catch (_err) {
    console.error("Failed to write audit log:", _err);
  }
}

async function handleSession(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  casinoId: string
): Promise<Response> {
  const { player_token, game_type, device_type, started_at, total_wagered, total_won, duration_seconds } = body;

  if (!player_token || !game_type || !device_type) {
    return jsonResponse({ error: "Missing required fields: player_token, game_type, device_type" }, 400);
  }

  const totalWageredNum = typeof total_wagered === "number" ? total_wagered : 0;
  const isFlagged = totalWageredNum > 5000;

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      player_token,
      casino_id: casinoId,
      game_type,
      device_type,
      started_at: started_at ?? new Date().toISOString(),
      total_wagered: total_wagered ?? null,
      total_won: total_won ?? null,
      duration_seconds: duration_seconds ?? null,
      is_flagged: isFlagged,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Session insert error:", error);
    return jsonResponse({ error: "Failed to record session" }, 500);
  }

  await logAuditEvent(supabase, "api_ingest_session", {
    player_token,
    casino_id: casinoId,
    game_type,
    device_type,
    is_flagged: isFlagged,
  });

  if (isFlagged) {
    await logSecurityEvent(supabase, {
      event_type: "suspicious_activity",
      severity: "medium",
      source: "api-ingest",
      ip_hash: null,
      resource: `session:${data.id}`,
      details: { reason: "high_value_session", player_token, casino_id: casinoId, total_wagered: totalWageredNum },
    });
  }

  return jsonResponse({ session_id: data.id, status: "recorded" });
}

async function handleBets(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  casinoId: string
): Promise<Response> {
  const { player_token, session_id, amount, game_type, bet_type } = body;

  if (!player_token || amount === undefined || !game_type) {
    return jsonResponse({ error: "Missing required fields: player_token, amount, game_type" }, 400);
  }

  const amountNum = typeof amount === "number" ? amount : parseFloat(String(amount));
  if (isNaN(amountNum)) {
    return jsonResponse({ error: "Invalid amount value" }, 400);
  }

  const riskFlag = amountNum > 2000;

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      player_token,
      casino_id: casinoId,
      session_id: session_id ?? null,
      amount: amountNum,
      game_type,
      bet_type: bet_type ?? null,
      transaction_type: "wager",
      risk_flag: riskFlag,
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("Bet insert error:", error);
    return jsonResponse({ error: "Failed to record bet" }, 500);
  }

  if (amountNum > 1000) {
    const { error: behaviorError } = await supabase.from("behaviour_events").insert({
      player_token,
      casino_id: casinoId,
      event_type: "high_value_bet",
      related_transaction_id: data.id,
      metadata: { amount: amountNum, game_type, bet_type: bet_type ?? null },
      created_at: new Date().toISOString(),
    });
    if (behaviorError) {
      console.error("Behaviour event insert error:", behaviorError);
    }
  }

  await logAuditEvent(supabase, "api_ingest_bets", {
    player_token,
    casino_id: casinoId,
    amount: amountNum,
    game_type,
    risk_flag: riskFlag,
  });

  return jsonResponse({ transaction_id: data.id, status: "recorded" });
}

async function handleDeposits(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  casinoId: string
): Promise<Response> {
  const { player_token, amount, payment_method } = body;

  if (!player_token || amount === undefined) {
    return jsonResponse({ error: "Missing required fields: player_token, amount" }, 400);
  }

  const amountNum = typeof amount === "number" ? amount : parseFloat(String(amount));
  if (isNaN(amountNum)) {
    return jsonResponse({ error: "Invalid amount value" }, 400);
  }

  const riskFlag = amountNum > 5000;
  const riskReason = riskFlag ? "Large deposit" : null;

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      player_token,
      casino_id: casinoId,
      amount: amountNum,
      payment_method: payment_method ?? null,
      transaction_type: "deposit",
      risk_flag: riskFlag,
      risk_reason: riskReason,
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("Deposit insert error:", error);
    return jsonResponse({ error: "Failed to record deposit" }, 500);
  }

  await logAuditEvent(supabase, "api_ingest_deposits", {
    player_token,
    casino_id: casinoId,
    amount: amountNum,
    payment_method: payment_method ?? null,
    risk_flag: riskFlag,
  });

  if (riskFlag) {
    await logSecurityEvent(supabase, {
      event_type: "suspicious_activity",
      severity: "medium",
      source: "api-ingest",
      ip_hash: null,
      resource: `transaction:${data.id}`,
      details: { reason: "large_deposit", player_token, casino_id: casinoId, amount: amountNum },
    });
  }

  return jsonResponse({ transaction_id: data.id, status: "recorded" });
}

async function handleWithdrawals(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  casinoId: string
): Promise<Response> {
  const { player_token, amount, payment_method } = body;

  if (!player_token || amount === undefined) {
    return jsonResponse({ error: "Missing required fields: player_token, amount" }, 400);
  }

  const amountNum = typeof amount === "number" ? amount : parseFloat(String(amount));
  if (isNaN(amountNum)) {
    return jsonResponse({ error: "Invalid amount value" }, 400);
  }

  const { data: exclusionData, error: exclusionError } = await supabase
    .from("self_exclusions")
    .select("id")
    .eq("player_token", player_token)
    .eq("casino_id", casinoId)
    .eq("is_active", true)
    .maybeSingle();

  if (exclusionError) {
    console.error("Self-exclusion check error:", exclusionError);
    return jsonResponse({ error: "Failed to check self-exclusion status" }, 500);
  }

  if (exclusionData) {
    await logSecurityEvent(supabase, {
      event_type: "permission_denied",
      severity: "high",
      source: "api-ingest",
      ip_hash: null,
      resource: "withdrawals",
      details: { reason: "self_excluded_player", player_token, casino_id: casinoId },
    });
    return jsonResponse({ error: "Player is self-excluded" }, 403);
  }

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      player_token,
      casino_id: casinoId,
      amount: amountNum,
      payment_method: payment_method ?? null,
      transaction_type: "withdrawal",
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("Withdrawal insert error:", error);
    return jsonResponse({ error: "Failed to record withdrawal" }, 500);
  }

  await logAuditEvent(supabase, "api_ingest_withdrawals", {
    player_token,
    casino_id: casinoId,
    amount: amountNum,
    payment_method: payment_method ?? null,
  });

  return jsonResponse({ transaction_id: data.id, status: "recorded" });
}

async function handleSelfExclusion(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>,
  casinoId: string
): Promise<Response> {
  const { player_token, exclusion_type, duration_type, duration_days, reason } = body;

  if (!player_token) {
    return jsonResponse({ error: "Missing required field: player_token" }, 400);
  }

  const { data: playerData, error: playerError } = await supabase
    .from("players")
    .select("id")
    .eq("player_token", player_token)
    .eq("casino_id", casinoId)
    .maybeSingle();

  if (playerError) {
    console.error("Player lookup error:", playerError);
    return jsonResponse({ error: "Failed to look up player" }, 500);
  }

  const playerId = playerData?.id ?? null;

  const { data: exclusionData, error: exclusionError } = await supabase
    .from("self_exclusions")
    .insert({
      player_token,
      casino_id: casinoId,
      player_id: playerId,
      exclusion_type: exclusion_type ?? "self",
      duration_type: duration_type ?? "indefinite",
      duration_days: duration_days ?? null,
      reason: reason ?? null,
      is_active: true,
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (exclusionError) {
    console.error("Self-exclusion insert error:", exclusionError);
    return jsonResponse({ error: "Failed to record self-exclusion" }, 500);
  }

  try {
    const { error: senError } = await supabase.from("sen_exclusion_events").insert({
      exclusion_id: exclusionData.id,
      player_token,
      casino_id: casinoId,
      event_type: exclusion_type ?? "self",
      created_at: new Date().toISOString(),
    });
    if (senError) {
      console.warn("sen_exclusion_events insert skipped or failed:", senError.message);
    }
  } catch (_err) {
    console.warn("sen_exclusion_events table may not exist, skipping:", _err);
  }

  if (playerId) {
    const { error: updateError } = await supabase
      .from("players")
      .update({ status: "self_excluded", updated_at: new Date().toISOString() })
      .eq("id", playerId);
    if (updateError) {
      console.error("Player status update error:", updateError);
    }
  }

  await logSecurityEvent(supabase, {
    event_type: "self_exclusion",
    severity: "info",
    source: "api-ingest",
    ip_hash: null,
    resource: `exclusion:${exclusionData.id}`,
    details: {
      player_token,
      casino_id: casinoId,
      exclusion_type: exclusion_type ?? "self",
      duration_type: duration_type ?? "indefinite",
    },
  });

  await logAuditEvent(supabase, "api_ingest_self-exclusion", {
    player_token,
    casino_id: casinoId,
    exclusion_type: exclusion_type ?? "self",
    duration_type: duration_type ?? "indefinite",
    duration_days: duration_days ?? null,
  });

  return jsonResponse({ exclusion_id: exclusionData.id, status: "recorded", player_token });
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    const url = new URL(req.url);
    const pathname = url.pathname;

    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
      return jsonResponse({ error: "Server configuration error" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const casinoId = req.headers.get("X-Casino-ID");
    const apiKey = req.headers.get("X-API-Key");

    const auth = await authenticateRequest(supabase, casinoId, apiKey);
    if (!auth.valid) {
      return jsonResponse({ error: auth.error ?? "Unauthorized" }, 401);
    }

    const endpoint = pathname.replace("/api-ingest/", "");
    const rateCheck = await checkRateLimit(supabase, casinoId!, endpoint);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Max 100 requests/minute per casino." }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "X-RateLimit-Remaining": "0",
            "Retry-After": "60",
          },
        }
      );
    }

    // ── Idempotency check ─────────────────────────────────────────────────────
    // X-Request-ID is required on all mutating requests.
    // A missing header is a client error — we reject rather than silently skip
    // idempotency, preventing accidental duplicate ingestion on misconfigured clients.
    const requestId = req.headers.get("X-Request-ID");
    if (!requestId) {
      return jsonResponse(
        { error: "Missing required header: X-Request-ID. Each request must carry a unique idempotency key." },
        400,
      );
    }
    if (requestId.length > 128) {
      return jsonResponse({ error: "X-Request-ID must be ≤ 128 characters." }, 400);
    }

    const idempotency = await claimIdempotencySlot(supabase, casinoId!, requestId, endpoint);

    if (!idempotency.claimed) {
      // Duplicate or in-flight request — return the appropriate idempotent response
      return buildIdempotentResponse(idempotency.row);
    }
    // ── End idempotency check ─────────────────────────────────────────────────

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch (_err) {
      // Malformed JSON: mark slot as failed so the casino can resubmit
      await finaliseIdempotencySlot(supabase, casinoId!, requestId, 400, JSON.stringify({ error: "Invalid or missing JSON body" }), false);
      return jsonResponse({ error: "Invalid or missing JSON body" }, 400);
    }

    const responseHeaders = {
      ...corsHeaders,
      "Content-Type": "application/json",
      "X-RateLimit-Remaining": String(rateCheck.remaining),
    };

    let result: Response;

    if (pathname === "/api-ingest/session") {
      result = await handleSession(supabase, body, casinoId!);
    } else if (pathname === "/api-ingest/bets") {
      result = await handleBets(supabase, body, casinoId!);
    } else if (pathname === "/api-ingest/deposits") {
      result = await handleDeposits(supabase, body, casinoId!);
    } else if (pathname === "/api-ingest/withdrawals") {
      result = await handleWithdrawals(supabase, body, casinoId!);
    } else if (pathname === "/api-ingest/self-exclusion") {
      result = await handleSelfExclusion(supabase, body, casinoId!);
    } else {
      await finaliseIdempotencySlot(supabase, casinoId!, requestId, 404, JSON.stringify({ error: "Route not found" }), false);
      return jsonResponse({ error: "Route not found" }, 404);
    }

    // Persist the response so replays can return it verbatim
    const resultBody = await result.text();
    const success = result.status >= 200 && result.status < 300;
    await finaliseIdempotencySlot(supabase, casinoId!, requestId, result.status, resultBody, success);

    return new Response(resultBody, {
      status: result.status,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error("Unhandled error in api-ingest function:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
