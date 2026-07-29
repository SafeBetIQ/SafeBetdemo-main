// ─── Pilot Regulator-Plane Store (ADR-006 · Milestone 4.1) ───────────────────
//
// The durable, pilot-only regulator-plane persistence facade. It implements the
// registry's `RegistryJournal` port so every SB-NAT mutation is persisted, keeps
// a SHA-256 hash-chained append-only audit, enforces deny-by-default access
// (application-level RLS), reconstructs the registry from durable state
// (restart/recovery), verifies integrity, and supports backup. It exposes NO
// update/delete surface for records or audit.

import type { JurisdictionCode } from '../types.ts';
import type { FederationDecisionAudit } from '../types.ts';
import { jurisdictionOfSbNat } from '../identifiers.ts';
import {
  type SbNatRecord, type AssignmentEvent, type RegistryJournal, type SbNatRegistry,
  type IntegrityReport, reconstructSbNatRegistry,
} from '../registry.ts';
import {
  type PersistenceBackend, InMemoryBackend,
} from './journal.ts';
import {
  type RegulatorAccessContext, type ChainVerification, HashChainedAudit,
  assertRegulatorRead, assertServiceWrite,
} from './model.ts';
import { AccessDeniedError } from '../correlation/index.ts';

export interface RegulatorPlaneStoreOptions {
  backend?: PersistenceBackend;
  now?: () => string;
}

export interface StoreDiagnostics {
  location: string;
  schemaVersion: string;
  records: number;
  assignments: number;
  auditEntries: number;
  auditChainOk: boolean;
  registryIntegrityOk: boolean;
}

export class RegulatorPlaneStore implements RegistryJournal {
  private readonly backend: PersistenceBackend;
  private readonly chain: HashChainedAudit;

  constructor(opts: RegulatorPlaneStoreOptions = {}) {
    this.backend = opts.backend ?? new InMemoryBackend();
    // Rehydrate the audit chain from durable storage (restart-safe).
    this.chain = new HashChainedAudit(this.backend.readAuditEntries());
  }

  // ── RegistryJournal port (append-only durable writes) ───────────────────────
  recordWritten(record: SbNatRecord): void { this.backend.appendRecord(record); }
  assignmentAppended(ev: AssignmentEvent): void { this.backend.appendAssignment(ev); }
  auditAppended(rec: FederationDecisionAudit): void {
    const entry = this.chain.append(rec);          // SHA-256 chain
    this.backend.appendAuditEntry(entry);          // durable, append-only
  }

  // ── Governed writes require an authorised service context ───────────────────
  /** Assert the caller is an authorised service writer for the jurisdiction (no direct record mutation exposed). */
  authoriseWrite(ctx: RegulatorAccessContext, jurisdiction: JurisdictionCode): void {
    assertServiceWrite(ctx, jurisdiction);
  }

  // ── RLS-guarded reads (deny-by-default, jurisdiction-bound) ─────────────────
  readRecord(ctx: RegulatorAccessContext, sbNat: string): SbNatRecord | undefined {
    const j = jurisdictionOfSbNat(sbNat);
    if (!j) throw new AccessDeniedError(`malformed SB-NAT '${sbNat}'`);
    assertRegulatorRead(ctx, j);
    return this.backend.readRecords().find((r) => r.sbNat === sbNat);
  }

  listRecords(ctx: RegulatorAccessContext, jurisdiction: JurisdictionCode): SbNatRecord[] {
    assertRegulatorRead(ctx, jurisdiction);
    return this.backend.readRecords().filter((r) => r.jurisdiction === jurisdiction).sort((a, b) => a.sbNat.localeCompare(b.sbNat));
  }

  assignmentHistory(ctx: RegulatorAccessContext, jurisdiction: JurisdictionCode, sbPlr: string): AssignmentEvent[] {
    assertRegulatorRead(ctx, jurisdiction);
    return this.backend.readAssignments().filter((e) => e.sbPlr === sbPlr && jurisdictionOfSbNat(e.sbNat) === jurisdiction);
  }

  // ── Reconstruction / recovery (authorised service or integrity) ─────────────
  private assertOperational(ctx: RegulatorAccessContext): void {
    if (ctx.plane !== 'service' && !(ctx.plane === 'regulator' && (ctx.roles?.includes('integrity') || ctx.roles?.includes('auditor')))) {
      throw new AccessDeniedError('reconstruction/integrity requires an authorised service or integrity context');
    }
  }

  /** Rebuild an SB-NAT Registry from durable state (restart / recovery). */
  reconstructRegistry(ctx: RegulatorAccessContext, opts: { now?: () => string } = {}): SbNatRegistry {
    this.assertOperational(ctx);
    return reconstructSbNatRegistry({ records: this.backend.readRecords(), assignments: this.backend.readAssignments() }, opts);
  }

  /** Verify the append-only audit chain (tamper detection). */
  verifyAuditChain(ctx: RegulatorAccessContext): ChainVerification {
    this.assertOperational(ctx);
    return new HashChainedAudit(this.backend.readAuditEntries()).verify();
  }

  /** Full store integrity: registry integrity (post-reconstruction) + audit-chain verification. */
  verifyStoreIntegrity(ctx: RegulatorAccessContext): { ok: boolean; registry: IntegrityReport; auditChain: ChainVerification } {
    this.assertOperational(ctx);
    const registry = this.reconstructRegistry(ctx).verifyIntegrity();
    const auditChain = this.verifyAuditChain(ctx);
    return { ok: registry.ok && auditChain.ok, registry, auditChain };
  }

  diagnostics(ctx: RegulatorAccessContext): StoreDiagnostics {
    this.assertOperational(ctx);
    const chain = this.verifyAuditChain(ctx);
    return {
      location: this.backend.location(),
      schemaVersion: this.backend.schemaVersion(),
      records: this.backend.readRecords().length,
      assignments: this.backend.readAssignments().length,
      auditEntries: this.backend.readAuditEntries().length,
      auditChainOk: chain.ok,
      registryIntegrityOk: this.reconstructRegistry(ctx).verifyIntegrity().ok,
    };
  }

  auditChainLength(): number { return this.chain.count(); }
  backendLocation(): string { return this.backend.location(); }
}
