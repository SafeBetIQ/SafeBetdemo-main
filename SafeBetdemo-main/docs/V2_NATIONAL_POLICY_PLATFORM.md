# National Policy Platform Extension — Technical & Schema Specifications (v2.0)

**ADR-006 (Accepted, frozen) · Milestone 3.6 · Regulator-plane, policy-as-DATA.**
Consolidated reference: technical overview, policy schema, explainability, audit,
integrity, and access-control specifications. Companion to
`V2_MILESTONE_3.6_POLICY_PLATFORM_REPORT.md`.

---

## 1. Technical Overview
A configurable, jurisdiction-specific national policy capability that consumes
authorised, read-only **Enterprise Correlation Layer** outputs (3.5) and evaluates
**declarative policy-as-data** into deterministic, versioned, auditable, regulator-
plane **outcomes**. It separates **definition → evaluation → outcome → approval →
enforcement** and implements the first four; it never modifies operator runtime,
SB-PLR, SB-NAT, the Registry, or the Correlation Layer, and does not replace the
operator Policy Platform.

**Module layout** (`lib/identityFederation/policy/`): `model.ts` (definitions,
store, access, audit, validation), `engine.ts` (`NationalPolicyEngine`,
`NATIONAL_POLICY_ENGINE_VERSION = '2.0'`), `index.ts` (public API).

**Composition:** `NationalIdentityFederationService.nationalPolicyEngine(provider,
store, now?, auditSink?)` binds a read-only correlation layer (over the injected
provider) + a policy store into an engine.

**Determinism:** same policy version + input + versions ⇒ same outcome. No ML, no
probabilistic decisions, no hidden scoring, no undocumented thresholds — every
evaluated condition is visible in the explanation.

---

## 2. Policy Schema Specification (policy-as-data)
A `PolicyDefinition` is declarative data, strictly validated, **immutable once
activated** (changes create a new version):

| Field | Meaning |
|---|---|
| `policyId`, `name`, `jurisdiction`, `category`, `policyVersion`, `ruleSetVersion` | identity + classification |
| `effectiveDate`, `expiryDate`, `status` | lifecycle window (`draft`/`active`/`retired`) |
| `requiredInputs` | fact keys that must be present, else *Insufficient Evidence* |
| `requiredEvidence` | documented evidence expectations |
| `conditions[]` | `{ id, description, input (fact key), operator, value }` — **data only** |
| `thresholds` | documented numeric thresholds (surfaced in `thresholdsUsed`) |
| `outcomeRules[]` | `{ id, requires: conditionId[], outcome, reason }` (first all-pass wins) |
| `defaultOutcome` | when no rule matches |
| `manualReview` | `{ requiredWhen: conditionId[], outcomesRequiringReview }` |
| `approvalRequirements`, `overridePermissions`, `appealPermissions` | governance |
| `auditRetention`, `legalReference`, `requiresIntegrity`, `allowedOutcomes` | metadata + guards |

**Condition operators** (no executable code): `eq, ne, gt, gte, lt, lte, in, nin,
exists, isTrue, isFalse`. Facts are a fixed, transparent projection of Correlation
Layer outputs (operator count, activity frequency, risk tier/escalation, harm and
intervention indicators, self-exclusion/cooling-off counts + conflicts, integrity,
provenance completeness). Unknown fact keys ⇒ condition **skipped** (unavailable).

**Outcomes:** No Action · Continue Monitoring · Regulator Review Required · National
Investigation Recommended · National Cooling-Off Recommended · National Self-Exclusion
Confirmed · Cross-Operator Escalation Required · Operator Notification Required ·
Intervention Review Required · Policy Conflict Detected · Insufficient Evidence ·
Data Integrity Failure. Outcome precedence: **missing required inputs → Insufficient
Evidence; else integrity failure → Data Integrity Failure; else first matching
outcome rule; else default.**

---

## 3. Explainability Specification
Every `PolicyEvaluation` records: `evaluationId`, `policyId`, `policyVersion`,
`jurisdiction`, `sbNat`, `category`, `outcome` + `outcomeReason`, `conditionsEvaluated`
(each with result + reason), `conditionsPassed/Failed/Skipped`, `thresholdsUsed`,
`evidenceAccepted`, `evidenceExcluded` (+ reasons), `dataFreshness`, `integrityStatus`,
`inputRefs`, `reviewState`, `appealState`, `overrideStatus`, `reviewer`, `timestamp`,
the **nine-part** `versions`, correlation `provenance`, `limitations`, and
`decisionHistory` / `overrideHistory` / `appealHistory`. No outcome exists without a
complete explanation. The evaluation is deep-frozen (immutable).

