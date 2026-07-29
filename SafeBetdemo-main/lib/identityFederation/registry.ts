// ─── SB-NAT Registry (v2.0, ADR-006 · Milestone 3.4; hardened 4.1) ───────────
//
// The FIRST component authorised to create an Enterprise Correlation Identity
// (SB-NAT). Regulator-plane; records approved Enterprise Correlation Identities.
// NOT an operational identity store; NOT the Enterprise Correlation Layer (3.5).
//
// Guarantees (ADR-006 §Phase-2.1, Design §13/§20/§22):
//   • SB-NAT is created ONLY from an APPROVED, non-superseded Federation Decision.
//   • The identifier is permanent: never changes/reused/recycled/renumbered.
//   • Split/merge never modify SB-PLR — only the SB-PLR↔SB-NAT relationship; every
//     historical mapping stays reconstructable.
//   • Six-part version stamp per record; integrity is verifiable.
//   • No PII stored (identifiers + version metadata only); append-only audit.
//
// MILESTONE 4.1 HARDENING (closes CERT-L1 / condition C10):
//   Internal state lives in a NON-EXPORTED module-scoped WeakMap and all mutation
//   internals are NON-EXPORTED module functions. There is therefore NO runtime-
//   reachable handle to the registry's records / counters / minted ids / audit —
//   `registry.records`, `registry.commit`, `registry.mint` etc. do not exist at
//   runtime. This is genuine runtime privacy at the current TS target (no global
//   target change, no ECMAScript #private). An optional durable journal lets a
//   pilot store persist every mutation; `reconstructSbNatRegistry()` rebuilds
//   state from a durable snapshot (restart / recovery), yielding identical
//   domain outcomes.

import type {
  JurisdictionCode, SbNatId, DecisionVersions, FederationDecision,
  FederationVersionStamp, FederationDecisionAudit,
} from './types.ts';
import { formatSbNat, isSbNat, jurisdictionOfSbNat } from './identifiers.ts';
import { isApprovedDecision } from './decisionEngine.ts';
import { type AuditSink, InMemoryAuditSink, sealAuditRecord } from './audit.ts';

/** Resting + transition states of an SB-NAT record (Design §13, national plane). */
export const REGISTRY_STATES = [
  'created', 'active', 're-evaluated', 'split', 'merged', 'retired', 'archived',
] as const;
export type RegistryState = (typeof REGISTRY_STATES)[number];

/** The lifecycle actions recorded in an SB-NAT record's immutable history. */
export const REGISTRY_ACTIONS = [
  'created', 'linked', 're-evaluated', 'split-out', 'split-source',
  'merged-in', 'merged-out', 'retired', 'archived',
] as const;
export type RegistryAction = (typeof REGISTRY_ACTIONS)[number];

/** An append-only lifecycle event on a single SB-NAT record. */
export interface RegistryHistoryEvent {
  at: string;
  action: RegistryAction;
  actor: string;
  reason: string;
  /** Snapshot of the record's member SB-PLR set AFTER the action (audit trail). */
  membersAfter: string[];
  /** Related SB-NAT for split/merge (counterparty), if any. */
  counterpartSbNat?: SbNatId;
  /** The Federation Decision that authorised this action, if any. */
  decisionId?: string;
}

/**
 * An immutable Enterprise Correlation Identity record. The `sbNat` identifier is
 * permanent for the life of the registry. Membership + state evolve AROUND it.
 */
export interface SbNatRecord {
  sbNat: SbNatId;
  jurisdiction: JurisdictionCode;
  state: RegistryState;
  members: string[];
  versions: DecisionVersions;
  createdAt: string;
  updatedAt: string;
  sourceDecisionIds: string[];
  history: RegistryHistoryEvent[];
}

/** An append-only relationship-assignment event (SB-PLR X assigned to SB-NAT Y at T). */
export interface AssignmentEvent {
  at: string;
  sbPlr: string;
  sbNat: SbNatId;
  action: RegistryAction;
  decisionId?: string;
}

