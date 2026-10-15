// ─── SafeBet IQ — B13.1 Governed Player Communication: server orchestration ───
//
// Server-only. Reuses the B4.1 authorisation path (resolveAlertAccess). All writes go
// through the three narrow DEFINER RPCs; this module NEVER writes the communications table,
// player_protection_interventions, or audit_events directly, and NEVER reads player contact
// detail. Delivery is SANDBOX only via the code-level connector. The send orchestration is
// crash-resumable: begin-send (idempotent) → sandbox connector (deterministic) → record
// SUBMITTED → record DELIVERED, each step individually idempotent (REPLAYED re-reads).

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthenticatedPrincipal } from '../security/principal.ts';
import {
  mapCommunicationRow, B13_LIST_LIMIT,
  type B13CommunicationType, type CreateStatus, type SendStatus,
  type PlayerCommunicationRow, type PlayerCommunicationDTO,
} from './playerCommunications.ts';
import { resolvePlayerCommunicationConnector } from './playerCommunicationConnector.ts';

const SELECT_COLS =
  'id, communication_type, template_key, template_version, delivery_mode, channel_class, status, sequence, requested_at, send_requested_at, submitted_at, delivered_at, failed_at, failure_class';

async function interventionInCasino(admin: SupabaseClient, casinoId: string, interventionId: string): Promise<boolean> {
  const { data } = await admin
    .from('player_protection_interventions').select('id').eq('id', interventionId).eq('casino_id', casinoId).maybeSingle();
  return !!data;
}

export type CreateOutcome =
  | { kind: 'ok'; status: CreateStatus; communicationId: string; sequence: number }
  | { kind: 'status'; status: CreateStatus }   // INVALID_STATE / IDEMPOTENCY_CONFLICT / NOT_FOUND
  | { kind: 'error' };

export async function createPlayerCommunication(
  admin: SupabaseClient, scopeCasino: string, principal: AuthenticatedPrincipal,
  interventionId: string, communicationType: B13CommunicationType, templateKey: string, idempotencyKey: string,
): Promise<CreateOutcome> {
  const { data, error } = await admin.rpc('sbiq_b13_create_player_communication', {
    p_casino_id: scopeCasino, p_actor_id: principal.userId, p_intervention_id: interventionId,
    p_communication_type: communicationType, p_template_key: templateKey, p_idempotency_key: idempotencyKey,
  });
  if (error) return { kind: 'error' };
  const row = Array.isArray(data) ? (data[0] as { status?: string; communication_id?: string; sequence?: number } | undefined) : undefined;
  if (!row || !row.status) return { kind: 'error' };
  const status = row.status as CreateStatus;
  if (status === 'CREATED' || status === 'REPLAYED') {
    if (!row.communication_id || typeof row.sequence !== 'number') return { kind: 'error' };
    return { kind: 'ok', status, communicationId: row.communication_id, sequence: row.sequence };
  }
  return { kind: 'status', status };
}

export type SendOutcome =
  | { kind: 'ok'; communication: PlayerCommunicationDTO }
  | { kind: 'status'; status: SendStatus }     // IDEMPOTENCY_CONFLICT / INVALID_STATE / NOT_FOUND
  | { kind: 'error' };

/** Begin-send (human) → sandbox connector → record SUBMITTED → record DELIVERED.
 *  BEGUN and REPLAYED both proceed to drive/resume the sandbox progression. */
