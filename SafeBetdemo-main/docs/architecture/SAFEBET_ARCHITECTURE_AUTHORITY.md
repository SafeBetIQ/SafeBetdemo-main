# SAFEBET PLATFORM — ENGINEERING ARCHITECTURE AUTHORITY v4.0

**Status:** AUTHORITATIVE / ALWAYS-REFERENCE ENGINEERING STANDARD
**Effective date:** 2 September 2026
**Primary market:** South Africa
**Applies to:** SafeBet IQ, SafeBet Guardian, SafeBet Regulator Suite, Shared Platform Foundation
**Supersedes:** SafeBet architecture v3.0 and v3.1 where they conflict with this document
**Change rule:** This document may only be changed through an explicit architecture decision and approved replacement version.

> Diagrams below were transcribed to clean ASCII from the authoritative source (the diagrams are conceptual; the section rules are normative). Normative text is reproduced verbatim.

> **CLAUDE ENGINEERING — MANDATORY INSTRUCTION:** Read and apply this architecture before planning, coding, migrating, deploying, or reviewing any SafeBet change. Do not treat a target capability as already built. Do not depart from a SHALL / MUST requirement without an approved Architecture Decision Record (ADR). Every engineering milestone must state its product boundary, data boundary, standards impact, security/privacy impact, test evidence, rollback, and Production impact.

---

## 1. Architecture mission

SafeBet exists to create measurable value for both regulated gambling operators and regulators while protecting players and preserving human legal authority.

The architecture SHALL support three commercial outcomes:

1. **SafeBet IQ:** safer players, stronger retention, sustainable operator revenue, and lower compliance risk.
2. **SafeBet Guardian:** detection, investigation, evidence, lawful authorisation, multi-channel disruption, and continuous monitoring of illegal gambling.
3. **SafeBet Regulator Suite:** holistic website pre-compliance and governed inter-regulator oversight/collaboration.

The platform SHALL NOT optimise player harm, fabricate compliance evidence, fake financial freshness, perform unauthorised enforcement, or claim standards/certifications that have not been independently achieved.

---

## 2. Final product portfolio

SafeBet has **three commercial software products**.

### 2.1 SafeBet IQ
**Casino Operator Intelligence & Responsible Profitability Platform.** Primary customer: licensed gambling operator.
Primary value proposition: **Protect Players + Improve Retention + Increase Sustainable Revenue + Reduce Compliance Exposure.**

### 2.2 SafeBet Guardian
**Standalone Illegal Gambling Intelligence & Multi-Channel Enforcement Platform.** Primary customer: gambling regulator / authorised public enforcement stakeholder.
Guardian SHALL be independently deployable and SHALL NOT require SafeBet IQ or SafeBet Regulator Suite to function.

### 2.3 SafeBet Regulator Suite
**Regulator Compliance & Collaboration Platform.** Contains only: **Website Pre-Compliance** and **Inter-Regulator Monitoring**.

### 2.4 Shared Platform Foundation
Not a commercial product. Reusable engineering capabilities consumed by one or more products under explicit product, tenant, jurisdiction, purpose, and role controls.

### 2.5 Explicitly excluded from the target portfolio
Do not build or reintroduce unless separately authorised: **Certification Gateway, VLT Telecontrol, SafeBet Academy.**

---

## 3. Complete logical architecture (conceptual)

