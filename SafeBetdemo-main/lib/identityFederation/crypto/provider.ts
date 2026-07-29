// ─── Pilot Federation Cryptographic Provider + Pepper Operations (4.2) ───────
//
// A NARROW injected cryptographic provider for the domain (HMAC only; never
// exposes raw secrets / secret-store clients / general encryption), plus a
// GOVERNED pepper-operations layer (provision / rotate / retire / revoke /
// compromise / disable / reactivate) with least-privilege actor roles, bounded
// caching, fail-closed behaviour, and a secret-free cryptographic audit.
// PILOT NON-PRODUCTION ONLY. No fallback to unkeyed / demo / global pepper.

import type { JurisdictionCode, AttributeType } from '../types.ts';
import { isAttributeEnabled } from '../jurisdictionProfiles.ts';
import { normaliseAttribute } from '../security.ts';
import { type PepperSecretStore } from './secretStore.ts';
import {
  type FederationAttributeHash, type ContributionCryptoStamp, type PepperMetadata,
  type CryptoAuditSink, type CryptoAuditAction, InMemoryCryptoAuditSink, sealCryptoAudit,
  canonicalHashInput, CryptoError,
  HMAC_ALGORITHM, CANONICAL_FORMAT_VERSION, NORMALISATION_VERSION, CONTRIBUTION_SCHEMA_VERSION,
} from './model.ts';

export interface RotationState {
  jurisdiction: JurisdictionCode;
  activeVersion: string | null;
  transitionVersions: string[];
  recognisedVersions: string[];
}

export interface FederationCryptoOptions {
  store: PepperSecretStore;
  auditSink?: CryptoAuditSink;
  now?: () => string;
  cacheTtlMs?: number;
}

interface CacheEntry { active: string; recognised: string[]; at: number; }

/**
 * Narrow federation cryptographic provider. The ONLY operations exposed to the
 * domain: hash an attribute, verify a version, read rotation state, invalidate
 * the cache, and report safe health. Fails CLOSED on any error.
 */
export class FederationCryptoProvider {
  private readonly store: PepperSecretStore;
  private readonly auditSink: CryptoAuditSink;
  private readonly now: () => string;
  private readonly cacheTtlMs: number;
  private readonly cache = new Map<JurisdictionCode, CacheEntry>();

  constructor(opts: FederationCryptoOptions) {
    this.store = opts.store;
    this.auditSink = opts.auditSink ?? new InMemoryCryptoAuditSink();
    this.now = opts.now ?? (() => new Date().toISOString());
    this.cacheTtlMs = opts.cacheTtlMs ?? 30_000;
  }

  /** Hash an approved attribute with the jurisdiction's ACTIVE pepper. Fails closed. */
  hashAttribute(jurisdiction: JurisdictionCode, attributeType: AttributeType, value: string): FederationAttributeHash {
    if (!isAttributeEnabled(jurisdiction, attributeType)) throw new CryptoError('attribute-not-approved', `attribute '${attributeType}' is not approved in '${jurisdiction}'`);
    const version = this.activeVersion(jurisdiction);
    return this.hashAttributeVersion(jurisdiction, attributeType, value, version);
  }

  /** Hash with an EXPLICIT recognised version (e.g. dual-version transition). Fails closed. */
  hashAttributeVersion(jurisdiction: JurisdictionCode, attributeType: AttributeType, value: string, version: string): FederationAttributeHash {
    if (!isAttributeEnabled(jurisdiction, attributeType)) throw new CryptoError('attribute-not-approved', `attribute '${attributeType}' is not approved in '${jurisdiction}'`);
    if (!this.verifyVersion(jurisdiction, version)) { this.audit('unsupported-version-rejected', jurisdiction, version, 'system', `version ${version} not recognised`); throw new CryptoError('unsupported-version', `pepper version '${version}' is not recognised for '${jurisdiction}'`); }
    const normalised = normaliseAttribute(attributeType, value);           // plaintext stays local; never logged
    const input = canonicalHashInput(jurisdiction, attributeType, normalised);
    let hash: string;
    try {
      hash = this.store.computeHmac(jurisdiction, version, input);         // pepper never leaves the store
    } catch (e) {
      this.audit('secret-retrieval-failed', jurisdiction, version, 'system', (e as CryptoError).code ?? 'error');
      throw e;                                                             // FAIL CLOSED — no fallback hashing
    }
    const stamp: ContributionCryptoStamp = {
      jurisdiction, attributeType, algorithm: HMAC_ALGORITHM,
      canonicalFormatVersion: CANONICAL_FORMAT_VERSION, normalisationVersion: NORMALISATION_VERSION,
      pepperVersion: version, contributionSchemaVersion: CONTRIBUTION_SCHEMA_VERSION,
    };
    return { attributeType, hash, pepperKeyVersion: version, stamp };
  }