/** A single integrity check result. */
export interface IntegrityCheck { name: string; passed: boolean; detail: string; }
/** The registry integrity report (corruption is detectable). */
export interface IntegrityReport { ok: boolean; checks: IntegrityCheck[]; }

/** Deterministic registry diagnostics (counts only; no PII). */
export interface RegistryDiagnostics {
  scope: JurisdictionCode | 'all';
  total: number;
  active: number;
  merged: number;
  retired: number;
  archived: number;
  distinctSbPlr: number;
  assignmentEvents: number;
  mintedIdentifiers: number;
}

/**
 * Durable journal port (Milestone 4.1). The registry emits every append-only
 * mutation to the journal; a durable adapter persists them. Reconstruction reads
 * records + assignments back. The registry never reads through the journal in
 * the hot path — the in-process model remains authoritative for a live instance.
 */
export interface RegistryJournal {
  recordWritten(record: SbNatRecord): void;
  assignmentAppended(ev: AssignmentEvent): void;
  auditAppended(rec: FederationDecisionAudit): void;
}

export interface RegistryError extends Error { code: string; }
function registryError(code: string, message: string): RegistryError {
  const e = new Error(`[${code}] ${message}`) as RegistryError;
  e.name = 'RegistryError';
  e.code = code;
  return e;
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const k of Object.keys(o as object)) deepFreeze((o as Record<string, unknown>)[k]);
  }
  return o;
}

function auditVersions(v: DecisionVersions): FederationVersionStamp {
  return {
    federationAlgorithmVersion: v.federationAlgorithmVersion,
    matchingPolicyVersion: v.matchingPolicyVersion,
    jurisdictionVersion: v.jurisdictionVersion,
    decisionEngineVersion: v.decisionEngineVersion,
    ruleSetVersion: v.ruleSetVersion,
  };
}

export interface RegistryOptions {
  now?: () => string;
  auditSink?: AuditSink;
  /** Optional durable journal (Milestone 4.1); when present every mutation is persisted. */
  persistence?: RegistryJournal;
}

// ── Runtime-private internal state (NON-EXPORTED module WeakMap) ─────────────
// There is no exported handle to this map and no instance property mirrors it,
// so registry internals are unreachable from any runtime caller (closes C10).

interface RegistryInternalState {
  now: () => string;
  auditSink: AuditSink;
  journal?: RegistryJournal;
  records: Map<SbNatId, SbNatRecord>;
  counters: Map<JurisdictionCode, number>;
  mintedIds: Set<SbNatId>;
  assignments: AssignmentEvent[];
}

const STATE = new WeakMap<SbNatRegistry, RegistryInternalState>();
function stateOf(inst: SbNatRegistry): RegistryInternalState {
  const st = STATE.get(inst);
  if (!st) throw registryError('detached', 'registry state is not available for this instance');
  return st;
}

// ── NON-EXPORTED mutation internals (unreachable from any instance) ──────────

function isActiveState(s: RegistryState): boolean {
  return s === 'active' || s === 'created' || s === 're-evaluated' || s === 'split';
}

function assertCreatable(decision: FederationDecision): void {
  if (!decision) throw registryError('no-decision', 'an SB-NAT can only be created from a Federation Decision');
  if (!isApprovedDecision(decision)) throw registryError('not-approved', `decision ${decision.decisionId} is not approved (outcome=${decision.outcome}, review=${decision.reviewState})`);
  if (decision.appealState === 'upheld') throw registryError('superseded', `decision ${decision.decisionId} has been revoked by an upheld appeal`);
  if (decision.overrideStatus === 'overridden' && !isApprovedDecision(decision)) throw registryError('superseded', `decision ${decision.decisionId} was overridden away from approval`);
  if (!decision.sbPlrA || !decision.sbPlrB || decision.sbPlrA === decision.sbPlrB) throw registryError('invalid-pair', 'a decision must link two distinct SB-PLR identifiers');
}