```
                              SAFEBET PLATFORM
  +---------------------+  +---------------------+  +-------------------------+
  |     SAFEBET IQ      |  |  SAFEBET GUARDIAN   |  | SAFEBET REGULATOR SUITE |
  | Casino Operator     |  | Standalone          |  | Regulator Product       |
  | Responsible         |  | Illegal-Gambling    |  | - Website Pre-Compliance|
  | Profitability,      |  | Intelligence,       |  | - Inter-Regulator       |
  | Player Risk,        |  | Investigation/      |  |   Monitoring            |
  | Behavioural Intel,  |  | Evidence, Human     |  |                         |
  | Intervention,       |  | Authorisation,      |  |                         |
  | Financial Intel,    |  | Multi-Channel       |  |                         |
  | Self-Exclusion,     |  | Enforcement,        |  |                         |
  | Compliance/Cases,   |  | Re-entry & Payment  |  |                         |
  | Cross-Operator      |  | Intelligence        |  |                         |
  | Alerts              |  |                     |  |                         |
  +----------+----------+  +----------+----------+  +-----------+-------------+
             |                        |                         |
             +------------------------+-------------------------+
                                      |
                     +----------------+-----------------+
                     |   SHARED PLATFORM FOUNDATION     |
                     | IAM / RBAC / ABAC / Audit /      |
                     | Evidence / API & Integration     |
                     | Gateway / Case & Workflow /      |
                     | Notifications / Config / Secrets |
                     | & Keys / Observability/Reporting |
                     +----------------+-----------------+
                                      |
        +-----------------------------+-----------------------------+
        |                             |                             |
  +-----+------------+   +------------+-----------+   +-------------+----------+
  | DATA &           |   | DURABLE QUEUE /        |   | INTEGRATION &          |
  | INTELLIGENCE     |   | ISOLATED WORKERS       |   | CONNECTIVITY           |
  | ODS/History,     |   | Risk/Finance,          |   | Operator feeds, Banks/ |
  | Evidence/Audit,  |   | Crawlers/AI, Evidence/ |   | PSPs, ISPs/DNS/Hosting, |
  | Graph/Search,    |   | Reports, Provider      |   | Regulators, App stores  |
  | Feature/Cache    |   | adapters               |   |                         |
  +-----+------------+   +------------+-----------+   +-------------+----------+
        +-----------------------------+-----------------------------+
                                      |
                     +----------------+-----------------+
                     | SECURITY / COMPLIANCE / OPS      |
                     | SABS/SANS/ISO Controls, POPIA,   |
                     | Security/Privacy, HA/DR,         |
                     | Observability, Secure SDLC       |
                     +----------------------------------+
```

This diagram is conceptual. Product and bounded-context rules in the sections below are normative.

---

## 4. SafeBet IQ architecture

### 4.1 Product purpose — Responsible Profitability
SafeBet IQ SHALL be designed around **Responsible Profitability**: helping an operator improve sustainable commercial performance while reducing the probability of player harm. The system SHALL NOT answer or optimise for: "How do we make a vulnerable player gamble more?" It SHOULD answer: "How can the operator preserve a sustainable customer relationship while reducing harm, regulatory exposure, and avoidable customer loss?"

### 4.2 Player Risk Monitor
Capabilities: player risk scoring and trajectory; low/medium/high/critical states; evidence-backed risk drivers; source/as-of freshness; explainability; operator workflow integration; risk trend and emerging-harm detection.
Rules: loading is not zero; missing evidence is not invented evidence; stale data is not labelled fresh.

### 4.3 Behavioural Intelligence
Analyse, where lawfully available and appropriately minimised: gambling intensity; session duration; deposit behaviour; frequency changes; overnight play; wager escalation; loss patterns; repeated limit changes; behavioural deviation; machine/game interaction patterns; player trajectory. Every material behavioural conclusion SHOULD retain provenance to recorded facts.

### 4.4 Intervention Engine
```
Risk Signal -> Policy Evaluation -> Recommended Intervention -> Authorised Action
            -> Intervention -> Outcome -> Follow-Up -> Evidence -> Audit
```
Possible actions: responsible-gambling contact, promotion suppression, limit review, cooling-off recommendation, manual review, escalation, self-exclusion referral, compliance-case creation. Interventions SHALL be outcome-measurable.

### 4.5 Responsible Profitability Intelligence
A core SafeBet IQ bounded context. It correlates **Financial Activity + Player Risk + Behaviour + Interventions + Retention + Outcomes**.
Candidate metrics: GGR, Sustainable GGR, High-Risk Revenue Exposure, Revenue at Risk, Healthy Player Retention, Intervention Success Rate, Revenue Protected, Risk-Adjusted Player Value, Post-Intervention Retention, Responsible Revenue Ratio.
**Metric-governance rule:** no new commercial or wellbeing metric may be labelled production/certified until its formula, scope, source, limitations, owner, test cases, and regulatory interpretation are formally defined.

