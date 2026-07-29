# SafeBet IQ — National Identity Federation Design (v2.0)

**Status: PROPOSED — Phase 1 (documentation only). No code, schema, migration, or service exists yet.**
Governed by ADR-006 and the Six Constitutions. Read with `PRIVACY_IMPACT_ASSESSMENT_v2.md`, `SECURITY_ARCHITECTURE_THREAT_MODEL_v2.md`, `V2_MIGRATION_AND_ROADMAP.md`.

---

## 1. Problem & goal
SafeBet IQ must answer, for a regulator only and without exposing PII:
- Has this anonymous individual been active across multiple licensed operators?
- Have they self-excluded elsewhere?
- Is harmful behaviour escalating nationally?
- Have multiple operators already intervened?
- Should the regulator open a national investigation?

Today `SB-PLR` is per-casino and federation is denied (ADR-001). v2.0 adds a **regulator-plane national identity** without weakening any existing guarantee.

## 2. The two-tier identity model
| Tier | Id | Scope | Who sees it | Derivation |
|---|---|---|---|---|
| Operator (existing, unchanged) | `SB-PLR-<24hex>` | Per-casino, anonymous | The owning operator + regulator | Deterministic `sha256-v2` of `sbiq-v1:<casino_id>:<ref>` (ADR-001) |
| **National (new)** | `SB-NAT-<24hex>` | National, anonymous | **Authorised regulators ONLY** | **Minted** anonymous cluster id (NOT derived from PII) |

`SB-NAT` is the canonical national identity. One `SB-NAT` links 1..n `SB-PLR`s (the same anonymous person across operators). `SB-PLR` values never change; an operator never learns any `SB-NAT` or any other operator's `SB-PLR`.

```
        ┌───────── Operator plane (per-tenant, unchanged) ─────────┐
Casino A  SB-PLR-A…   ┐
Casino C  SB-PLR-C…   ├─────►  N I F S  ─────►  SB-NAT-77…   ┐
Casino F  SB-PLR-F…   ┘         (regulator plane)            ├─ National Player Twin (regulator-only)
                                                             ┘
```

## 3. National Identity Federation Service (NIFS) — responsibilities
A new enterprise service (`lib/identityFederation`), downstream of the certified flow, that:
1. **Ingests hashed matching attributes** contributed by operators (never PII, never plaintext) as certified events.
2. **Matches** hashes across operators using deterministic, explainable rules.
3. **Mints / resolves `SB-NAT`** cluster identities and maintains the `SB-PLR ↔ SB-NAT` mapping.
4. **Scores confidence** (Confirmed / Probable / Possible / Rejected) with evidence.
5. **Prevents duplicate national identities** (entity-resolution clustering + merge/split under regulator control).
6. **Records an immutable audit + appeal trail** for every federation decision.
7. **Serves regulator-only** national identity + cross-operator intelligence via the Consumer/Regulator Platform.
NIFS **owns**: national identity resolution, the mapping, confidence, national twin assembly. NIFS **does NOT own**: events, projections, operator intelligence, policy evaluation logic (it consumes them). It never exposes anything to operators.

## 4. Matching strategy (privacy-preserving, explainable)
**Never store plaintext PII.** Operators compute, at their own edge, a **salted keyed hash** of each available attribute and submit only the hash:

`attr_hash = HMAC-SHA256( national_pepper , attribute_type || ':' || normalise(value) )`

- `national_pepper` — a per-jurisdiction secret held in the platform's HSM/Secrets Manager, **not known to operators** (operators call a hashing helper that applies it server-side at the federation-submit boundary, OR the pepper is applied inside NIFS after a transport-hash — see Security doc §HMAC). This prevents an operator from brute-forcing another operator's attribute space offline.
- `attribute_type` ∈ {national_id, passport, phone, email, loyalty_number, device_fingerprint, payment_instrument}.
- `normalise(value)` — deterministic canonicalisation (E.164 phone, lowercased email, trimmed id) so the same real value hashes identically across operators.

