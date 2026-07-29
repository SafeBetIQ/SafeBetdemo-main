// ─── Enterprise Regulator Intelligence Portal — endpoint (v1.2) ──────────────
//
// The regulator's consumer surface. It is a CONSUMER of the certified
// platform: it composes anonymous read-model rollups + policy decisions
// through the Consumer Platform's serveRegulator() — recalculating nothing,
// owning no runtime state, exposing no PII. Jurisdiction is derived from the
// VERIFIED regulator's JWT (never a caller claim); a regulator sees only
// their jurisdiction's operators (RLS + registry).
//
//   GET ?view=national-overview | cross-operator | operator-compliance
//   GET ?view=regulatory-report&kind=<report-kind>
//   GET ?view=investigation | evidence-package &player_id=SB-PLR-…&casino_id=<uuid>

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyPrincipal, principalMayAccessCasino } from "../../../lib/security/principal.ts";
import { getDigitalTwin } from "../../../lib/digitalTwin/index.ts";
import { getIntelligencePlatform, intelligenceOf } from "../../../lib/domainIntelligence/index.ts";
import { getPolicyPlatform } from "../../../lib/policyPlatform/index.ts";
import {
  getConsumerGateway, ConsumerRequestError, ConsumerAuthorizationError,
  type RegulatorSources, type InvestigationInput,
} from "../../../lib/consumerPlatform/index.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const REGULATOR_ROLES = new Set(["regulator", "national_regulator", "provincial_regulator", "super_admin"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

    const principal = await verifyPrincipal(supabase, req.headers.get("Authorization"), serviceKey);
    if (!principal) return json({ error: "authentication required" }, 401);
    if (!REGULATOR_ROLES.has(principal.role)) return json({ error: "regulator access required" }, 403);

    // Jurisdiction from the verified principal (super_admin may target one).
    const url = new URL(req.url);
    const jurisdiction = principal.role === "super_admin"
      ? (url.searchParams.get("jurisdiction") ?? "ZA")
      : (principal.jurisdiction ?? "");
    if (!jurisdiction) return json({ error: "regulator has no jurisdiction" }, 403);

    const view = url.searchParams.get("view") ?? "national-overview";
    const version = url.searchParams.get("version") ?? undefined;

    // National rollup — composition of the certified read models for this
    // jurisdiction (anonymous, no recalculation).
    const national = async () => {
      const { data, error } = await supabase.rpc("sbiq_regulator_national", { p_jurisdiction: jurisdiction });
      if (error) throw new Error(`national rollup failed: ${error.message}`);
      return (data ?? {}) as Record<string, unknown>;
    };

    // Investigation of ONE anonymous player at ONE in-jurisdiction casino.
    let investigation: (() => Promise<InvestigationInput>) | undefined;
    const playerId = url.searchParams.get("player_id");
    const casinoId = url.searchParams.get("casino_id");
    if (playerId && casinoId) {
      // The casino must belong to the regulator's jurisdiction.
      const { data: casinoRow } = await supabase.from("casinos").select("id, jurisdiction, province").eq("id", casinoId).maybeSingle();
      if (!casinoRow || (casinoRow as { jurisdiction: string }).jurisdiction !== jurisdiction) {
        return json({ error: "casino outside regulator jurisdiction" }, 403);
      }
      if (!principalMayAccessCasino(principal, casinoRow as { id: string; jurisdiction: string; province: string | null })) {
        return json({ error: "casino outside principal scope" }, 403);
      }
      investigation = async () => {
        // Recorded facts: the player's immutable event timeline (scoped).
        const { data: events } = await supabase.from("casino_event_log").select("*")
          .eq("casino_id", casinoId).eq("safebet_player_id", playerId)
          .order("occurred_at", { ascending: true }).limit(500);
        // Derived intelligence: read from the enriched twin (no recomputation of our own).
        const twin = getDigitalTwin(casinoId);
        if (twin.registeredEngineIds.indexOf(getIntelligencePlatform().engineId) === -1) getIntelligencePlatform().attach(twin);
        await twin.start(supabase, { observe: false });
        const player = twin.registry.players.get(playerId) ?? null;
        const decisions = getPolicyPlatform().evaluate(twin, { jurisdiction }).decisions;
        return {
          playerId, casinoId,
          events: (events ?? []) as Record<string, unknown>[],
          intelligence: player ? (intelligenceOf(player) ?? null) : null,
          interventionCount: player?.interventionCount ?? 0,
          lastInterventionAt: player?.lastInterventionAt ?? null,
          decisions,
        };
      };
    }

    const sources: RegulatorSources = {
      jurisdiction, national, investigation,
      reportKind: (url.searchParams.get("kind") as RegulatorSources["reportKind"]) ?? undefined,
    };

    // Map the app role to the consumer profile the platform authorises.
    const consumer = principal.role === "super_admin" ? "administrator" : "regulator";
    const response = await getConsumerGateway().serveRegulator({ consumer, view, version }, sources);
    return json({ success: true, ...response });
  } catch (error) {
    if (error instanceof ConsumerRequestError || error instanceof ConsumerAuthorizationError) {
      return json({ error: error.message }, error.status);
    }
    console.error("[regulator-portal] error:", error instanceof Error ? error.message : String(error));
    return json({ error: "regulator portal request failed" }, 500);
  }
});