### 4.6 Financial Intelligence
Required concepts: wagering; winnings; GGR Today; MTD GGR; period-scoped financial values; certified financial posture; operational Live GGR; source/as-of timestamp; freshness state.
Mandatory freshness contract: `LOADING | FRESH | STALE | PARTIAL | UNAVAILABLE`.
Rules: GGR arithmetic remains **wagers - winnings** unless a formally approved product definition says otherwise; missing/stale/failed data SHALL NOT be converted into `R0 certified`; `R0 certified` is valid only when the authoritative certified calculation genuinely equals zero; Demo positive revenue SHALL come from synthetic wager/win events, not hard-coded UI values; Live/session GGR SHALL remain clearly distinguished from certified period GGR.

### 4.7 Self-Exclusion Management
Capabilities: operator-scoped register; search/filter/status; evidence/case references where supported; strict tenant isolation; authorised read/write controls. Cross-operator self-exclusion SHALL be governed as a network/regulatory capability and SHALL NOT expose competitor customer data.

### 4.8 Compliance & Case Management
Common lifecycle: `Recorded Fact -> Derived Intelligence -> Policy Decision -> Workflow Action -> Outcome -> Audit`. Missing evidence SHALL be explicitly described as missing/not linked, never fabricated for presentation.

### 4.9 Live Casino Intelligence
Include real source timestamps for: Active Now; sessions; floor activity; operational event feed; machine/game state where available; Live GGR (session). A UI refresh timestamp SHALL NOT masquerade as source-data freshness.

### 4.10 Machine & System Monitoring
Operator operational monitoring, not VLT Telecontrol. May include machine availability/state, floor activity, faults/status where supplied, machine-player activity projections.

### 4.11 Promotions & Campaign Monitoring
Responsible-gambling controls may influence campaign/promotion eligibility. High player-risk status SHALL NOT automatically increase promotion priority.

### 4.12 Cross-Operator Intelligence
Retain the intelligence capability but position operator-facing functionality as **Cross-Operator Alerts**. Operators SHALL NOT receive another operator's raw customer data, GGR, deposits, losses, proprietary behavioural data, or commercial KPIs.
```
Participating Operators -> privacy-minimised signals -> governed SafeBet matching/intelligence
                        -> permitted alert only -> authorised operator / regulator recipient
```
Potential alerts: active self-exclusion, serious responsible-gambling signal, duplicate identity, fraud/integrity risk, regulator restriction.

---

## 5. SafeBet Guardian architecture

### 5.1 Standalone requirement
Guardian SHALL have an independent: regulator application/runtime; authentication/authorisation boundary; data boundary; API surface; queue and worker pools; evidence and enforcement services where required; release/version lifecycle; observability boundary; backup/DR plan. It MAY reuse shared libraries/platform services through governed contracts, but SHALL NOT depend on SafeBet IQ being deployed.

### 5.2 Primary operating flow
`MONITOR -> DETECT -> VERIFY -> INVESTIGATE -> EVIDENCE -> AUTHORISE -> ENFORCE -> VERIFY -> TRACK`. AI is advisory. Authorised humans make legal/regulatory decisions.

### 5.3 Legal Operator Registry
Maintain regulator-supplied legal operator/licence/domain/app references where available. A failed match creates an investigation signal; it does not automatically determine illegality.

### 5.4 Domain & Website Intelligence
Potential signals: domain/DNS/RDAP; hosting/ASN; TLS/certificate lineage; redirects/related domains; website content; SA targeting; ZAR/local payment signals; operator identity/infrastructure relationships.

### 5.5 Mobile App Intelligence
Potential signals: app-store listing; developer/publisher; linked domains/operator; version/history; SA targeting; payment methods; licence matching.

### 5.6 Payment Intelligence
Preferred privacy architecture: `Merchant/Provider Token -> Payment Provider -> Operator -> Domain/App -> Aggregated Transaction Intelligence`. Guardian SHALL avoid unnecessary individual customer banking information. Clearly distinguish publicly observed payment signals from regulator/bank/PSP-supplied payment intelligence (the latter requires lawful authority and an integration/data-sharing arrangement).

### 5.7 Geo-Intelligence
Assess SA targeting, ZAR/local payments, registration accessibility, local promotions, geographic access restrictions, circumvention indicators.

