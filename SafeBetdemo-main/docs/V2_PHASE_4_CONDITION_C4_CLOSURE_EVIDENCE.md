# Phase 4 — Condition C4 Closure Evidence (Milestone 4.2)

**2026-07-16 · ADR-006 (frozen).** Honest closure status. **C4: PARTIALLY CLOSED** — not falsely closed
without a managed secret-store binding (per the milestone instruction).

## C4 — verbatim
- **Condition:** "Production HSM / Secrets Manager pepper + rotation."
- **Test of satisfaction:** "Pepper served from HSM/Secrets Manager; a key-rotation + recovery exercise completes with versioned continuity."

## What is DONE (application + cryptographic layer)
| Requirement | Evidence |
|---|---|
| Keyed construction (HMAC-SHA-256) | `provider.ts` / `secretStore.computeHmac`; determinism + sensitivity tested |
| Versioned collision-safe canonical input | `canonicalHashInput` (`cf-1`, length-prefixed, NFC); tested |
| Jurisdiction-isolated peppers, no global pepper | per-jurisdiction material; cross-jurisdiction digests differ (tested) |
| Pepper lifecycle | 7 states + transition table; audited transitions |
| Governed rotation with **versioned continuity** | `rotate()` dual-version transition; old≠new; both recognised; tested |
| **Rotation + recovery exercise completes** | rotate → transition → retire; compromise → provision new → approved reactivation (tested) |
| Fail-closed (no fallback) | disabled/unknown/unusable → `CryptoError`; no unkeyed/global/demo fallback (tested) |
| Least-privilege operations | actor roles enforced (tested) |
| Secret-free cryptographic audit | append-only, deep-frozen, secret-field guard (tested) |
| No raw-secret exposure | non-exported WeakMap; `store.raw` does not exist (finding CRYPTO-F1 fixed; tested) |
| No PII/secret leakage | serialised scan clean (tested) |

## What is NOT done (OPEN residual → deployment binding)
- **"Pepper served from HSM/Secrets Manager"** — the pilot uses an **in-memory** non-production store; no
  managed AWS Secrets Manager / HSM binding is available in this environment. **No HSM protection is
  claimed.**
- **At-rest KMS encryption**, **least-privilege IAM to pilot secret paths**, and the **rotation +
  recovery exercise on the managed store** are the outstanding evidence.

## Status & retest to fully close
- **Status: PARTIALLY CLOSED.**
- **Retest to close:** bind `PepperSecretStore` to a managed non-production Secrets Manager/HSM; run the
  rotation + recovery exercise against it with versioned continuity; verify IAM least-privilege + wrong-
  role denial + no production access. (Same provider/harness; only the store binding changes.)

## Cross-condition confirmation
- **C2** (durable regulator-plane DB + RLS) — **PARTIALLY CLOSED, unchanged** by 4.2.
- **C3** (durable append-only audit) — **PARTIALLY CLOSED, unchanged** by 4.2.
- **C10** — **CLOSED** (Milestone 4.1). No condition status was altered without new evidence.
