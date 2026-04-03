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
  expires_at: string | null;   // ISO timestamp; null only on very old pre-migration rows
}

const IDEMPOTENCY_KEY_TTL_HOURS = 24;

/** Returns true when the row's idempotency key has passed its expiry. */
function isIdempotencyKeyExpired(row: IngestRequest): boolean {
  if (row.expires_at) {
    return new Date(row.expires_at) < new Date();
  }
  // Pre-migration rows have no expires_at — treat as expired (safe default).
  return true;
}

async function claimIdempotencySlot(
  supabase: ReturnType<typeof createClient>,
  casinoId: string,
  requestId: string,
  endpoint: string,
): Promise<{ claimed: true } | { claimed: false; row: IngestRequest }> {
  // Single atomic INSERT … ON CONFLICT DO NOTHING.
  // If the row already exists the insert silently no-ops and returns no rows.
  const expiresAt = new Date(Date.now() + IDEMPOTENCY_KEY_TTL_HOURS * 60 * 60 * 1000).toISOString();

  const { data: inserted, error: insertError } = await supabase
    .from("ingest_requests")
    .insert({ casino_id: casinoId, request_id: requestId, endpoint, status: "pending", expires_at: expiresAt })
    .select("id, status, response_status, response_body, expires_at")
    .maybeSingle();

  if (insertError) {
    // 23505 = unique_violation — the race lost, treat as duplicate
    if (insertError.code === "23505") {
      const { data: existing } = await supabase
        .from("ingest_requests")
        .select("id, status, response_status, response_body, expires_at")
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
      .select("id, status, response_status, response_body, expires_at")
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
  // ── Expiry gate ───────────────────────────────────────────────────────────
  // Checked before status so an expired completed row does NOT replay its
  // response — the casino must resubmit with a fresh X-Request-ID.
  if (isIdempotencyKeyExpired(row)) {
    return new Response(
      JSON.stringify({
        error: "Idempotency key expired. Generate a new request.",
        expired_at: row.expires_at,
        hint: `X-Request-ID keys are valid for ${IDEMPOTENCY_KEY_TTL_HOURS} hours. Generate a new UUID for this request.`,
      }),
      {
        status: 409,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-Idempotency-Expired": "true",
        },
      },
    );
  }
  // ── End expiry gate ───────────────────────────────────────────────────────

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

// ─── HMAC Signature Verification ─────────────────────────────────────────────
//
// Casino platforms sign each request with HMAC-SHA256 using a shared secret
// stored in operator_integrations.hmac_secret.
//
// Canonical string:  X-Timestamp + "." + request body (raw bytes, not re-serialised)
//
// Why raw body instead of JSON.stringify(parsedPayload)?
//   Re-serialising a parsed object can silently reorder keys, strip whitespace,
//   or alter Unicode escapes — making the computed MAC differ from what the casino
//   signed. Using the raw wire bytes guarantees byte-for-byte fidelity.
//
// Headers required on every HMAC-signed request:
//   X-SafeBet-Signature : hex-encoded HMAC-SHA256
//   X-Timestamp         : Unix epoch in seconds (string)
//
// Downgrade prevention:
//   If X-SafeBet-Signature is present, the system ONLY attempts HMAC verification.
//   It never falls back to API key auth. This prevents an attacker who has stolen
//   an API key from stripping the signature header to bypass HMAC.

const HMAC_TIMESTAMP_TOLERANCE_SECONDS = 300; // ±5 minutes — prevents replay of signed requests

type HmacError =
  | "missing_signature"
  | "missing_timestamp"
  | "malformed_timestamp"
  | "timestamp_expired"
  | "malformed_signature"
  | "signature_mismatch"
  | "secret_unavailable";

interface HmacVerificationInput {
  /** Raw request body exactly as received over the wire. */
  rawBody:   string;
  /** Hex-encoded HMAC-SHA256 from X-SafeBet-Signature header. */
  signature: string;
  /** Unix epoch in seconds from X-Timestamp header. */
  timestamp: string;
  /** Shared secret from operator_integrations.hmac_secret. */
  secret:    string;
}

interface HmacVerificationResult {
  valid: true;
} | {
  valid: false;
  error: HmacError;
  detail: string;
}

/**
 * Constant-time byte comparison — prevents timing oracle attacks.
 *
 * Iterates the full length of `expected` (always 32 bytes for HMAC-SHA256)
 * regardless of the length of `received`, so the runtime does not leak
 * information about how many bytes matched before a mismatch occurred.
 */
function safeEqual(expected: Uint8Array, received: Uint8Array): boolean {
  // XOR length difference into result so unequal lengths always fail.
  let diff = expected.length ^ received.length;
  // Always iterate expected.length (32) times — no early exit.
  for (let i = 0; i < expected.length; i++) {
    diff |= expected[i] ^ (received[i] ?? 0);
  }
  return diff === 0;
}

/**
 * Decode a lowercase hex string to a Uint8Array.
 * Returns null if the input is not valid hex (odd length or invalid chars).
 */
function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0) return null;
  if (!/^[0-9a-f]*$/i.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Verify the HMAC-SHA256 signature on an api-ingest request.
 *
 * Algorithm:
 *   canonical  = X-Timestamp + "." + rawBody
 *   expected   = HMAC-SHA256(secret, canonical)   [using crypto.subtle]
 *   valid      = safeEqual(expected, received)     [constant-time]
 */
async function verifyHmacSignature(
  input: HmacVerificationInput,
): Promise<HmacVerificationResult> {
  const { rawBody, signature, timestamp, secret } = input;

  // ── 1. Validate timestamp ────────────────────────────────────────────────
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || timestamp.trim() === "") {
    return { valid: false, error: "malformed_timestamp", detail: "X-Timestamp must be a Unix epoch integer." };
  }

  const nowSeconds  = Math.floor(Date.now() / 1000);
  const skewSeconds = Math.abs(nowSeconds - ts);

  if (skewSeconds > HMAC_TIMESTAMP_TOLERANCE_SECONDS) {
    return {
      valid:  false,
      error:  "timestamp_expired",
      detail: `Request timestamp is ${skewSeconds}s from server time. Tolerance is ±${HMAC_TIMESTAMP_TOLERANCE_SECONDS}s.`,
    };
  }

  // ── 2. Decode the incoming signature ────────────────────────────────────
  const receivedBytes = hexToBytes(signature.toLowerCase());
  if (!receivedBytes) {
    return { valid: false, error: "malformed_signature", detail: "X-SafeBet-Signature must be a lowercase hex string." };
  }

  // ── 3. Compute expected HMAC ─────────────────────────────────────────────
  const enc = new TextEncoder();

  // Import the shared secret as a HMAC-SHA256 signing key.
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,           // not extractable
    ["sign"],
  );

  // canonical = timestamp + "." + rawBody  (matches what the casino platform signs)
  const canonical  = `${timestamp}.${rawBody}`;
  const macBuffer  = await crypto.subtle.sign("HMAC", key, enc.encode(canonical));
  const expectedBytes = new Uint8Array(macBuffer);

  // ── 4. Constant-time comparison ──────────────────────────────────────────
  if (!safeEqual(expectedBytes, receivedBytes)) {
    return { valid: false, error: "signature_mismatch", detail: "Signature does not match." };
  }

  return { valid: true };
}

