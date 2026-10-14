// ─── SafeBet IQ — B12 Operator Notifications: governed server projection + mark-read ──
//
// Server-only. Reuses the B4.1 authorisation path (resolveAlertAccess). B12 is a READ
// projection over authoritative source state + per-user read-state; the ONLY write is the
// narrow DEFINER RPC sbiq_b12_mark_operator_notification_read. This module NEVER writes
// player_protection_alerts / player_protection_interventions / audit_events / the B10
// occurrence table. Bounded, batched reads — no N+1 (one query each for alerts,
// interventions, the B8 scheduling-audit revisions, and this user's read-state).

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthenticatedPrincipal } from '../security/principal.ts';
import {
  projectNotifications, B12_B8_SCHEDULE_ACTIONS, B12_MARK_STATUSES, B12_LIST_LIMIT_DEFAULT, B12_LIST_LIMIT_MAX,
  type B12Item, type B12MarkStatus, type SelfExclusionAlertRow, type FollowUpRow,
} from './operatorNotifications.ts';

type Rev = { map: Map<string, string>; eff: Map<string, string | null> };

/** One bounded, batched read of the latest B8 scheduling-audit revision per intervention.
 *  Scoped by casino + exact B8 resource_type + action allowlist (never by resource_id alone)
 *  so unrelated/cross-domain audit rows can never become a B12 revision token. */
async function loadRevisions(admin: SupabaseClient, casinoId: string, interventionIds: string[]): Promise<Rev> {
  const map = new Map<string, string>(); const eff = new Map<string, string | null>();
  if (interventionIds.length === 0) return { map, eff };
  const { data } = await admin
    .from('audit_events')
    .select('resource_id, event_id, created_at')
    .eq('casino_id', casinoId)
    .eq('event_category', 'responsible_gambling')
    .eq('resource_type', 'player_protection_intervention')
    .in('action', [...B12_B8_SCHEDULE_ACTIONS])
    .in('resource_id', interventionIds)
    .order('created_at', { ascending: false }).order('event_id', { ascending: false });
  for (const r of (data ?? []) as { resource_id: string; event_id: string; created_at: string }[]) {
    if (!map.has(r.resource_id)) { map.set(r.resource_id, r.event_id); eff.set(r.resource_id, r.created_at ?? null); }
  }
  return { map, eff };
}

async function buildProjection(admin: SupabaseClient, casinoId: string, userId: string): Promise<{ items: B12Item[]; unreadCount: number }> {
  // Self-exclusion alerts (active statuses only).
  const { data: alertRows } = await admin
    .from('player_protection_alerts')
    .select('id, generated_at, status')
    .eq('casino_id', casinoId).eq('alert_type', 'SELF_EXCLUSION_BREACH_REVIEW')
    .in('status', ['OPEN', 'ACKNOWLEDGED']);
  // Dated required follow-ups (due/overdue filtered in the pure projector vs SAST today).
  const { data: ivRows } = await admin
    .from('player_protection_interventions')
    .select('id, follow_up_required, follow_up_date')
    .eq('casino_id', casinoId).eq('follow_up_required', true).not('follow_up_date', 'is', null);
  const interventions = (ivRows ?? []) as FollowUpRow[];
  const { map: revisionByIv, eff: revisionEffectiveByIv } = await loadRevisions(admin, casinoId, interventions.map((i) => i.id));
  // This user's read-state (bounded by casino).
  const { data: readRows } = await admin
    .from('operator_notification_reads').select('notification_id').eq('casino_id', casinoId).eq('user_id', userId);
  const readIds = new Set((readRows ?? []).map((r) => (r as { notification_id: string }).notification_id));

  return projectNotifications({
    casinoId, alerts: (alertRows ?? []) as SelfExclusionAlertRow[], interventions,
    revisionByIv, revisionEffectiveByIv, readIds,
  });
}

export type ListOutcome = { kind: 'ok'; items: B12Item[]; unreadCount: number } | { kind: 'error' };

/** GET projection for one governed casino + actor. unreadCount counts ALL active unread
 *  items (independent of the returned page limit). */
export async function listOperatorNotifications(
  admin: SupabaseClient, scopeCasino: string, principal: AuthenticatedPrincipal,
  filter: 'unread' | 'all', limit: number,
): Promise<ListOutcome> {
  try {
    const { items, unreadCount } = await buildProjection(admin, scopeCasino, principal.userId);
    const bounded = Math.min(Math.max(1, limit || B12_LIST_LIMIT_DEFAULT), B12_LIST_LIMIT_MAX);
    const filtered = filter === 'unread' ? items.filter((i) => !i.read) : items;
    return { kind: 'ok', items: filtered.slice(0, bounded), unreadCount };
  } catch { return { kind: 'error' }; }
}

export type MarkOutcome = { kind: 'status'; status: B12MarkStatus } | { kind: 'not_found' } | { kind: 'error' };

/** Mark-read: re-derive the CURRENT projection and prove membership BEFORE recording read
 *  state (prevents arbitrary notification-id insertion). Then the narrow DEFINER RPC. */
export async function markOperatorNotificationRead(
  admin: SupabaseClient, scopeCasino: string, principal: AuthenticatedPrincipal, notificationId: string,
): Promise<MarkOutcome> {
  let items: B12Item[];
  try { items = (await buildProjection(admin, scopeCasino, principal.userId)).items; } catch { return { kind: 'error' }; }
  if (!items.some((i) => i.notificationId === notificationId)) return { kind: 'not_found' };   // not a current item

  const { data, error } = await admin.rpc('sbiq_b12_mark_operator_notification_read', {
    p_casino_id: scopeCasino, p_actor_id: principal.userId, p_notification_id: notificationId,
  });
  const row = Array.isArray(data) ? (data[0] as { status?: string } | undefined) : undefined;
  if (error || !row) return { kind: 'error' };
  const status = String(row.status) as B12MarkStatus;
  if (!B12_MARK_STATUSES.includes(status)) return { kind: 'error' };
  return { kind: 'status', status };
}
