// ─── SafeBet IQ — B6 Protection Action Traceability: governed server operations ──
//
// Server-only. Reuses the B4.1 authorisation path verbatim (resolveAlertAccess:
// verifyPrincipal → operator-role gate → resolveRpScope → principalMayAccessCasino →
// service_role). Every op is own-casino + own-player scoped. The DB enforces integrity
// (composite FKs, partial-unique active index, correction trigger, in-trigger audit);
// this layer derives casino/player/actor from the governed alert + principal, performs
// the minimal write, and translates DB integrity errors into governed HTTP outcomes.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthenticatedPrincipal } from '../security/principal.ts';
import {
  TRACEABILITY_CANDIDATE_LIMIT,
  mapLinkableIntervention, mapActiveLink,
  type LinkableInterventionRow, type LinkableInterventionDTO,
  type ActiveLinkRow, type ActiveLinkDTO,
} from './traceability.ts';

const PG_UNIQUE_VIOLATION = '23505';
const PG_FK_VIOLATION = '23503';
const pgCode = (e: unknown): string | undefined => (e as { code?: string } | null)?.code;

export interface ResolvedAlert { playerId: string }
export type AlertResolution = { ok: true; alert: ResolvedAlert } | { ok: false; status: number };

/** Fetch the alert scoped by BOTH id and casino (cross-casino/unknown → 404, no leak). */
export async function resolveAlert(admin: SupabaseClient, scopeCasino: string, alertId: string): Promise<AlertResolution> {
  const { data, error } = await admin
    .from('player_protection_alerts')
    .select('id, player_id')
    .eq('id', alertId).eq('casino_id', scopeCasino)
    .maybeSingle();
  if (error) return { ok: false, status: 503 };
  if (!data) return { ok: false, status: 404 };
  return { ok: true, alert: { playerId: (data as { player_id: string }).player_id } };
}

/** Confirm an intervention is visible to this alert (same casino + same player). The
 *  composite FK is the real guard; this gives a clean pre-insert 404 and avoids leaking
 *  the existence of other-player/other-casino interventions. */
export async function interventionVisible(admin: SupabaseClient, scopeCasino: string, playerId: string, interventionId: string): Promise<boolean> {
  const { data, error } = await admin
    .from('player_protection_interventions')
    .select('id')
    .eq('id', interventionId).eq('casino_id', scopeCasino).eq('player_id', playerId)
    .maybeSingle();
  if (error || !data) return false;
  return true;
}

export interface LinkRecord { id: string; alert_id: string; intervention_id: string; superseded_at: string | null }

async function activeLinkFor(admin: SupabaseClient, scopeCasino: string, alertId: string, interventionId: string): Promise<LinkRecord | null> {
  const { data } = await admin
    .from('alert_intervention_links')
    .select('id, alert_id, intervention_id, superseded_at')
    .eq('casino_id', scopeCasino).eq('alert_id', alertId).eq('intervention_id', interventionId)
    .is('superseded_at', null)
    .maybeSingle();
  return (data as LinkRecord) ?? null;
}

export type LinkOutcome =
  | { kind: 'created'; link: LinkRecord }
  | { kind: 'idempotent'; link: LinkRecord }
  | { kind: 'not_linkable' }
  | { kind: 'error'; status: number };

/** Create the INITIAL link. Idempotent on an already-active (alert,intervention) pair
 *  via the partial-unique index (the concurrency authority), never check-then-insert alone. */
export async function createInitialLink(
  admin: SupabaseClient, scopeCasino: string, alertId: string, playerId: string, interventionId: string, principal: AuthenticatedPrincipal,
): Promise<LinkOutcome> {
  if (!(await interventionVisible(admin, scopeCasino, playerId, interventionId))) return { kind: 'not_linkable' };

  const { data, error } = await admin
    .from('alert_intervention_links')
    .insert({ casino_id: scopeCasino, alert_id: alertId, intervention_id: interventionId, player_id: playerId, linked_by: principal.userId })
    .select('id, alert_id, intervention_id, superseded_at')
    .maybeSingle();

  if (!error && data) return { kind: 'created', link: data as LinkRecord };
  if (pgCode(error) === PG_UNIQUE_VIOLATION) {
    const existing = await activeLinkFor(admin, scopeCasino, alertId, interventionId);
    if (existing) return { kind: 'idempotent', link: existing };
    return { kind: 'error', status: 409 };
  }
  if (pgCode(error) === PG_FK_VIOLATION) return { kind: 'not_linkable' };
  return { kind: 'error', status: 503 };
}

export type SupersedeOutcome =
  | { kind: 'superseded'; link: LinkRecord }
  | { kind: 'idempotent'; link: LinkRecord }
  | { kind: 'not_found' }        // the link being corrected is not in scope / not this alert
  | { kind: 'not_linkable' }     // replacement intervention not visible
  | { kind: 'conflict' }         // already superseded by a DIFFERENT replacement
  | { kind: 'error'; status: number };

/** Correct a link: INSERT a replacement carrying supersedes_link_id; the DB trigger
 *  atomically supersedes the prior active link and emits one audit event. */
