// ─── Enterprise Projection Platform — operations endpoint (Phase 3.3) ────────
//
// POST ?action=rebuild&casino_id=…   dispose + rebuild a casino's read models
//                                    by replaying the immutable event log
// GET  ?action=status&casino_id=…    projection freshness vs the event log
//
// This is the operational surface of the ONE Projection Platform — not a
// separate projection service. All logic lives in lib/projectionPlatform.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getProjectionPlatform } from "../../../lib/projectionPlatform/index.ts";
import { verifyPrincipal } from "../../../lib/security/principal.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

    // Phase 4.1 least privilege: rebuild disposes read models — this OPS
    // surface is for verified administrators (and internal jobs) only.
    const principal = await verifyPrincipal(supabase, req.headers.get("Authorization"), serviceRoleKey);
    if (!principal) return json({ error: "authentication required" }, 401);
    if (!principal.isServiceRole && principal.role !== "super_admin") {
      return json({ error: "administrator access required" }, 403);
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "status";
    const casinoId = url.searchParams.get("casino_id");

    if (!casinoId) return json({ error: "casino_id required" }, 400);

    if (action === "rebuild") {
      const result = await getProjectionPlatform().rebuild(supabase, casinoId);
      console.log(`[projections] rebuilt casino=${casinoId} events=${result.events_replayed}`);
      return json({ success: true, ...result });
    }

    if (action === "status") {
      const [events, players, sessions, machines] = await Promise.all([
        supabase.from("casino_event_log").select("event_id", { count: "exact", head: true }).eq("casino_id", casinoId),
        supabase.from("projection_player_state").select("*", { count: "exact", head: true }).eq("casino_id", casinoId),
        supabase.from("projection_session_state").select("*", { count: "exact", head: true }).eq("casino_id", casinoId),
        supabase.from("projection_machine_state").select("*", { count: "exact", head: true }).eq("casino_id", casinoId),
      ]);
      return json({
        casino_id: casinoId,
        projection_version: getProjectionPlatform().version,
        events_in_log: events.count ?? 0,
        players_projected: players.count ?? 0,
        sessions_projected: sessions.count ?? 0,
        machines_projected: machines.count ?? 0,
      });
    }

    return json({ error: "Unknown action. Use: rebuild | status" }, 400);
  } catch (error) {
    console.error("[projections] error:", error instanceof Error ? error.message : String(error));
    return json({ error: "projection platform operation failed" }, 500);
  }
});