### 5.8 Operator / Entity Resolution
`Operator -> Domains -> Apps -> Brands -> Licences -> Payment Identities -> Merchant Relationships -> Infrastructure -> Geo Signals -> Cases -> Evidence -> Enforcement Actions`.

### 5.9 Investigation and Case Management
`DISCOVERED -> TRIAGED -> UNDER INVESTIGATION -> SUSPECTED ILLEGAL -> CASE OPEN -> EVIDENCE COMPLETE -> LEGAL/REGULATORY REVIEW -> AUTHORISED -> ENFORCEMENT -> VERIFICATION -> MONITORING`. Alternative exits: verified/legal, more evidence required, rejected, closed, withdrawn.

### 5.10 Digital Evidence Vault
Material evidence SHALL be source-attributed, timestamped, hashed, encrypted, access-controlled, audited, bound to the relevant case/decision.

### 5.11 Separation of Duties
At minimum, investigation, legal/regulatory review, and authorisation are distinct decision functions. The same actor SHALL NOT unilaterally move a case from suspicion to enforcement.

### 5.12 National Enforcement Policy Registry
Target action types: DOMAIN_BLOCK, DNS_POLICY, REGISTRAR_REFERRAL, HOSTING_REFERRAL, APP_STORE_REFERRAL, PAYMENT_REFERRAL, GEO_RESTRICTION, MONITOR_ONLY. Each action SHALL preserve case, authority, evidence manifest, policy version, effective/expiry dates, state, hash/signature where applicable, provider response, verification.

### 5.13 Provider Enforcement / Referral State Machine
`AUTHORISED -> PUBLISHED/REFERRED -> ACKNOWLEDGED -> UNDER REVIEW -> ACTIONED/DECLINED -> VERIFIED -> CLOSED/EXPIRED/WITHDRAWN`. Acknowledgement SHALL NOT be treated as enforcement.

### 5.14 Payment Enforcement Gateway
Guardian can build the intelligence, authorised referral, signed policy/instruction, adapter, acknowledgement, status, verification, and evidence flow. Guardian SHALL NOT claim unilateral authority to freeze accounts, block transactions, terminate merchants, or access bank systems without agreement and legal authority.

### 5.15 Re-entry Intelligence
Correlate new domains, apps, brands, merchant identities, payment relationships, DNS/hosting/infrastructure signals, and other lawful indicators back to known operator entities. AI correlation is advisory; human review remains mandatory.

---

## 6. SafeBet Regulator Suite architecture

### 6.1 Website Pre-Compliance
SHALL assess the website **holistically**, not merely scan keywords.
`URL -> Crawl -> Page Inventory -> Screenshot/Capture -> Journey Runner -> Content Extraction -> Rule Engine -> AI-Assisted Assessment -> Findings -> Human Review -> Report -> Remediation -> Re-Scan`.
Assessment domains: operator/licence identity; RG warning wording and visual salience; age restrictions; registration/KYC disclosures; promotions/bonus claims; payments/deposits/withdrawals; self-exclusion accessibility; player protection; complaints; terms; privacy/POPIA notices; cookies; security posture indicators; geo/jurisdiction disclosures; consistency between pages; accessibility and user journeys.
Outputs SHOULD include compliance/category score, finding, severity, affected URL, evidence/screenshot, regulatory rule mapping, remediation recommendation, review status, re-test result. AI SHALL NOT independently make a final legal-compliance determination.

### 6.2 Inter-Regulator Monitoring
Inter-regulator data access SHALL use explicit governed sharing objects, not open database access.
`Source Regulator -> Share Request/Authority -> Approved Scope -> RegulatoryShare -> Recipient -> Access Audit -> Expiry/Withdrawal`. Every share requires legal basis, purpose, scope, source, recipient, time limit, auditability.

---

## 7. Shared Platform Foundation
Reusable capabilities: IAM; RBAC + ABAC; multi-tenant/jurisdiction isolation; API gateway and management; Audit & Evidence services; Policy/consent/purpose management; Notifications; Configuration/feature management; Case/workflow services; Reporting/BI; Search/index; secrets management; key management; observability. Shared infrastructure SHALL NOT imply shared unrestricted business data.

