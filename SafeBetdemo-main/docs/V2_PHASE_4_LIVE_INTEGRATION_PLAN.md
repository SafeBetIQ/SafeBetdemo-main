# Version 2.0 — Phase 4 Live Integration Plan

**Phase 4.0 · PLANNING ONLY · 2026-07-16 · ADR-006 (frozen).** Defines the live-integration path
**without changing the approved architecture or redesigning the Phase 3 domain components.**
Covers conditions **C1** (contribution wiring + reconciliation) and **C5** (connector validation).

## 1. Approved live flow (unchanged architecture)
```
Operator Source System
  → Approved Operator Connector
  → Identity Resolution using SB-PLR
  → Hash-before-boundary federation contribution (jurisdiction pepper, HMAC)
  → Certified Event Platform / approved contribution boundary
  → NIFS
  → Identity Matching Engine → Federation Decision Engine → SB-NAT Registry
  → Enterprise Correlation Layer → National Policy Platform
  → Regulator-only outcomes
```
The domain components (matching/decision/registry/correlation/policy) are **reused as certified**;
Phase 4 only supplies the connector + contribution boundary + persistence around them.

## 2. Operator Connector Plan (C5)
| Aspect | Plan |
|---|---|
| Authentication | Per-operator credential (mTLS or signed token) at the contribution boundary |
| Authorisation | Write-only contribution scope; **no** federation/lookup/correlation/policy read |
| Tenant context | Connector bound to one operator tenant; tenant id attached + verified server-side |
| Jurisdiction context | Contribution carries jurisdiction; validated against operator licence |
| Event validation | Schema validation; only jurisdiction-approved attribute types; hash-only payload |
| Idempotency | Deterministic contribution key; duplicate contributions ignored |
| Replay protection | Timestamp + nonce + bounded replay window; replays rejected |
| Failure handling | Retriable vs terminal errors; structured error responses (no PII) |
| Dead-letter handling | Rejected contributions to a dead-letter store with reason; visible + explainable |
| Audit | Every contribution attempt audited (accepted/rejected + reason), no plaintext |
| Data retention | Contribution hashes retained per retention schedule (C7); raw values never stored |
| Reconciliation | Contribution counts reconcile operator↔national |
| Connector suspension | Flag/credential disable → immediate stop; documented runbook |
| Connector revocation | Credential revocation; contributions rejected thereafter |
| Validation tests | hash-only ingestion; tenant-isolation negatives; suspend/revoke; recovery |

## 3. Federation Attribute Contribution Plan (C1 part-1, Phase 4.3)
- **Approved attribute types per jurisdiction:** from the frozen jurisdiction profiles (ZA:
  national_id, phone, device_fingerprint). No new attribute types (no matching-rule changes).
- **Normalisation:** reuse `normaliseAttribute` (canonicalise before hashing) — connector-side
  conformance tests ensure identical normalisation across operators.
- **Hash-before-boundary:** operators hash with the jurisdiction pepper via the approved
  `HmacAttributeHasher` composition (HMAC algorithm; pepper from C4); **plaintext never crosses
  the boundary or is logged.**
- **Tenant attribution + versioning:** each contribution carries operator id + `pepperKeyVersion`.
- **Replay/duplicate:** as §2. **Revocation/expiry:** contributions revocable; attribute expiry per policy.
- **Rate limits + schema validation + error handling:** enforced at the boundary. **Operators remain write-only** — no lookup access.

## 4. Event Platform Integration Plan (C1 part-1)
- Contribute via the **certified Event Platform** / approved contribution boundary; **no new
  runtime contracts invented.** If a required event type is absent, **document the limitation** —
  do not bypass the Event Platform.
- Trust boundaries, authn/authz, tenant + jurisdiction context, validation, idempotency, replay
  protection, failure + dead-letter handling, audit, retention as §2/§3.
- The Event Platform remains **authoritative**; SafeBet IQ does not insert derived totals.

## 5. Live Wagering and GGR Reconciliation Plan (C1 part-2, Phase 4.5)
Prove, from live/sandbox source, that:
- valid sessions/wagers/wins/losses are **accepted** by the Event Platform;
- **rejected events are visible + explained** (no rejected-event workaround);
- operator totals and **projection** totals reconcile; **GGR** is computed by certified projections
  (not inserted); national aggregation reconciles to operator totals with **no duplicate counting**;
- tenant isolation and data freshness hold; **source-to-report provenance** is complete.
- Reconciliation report distinguishes **demonstration-ledger** vs **certified operator-runtime** vs
  **not-yet-available** categories — never merged (per certification §15).

## 6. Reconciliation categories (kept separate)
| Category | Phase 3 | Phase 4 target |
|---|---|---|
| Demonstration-ledger | AVAILABLE (in-memory) | retained for regression |
| Certified operator-runtime | NOT AVAILABLE | **C1/4.5 target** |
| Live Event Platform GGR | NOT AVAILABLE | **C1/4.5 target** |

## 7. Exit criteria
- **C5:** each connector ingests hash-only contributions; isolation negatives pass.
- **C1:** live wager/GGR events flow → certified projections; live operator↔national reconciliation
  report passes with no direct total insertion.
