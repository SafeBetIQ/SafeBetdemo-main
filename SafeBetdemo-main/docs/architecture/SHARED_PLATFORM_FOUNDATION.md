# SafeBet — Shared Platform Foundation (ARCH-V4-A4)

The **Shared Platform Foundation** is SafeBet's **internal technical infrastructure** that supports
all commercial products. **It is NOT a commercial product** and MUST NOT be marketed, sold, or
exposed as one. It is not SafeBet IQ, SafeBet Guardian, or the SafeBet Regulator Suite.

Each commercial product SHALL remain independently deployable/operable by consuming Shared
capabilities through **governed, versioned contracts** — never through another product's internal
implementation or business tables (Architecture Authority v4.0 §7/§10/§21).

## 1. Contract-first principle
```
PRODUCT  ->  SHARED INTERFACE (versioned contract)  ->  SHARED IMPLEMENTATION
```
Prohibited: `PRODUCT -> arbitrary shared DB tables`; `PRODUCT -> another product's internals`;
`GUARDIAN -> SafeBet IQ casino tables`; `REGULATOR SUITE -> SafeBet IQ casino tables`.

## 2. Dependency direction rules (codified)
- **Allowed:** `SafeBet IQ -> Shared`, `Guardian -> Shared`, `Regulator Suite -> Shared`.
- **Not allowed:** `Shared -> any product business domain`; `Guardian -> SafeBet IQ`;
  `Regulator Suite -> SafeBet IQ internals` — except through an explicitly approved, external-style,
  legally/business-justified contract.
- Enforcement seed: shared code lives under `lib/platform/*` and imports **no** product namespace.

## 3. Shared Platform Capability Register
Fields: capability · owner (all = Shared Platform Foundation) · current impl · consumers · contract ·
data owned / not owned · authN · authZ · tenant/jurisdiction · privacy class · audit · availability ·
versioning · failure mode · dependency direction · extraction status · hardening.

| # | Capability | Current impl | Contract | Owns / Not owns | AuthN/AuthZ | Tenant/Juris | Privacy | Extraction status | Hardening (future) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Audit** | `lib/platform/audit` (+ DB chain `audit_events`, `sbiq_audit_*`) | append + verify (pure) | owns chain hashing/verify contract; not business meaning | caller-supplied actor | per-tenant `chain_scope` | internal | **EXTRACTED (A3)** | DB audit-write service (A4+) |
| 2 | **Evidence** | `lib/platform/evidence` (+ `evidence-gateway`) | envelope/validate/reconcile/CSV (pure) | owns evidence framework; not storage impl | caller narrows scope (JWT) | casino-scoped | mixed | **EXTRACTED (A4)** | Shared evidence storage/retention client |
| 3 | **Identity & Tenancy** | `lib/security/principal`, `users`, `is_*`/`get_*_casino_id` | principal contract (§4) | owns principal model; not product roles' semantics | Supabase Auth | tenant + jurisdiction | PII | contract defined; impl later | product-aware roles + MFA-for-privileged |
| 4 | **Authorisation primitives** | RLS + role checks | RBAC+ABAC+SoD contract (§5) | owns primitives; not enforcement workflow | — | tenant/jurisdiction | internal | contract defined | SoD engine |
| 5 | **Workflow primitives** | `lib/workflow/*` | generic instance/transition/assignment | owns generic primitives; not product workflow semantics | actor | tenant | internal | classified; keep | split product workflows |
| 6 | **Policy primitives** | `lib/policyPlatform` | policy id/version/scope/approval | owns primitives; not Guardian NEPR | author/approver | jurisdiction | internal | classified | policy service |
| 7 | **Integration primitives** | `lib/connectorFramework`, `integration-*` | connector lifecycle/retry/health/ack | owns mechanics; not business meaning | service creds | per-operator | confidential | classified | enforcement adapter pattern |
| 8 | **Queue / worker** | SQS/DLQ/Lambda/EventBridge (A2) | conventions + envelope (§6/§7) | owns conventions; not product jobs | IAM least-priv | in-message | internal | **conventions formalised** | shared worker SDK |
| 9 | **Configuration** | `app_config`, `system_config`, `casino_config` | global/product/tenant/juris/env/secrets (§8) | owns config model; secrets separate | — | tenant/juris | mixed | classified | precedence engine |
| 10 | **Notifications** | `integration-whatsapp-send`, notification tables | dispatch/template/state/retry/audit | owns dispatch; not when/why | service | tenant | PII-capable | assessed | channel abstraction |
| 11 | **Observability** | version/health, cron logs, alarms | common emission contract (§9) | owns categories/tags; not business metrics | — | where lawful | minimised | contract defined | unified traces |
| 12 | **Reporting primitives** | `exportUtils`, CSV (evidence), report metadata | export/schedule/attach/access-audit | owns mechanics; not queries/semantics | scoped | jurisdiction-filtered | mixed | classified | no universal query layer |
| 13 | **Security utilities** | `lib/platform/audit` hashing, `csvCell`, redaction, id-gen | proven primitives only | owns helpers; no custom crypto | — | — | — | classified | managed crypto/KMS |
| 14 | **Service metadata / AI-gov / Privacy** | `ai_decision_log`, consent/DSR/retention tables | metadata + primitives (§10/§11) | owns primitives; not product AI/PII semantics | restricted | data-subject | high | classified | 42001/27701 registries |

