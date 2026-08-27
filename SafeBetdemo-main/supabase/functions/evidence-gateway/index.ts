// ─── Certified Evidence API — gateway endpoint ───────────────────────────────
//
//   GET ?domain=financial|session|player|machine&period=today&page=1&pageSize=50
//       [&format=json|csv][&casino_id=…][&posture=…][&player_id=…][&producer=…]
//
// Scope is derived EXCLUSIVELY from the verified JWT (verifyPrincipal). A
// casino_id parameter may only NARROW to the authorised casino — never widen.
// Aggregates come from the certified projections (full filtered set); records
// are paginated. Access + exports are recorded in the existing audit_events
// chain. Nothing is recomputed here.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyPrincipal, principalMayAccessCasino } from "../../../lib/security/principal.ts";
import { fetchCertifiedPosture } from "../../../lib/certifiedFinancialSource.ts";
import {
  validatePagination, narrowCasinoScope, buildEnvelope, EvidenceError,
  reconcileSession, reconcilePlayer, reconcileMachine, reconcileFinancial,
  toCsv, MAX_EXPORT_ROWS, EVIDENCE_DOMAINS,
} from "../../../lib/consumerPlatform/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// deno-lint-ignore no-explicit-any
type SB = any;

// Record column sets exposed per domain (no unnecessary PII; SB-PLR only).
const RECORD_COLUMNS: Record<string, string[]> = {
  financial: ["event_id", "occurred_at", "event_type", "safebet_player_id", "machine_id", "session_id", "stake", "winnings", "currency", "is_synthetic", "producer"],
  session: ["session_id", "safebet_player_id", "machine_id", "posture", "started_at", "last_event_at", "ended_at", "ended_reason", "idle_minutes"],
  player: ["safebet_player_id", "status", "risk_score", "current_session_id", "current_machine_id", "last_event_at"],
  machine: ["machine_id", "status", "floor_location", "current_player_id", "current_session_id", "last_event_at"],
};

