// ─── Pilot Regulator-Plane Persistence — model (ADR-006 · Milestone 4.1) ─────
//
// Durable, PILOT-ONLY persistence primitives for the regulator plane: a deny-by-
// default access guard (application-enforced RLS), a hash-chained append-only
// audit with tamper detection, and pilot-store migration/validation helpers.
//
// ENFORCEMENT LAYERS (documented honestly — see V2_PILOT_RLS_AND_ACCESS_CONTROL.md):
//   • Access control  — application-enforced deny-by-default (this module). At
//     deployment this binds to database-level Postgres RLS on a managed RDS.
//   • Append-only     — application design + SHA-256 hash chain (this module) on a
//     durable file journal. At deployment this binds to DB permissions (no
//     UPDATE/DELETE grant) + WORM/immutable storage.
//   • Integrity       — SHA-256 chain (cryptographic) + registry integrity verifier.
//   This module does NOT claim database-permission immutability; that is a
//   documented deployment binding (condition C2/C3 residual).
//
// No plaintext PII is ever persisted — identifiers, hashes, references, version
// metadata and governance history only.

import { createHash } from 'node:crypto';
import type { JurisdictionCode } from '../types.ts';
import type { FederationDecisionAudit } from '../types.ts';
import { type AccessContext, AccessDeniedError } from '../correlation/index.ts';

// ── Access context (regulator plane + authorised service, deny-by-default) ───

export const PERSISTENCE_PLANES = ['regulator', 'service', 'operator', 'casino-admin', 'unauthenticated'] as const;
export type PersistencePlane = (typeof PERSISTENCE_PLANES)[number];

export const PERSISTENCE_ROLES = ['reader', 'writer', 'reviewer', 'override-authority', 'appeal-reviewer', 'auditor', 'integrity'] as const;
export type PersistenceRole = (typeof PERSISTENCE_ROLES)[number];

/**
 * The access context presented to every persisted read/write. Regulators read
 * within their sovereign jurisdiction; an authorised SERVICE account performs
 * governed writes. Operators / admins / unauthenticated are denied by default.
 */
export interface RegulatorAccessContext {
  plane: PersistencePlane;
  jurisdiction: JurisdictionCode | null;
  sovereignJurisdictions?: JurisdictionCode[];
  roles?: PersistenceRole[];
}

function allowedJurisdictions(ctx: RegulatorAccessContext): JurisdictionCode[] {
  return ctx.sovereignJurisdictions ?? (ctx.jurisdiction ? [ctx.jurisdiction] : []);
}

/** Regulator-plane READ: deny-by-default; jurisdiction-bound; operators never read. */
export function assertRegulatorRead(ctx: RegulatorAccessContext | undefined, jurisdiction: JurisdictionCode): void {
  if (!ctx) throw new AccessDeniedError('no access context supplied');
  if (ctx.plane !== 'regulator') throw new AccessDeniedError(`plane '${ctx.plane}' may not read regulator-plane records (regulator-only)`);
  if (!allowedJurisdictions(ctx).includes(jurisdiction)) throw new AccessDeniedError(`regulator for [${allowedJurisdictions(ctx).join(',') || 'none'}] is not sovereign-authorised for '${jurisdiction}'`);
  if (ctx.roles && ctx.roles.length > 0 && !ctx.roles.includes('reader') && !ctx.roles.includes('reviewer') && !ctx.roles.includes('auditor') && !ctx.roles.includes('integrity') && !ctx.roles.includes('override-authority') && !ctx.roles.includes('appeal-reviewer')) {
    throw new AccessDeniedError('no read-capable role in context');
  }
}

/** Governed WRITE: only an authorised SERVICE plane, jurisdiction-bound. */
export function assertServiceWrite(ctx: RegulatorAccessContext | undefined, jurisdiction: JurisdictionCode): void {
  if (!ctx) throw new AccessDeniedError('no access context supplied');
  if (ctx.plane !== 'service') throw new AccessDeniedError(`plane '${ctx.plane}' may not write regulator-plane records (authorised service only)`);
  if (!allowedJurisdictions(ctx).includes(jurisdiction)) throw new AccessDeniedError(`service for [${allowedJurisdictions(ctx).join(',') || 'none'}] is not authorised for '${jurisdiction}'`);
  if (ctx.roles && ctx.roles.length > 0 && !ctx.roles.includes('writer')) throw new AccessDeniedError('no writer role in context');
}

/** Structural check of the FUTURE operator write boundary — NOT enabled in 4.1. */
export function assertOperatorNeverReads(ctx: RegulatorAccessContext | undefined): void {
  if (ctx && (ctx.plane === 'operator' || ctx.plane === 'casino-admin')) {
    throw new AccessDeniedError('operators/casino-admins never receive federation read access');
  }
}

/** Bridge a correlation AccessContext to a regulator persistence read context. */
export function toRegulatorContext(ctx: AccessContext, roles: PersistenceRole[] = ['reader']): RegulatorAccessContext {
  return { plane: ctx.plane === 'regulator' ? 'regulator' : ctx.plane, jurisdiction: ctx.jurisdiction, sovereignJurisdictions: ctx.sovereignJurisdictions, roles };
}

// ── Hash-chained append-only audit (tamper detection) ────────────────────────

export interface ChainedAuditEntry {
  seq: number;
  prevHash: string;
  hash: string;
  record: FederationDecisionAudit;
}

