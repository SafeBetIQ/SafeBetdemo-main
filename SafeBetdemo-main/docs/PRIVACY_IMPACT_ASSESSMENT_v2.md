# SafeBet IQ — Privacy Impact Assessment (v2.0 National Identity Federation)

**Status: PROPOSED — Phase 1. Assessed against ADR-006 and the Evidence Integrity Principle (Constitution §8).**

## 1. Purpose & scope
Assess the privacy risk of introducing regulator-plane national identity correlation (`SB-NAT`) across licensed operators. Data subjects: gamblers whose behaviour is analysed for Responsible Gambling. Jurisdiction focus: South Africa (POPIA); designed to generalise to other regulators' data-protection regimes.

## 2. Data inventory (what is and is NOT processed)
| Data | Processed by NIFS? | Form | Notes |
|---|---|---|---|
| Name, DOB, address, ID/passport number, phone, email, payment details | **No** | — | PII **never leaves the operator**; never transmitted to or stored by the platform. |
| Salted keyed hashes of the above (HMAC-SHA256 + national pepper) | Yes | Non-reversible pseudonyms | The only matching input. Cannot be reversed to PII without the pepper *and* the original value. |
| `SB-PLR` (per-casino anonymous id) | Yes (existing) | Pseudonym | Unchanged; per-casino. |
| `SB-NAT` (national anonymous id) | Yes (new) | Pseudonym | Minted, not derived from PII; regulator-only. |
| Behavioural/risk/intervention facts (per `SB-PLR`) | Yes (existing, by reference) | Pseudonymous | Composed for the national twin; no new PII. |
**Net new personal data stored: none.** New *pseudonymous* data: attribute hashes + the `SB-PLR↔SB-NAT` mapping.

## 3. Lawful basis & proportionality
- **Purpose:** statutory Responsible Gambling harm-prevention and regulatory oversight — a legitimate, mandated purpose for a gambling regulator.
- **Data minimisation:** only hashes of a configurable, jurisdiction-approved minimal attribute set are processed; no PII; correlation restricted to the regulator plane.
- **Proportionality:** the least-intrusive design that achieves national correlation — pseudonymous hashing + regulator-only access + explainability + audit — rather than a central PII vault.

## 4. Privacy risks & mitigations
| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| P-1 | Re-identification from hashes | Low | High | Salted **keyed** HMAC with a per-jurisdiction pepper in HSM/Secrets Manager (not held by operators); normalisation prevents trivial variants; no PII stored to correlate against. |
| P-2 | Operator learns another operator's players | Very Low | High | Trust boundary B2: mapping/`SB-NAT`/national views are regulator-only (RLS + regulator JWT); operators are write-only contributors; existing 403 matrix extended. |
| P-3 | Regulator over-reach (mass surveillance) | Low | Medium | Access is per-jurisdiction, verified-JWT, audited every read; federation off by default; purpose-bound views (RG/harm), not free-text data mining. |
| P-4 | Incorrect linkage harms a subject (false "self-excluded elsewhere") | Medium | High | Confidence tiers (Confirmed/Probable/Possible), manual regulator override, **appeal history**, and explainable evidence; automated action gated on *Confirmed* + policy, human decides (the platform recommends). |
| P-5 | Pepper compromise enables offline correlation | Low | High | HSM/Secrets Manager storage, least-privilege IAM, versioned rotation, no client exposure; compromise ≠ PII exposure (still need the original values). |
| P-6 | Function creep (use beyond RG) | Medium | Medium | Constitution-bound purpose; views are RG/oversight-scoped; audit + governance review; policy-as-data keeps scope explicit. |
| P-7 | Data-subject rights (access/erasure) | Medium | Medium | Pseudonymous by design; erasure = remove the `SB-PLR↔SB-NAT` link + attribute hashes (regulator-plane) without touching immutable operator events; documented procedure. |

## 5. Privacy-by-design properties
- **No PII, ever** — hashing occurs before the platform boundary; the platform is structurally incapable of holding plaintext PII for federation.
- **Anonymity preserved** — `SB-NAT` carries no PII and is not derivable from PII.
- **Isolation strengthened** — operators gain no new visibility; a new regulator-only plane is added behind the existing verified-identity/RLS controls.
- **Explainable & auditable** — every link is Derived Intelligence with confidence, evidence (types only), provenance, and an appeal trail (§8).
- **Reversible enablement** — off by default; a jurisdiction can disable federation and truncate the regulator-plane store without affecting any operator data.

## 5a. Phase 2 refinements (jurisdiction sovereignty)
Privacy is scoped **per sovereign jurisdiction**: each country has an **isolated national pepper, mapping store, jurisdiction profile (approved attribute set + retention) and regulator scope** (`SB-NAT-<CC>`). There is **no cross-border correlation by default** — data-sovereignty by design. The approved attribute set, weights, thresholds and retention are **jurisdiction configuration** (data, not code), so a data-protection authority approves exactly what may be matched in its territory. Erasure and disable/rollback operate per jurisdiction without touching operator data. This strengthens P-3 (over-reach) and P-6 (function creep): scope is explicit, per-country, and revocable.

## 5b. Phase 2.1 refinement (accountability & purpose limitation)
`SB-NAT` is a purpose-bound **Enterprise Correlation Identity** (not a "regulator identity" or a general-purpose id) — it exists solely for Cross-Operator Intelligence, National RG, Regulatory Oversight, National Behaviour Analytics and National Investigations, reinforcing purpose limitation (P-6). Matching (candidate generation) is separated from **decision** (the governed Federation Decision Engine), and every decision carries an **immutable versioned audit** (evidence used/ignored, matching + decision rules, confidence, algorithm/policy/jurisdiction/engine/rule-set versions, reviewer, timestamp, override & appeal history). This makes every identity decision **fully reproducible and accountable years later** — strengthening data-subject rights (P-7), wrongful-linkage handling (P-4), and DPA auditability.

## 6. DPIA outcome (proposed)
**Acceptable with the stated mitigations**, subject to: (a) a signed data-processing/regulatory agreement per jurisdiction defining the approved attribute set and retention; (b) pepper key-management + rotation operationalised; (c) the appeal/override governance process live before any *Confirmed*-triggered national action. These are tracked in `V2_MIGRATION_AND_ROADMAP.md` and the go-live checklist.