export async function supersedeLink(
  admin: SupabaseClient, scopeCasino: string, alertId: string, linkId: string, interventionId: string, principal: AuthenticatedPrincipal,
): Promise<SupersedeOutcome> {
  // The link being corrected must belong to this casino AND this alert (prevents cross-alert/casino).
  const { data: oldLink, error: fErr } = await admin
    .from('alert_intervention_links')
    .select('id, alert_id, intervention_id, player_id, superseded_at')
    .eq('id', linkId).eq('casino_id', scopeCasino).eq('alert_id', alertId)
    .maybeSingle();
  if (fErr) return { kind: 'error', status: 503 };
  if (!oldLink) return { kind: 'not_found' };
  const old = oldLink as LinkRecord & { player_id: string };

  const successorOf = async (): Promise<LinkRecord | null> => {
    const { data } = await admin
      .from('alert_intervention_links')
      .select('id, alert_id, intervention_id, superseded_at')
      .eq('supersedes_link_id', linkId)
      .maybeSingle();
    return (data as LinkRecord) ?? null;
  };

  // Already superseded → idempotent iff the existing successor is the same replacement; else conflict.
  if (old.superseded_at) {
    const succ = await successorOf();
    if (succ && succ.intervention_id === interventionId) return { kind: 'idempotent', link: succ };
    return { kind: 'conflict' };
  }

  // Correcting to the SAME intervention is a no-op (nothing to change).
  if (old.intervention_id === interventionId) return { kind: 'idempotent', link: old };

  if (!(await interventionVisible(admin, scopeCasino, old.player_id, interventionId))) return { kind: 'not_linkable' };

  const { data, error } = await admin
    .from('alert_intervention_links')
    .insert({ casino_id: scopeCasino, alert_id: alertId, intervention_id: interventionId, player_id: old.player_id, linked_by: principal.userId, supersedes_link_id: linkId })
    .select('id, alert_id, intervention_id, superseded_at')
    .maybeSingle();

  if (!error && data) return { kind: 'superseded', link: data as LinkRecord };
  if (pgCode(error) === PG_UNIQUE_VIOLATION) {
    // Raced: either the old got superseded, or the replacement pair already active.
    const succ = await successorOf();
    if (succ && succ.intervention_id === interventionId) return { kind: 'idempotent', link: succ };
    return { kind: 'conflict' };
  }
  if (pgCode(error) === PG_FK_VIOLATION) return { kind: 'not_linkable' };
  return { kind: 'error', status: 503 };
}

/** Bounded candidate list: same casino + same player as the alert. No PII. */
export async function listLinkableInterventions(admin: SupabaseClient, scopeCasino: string, alertId: string, playerId: string): Promise<LinkableInterventionDTO[]> {
  const { data: ivs } = await admin
    .from('player_protection_interventions')
    .select('id, intervention_type, intervention_date, outcome, follow_up_required')
    .eq('casino_id', scopeCasino).eq('player_id', playerId)
    .order('intervention_date', { ascending: false }).order('id', { ascending: false })
    .limit(TRACEABILITY_CANDIDATE_LIMIT);

  const { data: links } = await admin
    .from('alert_intervention_links')
    .select('intervention_id')
    .eq('casino_id', scopeCasino).eq('alert_id', alertId).is('superseded_at', null);
  const linked = new Set((links ?? []).map((l) => (l as { intervention_id: string }).intervention_id));

  return ((ivs ?? []) as LinkableInterventionRow[]).map((r) => mapLinkableIntervention(r, linked.has(r.id)));
}

/** Active links for an alert, joined to CURRENT recorded intervention values (never a snapshot). */
export async function listActiveLinks(admin: SupabaseClient, scopeCasino: string, alertId: string): Promise<ActiveLinkDTO[]> {
  const { data: links } = await admin
    .from('alert_intervention_links')
    .select('id, intervention_id, linked_at')
    .eq('casino_id', scopeCasino).eq('alert_id', alertId).is('superseded_at', null)
    .order('linked_at', { ascending: false });
  const rows = (links ?? []) as { id: string; intervention_id: string; linked_at: string }[];
  if (rows.length === 0) return [];

  const ids = Array.from(new Set(rows.map((r) => r.intervention_id)));
  const { data: ivs } = await admin
    .from('player_protection_interventions')
    .select('id, intervention_type, intervention_date, outcome, follow_up_required')
    .eq('casino_id', scopeCasino).in('id', ids);
  const byId = new Map((ivs ?? []).map((i) => [(i as { id: string }).id, i as LinkableInterventionRow]));

  return rows.map((r) => {
    const iv = byId.get(r.intervention_id);
    const row: ActiveLinkRow = {
      id: r.id, intervention_id: r.intervention_id, linked_at: r.linked_at,
      intervention_type: iv?.intervention_type ?? null,
      intervention_date: iv?.intervention_date ?? null,
      outcome: iv?.outcome ?? null,
      follow_up_required: iv?.follow_up_required ?? null,
    };
    return mapActiveLink(row);
  });
}