export async function sendPlayerCommunication(
  admin: SupabaseClient, scopeCasino: string, principal: AuthenticatedPrincipal,
  communicationId: string, sendIdempotencyKey: string,
): Promise<SendOutcome> {
  const begin = await admin.rpc('sbiq_b13_begin_player_communication_send', {
    p_casino_id: scopeCasino, p_actor_id: principal.userId,
    p_communication_id: communicationId, p_send_idempotency_key: sendIdempotencyKey,
  });
  if (begin.error) return { kind: 'error' };
  const beginRow = Array.isArray(begin.data) ? (begin.data[0] as { status?: string } | undefined) : undefined;
  const beginStatus = (beginRow?.status ?? '') as SendStatus;
  if (beginStatus !== 'BEGUN' && beginStatus !== 'REPLAYED') {
    if (beginStatus === 'IDEMPOTENCY_CONFLICT' || beginStatus === 'INVALID_STATE' || beginStatus === 'NOT_FOUND') {
      return { kind: 'status', status: beginStatus };
    }
    return { kind: 'error' };
  }

  // Load current row to drive/resume the sandbox progression idempotently.
  const current = await readCommunication(admin, scopeCasino, communicationId);
  if (!current) return { kind: 'error' };

  // SANDBOX transport — deterministic, no network/contact/secret.
  let connector;
  try { connector = resolvePlayerCommunicationConnector(); } catch { return { kind: 'error' }; }
  const receipt = await connector.send({
    casinoId: scopeCasino, communicationId, sendIdempotencyKey, deliveryMode: current.deliveryMode,
    communicationType: current.communicationType, templateKey: current.templateKey, templateVersion: current.templateVersion,
  });

  if (receipt.status === 'FAILED') {
    const f = await admin.rpc('sbiq_b13_record_player_communication_receipt', {
      p_casino_id: scopeCasino, p_communication_id: communicationId, p_status: 'FAILED',
      p_provider_reference: receipt.providerReference, p_failure_class: receipt.failureClass ?? 'PROVIDER_REJECTED',
    });
    if (f.error) return { kind: 'error' };
    const dto = await readCommunication(admin, scopeCasino, communicationId);
    return dto ? { kind: 'ok', communication: dto } : { kind: 'error' };
  }

  // Record SUBMITTED then DELIVERED (each idempotent; replay-safe after a crash/resume).
  const sub = await admin.rpc('sbiq_b13_record_player_communication_receipt', {
    p_casino_id: scopeCasino, p_communication_id: communicationId, p_status: 'SUBMITTED',
    p_provider_reference: receipt.providerReference, p_failure_class: null,
  });
  if (sub.error) return { kind: 'error' };
  const del = await admin.rpc('sbiq_b13_record_player_communication_receipt', {
    p_casino_id: scopeCasino, p_communication_id: communicationId, p_status: 'DELIVERED',
    p_provider_reference: receipt.providerReference, p_failure_class: null,
  });
  if (del.error) return { kind: 'error' };

  const dto = await readCommunication(admin, scopeCasino, communicationId);
  return dto ? { kind: 'ok', communication: dto } : { kind: 'error' };
}

async function readCommunication(admin: SupabaseClient, casinoId: string, communicationId: string): Promise<PlayerCommunicationDTO | null> {
  const { data } = await admin
    .from('intervention_player_communications').select(SELECT_COLS).eq('id', communicationId).eq('casino_id', casinoId).maybeSingle();
  return data ? mapCommunicationRow(data as PlayerCommunicationRow) : null;
}

export type ListOutcome =
  | { kind: 'ok'; items: PlayerCommunicationDTO[] }
  | { kind: 'not_found' }
  | { kind: 'error' };

export async function listPlayerCommunications(
  admin: SupabaseClient, scopeCasino: string, interventionId: string,
): Promise<ListOutcome> {
  try {
    if (!(await interventionInCasino(admin, scopeCasino, interventionId))) return { kind: 'not_found' };
    const { data, error } = await admin
      .from('intervention_player_communications').select(SELECT_COLS)
      .eq('casino_id', scopeCasino).eq('intervention_id', interventionId)
      .order('requested_at', { ascending: false }).limit(B13_LIST_LIMIT);
    if (error) return { kind: 'error' };
    return { kind: 'ok', items: (data ?? []).map((r) => mapCommunicationRow(r as PlayerCommunicationRow)) };
  } catch { return { kind: 'error' }; }
}