**Matching rules (configurable per jurisdiction, data not code — Constitution §4):**
- Two `SB-PLR`s **link** when they share ≥ 1 attribute hash, weighted by attribute strength:
  - Strong (unique government identity): `national_id`, `passport` → weight 1.0
  - Medium: `phone`, `email`, `payment_instrument` → weight 0.6
  - Soft: `loyalty_number`, `device_fingerprint` → weight 0.3
- **Confidence tier** from the combined evidence for a candidate link:
  - **Confirmed** — any strong match, OR combined weight ≥ 1.0 from ≥ 2 independent medium attributes.
  - **Probable** — combined weight ≥ 0.6 (e.g. one medium attribute) with corroboration.
  - **Possible** — a single soft attribute only.
  - **Rejected** — regulator manual override, or a jurisdiction rule excludes the link.
Weights, thresholds and which attributes are enabled are **jurisdiction configuration**, not code.

## 5. Identity confidence & explainability
Every `SB-NAT` link record carries: `confidence` (tier + numeric), `evidence` (the attribute *types* that matched — never the values/hashes shown to a human), `matching_rule` (id + version), `timestamp`, `source_operators` (casino ids), `manual_override_status`, `audit_history[]`, `appeal_history[]`. Every decision is explainable in plain language ("Linked as *Confirmed*: matched hashed national ID across Operator A and Operator C on 2026-07-16") without revealing any PII. This is the Evidence Integrity Principle (§8) applied to identity: an `SB-NAT` link is **Derived Intelligence** with confidence + provenance.

## 6. Certified data flow (through the Event Platform — Constitution §1)
NIFS does **not** bypass the Event Platform. Hashed attributes enter as a new immutable event type and are processed downstream exactly like Domain Intelligence enriches the twin.

```
[Operator edge]
  player PII (never leaves operator)             ── stays at operator; NOT sent
  → operator computes attr hashes (salted)       ── privacy boundary #1
  → POST federation-submit {casino_id, SB-PLR, attr_hashes[]}   (verified operator JWT, own tenant only)
        │
        ▼
[Event Platform]  validate → enrich(identity=SB-PLR, tenant) → persist append-only
  event_type = IDENTITY_FEDERATION_ATTRIBUTE   (payload = hashes only, per-tenant, RLS-scoped)
        │
        ▼
[National Identity Federation engine]  (regulator plane, downstream projector)
  match hashes across operators → cluster → mint/resolve SB-NAT
  write national_identity_map (SB-PLR↔SB-NAT, confidence, evidence) + federation_audit
        │
        ▼
[National Player Twin]  (regulator-only) assembles operator history / risk / interventions
  by REFERENCE over the certified per-casino projections for each linked SB-PLR
        │
        ▼
[Policy Platform]  national policy scope (self-exclusion, cross-operator escalation) — data, not code
        │
        ▼
[Consumer / Regulator Portal]  regulator-only national views  ── privacy boundary #2 (regulator JWT + RLS)
        │
        ▼
[Regulator UI]  National Player Summary · Cross-Operator Timeline · National Self-Exclusion · Alerts
```
Operators see **only** their own `IDENTITY_FEDERATION_ATTRIBUTE` events (RLS by `casino_id`) — hashes of their *own* players, which they already know. They can never read the mapping, another operator's hashes, or any `SB-NAT`.

## 7. Sequence diagrams

### 7.1 Operator contributes hashed attributes (write-only)
```
Operator App        federation-submit edge     Event Platform      NIFS engine        national_identity_map
    │  hash PII locally    │                        │                  │                     │
    │────submit hashes────►│ verify JWT (own tenant)│                  │                     │
    │                      │──ingest IDENTITY_FED_ATTR (SB-PLR, hashes)►│                  │
    │                      │                        │ persist (RLS)    │                     │
    │                      │                        │───notify─────────►│ match & cluster    │
    │                      │                        │                  │──upsert SB-NAT link►│ (regulator-only)
    │◄──202 accepted───────│                        │                  │                     │
    (operator learns nothing about linkage)
```

