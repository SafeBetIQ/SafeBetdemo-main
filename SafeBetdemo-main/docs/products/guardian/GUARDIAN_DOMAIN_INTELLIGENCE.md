# SafeBet Guardian — Domain & Website Intelligence (ARCH-V4-C2)

Guardian's first external-subject intelligence domain. **Synthetic only.** Flow:
discover/receive domain → normalise → capture synthetic evidence → derive entity/brand
refs → **compare against the Legal Operator Registry via the C1 governed contract**
(`resolveLegalReference`, not raw tables) → structured **non-legal** intelligence result
→ human review where required.

## Safety invariants (encoded + tested, incl. a DB CHECK)
> DOMAIN DISCOVERED ≠ ILLEGAL DOMAIN · NO REGISTRY MATCH ≠ ILLEGAL OPERATOR ·
> HIGH-RISK SIGNAL ≠ LEGAL FINDING · DETECTION ≠ ENFORCEMENT AUTHORISATION

- No result returns `illegal=true`; every result carries `isIllegalDetermination:false`.
  The `guardian.domain_registry_comparison` table has a **CHECK forbidding
  `is_illegal_determination=true`** at the database level.
- Any possible-illegality state is phrased non-finally: `POTENTIALLY_UNAUTHORISED_
  REQUIRES_VERIFICATION` / `REQUIRES_HUMAN_REVIEW` / `INSUFFICIENT_DATA`.
- No AI. Deterministic signals + rules only. No enforcement, no blocking.

## No real network access
The engine and worker operate **only** on synthetic `.test` fixtures. There is no HTTP
client/fetch/DNS to arbitrary domains anywhere in C2 source (asserted by a boundary test);
an unknown hostname is rejected (poison), never fetched.

## Pipeline
1. **Normalise** (`normaliseHostname`) — scheme/path/port/`www` stripped, deterministic.
2. **Signals** — technical (hostname, HTTP status, TLS, content fingerprint, redirect) +
   content (gambling terminology, deposit language, registration CTA, age messaging,
   licence text). Signal presence is intelligence only.
3. **Registry comparison** — via `resolveLegalReference` (C1). Preserves C1 semantics
   (MATCHED_AUTHORITATIVE / MATCHED_BUT_STALE / MULTIPLE_MATCHES / NO_MATCH /
   SOURCE_CONFLICT / REQUIRES_REVIEW; NO_MATCH ≠ illegal).
4. **Result** — reason codes + explainable investigation priority + review flag +
   provenance (evidence + source refs). See `GUARDIAN_DOMAIN_REASON_CODES.md`,
   `GUARDIAN_DOMAIN_REVIEW_POLICY.md`.

## Durable async path (first real Guardian queue)
SQS `guardian-domain-observation` → worker Lambda `safebet-guardian-domain-worker` → DLQ
`guardian-domain-observation-dlq` (redrive maxReceiveCount 2, `ReportBatchItemFailures`).
Worker: idempotent, synthetic-fixture only, **no DB credentials, no network crawl** —
emits the non-legal result to CloudWatch. Proven live: good message processed, poison →
DLQ. Store of record = the `guardian` schema (seeded + proven via SQL/RLS).

## API (Guardian Lambda, AWS_IAM — no anonymous access)
`GET /domains?jurisdiction=` · `GET /domains/:hostname` · `POST /domains/observe`
(`{jurisdiction, fixtureHostname}`). Every response is jurisdiction-scoped and carries
explicit legal-safety metadata (`isIllegalDetermination:false`). An unknown/real hostname
returns 404 (never fetched).

## Out of scope at C2
No mobile-app/payment/geo intelligence; no enforcement/provider state machine; no AI legal
decision; no real domains/regulator/provider integration; no production.
