import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function ok(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function generatePseudonymToken(playerId: string, casinoId: string): string {
  const input = `${playerId}-${casinoId}-v1-safebet-cross-op-token`;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  let hash = 0n;
  for (let i = 0; i < data.length; i++) {
    hash = (hash * 31n + BigInt(data[i])) % (2n ** 64n);
  }
  return hash.toString(16).padStart(16, "0").repeat(4);
}

// ─────────────────────────────────────────────
// ACTION: submit-event
// Operator submits a self-exclusion event. SafeBet IQ validates and queues for broadcast.
// ─────────────────────────────────────────────
async function handleSubmitEvent(
  supabase: ReturnType<typeof createClient>,
  body: {
    casino_id: string;
    player_id?: string;
    pseudonym_token?: string;
    exclusion_type: string;
    exclusion_reason?: string;
    duration_months: number;
    exclusion_start_date?: string;
    is_permanent?: boolean;
    risk_score_at_exclusion?: number;
    trigger_event?: string;
    cross_operator_history?: boolean;
    previous_exclusions?: number;
    reported_to_nrgp?: boolean;
    nrgp_reference?: string;
  }
) {
  const {
    casino_id,
    player_id,
    pseudonym_token: providedToken,
    exclusion_type,
    exclusion_reason = "",
    duration_months,
    exclusion_start_date,
    is_permanent = false,
    risk_score_at_exclusion = 0,
    trigger_event = "",
    cross_operator_history = false,
    previous_exclusions = 0,
    reported_to_nrgp = false,
    nrgp_reference,
  } = body;

  if (!casino_id || !exclusion_type || !duration_months) {
    throw new Error("casino_id, exclusion_type, and duration_months are required");
  }

  // Get or create pseudonym token
  let pseudonym_token = providedToken;
  if (!pseudonym_token && player_id) {
    const { data: existing } = await supabase
      .from("player_pseudonym_tokens")
      .select("pseudonym_token")
      .eq("player_id", player_id)
      .eq("casino_id", casino_id)
      .maybeSingle();

    if (existing?.pseudonym_token) {
      pseudonym_token = existing.pseudonym_token;
    } else {
      pseudonym_token = generatePseudonymToken(player_id, casino_id);
      await supabase.from("player_pseudonym_tokens").insert({
        player_id,
        casino_id,
        pseudonym_token,
        token_version: 1,
        is_active: true,
      });
    }
  }

  if (!pseudonym_token) {
    // Generate anonymous token
    const ts = Date.now().toString();
    pseudonym_token = generatePseudonymToken(casino_id + ts, casino_id);
  }

  const startDate = exclusion_start_date || new Date().toISOString().slice(0, 10);
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + duration_months);

  const { data: event, error } = await supabase
    .from("sen_exclusion_events")
    .insert({
      submitting_casino_id: casino_id,
      player_id: player_id || null,
      pseudonym_token,
      exclusion_type,
      exclusion_reason,
      duration_months,
      exclusion_start_date: startDate,
      exclusion_end_date: endDate.toISOString().slice(0, 10),
      is_permanent,
      risk_score_at_exclusion,
      trigger_event,
      cross_operator_history,
      previous_exclusions,
      status: "pending",
      reported_to_nrgp,
      nrgp_reference: nrgp_reference || null,
    })
    .select()
    .maybeSingle();

  if (error) throw error;

  // Auto-validate: validate immediately for this demo
  await supabase
    .from("sen_exclusion_events")
    .update({ status: "validated", validated_at: new Date().toISOString() })
    .eq("id", event.id);

  return { event: { ...event, status: "validated" }, pseudonym_token, message: "Exclusion event submitted and validated." };
}

