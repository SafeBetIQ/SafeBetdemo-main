import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function authenticateRequest(
  supabase: ReturnType<typeof createClient>,
  casinoId: string | null,
  apiKey: string | null
): Promise<{ valid: boolean; error?: string }> {
  if (!casinoId || !apiKey) {
    return { valid: false, error: "Missing X-Casino-ID or X-API-Key header" };
  }

  const { data, error } = await supabase
    .from("casino_integration_configs")
    .select("id")
    .eq("casino_id", casinoId)
    .eq("is_enabled", true)
    .filter("credentials->>'api_key'", "eq", apiKey)
    .maybeSingle();

  if (error || !data) {
    return { valid: false, error: "Invalid or disabled API key" };
  }

  return { valid: true };
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

  // Check for active self-exclusion
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
  const {
    player_token,
    exclusion_type,
    duration_type,
    duration_days,
    reason,
  } = body;

  if (!player_token) {
    return jsonResponse({ error: "Missing required field: player_token" }, 400);
  }

  // Look up player by player_token and casino_id
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

  // Insert into self_exclusions
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

  // Attempt to insert into sen_exclusion_events if the table exists
  try {
    const { error: senError } = await supabase.from("sen_exclusion_events").insert({
      exclusion_id: exclusionData.id,
      player_token,
      casino_id: casinoId,
      event_type: exclusion_type ?? "self",
      created_at: new Date().toISOString(),
    });

    if (senError) {
      // Log but do not fail — the table may not exist
      console.warn("sen_exclusion_events insert skipped or failed:", senError.message);
    }
  } catch (_err) {
    console.warn("sen_exclusion_events table may not exist, skipping:", _err);
  }

  // Update player status to 'self_excluded'
  if (playerId) {
    const { error: updateError } = await supabase
      .from("players")
      .update({ status: "self_excluded", updated_at: new Date().toISOString() })
      .eq("id", playerId);

    if (updateError) {
      console.error("Player status update error:", updateError);
    }
  }

  await logAuditEvent(supabase, "api_ingest_self-exclusion", {
    player_token,
    casino_id: casinoId,
    exclusion_type: exclusion_type ?? "self",
    duration_type: duration_type ?? "indefinite",
    duration_days: duration_days ?? null,
  });

  return jsonResponse({
    exclusion_id: exclusionData.id,
    status: "recorded",
    player_token,
  });
}

Deno.serve(async (req: Request) => {
  try {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    const url = new URL(req.url);
    const pathname = url.pathname;

    // Only accept POST requests for all data routes
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

    // Authenticate request
    const casinoId = req.headers.get("X-Casino-ID");
    const apiKey = req.headers.get("X-API-Key");

    const auth = await authenticateRequest(supabase, casinoId, apiKey);
    if (!auth.valid) {
      return jsonResponse({ error: auth.error ?? "Unauthorized" }, 401);
    }

    // Parse request body
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch (_err) {
      return jsonResponse({ error: "Invalid or missing JSON body" }, 400);
    }

    // Route matching
    if (pathname === "/api-ingest/session") {
      return await handleSession(supabase, body, casinoId!);
    } else if (pathname === "/api-ingest/bets") {
      return await handleBets(supabase, body, casinoId!);
    } else if (pathname === "/api-ingest/deposits") {
      return await handleDeposits(supabase, body, casinoId!);
    } else if (pathname === "/api-ingest/withdrawals") {
      return await handleWithdrawals(supabase, body, casinoId!);
    } else if (pathname === "/api-ingest/self-exclusion") {
      return await handleSelfExclusion(supabase, body, casinoId!);
    } else {
      return jsonResponse({ error: "Route not found" }, 404);
    }
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
