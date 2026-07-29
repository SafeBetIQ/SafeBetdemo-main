# SafeBet IQ — Regulator Integration Guide (Version 1.0)

For gaming regulators and regulatory-systems integrators. Describes the **certified** regulatory capabilities of SafeBet IQ Version 1.0, consistent with `docs/ENTERPRISE_REFERENCE_ARCHITECTURE.md`, `docs/ENTERPRISE_READINESS_DOSSIER.md`, and `docs/API_REFERENCE.md`.

Capability tags: **[Implemented]** certified v1.0 · **[Phase 5]** approved future · **[Out-of-flow]** outside the certified flow.

---

## 1. Purpose
Give regulators verifiable, privacy-preserving oversight of responsible-gambling and compliance across the operators and jurisdictions they supervise — from an immutable, replayable event record, with a clear separation between recorded facts, derived intelligence, and policy decisions.

## 2. Supported regulator capabilities
- **[Implemented]** Jurisdiction-scoped compliance view (risk tiers, monitoring cohort, regulatory decisions, audit evidence) via the Consumer Gateway.
- **[Implemented]** Immutable, partitioned, replayable audit record (the event log) as the source of truth.
- **[Implemented]** Configuration-driven jurisdiction policies with versioning, rollback, and an audit trail.
- **[Implemented]** Anonymous-by-design identity (no player PII anywhere in the flow).
- **[Implemented]** Evidence classification on every regulator-facing value.
- **[Implemented, v1.2] Enterprise Regulator Intelligence Portal** — national dashboard, cross-operator (aggregate) intelligence, investigation workspace, evidence-package builder, and a regulatory reporting suite, served through the certified Consumer Platform (`regulator-portal`). See `REGULATOR_USER_GUIDE.md` and `API_REFERENCE.md` §6c. Downloadable evidence packages (JSON) are implemented; additional export formats are a UI enhancement.
- **[Phase 5]** Time-series national trend rollups; per-individual cross-operator linkage (requires an identity-federation ADR — denied by default today, by design).

## 3. Identity privacy model [Implemented]
Players are represented only by an anonymous 96-bit `SB-PLR-…` identifier derived per casino from a one-way hash of the operator's opaque reference. No name, email, phone, or raw reference is stored, logged, transmitted, or shown. Regulators see anonymous cohorts and journeys — sufficient for oversight, aligned with data-protection obligations. Cross-casino linkage/federation is denied by default at the Identity Policy layer.

## 4. Evidence classifications [Implemented] (Constitution §8)
Every regulator-facing value is exactly one of:
- **Recorded Fact** — carried on an immutable event or materialised 1:1 by a projection (wagered amounts, intervention counts, timestamps, risk tiers).
- **Derived Intelligence** — produced by the Domain Intelligence Platform, labelled with stage and confidence (GRPI, escalation level, predicted risk, trigger type).
- **Policy Decision** — produced by the Policy Platform, carrying `policyReference` and `executionRequired`.
- **Demonstration Data** — synthetic content, always identifiable (`is_simulated`).

No component presents simulated or inferred data as operational fact. (Example: intervention delivery channel/status are reported as `unrecorded`/`recorded`, never fabricated as "delivered".)

## 5. Compliance reporting [Implemented]
`GET /consumer-gateway?view=compliance&casino_id=<uuid>` (regulator JWT) returns, for casinos in the regulator's jurisdiction:
- risk tiers (critical/high/medium/low), active players;
- players requiring monitoring (anonymous id, risk score/flags, intervention count, last intervention);
- regulatory decisions (notifications/reviews required, with policy references);
- audit evidence (events observed, projection lag).

Executive/portfolio summaries: `view=summary`. Outstanding compliance actions: `view=actions` (compliance-officer profile).

## 6. Replay capability [Implemented]
The event log is append-only, immutable (DB-enforced), monthly-partitioned, and deterministically replayable: `projection-platform?action=rebuild` reconstructs runtime state from the immutable log through the same reducers as the live path (verified: identical rebuild twice). This is the basis for regulator-grade historical reconstruction. Archived (detached) partitions remain queryable and re-attachable. A regulator-facing replay UI is **[Phase 5]**.

## 7. Audit process [Implemented]
- **Business audit:** the immutable `casino_event_log` (per-casino, journey-correlated) is the record of what happened.
- **Configuration audit:** `policy_change_log` records every policy activation/rollback (actor, action, from/to version, reason).
- **Operational audit:** structured, PII-free telemetry.
All three are available to authorised regulators/administrators; access is least-privilege and JWT-verified.

## 8. Policy governance [Implemented]
Jurisdiction rules are DATA in a versioned store (`policy_sets`/`policy_rules`), evaluated by the one Policy Platform. A threshold change is a data operation (seed → activate) with zero deploy and a full audit trail; rollback is minutes. Regulators may review the active set and change history (`platform-ops?action=policy-list`, administrator access).

## 9. Jurisdiction configuration [Implemented]
Jurisdiction is a registry property of each casino (`casinos.jurisdiction`) — never chosen by a caller. Shipped jurisdiction packs: **ZA** (National Gambling Board), **BW** (Gambling Authority), **KE** (BCLB). Registered extension points (activate by supplying a rule set, no code change): **NA, NG, GH, MU**. Rules cite their regulation (`policyReference`).

## 10. Monitoring [Implemented]
Operational health and alerting (projection lag, drift, ingestion stall) are available to administrators via `platform-ops?action=monitor`, evaluated against operating-mode thresholds. This supports the operator's obligation to maintain a live, evidence-producing platform.

## 11. Operational responsibilities
- **Operator:** stable identity references, accurate event emission, monitoring response, policy adherence.
- **SafeBet IQ / operator ops:** platform health, backups, replay, policy governance (`OPERATIONS_MANUAL.md`).
- **Regulator:** define jurisdiction thresholds (delivered as policy configuration), review compliance views and audit trails.

## 12. Security [Implemented]
Verified-JWT authentication; jurisdiction-scoped RLS (a regulator sees only casinos in their jurisdiction — verified: moving a casino to another jurisdiction removes it from the regulator's view); anonymous data; append-only audit log; least-privilege operations. A regulator cannot read another jurisdiction's data.

## 13. Regulator onboarding
1. Provision a regulator user (`users`, role `regulator`/`national_regulator`/`provincial_regulator`) with the correct `jurisdiction` (and `province` for provincial). 2. Confirm compliance-view access scoped to that jurisdiction. 3. Deliver jurisdiction thresholds as a policy set (seed + activate). 4. Walk through evidence classification and replay.

## 14. Acceptance testing
- Regulator sees only in-jurisdiction casinos (cross-jurisdiction → `403`/absent).
- Compliance view returns anonymous cohorts with recorded/derived/decision classification.
- A policy threshold change (activate a new version) alters decisions with zero deploy and is audited.
- A rebuild reproduces projections from the immutable log (evidence integrity of replay).
- No PII appears in any response, log, or view.

## 15. Certification checklist (regulator)
- [ ] Jurisdiction-scoped access verified; no cross-jurisdiction leakage.
- [ ] Evidence classifications present and correct on every value.
- [ ] Immutable audit log + policy change log accessible.
- [ ] Jurisdiction policies configured, versioned, and auditable.
- [ ] Replay reconstructs state deterministically.
- [ ] Anonymous identity confirmed (no PII).
- [ ] Monitoring/alerting available for platform-liveness assurance.

---
*Phase 5 for regulators: replay/evidence UI and downloadable audit packs. Out-of-flow: `safeplay-connect` and `wellbeing-games` are not part of the certified regulatory evidence flow in v1.0.*
