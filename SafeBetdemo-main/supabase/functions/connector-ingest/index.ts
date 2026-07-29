// ─── Enterprise Casino Integration — connector-ingest (v1.1) ─────────────────
//
// The authenticated producer endpoint for casino connectors. It translates
// external records into the certified CasinoEventDraft contract and submits
// them through the ONE Enterprise Event Platform — the SAME path every
// producer uses. It introduces NO parallel ingestion pipeline and NO business
// logic; Identity Resolution, validation, idempotency, projection, twin,
// intelligence and policy are all unchanged and downstream.
//
//   POST /connector-ingest
//   { "casino_id": "<uuid>", "connector_type": "slot-management",
//     "config"?: <MappingConfig override>, "records": [ {...}, ... ] }
//
// Auth: a verified principal whose scope includes the casino (operators are
// pinned to their own casino). Records are capped per request.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyPrincipal, principalMayAccessCasino } from "../../../lib/security/principal.ts";
import {
  runConnector, validateMappingConfig, ConnectorConfigError, BUILT_IN_PROFILES,
} from "../../../lib/connectorFramework/index.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const MAX_RECORDS = 500;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

    const principal = await verifyPrincipal(supabase, req.headers.get("Authorization"), serviceKey);
    if (!principal) return json({ error: "authentication required" }, 401);

    const body = await req.json();
    const casinoId = body.casino_id;
    if (!casinoId) return json({ error: "casino_id required" }, 400);

    // Casino scope: jurisdiction from the registry (never a caller claim).
    const { data: casinoRow } = await supabase
      .from("casinos").select("id, jurisdiction, province").eq("id", casinoId).maybeSingle();
    if (!casinoRow) return json({ error: "unknown casino" }, 404);
    if (!principalMayAccessCasino(principal, casinoRow as { id: string; jurisdiction: string; province: string | null })) {
      return json({ error: "casino outside principal scope" }, 403);
    }

    const records = Array.isArray(body.records) ? body.records : null;
    if (!records) return json({ error: "records[] required" }, 400);
    if (records.length > MAX_RECORDS) return json({ error: `records limited to ${MAX_RECORDS}` }, 400);

    // Mapping config: an override, or a built-in profile by connector_type.
    let config;
    try {
      config = body.config
        ? validateMappingConfig(body.config)
        : validateMappingConfig(BUILT_IN_PROFILES[body.connector_type]);
    } catch (e) {
      if (e instanceof ConnectorConfigError) return json({ error: e.message, violations: e.violations }, 400);
      return json({ error: "invalid connector configuration" }, 400);
    }

    // Translate → Enterprise Event Platform (the certified ingestion path).
    const summary = await runConnector(records, {
      config, casinoId, jurisdiction: (casinoRow as { jurisdiction: string }).jurisdiction, client: supabase,
    });

    // Operational telemetry (NOT runtime state) for the Integration Health view.
    await supabase.from("connector_runs").insert({
      casino_id: casinoId, connector_type: summary.connectorType, connector_name: summary.connectorName,
      received: summary.received, translated: summary.translated, rejected: summary.rejected,
      submitted: summary.submitted, failed: summary.failed, diagnostics: summary.diagnostics,
      started_at: summary.startedAt, finished_at: summary.finishedAt,
    });

    return json({ success: true, ...summary });
  } catch (error) {
    console.error("[connector-ingest] error:", error instanceof Error ? error.message : String(error));
    return json({ error: "connector ingestion failed" }, 500);
  }
});
