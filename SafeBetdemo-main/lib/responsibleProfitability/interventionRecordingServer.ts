// ─── SafeBet IQ — B9 Governed Intervention Recording: governed server op ─────────
//
// Server-only. Reuses the B4.1 authorisation path (resolveAlertAccess). The ONLY
// mutation path is the atomic SECURITY DEFINER function sbiq_b9_record_alert_intervention
// — this module NEVER calls .from('player_protection_interventions').insert(...). Casino
// comes from the governed scope; actor from the principal; player from the alert (in the
// RPC). The caller supplies only the operator fields + idempotency key.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthenticatedPrincipal } from '../security/principal.ts';
import type { B9RecordFields, B9Status } from './interventionRecording.ts';

const STATUSES: readonly B9Status[] = ['CREATED', 'REPLAYED', 'IDEMPOTENCY_CONFLICT', 'NOT_FOUND'];

export type RecordOutcome =
  | { kind: 'status'; status: B9Status; interventionId: string | null; linkId: string | null }
  | { kind: 'error'; status: number };

export async function recordAlertIntervention(
  admin: SupabaseClient, scopeCasino: string, alertId: string,
  principal: AuthenticatedPrincipal, idempotencyKey: string, fields: B9RecordFields,
): Promise<RecordOutcome> {
  const { data, error } = await admin.rpc('sbiq_b9_record_alert_intervention', {
    p_alert_id: alertId,
    p_casino_id: scopeCasino,
    p_actor_id: principal.userId,
    p_idempotency_key: idempotencyKey,
    p_intervention_type: fields.intervention_type,
    p_outcome: fields.outcome,
    p_follow_up_required: fields.follow_up_required,
    p_follow_up_date: fields.follow_up_date,
  });
  // A TABLE-returning function yields an array of rows.
  const row = Array.isArray(data) ? (data[0] as { status?: string; intervention_id?: string | null; link_id?: string | null } | undefined) : undefined;
  if (error || !row) return { kind: 'error', status: 503 };            // raised exception (defence-in-depth) → unavailable
  const status = String(row.status) as B9Status;
  if (!STATUSES.includes(status)) return { kind: 'error', status: 503 };
  return { kind: 'status', status, interventionId: row.intervention_id ?? null, linkId: row.link_id ?? null };
}
