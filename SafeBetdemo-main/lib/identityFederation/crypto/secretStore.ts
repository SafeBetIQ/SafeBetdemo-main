// ─── Pilot Federation Pepper Secret Store (Milestone 4.2) ────────────────────
//
// A NON-PRODUCTION, jurisdiction-isolated pepper secret store. Raw pepper
// material lives in a NON-EXPORTED module WeakMap (runtime-private) — there is no
// getter, no export, no serialisation; the store computes HMAC internally so the
// pepper NEVER leaves the store boundary. This is the pilot binding; a managed
// AWS Secrets Manager / HSM binding is the documented deployment binding (C4).

import { createHmac, randomBytes } from 'node:crypto';
import type { JurisdictionCode } from '../types.ts';
import {
  type PepperMetadata, type PepperState, CryptoError, canTransition,
  HMAC_ALGORITHM, CANONICAL_FORMAT_VERSION, NORMALISATION_VERSION,
} from './model.ts';

/** The narrow secret-store contract. Never exposes raw pepper material. */
export interface PepperSecretStore {
  activeVersion(jurisdiction: JurisdictionCode): string;
  recognisedVersions(jurisdiction: JurisdictionCode): string[];
  metadata(jurisdiction: JurisdictionCode, version: string): PepperMetadata;
  allMetadata(jurisdiction?: JurisdictionCode): PepperMetadata[];
  /** Compute an HMAC using an internally-held pepper. The pepper never leaves. */
  computeHmac(jurisdiction: JurisdictionCode, version: string, canonicalInput: string): string;
  health(): { jurisdictions: number; peppers: number; byState: Record<string, number> };
}

// Runtime-private raw pepper material (NON-EXPORTED module WeakMap + accessor).
// Neither the map nor the accessor is exported or reachable from an instance, so
// there is NO runtime handle to the raw pepper material (no `store.raw`, no getter).
const RAW = new WeakMap<InMemoryPilotSecretStore, Map<string, Buffer>>();
function rawOf(store: InMemoryPilotSecretStore): Map<string, Buffer> {
  const m = RAW.get(store);
  if (!m) throw new CryptoError('detached', 'secret store material is unavailable');
  return m;
}
const key = (j: JurisdictionCode, v: string) => `${j}:${v}`;
const secretRef = (j: JurisdictionCode, v: string) => `pilot-nonproduction/federation-pepper/${j}/${v}`;

export interface PilotSecretStoreSeed { jurisdictions: JurisdictionCode[]; now?: () => string; }

/**
 * In-memory pilot secret store (non-production). Seeds one active pepper per
 * jurisdiction. Governed lifecycle mutations happen via the crypto operations
 * layer; this store enforces jurisdiction isolation + fail-closed retrieval.
 */
export class InMemoryPilotSecretStore implements PepperSecretStore {
  private readonly meta = new Map<string, PepperMetadata>();
  private readonly now: () => string;

  constructor(seed: PilotSecretStoreSeed) {
    this.now = seed.now ?? (() => new Date().toISOString());
    RAW.set(this, new Map<string, Buffer>());
    for (const j of seed.jurisdictions) {
      this.provision(j, 'p1', 'system:seed');
      this.activate(j, 'p1', 'system:seed');
    }
  }

  // Raw pepper access is via the non-exported module accessor rawOf(this) only.

  // ── Governed lifecycle (called by the crypto operations layer) ──────────────
  provision(jurisdiction: JurisdictionCode, version: string, actor: string): PepperMetadata {
    const k = key(jurisdiction, version);
    if (this.meta.has(k)) throw new CryptoError('pepper-exists', `pepper ${k} already exists`);
    rawOf(this).set(k, randomBytes(32));                       // synthetic pilot secret; never exposed
    const m: PepperMetadata = {
      jurisdiction, version, state: 'provisioned', algorithm: HMAC_ALGORITHM,
      canonicalFormatVersion: CANONICAL_FORMAT_VERSION, normalisationVersion: NORMALISATION_VERSION,
      secretRef: secretRef(jurisdiction, version), activatedAt: null, retiredAt: null,
      rotationRef: null, actor, auditRef: null,
    };
    this.meta.set(k, m);
    return { ...m };
  }

