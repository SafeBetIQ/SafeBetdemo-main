// ─── SafeBet IQ — B13.1 Governed Player Communication Core (pure domain layer) ───
//
// Operator-mediated, human-confirmed, responsible-gambling-only, intervention-linked,
// versioned-template-governed, SANDBOX-delivery-only player-communication core. No PII, no
// free text, no AI, no marketing, no real delivery. The DB RPCs are the integrity authority
// (idempotency, sequence, lifecycle CHECK, audit). No I/O here.

import { createHash } from 'node:crypto';

// Eligible B9 intervention types (manual_review / ai_alert are prohibited).
export const B13_ELIGIBLE_INTERVENTION_TYPES = ['limit_setting', 'timeout', 'self_exclusion_referral', 'helpline_referral', 'counseling_referral'] as const;
export type B13EligibleInterventionType = (typeof B13_ELIGIBLE_INTERVENTION_TYPES)[number];

export const B13_COMMUNICATION_TYPES = ['LIMIT_CONFIRMATION', 'TIMEOUT_CONFIRMATION', 'SELF_EXCLUSION_SUPPORT', 'HELPLINE_SUPPORT', 'COUNSELLING_SUPPORT'] as const;
export type B13CommunicationType = (typeof B13_COMMUNICATION_TYPES)[number];

export const B13_PURPOSE = 'RESPONSIBLE_GAMBLING' as const;
export const B13_DELIVERY_MODE = 'SANDBOX' as const;          // B13.1 is sandbox only
export const B13_CHANNEL_CLASS = 'OPERATOR_MANAGED' as const;
export const B13_TEMPLATE_VERSION = 1 as const;

export const B13_FAILURE_CLASSES = ['RECIPIENT_UNAVAILABLE', 'CHANNEL_NOT_AVAILABLE', 'PROVIDER_REJECTED', 'TEMPORARY_FAILURE', 'PERMANENT_FAILURE', 'POLICY_BLOCKED'] as const;

// Locked mapping: intervention type → communication type → template key.
const TYPE_FOR_INTERVENTION: Record<B13EligibleInterventionType, B13CommunicationType> = {
  limit_setting: 'LIMIT_CONFIRMATION', timeout: 'TIMEOUT_CONFIRMATION',
  self_exclusion_referral: 'SELF_EXCLUSION_SUPPORT', helpline_referral: 'HELPLINE_SUPPORT', counseling_referral: 'COUNSELLING_SUPPORT',
};
const KEY_FOR_TYPE: Record<B13CommunicationType, string> = {
  LIMIT_CONFIRMATION: 'rg.limit_confirmation', TIMEOUT_CONFIRMATION: 'rg.timeout_confirmation',
  SELF_EXCLUSION_SUPPORT: 'rg.self_exclusion_support', HELPLINE_SUPPORT: 'rg.helpline_support', COUNSELLING_SUPPORT: 'rg.counselling_support',
};
export function communicationTypeForIntervention(t: string): B13CommunicationType | null {
  return (B13_ELIGIBLE_INTERVENTION_TYPES as readonly string[]).includes(t) ? TYPE_FOR_INTERVENTION[t as B13EligibleInterventionType] : null;
}
export function templateKeyForCommunicationType(t: string): string | null {
  return (B13_COMMUNICATION_TYPES as readonly string[]).includes(t) ? KEY_FOR_TYPE[t as B13CommunicationType] : null;
}

