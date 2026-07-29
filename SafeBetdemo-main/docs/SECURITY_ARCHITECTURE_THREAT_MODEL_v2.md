# SafeBet IQ — Security Architecture & Threat Model (v2.0 National Identity Federation)

**Status: PROPOSED — Phase 1. Extends the certified security model (ADR-002 verified identity + tenant RLS, Constitution §6).**

## 1. Security architecture (additive controls)
| Control | Existing (certified) | v2.0 addition |
|---|---|---|
| **Identity of caller** | Verified Supabase JWT + users registry (ADR-002) | Reused unchanged; `federation` edge requires a **verified regulator role** (REGULATOR_ROLES); operators may call **only** `federation-submit` for their **own** tenant. |
| **Tenant isolation** | RLS `app_visible_casinos()` + mirrored `principalMayAccessCasino` | New regulator-plane tables (`national_identity_map`, `projection_national_identity`, `federation_audit`) are **regulator-only RLS** (no operator select policy). `IDENTITY_FEDERATION_ATTRIBUTE` events are per-tenant RLS like all events. |
| **Encryption in transit** | TLS everywhere (HSTS, CSP — ORR-1A) | Unchanged. |
| **Encryption at rest** | Supabase-managed | Unchanged; hashes are already non-reversible. |
| **Hashing / secrets** | — | **HMAC-SHA256 with a per-jurisdiction national pepper** in AWS Secrets Manager / HSM; versioned rotation; never returned to a client. Optional double-hash: operator transport-hash → NIFS applies pepper server-side so operators never hold the pepper. |
| **Audit** | Immutable `casino_event_log`, `workflow_audit`, `policy_change_log` | New append-only `federation_audit` (every match/override/appeal/read of a national identity). |
| **Authorisation of federation reads** | Regulator role gate (regulator-portal) | Extended: national views require regulator role **and** jurisdiction match (from JWT); every read audited. |
| **Least privilege (IAM)** | EB/Secrets Manager roles | New IAM policy scoping NIFS to only the pepper secret + its own store; regulator-plane DB role separate from operator paths. |

## 2. Assets & actors
- **Assets:** the national pepper (highest value), the `SB-PLR↔SB-NAT` mapping, attribute hashes, national twin/views, federation audit.
- **Actors:** operator (write-only contributor), regulator (read-only national), administrator (enable/rotate/govern), external attacker, malicious insider.

## 3. Threat model (STRIDE, focused on the new surface)
| # | Threat | STRIDE | Vector | Mitigation | Residual |
|---|---|---|---|---|---|
| T-1 | Operator tries to read another operator's players / the mapping | Info-disclosure / Elevation | Call national views or query mapping | Regulator-only RLS + role gate; operators 403; no operator select policy on regulator-plane tables | Low |
| T-2 | Operator brute-forces others' attribute hashes offline | Info-disclosure | Guess PII → hash → compare | Keyed HMAC with pepper operators don't hold; operators can't read others' hashes anyway (RLS) | Low |
| T-3 | Attacker exfiltrates the mapping DB | Info-disclosure | DB breach | Mapping is pseudonymous (no PII); pepper separate; least-privilege DB role; encryption at rest | Low–Med (pseudonyms only) |
| T-4 | Pepper theft enables mass correlation | Info-disclosure | Secrets Manager/HSM compromise | HSM/Secrets Manager, tight IAM, rotation, alerting; theft alone yields no PII (still need values) | Low |
| T-5 | Forged/spoofed regulator identity | Spoofing / Elevation | Fake JWT / anon key | Verified JWT (ADR-002); anon/tampered → 401; role from registry not claims | Low (certified) |
| T-6 | Jurisdiction bypass (regulator reads another jurisdiction) | Elevation | Manipulate jurisdiction param | Jurisdiction from verified JWT only, never a parameter (ADR-002) | Low |
| T-7 | Malicious operator poisons matching (submits false hashes to link/unlink) | Tampering | Bogus attribute hashes | Per-operator provenance on every hash; confidence tiers; regulator override + audit; anomaly monitoring on contribution patterns | Medium → managed |
| T-8 | Wrongful automated action from a false link | Tampering / Repudiation | Possible-tier link acted on | Automated national action gated on *Confirmed* + policy; human decides; appeal/override; explainable evidence | Low |
| T-9 | Tampering with the federation audit | Tampering / Repudiation | Alter audit rows | Append-only (immutability trigger, like `casino_event_log`/`workflow_audit`) | Low |
| T-10 | Replay / duplicate contribution inflating links | Tampering | Resubmit hashes | Event Platform idempotency key (ADR-003) dedupes | Low |
| T-11 | DoS on federation-submit / match engine | DoS | Flood submissions | Rate limits at the edge; batch-bounded ingestion (existing producer caps pattern); match is async downstream | Medium |
| T-12 | Insider (regulator) surveillance abuse | Info-disclosure | Legitimate creds, illegitimate purpose | Every national read audited; purpose-bound views; governance review; per-jurisdiction scope; off-by-default | Medium → governance |

## 4. Privacy by Design (security view)
- Structural PII-absence (hash-before-boundary) means most catastrophic breach classes are impossible.
- Defence in depth: JWT + RLS + role gate + jurisdiction gate + append-only audit + pepper isolation.
- Blast-radius containment: a full regulator-plane breach exposes pseudonyms + hashes, not identities or operator data; disabling a jurisdiction + truncating the store is a clean containment.

## 4a. Phase 2 refinement — sovereign isolation
Each jurisdiction is a **separate trust domain**: isolated national pepper, mapping store, jurisdiction profile and regulator scope (`SB-NAT-<CC>`). A compromise or mis-scope in one country cannot correlate another's subjects (no shared pepper, no cross-border mapping, no cross-jurisdiction regulator read — T-6 reinforced). Pepper key-management (provision/rotate) is per-country in Secrets Manager/HSM with least-privilege IAM per jurisdiction. Federation governance actions (auto-confirm boundary, manual review, override, appeal — Design §14) are themselves authorised (regulator role) and audited, closing T-7/T-8/T-12 at the process layer.

## 4b. Phase 2.1 refinement (governance & non-repudiation)
Separating the **Identity Matching Engine** (candidates only) from the **Federation Decision Engine** (governed acceptance) means no identity is accepted outside the governed, audited path — closing T-7/T-8 at the architecture level. Every decision writes an **immutable, versioned** audit record (evidence used/ignored, matching + decision rules, confidence, Federation-Algorithm / Matching-Policy / Jurisdiction / Decision-Engine / Rule-Set versions, reviewer, timestamp, override & appeal history), so every decision is **non-repudiable and reproducible years later** — reinforcing T-9 (audit tamper) and T-12 (insider abuse: all national reads and decisions attributed and reviewable).

## 5. Security acceptance criteria (Phase 3 gates)
Operators → federation reads = 403; anon → 401; cross-jurisdiction regulator = 403; pepper never client-exposed; `federation_audit` proven append-only; every national read audited; matching rules loaded as data (no code deploy to change thresholds); penetration test of the federation-submit + regulator-read paths passes before enablement in any real jurisdiction.
