// ─── SafeBet IQ — B8 Follow-Up Scheduling: governed server operations ────────────
//
// Server-only. Reuses the B4.1 authorisation path (resolveAlertAccess). All scheduling
// mutations go through the atomic SECURITY DEFINER function sbiq_b8_set_follow_up (the
// server never UPDATEs the table directly — service_role has no UPDATE privilege after
// B8 hardening). The caller supplies only intervention id (route) + date (body); casino,
// actor, and action are server-derived.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthenticatedPrincipal } from '../security/principal.ts';
import {
  FOLLOW_UP_LIST_LIMIT, mapFollowUpRow, orderFollowUps,
  type FollowUpAction, type RpcResult, type FollowUpRow, type FollowUpItemDTO,
} from './followUpScheduling.ts';
import { sastToday } from './workload.ts';

const RESULTS: readonly RpcResult[] = ['APPLIED', 'NOOP', 'INVALID_STATE', 'NOT_FOUND'];

export type SetFollowUpOutcome = { kind: 'result'; result: RpcResult } | { kind: 'error'; status: number };

/** Invoke the atomic scheduling RPC. date must be null for UNSCHEDULE. */
export async function setFollowUp(
  admin: SupabaseClient, scopeCasino: string, interventionId: string,
  principal: AuthenticatedPrincipal, action: FollowUpAction, date: string | null,
): Promise<SetFollowUpOutcome> {
  const { data, error } = await admin.rpc('sbiq_b8_set_follow_up', {
    p_intervention_id: interventionId,
    p_casino_id: scopeCasino,
    p_actor_id: principal.userId,
    p_action: action,
    p_follow_up_date: date,
  });
  if (error) return { kind: 'error', status: 503 };                 // raised exception (defence-in-depth) → unavailable
  const r = String(data) as RpcResult;
  if (!RESULTS.includes(r)) return { kind: 'error', status: 503 };
  return { kind: 'result', result: r };
}

/** Bounded own-casino list of interventions requiring follow-up (for scheduling management). */
export async function listFollowUps(admin: SupabaseClient, scopeCasino: string): Promise<FollowUpItemDTO[]> {
  const { data } = await admin
    .from('player_protection_interventions')
    .select('id, player_id, intervention_type, intervention_date, follow_up_date')
    .eq('casino_id', scopeCasino).eq('follow_up_required', true)
    .order('follow_up_date', { ascending: true, nullsFirst: true })
    .order('id', { ascending: true })
    .limit(FOLLOW_UP_LIST_LIMIT);
  const today = sastToday();
  const items = ((data ?? []) as FollowUpRow[]).map((r) => mapFollowUpRow(r, today));
  return orderFollowUps(items);
}
