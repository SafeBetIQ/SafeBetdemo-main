// ─── Enterprise Workflow & Case Management — workflow endpoint (v1.5) ─────────
//
// Operational orchestration of HUMAN actions over the certified enterprise
// flow (ADR-005). It manages cases, tasks, an append-only audit trail and
// notifications — all operational metadata. It REFERENCES platform evidence
// (Recorded Facts, Derived Intelligence, Policy Decisions, Explainable
// Intelligence) by identifier; it NEVER recalculates intelligence, re-derives
// policy, creates runtime state, or bypasses the Event Platform. The Consumer
// Platform remains the only surface for the referenced intelligence itself.
//
// Authorization derives EXCLUSIVELY from the verified principal (ADR-002).
// Every mutation writes an immutable audit entry — everything is auditable.
//
//   GET  ?action=cases&casino_id=…[&status=&type=&assignee=]
//   GET  ?action=case&id=…
//   GET  ?action=operations[&casino_id=…][&jurisdiction=…]
//   GET  ?action=notifications[&casino_id=…]
//   POST ?action=create-case      {casino_id, case_type, title, priority?, subject_kind?, subject_ref?, evidence_refs?, assigned_to?, escalation_level?}
//   POST ?action=assign           {id, assigned_to}
//   POST ?action=transition       {id, to_status, note?, resolution?}
//   POST ?action=review           {id, decision:'accept'|'reject', note?}
//   POST ?action=record-action    {id, action}
//   POST ?action=record-outcome   {id, outcome}
//   POST ?action=add-task         {case_id, description, task_type?, assigned_to?, due_at?, evidence_ref?}
//   POST ?action=complete-task    {task_id, note?}
//   POST ?action=note             {id, note}
//   POST ?action=mark-read        {notification_id}

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyPrincipal, principalMayAccessCasino, type AuthenticatedPrincipal } from "../../../lib/security/principal.ts";
import {
  formatCaseNumber, computeDueAt, triagePriority, isTerminal,
  assertTransition, reviewOutcomeStatus, canTransitionTask, WorkflowTransitionError,
  buildCaseTimeline, shapeOperations, attentionItems, sortNotifications,
  type WorkflowCase, type WorkflowAuditEntry, type WorkflowTask,
  type CaseType, type CaseStatus, type Priority, type EvidenceRef,
} from "../../../lib/workflow/index.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// deno-lint-ignore no-explicit-any
function toCase(r: any): WorkflowCase {
  return {
    id: r.id, caseNumber: r.case_number, casinoId: r.casino_id, caseType: r.case_type,
    status: r.status, priority: r.priority, title: r.title, summary: r.summary ?? null,
    subjectKind: r.subject_kind, subjectRef: r.subject_ref ?? null, assignedTo: r.assigned_to ?? null,
    dueAt: r.due_at ?? null, openedAt: r.opened_at, closedAt: r.closed_at ?? null,
    resolution: r.resolution ?? null, evidenceRefs: (r.evidence_refs as EvidenceRef[]) ?? [],
    createdBy: r.created_by, updatedAt: r.updated_at,
  };
}
// deno-lint-ignore no-explicit-any
function toAudit(r: any): WorkflowAuditEntry {
  return { id: r.id, caseId: r.case_id, casinoId: r.casino_id, at: r.at, actor: r.actor,
    action: r.action, fromStatus: r.from_status ?? null, toStatus: r.to_status ?? null, detail: r.detail ?? {} };
}
// deno-lint-ignore no-explicit-any
function toTask(r: any): WorkflowTask {
  return { id: r.id, caseId: r.case_id, casinoId: r.casino_id, taskType: r.task_type,
    description: r.description, status: r.status, assignedTo: r.assigned_to ?? null,
    dueAt: r.due_at ?? null, completedAt: r.completed_at ?? null, notes: r.notes ?? null,
    evidenceRef: r.evidence_ref ?? null };
}

/** The casino ids this principal may see (mirrors the tenant matrix). */
// deno-lint-ignore no-explicit-any
async function visibleCasinoIds(supabase: any, principal: AuthenticatedPrincipal, requestedCasino: string | null, requestedJurisdiction: string | null): Promise<string[] | null> {
  const isAdmin = principal.isServiceRole || principal.role === "super_admin";
  if (isAdmin) {
    if (requestedCasino) return [requestedCasino];
    const q = supabase.from("casinos").select("id").eq("is_active", true);
    if (requestedJurisdiction) q.eq("jurisdiction", requestedJurisdiction);
    const { data } = await q;
    return (data ?? []).map((c: { id: string }) => c.id);
  }
  if (principal.role === "regulator" || principal.role === "national_regulator" || principal.role === "provincial_regulator") {
    if (!principal.jurisdiction) return [];
    const q = supabase.from("casinos").select("id, province").eq("is_active", true).eq("jurisdiction", principal.jurisdiction);
    const { data } = await q;
    let ids = (data ?? []) as { id: string; province: string | null }[];
    if (principal.role === "provincial_regulator" && principal.province) ids = ids.filter((c) => c.province === principal.province);
    return ids.map((c) => c.id);
  }
  // operators / compliance officers: their own casino only.
  return principal.casinoId ? [principal.casinoId] : [];
}

