// ─── Enterprise Platform Operations — ops surface (Phase 4.4) ────────────────
//
// The single administrative/operational endpoint. Administrators (and the
// service role, for schedulers) manage POLICY CONFIGURATION, run SCHEDULED
// MAINTENANCE, and read MONITORING. It orchestrates existing platform
// capabilities — it introduces no new platform, runtime model, or business
// logic (Constitution). Policy evaluation still lives in the Policy Platform;
// this endpoint only seeds/activates the configuration it loads.
//
//   POST ?action=policy-seed            seed the shipped packs as a new version
//   POST ?action=policy-activate&version=N[&reason=]   promote / rollback
//   GET  ?action=policy-list            versions + active + change log
//   POST ?action=ensure-partitions[&months=2]          partition maintenance
//   GET  ?action=monitor[&casino_id=]   health + alerts for the operating mode
//   POST ?action=validate-projections&casino_id=…      integrity check
//
// Admin/service-role only (Phase 4.1 least privilege).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyPrincipal } from "../../../lib/security/principal.ts";
import { defaultConfiguration, toStoredRows } from "../../../lib/policyPlatform/index.ts";
import {
  operationalProfile, resolveOperatingMode, evaluateHealth, overallSeverity,
  ensurePartitions, verifyHealth, assessProjectionIntegrity,
  type HealthSnapshot,
} from "../../../lib/operations/index.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

    const principal = await verifyPrincipal(supabase, req.headers.get("Authorization"), serviceKey);
    if (!principal) return json({ error: "authentication required" }, 401);
    if (!principal.isServiceRole && principal.role !== "super_admin") {
      return json({ error: "administrator access required" }, 403);
    }
    const actor = principal.isServiceRole ? "service-role:scheduler" : `user:${principal.userId}`;

    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "monitor";
    const mode = resolveOperatingMode();
    const profile = operationalProfile(mode);

    // ── Policy store management (WS1) ─────────────────────────────────────────
    if (action === "policy-seed") {
      const rules = defaultConfiguration();
      const { data: verRow } = await supabase.from("policy_sets")
        .select("version").order("version", { ascending: false }).limit(1).maybeSingle();
      const version = ((verRow?.version as number | undefined) ?? 0) + 1;
      const notes = url.searchParams.get("notes") ?? `Seeded shipped packs (${rules.length} rules)`;

      const { error: setErr } = await supabase.from("policy_sets").insert({ version, status: "draft", notes });
      if (setErr) return json({ error: setErr.message }, 500);
      const { error: rulesErr } = await supabase.from("policy_rules").insert(toStoredRows(version, rules));
      if (rulesErr) return json({ error: rulesErr.message }, 500);
      const { data: act, error: actErr } = await supabase.rpc("sbiq_activate_policy_set",
        { p_version: version, p_actor: actor, p_reason: notes });
      if (actErr) return json({ error: actErr.message }, 500);
      return json({ success: true, seeded_version: version, rules: rules.length, activation: act });
    }

    if (action === "policy-activate") {
      const version = Number(url.searchParams.get("version"));
      if (!Number.isInteger(version)) return json({ error: "version required" }, 400);
      const reason = url.searchParams.get("reason") ?? "operational activation";
      const { data, error } = await supabase.rpc("sbiq_activate_policy_set",
        { p_version: version, p_actor: actor, p_reason: reason });
      if (error) return json({ error: error.message }, 400);
      return json({ success: true, ...(data as object) });
    }

    if (action === "policy-list") {
      const [{ data: sets }, { data: log }] = await Promise.all([
        supabase.from("policy_sets").select("version, status, notes, activated_at, activated_by").order("version"),
        supabase.from("policy_change_log").select("*").order("changed_at", { ascending: false }).limit(20),
      ]);
      return json({ success: true, policy_sets: sets ?? [], change_log: log ?? [] });
    }

    // ── Scheduled maintenance (WS3) ───────────────────────────────────────────
    if (action === "ensure-partitions") {
      const months = Math.min(parseInt(url.searchParams.get("months") ?? "2", 10) || 2, 12);
      return json({ success: true, ...(await ensurePartitions(supabase, months)) });
    }

    if (action === "validate-projections") {
      const casinoId = url.searchParams.get("casino_id");
      if (!casinoId) return json({ error: "casino_id required" }, 400);
      const health = await verifyHealth(supabase, casinoId);
      return json({ success: true, ...assessProjectionIntegrity(health) });
    }

    // ── Monitoring & alerting (WS4) ───────────────────────────────────────────
    if (action === "monitor") {
      const casinoId = url.searchParams.get("casino_id");
      const casinoIds = casinoId ? [casinoId]
        : ((await supabase.from("casinos").select("id").eq("is_active", true)).data ?? []).map((c: { id: string }) => c.id);
      const results = [] as unknown[];
      for (const id of casinoIds) {
        const snapshot = await verifyHealth(supabase, id) as unknown as HealthSnapshot;
        const alerts = evaluateHealth(snapshot, profile);
        results.push({ casino_id: id, severity: overallSeverity(alerts), alerts, health: snapshot });
      }
      return json({
        success: true, operating_mode: mode,
        thresholds: { lag_warn: profile.lagWarnSeconds, lag_critical: profile.lagCriticalSeconds },
        casinos: results,
        platform_severity: overallSeverity(results.flatMap((r) => (r as { alerts: [] }).alerts)),
      });
    }

    return json({ error: "Unknown action. Use: policy-seed | policy-activate | policy-list | ensure-partitions | validate-projections | monitor" }, 400);
  } catch (error) {
    console.error("[platform-ops] error:", error instanceof Error ? error.message : String(error));
    return json({ error: "platform operation failed" }, 500);
  }
});