---

## 8. Data architecture and bounded contexts
Target logical bounded contexts: identity_tenancy, operator_risk, behavioural_intelligence, interventions, responsible_profitability, financial, self_exclusion, operator_compliance, evidence, audit, guardian, payment_intelligence, precompliance, interregulator, integration, ai_governance.
The current implementation may remain in a shared/public schema during transition, but this is **not the target state**.
Rules: bounded context owns its write model; cross-context access through explicit contracts/services/read models; tenant and jurisdiction attributes travel with business records/events; no uncontrolled cross-tenant joins for convenience; data-retention and purpose rules are context-specific.

---

## 9. Workload isolation and durable processing
Heavy workloads SHALL NOT share authentication/transactional compute in a manner that can starve login or critical OLTP traffic.
`Event / Scheduler -> Durable Queue -> Dedicated Worker Pool -> Bounded Context Store / Evidence / Read Model`.
Required queue qualities: durability; retries; dead-letter handling; idempotency; bounded concurrency; tenant-awareness; correlation IDs; priority; observability.
Worker classes — **SafeBet IQ:** risk scoring, behavioural analytics, financial intelligence, interventions, reports. **Guardian:** website/domain crawl, app intelligence, payment intelligence, geo intelligence, entity resolution, evidence, provider adapters, reports. **Regulator Suite:** pre-compliance crawling, journey testing, rules evaluation, evidence capture, reports.
The historic pattern of long-running financial jobs saturating shared Auth/OLTP compute is an architectural anti-pattern and SHALL NOT be reintroduced.

---

## 10. Integration architecture
`SafeBet Product -> Integration Gateway -> Provider Adapter -> External System`. Supported patterns: REST, mTLS APIs, secure webhooks, message queues/event streams, SFTP/secure files, host-to-host, batch import, secure provider portals. External categories: operators, regulators, banks/PSPs/acquirers, ISPs/DNS, registrars/registries, hosting providers, mobile-app platforms, intelligence providers, law enforcement. Third-party integrations SHALL be labelled proposed until a real agreement and tested integration exist.

---

## 11. Security architecture
Mandatory platform-wide controls: named identities and MFA for privileged access; least privilege; RBAC/ABAC; defence-in-depth tenant isolation; encryption in transit and at rest; managed key service; secrets management; secure session/cookie handling; secure SDLC; dependency/secret scanning; security logging and monitoring; incident response; DLP where applicable; immutable/tamper-evident audit for material actions; separation of duties for regulated decisions; backup/DR and restore validation.

### 11.1 Privileged database function rule
Privileged database/server functions SHALL NOT have anonymous/public execution unless a formally approved architecture exception proves the need and compensating controls. The existing SECURITY DEFINER estate is known security debt. New work SHALL NOT expand it casually.

### 11.2 Production provenance gate
Major Production change is blocked when deployed-source provenance, migration history, security caller model, or rollback cannot be proven. Demo success is not evidence that Production is safe to mutate.

---

## 12. Privacy and POPIA-by-design
Apply purpose limitation, data minimisation, retention control, access logging, lawful basis, security safeguards, and data-subject considerations appropriate to the processing context. High-sensitivity areas: cross-operator intelligence, payment intelligence, regulator sharing, player risk, self-exclusion, identity, evidence. Prefer pseudonymous/tokenised identifiers and aggregates where raw PII is unnecessary.

---

## 13. AI governance
AI SHALL be governed as a managed technology, not an untraceable feature. Required artefacts: model/system inventory; owner; intended use; prohibited use; version; training/source-data description where applicable; input/output schema; limitations; validation metrics; bias/fairness assessment where applicable; explainability approach; drift/performance monitoring; human oversight; rollback/disable path; decision/audit record.
AI SHALL NOT independently: declare an operator illegal; authorise enforcement; block a payment; remove an app; suspend a domain; make a regulator's legal decision; exploit a vulnerable player for revenue.

---

## 14. SABS / SANS / ISO standards authority

