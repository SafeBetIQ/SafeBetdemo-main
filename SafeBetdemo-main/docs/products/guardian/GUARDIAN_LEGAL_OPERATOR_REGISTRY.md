# SafeBet Guardian — Legal Operator Registry (ARCH-V4-C1)

Guardian's trusted legal/reference layer. **Synthetic only.** It answers WHO an entity
is, WHICH brand/regulator/licence applies, WHAT standing is recorded, WHAT source
supports it, and WHEN it was valid — so future intelligence modules can compare
against an authoritative reference. It does **not** decide whether any site/app/payment
is illegal.

## Critical legal-inference rule (encoded + tested)
> **ABSENCE FROM LEGAL OPERATOR REGISTRY  ≠  ILLEGAL OPERATOR**

- No result enum contains `ILLEGAL`. `resolveLegalReference` always carries
  `isIllegalDetermination: false`.
- `NO_MATCH` means *no authoritative registry match found* — never illegal.
- `SUSPENDED`/`REVOKED` are only ever set from an authoritative regulator record.
- Ambiguity (multiple candidates / source conflict) → **human review**, never a silent pick.
- No AI creates licence/legal standing. C1 uses **deterministic** matching only.

Result standings: `LICENSED · NOT_CURRENTLY_VERIFIED · UNKNOWN · EXPIRED · LAPSED ·
SUSPENDED · REVOKED · CONFLICTING_SOURCE_DATA · REQUIRES_HUMAN_REVIEW · NO_MATCH`.

## Store of record vs runtime
- **Authoritative store of record:** the dedicated `guardian` schema (14 C1 tables, RLS,
  effective-dating, append-only history, provenance, staging→authoritative separation).
  Proven via SQL/RLS negative tests.
- **Runtime:** the Guardian Lambda serves a build-time **synthetic snapshot**
  (`products/guardian/src/registry/snapshot.ts`) so it holds **no DB credentials** — the
  strongest least-privilege posture for a synthetic Demo. The live DB-read path (a
  dedicated read-only Guardian DB credential in Secrets Manager) is **designed for C2**
  (see `GUARDIAN_DATA_OWNERSHIP.md`).

## Resolution contract (future-safe)
`resolveLegalReference(snapshot, subject)` returns a structured
`{ resolutionState, matchState, legalStanding, resolvedOperatorId, candidateOperatorIds,
licenceId, freshness, requiresHumanReview, provenance, isIllegalDetermination:false }`.
Future modules call this contract, **not** raw tables.

Resolution states: `MATCHED_AUTHORITATIVE · MATCHED_BUT_STALE · MULTIPLE_MATCHES ·
NO_MATCH · SOURCE_CONFLICT · REQUIRES_REVIEW`.

## Registry API (Lambda, AWS_IAM — no anonymous access)
`GET /registry/operators?jurisdiction=` · `GET /registry/operators/:id` ·
`GET /registry/licences/:id` · `GET /registry/sources/:id` · `POST /registry/match`.
Responses carry fact + source + verification + match + human-review state; **no endpoint
returns `illegal=true`**. Every response is jurisdiction-scoped.

## Synthetic scenarios (tests + live)
1 licensed → EXACT_MATCH/LICENSED · 2 brand → parent operator + licence · 3 expired →
EXPIRED + history (stale) · 4 unknown → NO_MATCH (not illegal) · 5 conflicting sources →
REQUIRES_HUMAN_REVIEW · 6 wrong jurisdiction → denied/no-match · 7 same principal
stage+authorise → denied (SoD).

## Out of scope at C1
No domain/app/payment/geo intelligence, no enforcement, no AI legal decision, no real
regulator/registry integration, no real data. See the security baseline.