### 7.2 Regulator resolves a national identity (read-only, regulator JWT)
```
Regulator UI     regulator-portal (Consumer Platform)   NIFS/national twin    per-casino projections
   │  open SB-NAT-77       │                                  │                       │
   │─────GET national-player-summary────────────────────────►│ verify regulator JWT  │
   │                       │  authorise (REGULATOR_ROLES)     │                       │
   │                       │──resolve SB-NAT → [SB-PLR…]──────►│                       │
   │                       │                                  │──read (regulator)────►│ (aggregate per SB-PLR)
   │◄──anonymous national summary (operators, risk timeline, interventions, SE)──────│
   (no PII; evidence-classified; audited)
```

## 8. Trust boundaries
- **B1 Operator edge ↔ Platform:** PII never crosses. Only salted hashes + the operator's own `SB-PLR`. Enforced by contract + the operator having no read path to federation.
- **B2 Operator plane ↔ Regulator plane:** the `SB-PLR↔SB-NAT` mapping, `SB-NAT` ids, national twin and national views are **regulator-only** (RLS + verified regulator JWT). Operators get 403 (existing ADR-002 matrix, extended to the new tables/views).
- **B3 Platform ↔ Pepper/keyring:** the national pepper lives in HSM/Secrets Manager; NIFS uses it; it is never returned to any client. Rotation is versioned (hash records carry the pepper key version).
- **B4 Regulator jurisdiction:** a regulator sees national identities only within their jurisdiction (jurisdiction from the verified JWT, never a claim — ADR-002).

## 9. Extensions to certified platforms (all additive)
- **Identity Resolution / Provider (ADR-001):** unchanged; `SB-PLR` provider stays. NIFS is a *new sibling service*, not a change to the provider.
- **Event Platform:** one new event type `IDENTITY_FEDERATION_ATTRIBUTE` (additive to the frozen vocabulary under §9); envelope/validation unchanged; payload carries hashes only.
- **Projection Platform:** one new **regulator-plane** projection `projection_national_identity` (+ `national_identity_map`); operator projections untouched; rebuildable from the hashed-attribute events like any projection.
- **Digital Twin:** a new **National Player Twin** (regulator-plane) keyed by `SB-NAT`, assembling references to the per-casino twins/projections. Constitution §2 preserved (one runtime object per identity; the national twin references, never duplicates).
- **Domain Intelligence:** unchanged for operators; a national analysis view composes existing per-`SB-PLR` intelligence across a cluster (national risk progression, repeated-harm indicators) — composition, not recomputation.
- **Policy Platform:** new **national policy scope** (`NAT-*` rules): national self-exclusion, national cooling-off, cross-operator escalation, national intervention thresholds — declarative data (§4), explainable decisions.
- **Consumer / Regulator Platform:** new regulator-only views (`national-player-summary`, `cross-operator-timeline`, `national-self-exclusion`, `national-alerts`) — additive contracts, regulator grants only; **no operator view changes**; a `federation` edge function (regulator-authenticated) hosts them alongside `regulator-portal`.

## 10. Operational model
- **Enablement:** federation is off by default; a regulator/administrator enables it per jurisdiction (config flag + pepper provisioned). Until enabled, everything behaves exactly as today (aggregate/cohort cross-operator intelligence).
- **Contribution cadence:** operators submit hashed attributes at registration and on change (idempotent — same hashes are deduped by the Event Platform idempotency key, ADR-003).
- **Merge/split governance:** NIFS proposes links; a regulator may confirm/reject/override; every action is audited + appealable. Split (an erroneous link) re-mints `SB-NAT`s and records the reason.
- **Pepper rotation:** versioned; re-hash-on-rotate is a background re-contribution; hash records carry the key version so old and new coexist during rotation.
- **Monitoring:** federation match rate, unresolved-attribute rate, confidence distribution, override/appeal counts surfaced via the existing observability (`sbiq_platform_health` extension + telemetry), regulator-only.
- **Runbook:** enable/disable jurisdiction; provision/rotate pepper; review a proposed link; execute a merge/split; handle an appeal; rebuild the national projection. (Full steps in the Operational Runbook section of `V2_MIGRATION_AND_ROADMAP.md`.)

