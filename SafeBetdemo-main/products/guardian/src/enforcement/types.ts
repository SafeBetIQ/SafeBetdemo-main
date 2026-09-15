// ─── SafeBet Guardian — Enforcement Orchestration types (ARCH-V4-C9) ──────────
//
// Provider-neutral orchestration of C8-authorised actions to SYNTHETIC providers. Guardian
// ORCHESTRATES/REFERS/PUBLISHES authorised requests; the EXTERNAL provider performs the
// provider-side action. No real provider, no external network call, no automatic enforcement.
//
// ACKNOWLEDGED != ACTIONED · ACTIONED != VERIFIED · PUBLISHED != PROVIDER COMPLIED ·
// DECLINED != TECHNICAL FAILURE. C9 creates NO authorisation authority and cannot widen scope.

import type { ActionType, TargetType } from '../authorisation/types.ts';

export type OrchestrationStatus = 'AUTHORISED' | 'READY' | 'PUBLISHED' | 'REFERRED' | 'ACKNOWLEDGED' | 'UNDER_REVIEW' | 'MORE_INFO_REQUIRED' | 'ACTIONED' | 'DECLINED' | 'VERIFIED' | 'CLOSED' | 'EXPIRED' | 'WITHDRAWN' | 'ORCHESTRATION_BLOCKED';
export type ProviderState = 'ACKNOWLEDGED' | 'UNDER_REVIEW' | 'MORE_INFO_REQUIRED' | 'ACTIONED' | 'DECLINED';
export type EnforcementProviderType = 'SYNTHETIC_ISP' | 'SYNTHETIC_DNS_PROVIDER' | 'SYNTHETIC_REGISTRAR' | 'SYNTHETIC_REGISTRY' | 'SYNTHETIC_HOST' | 'SYNTHETIC_PAYMENT_PROVIDER' | 'SYNTHETIC_MOBILE_PLATFORM' | 'SYNTHETIC_GEO_PROVIDER';
export type VerificationType = 'DOMAIN_UNAVAILABLE' | 'DNS_POLICY_OBSERVED' | 'HOSTING_STATUS_CHANGED' | 'REGISTRAR_STATUS_CHANGED' | 'APP_LISTING_CHANGED' | 'PAYMENT_CHANNEL_STATUS_CHANGED' | 'GEO_RESTRICTION_OBSERVED' | 'OTHER';
export type VerificationResult = 'VERIFIED' | 'NOT_VERIFIED' | 'INCONCLUSIVE';
export type ProviderReasonCode = 'INSUFFICIENT_INFORMATION' | 'INVALID_SCOPE' | 'AUTHORITY_REFERENCE_REQUIRED' | 'TECHNICAL_LIMITATION' | 'OUTSIDE_PROVIDER_SCOPE' | 'OTHER';

export type OrchestrationReasonCode =
  | 'AUTHORISATION_NOT_FOUND' | 'AUTHORISATION_NOT_AUTHORISED' | 'AUTHORISATION_EXPIRED'
  | 'AUTHORISATION_WITHDRAWN' | 'AUTHORISATION_SUPERSEDED' | 'JURISDICTION_INVALID'
  | 'POLICY_REFERENCE_MISSING' | 'AUTHORITY_REFERENCE_MISSING' | 'EVIDENCE_MANIFEST_MISSING'
  | 'SCOPE_MUTATED' | 'NO_PROVIDER_CHANNEL' | 'ACTION_NOT_SUPPORTED_BY_CHANNEL' | 'PRINCIPAL_NOT_AUTHENTICATED';

/** The bounded C8 AuthorisedActionContract snapshot C9 consumes (never C8 base tables). */
export interface AuthorisedActionSnapshot {
  authorisationReference: string;
  actionType: ActionType;
  targetType: TargetType;
  targetReference: string;
  jurisdiction: string;
  policyReference: string | null;
  authorityReference: string | null;
  caseReference: string;
  evidenceManifestReference: string | null;
  evidenceManifestHash: string | null;
  authorisedAt: string | null;
  expiresAt: string | null;
  status: 'AUTHORISED' | 'DECLINED' | 'WITHDRAWN' | 'EXPIRED' | 'SUPERSEDED' | 'PENDING';
}

export interface ProviderChannel {
  providerChannelId: string;
  providerType: EnforcementProviderType;
  jurisdiction: string;
  supportedActionTypes: ActionType[];
  deliveryMethod: 'SYNTHETIC_ADAPTER';
  isSynthetic: true;
}

/** Result of a synthetic provider dispatch (provider-originated state comes ONLY from here). */
export interface SyntheticProviderResult {
  delivered: boolean;              // false => technical delivery failure (retryable)
  providerState: ProviderState | null;
  providerReference: string | null;
  reasonCode: ProviderReasonCode | null;
  requestPayloadHash: string;
}

export interface OrchestrationDecision {
  product: 'GUARDIAN';
  jurisdiction: string;
  orchestrationId: string;
  authorisationReference: string;
  actionType: ActionType;
  targetReference: string;
  providerChannel: string | null;
  status: OrchestrationStatus;
  reasonCodes: OrchestrationReasonCode[];
  requestPayloadHash: string | null;
  requestVersion: number;
  isRealProvider: false;
  isExternalNetworkCall: false;
  note: string;
}