  verifyVersion(jurisdiction: JurisdictionCode, version: string): boolean {
    return this.recognised(jurisdiction).includes(version);
  }

  rotationState(jurisdiction: JurisdictionCode): RotationState {
    const meta = this.store.allMetadata(jurisdiction);
    const active = meta.find((m) => m.state === 'active')?.version ?? null;
    const transitionVersions = meta.filter((m) => m.state === 'transition').map((m) => m.version).sort();
    return { jurisdiction, activeVersion: active, transitionVersions, recognisedVersions: this.recognised(jurisdiction) };
  }

  invalidateCache(jurisdiction?: JurisdictionCode): void {
    if (jurisdiction) this.cache.delete(jurisdiction); else this.cache.clear();
    this.audit('cache-invalidated', jurisdiction ?? null, null, 'system', 'cache invalidated');
  }

  health(): { store: ReturnType<PepperSecretStore['health']>; cached: number; auditEvents: number } {
    return { store: this.store.health(), cached: this.cache.size, auditEvents: this.auditSink.count() };
  }

  auditTrail(): readonly ReturnType<CryptoAuditSink['list']>[number][] { return this.auditSink.list(); }

  // ── internals ───────────────────────────────────────────────────────────────
  private activeVersion(jurisdiction: JurisdictionCode): string {
    const entry = this.cache.get(jurisdiction);
    if (entry && Date.now() - entry.at < this.cacheTtlMs) return entry.active;
    const active = this.store.activeVersion(jurisdiction);                 // throws (fail closed) if none/disabled
    this.cache.set(jurisdiction, { active, recognised: this.store.recognisedVersions(jurisdiction), at: Date.now() });
    return active;
  }

  private recognised(jurisdiction: JurisdictionCode): string[] {
    const entry = this.cache.get(jurisdiction);
    if (entry && Date.now() - entry.at < this.cacheTtlMs) return entry.recognised;
    let active: string; try { active = this.store.activeVersion(jurisdiction); } catch { active = ''; }
    const recognised = this.store.recognisedVersions(jurisdiction);
    if (active) this.cache.set(jurisdiction, { active, recognised, at: Date.now() });
    return recognised;
  }

  /** package-internal audit helper (also used by PepperOperations). */
  audit(action: CryptoAuditAction, jurisdiction: JurisdictionCode | null, pepperVersion: string | null, actor: string, reason: string): void {
    this.auditSink.append(sealCryptoAudit({ at: this.now(), action, jurisdiction, pepperVersion, actor, reason, algorithm: HMAC_ALGORITHM, canonicalFormatVersion: CANONICAL_FORMAT_VERSION }));
  }
}

// ── Governed pepper operations (least-privilege actor roles) ─────────────────

export const CRYPTO_ROLES = ['key-admin', 'rotation-authority', 'revocation-authority', 'auditor'] as const;
export type CryptoRole = (typeof CRYPTO_ROLES)[number];
export interface CryptoActorContext { actorRef: string; roles: CryptoRole[]; }

function requireRole(ctx: CryptoActorContext | undefined, ...allowed: CryptoRole[]): void {
  if (!ctx || !Array.isArray(ctx.roles) || !ctx.roles.some((r) => allowed.includes(r))) {
    throw new CryptoError('unauthorised', `this operation requires one of: ${allowed.join(', ')}`);
  }
}

/** Store shape the operations layer needs (the in-memory pilot store satisfies it). */
interface MutableSecretStore extends PepperSecretStore {
  provision(jurisdiction: JurisdictionCode, version: string, actor: string): PepperMetadata;
  transitionState(jurisdiction: JurisdictionCode, version: string, to: import('./model.ts').PepperState, actor: string, rotationRef?: string): PepperMetadata;
}

export class PepperOperations {
  private readonly store: MutableSecretStore;
  private readonly provider: FederationCryptoProvider;
  private readonly now: () => string;

  constructor(store: MutableSecretStore, provider: FederationCryptoProvider, now: () => string = () => new Date().toISOString()) {
    this.store = store; this.provider = provider; this.now = now;
  }

  provision(actor: CryptoActorContext, jurisdiction: JurisdictionCode, version: string): PepperMetadata {
    requireRole(actor, 'key-admin');
    const m = this.store.provision(jurisdiction, version, actor.actorRef);
    this.provider.audit('pepper-provisioned', jurisdiction, version, actor.actorRef, 'pepper provisioned');
    return m;
  }

