# ADR-0017 — SafeBet Guardian Digital Evidence Vault & Chain of Custody (ARCH-V4-C7)

- **Status:** Accepted (synthetic Demo only; not production)
- **Date:** 2026-09-10
- **Relates:** ADR-0009..0016 (Guardian intelligence + case domains); Shared Evidence
  primitive (A4); Guardian Shared Audit chain.

## Context
Guardian needs a regulator-grade evidence lifecycle (provenance, integrity, custody, holds,
export) sitting between investigation cases (C6) and any future legal/enforcement workflow,
WITHOUT replacing the Shared Evidence primitive and WITHOUT deciding legal consequence.

## Decision
Add a seventh domain, **Digital Evidence Vault**, mirroring the Guardian pattern:

1. **Provenance/integrity only** — encoded invariants: evidence exists != legal finding;
   hash verified != fact legally proven; high-value evidence != enforcement. DB CHECKs forbid
   legal-determination + enforcement flags. No provider action, no AI legal decision.
2. **Shared Evidence stays the primitive** — the Vault adds the governed lifecycle above it
   and stores references + hashes, never bodies.
3. **9 `guardian`-schema tables** with jurisdiction, synthetic marker, RLS, append-only
   custody/access/integrity/version/derivation (trigger-guarded).
4. **Custody integrity = LAYERED (Option C)** — an independent per-evidence tamper-evident
   hash chain (`sequence_number` + `previous_event_hash` -> `event_hash`) **anchored** to
   Shared Audit. Chosen over Shared-Audit-only because Shared Audit is jurisdiction-scoped,
   not per-evidence; and over an independent-chain-only because the platform-wide audit
   anchor adds cross-cutting tamper-evidence. SHA-256 throughout.
5. **Private S3 vault** `safebet-guardian-evidence-demo`: block-all-public-access, SSE-AES256,
   versioning, TLS-only deny policy; worker `s3:PutObject` on `evidence/*` only; deterministic
   key -> retry-safe / orphan-reconcilable. No public URL.
6. **Governed contracts only** — new **Case Reference Contract** (`guardian.case_reference` +
   `resolveCaseReference`); C1-C5 origins via existing reference contracts. The worker never
   touches C1-C6 base tables.
7. **Dedicated least-privilege role** `guardian_evidence_worker` + dedicated secret; grants
   only the 9 evidence tables + audit + SELECT on `case_reference`. No BYPASSRLS, no
   public/IQ, no base tables.
8. **Durable pipeline** — SQS `guardian-evidence-processing` + DLQ + worker
   `safebet-guardian-evidence-worker` + DLQ alarm. Two-phase durability (store then commit;
   orphan reconcilable).
9. **IAM-protected API** — `/evidence` (+ register/verify/custody/link-case/hold/export). No
   `/enforce`/`/block`/`/takedown`/`/referral`.

## Consequences
- Regulator-grade provenance/integrity/custody/export without legal or enforcement authority.
- Access is role x jurisdiction x classification x purpose (no universal service-role human
  access).
- Strictly synthetic Demo; SafeBet IQ + Production untouched; MFA hard gate intact.

## Carried-forward architectural debt (P1, unresolved)
1. Separate, independently governed Guardian database (importance increased by an evidence
   vault, but NOT resolved).
2. MFA before real privileged regulatory roles.
3. Duplicate `safebetiq.com` hosted-zone consolidation.