### 14.1 Mandatory principle
SafeBet SHALL be engineered for demonstrable alignment with **applicable** SANS, SABS conformity/certification practices where relevant, and applicable ISO/IEC standards. **Important distinction:** SABS is South Africa's National Standards Body; the normative technical documents are SANS standards. Engineering SHALL NOT use "SABS compliant" as a substitute for identifying the actual applicable SANS/ISO requirement.

### 14.2 Standards applicability rule
No standard is blindly applied. Each product/component SHALL have an applicability decision: `APPLICABLE | PARTIALLY APPLICABLE | NOT APPLICABLE | OUTSIDE CERTIFICATION SCOPE`. The decision and rationale SHALL be recorded in the **Standards Applicability Register**.

### 14.3 South African / SANS baseline
| Standard / family | Architecture use | Applicability rule |
|---|---|---|
| SANS/ISO 27001 | ISMS alignment | Platform-wide organisational/security baseline where adopted/current |
| SANS 9001 / ISO 9001 | Quality management | Platform/company quality processes; current adopted edition to be verified |
| SANS 90003 | Applying ISO 9001 to computer software | Software acquisition, supply, development, operation, maintenance guidance |
| SANS 22301 | Business continuity | Platform operations, resilience, continuity, recovery |
| SANS 1718 family | SA gambling technical standards | Only the gambling machine/device/WRS components within its actual scope; not a blanket software-platform standard |

The exact edition and clause-level requirement SHALL be verified against the current SABS source before engineering claims conformity.

### 14.4 ISO/IEC baseline
| Standard | Purpose in SafeBet |
|---|---|
| ISO/IEC 27001:2022 | Information Security Management System |
| ISO/IEC 27701:2025 | Privacy Information Management System |
| ISO/IEC 42001:2023 | AI Management System |
| ISO 22301:2019 | Business Continuity Management System |
| ISO/IEC 20000-1:2018 | IT Service Management System |
| ISO 9001:2026 | Quality Management System; use the applicable adopted SANS edition for SA conformity mapping |
| ISO/IEC 27017:2026 | Cloud-specific information-security controls/guidance |
| ISO/IEC 27018:2025 | Protection of PII in public cloud processing |
| ISO/IEC 17025:2017 | Testing/calibration laboratory competence only where SafeBet relies on/participates in accredited testing; not a general software certification |

### 14.5 Gambling technical standards scope
The NGB states the SANS 1718 family applies to gambling machines/devices, and gambling laboratories test applicable machines/devices. SafeBet SHALL maintain a **SANS 1718 Applicability Map** rather than claiming all SafeBet software is certified under SANS 1718. If SafeBet consumes certified machine/device/WRS data, preserve certification/version/source metadata to distinguish certified source data from SafeBet-derived intelligence.

### 14.6 No false certification claims
Alignment or internal testing does **not** equal external certification. Distinguish: designed/aligned for; internally assessed against; independently audited against; certified to. Only the final state may be called certified, and only when a valid external certification exists for the defined scope.

---

## 15. Standards Control Matrix — mandatory engineering artefact
Maintain a machine- and human-readable Standards Control Matrix in source control with fields: `control_id, standard, edition, clause_reference (only if licensed/authorised source available), product, component, applicability, requirement_summary, technical_control, process_control, evidence_required, control_owner, validation_method, validation_frequency, status, exceptions, expiry/review_date`. Recommended path: `/docs/compliance/standards-control-matrix.yml`. Claude SHALL NOT invent clause text from a copyrighted standard it cannot access; if clause-level text is unavailable, mark `STANDARD_TEXT_REQUIRED`.

---

## 16. Engineering Standards Impact Statement — mandatory per milestone/PR
Every non-trivial milestone/PR SHALL include: 1) product/context affected; 2) SANS/SABS applicability changed? 3) ISO applicability changed? 4) standards controls implemented/changed; 5) evidence produced; 6) security impact; 7) privacy/POPIA impact; 8) AI governance impact; 9) availability/DR impact; 10) data retention/classification impact; 11) exceptions/deviations and approved ADR. A change SHALL NOT be described as standards-compliant solely because tests pass.

---

