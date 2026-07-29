// ─── Commercial enablement — commerce endpoint (v1.3) ────────────────────────
//
// Customer Success / commercial operations over COMMERCIAL metadata only.
// It composes the commercial tables with certified platform health — it
// introduces no runtime state, no business logic, and never alters the
// enterprise flow. Admin/super_admin (Customer Success) manage; operators
// read their own commercial record.
//
//   GET  ?action=customer-success                 (admin) all operators rollup
//   GET  ?action=my-status&casino_id=…            operator's onboarding/pilot/licence
//   POST ?action=set-subscription  {casino_id, plan, status}
//   POST ?action=onboarding-step   {casino_id, step, done}
//   POST ?action=pilot-item        {casino_id, item, done}
//   POST ?action=pilot-status      {casino_id, status}

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyPrincipal, principalMayAccessCasino } from "../../../lib/security/principal.ts";
import {
  evaluateLicence, shapeOnboarding, shapePilot, shapeCustomerSuccessRow,
  PLAN_CATALOGUE, type Subscription, type Plan, type SubscriptionStatus,
} from "../../../lib/commercial/index.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function toSubscription(row: Record<string, unknown> | null, casinoId: string): Subscription | null {
  if (!row) return null;
  return {
    casinoId, plan: String(row.plan) as Plan, status: String(row.status) as SubscriptionStatus,
    trialEndsAt: (row.trial_ends_at as string | null) ?? null,
    currentPeriodEnd: (row.current_period_end as string | null) ?? null,
    createdAt: String(row.created_at ?? ''),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
    const principal = await verifyPrincipal(supabase, req.headers.get("Authorization"), serviceKey);
    if (!principal) return json({ error: "authentication required" }, 401);

    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "my-status";
    const isAdmin = principal.isServiceRole || principal.role === "super_admin";
    const actor = principal.isServiceRole ? "service-role" : `user:${principal.userId}`;
    // Read the request body ONCE (the stream is single-use).
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    // ── Customer Success dashboard (admin only) ───────────────────────────────
    if (action === "customer-success") {
      if (!isAdmin) return json({ error: "customer success access required" }, 403);
      const { data, error } = await supabase.rpc("sbiq_customer_success");
      if (error) return json({ error: error.message }, 500);
      const rows = ((data ?? []) as Record<string, unknown>[]).map(r => shapeCustomerSuccessRow({
        casino: { id: String(r.casino_id), name: String(r.casino_name), jurisdiction: String(r.jurisdiction) },
        subscription: r.plan === "none" ? null : {
          casinoId: String(r.casino_id), plan: String(r.plan) as Plan, status: String(r.sub_status) as SubscriptionStatus,
          trialEndsAt: (r.trial_ends_at as string | null) ?? null, currentPeriodEnd: (r.current_period_end as string | null) ?? null, createdAt: "",
        },
        onboarding: { casinoId: String(r.casino_id), completed: (r.onboarding_completed as string[]) ?? [], startedAt: null, activatedAt: r.onboarding_activated ? "x" : null },
        pilot: { casinoId: String(r.casino_id), status: String(r.pilot_status) as never, checklist: (r.pilot_checklist as never) ?? [], startedAt: null, goLiveAt: null, notes: null },
        connectorHealth: { runs: Number(r.connector_runs ?? 0), failed: Number(r.connector_failed ?? 0) },
        platformHealth: { events_in_log: Number(r.events_in_log ?? 0), projection_lag_seconds: r.last_event_at ? (Date.now() - Date.parse(String(r.last_event_at))) / 1000 : null },
      }));
      return json({ success: true, plans: PLAN_CATALOGUE, operators: rows });
    }

    // ── Operator's own commercial status ──────────────────────────────────────
    const casinoId = url.searchParams.get("casino_id") ?? body?.casino_id;
    if (!casinoId) return json({ error: "casino_id required" }, 400);
    const { data: casinoRow } = await supabase.from("casinos").select("id, jurisdiction, province").eq("id", casinoId).maybeSingle();
    if (!casinoRow) return json({ error: "unknown casino" }, 404);
    if (!isAdmin && !principalMayAccessCasino(principal, casinoRow as { id: string; jurisdiction: string; province: string | null })) {
      return json({ error: "casino outside principal scope" }, 403);
    }

    if (action === "my-status" && req.method === "GET") {
      const [sub, onb, pil] = await Promise.all([
        supabase.from("operator_subscriptions").select("*").eq("casino_id", casinoId).maybeSingle(),
        supabase.from("operator_onboarding").select("*").eq("casino_id", casinoId).maybeSingle(),
        supabase.from("pilot_deployments").select("*").eq("casino_id", casinoId).maybeSingle(),
      ]);
      const subscription = toSubscription(sub.data, casinoId);
      return json({
        success: true,
        licence: subscription ? evaluateLicence(subscription) : null,
        onboarding: onb.data ? shapeOnboarding({ casinoId, completed: (onb.data.completed as never) ?? [], startedAt: onb.data.started_at, activatedAt: onb.data.activated_at }) : shapeOnboarding({ casinoId, completed: [], startedAt: null, activatedAt: null }),
        pilot: pil.data ? shapePilot({ casinoId, status: pil.data.status as never, checklist: (pil.data.checklist as never) ?? [], startedAt: pil.data.started_at, goLiveAt: pil.data.go_live_at, notes: pil.data.notes }) : shapePilot({ casinoId, status: "planned", checklist: [], startedAt: null, goLiveAt: null, notes: null }),
      });
    }

    // ── Mutations: onboarding operators may progress their own; admin manages all
    if (action === "onboarding-step") {
      const { data: row } = await supabase.from("operator_onboarding").select("completed").eq("casino_id", casinoId).maybeSingle();
      const set = new Set<string>(((row?.completed as string[]) ?? []));
      if (body.done === false) set.delete(body.step); else set.add(body.step);
      await supabase.from("operator_onboarding").upsert({ casino_id: casinoId, completed: Array.from(set), started_at: row ? undefined : new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "casino_id" });
      return json({ success: true, completed: Array.from(set) });
    }

    if (action === "set-subscription") {
      if (!isAdmin) return json({ error: "admin required" }, 403);
      await supabase.from("operator_subscriptions").upsert({
        casino_id: casinoId, plan: body.plan, status: body.status,
        trial_ends_at: body.trial_ends_at ?? null, current_period_end: body.current_period_end ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "casino_id" });
      return json({ success: true, actor });
    }

    if (action === "pilot-item") {
      const { data: row } = await supabase.from("pilot_deployments").select("checklist").eq("casino_id", casinoId).maybeSingle();
      const set = new Set<string>(((row?.checklist as string[]) ?? []));
      if (body.done === false) set.delete(body.item); else set.add(body.item);
      await supabase.from("pilot_deployments").upsert({ casino_id: casinoId, checklist: Array.from(set), status: "in-progress", updated_at: new Date().toISOString() }, { onConflict: "casino_id" });
      return json({ success: true, checklist: Array.from(set) });
    }

    if (action === "pilot-status") {
      if (!isAdmin) return json({ error: "admin required" }, 403);
      await supabase.from("pilot_deployments").upsert({ casino_id: casinoId, status: body.status, go_live_at: body.status === "live" ? new Date().toISOString() : null, updated_at: new Date().toISOString() }, { onConflict: "casino_id" });
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("[commerce] error:", error instanceof Error ? error.message : String(error));
    return json({ error: "commerce operation failed" }, 500);
  }
});