/**
 * Fetch the HMAC shared secret for a casino from operator_integrations.
 * Returns null if the casino has no HMAC secret configured (legacy API key only).
 */
async function fetchHmacSecret(
  supabase: ReturnType<typeof createClient>,
  casinoId: string,
): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("operator_integrations")
      .select("hmac_secret")
      .eq("casino_id", casinoId)
      .eq("status", "active")
      .not("hmac_secret", "is", null)
      .limit(1)
      .maybeSingle();

    return data?.hmac_secret ?? null;
  } catch (_err) {
    console.error("hmac_secret_fetch_error", _err);
    return null;
  }
}

// ─── End HMAC Signature Verification ─────────────────────────────────────────

// ─── Replay Abuse Detection ──────────────────────────────────────────────────

const REPLAY_ESCALATION_THRESHOLD = 10;   // >10 in 5 min → high severity
const REPLAY_CIRCUIT_THRESHOLD    = 25;   // >25 in 5 min → circuit open
const REPLAY_WINDOW_MINUTES       = 5;
const REPLAY_CIRCUIT_ENDPOINT     = "api-ingest"; // circuit covers all ingest traffic

/**
 * Hash a raw IP address with SHA-256 before storing.
 * Satisfies POPIA/GDPR — no raw IP ever written to DB.
 */
async function hashIp(ip: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Fast circuit check for replay-abuse circuit.
 * Single indexed PK lookup — < 1 ms. Returns true if the circuit is open.
 * Called on every authenticated request; failure degrades gracefully (allow).
 */
async function checkReplayCircuit(
  supabase: ReturnType<typeof createClient>,
  casinoId: string,
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("circuit_breaker_state")
      .select("state")
      .eq("casino_id", casinoId)
      .eq("endpoint", REPLAY_CIRCUIT_ENDPOINT)
      .maybeSingle();
    return data?.state === "open";
  } catch (_err) {
    // Never block ingestion due to a circuit-check error
    console.error("replay_circuit_check_error", _err);
    return false;
  }
}

