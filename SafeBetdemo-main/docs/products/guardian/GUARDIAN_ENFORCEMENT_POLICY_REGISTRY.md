# SafeBet Guardian — National Enforcement Policy Registry (ARCH-V4-C8)

**Status:** Planned / in development (synthetic Demo only). No real policy, legal authority,
regulator, provider, or enforcement.

C8 establishes the HUMAN/legal authority layer that must exist BEFORE any future enforcement
orchestration (C9). It creates a human-approved AUTHORISED ACTION RECORD and **stops** — it
never executes or transmits the action externally.

## Flow
```
CASE -> EVIDENCE -> POLICY APPLICABILITY -> LEGAL/REGULATORY REVIEW -> PROPOSED ACTION ->
HUMAN AUTHORISATION -> AUTHORISED ACTION RECORD -> STOP
```

## Core safety boundary (encoded + tested)
INTELLIGENCE / CASE / EVIDENCE / POLICY MATCH != LEGAL DETERMINATION · LEGAL REVIEW !=
ENFORCEMENT EXECUTION · AUTHORISATION != EXTERNAL PROVIDER ACTION. `action_authorisation`
CHECKs force `is_external_action_executed=false` AND `is_provider_notified=false`. There is
NO EXECUTED/ACTIONED/PROVIDER_ACKNOWLEDGED state anywhere. Final AUTHORISED requires a
synthetic HUMAN Authorising Officer (enforced in code AND at the DB privilege level — the
`guardian_policy_worker` cannot INSERT `action_authorisation`; proven live). No machine
authorisation. No AI legal decision.

## What the registry answers
What policy applies · who issued it · which jurisdiction · what subject/action type · when
effective · what conditions · what evidence/review is required · is it current / superseded /
expired / unknown.

## Policy status (bounded)
DRAFT, UNDER_REVIEW, APPROVED_FOR_SYNTHETIC_USE, ACTIVE, SUSPENDED, SUPERSEDED, EXPIRED,
WITHDRAWN. A policy is not legally authoritative merely because it exists in Guardian;
synthetic policies are marked `is_synthetic`.

## Authority references (synthetic; SafeBet holds no statutory authority)
REGULATORY_POLICY, STATUTORY_REFERENCE, COURT_ORDER_REFERENCE, LICENSING_CONDITION,
INTERNAL_REGULATOR_DELEGATION, EMERGENCY_AUTHORITY_REFERENCE, OTHER. No invented statute
numbers.

## Policy activation
A synthetic policy does not become ACTIVE merely by insertion — it requires a bounded
review/activation (`policy_review_record`, reviewer + approval + effective date + authority
reference). No self-activation by an ordinary service worker. Policy administration is a
bounded `POLICY_ADMINISTRATOR`-style capability (regulatory-policy administration, **not**
enforcement authority) with clear SoD implications.
