// ─── Pilot Federation Cryptographic Operations — model (Milestone 4.2) ───────
//
// Versioned, collision-safe canonical hashing input; cryptographic version
// governance; pepper metadata + lifecycle; fail-closed error type; and a
// secret-free append-only cryptographic audit. HMAC-SHA-256 is the approved
// keyed construction (never unkeyed SHA-256, never reversible encryption, never
// custom crypto). No raw pepper, no plaintext identity attribute, and no secret
// value ever appears in any type here. PILOT NON-PRODUCTION ONLY.

import type { JurisdictionCode, AttributeType } from '../types.ts';

// ── Cryptographic version governance ─────────────────────────────────────────
export const HMAC_ALGORITHM = 'HMAC-SHA-256';
export const CANONICAL_FORMAT_VERSION = 'cf-1';
export const NORMALISATION_VERSION = 'norm-1';
export const CONTRIBUTION_SCHEMA_VERSION = 'contrib-1';
/** Domain-separation label bound into every federation attribute digest. */
export const DOMAIN_SEPARATION_LABEL = 'SB-FED-ATTR';

/**
 * Collision-safe canonical input. Each field is length-prefixed by its UTF-8
 * byte length so field boundaries can never merge or be confused, and the value
 * is Unicode-NFC-normalised. Binds: format version ∥ domain label ∥ jurisdiction
 * ∥ attribute type ∥ normalised value. The plaintext is NEVER logged.
 */
export function canonicalHashInput(jurisdiction: JurisdictionCode, attributeType: AttributeType, normalisedValue: string): string {
  const nfc = normalisedValue.normalize('NFC');
  const parts = [CANONICAL_FORMAT_VERSION, DOMAIN_SEPARATION_LABEL, jurisdiction, attributeType, nfc];
  // length-prefix by UTF-8 byte length → unambiguous, separator-collision-safe.
  return parts.map((p) => `${byteLength(p)}:${p}`).join('|');
}

function byteLength(s: string): number {
  // UTF-8 byte length without pulling Buffer into non-Node contexts.
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.codePointAt(i)!;
    if (c > 0xffff) i++;
    n += c <= 0x7f ? 1 : c <= 0x7ff ? 2 : c <= 0xffff ? 3 : 4;
  }
  return n;
}

// ── Pepper metadata + lifecycle (NEVER contains the secret value) ────────────
export const PEPPER_STATES = ['provisioned', 'active', 'transition', 'retired', 'revoked', 'compromised', 'disabled'] as const;
export type PepperState = (typeof PEPPER_STATES)[number];

/** Valid pepper lifecycle transitions. */
export const PEPPER_TRANSITIONS: Record<PepperState, PepperState[]> = {
  provisioned: ['active', 'revoked', 'compromised', 'disabled'],
  active: ['transition', 'retired', 'revoked', 'compromised', 'disabled'],
  transition: ['retired', 'revoked', 'compromised', 'disabled'],
  retired: ['revoked', 'compromised'],
  revoked: [],
  compromised: [],
  disabled: ['active'],
};

export function canTransition(from: PepperState, to: PepperState): boolean {
  return PEPPER_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Safe pepper metadata — no secret material. */
export interface PepperMetadata {
  jurisdiction: JurisdictionCode;
  version: string;
  state: PepperState;
  algorithm: string;
  canonicalFormatVersion: string;
  normalisationVersion: string;
  secretRef: string;                 // opaque reference; makes the non-production boundary explicit
  activatedAt: string | null;
  retiredAt: string | null;
  rotationRef: string | null;
  actor: string | null;
  auditRef: string | null;
}

/** The per-contribution cryptographic version stamp (recorded on every hash). */
export interface ContributionCryptoStamp {
  jurisdiction: JurisdictionCode;
  attributeType: AttributeType;
  algorithm: string;
  canonicalFormatVersion: string;
  normalisationVersion: string;
  pepperVersion: string;
  contributionSchemaVersion: string;
}

/** A produced federation attribute hash + its cryptographic provenance (no PII, no secret). */
export interface FederationAttributeHash {
  attributeType: AttributeType;
  hash: string;
  pepperKeyVersion: string;          // = pepperVersion (compatible with the 3.x AttributeHash shape)
  stamp: ContributionCryptoStamp;
}

// ── Fail-closed error ────────────────────────────────────────────────────────
export class CryptoError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(`[${code}] ${message}`); this.name = 'CryptoError'; this.code = code; }
}

// ── Secret-free, append-only cryptographic audit ─────────────────────────────
export const CRYPTO_AUDIT_ACTIONS = [
  'pepper-provisioned', 'pepper-activated', 'pepper-transition-started', 'pepper-retired',
  'pepper-revoked', 'pepper-compromised', 'cache-invalidated', 'secret-retrieval-failed',
  'unsupported-version-rejected', 'jurisdiction-mismatch-rejected', 'rotation-completed',
  'recovery-completed', 'emergency-disablement', 'jurisdiction-reactivation',
] as const;
export type CryptoAuditAction = (typeof CRYPTO_AUDIT_ACTIONS)[number];

export interface CryptoAuditRecord {
  auditId: string;
  at: string;
  action: CryptoAuditAction;
  jurisdiction: JurisdictionCode | null;
  pepperVersion: string | null;
  actor: string;
  reason: string;
  algorithm: string;
  canonicalFormatVersion: string;
}

/** Guard: reject any object that could carry a secret value into the audit. */
function assertNoSecretField(input: Record<string, unknown>): void {
  for (const k of Object.keys(input)) {
    if (/pepper(value)?$|secret|key(material)?$|plaintext|value$/i.test(k) && k !== 'pepperVersion') {
      throw new CryptoError('audit-secret-guard', `crypto audit may not carry field '${k}'`);
    }
  }
}

let cryptoAuditCounter = 0;
export function sealCryptoAudit(input: Omit<CryptoAuditRecord, 'auditId'> & Partial<Pick<CryptoAuditRecord, 'auditId'>>): CryptoAuditRecord {
  assertNoSecretField(input as unknown as Record<string, unknown>);
  return deepFreeze({ ...input, auditId: input.auditId ?? `crypto-audit-${++cryptoAuditCounter}` }) as CryptoAuditRecord;
}

export interface CryptoAuditSink {
  append(record: CryptoAuditRecord): void;
  list(): readonly CryptoAuditRecord[];
  count(): number;
}

export class InMemoryCryptoAuditSink implements CryptoAuditSink {
  private readonly records: CryptoAuditRecord[] = [];
  append(record: CryptoAuditRecord): void { this.records.push(deepFreeze(record)); }
  list(): readonly CryptoAuditRecord[] { return Object.freeze(this.records.slice()); }
  count(): number { return this.records.length; }
}

export function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const k of Object.keys(o as object)) deepFreeze((o as Record<string, unknown>)[k]);
  }
  return o;
}