## 11. What this explicitly does NOT do
- It does not give operators any cross-operator visibility, query, or search (they remain fully isolated — 403).
- It does not store, transmit, or derive plaintext PII, nor a reversible id→PII mapping.
- It does not change `SB-PLR`, the operator event flow, operator projections, operator intelligence, operator policy decisions, or any operator UI.
- It does not use unexplainable ML scoring in v2.0 (deferred, future ADR).
- It does not enable operator-to-operator federation; correlation is a regulator authority only.

---

# Phase 2 refinements (Board-mandated)

## 12. The National Intelligence Plane (new architecture layer)
NIFS is not a standalone service; it is the entry point to a formal, **regulator-only** enterprise layer — the **National Intelligence Plane (NIP)** — that sits *alongside and downstream of* the certified operator flow.

```
┌──────────────────────── OPERATOR PLANE (certified, unchanged, per-tenant) ───────────────────────┐
│ Identity(SB-PLR) → Event Platform → Projection → Digital Twin → Domain Intelligence → Policy →     │
│ Consumer Platform → Operator UI          (system of record for all operational identity & runtime) │
└───────────────┬───────────────────────────────────────────────────────────────────────────────────┘
                │  (a) hashed-attribute events (write-only)      (b) read operator projections BY REFERENCE
                ▼                                                 ▲
┌──────────────────────── NATIONAL INTELLIGENCE PLANE (new, regulator-only) ─────────────────────────┐
│  National Identity Federation (NIFS)  ─ SB-NAT resolution, mapping, confidence, audit               │
│  National Player Twin                 ─ per-SB-NAT reference-aggregation over operator projections   │
│  Cross-Operator Intelligence          ─ composition of existing per-SB-PLR Domain Intelligence       │
│  National Behaviour Analytics         ─ national risk progression / repeated-harm (composition)      │
│  National Self-Exclusion Registry     ─ SB-NAT-scoped SE/cooling-off status across operators         │
│  National Investigation Services      ─ SB-NAT-linked cases/investigations (extends Workflow)        │
│         → national Policy scope (NAT-*) → Consumer/Regulator Portal national views → Regulator UI     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```
**Placement rules:** the NIP consumes the operator plane; it never mutates it. It is fed only by hashed-attribute events (a) and reads operator projections by reference (b). Every NIP artefact is **regulator-only** (RLS + verified regulator JWT; operators 403). The NIP is disposable/rebuildable from the event log like any projection; removing it leaves the operator plane fully functional. **`SB-PLR` remains the system of record**; the NIP holds correlation and aggregation, not authoritative operational state.

## 13. National Player Twin lifecycle
Governed state machine (regulator-plane), every transition audited in `federation_audit`:
| State | Meaning | Entry trigger |
|---|---|---|
| **Created** | New `SB-NAT` minted for a first-seen cluster | First linkable attribute set with no existing match |
| **Updated** | New `SB-PLR` or attributes joined the cluster | Additional matching contribution |
| **Re-evaluated** | Confidence/links recomputed | Rule/threshold change, pepper rotation, new evidence |
| **Split** | An erroneous link removed → new `SB-NAT`(s) minted | Regulator override / rejected match / appeal upheld |
| **Merged** | Two `SB-NAT`s found to be the same individual → one survives | Stronger evidence links previously separate clusters |
| **Retired** | No longer active (e.g. jurisdiction disabled, no live operators) | Inactivity / disablement |
| **Archived** | Retained for audit, removed from live national views | Retention policy / regulator direction |
Transitions: Created→Updated→Re-evaluated (loop); Re-evaluated→Split|Merged; any→Retired→Archived. Split/Merge **never** alter `SB-PLR` — only the `SB-PLR↔SB-NAT` mapping changes; each carries a recorded reason and is appealable.

