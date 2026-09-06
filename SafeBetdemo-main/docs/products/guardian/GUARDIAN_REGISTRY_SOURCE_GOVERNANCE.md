# SafeBet Guardian — Registry Source Governance (ARCH-V4-C1)

## Source authority levels (not all sources are equal)
`REGULATOR_AUTHORITATIVE > REGULATOR_SUPPLIED > VERIFIED_OFFICIAL_PUBLIC_RECORD >
OPERATOR_SUPPLIED > THIRD_PARTY_REFERENCE > SYNTHETIC_TEST` (precedence in
`products/guardian/src/registry/sources.ts`, `AUTHORITY_PRECEDENCE`). **C1 seeds
`SYNTHETIC_TEST` only.**

## Real-integration posture
No NGB / provincial-licensing-authority / regulator connection exists. Any adapter or
interface is labelled **PROPOSED — NO LIVE REGULATOR INTEGRATION** (`registry_source.integration_state
= PROPOSED_NO_LIVE_INTEGRATION`). Guardian claims **no** NGB/PLA connectivity. The future
authoritative-source model (NGB, provincial authorities, other lawful registers) is a
target only.

## Ingestion contract (provider-neutral)
`RegistrySourceAdapter` concept: validated source record → staging → deterministic
validation → human/approved publication into the authoritative registry. C1 implements a
**SyntheticRegistryAdapter** (seed) only. Staging (`registry_staging`, `ingestion_batch`)
is separate from the authoritative entities — ingestion is **not** regulatory acceptance.

Publication lifecycle: `INGESTED → VALIDATED → APPROVED/PUBLISHED → SUPERSEDED → REJECTED`.

## Conflict handling (no silent last-write-wins)
`detectConflict()` flags records that assert different states for the same subject.
Resolution by authority precedence is allowed **only** when a single record has strictly
higher authority than all others; otherwise → **REQUIRES_HUMAN_REVIEW**. At C1 all sources
are equal authority (SYNTHETIC_TEST), so seeded conflicts always route to human review
(scenario 5). Precedence is recorded as policy/configuration, not hidden in call sites.

## Provenance & integrity
Every legal/reference fact is traceable: `registry_source_record` carries `source_id`,
`authority_level`, `subject_reference`, `evidence_reference` (a Shared-Evidence pointer,
**never** the body), `content_hash`, `retrieved_at`, `effective_at`, `verification_status`,
`superseded_by`. This answers *"why does Guardian believe this status is true?"*.

## Freshness (stale ≠ verified)
`freshness(lastVerifiedAt, now, policy)` → `FRESH | AGING | STALE | UNKNOWN`. Default DEMO
thresholds (30/180 days) are **configurable/policy-driven**, not regulatory thresholds.
Stale-but-matched resolves to `MATCHED_BUT_STALE` — never presented as currently verified.

## Publication separation of duties
`authorisePublication()` requires a synthetic Registry Analyst (`INVESTIGATOR`) and a
distinct `AUTHORISING_OFFICER`; the same principal cannot both stage and authorise
(scenario 7). MFA hard gate still blocks all real privileged human use.
