# Privacy Foundation & AI Governance Primitive Register (ARCH-V4-A4)

Contract-level ownership for privacy and AI-governance capabilities under the Shared Platform
Foundation. **This does NOT claim a complete PIMS or AI Management System** — it records ownership,
contract concepts, and readiness gaps for ISO/IEC 27701 and ISO/IEC 42001. No implementation of a
full management system in A4.

## Privacy Foundation (ISO/IEC 27701 readiness)
Objects: `consent_records`, `data_subject_requests`, `data_retention_policies`,
`data_processing_activities` (+ `data_security_events`). Owner: **Shared Platform Foundation
(privacy governance)**.

Per-capability contract concepts (to be enforced later): `purpose · lawful_basis · classification ·
retention_class · access_role · deletion/expiry_rule · audit_requirement`.

| Object | Purpose | Lawful basis | Classification | Retention | Gap (27701) |
|---|---|---|---|---|---|
| consent_records | record consent | consent | Personal | policy-driven | consent lifecycle not enforced in-app |
| data_subject_requests | DSR handling | legal obligation | Personal/Special | policy | DSR workflow not automated |
| data_retention_policies | retention rules | legal obligation | Internal | n/a | enforcement not wired |
| data_processing_activities | RoPA | accountability | Confidential | n/a | RoPA not maintained as live artefact |

**High-sensitivity domains** (payment intelligence, cross-operator, regulator sharing, player risk,
self-exclusion, identity, evidence) prefer pseudonymous/tokenised ids + aggregates. **No complete
PIMS claimed.**

## AI Governance primitives (ISO/IEC 42001 readiness)
Current: `ai_decision_log`, `ai_prediction_log`, `ai_false_positive_log`, `ai_learning_metrics`,
`ai_reason_stacks`, `prompt_logs` + AI edge fns (`bri-risk-score`, `safeplay-ai-risk-engine`,
`wellbeing-risk-calculator`). Owner: **Shared AI governance (primitives)**; product-specific AI stays
product-owned.

Shared AI governance primitive contract (defined, **not** a full AMS in A4):
`model/system_identifier · version · intended_use · prohibited_use · input_provenance ·
decision/output_reference · human_oversight · performance_status · drift_status ·
rollback/disable_status · audit_reference`.

Prohibited autonomous AI outcomes (Authority §13) restated: no legal finding of illegality, no
regulatory approval, no payment block, no app removal, no domain suspension, no machine disable, no
certified-financial override, no medical diagnosis, no exploiting a vulnerable player for revenue.

**Gaps:** no model registry, no versioned validation/bias metrics, no drift monitoring, no
human-oversight records — recorded for Track E / 42001 readiness. No certification claimed.