  /**
   * Governed rotation with dual-version transition. Provisions + activates the new
   * version, then moves the previous active version to 'transition'. Old and new
   * outputs are NOT comparable and are never treated as equal (segregate by
   * pepperVersion). A failure before the new version is active rolls back safely
   * (the previous version remains active).
   */
  rotate(actor: CryptoActorContext, jurisdiction: JurisdictionCode, newVersion: string): { previous: string; active: string; transition: string[] } {
    requireRole(actor, 'key-admin', 'rotation-authority');
    const previous = this.store.activeVersion(jurisdiction);               // throws if none (rollback = nothing changed)
    this.store.provision(jurisdiction, newVersion, actor.actorRef);        // throws if exists (rollback = nothing changed)
    this.store.transitionState(jurisdiction, newVersion, 'active', actor.actorRef, `rotate:${previous}->${newVersion}`);
    this.store.transitionState(jurisdiction, previous, 'transition', actor.actorRef, `rotate:${previous}->${newVersion}`);
    this.provider.audit('rotation-completed', jurisdiction, newVersion, actor.actorRef, `rotated ${previous} → ${newVersion}`);
    this.provider.invalidateCache(jurisdiction);
    return { previous, active: newVersion, transition: [previous] };
  }

  retire(actor: CryptoActorContext, jurisdiction: JurisdictionCode, version: string): PepperMetadata {
    requireRole(actor, 'key-admin', 'rotation-authority');
    const m = this.store.transitionState(jurisdiction, version, 'retired', actor.actorRef);
    this.provider.audit('pepper-retired', jurisdiction, version, actor.actorRef, 'pepper retired after transition');
    this.provider.invalidateCache(jurisdiction);
    return m;
  }

  revoke(actor: CryptoActorContext, jurisdiction: JurisdictionCode, version: string): PepperMetadata {
    requireRole(actor, 'revocation-authority');
    const m = this.store.transitionState(jurisdiction, version, 'revoked', actor.actorRef);
    this.provider.audit('pepper-revoked', jurisdiction, version, actor.actorRef, 'pepper revoked');
    this.provider.invalidateCache(jurisdiction);
    return m;
  }

  /** Controlled compromise: mark compromised, destroy material, disable new contributions, preserve audit. */
  markCompromised(actor: CryptoActorContext, jurisdiction: JurisdictionCode, version: string, reason: string): PepperMetadata {
    requireRole(actor, 'revocation-authority');
    const m = this.store.transitionState(jurisdiction, version, 'compromised', actor.actorRef);
    this.provider.audit('pepper-compromised', jurisdiction, version, actor.actorRef, reason);
    this.provider.audit('emergency-disablement', jurisdiction, version, actor.actorRef, 'new contributions disabled for jurisdiction pending review');
    this.provider.invalidateCache(jurisdiction);
    return m;
  }

  /** Disable a jurisdiction (active pepper → disabled); new contributions fail closed. */
  disableJurisdiction(actor: CryptoActorContext, jurisdiction: JurisdictionCode): PepperMetadata {
    requireRole(actor, 'revocation-authority', 'key-admin');
    const active = this.store.activeVersion(jurisdiction);
    const m = this.store.transitionState(jurisdiction, active, 'disabled', actor.actorRef);
    this.provider.audit('emergency-disablement', jurisdiction, active, actor.actorRef, 'jurisdiction disabled');
    this.provider.invalidateCache(jurisdiction);
    return m;
  }

  /** Reactivate a disabled jurisdiction — requires an explicit approved-review flag. */
  reactivateJurisdiction(actor: CryptoActorContext, jurisdiction: JurisdictionCode, version: string, approvedReview: boolean): PepperMetadata {
    requireRole(actor, 'key-admin');
    if (!approvedReview) throw new CryptoError('reactivation-not-approved', 'reactivation requires an approved security/privacy review');
    const m = this.store.transitionState(jurisdiction, version, 'active', actor.actorRef);
    this.provider.audit('jurisdiction-reactivation', jurisdiction, version, actor.actorRef, 'jurisdiction reactivated after approved review');
    this.provider.invalidateCache(jurisdiction);
    return m;
  }
}

/** Two hashes are comparable only when their cryptographic version stamps match (matching segregation). */
export function sameCryptoVersion(a: FederationAttributeHash, b: FederationAttributeHash): boolean {
  return a.pepperKeyVersion === b.pepperKeyVersion
    && a.stamp.canonicalFormatVersion === b.stamp.canonicalFormatVersion
    && a.stamp.normalisationVersion === b.stamp.normalisationVersion
    && a.stamp.algorithm === b.stamp.algorithm;
}