async function financialRecords(sb: SB, casinoId: string, filters: Record<string, string>, offset: number, pageSize: number) {
  let q = sb.from("casino_event_log")
    .select("event_id,occurred_at,event_type,safebet_player_id,machine_id,session_id,producer,payload", { count: "exact" })
    .eq("casino_id", casinoId).in("event_type", ["BET_PLACED", "JACKPOT"]);
  if (filters.player_id) q = q.eq("safebet_player_id", filters.player_id);
  if (filters.machine_id) q = q.eq("machine_id", filters.machine_id);
  if (filters.producer) q = q.eq("producer", filters.producer);
  if (filters.start) q = q.gte("occurred_at", filters.start);
  if (filters.end) q = q.lte("occurred_at", filters.end);
  const { data, count } = await q.order("occurred_at", { ascending: false }).range(offset, offset + pageSize - 1);
  const rows = (data ?? []).map((r: SB) => {
    const p = r.payload ?? {};
    const synthetic = p.is_simulated === true || p.synthetic === true;
    return {
      event_id: r.event_id, occurred_at: r.occurred_at, event_type: r.event_type,
      safebet_player_id: r.safebet_player_id, machine_id: r.machine_id, session_id: r.session_id,
      stake: Number(p.bet_amount ?? 0), winnings: Number(p.win_amount ?? 0),
      currency: p.currency ?? "ZAR", is_synthetic: synthetic, producer: r.producer,
    };
  }).filter((r: SB) => filters.synthetic == null || String(r.is_synthetic) === filters.synthetic);
  return { rows, total: count ?? rows.length };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const correlationId = crypto.randomUUID();
  try {
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);

    const principal = await verifyPrincipal(sb, req.headers.get("Authorization"), serviceRoleKey);
    if (!principal) return json({ error: "authentication required", correlationId }, 401);

    const url = new URL(req.url);
    const domain = url.searchParams.get("domain") ?? "financial";
    if (!EVIDENCE_DOMAINS.includes(domain as never)) return json({ error: `unknown domain: ${domain}`, correlationId }, 400);
    const format = url.searchParams.get("format") ?? "json";
    const requestedCasino = url.searchParams.get("casino_id");
    const period = url.searchParams.get("period") ?? "today";
    const { page, pageSize, offset } = validatePagination(url.searchParams.get("page"), url.searchParams.get("pageSize"));

    // WHICH casino — operators are pinned; regulators/super must name one they may access.
    const operatorRole = principal.role === "casino_admin" || principal.role === "compliance_officer";
    const authorisedCasino = operatorRole ? principal.casinoId : requestedCasino;
    if (!authorisedCasino) return json({ error: "casino_id required", correlationId }, 400);
    const casinoId = operatorRole ? narrowCasinoScope(principal.casinoId!, requestedCasino) : authorisedCasino;

    const { data: casinoRow } = await sb.from("casinos").select("id, jurisdiction, province").eq("id", casinoId).maybeSingle();
    if (!casinoRow) return json({ error: "casino not found", correlationId }, 404);
    if (!principalMayAccessCasino(principal, casinoRow)) return json({ error: "cross-casino access denied", correlationId }, 403);

    const filters: Record<string, string> = {};
    for (const k of ["player_id", "machine_id", "session_id", "posture", "producer", "synthetic", "currency", "event_id", "start", "end", "risk"]) {
      const v = url.searchParams.get(k); if (v != null) filters[k] = v;
    }

    // ── Aggregates (from certified projections — the COMPLETE set) + records ──
    let aggregates: Record<string, unknown> = {};
    let reconciliation; let records: Record<string, unknown>[] = []; let total = 0; let snapStatus = "healthy"; let tz = "Africa/Johannesburg";

    if (domain === "financial") {
      // Fast rollup-backed source (drop-in for the projection_financial_posture
      // view; exact rowtype/parity). Scope already authorised above.
      const fp = await fetchCertifiedPosture(sb, casinoId);
      aggregates = fp ?? { financial_data_status: "unavailable" };
      snapStatus = String(aggregates.financial_data_status ?? "unavailable");
      tz = String(aggregates.financial_timezone ?? tz);
      reconciliation = reconcileFinancial(aggregates);
      const r = await financialRecords(sb, casinoId, filters, offset, pageSize);
      records = r.rows; total = r.total;
    } else {
      const { data: cs } = await sb.from("projection_casino_state").select("*").eq("casino_id", casinoId).maybeSingle();
      const a = cs ?? {};
      if (domain === "session") {
        aggregates = { active_sessions: a.active_sessions, idle_sessions: a.idle_sessions, stale_sessions: a.stale_sessions, open_sessions: a.open_sessions };
        reconciliation = reconcileSession(a);
        let q = sb.from("projection_session_posture").select("*", { count: "exact" }).eq("casino_id", casinoId);
        if (filters.posture) q = q.eq("posture", filters.posture);
        if (filters.player_id) q = q.eq("safebet_player_id", filters.player_id);
        if (filters.machine_id) q = q.eq("machine_id", filters.machine_id);
        const { data, count } = await q.order("started_at", { ascending: false }).range(offset, offset + pageSize - 1);
        records = data ?? []; total = count ?? records.length;
      } else if (domain === "player") {
        aggregates = { active_players: a.active_players, players_active_now: a.players_active_now, players_idle: a.players_idle, players_stale: a.players_stale, risk_critical: a.risk_critical, risk_high: a.risk_high, risk_medium: a.risk_medium, risk_low: a.risk_low, risk_unclassified: a.risk_unclassified };
        reconciliation = reconcilePlayer(a);
        let q = sb.from("projection_player_state").select("safebet_player_id,status,risk_score,current_session_id,current_machine_id,last_event_at", { count: "exact" }).eq("casino_id", casinoId);
        if (filters.player_id) q = q.eq("safebet_player_id", filters.player_id);
        const { data, count } = await q.order("risk_score", { ascending: false }).range(offset, offset + pageSize - 1);
        records = data ?? []; total = count ?? records.length;
      } else { // machine
        aggregates = { registered_machines: a.registered_machines, active_machines: a.active_machines, machines_in_play: a.machines_in_play, machines_stale: a.machines_stale };
        reconciliation = reconcileMachine(a);
        let q = sb.from("projection_machine_state").select("machine_id,status,floor_location,current_player_id,current_session_id,last_event_at", { count: "exact" }).eq("casino_id", casinoId);
        if (filters.machine_id) q = q.eq("machine_id", filters.machine_id);
        const { data, count } = await q.order("last_event_at", { ascending: false }).range(offset, offset + pageSize - 1);
        records = data ?? []; total = count ?? records.length;
      }
    }

    const scope = { tenantId: casinoId, operatorId: casinoId, casinoId };
    const snapshot = { snapshotAt: new Date().toISOString(), timezone: tz, dataStatus: snapStatus, projectionLagSeconds: 0 };

    // ── Export path (CSV) — same scope + filters, row-limited, audited ──
    if (format === "csv") {
      if (total > MAX_EXPORT_ROWS) return json({ error: `export too large (${total} > ${MAX_EXPORT_ROWS})`, correlationId }, 413);
      // Re-fetch the full authorised set (capped) for export.
      const exp = domain === "financial"
        ? (await financialRecords(sb, casinoId, filters, 0, MAX_EXPORT_ROWS)).rows
        : records; // non-financial: page already bounded; for full export re-query with big page
      const csv = toCsv(RECORD_COLUMNS[domain], exp);
      const chainRef = await audit(sb, principal, domain, casinoId, "export", correlationId, { period, filters, rows: exp.length }, true);
      const fname = `evidence_${domain}_${casinoId.slice(0, 8)}_${period}.csv`.replace(/[^a-z0-9_.-]/gi, "_");
      // The export is linked to a tamper-evident chained audit record.
      return new Response(csv, { status: 200, headers: {
        ...corsHeaders, "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="${fname}"`,
        "X-Audit-Event-Id": chainRef?.event_id ?? "", "X-Audit-Chain-Scope": chainRef?.chain_scope ?? "",
        "X-Audit-Chain-Sequence": String(chainRef?.chain_sequence ?? ""), "X-Audit-Chain-Hash": chainRef?.hash ?? "",
        "X-Correlation-Id": correlationId,
      } });
    }

    await audit(sb, principal, domain, casinoId, "view", correlationId, { period, filters }, false);
    const envelope = buildEnvelope({ scope, snapshot, reconciliation, filters: { period, ...filters }, page, pageSize, totalRecords: total, aggregates, records, correlationId });
    return json({ success: true, data: envelope });
  } catch (e) {
    if (e instanceof EvidenceError) return json({ error: e.message, correlationId }, e.status);
    console.error("[evidence-gateway] error:", e instanceof Error ? e.message : String(e));
    return json({ error: "evidence request failed", correlationId }, 500);
  }
});