/** Mint a permanent, never-reused identifier from a monotonic sequence. */
function mint(st: RegistryInternalState, j: JurisdictionCode): SbNatId {
  let n = (st.counters.get(j) ?? 0) + 1;
  let id = formatSbNat(j, n.toString(16).padStart(6, '0'));
  while (st.mintedIds.has(id)) { n += 1; id = formatSbNat(j, n.toString(16).padStart(6, '0')); }
  st.counters.set(j, n);
  st.mintedIds.add(id);
  return id;
}

function commit(st: RegistryInternalState, record: SbNatRecord): void {
  const frozen = deepFreeze(record);
  st.records.set(record.sbNat, frozen);
  st.journal?.recordWritten(frozen);
}

/** Replace a record with an immutable next version (records are deep-frozen). */
function write(st: RegistryInternalState, rec: SbNatRecord, patch: Partial<SbNatRecord>): SbNatRecord {
  const next: SbNatRecord = deepFreeze({ ...rec, ...patch });
  if (next.sbNat !== rec.sbNat || next.createdAt !== rec.createdAt) {
    throw registryError('immutable-violation', 'SB-NAT identifier and creation time are immutable');
  }
  st.records.set(rec.sbNat, next);
  st.journal?.recordWritten(next);
  return next;
}

function assign(st: RegistryInternalState, sbPlr: string, sbNat: SbNatId, action: RegistryAction, decisionId: string | undefined, at: string): void {
  const ev = Object.freeze({ at, sbPlr, sbNat, action, decisionId }) as AssignmentEvent;
  st.assignments.push(ev);
  st.journal?.assignmentAppended(ev);
}

function audit(st: RegistryInternalState, record: SbNatRecord, decisionRule: string, affected: string[], decisionId: string | undefined, actor: string): void {
  const sealed = sealAuditRecord({
    jurisdiction: record.jurisdiction,
    subjectSbNat: record.sbNat,
    affectedSbPlr: affected.slice().sort(),
    evidenceUsed: [], evidenceIgnored: [],
    matchingRules: decisionId ? [decisionId] : [],
    decisionRule,
    confidence: { tier: 'confirmed', score: 1.0 },
    versions: auditVersions(record.versions),
    reviewer: actor,
    overrideHistory: [], appealHistory: [],
    timestamp: record.updatedAt,
  });
  st.auditSink.append(sealed);
  st.journal?.auditAppended(sealed);
}

function activeRecordOf(st: RegistryInternalState, sbPlr: string): SbNatRecord | undefined {
  for (const r of Array.from(st.records.values())) {
    if (isActiveState(r.state) && r.members.includes(sbPlr)) return r;
  }
  return undefined;
}

function getRecord(st: RegistryInternalState, sbNat: SbNatId): SbNatRecord {
  const rec = st.records.get(sbNat);
  if (!rec) throw registryError('not-found', `SB-NAT ${sbNat} does not exist in the registry`);
  return rec;
}

function requireActive(st: RegistryInternalState, sbNat: SbNatId): SbNatRecord {
  const rec = getRecord(st, sbNat);
  if (!isActiveState(rec.state)) throw registryError('not-active', `SB-NAT ${sbNat} is ${rec.state}; lifecycle action requires an active identity`);
  return rec;
}

function noteDecision(st: RegistryInternalState, rec: SbNatRecord, decisionId: string): SbNatRecord {
  if (rec.sourceDecisionIds.includes(decisionId)) return rec;
  return write(st, rec, { sourceDecisionIds: [...rec.sourceDecisionIds, decisionId] });
}

function linkMember(st: RegistryInternalState, target: SbNatRecord, joining: string, decisionId: string, actor: string, reason: string): SbNatRecord {
  const at = st.now();
  const members = Array.from(new Set([...target.members, joining])).sort();
  const next = write(st, target, {
    state: 'active', members, updatedAt: at,
    sourceDecisionIds: Array.from(new Set([...target.sourceDecisionIds, decisionId])),
    history: [...target.history, { at, action: 'linked', actor, reason, membersAfter: members, decisionId }],
  });
  assign(st, joining, target.sbNat, 'linked', decisionId, at);
  audit(st, next, 'registry:linked', [joining], decisionId, actor);
  return next;
}

