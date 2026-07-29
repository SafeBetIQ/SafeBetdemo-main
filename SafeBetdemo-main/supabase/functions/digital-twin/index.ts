// ─── Enterprise Casino Digital Twin — operations endpoint (Phase 3.4/3.5) ────
//
// GET ?action=snapshot&casino_id=…      the casino at this exact moment
// GET ?action=health&casino_id=…        twin/projection freshness
// GET ?action=intelligence&casino_id=…  the ENRICHED twin (Phase 3.5): the
//                                       same runtime objects with the Domain
//                                       Intelligence Platform's analysis
// GET ?action=decisions&casino_id=…[&jurisdiction=ZA]
//                                       Phase 3.6: the Enterprise Policy &
//                                       Rules Platform's decisions over the
//                                       enriched twin. Decisions only —
//                                       nothing is executed or persisted.
//
// This is the operational surface of the ONE Digital Twin — not a second
// twin. All logic lives in lib/digitalTwin + lib/domainIntelligence +
// lib/policyPlatform, which consume ONLY the Enterprise Projection
// Platform's read models. This function never touches casino_event_log and
// never writes anything.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getDigitalTwin } from "../../../lib/digitalTwin/index.ts";
import { getIntelligencePlatform, intelligenceOf } from "../../../lib/domainIntelligence/index.ts";
import { getPolicyPlatform } from "../../../lib/policyPlatform/index.ts";
import { verifyPrincipal } from "../../../lib/security/principal.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);

    // Phase 4.1 least privilege: this is the platform OPS surface — verified
    // administrators (and internal service jobs) only. Consumers use the
    // consumer-gateway.
    const principal = await verifyPrincipal(supabase, req.headers.get("Authorization"), serviceRoleKey);
    if (!principal) return json({ error: "authentication required" }, 401);
    if (!principal.isServiceRole && principal.role !== "super_admin") {
      return json({ error: "administrator access required" }, 403);
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "snapshot";
    const casinoId = url.searchParams.get("casino_id");
    if (!casinoId) return json({ error: "casino_id required" }, 400);

    // THE twin for this casino in this host. Edge invocations are
    // short-lived, so each request re-assembles from the projections —
    // the twin is disposable by design and Realtime observation is left
    // to long-lived hosts (dashboards).
    const twin = getDigitalTwin(casinoId);
    // ONE intelligence platform enriches THE twin before assembly completes.
    if (twin.registeredEngineIds.indexOf(getIntelligencePlatform().engineId) === -1) {
      getIntelligencePlatform().attach(twin);
    }
    await twin.start(supabase, { observe: false });

    if (action === "snapshot") return json({ success: true, ...twin.snapshot() });
    if (action === "health") return json({ success: true, casino_id: casinoId, ...twin.health() });

    if (action === "intelligence") {
      // The SAME runtime objects, now carrying the intelligence enrichment.
      const players = twin.activePlayers().map(p => ({
        playerId: p.playerId, riskScore: p.riskScore,
        requiresMonitoring: p.requiresMonitoring,
        intelligence: intelligenceOf(p) ?? null,
      }));
      const floors = Array.from(twin.registry.floors.values()).map(f => ({
        floorLocation: f.floorLocation,
        intelligence: intelligenceOf(f) ?? null,
      }));
      const machines = twin.occupiedMachines().map(m => ({
        machineId: m.machineId, floorLocation: m.floorLocation,
        intelligence: intelligenceOf(m) ?? null,
      }));
      return json({
        success: true, casino_id: casinoId,
        engine: getIntelligencePlatform().engineId,
        stages: getIntelligencePlatform().stageIds,
        players, floors, machines,
      });
    }

    if (action === "decisions") {
      // Enterprise flow: enriched twin → Policy & Rules Platform → Decision.
      const jurisdiction = url.searchParams.get("jurisdiction") ?? "ZA";
      const decisionSet = getPolicyPlatform().evaluate(twin, { jurisdiction });
      return json({ success: true, ...decisionSet });
    }

    return json({ error: "Unknown action. Use: snapshot | health | intelligence | decisions" }, 400);
  } catch (error) {
    console.error("[digital-twin] error:", error instanceof Error ? error.message : String(error));
    return json({ error: "digital twin operation failed" }, 500);
  }
});