export interface ChainVerification {
  ok: boolean;
  issues: { seq: number; kind: string; detail: string }[];
  length: number;
}

const GENESIS_HASH = '0'.repeat(64);

/** Deterministic SHA-256 link over (seq ∥ prevHash ∥ canonical record JSON). */
export function chainHash(seq: number, prevHash: string, record: FederationDecisionAudit): string {
  return createHash('sha256').update(`${seq}\n${prevHash}\n${JSON.stringify(record)}`).digest('hex');
}

/**
 * Append-only, SHA-256-chained audit log. Exposes append + read + verify; there
 * is deliberately NO update/delete/replace. `verify()` detects modified records,
 * broken links, gaps and reordering. (Application + cryptographic-chain
 * enforcement; DB-permission immutability is a deployment binding.)
 */
export class HashChainedAudit {
  private readonly entries: ChainedAuditEntry[] = [];

  constructor(existing: ChainedAuditEntry[] = []) {
    for (const e of existing) this.entries.push(Object.freeze({ ...e, record: Object.freeze({ ...e.record }) }));
  }

  append(record: FederationDecisionAudit): ChainedAuditEntry {
    const seq = this.entries.length;
    const prevHash = seq === 0 ? GENESIS_HASH : this.entries[seq - 1].hash;
    const hash = chainHash(seq, prevHash, record);
    const entry = Object.freeze({ seq, prevHash, hash, record: Object.freeze({ ...record }) });
    this.entries.push(entry);
    return entry;
  }

  list(): readonly ChainedAuditEntry[] { return Object.freeze(this.entries.slice()); }
  count(): number { return this.entries.length; }

  verify(): ChainVerification {
    const issues: { seq: number; kind: string; detail: string }[] = [];
    let prev = GENESIS_HASH;
    for (let i = 0; i < this.entries.length; i++) {
      const e = this.entries[i];
      if (e.seq !== i) issues.push({ seq: i, kind: 'gap-or-reorder', detail: `expected seq ${i}, found ${e.seq}` });
      if (e.prevHash !== prev) issues.push({ seq: i, kind: 'broken-chain', detail: `prevHash mismatch at seq ${i}` });
      const recomputed = chainHash(e.seq, e.prevHash, e.record);
      if (recomputed !== e.hash) issues.push({ seq: i, kind: 'modified-record', detail: `hash mismatch at seq ${i}` });
      prev = e.hash;
    }
    return { ok: issues.length === 0, issues, length: this.entries.length };
  }
}

// ── Pilot-store migration / schema-version (file-store schema) ───────────────

export const PILOT_STORE_SCHEMA_VERSION = '4.1.0';

export interface MigrationPlan {
  schemaVersion: string;
  objects: { name: string; disposition: 'authoritative' | 'append-only' | 'versioned' | 'reconstructable' | 'derived' | 'cached'; rlsRead: string; rlsWrite: string }[];
  reversible: boolean;
  target: 'pilot-nonproduction';
}

/** The pilot-store migration plan (data-disposition + RLS intent per object). Additive, reversible. */
export function pilotMigrationPlan(): MigrationPlan {
  return {
    schemaVersion: PILOT_STORE_SCHEMA_VERSION,
    reversible: true,
    target: 'pilot-nonproduction',
    objects: [
      { name: 'sbnat_records', disposition: 'authoritative', rlsRead: 'regulator+jurisdiction', rlsWrite: 'service+jurisdiction' },
      { name: 'assignment_events', disposition: 'append-only', rlsRead: 'regulator+jurisdiction', rlsWrite: 'service+jurisdiction' },
      { name: 'audit_chain', disposition: 'append-only', rlsRead: 'regulator/auditor+jurisdiction', rlsWrite: 'service (append-only, no update/delete)' },
      { name: 'decision_history', disposition: 'append-only', rlsRead: 'regulator+jurisdiction', rlsWrite: 'service+jurisdiction' },
      { name: 'review_appeal_override_history', disposition: 'append-only', rlsRead: 'regulator+jurisdiction', rlsWrite: 'service+jurisdiction' },
      { name: 'policy_outcomes', disposition: 'append-only', rlsRead: 'regulator+jurisdiction', rlsWrite: 'service+jurisdiction' },
      { name: 'correlation_results', disposition: 'reconstructable', rlsRead: 'regulator+jurisdiction', rlsWrite: 'service (or reconstructed on read)' },
      { name: 'schema_version', disposition: 'versioned', rlsRead: 'service', rlsWrite: 'migration-role' },
    ],
  };
}

/** Validate a migration plan (dry-run): all objects have RLS intent + valid disposition + non-production target. */
export function validateMigrationPlan(plan: MigrationPlan): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  if (plan.target !== 'pilot-nonproduction') issues.push('migration target must be pilot-nonproduction');
  if (!plan.schemaVersion) issues.push('missing schemaVersion');
  const dispositions = ['authoritative', 'append-only', 'versioned', 'reconstructable', 'derived', 'cached'];
  for (const o of plan.objects) {
    if (!dispositions.includes(o.disposition)) issues.push(`${o.name}: invalid disposition ${o.disposition}`);
    if (!o.rlsRead || !o.rlsWrite) issues.push(`${o.name}: missing RLS intent`);
  }
  return { ok: issues.length === 0, issues };
}