## 14. Federation governance model
Nothing is implicit. All values are jurisdiction configuration (data, not code):
- **Automatic federation threshold** — links at/above the *Confirmed* tier (e.g. combined weight ≥ 1.0 or any strong attribute) are auto-created but **flagged for regulator visibility**; automatic *national action* (e.g. self-exclusion enforcement) additionally requires an enabling national policy.
- **Manual review threshold** — *Probable* links enter a **review queue**; a regulator confirms/rejects. *Possible* links are advisory only (surfaced, never auto-actioned).
- **Rejection criteria** — jurisdiction exclusions (e.g. shared-household device only → not a person match), regulator manual reject, or data-quality flags.
- **Regulator override workflow** — a regulator may confirm, reject, split or merge any link; the override reason is mandatory and audited.
- **Appeals** — a challenged link is logged (`appeal_history`), reviewed, and resolved with a recorded decision; the subject is never identified by PII in the process.
- **Audit retention** — `federation_audit` is append-only; retention set per jurisdiction (regulatory minimum), never below the legal audit requirement.
- **Review lifecycle** — proposed → (auto-confirmed | in-review) → confirmed | rejected → (appealed → re-decided)* → archived. Every state change is timestamped, attributed and reasoned.

## 15. Jurisdiction profiles (policy-driven matching)
Matching is a **per-jurisdiction profile** (declarative data, versioned like policy packs — Constitution §4). Example profiles:
| Jurisdiction | Enabled attributes | Strong | Medium | Soft | Confirmed threshold |
|---|---|---|---|---|---|
| **ZA** (South Africa) | national_id, phone, device_fingerprint | national_id | phone | device | national_id, OR phone+device |
| **NA** (Namibia) | passport, phone | passport | phone | — | passport, OR 2× phone corroboration |
| **BW** (Botswana) | national_id, device_fingerprint | national_id | — | device | national_id |
| **KE** (Kenya) | national_id, phone, email | national_id | phone, email | — | national_id, OR phone+email |
A profile defines: enabled attribute types, per-attribute weights, tier thresholds, auto/manual boundaries, and retention. Changing a profile is a governed config activation (versioned + audited), never a code deploy.

## 16. Multi-country / sovereign readiness
`SB-NAT` is namespaced per sovereign jurisdiction: **`SB-NAT-<CC>-<hex>`** (`SB-NAT-ZA-…`, `SB-NAT-NA-…`, `SB-NAT-BW-…`, `SB-NAT-KE-…`). Each country has an **isolated national pepper, mapping store, jurisdiction profile, policy pack and regulator scope** — no cross-border correlation by default (data-sovereignty by design). Adding a country = provision a pepper + profile + policy pack + enable flag; **no redesign, no schema change beyond additive rows**. A future cross-border correlation (if ever mandated by treaty) would be its own ADR.

## 17. Explainability (mandated detail)
Every `SB-NAT` identity and every link renders, in plain language and with **no PII**:
- **why** records were linked (which attribute *types* matched, across which operators);
- **evidence used** (matched types + weights) and **evidence ignored** (attributes present but excluded by the jurisdiction profile, e.g. device-only in a household context);
- **confidence** (tier + numeric);
- **matching policy version** (jurisdiction profile id + version);
- **timestamp**, **reviewer** (if manual), and **override/appeal history**.
No identity decision is ever produced without this record. This is Evidence Integrity (§8) applied to national identity.

## 18. National Policy scope (Policy Platform extension, configurable)
Additive `NAT-*` rule scope, evaluated over the National Player Twin; declarative data; explainable decisions (policy id + reference + confidence):
- **National Self-Exclusion** — an `SB-NAT` self-excluded at any operator is flagged nationally (regulator view; the platform *recommends*, the regulator/operators act — no auto-enforcement without an enabling policy + human decision).
- **National Cooling-Off** — cooling-off status surfaced across the cluster.
- **Cross-Operator Escalation** — risk escalating across ≥ N operators raises a national alert.
- **National Investigation Trigger** — thresholds that recommend opening a regulatory investigation (extends Workflow/Cases).
- **Regulator Notifications** — configurable national alert routing.
- **Cross-Operator Intervention Thresholds** — repeated interventions across operators raise national priority.
All thresholds are jurisdiction configuration; no rule is hardcoded.

