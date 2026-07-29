// ─── Enterprise Consumer Platform — gateway endpoint (Phase 3.7 / 4.1) ───────
//
// THE presentation gateway of SafeBet IQ:
//
//   GET ?view=<view>&casino_id=…[&version=v1]
//
// AUTHORIZATION (Phase 4.1, Constitution 6.2): identity derives EXCLUSIVELY
// from verified material — the Supabase-verified JWT plus the server-side
// users registry keyed by the verified subject. The consumer profile comes
// from the registry role; the casino scope from the principal (operators
// are pinned to their own casino); the jurisdiction from the casinos
// registry. `consumer` / `jurisdiction` query parameters are IGNORED —
// query parameters select a view; they never assert identity.
//
// The gateway never recalculates intelligence and never mutates anything.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getDigitalTwin } from "../../../lib/digitalTwin/index.ts";
import { getIntelligencePlatform } from "../../../lib/domainIntelligence/index.ts";
import { getPolicyPlatform, loadActivePolicyRules } from "../../../lib/policyPlatform/index.ts";
import { verifyPrincipal } from "../../../lib/security/principal.ts";

// Policy configuration is loaded from the externalised policy store (Phase
// 4.4) and cached briefly. Evaluation logic is unchanged — only the source
// of the rule set moved out of code. On any load failure the platform keeps
// its current configuration (availability over freshness).
let policyLoadedAt = 0;
const POLICY_TTL_MS = 60_000;
// deno-lint-ignore no-explicit-any
async function ensurePoliciesLoaded(client: any): Promise<void> {
  if (Date.now() - policyLoadedAt < POLICY_TTL_MS) return;
  try {
    const rules = await loadActivePolicyRules(client);
    if (rules && rules.length > 0) getPolicyPlatform().configure(rules);
    policyLoadedAt = Date.now();
  } catch (e) {
    console.error("[consumer-gateway] policy store load failed, using current config:", e instanceof Error ? e.message : String(e));
  }
}
import {
  getConsumerGateway, ConsumerRequestError, ConsumerAuthorizationError,
  ConsumerScopeError, resolveConsumerScope,
  type CasinoRegistryEntry, type ConsumerView,
} from "../../../lib/consumerPlatform/index.ts";

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

    // 1. WHO is calling — cryptographically verified, registry-resolved.
    //    Anon keys, tampered tokens and unknown users all fail here.
    const principal = await verifyPrincipal(supabase, req.headers.get("Authorization"), serviceRoleKey);
    if (!principal) return json({ error: "authentication required" }, 401);

    // 2. WHAT they ask for — parameters select, they never assert identity.
    const url = new URL(req.url);
    const view = (url.searchParams.get("view") ?? "live-floor") as ConsumerView;
    const version = url.searchParams.get("version") ?? undefined;
    const requestedCasinoId = url.searchParams.get("casino_id");

    // 3. WHICH casino — principal's own unless entitled to request another;
    //    jurisdiction ALWAYS from the registry row.
    const targetCasinoId = requestedCasinoId ?? principal.casinoId;
    if (!targetCasinoId) return json({ error: "casino_id required" }, 400);
    const { data: casinoRow } = await supabase
      .from("casinos").select("id, jurisdiction, province")
      .eq("id", targetCasinoId).maybeSingle();
    const scope = resolveConsumerScope(
      principal, requestedCasinoId, (casinoRow ?? null) as CasinoRegistryEntry | null,
    );

    // 4. Refresh policy configuration from the externalised store (cached),
    //    then serve. Evaluation itself is unchanged.
    await ensurePoliciesLoaded(supabase);

    const twin = getDigitalTwin(scope.casinoId);
    if (twin.registeredEngineIds.indexOf(getIntelligencePlatform().engineId) === -1) {
      getIntelligencePlatform().attach(twin);
    }
    await twin.start(supabase, { observe: false });

    const response = await getConsumerGateway().serve(
      { consumer: scope.consumer, view, casinoId: scope.casinoId, version, jurisdiction: scope.jurisdiction },
      {
        twin,
        recentEvents: async () => {
          const { data, error } = await supabase
            .from("casino_event_log").select("*")
            .eq("casino_id", scope.casinoId)
            .order("occurred_at", { ascending: false })
            .limit(80);
          if (error) throw new Error(`event feed read failed: ${error.message}`);
          return (data ?? []) as Record<string, unknown>[];
        },
        decisions: () => getPolicyPlatform().evaluate(twin, { jurisdiction: scope.jurisdiction }),
        connectorHealth: async () => {
          const { data } = await supabase.rpc("sbiq_connector_health", { p_casino: scope.casinoId });
          return (data ?? {}) as Record<string, unknown>;
        },
        // Certified period-scoped financial posture, scoped to the principal's
        // casino (JWT-derived scope — the query parameter never grants access).
        financialPosture: async () => {
          const { data } = await supabase
            .from("projection_financial_posture").select("*")
            .eq("casino_id", scope.casinoId).maybeSingle();
          return (data ?? null) as Record<string, unknown> | null;
        },
        // Explainable Intelligence (v1.4): the player id to explain + their
        // immutable event timeline (recorded facts, scoped to the casino).
        explainPlayerId: url.searchParams.get("player_id") ?? undefined,
        playerEvents: async (playerId: string) => {
          const { data } = await supabase.from("casino_event_log").select("*")
            .eq("casino_id", scope.casinoId).eq("safebet_player_id", playerId)
            .order("occurred_at", { ascending: true }).limit(500);
          return (data ?? []) as Record<string, unknown>[];
        },
      },
    );

    return json({ success: true, ...response });
  } catch (error) {
    if (error instanceof ConsumerRequestError
      || error instanceof ConsumerAuthorizationError
      || error instanceof ConsumerScopeError) {
      return json({ error: error.message }, error.status);
    }
    console.error("[consumer-gateway] error:", error instanceof Error ? error.message : String(error));
    return json({ error: "consumer gateway request failed" }, 500);
  }
});
