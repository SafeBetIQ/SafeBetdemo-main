// ─── SafeBet IQ — B12 Operator Notification & Escalation (pure domain layer) ─────
//
// Operator-local, IN_APP, PROJECTION-BASED attention layer. Notification EXISTENCE is
// derived from current authoritative state (B4.1 self-exclusion alerts; B8 current
// follow-up schedule). The only persisted B12 state is per-user read. No new RG truth, no
// player communication, no PII, no marketing. Deterministic server-side notification ids;
// titles are fixed templates. No I/O here (the server module reads the source rows).

import { createHash } from 'node:crypto';

export const B12_TYPES = ['SELF_EXCLUSION_ALERT', 'FOLLOW_UP_DUE', 'FOLLOW_UP_OVERDUE'] as const;
export type B12Type = (typeof B12_TYPES)[number];
export type B12Priority = 'HIGH' | 'NORMAL';

export const B12_PRIORITY: Record<B12Type, B12Priority> = {
  SELF_EXCLUSION_ALERT: 'HIGH', FOLLOW_UP_OVERDUE: 'HIGH', FOLLOW_UP_DUE: 'NORMAL',
};
export const B12_TITLE: Record<B12Type, string> = {
  SELF_EXCLUSION_ALERT: 'Protection alert requires review',
  FOLLOW_UP_DUE: 'A follow-up is due today',
  FOLLOW_UP_OVERDUE: 'A follow-up is overdue',
};
// Click-through to an EXISTING governed page (which re-authorises). No sensitive query data.
export const B12_TARGET: Record<B12Type, string> = {
  SELF_EXCLUSION_ALERT: '/casino/responsible-profitability/alerts',
  FOLLOW_UP_DUE: '/casino/responsible-profitability/interventions',
  FOLLOW_UP_OVERDUE: '/casino/responsible-profitability/interventions',
};
// The exact B8 scheduling audit actions that constitute a schedule revision (locked to B8).
export const B12_B8_SCHEDULE_ACTIONS = [
  'intervention.follow_up_scheduled', 'intervention.follow_up_rescheduled', 'intervention.follow_up_unscheduled',
] as const;
export const B12_SCHEDULE_REVISION_FALLBACK = 'b12-initial';

const US = '\x1f';   // ASCII unit separator — unambiguous canonical delimiter
/** Deterministic, PII-free, casino+state notification id (lowercase 64-hex). Identical for
 *  all authorised staff of the same casino viewing the same logical item. */
export function notificationId(parts: readonly string[]): string {
  return createHash('sha256').update(['b12v1', ...parts].join(US), 'utf8').digest('hex');
}
export const NOTIFICATION_ID_RE = /^[0-9a-f]{64}$/;
export function isNotificationId(v: unknown): v is string { return typeof v === 'string' && NOTIFICATION_ID_RE.test(v); }

// ── Current SAST business date ──
export function sastToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

// ── Source row shapes (minimal projections read by the server) ──
export interface SelfExclusionAlertRow { id: string; generated_at: string | null; status: string }
export interface FollowUpRow { id: string; follow_up_required: boolean | null; follow_up_date: string | null }

export interface B12Item {
  notificationId: string;
  type: B12Type;
  priority: B12Priority;
  title: string;
  effectiveAt: string | null;
  attentionDate: string | null;
  read: boolean;
  targetHref: string;
}

/** Build the current active items for one governed casino from source rows + read-state.
 *  revisionByIv maps intervention_id → schedule_revision_token (B8 audit event_id or fallback). */
export function projectNotifications(input: {
  casinoId: string;
  alerts: SelfExclusionAlertRow[];                 // already filtered to SELF_EXCLUSION_BREACH_REVIEW, own casino
  interventions: FollowUpRow[];                    // already filtered to follow_up_required=true & dated, own casino
  revisionByIv: Map<string, string>;               // intervention_id → latest B8 scheduling event_id (or absent)
  revisionEffectiveByIv?: Map<string, string | null>; // intervention_id → latest B8 scheduling created_at (or absent)
  readIds: Set<string>;                            // notification_ids this user has read
  today?: string;
}): { items: B12Item[]; unreadCount: number } {
  const { casinoId, alerts, interventions, revisionByIv, revisionEffectiveByIv, readIds } = input;
  const today = input.today ?? sastToday();
  const items: B12Item[] = [];

  for (const a of alerts) {
    if (a.status !== 'OPEN' && a.status !== 'ACKNOWLEDGED') continue;   // RESOLVED ⇒ inactive
    const id = notificationId([casinoId, 'SELF_EXCLUSION_ALERT', a.id]);
    items.push({
      notificationId: id, type: 'SELF_EXCLUSION_ALERT', priority: 'HIGH',
      title: B12_TITLE.SELF_EXCLUSION_ALERT, effectiveAt: a.generated_at ?? null, attentionDate: null,
      read: readIds.has(id), targetHref: B12_TARGET.SELF_EXCLUSION_ALERT,
    });
  }

  for (const iv of interventions) {
    if (iv.follow_up_required !== true || !iv.follow_up_date) continue;
    const type: B12Type | null = iv.follow_up_date === today ? 'FOLLOW_UP_DUE'
      : iv.follow_up_date < today ? 'FOLLOW_UP_OVERDUE' : null;   // future ⇒ not attention-worthy yet
    if (!type) continue;
    const rev = revisionByIv.get(iv.id) ?? B12_SCHEDULE_REVISION_FALLBACK;
    const id = notificationId([casinoId, type, iv.id, iv.follow_up_date, rev]);
    items.push({
      notificationId: id, type, priority: B12_PRIORITY[type], title: B12_TITLE[type],
      effectiveAt: revisionEffectiveByIv?.get(iv.id) ?? null, attentionDate: iv.follow_up_date,
      read: readIds.has(id), targetHref: B12_TARGET[type],
    });
  }

  orderItems(items);
  const unreadCount = items.reduce((n, i) => n + (i.read ? 0 : 1), 0);
  return { items, unreadCount };
}

const PRIORITY_RANK: Record<B12Priority, number> = { HIGH: 0, NORMAL: 1 };
/** HIGH before NORMAL; then effectiveAt||attentionDate DESC; then notificationId ASC. */
export function orderItems(items: B12Item[]): B12Item[] {
  items.sort((a, b) => {
    if (PRIORITY_RANK[a.priority] !== PRIORITY_RANK[b.priority]) return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    const at = a.effectiveAt ?? a.attentionDate ?? '', bt = b.effectiveAt ?? b.attentionDate ?? '';
    if (at !== bt) return at < bt ? 1 : -1;   // DESC
    return a.notificationId < b.notificationId ? -1 : a.notificationId > b.notificationId ? 1 : 0;
  });
  return items;
}

// ── mark-read body (no fields) + RPC status mapping ──
export type EmptyBodyParse = { ok: true } | { ok: false; code: string; error: string };
export function parseEmptyBody(body: unknown): EmptyBodyParse {
  if (body === null || body === undefined) return { ok: true };
  if (typeof body !== 'object' || Array.isArray(body)) return { ok: false, code: 'BODY', error: 'request body must be empty' };
  if (Object.keys(body as object).length > 0) return { ok: false, code: 'UNEXPECTED_FIELD', error: 'no fields are accepted' };
  return { ok: true };
}

export type B12MarkStatus = 'READ' | 'NOOP';
export const B12_MARK_STATUSES: readonly B12MarkStatus[] = ['READ', 'NOOP'];

export const B12_LIST_LIMIT_DEFAULT = 50;
export const B12_LIST_LIMIT_MAX = 100;