/**
 * Count replay_attack events for this casino in the last REPLAY_WINDOW_MINUTES.
 * Uses the composite partial index idx_sec_events_replay_window.
 */
async function countRecentReplayAttacks(
  supabase: ReturnType<typeof createClient>,
  casinoId: string,
): Promise<number> {
  const windowStart = new Date(
    Date.now() - REPLAY_WINDOW_MINUTES * 60 * 1000,
  ).toISOString();

  const { count, error } = await supabase
    .from("security_events")
    .select("id", { count: "exact", head: true })
    .eq("casino_id", casinoId)
    .eq("event_type", "replay_attack")
    .gte("created_at", windowStart);

  if (error) {
    console.error("replay_count_error", error);
    return 0;
  }
  return count ?? 0;
}

/**
 * Open the replay-abuse circuit breaker for this casino.
 * Uses UPSERT so repeated triggers are idempotent.
 */
async function openReplayCircuit(
  supabase: ReturnType<typeof createClient>,
  casinoId: string,
  reason: string,
): Promise<void> {
  await supabase
    .from("circuit_breaker_state")
    .upsert(
      {
        casino_id:             casinoId,
        endpoint:              REPLAY_CIRCUIT_ENDPOINT,
        state:                 "open",
        opened_at:             new Date().toISOString(),
        opened_reason:         reason,
        consecutive_violations: REPLAY_CIRCUIT_THRESHOLD + 1,
        consecutive_successes:  0,
      },
      { onConflict: "casino_id,endpoint" },
    );
}

interface ReplayAbuseResult {
  replayCount: number;
  severity: "medium" | "high";
  circuitOpened: boolean;
}

/**
 * Detect, log, escalate, and optionally circuit-break on replay abuse.
 *
 * Called only on the expired-key path — zero impact on normal ingestion.
 *
 * Escalation tiers:
 *   0–10  attempts / 5 min  → medium  (log only)
 *  11–25  attempts / 5 min  → high    (log escalation event)
 *   >25   attempts / 5 min  → critical circuit open (log + open circuit → 503)
 */