// ─────────────────────────────────────────────
// ACTION: broadcast
// SafeBet IQ processes a validated event and distributes protection intelligence
// ─────────────────────────────────────────────
async function handleBroadcast(
  supabase: ReturnType<typeof createClient>,
  body: { event_id: string }
) {
  const { event_id } = body;
  if (!event_id) throw new Error("event_id is required");

  const { data: event } = await supabase
    .from("sen_exclusion_events")
    .select("*")
    .eq("id", event_id)
    .maybeSingle();

  if (!event) throw new Error("Exclusion event not found");
  if (event.status === "broadcast") throw new Error("Event already broadcast");
  if (!["validated", "pending"].includes(event.status)) throw new Error(`Cannot broadcast event in status: ${event.status}`);

  // Determine protection action and level
  const protectionAction =
    event.is_permanent || event.exclusion_type === "regulatory_order" || event.exclusion_type === "national_register"
      ? "block_access"
      : event.risk_score_at_exclusion >= 80 ? "block_access"
      : event.risk_score_at_exclusion >= 60 ? "flag_for_review"
      : "mandatory_check";

  const protectionLevel =
    event.is_permanent || event.exclusion_type === "regulatory_order" ? "mandatory"
    : event.risk_score_at_exclusion >= 80 ? "standard"
    : "advisory";

  const broadcastScope =
    event.exclusion_type === "national_register" ? "national_register"
    : "full_network";

  const confidenceScore =
    event.exclusion_type === "regulatory_order" || event.exclusion_type === "national_register" ? 100
    : event.risk_score_at_exclusion >= 85 ? 95 : 85;

  // Count active subscriber operators
  const { count: operatorCount } = await supabase
    .from("sen_operator_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .eq("receives_broadcasts", true)
    .neq("casino_id", event.submitting_casino_id);

  const { data: broadcast, error: broadcastError } = await supabase
    .from("sen_protection_broadcasts")
    .insert({
      exclusion_event_id: event_id,
      originating_casino_id: event.submitting_casino_id,
      pseudonym_token: event.pseudonym_token,
      broadcast_scope: broadcastScope,
      protection_action: protectionAction,
      protection_level: protectionLevel,
      confidence_score: confidenceScore,
      exclusion_type: event.exclusion_type,
      duration_months: event.duration_months,
      is_permanent: event.is_permanent,
      risk_score_at_exclusion: event.risk_score_at_exclusion,
      cross_operator_pattern: event.cross_operator_history,
      previous_exclusions: event.previous_exclusions,
      valid_from: new Date().toISOString(),
      valid_until: new Date(event.exclusion_end_date).toISOString(),
      is_active: true,
      operators_notified: operatorCount || 0,
      last_delivered_at: new Date().toISOString(),
    })
    .select()
    .maybeSingle();

  if (broadcastError) throw broadcastError;

  // Mark event as broadcast
  await supabase
    .from("sen_exclusion_events")
    .update({ status: "broadcast", broadcast_at: new Date().toISOString() })
    .eq("id", event_id);

  // Update operator submission counter
  await supabase.rpc("increment_operator_events_submitted" as never, { p_casino_id: event.submitting_casino_id }).maybeSingle().catch(() => {});

  return {
    broadcast,
    operators_notified: operatorCount || 0,
    message: `Protection intelligence broadcast to ${operatorCount || 0} operators.`,
  };
}

// ─────────────────────────────────────────────
// ACTION: check-token
// Any operator can check if a pseudonym token has an active broadcast
// ─────────────────────────────────────────────
async function handleCheckToken(
  supabase: ReturnType<typeof createClient>,
  token: string,
  casinoId: string
) {
  if (!token) throw new Error("token is required");

  const { data: broadcasts } = await supabase
    .from("sen_protection_broadcasts")
    .select("id, protection_action, protection_level, confidence_score, exclusion_type, duration_months, is_permanent, valid_until, broadcast_scope, originating_casino_id")
    .eq("pseudonym_token", token)
    .eq("is_active", true)
    .gte("valid_until", new Date().toISOString());

  if (!broadcasts || broadcasts.length === 0) {
    return { status: "clear", message: "No active protection broadcasts found for this token.", broadcasts: [] };
  }

  const highestLevel = broadcasts.some(b => b.protection_action === "block_access") ? "block_access"
    : broadcasts.some(b => b.protection_action === "flag_for_review") ? "flag_for_review"
    : "mandatory_check";

  return {
    status: "protected",
    protection_action: highestLevel,
    active_broadcasts: broadcasts.length,
    broadcasts: broadcasts.map(b => ({
      id: b.id,
      protection_action: b.protection_action,
      protection_level: b.protection_level,
      confidence_score: b.confidence_score,
      exclusion_type: b.exclusion_type,
      is_permanent: b.is_permanent,
      valid_until: b.valid_until,
    })),
    message: `Player token has ${broadcasts.length} active protection broadcast(s). Action required: ${highestLevel}.`,
  };
}

// ─────────────────────────────────────────────
// ACTION: report-breach
// Operator detected a protected player attempting access
// ─────────────────────────────────────────────
async function handleReportBreach(
  supabase: ReturnType<typeof createClient>,
  body: {
    broadcast_id: string;
    detecting_casino_id: string;
    player_id?: string;
    pseudonym_token: string;
    detection_method: string;
    detection_context: string;
    amount_deposited_before_detection?: number;
    session_duration_before_detection?: number;
  }
) {
  const {
    broadcast_id,
    detecting_casino_id,
    player_id,
    pseudonym_token,
    detection_method,
    detection_context,
    amount_deposited_before_detection = 0,
    session_duration_before_detection = 0,
  } = body;

  if (!broadcast_id || !detecting_casino_id || !pseudonym_token) {
    throw new Error("broadcast_id, detecting_casino_id, and pseudonym_token are required");
  }

  const { data: broadcast } = await supabase
    .from("sen_protection_broadcasts")
    .select("*")
    .eq("id", broadcast_id)
    .maybeSingle();

  if (!broadcast) throw new Error("Broadcast not found");

  const { data: breach, error } = await supabase
    .from("sen_breach_detections")
    .insert({
      broadcast_id,
      exclusion_event_id: broadcast.exclusion_event_id,
      detecting_casino_id,
      originating_casino_id: broadcast.originating_casino_id,
      player_id: player_id || null,
      pseudonym_token,
      detection_method,
      detection_context,
      amount_deposited_before_detection,
      session_duration_before_detection,
      severity: "critical",
      status: "open",
      regulatory_report_filed: false,
      nrgp_notified: false,
    })
    .select()
    .maybeSingle();

  if (error) throw error;

  // Create cross_operator_alert for this breach
  const { data: existingToken } = await supabase
    .from("player_pseudonym_tokens")
    .select("player_id")
    .eq("pseudonym_token", pseudonym_token)
    .maybeSingle();

  if (existingToken?.player_id) {
    await supabase.from("cross_operator_alerts").insert({
      player_id: existingToken.player_id,
      casino_id: detecting_casino_id,
      pseudonym_token,
      alert_type: "self_exclusion_breach",
      severity: "critical",
      status: "new",
      detected_operators: 2,
      operator_names: ["Self-Exclusion Network"],
      evidence: { breach_detection_id: breach?.id, broadcast_id, detection_method, detection_context },
      cross_operator_score: 100,
      self_exclusion_violation: true,
      alert_message: "CRITICAL: Self-exclusion network breach detected. Player has active protection broadcast.",
      recommendation: "MANDATORY: Immediately suspend account. Report to NRGP within 24 hours. Legal obligation.",
      auto_generated: true,
    });
  }

  return { breach, message: "Breach reported. Cross-operator alert generated." };
}

// ─────────────────────────────────────────────
// ACTION: acknowledge
// Operator acknowledges a broadcast and reports action taken
// ─────────────────────────────────────────────
async function handleAcknowledge(
  supabase: ReturnType<typeof createClient>,
  body: { broadcast_id: string; casino_id: string; action_taken: string; notes?: string }
) {
  const { broadcast_id, casino_id, action_taken, notes } = body;
  if (!broadcast_id || !casino_id) throw new Error("broadcast_id and casino_id are required");

  const { data, error } = await supabase
    .from("sen_broadcast_acknowledgements")
    .insert({ broadcast_id, receiving_casino_id: casino_id, action_taken, notes })
    .select()
    .maybeSingle();

  if (error) throw error;

  // Increment acknowledgement counter on broadcast
  await supabase
    .from("sen_protection_broadcasts")
    .update({ acknowledgements_received: supabase.rpc("coalesce_increment" as never) } as never)
    .eq("id", broadcast_id);

  return { acknowledgement: data, message: "Broadcast acknowledged." };
}

// ─────────────────────────────────────────────
// ACTION: stats
// Network-wide statistics
// ─────────────────────────────────────────────
async function handleStats(
  supabase: ReturnType<typeof createClient>,
  casinoId: string | null
) {
  const [
    { data: events },
    { count: broadcastCount },
    { count: activeCount },
    { data: breaches },
    { count: subCount },
  ] = await Promise.all([
    supabase.from("sen_exclusion_events").select("status, exclusion_type, is_permanent"),
    supabase.from("sen_protection_broadcasts").select("id", { count: "exact", head: true }),
    supabase.from("sen_protection_broadcasts").select("id", { count: "exact", head: true }).eq("is_active", true).gte("valid_until", new Date().toISOString()),
    supabase.from("sen_breach_detections").select("status, severity, regulatory_report_filed"),
    supabase.from("sen_operator_subscriptions").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);

  return {
    total_events: events?.length || 0,
    events_by_status: events?.reduce((acc: Record<string, number>, e) => {
      acc[e.status] = (acc[e.status] || 0) + 1; return acc;
    }, {}) || {},
    events_by_type: events?.reduce((acc: Record<string, number>, e) => {
      acc[e.exclusion_type] = (acc[e.exclusion_type] || 0) + 1; return acc;
    }, {}) || {},
    total_broadcasts: broadcastCount || 0,
    active_broadcasts: activeCount || 0,
    total_breaches: breaches?.length || 0,
    open_breaches: breaches?.filter(b => b.status === "open").length || 0,
    reported_breaches: breaches?.filter(b => b.regulatory_report_filed).length || 0,
    operator_subscribers: subCount || 0,
    permanent_exclusions: events?.filter(e => e.is_permanent).length || 0,
  };
}

// ─────────────────────────────────────────────
// Main router
// ─────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (req.method === "POST") {
      const body = await req.json();

      if (action === "submit-event") return ok(await handleSubmitEvent(supabase, body));
      if (action === "broadcast")    return ok(await handleBroadcast(supabase, body));
      if (action === "report-breach") return ok(await handleReportBreach(supabase, body));
      if (action === "acknowledge")  return ok(await handleAcknowledge(supabase, body));

      return err("Unknown POST action — use ?action=submit-event|broadcast|report-breach|acknowledge");
    }

    if (req.method === "GET") {
      const casinoId = url.searchParams.get("casino_id");
      const token    = url.searchParams.get("token") || "";

      if (action === "check-token")  return ok(await handleCheckToken(supabase, token, casinoId || ""));
      if (action === "stats")        return ok(await handleStats(supabase, casinoId));

      if (action === "events") {
        let q = supabase.from("sen_exclusion_events")
          .select("*, casino:casinos(name)")
          .order("created_at", { ascending: false }).limit(100);
        if (casinoId) q = q.eq("submitting_casino_id", casinoId);
        const { data, error } = await q;
        if (error) throw error;
        return ok(data);
      }

      if (action === "broadcasts") {
        const { data, error } = await supabase
          .from("sen_protection_broadcasts")
          .select("*, casino:casinos!originating_casino_id(name)")
          .order("created_at", { ascending: false }).limit(100);
        if (error) throw error;
        return ok(data);
      }

      if (action === "breaches") {
        let q = supabase.from("sen_breach_detections")
          .select("*, detecting:casinos!detecting_casino_id(name), originating:casinos!originating_casino_id(name)")
          .order("detected_at", { ascending: false }).limit(50);
        if (casinoId) q = q.or(`detecting_casino_id.eq.${casinoId},originating_casino_id.eq.${casinoId}`);
        const { data, error } = await q;
        if (error) throw error;
        return ok(data);
      }

      if (action === "subscribers") {
        const { data, error } = await supabase
          .from("sen_operator_subscriptions")
          .select("*, casino:casinos(name, province)")
          .order("enrolled_at", { ascending: false });
        if (error) throw error;
        return ok(data);
      }

      return err("Unknown GET action — use ?action=events|broadcasts|breaches|subscribers|stats|check-token");
    }

    return err("Method not allowed", 405);

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Internal error";
    return err(message, 500);
  }
});
