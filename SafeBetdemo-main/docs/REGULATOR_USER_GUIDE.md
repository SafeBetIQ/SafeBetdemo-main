# SafeBet IQ — Regulator User Guide (v1.2)

For gaming-authority staff using the Enterprise Regulator Intelligence Portal. Written for regulators, not engineers. The portal is a **consumer** of the certified platform — every value shown originates from the enterprise flow, is anonymous (no player PII), and is labelled with its evidence class.

Access: sign in with your regulator account → **Regulator Intelligence** (`/regulator/intelligence`). You see only your jurisdiction's operators.

---

## Evidence classification (on every screen)
- **Recorded Fact** — happened and was recorded on the immutable event log (wagered amounts, intervention counts, timestamps, risk tiers).
- **Derived Intelligence** — computed by the platform's intelligence layer, shown with its basis (risk escalation, trigger type, emerging risks).
- **Policy Decision** — a rule outcome, shown with its regulation reference.
- **Demonstration Data** — synthetic content, always identifiable.
You will never see fabricated evidence, and never a player's real identity — only anonymous SB-PLR identifiers.

## 1. National Overview (monitor)
Your landing view answers "what is the national responsible-gambling picture right now?": number of operators, anonymous active players, the risk-tier distribution (critical/high/medium/low), players under monitoring, interventions, and **emerging risks** (derived). Operator health lists each operator's active players, critical-risk count, and monitoring cohort.

## 2. Cross-Operator Intelligence (compare)
Aggregate patterns across operators — risk distributions and intervention rates by operator, and the national distribution. **Privacy by design:** SafeBet identity is anonymous *per operator*, so the same person cannot be linked across operators. This view is therefore aggregate/cohort-level only; it clearly states `per-player linkage: not available by design`. (Individual cross-operator linkage would require a future, separately-governed identity-federation decision.)

## 3. Operator Compliance (oversee)
Per-operator compliance status — `attention` (critical-risk present), `monitor` (monitoring cohort present), or `clear` — with active players, monitored counts, and interventions. No operator can see another operator's data; only you (the regulator) see the national comparison.

## 4. Investigation Workspace (investigate)
Open **Investigation**, enter an **anonymous SB-PLR id** and an in-jurisdiction **casino id**, and Investigate. You get:
- **Event Timeline** (Recorded Fact) — the player's immutable activity in order.
- **Intelligence** (Derived) — risk escalation, behaviour indicators, recommendations.
- **Policy Decisions** (Policy Decision) — with regulation references.
Everything is reconstructable deterministically from the event log (the replay reference confirms this).

## 5. Evidence Package (audit)
From an open investigation, **Build evidence package** → a structured package with four classified sections (Timeline, Intelligence Summary, Policy Decisions, Intervention Record), a replay reference, and an attestation confirming anonymity and traceability. **Export package (JSON)** produces an audit-ready file. Every section is labelled with its evidence class.

## 6. Regulatory Reports
Generate export-ready reports (Responsible Gambling Overview, Operator Compliance, Intervention Statistics, Cross-Operator, National Trend, Policy Effectiveness, Regulatory Risk) — each composed of classified sections from projected facts.

---

## What the portal guarantees
- **Anonymous** — no player names, emails, phones, or loyalty ids anywhere; only SB-PLR identifiers.
- **Jurisdiction-scoped** — you see only your operators; cross-jurisdiction data is inaccessible.
- **No fabrication** — every value is a Recorded Fact, Derived Intelligence, or Policy Decision, and labelled as such.
- **Traceable** — investigations and evidence packages reference deterministic replay from the immutable event log.
- **Read-only** — the portal presents; it never changes casino data or platform state.

## Getting help
Operational questions: your platform operations contact (`OPERATIONS_MANUAL.md`). Capability/scope questions: `REGULATOR_INTEGRATION_GUIDE.md`. API details: `API_REFERENCE.md` §6c.

---

## Investigation Workspace (v1.5)

The Investigation Workspace (`/regulator/cases`) lets you manage regulatory investigations as structured, auditable cases — scoped automatically to your jurisdiction (from your verified sign-in; you can never see another jurisdiction's operators).

- **Open an investigation** — give it a title, the operator (casino id) under investigation, and an optional anonymous subject (`SB-PLR-…`). Deep-dive evidence stays in the existing **Investigation view** (`/regulator/investigation`); the case links to it.
- **Track & advance** — each investigation carries a status, an anonymous timeline (Recorded Fact → Derived Intelligence → Policy Decision → Workflow Action → Recorded Outcome → Case Resolution), and a full audit history. Advance it through review to resolution; every step is timestamped and immutable.
- **Record observations** — add regulatory observations as notes. These are anonymous and appended to the audit trail.
- **Anonymity** — investigations only ever reference anonymous SB-PLR identifiers and evidence-package references. No PII is stored or shown.

Investigations never recalculate intelligence — they orchestrate your review of evidence the certified platform already produced.
