// ─── Pilot Federation Cryptographic Operations — public API (Milestone 4.2) ──
//
// HMAC-SHA-256 keyed federation hashing with a versioned collision-safe canonical
// input, jurisdiction-isolated peppers, governed lifecycle/rotation, bounded
// caching, fail-closed behaviour, compromise response, and secret-free audit.
// PILOT NON-PRODUCTION ONLY. A managed AWS Secrets Manager / HSM binding is the
// documented deployment binding (condition C4 residual).

export {
  HMAC_ALGORITHM, CANONICAL_FORMAT_VERSION, NORMALISATION_VERSION, CONTRIBUTION_SCHEMA_VERSION,
  DOMAIN_SEPARATION_LABEL, canonicalHashInput,
  PEPPER_STATES, PEPPER_TRANSITIONS, canTransition,
  type PepperState, type PepperMetadata, type ContributionCryptoStamp, type FederationAttributeHash,
  CryptoError,
  CRYPTO_AUDIT_ACTIONS, type CryptoAuditAction, type CryptoAuditRecord, type CryptoAuditSink,
  InMemoryCryptoAuditSink, sealCryptoAudit,
} from './model.ts';

export {
  type PepperSecretStore, InMemoryPilotSecretStore, type PilotSecretStoreSeed,
} from './secretStore.ts';

export {
  FederationCryptoProvider, PepperOperations, sameCryptoVersion,
  CRYPTO_ROLES, type CryptoRole, type CryptoActorContext, type RotationState, type FederationCryptoOptions,
} from './provider.ts';