  transitionState(jurisdiction: JurisdictionCode, version: string, to: PepperState, actor: string, rotationRef?: string): PepperMetadata {
    const k = key(jurisdiction, version);
    const m = this.meta.get(k);
    if (!m) throw new CryptoError('pepper-not-found', `pepper ${k} does not exist`);
    if (!canTransition(m.state, to)) throw new CryptoError('invalid-transition', `pepper ${k}: ${m.state} → ${to} is not permitted`);
    const next: PepperMetadata = {
      ...m, state: to, actor,
      activatedAt: to === 'active' ? this.now() : m.activatedAt,
      retiredAt: to === 'retired' ? this.now() : m.retiredAt,
      rotationRef: rotationRef ?? m.rotationRef,
    };
    this.meta.set(k, next);
    // Revoked / compromised material is destroyed (metadata retained).
    if (to === 'revoked' || to === 'compromised') rawOf(this).delete(k);
    return { ...next };
  }

  private activate(jurisdiction: JurisdictionCode, version: string, actor: string): void {
    this.transitionState(jurisdiction, version, 'active', actor);
  }

  // ── Retrieval (fail-closed; jurisdiction-isolated) ──────────────────────────
  activeVersion(jurisdiction: JurisdictionCode): string {
    const active = this.allMetadata(jurisdiction).find((m) => m.state === 'active');
    if (!active) throw new CryptoError('no-active-pepper', `no active pepper for jurisdiction '${jurisdiction}'`);
    return active.version;
  }

  recognisedVersions(jurisdiction: JurisdictionCode): string[] {
    return this.allMetadata(jurisdiction).filter((m) => m.state === 'active' || m.state === 'transition').map((m) => m.version).sort();
  }

  metadata(jurisdiction: JurisdictionCode, version: string): PepperMetadata {
    const m = this.meta.get(key(jurisdiction, version));
    if (!m) throw new CryptoError('pepper-not-found', `pepper ${jurisdiction}:${version} does not exist`);
    return { ...m };
  }

  allMetadata(jurisdiction?: JurisdictionCode): PepperMetadata[] {
    return Array.from(this.meta.values()).filter((m) => !jurisdiction || m.jurisdiction === jurisdiction).map((m) => ({ ...m })).sort((a, b) => key(a.jurisdiction, a.version).localeCompare(key(b.jurisdiction, b.version)));
  }

  computeHmac(jurisdiction: JurisdictionCode, version: string, canonicalInput: string): string {
    const m = this.meta.get(key(jurisdiction, version));
    if (!m) throw new CryptoError('pepper-not-found', `pepper ${jurisdiction}:${version} does not exist`);
    if (m.state !== 'active' && m.state !== 'transition') throw new CryptoError('version-not-usable', `pepper ${jurisdiction}:${version} is ${m.state}; not usable for hashing`);
    if (m.jurisdiction !== jurisdiction) throw new CryptoError('jurisdiction-mismatch', 'pepper jurisdiction mismatch');
    const pepper = rawOf(this).get(key(jurisdiction, version));
    if (!pepper) throw new CryptoError('secret-unavailable', `pepper material for ${jurisdiction}:${version} is unavailable`);
    return createHmac('sha256', pepper).update(canonicalInput).digest('hex');
  }

  health(): { jurisdictions: number; peppers: number; byState: Record<string, number> } {
    const byState: Record<string, number> = {};
    const juris = new Set<string>();
    for (const m of Array.from(this.meta.values())) { byState[m.state] = (byState[m.state] ?? 0) + 1; juris.add(m.jurisdiction); }
    return { jurisdictions: juris.size, peppers: this.meta.size, byState };
  }
}