## 17. Quality engineering and secure SDLC
Align software-quality practices to the QMS and SANS 90003 guidance where applicable. Minimum lifecycle controls: architecture/design review; threat/privacy assessment proportional to risk; code review independent of author for material security/regulatory changes; automated tests; static/type checks; dependency and secret scanning; migration review; performance/resource tests for heavy workloads; exact-SHA build/deploy provenance; rollback plan; post-deploy verification; evidence retention; release/change record.

---

## 18. Observability, service management and resilience
Each independently deployable product requires: service health; logs/metrics/traces; queue/worker health; integration/provider status; security telemetry; capacity/performance monitoring; cost/FinOps monitoring; incident/change/problem records; backup/restore monitoring. BC/DR objectives (RTO/RPO) SHALL be contract/product-specific and tested rather than merely documented.

---

## 19. Evidence and audit model
`Observation -> Recorded Fact -> Derived Intelligence -> Policy/Rule -> Decision -> Action -> Outcome -> Audit`. Rules: fact and inference remain distinguishable; evidence retains provenance; material regulated actions have actor/time/reason/authority; audit events are append-only/tamper-evident where required; evidence retention is policy-driven; synthetic Demo evidence is explicitly labelled synthetic.

---

## 20. Deployment architecture
Supported models: Managed Cloud (SafeBet-managed SaaS); Private Cloud (operator/regulator-specific isolated); Hybrid Cloud (cloud control plane with controlled on-prem/private connectivity). Guardian SHALL support isolated regulator deployment. Products MAY share cloud accounts/services where governed, but SHALL remain independently versionable and deployable.

---

## 21. Product isolation and release boundaries
Each commercial product SHALL have: explicit runtime boundary; configuration boundary; API contract; identity/role boundary; business data ownership; release/version identifier; observability; rollback capability. Shared libraries/services SHALL use versioned interfaces. Direct cross-product database writes are prohibited as a target pattern.

---

## 22. Current-state transition strategy
SafeBet SHALL use a **strangler migration**, not a big-bang rewrite. Known current-state: one Next.js application, a large shared Postgres/Supabase estate, Edge Functions, shared/public schema patterns, background DB jobs. Rules: do not rebuild stable capabilities unnecessarily; extract boundaries progressively; preserve validated behaviour while moving responsibility; workload isolation precedes heavy crawler/intelligence expansion; security/provenance gates remain independent.

---

## 23. Target implementation sequence
**Track A — Platform foundations:** A1 Financial/Live Intelligence close-out; A2 Workload isolation (durable queue + dedicated workers); A3 Product boundary extraction; A4 Shared Platform Foundation formalisation; A5 Security/privileged-function remediation and migration/provenance governance (separately authorised).
**Track B — SafeBet IQ commercial value:** B1 Responsible Profitability metric governance/foundation; B2 Intervention Outcome Intelligence; B3 Responsible Profitability operator dashboards; B4 Cross-Operator Alerts privacy/governance evolution.
**Track C — Standalone Guardian:** C0 Guardian standalone foundation; C1 Contained PoC; C2 Multi-channel intelligence; C3 Payment Enforcement Gateway; C4 Controlled regulator/provider pilot.
**Track D — Regulator Suite:** D0 foundation; D1 Website Pre-Compliance; D2 Inter-Regulator Monitoring.
**Track E — Standards and assurance:** E1 Standards Applicability Register + Standards Control Matrix; E2 ISMS/privacy/AI/QMS/BCMS/service-management certification-readiness gaps; E3 independent readiness assessments/certification programme when commercially authorised.

---

## 24. Definition of Done — architecture gate
A milestone is not complete until it provides, where applicable: canonical source SHA and clean provenance; architecture context/product boundary; standards impact statement; security/privacy/AI impact; data ownership and tenant/jurisdiction scope; tests and evidence; performance/resource evidence for background workloads; migration plan/history; rollback; exact build/deploy parity; observability/health checks; no unexplained Production mutation; documentation/ADR updates.

---

## 25. Architecture Decision Records
Any intentional deviation requires an ADR at `/docs/architecture/adr/ADR-XXXX-title.md` with fields: Status, Date, Context, Decision, Products affected, Standards impact, Security/privacy impact, Alternatives considered, Consequences, Migration/rollback, Approver, Review date.

---

