// ─── SafeBet IQ — B10 Follow-Up Occurrence: governed server ops ──────────────────
//
// Server-only. Reuses the B4.1 authorisation path (resolveAlertAccess) via the route.
// The ONLY mutation path is the atomic SECURITY DEFINER function
// sbiq_b10_record_follow_up_occurrence — this module NEVER calls
// .from('intervention_follow_up_events').insert/update/delete/upsert. Reads are
// service_role SELECT-only. Casino comes from the governed scope; actor from the
// principal; player/schedule-snapshot are DB-derived inside the RPC.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthenticatedPrincipal } from '../security/principal.ts';
import {
  B10_STATUSES, mapOccurrenceRow, buildFollowUpPeriodActivity, FOLLOW_UP_OCCURRENCE_LIST_LIMIT,
  type B10Status, type FollowUpOccurrenceDTO, type FollowUpOccurrenceRow, type FollowUpPeriodActivity,
} from './followUpOccurrence.ts';

const B10_TABLE = 'intervention_follow_up_events';

export type RecordOccurrenceOutcome =
  | { kind: 'status'; status: B10Status; occurrenceId: string | null }
  | { kind: 'error'; status: number };

/** Record a follow-up occurrence via the atomic DEFINER function (never a direct INSERT). */
export async function recordFollowUpOccurrence(
  admin: SupabaseClient, scopeCasino: string, interventionId: string,
  principal: AuthenticatedPrincipal, idempotencyKey: string, occurredOn: string,
): Promise<RecordOccurrenceOutcome> {
  const { data, error } = await admin.rpc('sbiq_b10_record_follow_up_occurrence', {
    p_intervention_id: interventionId,
    p_casino_id: scopeCasino,
    p_actor_id: principal.userId,
    p_idempotency_key: idempotencyKey,
    p_occurred_on: occurredOn,
  });
  const row = Array.isArray(data) ? (data[0] as { status?: string; occurrence_id?: string | null } | undefined) : undefined;
  if (error || !row) return { kind: 'error', status: 503 };          // raised exception (defence-in-depth) → unavailable
  const status = String(row.status) as B10Status;
  if (!B10_STATUSES.includes(status)) return { kind: 'error', status: 503 };
  return { kind: 'status', status, occurrenceId: row.occurrence_id ?? null };
}

export type ListOccurrencesOutcome =
  | { kind: 'ok'; items: FollowUpOccurrenceDTO[] }
  | { kind: 'not_found' }
  | { kind: 'error' };

/** Own-casino occurrence history for one intervention. 404 (no-leak) if the intervention
 *  is not in the governed casino. Bounded; safe DTO only (no recorded_by/key/fingerprint). */
export async function listFollowUpOccurrences(
  admin: SupabaseClient, scopeCasino: string, interventionId: string,
): Promise<ListOccurrencesOutcome> {
  const { data: iv, error: ivErr } = await admin
    .from('player_protection_interventions')
    .select('id').eq('id', interventionId).eq('casino_id', scopeCasino).maybeSingle();
  if (ivErr) return { kind: 'error' };
  if (!iv) return { kind: 'not_found' };

  const { data, error } = await admin
    .from(B10_TABLE)
    .select('id, occurred_on, recorded_at, scheduled_follow_up_date')
    .eq('casino_id', scopeCasino).eq('intervention_id', interventionId)
    .order('occurred_on', { ascending: false })
    .order('recorded_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(FOLLOW_UP_OCCURRENCE_LIST_LIMIT);
  if (error) return { kind: 'error' };
  return { kind: 'ok', items: ((data ?? []) as FollowUpOccurrenceRow[]).map(mapOccurrenceRow) };
}

/** B7 additive: factual follow-up occurrence activity within a SAST period (by occurred_on,
 *  inclusive start / exclusive end dates). Aggregate-only; no PII. */
export async function buildFollowUpOccurrenceActivity(
  admin: SupabaseClient, scopeCasino: string, startDate: string, endDateExclusive: string,
): Promise<FollowUpPeriodActivity> {
  const { data } = await admin
    .from(B10_TABLE)
    .select('scheduled_follow_up_date, occurred_on')
    .eq('casino_id', scopeCasino)
    .gte('occurred_on', startDate).lt('occurred_on', endDateExclusive);
  return buildFollowUpPeriodActivity((data ?? []) as { scheduled_follow_up_date: string | null; occurred_on: string }[]);
}