Availability: all Shared capabilities inherit the platform SLO (auth is the critical SLO;
heavy work is queue-isolated per ADR-0001/0002). Versioning: additive-or-new-version; breaking
changes require an ADR.

## 4. Identity & Tenancy — product-aware principal contract
```
principal_id · product · tenant · jurisdiction · role · attributes ·
purpose/context · delegation · authentication_assurance · session_identity
```
Roles (SafeBet IQ implemented; others = **extension points only, not implemented in A4**):
IQ = Casino Operator/`casino_admin`, Platform Admin. Guardian (future) = Investigator, Legal/
Regulatory Reviewer, Authorising Officer, External Provider. Regulator Suite (future) = Regulator
User, Inter-Regulator Recipient. **Existing login/auth behaviour is unchanged.**

## 5. Authorisation target model + SoD primitives
Target = `RBAC + ABAC + product boundary + tenant/jurisdiction + purpose + delegation + SoD`.
SoD primitives (defined, not implemented): `actor_role · delegated_authority · action_scope ·
decision_ownership · same_case_role_exclusion · approval_evidence · effective_dates · revocation`.
Guardian rule (future): Investigator ≠ Legal Reviewer ≠ Authorising Officer for the same enforcement
decision. **No auth rewrite in A4.**

## 6. Standard asynchronous message envelope (versioned)
```json
{ "message_id": "uuid", "schema_version": "1", "product": "safebet-iq|guardian|regulator-suite|shared",
  "event_type": "string", "tenant_or_jurisdiction": "id|null", "correlation_id": "uuid",
  "idempotency_key": "string", "occurred_at": "iso-8601", "priority": "normal|high",
  "payload_reference": "ref (prefer reference/minimised payload)" }
```
Sensitive business payload SHALL NOT be embedded unless strictly required; prefer references.
Queue ownership per `queue-ownership-convention.md` (`safebet-iq-* / guardian-* / regulator-suite-* /
shared-*`). No universal queue.

## 7. Service metadata standard
Every Shared/product service SHALL carry:
`service_name · product_owner · version · source_sha · environment · dependencies · health_endpoint ·
data_classification · criticality · owner · runbook · rollback_reference`.
Reference: financial-rollup worker (ADR-0001 + runbook) already conforms.

## 8. Configuration ownership
Layers (precedence high→low): **ENVIRONMENT → JURISDICTION → TENANT → PRODUCT → GLOBAL PLATFORM**.
**SECRETS are NOT configuration** — sourced only from Secrets Manager / secure env (e.g.
`safebet/demo-supabase-service-role`), never from config tables, never logged.

## 9. Observability contract
Every product/service/worker emits: `product · service · environment · tenant/jurisdiction (where
lawful) · correlation_id · request/job_id · status · duration · error_class`. Categories: HEALTH,
AVAILABILITY, SECURITY, QUEUE, WORKER, DATA_FRESHNESS, INTEGRATION, AUDIT, FINANCIAL, AI. No
unnecessary personal/sensitive raw data in logs.

## 10. Database Shared ownership classification
`SHARED_OWNED` (audit chain, evidence framework tables, identity/tenancy, config, integration,
privacy, observability) · `PRODUCT_OWNED` (IQ risk/financial/player/session/machine/intervention/
case/event-projection) · `TEMPORARILY_SHARED_IN_PUBLIC_SCHEMA` (most Shared today — all in `public`) ·
`REQUIRES_FUTURE_EXTRACTION` (bounded schemas for new code, A4+) · `LEGACY` (Academy, `guardianlayer_*`).
**No big-bang migration**; any physical extraction is small/reversible/tested/low-risk. No objects
moved in A4 (source-contract extraction only).

## 11. Cross-operator safeguard
Cross-Operator Alerts remain `privacy-minimised signal -> matching -> permitted alert`. **No Shared
service is a universal raw cross-operator exchange.** `identityFederation` remains OFF. Operators
never receive another operator's raw GGR/deposits/losses/behaviour.

## 12. Guardian independence test — **PASS**
Future Guardian can rely on Shared Foundation contracts (audit `lib/platform/audit`, evidence
`lib/platform/evidence`, identity/authZ/workflow/policy/queue/observability primitives) **without**
`casino_event_log`, IQ player/GGR/intervention/behavioural tables. The extracted audit + evidence
modules are pure and product-agnostic (no IQ imports; verified by contract tests). Guardian will own
its own event/evidence stores. **PASS.**

## 13. Regulator Suite independence test — **PASS**
Future Regulator Suite (Website Pre-Compliance, Inter-Regulator Monitoring) can consume the same
Shared contracts without depending on `casino_event_log`, IQ player-risk/financial/intervention
tables, unless a later explicitly-authorised integration is created. **PASS.**

## 14. What A4 did / did not
**Did:** formalised the Foundation (this doc + registers + ADR-0004); extracted the **evidence**
framework to `lib/platform/evidence` (strangler, byte-identical, consumers migrated, tests). **Did
not:** implement product features, Guardian/Regulator business logic, Responsible Profitability
formulas, auth rewrite, broad SECURITY DEFINER remediation, or any physical schema migration.
SECURITY DEFINER estate unchanged (141/61/62/131); RLS/auth unchanged; A1/A2/A3 intact.