async function detectAndLogReplayAbuse(
  supabase: ReturnType<typeof createClient>,
  casinoId: string,
  requestId: string,
  expiredRow: IngestRequest,
  sourceIpHash: string | null,
  endpoint: string,
): Promise<ReplayAbuseResult> {
  const now = new Date().toISOString();

  // ── Step 1: Log the individual replay_attack event ───────────────────────
  // Written immediately so the subsequent COUNT includes this event.
  try {
    await supabase.from("security_events").insert({
      casino_id:       casinoId,
      event_type:      "replay_attack",
      severity:        "medium",
      title:           "Replay Attack — Expired Idempotency Key Reused",
      description:     `Expired X-Request-ID submitted to endpoint /${endpoint}.`,
      source_ip_hash:  sourceIpHash,
      affected_system: "api-ingest",
      resource_path:   `/api-ingest/${endpoint}`,
      raw_metadata: {
        request_id:  requestId,
        expired_at:  expiredRow.expires_at,
        endpoint,
        timestamp:   now,
      },
      is_automated: true,
      is_resolved:  false,
      created_at:   now,
    });
  } catch (err) {
    console.error("replay_event_log_error", err);
    // Non-fatal — continue to count and escalate
  }

  // ── Step 2: Count recent replay attempts for this casino ─────────────────
  const replayCount = await countRecentReplayAttacks(supabase, casinoId);

  // ── Step 3: Escalate based on count ──────────────────────────────────────
  let severity: "medium" | "high" = "medium";
  let circuitOpened = false;

  if (replayCount > REPLAY_CIRCUIT_THRESHOLD) {
    // Tier 3: circuit open
    severity = "high";
    circuitOpened = true;

    const reason = `Replay abuse: ${replayCount} expired key attempts in ${REPLAY_WINDOW_MINUTES} minutes.`;

    await openReplayCircuit(supabase, casinoId, reason);

    // Log the circuit-open escalation as a separate critical event
    try {
      await supabase.from("security_events").insert({
        casino_id:       casinoId,
        event_type:      "circuit_breaker_open",
        severity:        "critical",
        title:           "API Ingest Circuit Opened — Replay Abuse Threshold Exceeded",
        description:     reason,
        source_ip_hash:  sourceIpHash,
        affected_system: "api-ingest",
        resource_path:   `/api-ingest/${endpoint}`,
        raw_metadata: {
          replay_count:  replayCount,
          threshold:     REPLAY_CIRCUIT_THRESHOLD,
          window_minutes: REPLAY_WINDOW_MINUTES,
          casino_id:     casinoId,
          timestamp:     now,
        },
        is_automated: true,
        is_resolved:  false,
        created_at:   now,
      });
    } catch (err) {
      console.error("circuit_open_event_log_error", err);
    }

  } else if (replayCount > REPLAY_ESCALATION_THRESHOLD) {
    // Tier 2: high severity escalation — log but don't open circuit yet
    severity = "high";

    try {
      await supabase.from("security_events").insert({
        casino_id:       casinoId,
        event_type:      "replay_attack_escalated",
        severity:        "high",
        title:           "Replay Attack Escalated — High Frequency Detected",
        description:     `${replayCount} expired key attempts in ${REPLAY_WINDOW_MINUTES} minutes. Circuit will open at ${REPLAY_CIRCUIT_THRESHOLD + 1}.`,
        source_ip_hash:  sourceIpHash,
        affected_system: "api-ingest",
        resource_path:   `/api-ingest/${endpoint}`,
        raw_metadata: {
          replay_count:   replayCount,
          escalation_threshold: REPLAY_ESCALATION_THRESHOLD,
          circuit_threshold:    REPLAY_CIRCUIT_THRESHOLD,
          window_minutes: REPLAY_WINDOW_MINUTES,
          casino_id:      casinoId,
          timestamp:      now,
        },
        is_automated: true,
        is_resolved:  false,
        created_at:   now,
      });
    } catch (err) {
      console.error("replay_escalation_event_log_error", err);
    }
  }

  return { replayCount, severity, circuitOpened };
}
// ─── End Replay Abuse Detection ──────────────────────────────────────────────

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

    // Extract and hash source IP early — used by abuse detection if triggered.
    // Never stored raw; SHA-256 hashed for POPIA compliance.
    const rawIp = req.headers.get("cf-connecting-ip")
      ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim()
      ?? null;
    const sourceIpHash = rawIp ? await hashIp(rawIp) : null;

    const casinoId        = req.headers.get("X-Casino-ID");
    const hmacSignature   = req.headers.get("X-SafeBet-Signature");
    const hmacTimestamp   = req.headers.get("X-Timestamp");

    if (!casinoId) {
      return jsonResponse({ error: "Missing required header: X-Casino-ID" }, 400);
    }

    // ── Read raw body once ────────────────────────────────────────────────────
    // Body is consumed here and reused for both HMAC verification and JSON
    // parsing. req.json() / req.text() can only be called once per request.
    let rawBody: string;
    try {
      rawBody = await req.text();
    } catch (_err) {
      return jsonResponse({ error: "Failed to read request body" }, 400);
    }

    if (rawBody.length > 1_048_576) { // 1 MB hard cap
      return jsonResponse({ error: "Request body exceeds maximum allowed size (1 MB)." }, 413);
    }

    // ── Dual-auth gate ────────────────────────────────────────────────────────
    // Rule: if X-SafeBet-Signature is present → HMAC ONLY.
    //       Never fall back to API key when HMAC headers are present.
    //       This prevents a downgrade attack where an attacker strips the
    //       signature header to bypass HMAC and authenticate with a stolen key.
    let authMethod: "hmac" | "api_key";

    if (hmacSignature !== null) {
      // ── HMAC path ───────────────────────────────────────────────────────────
      if (!hmacTimestamp) {
        return jsonResponse({
          error: "X-Timestamp header is required when X-SafeBet-Signature is present.",
          code:  "missing_timestamp",
        }, 400);
      }

      const hmacSecret = await fetchHmacSecret(supabase, casinoId);
      if (!hmacSecret) {
        await logSecurityEvent(supabase, {
          event_type: "api_auth_failed",
          severity:   "high",
          source:     "api-ingest",
          ip_hash:    sourceIpHash,
          resource:   `casino:${casinoId}`,
          details:    { reason: "hmac_secret_not_configured", casino_id: casinoId },
        });
        return jsonResponse({
          error: "HMAC authentication is not configured for this casino. Contact SafeBet IQ support.",
          code:  "hmac_secret_unavailable",
        }, 401);
      }

      const hmacResult = await verifyHmacSignature({
        rawBody,
        signature: hmacSignature,
        timestamp: hmacTimestamp,
        secret:    hmacSecret,
      });

      if (!hmacResult.valid) {
        await logSecurityEvent(supabase, {
          event_type: "api_auth_failed",
          severity:   hmacResult.error === "timestamp_expired" ? "medium" : "high",
          source:     "api-ingest",
          ip_hash:    sourceIpHash,
          resource:   `casino:${casinoId}`,
          details: {
            reason:    hmacResult.error,
            detail:    hmacResult.detail,
            casino_id: casinoId,
          },
        });
        return jsonResponse({
          error:  "Request signature verification failed.",
          code:   hmacResult.error,
          detail: hmacResult.detail,
        }, 401);
      }

      authMethod = "hmac";

    } else {
      // ── API key path (legacy) ───────────────────────────────────────────────
      const apiKey = req.headers.get("X-API-Key");
      const auth   = await authenticateRequest(supabase, casinoId, apiKey);
      if (!auth.valid) {
        return jsonResponse({ error: auth.error ?? "Unauthorized" }, 401);
      }
      authMethod = "api_key";
    }
    // ── End dual-auth gate ────────────────────────────────────────────────────

    // ── Replay-abuse circuit check ────────────────────────────────────────────
    // Single indexed PK lookup on circuit_breaker_state. Negligible overhead.
    // Only blocks when a prior abuse detection has explicitly opened the circuit.
    if (await checkReplayCircuit(supabase, casinoId)) {
      return new Response(
        JSON.stringify({
          error: "Integration suspended due to repeated security policy violations. Contact SafeBet IQ support to restore access.",
          code: "REPLAY_CIRCUIT_OPEN",
        }),
        {
          status: 503,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": "3600",
            "X-Circuit-Open": "true",
          },
        },
      );
    }
    // ── End circuit check ─────────────────────────────────────────────────────

    const endpoint = pathname.replace("/api-ingest/", "");
    const rateCheck = await checkRateLimit(supabase, casinoId, endpoint);
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

    const idempotency = await claimIdempotencySlot(supabase, casinoId, requestId, endpoint);

    if (!idempotency.claimed) {
      // ── Replay abuse detection (expired keys only) ──────────────────────────
      // Runs only when the existing row has passed its expiry. Normal in-window
      // duplicates (legitimate retries) are NOT flagged.
      if (isIdempotencyKeyExpired(idempotency.row)) {
        const abuse = await detectAndLogReplayAbuse(
          supabase,
          casinoId,
          requestId,
          idempotency.row,
          sourceIpHash,
          endpoint,
        );

        if (abuse.circuitOpened) {
          return new Response(
            JSON.stringify({
              error: "Integration suspended due to repeated security policy violations. Contact SafeBet IQ support.",
              code: "REPLAY_CIRCUIT_OPEN",
              replay_count: abuse.replayCount,
            }),
            {
              status: 503,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
                "Retry-After": "3600",
                "X-Circuit-Open": "true",
              },
            },
          );
        }
      }
      // ── End replay abuse detection ──────────────────────────────────────────

      return buildIdempotentResponse(idempotency.row);
    }
    // ── End idempotency check ─────────────────────────────────────────────────

    // rawBody was read before auth — parse it here instead of calling req.json()
    // (the request stream is already consumed; a second read would throw).
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody);
    } catch (_err) {
      // Malformed JSON: mark slot as failed so the casino can resubmit
      await finaliseIdempotencySlot(supabase, casinoId, requestId, 400, JSON.stringify({ error: "Invalid or missing JSON body" }), false);
      return jsonResponse({ error: "Invalid or missing JSON body" }, 400);
    }

    const responseHeaders = {
      ...corsHeaders,
      "Content-Type":        "application/json",
      "X-RateLimit-Remaining": String(rateCheck.remaining),
      "X-Auth-Method":       authMethod,  // "hmac" or "api_key" — aids casino debugging
    };

    let result: Response;

    if (pathname === "/api-ingest/session") {
      result = await handleSession(supabase, body, casinoId);
    } else if (pathname === "/api-ingest/bets") {
      result = await handleBets(supabase, body, casinoId);
    } else if (pathname === "/api-ingest/deposits") {
      result = await handleDeposits(supabase, body, casinoId);
    } else if (pathname === "/api-ingest/withdrawals") {
      result = await handleWithdrawals(supabase, body, casinoId);
    } else if (pathname === "/api-ingest/self-exclusion") {
      result = await handleSelfExclusion(supabase, body, casinoId);
    } else {
      await finaliseIdempotencySlot(supabase, casinoId, requestId, 404, JSON.stringify({ error: "Route not found" }), false);
      return jsonResponse({ error: "Route not found" }, 404);
    }

    // Persist the response so replays can return it verbatim
    const resultBody = await result.text();
    const success = result.status >= 200 && result.status < 300;
    await finaliseIdempotencySlot(supabase, casinoId, requestId, result.status, resultBody, success);

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