**Nine-part version stamp:** National Policy Engine · Policy · Rule-Set · Jurisdiction
· Correlation Engine · Federation Algorithm · Matching Engine · Federation Decision
Engine · Source-data freshness. Historical outcomes reproduce using their original
versions.

---

## 4. Governance: Review / Override / Appeal
- **Review:** not-required / pending-review / under-review / approved / rejected /
  returned / escalated / closed. Requires the `reviewer` role; a *not-required*
  evaluation cannot be reviewed. Each transition is a new immutable evaluation.
- **Override:** requires the `override-authority` role and policy permission; records
  original + new outcome, reviewer, authority, reason, supporting reference, and prior
  history. The original is never deleted/replaced.
- **Appeal:** open / under-review / upheld / dismissed / returned / closed. Requires the
  `appeal-reviewer` role and policy permission; preserves complete history.

---

## 5. Policy Audit Specification
Every action seals an **append-only, deep-frozen** `PolicyAuditRecord`
(`policy-evaluated`, `review-opened`, `review-decision`, `outcome-overridden`,
`appeal-opened`, `appeal-updated`, `appeal-concluded`, `policy-version-changed`,
`policy-retired`, `integrity-failure`) carrying jurisdiction, SB-NAT, policy id +
version, evaluation id, outcome, reviewer, reason, and the nine-part versions — and
**no PII**. The sink exposes no update/delete surface.

---

## 6. Conflict Detection Specification
Deterministic, never silently resolved:
- **duplicate-active-policy** — same policy evaluated under multiple versions.
- **jurisdiction-mismatch** — evaluation jurisdiction ≠ SB-NAT jurisdiction.
- **stale-or-incomplete-data** — integrity failed or freshness missing.
- **incompatible-outcomes** — a documented, jurisdiction-agnostic incompatibility
  matrix (e.g. *Self-Exclusion Confirmed* vs *No Action*).
Each conflict recommends **Policy Conflict Detected**.

---

## 7. Policy Integrity Specification
`verifyPolicyIntegrity` returns `{ ok, checks[], reproducible }` over: policy-exists,
policy-active-for-date, policy-jurisdiction-matches-sbnat, required-inputs-exist,
input-integrity-passed, provenance-complete, policy-version-valid,
rule-set-version-valid, outcome-allowed, no-plaintext-pii, audit-record-exists,
deterministic, no-runtime-mutation, historical-reproduction.

---

## 8. Access-Control Specification
`PolicyAccessContext = AccessContext + { roles: PolicyRole[] }`.
`authorisePolicy(ctx, jurisdiction, role)`:
1. `authorise(ctx, jurisdiction)` — regulator plane + sovereignty (deny-by-default).
2. `ctx.roles` must include the required role, else denied.

Roles: `evaluator` (evaluate), `reviewer` (review), `override-authority` (override),
`appeal-reviewer` (appeal). Enforced at the **service boundary** (not UI). Cross-
sovereign access requires explicit `sovereignJurisdictions`.

---

## 9. Certification Evidence Mapping (provisional, milestone-level)
| Certification | Evidence |
|---|---|
| C2-1 Architecture | Correct position; additive; deterministic; policy-as-data |
| C2-2 Security | Deny-by-default + role enforcement at the boundary |
| C2-3 Privacy | No PII; reference-based facts; PII scan |
| C2-4 Cross-Operator Intelligence | Explainable, provenance-carrying, reproducible outcomes |
| C2-5 Consumer Platform Regression | Operator/consumer runtime untouched; 323/323 green |
| C2-7 Regulator Acceptance Testing | Governed review/override/appeal + integrity + audit |

No final certification is claimed; C2-x completes at Milestone 3.8.

---

## 10. Release Notes (v2.0 · Milestone 3.6)
- **Added:** National Policy Platform Extension — policy-as-data definitions + immutable
  versioned store; deterministic evaluation engine; six policy families; full
  explainability; manual review / override / appeal governance; append-only policy
  audit; nine-part version stamp; conflict detection; policy integrity verifier;
  role-based deny-by-default access.
- **Security/Privacy:** regulator-plane only, deny-by-default + roles, no PII,
  jurisdiction sovereignty, declarative (non-executable) policies.
- **Compatibility:** fully additive; federation OFF by default; no operator runtime,
  SB-PLR, SB-NAT, Registry, or Correlation Layer behaviour changed; 323/323 tests pass;
  `tsc` clean.
- **Not included (by design):** operator enforcement integration, external delivery
  (email/SMS/webhook), UI/dashboards, public APIs, DB migrations, demonstration dataset
  v2 — deferred to later milestones.