// SANDBOX templates — labelled; NOT approved for real player delivery (B13.2 owner policy).
export interface B13Template {
  templateKey: string; templateVersion: number; communicationType: B13CommunicationType;
  label: string; sandboxBody: string; variables: readonly string[];
}
const SANDBOX_NOTICE = 'SANDBOX TEMPLATE — NOT APPROVED FOR REAL PLAYER DELIVERY.';
export const B13_SANDBOX_TEMPLATES: Record<string, B13Template> = {
  'rg.limit_confirmation': { templateKey: 'rg.limit_confirmation', templateVersion: 1, communicationType: 'LIMIT_CONFIRMATION', label: 'Limit confirmation', sandboxBody: `${SANDBOX_NOTICE} Your account limit has been updated. Support is available at {{support_contact_label}} ({{support_url}}). Reference {{support_reference}}.`, variables: ['effective_date', 'support_reference', 'support_contact_label', 'support_url'] },
  'rg.timeout_confirmation': { templateKey: 'rg.timeout_confirmation', templateVersion: 1, communicationType: 'TIMEOUT_CONFIRMATION', label: 'Timeout confirmation', sandboxBody: `${SANDBOX_NOTICE} Your cooling-off period is in effect until {{expiry_date}}. Support is available at {{support_contact_label}} ({{support_url}}). Reference {{support_reference}}.`, variables: ['expiry_date', 'support_reference', 'support_contact_label', 'support_url'] },
  'rg.self_exclusion_support': { templateKey: 'rg.self_exclusion_support', templateVersion: 1, communicationType: 'SELF_EXCLUSION_SUPPORT', label: 'Self-exclusion support', sandboxBody: `${SANDBOX_NOTICE} Support resources are available at {{support_contact_label}} ({{support_url}}). Reference {{support_reference}}.`, variables: ['support_reference', 'support_contact_label', 'support_url'] },
  'rg.helpline_support': { templateKey: 'rg.helpline_support', templateVersion: 1, communicationType: 'HELPLINE_SUPPORT', label: 'Helpline support', sandboxBody: `${SANDBOX_NOTICE} Help is available at {{support_contact_label}} ({{support_url}}). Reference {{support_reference}}.`, variables: ['support_reference', 'support_contact_label', 'support_url'] },
  'rg.counselling_support': { templateKey: 'rg.counselling_support', templateVersion: 1, communicationType: 'COUNSELLING_SUPPORT', label: 'Counselling support', sandboxBody: `${SANDBOX_NOTICE} Counselling resources are available at {{support_contact_label}} ({{support_url}}). Reference {{support_reference}}.`, variables: ['support_reference', 'support_contact_label', 'support_url'] },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function b13IsUuid(v: unknown): v is string { return typeof v === 'string' && UUID_RE.test(v); }

export type IdemParse = { ok: true; key: string } | { ok: false; code: string; error: string };
export function parseIdempotencyKey(header: string | null | undefined): IdemParse {
  if (!header) return { ok: false, code: 'IDEMPOTENCY_KEY_REQUIRED', error: 'Idempotency-Key header is required' };
  if (!b13IsUuid(header)) return { ok: false, code: 'IDEMPOTENCY_KEY_INVALID', error: 'Idempotency-Key must be a uuid' };
  return { ok: true, key: header };
}

export type CreateBodyParse = { ok: true; communicationType: B13CommunicationType; templateKey: string } | { ok: false; code: string; error: string };
/** Create accepts ONLY { communicationType, templateKey }; version/purpose/mode/channel are server-governed. */
export function parseCreateBody(body: unknown): CreateBodyParse {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, code: 'BODY', error: 'request body is required' };
  const rec = body as Record<string, unknown>;
  for (const k of Object.keys(rec)) if (k !== 'communicationType' && k !== 'templateKey') return { ok: false, code: 'UNEXPECTED_FIELD', error: `field not accepted: ${k}` };
  if (!(B13_COMMUNICATION_TYPES as readonly string[]).includes(rec.communicationType as string)) return { ok: false, code: 'COMMUNICATION_TYPE', error: 'invalid communicationType' };
  const expectedKey = templateKeyForCommunicationType(rec.communicationType as string);
  if (typeof rec.templateKey !== 'string' || rec.templateKey !== expectedKey) return { ok: false, code: 'TEMPLATE_KEY', error: 'templateKey must match communicationType' };
  return { ok: true, communicationType: rec.communicationType as B13CommunicationType, templateKey: rec.templateKey };
}

export type EmptyBodyParse = { ok: true } | { ok: false; code: string; error: string };
export function parseEmptyBody(body: unknown): EmptyBodyParse {
  if (body === null || body === undefined) return { ok: true };
  if (typeof body !== 'object' || Array.isArray(body)) return { ok: false, code: 'BODY', error: 'request body must be empty' };
  if (Object.keys(body as object).length > 0) return { ok: false, code: 'UNEXPECTED_FIELD', error: 'no fields are accepted' };
  return { ok: true };
}

