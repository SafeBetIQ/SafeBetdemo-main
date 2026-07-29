// ─── Identity Resolution Service — Edge Function ──────────────────────────────
//
// POST /identity-resolution
//   { casino_id: string, casino_player_ref: string }
//   { casino_id: string, casino_player_refs: string[] }   (batch)
//
// Returns the stable anonymous SafeBet IQ Player ID(s) for the given casino
// player reference(s), creating safebet_identity_map entries on first sight.
//
// Privacy contract: the raw casino reference is hashed in-process and is
// never stored, logged, or echoed back in the response.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getIdentityService } from "../../../lib/playerIdentity/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_BATCH = 200;

interface ResolveRequest {
  casino_id?: string;
  casino_player_ref?: string;
  casino_player_refs?: string[];
}

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
  if (req.method !== "POST") {
    return json({ error: "POST only" }, 405);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body: ResolveRequest = await req.json();
    const casinoId = body.casino_id;

    if (!casinoId) {
      return json({ error: "casino_id required" }, 400);
    }

    const refs = body.casino_player_refs ??
      (body.casino_player_ref ? [body.casino_player_ref] : []);

    if (refs.length === 0) {
      return json({ error: "casino_player_ref or casino_player_refs required" }, 400);
    }
    if (refs.length > MAX_BATCH) {
      return json({ error: `batch limited to ${MAX_BATCH} references` }, 400);
    }
    if (refs.some((r) => typeof r !== "string" || r.trim().length === 0)) {
      return json({ error: "casino player references must be non-empty strings" }, 400);
    }

    const ids = await getIdentityService().resolveBatch(refs, {
      casinoId,
      client: supabase,
    });

    // Log counts only — never references or hashes.
    console.log(`[IRS] resolved ${ids.length} identities casino=${casinoId}`);

    return body.casino_player_refs
      ? json({ safebet_player_ids: ids })
      : json({ safebet_player_id: ids[0] });
  } catch (error) {
    console.error("[IRS] resolution error:", error instanceof Error ? error.message : String(error));
    return json({ error: "identity resolution failed" }, 500);
  }
});
