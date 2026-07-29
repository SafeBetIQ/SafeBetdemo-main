# Version 2.0 — Phase 4 Privacy & Legal Readiness Plan

**Phase 4.0 · PLANNING ONLY · 2026-07-16 · ADR-006 (frozen).** Covers **C7** (regulator legal +
privacy approval). **No legal approval is claimed** — this plan maps prerequisites only.

## 1. Legal & privacy prerequisites (C7)
| Prerequisite | Description | Evidence required | Owner |
|---|---|---|---|
| Jurisdiction-specific DPA | Data-processing agreement per participating jurisdiction | Signed DPA | Legal/DPO + operator + regulator |
| Lawful processing basis | Documented basis for regulator-plane correlation of hashed identifiers | Legal opinion / regulatory authority | Legal + regulator |
| Regulator authority | Regulator's statutory authority to receive national correlation | Authorisation instrument | Regulator |
| Operator obligations | Operator responsibilities for hashing, minimisation, write-only contribution | DPA schedule | Legal + operator |
| Data minimisation | Only approved hashed attributes; no unnecessary demographics | PIA update + config evidence | DPO |
| Purpose limitation | Correlation used only for national RG / regulatory purposes | DPA + policy | DPO + regulator |
| Retention | Retention schedule for hashes, registry, audit, outcomes | Retention policy | DPO |
| Data-subject rights | DSAR procedure over anonymous references (+ correction/appeal) | DSAR runbook | DPO |
| Correction & appeal | Governed appeal/override already implemented; legal process wrapper | Procedure doc | DPO + regulator |
| Cross-border restrictions | Sovereign data separation; region hosting constraints | Hosting + region evidence | Security + Legal |
| Sovereign data separation | Per-jurisdiction isolation (already architected) | Isolation tests + config | Security |
| Incident notification | Breach notification obligations + timelines | Incident policy | Security + Legal |
| Processor/subprocessor | AWS + any subprocessors documented | Subprocessor list | Legal |
| AWS region & hosting | Region choice per sovereignty | Architecture evidence | Ops + Legal |
| Pilot consent / authorisation | Regulatory authorisation for the pilot | Authorisation letter | Regulator |
| PIA update | Update PIA v2 for pilot scope | Updated PIA | DPO |
| Security review | Security sign-off for pilot | Review record | Security |
| Legal approval evidence | Final signed approval | Approval record | Legal |

## 2. Privacy-by-design status (already implemented, Phase 3)
- No plaintext PII enters federation services; synthetic/real attributes hashed before boundary and
  discarded; SB-NAT is never a customer-facing identity; data minimisation via jurisdiction profiles;
  national outputs/provenance/appeal/override records are anonymous references; sovereign separation
  enforced; serialised outputs scan clean. **These are certified for the domain/demo scope** and
  carry into pilot subject to the durable-store controls (C2/C3) and C7 legal instruments.

## 3. What Phase 4 must add (non-code, legal/process)
Signed DPA(s); documented lawful basis; regulator authorisation; retention schedule; DSAR
procedure; cross-border/hosting evidence; incident-notification policy; updated PIA; security review
record. **Until C7 is satisfied, pilots use synthetic or approved sandbox data only** (also gates
the supervised regulator demonstration per certification §25).

## 4. Closure test (C7)
Presence of: **signed DPA, lawful basis, retention schedule, DSAR procedure, cross-border
restrictions, regulator authorisation model** (verbatim from the certification closure criteria).
No item may be marked satisfied without documented evidence.

## 5. Constraint
Do **not** claim legal approval unless documented evidence exists. Phase 4.0 produces the map only.