// deno-lint-ignore no-explicit-any
async function auditAndTouch(supabase: any, caseId: string, casinoId: string, actor: string, action: string, fromStatus: CaseStatus | null, toStatus: CaseStatus | null, detail: Record<string, unknown>, patch: Record<string, unknown> | null) {
  await supabase.from("workflow_audit").insert({ case_id: caseId, casino_id: casinoId, actor, action, from_status: fromStatus, to_status: toStatus, detail });
  if (patch) await supabase.from("workflow_cases").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", caseId);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
    const principal = await verifyPrincipal(supabase, req.headers.get("Authorization"), serviceKey);
    if (!principal) return json({ error: "authentication required" }, 401);

    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "cases";
    const actor = principal.isServiceRole ? "service-role" : `user:${principal.userId}`;
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    // Resolve & authorize a single case by id (tenant-scoped).
    const loadCaseScoped = async (id: string) => {
      const { data } = await supabase.from("workflow_cases").select("*").eq("id", id).maybeSingle();
      if (!data) return { error: json({ error: "case not found" }, 404) } as const;
      const { data: casino } = await supabase.from("casinos").select("id, jurisdiction, province").eq("id", data.casino_id).maybeSingle();
      if (!casino || (!principal.isServiceRole && principal.role !== "super_admin" && !principalMayAccessCasino(principal, casino as { id: string; jurisdiction: string; province: string | null }))) {
        return { error: json({ error: "case outside principal scope" }, 403) } as const;
      }
      return { row: data } as const;
    };

    // ── GET: list cases ───────────────────────────────────────────────────────
    if (action === "cases" && req.method === "GET") {
      const ids = await visibleCasinoIds(supabase, principal, url.searchParams.get("casino_id"), url.searchParams.get("jurisdiction"));
      if (!ids || ids.length === 0) return json({ success: true, cases: [] });
      let q = supabase.from("workflow_cases").select("*").in("casino_id", ids).order("opened_at", { ascending: false }).limit(500);
      const status = url.searchParams.get("status"); if (status) q = q.eq("status", status);
      const type = url.searchParams.get("type"); if (type) q = q.eq("case_type", type);
      const assignee = url.searchParams.get("assignee"); if (assignee) q = q.eq("assigned_to", assignee);
      const { data } = await q;
      const cases = (data ?? []).map(toCase);
      return json({ success: true, cases, attention: attentionItems(cases).map((a) => ({ caseId: a.case.id, caseNumber: a.case.caseNumber, kind: a.kind, reason: a.reason })) });
    }

    // ── GET: single case + tasks + audit + unified timeline ───────────────────
    if (action === "case" && req.method === "GET") {
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "id required" }, 400);
      const res = await loadCaseScoped(id);
      if ("error" in res) return res.error;
      const c = toCase(res.row);
      const [tasksR, auditR] = await Promise.all([
        supabase.from("workflow_tasks").select("*").eq("case_id", id).order("created_at", { ascending: true }),
        supabase.from("workflow_audit").select("*").eq("case_id", id).order("at", { ascending: true }),
      ]);
      const audit = (auditR.data ?? []).map(toAudit);
      return json({ success: true, case: c, tasks: (tasksR.data ?? []).map(toTask), audit, timeline: buildCaseTimeline(c, audit) });
    }

    // ── GET: executive operations rollup (WS5) ────────────────────────────────
    if (action === "operations" && req.method === "GET") {
      const ids = await visibleCasinoIds(supabase, principal, url.searchParams.get("casino_id"), url.searchParams.get("jurisdiction"));
      if (!ids || ids.length === 0) return json({ success: true, operations: shapeOperations([], []), rollup: [] });
      const [casesR, tasksR, rollupR] = await Promise.all([
        supabase.from("workflow_cases").select("*").in("casino_id", ids).limit(2000),
        supabase.from("workflow_tasks").select("*").in("casino_id", ids).limit(2000),
        supabase.rpc("sbiq_workflow_operations", { p_casino: url.searchParams.get("casino_id"), p_jurisdiction: url.searchParams.get("jurisdiction") }),
      ]);
      const cases = (casesR.data ?? []).map(toCase);
      const tasks = (tasksR.data ?? []).map(toTask);
      return json({ success: true, operations: shapeOperations(cases, tasks), rollup: rollupR.data ?? [] });
    }

    // ── GET: notifications for this principal ─────────────────────────────────
    if (action === "notifications" && req.method === "GET") {
      const ids = await visibleCasinoIds(supabase, principal, url.searchParams.get("casino_id"), null);
      if (!ids || ids.length === 0) return json({ success: true, notifications: [] });
      const { data } = await supabase.from("workflow_notifications").select("*")
        .in("casino_id", ids)
        .or(`recipient.eq.user:${principal.userId},recipient.eq.${principal.role}`)
        .order("created_at", { ascending: false }).limit(100);
      const ns = (data ?? []).map((r: Record<string, unknown>) => ({
        id: r.id, casinoId: r.casino_id, caseId: r.case_id ?? null, recipient: r.recipient,
        kind: r.kind, message: r.message, createdAt: r.created_at, readAt: r.read_at ?? null,
      }));
      return json({ success: true, notifications: sortNotifications(ns as never) });
    }

    // ═══ MUTATIONS ════════════════════════════════════════════════════════════
    if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

    // ── create-case ───────────────────────────────────────────────────────────
    if (action === "create-case") {
      const casinoId = body.casino_id as string;
      if (!casinoId) return json({ error: "casino_id required" }, 400);
      const { data: casino } = await supabase.from("casinos").select("id, jurisdiction, province").eq("id", casinoId).maybeSingle();
      if (!casino) return json({ error: "unknown casino" }, 404);
      if (!principal.isServiceRole && principal.role !== "super_admin" && !principalMayAccessCasino(principal, casino as { id: string; jurisdiction: string; province: string | null })) {
        return json({ error: "casino outside principal scope" }, 403);
      }
      const caseType = (body.case_type ?? "manual") as CaseType;
      const priority = (body.priority ?? triagePriority(body.escalation_level)) as Priority;
      const openedAt = new Date().toISOString();
      const { data: seq } = await supabase.rpc("sbiq_next_case_seq");
      const seqNum = (seq as number | null) ?? (Date.now() % 1_000_000);
      const caseNumber = formatCaseNumber(caseType, Number(seqNum), new Date(openedAt));
      const evidenceRefs = Array.isArray(body.evidence_refs) ? body.evidence_refs : [];
      const dueAt = computeDueAt(openedAt, priority);
      const { data: inserted, error } = await supabase.from("workflow_cases").insert({
        case_number: caseNumber, casino_id: casinoId, case_type: caseType, status: "open", priority,
        title: body.title ?? "Untitled case", summary: body.summary ?? null,
        subject_kind: body.subject_kind ?? "player", subject_ref: body.subject_ref ?? null,
        assigned_to: body.assigned_to ?? null, due_at: dueAt, opened_at: openedAt,
        evidence_refs: evidenceRefs, created_by: actor,
      }).select("*").maybeSingle();
      if (error || !inserted) return json({ error: error?.message ?? "create failed" }, 500);
      await supabase.from("workflow_audit").insert({ case_id: inserted.id, casino_id: casinoId, actor, action: "opened", to_status: "open", detail: { caseType, priority, evidenceCount: evidenceRefs.length } });
      if (body.assigned_to) {
        await supabase.from("workflow_notifications").insert({ casino_id: casinoId, case_id: inserted.id, recipient: body.assigned_to, kind: "case-assigned", message: `Case ${caseNumber} assigned to you — ${body.title ?? "case"}.` });
      }
      return json({ success: true, case: toCase(inserted) });
    }

    // All remaining mutations act on an existing, scoped case.
    const caseId = body.id as string | undefined;
    const taskId = body.task_id as string | undefined;
    const notifId = body.notification_id as string | undefined;

    if (action === "mark-read") {
      if (!notifId) return json({ error: "notification_id required" }, 400);
      // Only the recipient may mark their own notification read.
      const { data: n } = await supabase.from("workflow_notifications").select("recipient, casino_id").eq("id", notifId).maybeSingle();
      if (!n) return json({ error: "notification not found" }, 404);
      const mine = n.recipient === `user:${principal.userId}` || n.recipient === principal.role;
      if (!mine && !principal.isServiceRole && principal.role !== "super_admin") return json({ error: "not your notification" }, 403);
      await supabase.from("workflow_notifications").update({ read_at: new Date().toISOString() }).eq("id", notifId);
      return json({ success: true });
    }

    if (action === "complete-task") {
      if (!taskId) return json({ error: "task_id required" }, 400);
      const { data: t } = await supabase.from("workflow_tasks").select("*").eq("id", taskId).maybeSingle();
      if (!t) return json({ error: "task not found" }, 404);
      const scoped = await loadCaseScoped(t.case_id);
      if ("error" in scoped) return scoped.error;
      if (!canTransitionTask(t.status, "completed")) return json({ error: `task cannot complete from '${t.status}'` }, 409);
      await supabase.from("workflow_tasks").update({ status: "completed", completed_at: new Date().toISOString(), notes: body.note ?? t.notes }).eq("id", taskId);
      await supabase.from("workflow_audit").insert({ case_id: t.case_id, casino_id: t.casino_id, actor, action: "task-completed", detail: { taskId, description: t.description } });
      return json({ success: true });
    }

    if (!caseId) return json({ error: "id required" }, 400);
    const scoped = await loadCaseScoped(caseId);
    if ("error" in scoped) return scoped.error;
    const current = toCase(scoped.row);

    if (action === "assign") {
      await auditAndTouch(supabase, caseId, current.casinoId, actor, "assigned", current.status, current.status, { assignedTo: body.assigned_to }, { assigned_to: body.assigned_to ?? null });
      if (body.assigned_to) await supabase.from("workflow_notifications").insert({ casino_id: current.casinoId, case_id: caseId, recipient: body.assigned_to, kind: "case-assigned", message: `Case ${current.caseNumber} assigned to you.` });
      return json({ success: true });
    }

    if (action === "note") {
      await supabase.from("workflow_audit").insert({ case_id: caseId, casino_id: current.casinoId, actor, action: "note", detail: { note: body.note ?? "" } });
      return json({ success: true });
    }

    if (action === "review") {
      const decision = body.decision === "reject" ? "reject" : "accept";
      const to = reviewOutcomeStatus(decision);
      try { assertTransition(current.status, to); } catch (e) { if (e instanceof WorkflowTransitionError) return json({ error: e.message }, 409); throw e; }
      await auditAndTouch(supabase, caseId, current.casinoId, actor, decision === "accept" ? "accepted" : "rejected", current.status, to, { note: body.note ?? "" }, { status: to, ...(decision === "reject" ? { resolution: body.note ?? "Recommendation rejected", closed_at: null } : {}) });
      return json({ success: true, status: to });
    }

    if (action === "record-action") {
      try { assertTransition(current.status, "action-recorded"); } catch (e) { if (e instanceof WorkflowTransitionError) return json({ error: e.message }, 409); throw e; }
      await auditAndTouch(supabase, caseId, current.casinoId, actor, "action-recorded", current.status, "action-recorded", { action: body.action ?? "" }, { status: "action-recorded" });
      return json({ success: true, status: "action-recorded" });
    }

    if (action === "record-outcome") {
      try { assertTransition(current.status, "outcome-recorded"); } catch (e) { if (e instanceof WorkflowTransitionError) return json({ error: e.message }, 409); throw e; }
      await auditAndTouch(supabase, caseId, current.casinoId, actor, "outcome-recorded", current.status, "outcome-recorded", { outcome: body.outcome ?? "" }, { status: "outcome-recorded" });
      return json({ success: true, status: "outcome-recorded" });
    }

    if (action === "transition") {
      const to = body.to_status as CaseStatus;
      try { assertTransition(current.status, to); } catch (e) { if (e instanceof WorkflowTransitionError) return json({ error: e.message }, 409); throw e; }
      const patch: Record<string, unknown> = { status: to };
      if (isTerminal(to)) { patch.closed_at = new Date().toISOString(); if (body.resolution) patch.resolution = body.resolution; }
      await auditAndTouch(supabase, caseId, current.casinoId, actor, to === "closed" ? "closed" : to === "resolved" ? "resolved" : "transition", current.status, to, { note: body.note ?? "", resolution: body.resolution ?? null }, patch);
      return json({ success: true, status: to });
    }

    if (action === "add-task") {
      const { data: t, error } = await supabase.from("workflow_tasks").insert({
        case_id: caseId, casino_id: current.casinoId, task_type: body.task_type ?? "compliance-action",
        description: body.description ?? "Task", assigned_to: body.assigned_to ?? null,
        due_at: body.due_at ?? null, evidence_ref: body.evidence_ref ?? null,
      }).select("*").maybeSingle();
      if (error) return json({ error: error.message }, 500);
      await supabase.from("workflow_audit").insert({ case_id: caseId, casino_id: current.casinoId, actor, action: "task-added", detail: { description: body.description } });
      return json({ success: true, task: t ? toTask(t) : null });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("[workflow] error:", error instanceof Error ? error.message : String(error));
    return json({ error: "workflow operation failed" }, 500);
  }
});
