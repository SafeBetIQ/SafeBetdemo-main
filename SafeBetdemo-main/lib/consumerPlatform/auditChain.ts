// ─── DEPRECATED SHIM (ARCH-V4-A3 strangler) ─────────────────────────────────
//
// The audit-chain verification primitive moved to the SHARED PLATFORM FOUNDATION
// at `@/lib/platform/audit`. It is a shared capability (SafeBet IQ + future
// Guardian + Regulator Suite), not an IQ-internal one, so it no longer lives under
// the IQ consumer namespace.
//
// @deprecated Import from `@/lib/platform/audit` instead. This shim re-exports the
// governed module unchanged so existing IQ consumers keep working during the
// strangler transition; it will be removed once all consumers are migrated.

export {
  AUDIT_CHAIN_SCHEMA, AUDIT_GENESIS_HASH,
  canonicalJson, canonicalTimestamp, auditEventHash, verifyChain,
} from '../platform/audit/index.ts';
export type { Sha256Hex, AuditEventFields, ChainVerifyResult } from '../platform/audit/index.ts';
