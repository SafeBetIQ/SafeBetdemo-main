# SafeBet Guardian — Mobile App Intelligence (ARCH-V4-C3)

Provider-neutral. **Synthetic only.** Flow: app subject → normalise identity → capture
synthetic metadata/evidence → deterministic signals → resolve operator/brand/licence via
the **C1 governed contract** (`resolveLegalReference`) → governed **app→domain link** (via
the C2 domain contract) → structured **non-legal** result → human review where required.

## Safety invariants (encoded + tested; DB CHECK forbids `is_illegal_determination=true`)
> APP DISCOVERED ≠ ILLEGAL · APP NOT IN REGISTRY ≠ ILLEGAL OPERATOR · APP PLATFORM PRESENCE
> ≠ LEGAL AUTHORISATION · PLATFORM ABSENCE ≠ ILLEGALITY · HIGH REVIEW PRIORITY ≠ LEGAL
> FINDING · DETECTION ≠ ENFORCEMENT.
Every result `isIllegalDetermination:false`; non-final classifications only. No AI. No app
removal / platform referral / enforcement.

## Provider neutrality (hard rule)
Terminology is generic: `MOBILE_PLATFORM` / `APP_PLATFORM` / `APP_DISTRIBUTION_PLATFORM` /
`platformType ∈ {MOBILE_APP, MOBILE_WEB_WRAPPER, PROGRESSIVE_WEB_APP_REFERENCE,
UNKNOWN_MOBILE_DISTRIBUTION}`. **No named app store/platform.** No provider partnership or
integration claim. Any future adapter = PROPOSED — NO LIVE EXTERNAL INTEGRATION.

## No real platform access
The engine and worker operate ONLY on synthetic app fixtures; no marketplace query, no
APK/IPA download, no device/binary/malware analysis, no platform API. An unknown/real
identifier is rejected (poison), never accessed (boundary-tested).

## Pipeline
normalise app identifier → content signals (gambling/deposit/registration/age + declared
operator/brand/licence/website) + technical signals (identifier/platform/version/publisher/
fingerprints) → registry comparison (C1) → governed app→domain link (resolves a declared
website to a KNOWN C2 domain by the domain contract; unknown → recorded reference, no
illegality) → reason codes + explainable investigation priority.

## Durable async path (dedicated; not shared with the domain queue)
SQS `guardian-app-observation` → worker Lambda `safebet-guardian-app-worker` → DLQ
`guardian-app-observation-dlq` (redrive maxReceiveCount 2, `ReportBatchItemFailures`).
Idempotent, synthetic-fixture only, persists via the dedicated least-privilege role
`guardian_app_worker`. Proven live: persist (governed app→domain link to real C2 domain),
duplicate-suppression, wrong-jurisdiction → DLQ, poison → DLQ (no partial state).

## API (Guardian Lambda, AWS_IAM — no anonymous access)
`GET /apps?jurisdiction=` · `GET /apps/:identifier` · `POST /apps/observe`. Jurisdiction-scoped;
legal-safety metadata (`isIllegalDetermination:false`); unknown/real identifier → 404.

## Out of scope at C3
No `APP_PLATFORM_REFERRAL`; no payment/geo intelligence; no enforcement/provider state
machine; no AI legal decision; no real app data/platform integration; no production.