// RPC status → HTTP mappings.
export type CreateStatus = 'CREATED' | 'REPLAYED' | 'IDEMPOTENCY_CONFLICT' | 'INVALID_STATE' | 'NOT_FOUND';
export type SendStatus = 'BEGUN' | 'REPLAYED' | 'IDEMPOTENCY_CONFLICT' | 'INVALID_STATE' | 'NOT_FOUND';
export const CREATE_STATUSES: readonly CreateStatus[] = ['CREATED', 'REPLAYED', 'IDEMPOTENCY_CONFLICT', 'INVALID_STATE', 'NOT_FOUND'];
export const SEND_STATUSES: readonly SendStatus[] = ['BEGUN', 'REPLAYED', 'IDEMPOTENCY_CONFLICT', 'INVALID_STATE', 'NOT_FOUND'];
export function httpForCreate(s: CreateStatus): { status: number; ok: boolean; code?: string } {
  switch (s) {
    case 'CREATED': return { status: 201, ok: true };
    case 'REPLAYED': return { status: 200, ok: true, code: 'REPLAYED' };
    case 'IDEMPOTENCY_CONFLICT': return { status: 409, ok: false, code: 'IDEMPOTENCY_CONFLICT' };
    case 'INVALID_STATE': return { status: 409, ok: false, code: 'INVALID_STATE' };
    case 'NOT_FOUND': return { status: 404, ok: false };
  }
}
export function httpForSend(s: SendStatus): { status: number; ok: boolean; code?: string } {
  switch (s) {
    case 'BEGUN': return { status: 200, ok: true };
    case 'REPLAYED': return { status: 200, ok: true, code: 'REPLAYED' };
    case 'IDEMPOTENCY_CONFLICT': return { status: 409, ok: false, code: 'IDEMPOTENCY_CONFLICT' };
    case 'INVALID_STATE': return { status: 409, ok: false, code: 'INVALID_STATE' };
    case 'NOT_FOUND': return { status: 404, ok: false };
  }
}

/** PII-free deterministic sandbox transport token (same inputs → same token → same receipt). */
export function sandboxTransportToken(casinoId: string, communicationId: string, sendIdempotencyKey: string): string {
  return createHash('sha256').update(['b13-transport-v1', casinoId, communicationId, sendIdempotencyKey].join('\x1f'), 'utf8').digest('hex');
}
/** Opaque, PII-free sandbox provider reference. */
export function sandboxProviderReference(transportToken: string): string { return `sandbox:${transportToken.slice(0, 32)}`; }

// Safe history DTO (no player/contact/body/keys/fingerprints/raw receipt/audit ids).
export interface PlayerCommunicationRow {
  id: string; communication_type: string; template_key: string; template_version: number;
  delivery_mode: string; channel_class: string; status: string; sequence: number;
  requested_at: string; send_requested_at: string | null; submitted_at: string | null;
  delivered_at: string | null; failed_at: string | null; failure_class: string | null;
}
export interface PlayerCommunicationDTO {
  communicationId: string; communicationType: string; templateKey: string; templateVersion: number;
  deliveryMode: string; channelClass: string; status: string; sequence: number;
  requestedAt: string; sendRequestedAt: string | null; submittedAt: string | null;
  deliveredAt: string | null; failedAt: string | null; failureClass: string | null; sandbox: boolean;
}
export function mapCommunicationRow(r: PlayerCommunicationRow): PlayerCommunicationDTO {
  return {
    communicationId: r.id, communicationType: r.communication_type, templateKey: r.template_key, templateVersion: r.template_version,
    deliveryMode: r.delivery_mode, channelClass: r.channel_class, status: r.status, sequence: r.sequence,
    requestedAt: r.requested_at, sendRequestedAt: r.send_requested_at ?? null, submittedAt: r.submitted_at ?? null,
    deliveredAt: r.delivered_at ?? null, failedAt: r.failed_at ?? null, failureClass: r.failure_class ?? null,
    sandbox: r.delivery_mode === 'SANDBOX',
  };
}
export const B13_LIST_LIMIT = 50;
