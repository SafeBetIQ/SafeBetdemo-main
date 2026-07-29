// ─── Operator Federation Contribution — public API (Milestone 4.3) ───────────
//
// Hash-only federation contribution path through a certified (non-production)
// Event Platform boundary → deterministic projector → certified Matching Engine.
// The Event Platform is authoritative; no direct downstream insertion. No live
// operator connector (Phase 4.4). PILOT NON-PRODUCTION ONLY. No plaintext PII.

export {
  FEDERATION_CONTRIBUTION_EVENT_TYPE, EVENT_SCHEMA_VERSION, MAX_EVENT_BYTES,
  ALLOWED_EVENT_FIELDS, REJECTION_REASONS, PERMANENT_REJECTIONS, DEADLETTER_CLASSES,
  CONTRIBUTION_AUDIT_ACTIONS,
  type FederationContributionEvent, type AcceptedContributionRecord, type RejectionRecord,
  type DeadLetterRecord, type DeadLetterClass, type RejectionReason,
  type ContributionAuditRecord, type ContributionAuditAction, type ContributionAuditSink,
  InMemoryContributionAuditSink, sealContributionAudit,
  ContributionRejected, validateEventSchema, contentKeyOf,
} from './model.ts';

export {
  type SbPlrStatus, type SbPlrIdentity, type SbPlrResolver, InMemorySbPlrDirectory,
  validateContributionSbPlr,
} from './identity.ts';

export {
  FederationEventPlatform, ContributionAccessError, TransientProcessingError,
  type ContributionPlane, type ContributionServiceContext, type SubmitResult, type EventPlatformOptions,
} from './eventPlatform.ts';

export {
  ContributionProjector, candidateProvenance, type ProjectionResult, type ProjectorOptions,
} from './projector.ts';

export {
  SyntheticOperatorHarness, type HarnessOptions, type SyntheticContributionOptions,
} from './harness.ts';