---

# Phase 2.1 refinements (Final Freeze — Accepted)

## 19. Matching / decision separation (frozen architecture chain)
NIFS is decomposed into two components with a hard boundary — **matching never decides**:
```
Identity Resolution (SB-PLR)
   → National Identity Federation Service (NIFS)
      → Identity Matching Engine        ── deterministic: produces CANDIDATE matches only
      → Federation Decision Engine       ── governance: ACCEPTS / rejects / reviews every decision
   → SB-NAT Registry                     ── minted correlation ids + immutable version stamp
   → Enterprise Correlation Layer        ── read-only correlation/aggregation (regulator-only)
   → [reads by reference] Event Platform → Projection → Digital Twin → Domain Intelligence
        → Policy Platform → Consumer Platform → UI   (operator plane, unchanged, system of record)
```
- **Identity Matching Engine** — hash comparison, attribute correlation, candidate generation, confidence calculation, rule evaluation, evidence generation. **Output: candidate matches with evidence + a numeric confidence. It never accepts or rejects an identity.**
- **Federation Decision Engine** — the enterprise governance component through which **every** federation decision passes: applies federation policies, automatic-approval & manual-review thresholds, regulator approval workflow, appeals, override management, explainability, audit generation, decision history, and version tracking. It consumes candidates from the Matching Engine and emits *governed, versioned, audited* decisions. There are **no direct matching decisions** anywhere.

## 20. Federation versioning (immutable per SB-NAT)
Every `SB-NAT` and every decision permanently records five versions:
| Field | Meaning |
|---|---|
| Federation Algorithm Version | the NIFS/matching algorithm generation (e.g. `2.0`) |
| Matching Policy Version | the jurisdiction matching-policy pack version (e.g. `1.4`) |
| Jurisdiction Version | the jurisdiction profile snapshot (e.g. `ZA-2027`) |
| Decision Engine Version | the Federation Decision Engine version (e.g. `2.0`) |
| Rule Set Version | the applied rule set (e.g. `RG-01`) |
Example: `SB-NAT-ZA-000238` — Federation Algorithm v2.0 · Decision Engine v2.0 · Policy 1.4 · Jurisdiction ZA-2027 · Rule Set RG-01. These are **immutable** (append-only); a re-evaluation mints a new decision record with new versions, never overwriting the old — the identity's full version history is auditable.

## 21. Enterprise Correlation Identity & Enterprise Correlation Layer (canonical terms)
- **`SB-NAT` is an *Enterprise Correlation Identity*.** It is **not** a customer identity, operator identity, casino identity, system of record, or runtime identity. It exists solely for Cross-Operator Intelligence, National Responsible Gambling, Regulatory Oversight, National Behaviour Analytics and National Investigations.
- **The National Intelligence Plane is the *Enterprise Correlation Layer*** — a **read-only** layer whose responsibilities are correlation, aggregation, federation, national intelligence and regulator analytics. Operational platforms (Event/Projection/Twin/Intelligence/Policy/Consumer) continue to own all runtime behaviour; the Correlation Layer never modifies them.

## 22. Immutable federation-decision audit record (frozen schema-of-record)
Every Federation Decision Engine decision writes an append-only record capturing **all** of:
`evidence_used[]`, `evidence_ignored[]`, `matching_rules[]`, `decision_rule`, `confidence_score`, `decision_engine_version`, `federation_algorithm_version`, `matching_policy_version`, `jurisdiction_version`, `rule_set_version`, `reviewer` (system|regulator id), `timestamp`, `override_history[]`, `appeal_history[]`, plus the subject `SB-NAT` and the affected `SB-PLR`(s) — **never any PII**. Retention ≥ the jurisdiction's legal audit minimum. Property: **any identity decision is fully reproducible years later** from this record + the versioned policy/rule packs.
