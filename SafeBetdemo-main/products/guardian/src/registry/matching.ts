// ─── SafeBet Guardian — deterministic registry matching (ARCH-V4-C1) ──────────
//
// BOUNDED, DETERMINISTIC matching over synthetic registry records. NO AI / NO fuzzy
// resolution at C1. Allowed signals: exact legal name, normalised legal name, licence
// reference, registration reference, explicit alias, known brand association.
//
// NO_MATCH means "no authoritative registry match found" — it NEVER means ILLEGAL.

import type { RegistrySnapshot, MatchState, OperatorEntity } from './types.ts';

/** Deterministic normalisation: lowercase, strip punctuation, collapse whitespace,
 *  drop common company suffixes so "X (Pty) Ltd" matches "X". */
export function normalise(input: string): string {
  return input
    .toLowerCase()
    .replace(/[().,/\\'"-]/g, ' ')
    .replace(/\b(pty|ltd|limited|inc|llc|holdings|company|co)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface MatchQuery {
  jurisdiction: string;           // caller's jurisdiction scope
  legalName?: string;
  licenceReference?: string;
  registrationReference?: string;
  brandName?: string;
}

export interface MatchResult {
  matchState: MatchState;
  candidateOperatorIds: string[];
  resolvedOperatorId: string | null;
  requiresReview: boolean;
  signal: string;                 // which deterministic signal matched
}

/** Jurisdiction-scoped candidate set (a caller for jurisdiction A never matches B). */
function inScope<T extends { jurisdiction: string }>(rows: T[], jurisdiction: string): T[] {
  return rows.filter((r) => r.jurisdiction === jurisdiction);
}

export function matchOperator(snapshot: RegistrySnapshot, q: MatchQuery): MatchResult {
  const operators = inScope(snapshot.operators, q.jurisdiction);
  const aliases = inScope(snapshot.aliases, q.jurisdiction);
  const brands = inScope(snapshot.brands, q.jurisdiction);
  const rels = inScope(snapshot.operatorBrands, q.jurisdiction);
  const licences = inScope(snapshot.licences, q.jurisdiction);

  const none: MatchResult = { matchState: 'NO_MATCH', candidateOperatorIds: [], resolvedOperatorId: null, requiresReview: false, signal: 'none' };

  // 1) Exact licence reference (strongest deterministic signal).
  if (q.licenceReference) {
    const hits = licences.filter((l) => l.licenceReference === q.licenceReference);
    const ops = unique(hits.map((l) => l.operatorId));
    if (ops.length === 1) return { matchState: 'EXACT_MATCH', candidateOperatorIds: ops, resolvedOperatorId: ops[0], requiresReview: false, signal: 'licence_reference' };
    if (ops.length > 1) return multiple(ops, 'licence_reference');
  }

  // 2) Registration reference.
  if (q.registrationReference) {
    const ops = unique(operators.filter((o) => o.registrationReference === q.registrationReference).map((o) => o.operatorId));
    if (ops.length === 1) return { matchState: 'EXACT_MATCH', candidateOperatorIds: ops, resolvedOperatorId: ops[0], requiresReview: false, signal: 'registration_reference' };
    if (ops.length > 1) return multiple(ops, 'registration_reference');
  }

  // 3) Exact / normalised legal name.
  if (q.legalName) {
    const exact = operators.filter((o) => o.legalName === q.legalName);
    if (exact.length === 1) return single(exact[0], 'EXACT_MATCH', 'legal_name_exact');
    const norm = normalise(q.legalName);
    const normHits = unique(operators.filter((o) => o.normalisedLegalName === norm).map((o) => o.operatorId));
    if (normHits.length === 1) return { matchState: 'EXACT_MATCH', candidateOperatorIds: normHits, resolvedOperatorId: normHits[0], requiresReview: false, signal: 'legal_name_normalised' };
    if (normHits.length > 1) return multiple(normHits, 'legal_name_normalised');

    // 4) Known alias.
    const aliasHits = unique(aliases.filter((a) => a.normalisedAlias === norm).map((a) => a.operatorId));
    if (aliasHits.length === 1) return { matchState: 'KNOWN_ALIAS_MATCH', candidateOperatorIds: aliasHits, resolvedOperatorId: aliasHits[0], requiresReview: false, signal: 'alias' };
    if (aliasHits.length > 1) return multiple(aliasHits, 'alias');
  }

  // 5) Known brand association → parent legal entity.
  if (q.brandName) {
    const norm = normalise(q.brandName);
    const brandIds = brands.filter((b) => b.normalisedBrand === norm).map((b) => b.brandId);
    const ops = unique(rels.filter((r) => brandIds.includes(r.brandId) && (!r.effectiveTo)).map((r) => r.operatorId));
    if (ops.length === 1) return { matchState: 'KNOWN_ALIAS_MATCH', candidateOperatorIds: ops, resolvedOperatorId: ops[0], requiresReview: false, signal: 'brand' };
    if (ops.length > 1) return multiple(ops, 'brand');
  }

  return none;
}

function single(op: OperatorEntity, state: MatchState, signal: string): MatchResult {
  return { matchState: state, candidateOperatorIds: [op.operatorId], resolvedOperatorId: op.operatorId, requiresReview: false, signal };
}
function multiple(ops: string[], signal: string): MatchResult {
  return { matchState: 'MULTIPLE_CANDIDATES', candidateOperatorIds: ops, resolvedOperatorId: null, requiresReview: true, signal };
}
function unique(a: string[]): string[] { return a.filter((v, i) => a.indexOf(v) === i); }
