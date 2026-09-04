// ─── SHARED PLATFORM FOUNDATION — Audit Chain contract (ARCH-V4-A3) ──────────
//
// GOVERNED SHARED SERVICE. This module is the canonical, product-agnostic home of
// the tamper-evident audit-chain verification primitive. It was extracted (A3
// strangler step) from lib/consumerPlatform/auditChain.ts — which was located
// under the SafeBet IQ consumer namespace but is in fact a SHARED capability that
// SafeBet Guardian and the SafeBet Regulator Suite will also consume.
//
//   Owner:          Shared Platform Foundation
//   Consumers:      SafeBet IQ (now); SafeBet Guardian, Regulator Suite (future)
//   Contract kind:  pure verification primitive (no DB, no side effects)
//   Auth/tenant:    the `chain_scope` (per-tenant / per-jurisdiction chain id) is
//                   carried on each event; this module verifies ONE ordered chain
//                   for one scope. It performs NO cross-tenant access and holds no
//                   credentials. The SHA-256 function is INJECTED (node:crypto in
//                   tests, Web Crypto at the edge) so the module has no crypto dep.
//   Versioning:     AUDIT_CHAIN_SCHEMA ('v1'). Byte-for-byte identical to the DB
//                   (sbiq_audit_event_hash / sbiq_canonical_json); the algorithm is
//                   frozen — any change is a new schema version + ADR.
//
// Products SHALL consume this via `@/lib/platform/audit`, NOT by importing IQ
// internals or the audit_events table directly (Architecture Authority §7/§10).

export const AUDIT_CHAIN_SCHEMA = 'v1';
export const AUDIT_GENESIS_HASH = '0'.repeat(64);
const US = String.fromCharCode(31); // unit separator (chr 31) — matches the SQL array_to_string

export type Sha256Hex = (input: string) => string;

/** Canonical JSON: recursively sorted keys, scalars as quoted text, null → null.
 *  Matches sbiq_canonical_json exactly. */
export function canonicalJson(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) return '[' + v.map(canonicalJson).join(',') + ']';
  if (typeof v === 'object') {
    const keys = Object.keys(v as Record<string, unknown>).sort();
    return '{' + keys.map((k) => '"' + k.replace(/"/g, '\\"') + '":' + canonicalJson((v as Record<string, unknown>)[k])).join(',') + '}';
  }
  const s = String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return '"' + s + '"';
}

export interface AuditEventFields {
  chain_scope: string;
  chain_sequence: number | string;
  previous_hash: string;
  event_id: string;
  event_type: string;
  user_id: string | null;
  user_role: string | null;
  casino_id: string | null;
  resource_type: string | null;
  resource_id: string | null;
  outcome: string | null;
  created_at: string;           // ISO / timestamptz string from the DB
  correlation_id: string | null;
  metadata: unknown;
  hash?: string;
}

/** Canonical UTC millisecond timestamp — matches to_char(... 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'). */
export function canonicalTimestamp(created: string): string {
  return new Date(created).toISOString(); // e.g. 2026-05-21T13:47:20.124Z
}

/** Recompute an event's hash. Identical algorithm to sbiq_audit_event_hash. */
export function auditEventHash(f: AuditEventFields, sha256hex: Sha256Hex): string {
  const metaDigest = sha256hex(canonicalJson(f.metadata ?? {}));
  const fields = [
    AUDIT_CHAIN_SCHEMA, f.chain_scope, String(f.chain_sequence), f.previous_hash,
    f.event_id, f.event_type,
    f.user_id ?? 'system', f.user_role ?? '', f.casino_id ?? '',
    f.resource_type ?? '', f.resource_id ?? '', f.outcome ?? '',
    canonicalTimestamp(f.created_at), f.correlation_id ?? '', metaDigest,
  ];
  return sha256hex(fields.join(US));
}

export interface ChainVerifyResult {
  scope: string;
  status: 'verified' | 'broken';
  eventsChecked: number;
  lastSequence?: number;
  expectedHead?: string;
  firstFailingSequence?: number;
  reason?: string;
}

/** Independently verify one ordered chain (ascending chain_sequence). */
export function verifyChain(scope: string, events: AuditEventFields[], sha256hex: Sha256Hex, expectedHead?: string): ChainVerifyResult {
  let prev = AUDIT_GENESIS_HASH;
  let seq = 0;
  for (const e of events) {
    seq += 1;
    if (Number(e.chain_sequence) !== seq)
      return { scope, status: 'broken', eventsChecked: seq, firstFailingSequence: Number(e.chain_sequence), reason: 'sequence gap or duplicate' };
    if (e.previous_hash !== prev)
      return { scope, status: 'broken', eventsChecked: seq, firstFailingSequence: seq, reason: 'previous_hash linkage broken' };
    const expected = auditEventHash(e, sha256hex);
    if (e.hash !== expected)
      return { scope, status: 'broken', eventsChecked: seq, firstFailingSequence: seq, reason: 'recomputed hash mismatch' };
    prev = e.hash;
  }
  if (expectedHead !== undefined && expectedHead !== prev)
    return { scope, status: 'broken', eventsChecked: seq, reason: 'chain head mismatch' };
  return { scope, status: 'verified', eventsChecked: seq, lastSequence: seq, expectedHead: prev };
}