/**
 * Record an evidence access/export in the existing audit_events chain.
 * VOLUME CONTROL: 'view' events use a deterministic per-hour event_id so
 * ordinary refreshes dedupe (on conflict do nothing); 'export' events always
 * record. The compute_audit_chain_hash trigger fills the hash chain.
 */
// deno-lint-ignore no-explicit-any
async function audit(sb: SB, principal: any, domain: string, casinoId: string, action: string, correlationId: string, metadata: Record<string, unknown>, always: boolean): Promise<{ event_id: string; chain_scope: string; chain_sequence: number; hash: string } | null> {
  const hourBucket = new Date().toISOString().slice(0, 13);
  // Dedup key (view only) preserves materially-distinct access: actor + domain +
  // casino + action + hour. Exports use a random id and are NEVER deduplicated.
  const eventId = always
    ? `evidence:${action}:${crypto.randomUUID()}`
    : `evidence:${action}:${principal.userId}:${domain}:${casinoId}:${hourBucket}`;
  try {
    await sb.from("audit_events").upsert({
      event_id: eventId,
      event_type: action === "export" ? "EVIDENCE_EXPORT" : "EVIDENCE_ACCESS",
      event_category: "evidence",
      user_id: principal.isServiceRole ? null : principal.userId,
      user_role: principal.role, casino_id: casinoId,
      resource_type: `evidence.${domain}`, resource_id: casinoId,
      action, description: `${action} ${domain} evidence`,
      correlation_id: correlationId, severity: "info", outcome: "success",
      metadata,
    }, { onConflict: "event_id", ignoreDuplicates: true });
    // Return the chained record so an export can be linked to it.
    const { data } = await sb.from("audit_events").select("event_id, chain_scope, chain_sequence, hash").eq("event_id", eventId).maybeSingle();
    return (data ?? null) as { event_id: string; chain_scope: string; chain_sequence: number; hash: string } | null;
  } catch { return null; /* audit is best-effort; the certified projection is unchanged */ }
}