## 26. Claude Engineering operating contract
Before starting any SafeBet engineering request, Claude SHALL: 1) identify the current architecture version (`v4.0` unless superseded); 2) identify product (IQ/Guardian/Regulator Suite/Shared Foundation); 3) identify bounded context and data owner; 4) confirm current canonical source/deployment state; 5) check whether the task is design-only, Demo, or Production; 6) check Standards Applicability Register and Standards Control Matrix; 7) state security/privacy/AI implications; 8) avoid re-building existing validated capability; 9) define tests, evidence, rollback, observability, deployment parity; 10) stop when a required standard/legal text, caller model, production source, or external authority is unproven.
After completion Claude SHALL return: what changed; what did not change; source SHA; tests/build/security evidence; standards controls affected; data/security/privacy impact; deployment/migration evidence; rollback; remaining gaps; Production mutation yes/no.

---

## 27. Non-negotiable prohibitions
SafeBet engineering SHALL NOT: hard-code commercial metrics to create a favourable demo result; present stale/unavailable values as certified; fabricate evidence; make AI the legal decision-maker; expose cross-operator raw commercial/player data without authority; perform external enforcement without authority/provider agreement; weaken RLS/auth/security merely to make a demo work; allow heavy background work to starve authentication/critical OLTP; claim SABS/SANS/ISO certification without valid certification; apply SANS 1718 to unrelated software merely because SafeBet is in gambling; blanket-apply database migrations when migration state is unproven; mutate Production when source/provenance/security/rollback is unproven.

---

## 28. External standards references — authority notes
These references identify the standards/governance sources used to establish this architecture baseline. They are not substitutes for licensed copies of the normative standards.
- SABS (National Standards Body; SANS catalogue and certification) — https://www.sabs.co.za/
- SABS standards access / SANS 90003 (applying ISO 9001 to computer software) — https://www.sabs.co.za/purchase-standard , https://www.sabs.co.za/sabs-standards
- NGB (SANS 1718 for gambling machines/devices; SANAS-accredited labs; ISO/IEC 17025 laboratory competence) — https://www.ngb.org.za/industry-regulation/technical-standards-sabs/
- ISO/IEC 27001:2022; ISO/IEC 27701:2025; ISO/IEC 42001:2023; ISO 22301:2019; ISO/IEC 20000-1:2018; ISO 9001:2026; ISO/IEC 27017:2026; ISO/IEC 27018:2025 — https://www.iso.org/

---

# FINAL ARCHITECTURAL POSITION

```
SAFEBET PLATFORM
|
+-- SAFEBET IQ  (Casino Operator Intelligence & Responsible Profitability)
|     Player Risk | Behavioural Intelligence | Intervention Engine |
|     Responsible Profitability Intelligence | Financial Intelligence |
|     Self-Exclusion | Compliance/Cases/Evidence |
|     Live Casino / Machine Monitoring | Cross-Operator Alerts
|
+-- SAFEBET GUARDIAN  (Standalone Illegal Gambling Intelligence & Enforcement)
|     Legal Operator Registry | Domain/Website Intelligence |
|     Mobile App Intelligence | Payment Intelligence | Geo Intelligence |
|     Operator Entity Graph | Investigations/Evidence | Human Authorisation |
|     National Enforcement Policy Registry | Provider/Payment Enforcement |
|     Re-entry Intelligence
|
+-- SAFEBET REGULATOR SUITE
|     Website Pre-Compliance | Inter-Regulator Monitoring
|
+-- SHARED PLATFORM FOUNDATION  (internal technical foundation, not a product)
      Identity/RBAC/ABAC/Tenancy | Audit/Evidence/Workflow |
      API/Integration/Notifications | Data/Search/Reporting |
      Durable Queues/Isolated Workers | Security/Privacy/AI Governance |
      Observability/HA/DR/Service Management | SABS/SANS/ISO Standards Framework
```

**Engineering north star:** Every SafeBet capability must be secure, evidence-driven, privacy-conscious, tenant/jurisdiction-aware, operationally resilient, commercially useful, and demonstrably mapped to the applicable regulatory and SABS/SANS/ISO control framework.

**END OF AUTHORITATIVE ARCHITECTURE v4.0**
