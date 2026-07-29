# Contribution Projection Specification (Milestone 4.3)

**ADR-006 (frozen) · PILOT NON-PRODUCTION ONLY.**

## 1. Purpose
The `ContributionProjector` deterministically transforms **accepted** Event Platform contributions into
the certified Matching Engine input model (`FederationContribution[]`). It is a **read model** —
rebuildable from the accepted log — and makes no decision, mints no SB-NAT, interprets no policy, and
modifies no operator runtime.

## 2. Inclusion / exclusion
Included: accepted, non-revoked, non-expired (at `asOf`) contributions. Excluded: rejected (never
accepted), revoked, expired, and duplicate projections (per `operator|sbPlr|attributeType|digest`).

## 3. Grouping & output
Grouped by `(operator, SB-PLR)` → one `FederationContribution { jurisdiction, casinoId=operatorId, sbPlr,
attributes: AttributeHash[], contributedAt }`. Deterministic ordering (operator → SB-PLR → attribute →
event id).

## 4. Version segregation
Each `AttributeHash` carries `pepperKeyVersion`. Because different pepper versions produce different
digests, the certified Matching Engine **never cross-matches incompatible versions** — segregation is
enforced by the hash itself (defense-in-depth beyond the version stamp). The certified engine is
unchanged.

## 5. Provenance
The projector returns `provenance: Map<sbPlr, eventId[]>`; `candidateProvenance(provenance, sbPlrA,
sbPlrB)` reconstructs the accepted event ids that formed a candidate's evidence. Every candidate is
traceable to its source accepted contribution events.

## 6. Matching handoff
Only projected contributions enter the certified Matching Engine (candidates only). A
`matching-handoff-completed` audit records the candidate count. No decision thresholds are added to the
contribution path.

## 7. Rebuildability
`matchingContributions()` is a pure function of the accepted log + `asOf`; re-running yields identical
output (deterministic; restart-safe).
