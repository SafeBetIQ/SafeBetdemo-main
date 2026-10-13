// ─── SafeBet IQ — B11 Follow-Up Requirement Closure: governed server op ──────────
//
// Server-only. The ONLY mutation path is the atomic SECURITY DEFINER function
// sbiq_b11_close_follow_up_requirement — this module NEVER issues a direct
// .from('player_protection_interventions').update(...). Casino comes from the governed
// scope; actor from the principal. Idempotency is durable (audit-backed) in the RPC.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthenticatedPrincipal } from '../security/principal.ts';
import { B11_STATUSES, type B11Status } from './followUpRequirementClosure.ts';

export type CloseOutcome =
  | { kind: 'status'; status: B11Status }
  | { kind: 'error'; status: number };

export async function closeFollowUpRequirement(
  admin: SupabaseClient, scopeCasino: string, interventionId: string,
  principal: AuthenticatedPrincipal, idempotencyKey: string,
): Promise<CloseOutcome> {
  const { data, error } = await admin.rpc('sbiq_b11_close_follow_up_requirement', {
    p_intervention_id: interventionId,
    p_casino_id: scopeCasino,
    p_actor_id: principal.userId,
    p_idempotency_key: idempotencyKey,
  });
  const row = Array.isArray(data) ? (data[0] as { status?: string } | undefined) : undefined;
  if (error || !row) return { kind: 'error', status: 503 };           // raised exception (defence-in-depth) → unavailable
  const status = String(row.status) as B11Status;
  if (!B11_STATUSES.includes(status)) return { kind: 'error', status: 503 };
  return { kind: 'status', status };
}