/**
 * The SB-NAT Registry. Stateful, regulator-plane, append-only. All internal
 * state + mutation logic is runtime-private (module WeakMap + module functions);
 * only the governed public API below is reachable.
 */
export class SbNatRegistry {
  constructor(opts: RegistryOptions = {}) {
    STATE.set(this, {
      now: opts.now ?? (() => new Date().toISOString()),
      auditSink: opts.auditSink ?? new InMemoryAuditSink(),
      journal: opts.persistence,
      records: new Map<SbNatId, SbNatRecord>(),
      counters: new Map<JurisdictionCode, number>(),
      mintedIds: new Set<SbNatId>(),
      assignments: [],
    });
  }

  // ── Creation (approved decisions ONLY) ──────────────────────────────────────
  create(decision: FederationDecision, actor = 'system', reason = 'approved federation decision'): SbNatRecord {
    const st = stateOf(this);
    assertCreatable(decision);
    const j = decision.jurisdiction;
    const a = decision.sbPlrA, b = decision.sbPlrB;
    const recA = activeRecordOf(st, a);
    const recB = activeRecordOf(st, b);

    if (recA && recB) {
      if (recA.sbNat === recB.sbNat) return noteDecision(st, recA, decision.decisionId);
      throw registryError('merge-required', `both SB-PLR already belong to different SB-NATs (${recA.sbNat}, ${recB.sbNat}); use merge()`);
    }
    if (recA || recB) {
      const target = (recA ?? recB) as SbNatRecord;
      const joining = recA ? b : a;
      return linkMember(st, target, joining, decision.decisionId, actor, reason);
    }

    const at = st.now();
    const sbNat = mint(st, j);
    const record: SbNatRecord = {
      sbNat, jurisdiction: j, state: 'active',
      members: [a, b].sort(),
      versions: { ...decision.versions },
      createdAt: at, updatedAt: at,
      sourceDecisionIds: [decision.decisionId],
      history: [{ at, action: 'created', actor, reason, membersAfter: [a, b].sort(), decisionId: decision.decisionId }],
    };
    commit(st, record);
    assign(st, a, sbNat, 'created', decision.decisionId, at);
    assign(st, b, sbNat, 'created', decision.decisionId, at);
    audit(st, record, 'registry:created', [a, b], decision.decisionId, actor);
    return getRecord(st, sbNat);
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────
  reEvaluate(sbNat: SbNatId, actor: string, reason: string): SbNatRecord {
    const st = stateOf(this);
    const rec = requireActive(st, sbNat);
    const at = st.now();
    const next = write(st, rec, {
      state: 're-evaluated', updatedAt: at,
      history: [...rec.history, { at, action: 're-evaluated', actor, reason, membersAfter: rec.members.slice() }],
    });
    audit(st, next, 'registry:re-evaluated', next.members, undefined, actor);
    return next;
  }

  split(sbNat: SbNatId, membersToExtract: string[], actor: string, reason: string, decisionId?: string): { source: SbNatRecord; created: SbNatRecord } {
    const st = stateOf(this);
    const rec = requireActive(st, sbNat);
    const extract = Array.from(new Set(membersToExtract));
    if (extract.length === 0) throw registryError('split-empty', 'split requires at least one member to extract');
    for (const m of extract) if (!rec.members.includes(m)) throw registryError('split-non-member', `SB-PLR '${m}' is not a member of ${sbNat}`);
    if (extract.length >= rec.members.length) throw registryError('split-all', 'a split must leave at least one member in the source SB-NAT');

    const at = st.now();
    const remaining = rec.members.filter((m) => !extract.includes(m)).sort();
    const extracted = extract.slice().sort();
    const newSbNat = mint(st, rec.jurisdiction);

    const created: SbNatRecord = {
      sbNat: newSbNat, jurisdiction: rec.jurisdiction, state: 'active',
      members: extracted, versions: { ...rec.versions },
      createdAt: at, updatedAt: at,
      sourceDecisionIds: decisionId ? [decisionId] : [],
      history: [{ at, action: 'split-out', actor, reason, membersAfter: extracted, counterpartSbNat: rec.sbNat, decisionId }],
    };
    commit(st, created);
    const source = write(st, rec, {
      state: 'active', members: remaining, updatedAt: at,
      sourceDecisionIds: decisionId ? Array.from(new Set([...rec.sourceDecisionIds, decisionId])) : rec.sourceDecisionIds.slice(),
      history: [...rec.history, { at, action: 'split-source', actor, reason, membersAfter: remaining, counterpartSbNat: newSbNat, decisionId }],
    });
    for (const m of extracted) assign(st, m, newSbNat, 'split-out', decisionId, at);
    audit(st, created, 'registry:split-out', extracted, decisionId, actor);
    audit(st, source, 'registry:split-source', remaining, decisionId, actor);
    return { source, created };
  }

  merge(sourceSbNat: SbNatId, targetSbNat: SbNatId, actor: string, reason: string, decisionId?: string): { survivor: SbNatRecord; absorbed: SbNatRecord } {
    const st = stateOf(this);
    if (sourceSbNat === targetSbNat) throw registryError('merge-self', 'cannot merge an SB-NAT into itself');
    const src = requireActive(st, sourceSbNat);
    const tgt = requireActive(st, targetSbNat);
    if (src.jurisdiction !== tgt.jurisdiction) throw registryError('merge-cross-jurisdiction', 'cannot merge SB-NATs across jurisdictions (sovereign separation)');

    const at = st.now();
    const moved = src.members.slice().sort();
    const survivorMembers = Array.from(new Set([...tgt.members, ...moved])).sort();

    const survivor = write(st, tgt, {
      state: 'active', members: survivorMembers, updatedAt: at,
      sourceDecisionIds: decisionId ? Array.from(new Set([...tgt.sourceDecisionIds, decisionId])) : tgt.sourceDecisionIds.slice(),
      history: [...tgt.history, { at, action: 'merged-in', actor, reason, membersAfter: survivorMembers, counterpartSbNat: src.sbNat, decisionId }],
    });
    const absorbed = write(st, src, {
      state: 'merged', members: [], updatedAt: at,
      history: [...src.history, { at, action: 'merged-out', actor, reason, membersAfter: [], counterpartSbNat: tgt.sbNat, decisionId }],
    });
    for (const m of moved) assign(st, m, tgt.sbNat, 'merged-in', decisionId, at);
    audit(st, survivor, 'registry:merged-in', moved, decisionId, actor);
    audit(st, absorbed, 'registry:merged-out', moved, decisionId, actor);
    return { survivor, absorbed };
  }

  retire(sbNat: SbNatId, actor: string, reason: string): SbNatRecord {
    const st = stateOf(this);
    const rec = requireActive(st, sbNat);
    const at = st.now();
    const next = write(st, rec, {
      state: 'retired', updatedAt: at,
      history: [...rec.history, { at, action: 'retired', actor, reason, membersAfter: rec.members.slice() }],
    });
    audit(st, next, 'registry:retired', next.members, undefined, actor);
    return next;
  }

  archive(sbNat: SbNatId, actor: string, reason: string): SbNatRecord {
    const st = stateOf(this);
    const rec = getRecord(st, sbNat);
    if (rec.state === 'archived') throw registryError('already-archived', `${sbNat} is already archived`);
    const at = st.now();
    const next = write(st, rec, {
      state: 'archived', updatedAt: at,
      history: [...rec.history, { at, action: 'archived', actor, reason, membersAfter: rec.members.slice() }],
    });
    audit(st, next, 'registry:archived', next.members, undefined, actor);
    return next;
  }

  // ── Lookups (return immutable / copied results) ─────────────────────────────
  get(sbNat: SbNatId): SbNatRecord | undefined { return stateOf(this).records.get(sbNat); }
  exists(sbNat: SbNatId): boolean { return stateOf(this).mintedIds.has(sbNat); }
  findBySbPlr(sbPlr: string): SbNatRecord | undefined { return activeRecordOf(stateOf(this), sbPlr); }

  list(jurisdiction?: JurisdictionCode): SbNatRecord[] {
    const st = stateOf(this);
    const all = Array.from(st.records.values());
    const scoped = jurisdiction ? all.filter((r) => r.jurisdiction === jurisdiction) : all;
    return scoped.sort((x, y) => x.sbNat.localeCompare(y.sbNat));
  }

  auditTrail(): readonly FederationDecisionAudit[] { return stateOf(this).auditSink.list(); }

  // ── Historical reconstruction ───────────────────────────────────────────────
  reconstructMappingAt(at: string): Map<string, SbNatId> {
    const st = stateOf(this);
    const map = new Map<string, SbNatId>();
    for (const ev of st.assignments) if (ev.at <= at) map.set(ev.sbPlr, ev.sbNat);
    return map;
  }

  assignmentHistory(sbPlr: string): AssignmentEvent[] {
    return stateOf(this).assignments.filter((e) => e.sbPlr === sbPlr).map((e) => ({ ...e }));
  }

  /** A durable snapshot for persistence (records + assignments). No PII. */
  snapshot(): { records: SbNatRecord[]; assignments: AssignmentEvent[] } {
    const st = stateOf(this);
    return { records: Array.from(st.records.values()), assignments: st.assignments.map((e) => ({ ...e })) };
  }

  // ── Integrity verification ──────────────────────────────────────────────────
  verifyIntegrity(): IntegrityReport {
    const st = stateOf(this);
    const checks: IntegrityCheck[] = [];
    const records = Array.from(st.records.values());

    let idsOk = true; let idDetail = 'all identifiers unique, well-formed and jurisdiction-consistent';
    const seen = new Set<SbNatId>();
    for (const r of records) {
      if (seen.has(r.sbNat) || !isSbNat(r.sbNat) || jurisdictionOfSbNat(r.sbNat) !== r.jurisdiction || !st.mintedIds.has(r.sbNat)) {
        idsOk = false; idDetail = `invalid or duplicate identifier: ${r.sbNat}`; break;
      }
      seen.add(r.sbNat);
    }
    checks.push({ name: 'unique-identifiers', passed: idsOk, detail: idDetail });

    let immutableOk = true; let immDetail = 'every record identifier matches its history genesis';
    for (const r of records) {
      const genesis = r.history[0];
      if (!genesis || (genesis.action !== 'created' && genesis.action !== 'split-out')) {
        immutableOk = false; immDetail = `record ${r.sbNat} has no creation genesis event`; break;
      }
    }
    checks.push({ name: 'immutable-identifiers', passed: immutableOk, detail: immDetail });

    let refOk = true; let refDetail = 'each SB-PLR belongs to at most one active SB-NAT';
    const owner = new Map<string, SbNatId>();
    for (const r of records) {
      if (!isActiveState(r.state)) continue;
      for (const m of r.members) {
        if (owner.has(m)) { refOk = false; refDetail = `SB-PLR ${m} is in two active SB-NATs (${owner.get(m)}, ${r.sbNat})`; break; }
        owner.set(m, r.sbNat);
      }
      if (!refOk) break;
    }
    checks.push({ name: 'referential-integrity', passed: refOk, detail: refDetail });

    let verOk = true; let verDetail = 'every record carries a complete six-part version stamp';
    for (const r of records) {
      const v = r.versions;
      if (!v || !v.federationAlgorithmVersion || !v.matchingEngineVersion || !v.decisionEngineVersion || !v.matchingPolicyVersion || !v.ruleSetVersion || !v.jurisdictionVersion) {
        verOk = false; verDetail = `record ${r.sbNat} has an incomplete version stamp`; break;
      }
    }
    checks.push({ name: 'version-consistency', passed: verOk, detail: verDetail });

    let histOk = true; let histDetail = 'current membership matches the replayed assignment log';
    const latest = this.reconstructMappingAt(st.now());
    for (const r of records) {
      if (!isActiveState(r.state)) continue;
      for (const m of r.members) {
        if (latest.get(m) !== r.sbNat) { histOk = false; histDetail = `SB-PLR ${m} maps to ${latest.get(m) ?? 'none'} in the log but is a member of ${r.sbNat}`; break; }
      }
      if (!histOk) break;
    }
    checks.push({ name: 'historical-consistency', passed: histOk, detail: histDetail });

    return { ok: checks.every((c) => c.passed), checks };
  }

  // ── Diagnostics ─────────────────────────────────────────────────────────────
  diagnostics(jurisdiction?: JurisdictionCode): RegistryDiagnostics {
    const st = stateOf(this);
    const records = this.list(jurisdiction);
    const distinct = new Set<string>();
    for (const r of records) for (const m of r.members) distinct.add(m);
    const assignments = jurisdiction ? st.assignments.filter((a) => jurisdictionOfSbNat(a.sbNat) === jurisdiction) : st.assignments;
    const minted = jurisdiction ? Array.from(st.mintedIds).filter((id) => jurisdictionOfSbNat(id) === jurisdiction) : Array.from(st.mintedIds);
    return {
      scope: jurisdiction ?? 'all',
      total: records.length,
      active: records.filter((r) => isActiveState(r.state)).length,
      merged: records.filter((r) => r.state === 'merged').length,
      retired: records.filter((r) => r.state === 'retired').length,
      archived: records.filter((r) => r.state === 'archived').length,
      distinctSbPlr: distinct.size,
      assignmentEvents: assignments.length,
      mintedIdentifiers: minted.length,
    };
  }
}

/**
 * Rebuild a registry from a durable snapshot (Milestone 4.1 restart/recovery).
 * Records + assignments are restored; the mint counter is derived from the
 * persisted identifiers so future mints never collide; minted ids include every
 * persisted identifier (retired/merged/archived remain reserved forever).
 * Produces identical domain outcomes to the source registry.
 */
export function reconstructSbNatRegistry(snapshot: { records: SbNatRecord[]; assignments: AssignmentEvent[] }, opts: RegistryOptions = {}): SbNatRegistry {
  // Default the reconstructed clock to the latest persisted timestamp so that
  // historical-consistency verification includes the full assignment log.
  const stamps = [...snapshot.records.map((r) => r.updatedAt), ...snapshot.assignments.map((a) => a.at)].sort();
  const maxAt = stamps.length ? stamps[stamps.length - 1] : new Date().toISOString();
  const reg = new SbNatRegistry({ ...opts, now: opts.now ?? (() => maxAt) });
  const st = stateOf(reg);
  for (const r of snapshot.records) {
    const frozen = deepFreeze({ ...r, members: r.members.slice(), sourceDecisionIds: r.sourceDecisionIds.slice(), history: r.history.map((h) => ({ ...h })), versions: { ...r.versions } });
    st.records.set(frozen.sbNat, frozen);
    st.mintedIds.add(frozen.sbNat);
    const seq = sequenceOf(frozen.sbNat);
    if (seq !== null) st.counters.set(frozen.jurisdiction, Math.max(st.counters.get(frozen.jurisdiction) ?? 0, seq));
  }
  for (const ev of snapshot.assignments) st.assignments.push(Object.freeze({ ...ev }) as AssignmentEvent);
  return reg;
}

function sequenceOf(sbNat: SbNatId): number | null {
  const m = /^SB-NAT-(?:ZA|NA|BW|KE)-([0-9A-F]+)$/.exec(sbNat);
  return m ? parseInt(m[1], 16) : null;
}
