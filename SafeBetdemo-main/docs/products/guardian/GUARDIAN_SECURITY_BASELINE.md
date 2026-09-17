# SafeBet Guardian — Security Baseline (ARCH-V4-C0)

Guardian must not recreate the privileged-function/over-exposure problem the A5 track closed.

## Database security
- **No new SECURITY DEFINER functions.** The `guardian` schema has **0 functions** (foundation
  is tables + RLS only). Any future Guardian function defaults `SECURITY INVOKER`; elevation
  requires explicit proof and registration under the A5 baseline
  (`docs/security/PRIVILEGED_FUNCTION_BASELINE.md`).
- **No PUBLIC/anon grants.** Schema `USAGE` + table `SELECT`/`INSERT` granted to `authenticated`
  + `service_role` only. `anon` has no `guardian` schema access (verified `has_schema_privilege`
  = false).
- **CI guard:** `npm run ci:privfn` scans the C0 migration and passes (no PUBLIC/anon grant, no
  unpinned SECURITY DEFINER).

## RLS / data access
- RLS enabled on all 7 `guardian` tables.
- Business rows scoped by `product=GUARDIAN` (table constraint) + `jurisdiction` claim
  (`request.jwt.claims ->> 'guardian_jurisdiction'`). Missing/other-product claim → deny.
- Negative tests proven at the DB: cross-jurisdiction denied (both directions), IQ principal
  sees 0 rows, `anon` denied; `service_role` (worker/admin) sees all (bypassrls, expected).

## Identity / MFA
- SafeBet IQ roles cannot access Guardian (distinct role vocabulary + explicit guard).
- **MFA hard gate active:** `MFA_REQUIRED_FOR_REAL_PRIVILEGED_USE = true`; no real privileged
  Guardian user at C0 (synthetic/service only). No real Guardian/Regulator-Suite privileged
  user or production privileged regulatory access until MFA enforcement is proven.

## Secrets / config
No hard-coded secrets (secret-scan clean). No regulator/provider/bank credentials created or
referenced. Guardian config is distinct from IQ product config; secrets remain external managed
secrets. Envelopes carry references, never inline sensitive evidence.

## External integrations & enforcement safety
No real external integration (NGB, provincial regulators, banks, PSPs, ISPs, DNS/registrars,
hosting, mobile/app platforms). Any adapter is labelled **PROPOSED — NO LIVE EXTERNAL
INTEGRATION**. Provider-neutral language (no specific app-store/platform named). Guardian never
self-executes enforcement; automated signal ≠ legal finding; no automatic blocking.

## C1 Legal Operator Registry security
- **14 registry tables**, all RLS-enabled; scoped by jurisdiction claim + `access_scope`.
  National/shared reference is cross-jurisdiction for **Guardian principals only**;
  non-Guardian (IQ) roles and `anon` are **denied all** registry data (proven).
- **0 new functions** in the `guardian` schema (still 0 SECURITY DEFINER, 0 PUBLIC, 0 anon).
  Grants: SELECT/INSERT to `authenticated` + `service_role` only.
- **Legal-inference safety:** no `ILLEGAL` value exists anywhere; `resolveLegalReference`
  carries `isIllegalDetermination:false`; NO_MATCH ≠ illegal; ambiguity/conflict → human
  review. No AI legal determination. No enforcement.
- **Provenance/integrity:** source records carry `content_hash` + an evidence **reference**
  (never the body); history is append-only; supersession preserved.
- **Runtime credential posture:** the Lambda holds **no DB credentials** (serves a synthetic
  snapshot); the live DB-read credential path is designed for C2 (Secrets Manager, dedicated
  read-only role scoped to the `guardian` schema — never an IQ credential, never in source/logs).
- **No** domain/app/payment/geo intelligence, **no** enforcement, **no** real regulator
  integration, **no** real data.

## C2 Domain Intelligence security
- **10 domain tables**, all RLS-enabled (jurisdiction-local; Guardian principals only; IQ/anon
  denied). **0 new functions** (guardian schema still 0 SECURITY DEFINER / 0 PUBLIC / 0 anon).
- **Illegality invariant at the DB:** `domain_registry_comparison` has a CHECK forbidding
  `is_illegal_determination=true`; no result path returns illegal (also enforced in code + tests).
- **No real network access:** no HTTP/fetch/DNS client to arbitrary domains anywhere in C2
  source (boundary test); worker rejects any non-fixture hostname (poison → DLQ), never fetches.
- **Durable async infra:** SQS + DLQ + dedicated worker Lambda with its own least-privilege role
  (`safebet-guardian-domain-worker-role`: CloudWatch Logs + SQS-consume only; no DB, no secrets,
  no admin). Idempotency + poison→DLQ proven live.
- **Runtime credential posture:** API + worker Lambdas are credential-free; the least-privilege
  DB-write credential path (dedicated `guardian`-scoped role + Secrets Manager) is designed/deferred.
- **No** payment/app/geo intelligence, **no** enforcement, **no** AI legal decision, **no** real data.

## C2.1 worker persistence security (least privilege)
- **Dedicated DB principal** `guardian_domain_worker`: grants ONLY on the 10 C2 domain tables +
  `audit_context`; **0 grants on public/IQ** (verified `has_table_privilege(... players ...) = false`);
  no BYPASSRLS, not superuser → **RLS enforced**, scoped by a per-message jurisdiction GUC.
- **IQ data unreachable** at the privilege level AND at the repository boundary; proven live
  (players SELECT denied; wrong-jurisdiction write blocked by RLS).
- **Secret** in AWS Secrets Manager only; worker IAM `GetSecretValue` on **one ARN**; no wildcard;
  password never committed/logged/returned (a leaked interim password was **rotated**). Worker IAM
  otherwise: CloudWatch Logs + SQS-consume only.
- **Bounded repository** (no generic `execute(sql)`); idempotent single-transaction persist (no partial
  state on failure); message ACKed only after durable commit; failure→retry→DLQ.
- **No new** SECURITY DEFINER / PUBLIC / anon; guardian schema still **0 functions**. No illegality
  determination persisted (DB CHECK + code). No real network/crawl.

## C3 Mobile App Intelligence security
- **10 app tables**, all RLS-enabled (jurisdiction-local; Guardian principals only; IQ/anon
  denied). **0 new functions.** Comparison-table CHECK forbids `is_illegal_determination=true`.
- **Separate dedicated principal** `guardian_app_worker` (NOT the domain worker): grants only
  on mobile_app_* + audit_context + read-only domain_subject; **0 public/IQ grants** (verified
  players SELECT denied); no BYPASSRLS → RLS enforced via jurisdiction GUC.
- **Provider-neutral:** no named platform; no real app/marketplace/binary/device access
  (boundary-tested); unknown identifier → poison, never accessed.
- **Own secret** (`safebet-guardian/app-worker-db`); app worker IAM `GetSecretValue` on one
  ARN; CloudWatch Logs + SQS-consume only. Bounded repository (no generic SQL); idempotent
  single-transaction persist. Governed app→domain link resolves the real C2 `domain_id` or NULL.
- No `APP_PLATFORM_REFERRAL`, no payment/geo intelligence, no enforcement, no AI legal decision.

## C3.1 App→Domain contract boundary (raw coupling removed)
- The app worker previously had **direct SELECT on `guardian.domain_subject`** (raw C2
  coupling). C3.1 replaces it with the **Domain-owned bounded contract** `guardian.domain_reference`
  (a plain view; **not** a SECURITY DEFINER function; no PUBLIC/anon grant) exposing only bounded
  reference fields, jurisdiction-scoped by the `app.guardian.jurisdiction` GUC.
- **Privilege change:** `revoke select on guardian.domain_subject from guardian_app_worker`
  (+ dropped its base-table policy) → app worker has **0 grants on C2 base tables**; it holds
  SELECT on the contract view only. Verified live: base-table access **DENIED**; contract view
  resolves the real reference id (`DOM-SYNTH-0003`); wrong-jurisdiction → not found.
- No new SECURITY DEFINER / PUBLIC / anon; guardian schema still **0 functions**. Legal semantics
  unchanged (NO_MATCH ≠ illegal; `isIllegalDetermination:false`). App Intelligence now survives a
  future separate-Guardian-database move without rewrite.

## C3.2 branded edge security
- **Auth NOT weakened:** privileged Guardian APIs (`/apps`,`/domains`,`/registry`,`/foundation`)
  require AWS_IAM (SigV4) through the branded domain → **403** unauthenticated (proven). Only
  `/health`+`/version` are public (liveness/version; no secrets), matching SafeBet IQ's public health.
- **TLS-only** (ACM cert; TLS 1.2 regional custom domain). No self-signed, no HTTP-only.
- **DNS:** a single additive Route 53 alias in the authoritative safebetiq.com zone; **no existing
  record altered**; SafeBet IQ (`demo`/`app.safebetiq.com`) untouched. Production (`guardian.safebetiq.com`)
  not created.
- **No DB/RLS change**, **no new SECURITY DEFINER/PUBLIC/anon** (C3.2 is edge-only); guardian schema
  still 0 functions. CORS: none permissive. Raw Function URL retained as internal endpoint.
- **View security re-verified (C3):** `guardian.domain_reference` owner postgres, has its own
  jurisdiction predicate (not owner-RLS-bypass reliant), granted only to `guardian_app_worker`
  (anon/authenticated denied); base-table `domain_subject` access removed.

## C4 Payment Intelligence security
- **9 payment tables** RLS-enabled (jurisdiction-local; Guardian principals only; IQ/anon denied);
  **0 new functions**; comparison-table CHECKs forbid `is_illegal_determination`=true AND
  `is_enforcement_authorised`=true. **Privacy:** no PAN/CVV/account/raw customer data (aggregates only).
- **Separate dedicated principal** `guardian_payment_worker`: grants only on payment tables + audit +
  SELECT on the `domain_reference`/`app_reference` contract views; **0 public/IQ grants, 0 C2/C3 base
  tables** (verified). No BYPASSRLS → RLS via jurisdiction GUC.
- Provider-neutral; no real bank/PSP/marketplace access; unknown reference → poison, never accessed.
- Own secret; payment worker IAM `GetSecretValue` on one ARN; logs + SQS only. Bounded repository
  (no generic SQL); idempotent single-transaction persist. No enforcement/PAYMENT_REFERRAL; no AI decision.

## C5 Geo & Jurisdiction Intelligence security
- **10 geo tables** RLS-enabled (jurisdiction-local; Guardian principals only; IQ/anon denied);
  comparison-table CHECKs forbid `is_illegal_determination`=true AND `is_enforcement_authorised`=true;
  **no `ILLEGAL_IN_REGION` state**. Append-only `geo_observation`/`geo_change_history` (trigger-guarded).
- **Privacy = INDIVIDUAL SURVEILLANCE prohibited:** no person entity, no person-level column; the worker
  rejects any message carrying a `PROHIBITED_PERSON_FIELDS` field (→ DLQ, 0 writes); a privacy test
  enforces absence from the business model. Aggregate region/service signals only; no ISP/subscriber/
  bank/device/precise-location ingestion; no packet capture / IP-to-person resolution.
- **One trigger-only guard function** `guardian.geo_block_mutation()` (SECURITY INVOKER, not DEFINER);
  default PUBLIC EXECUTE **revoked** → still 0 new anon/PUBLIC-executable privileged functions.
- **Separate dedicated principal** `guardian_geo_worker`: grants only on geo tables + audit + SELECT on
  the `domain_reference`/`app_reference`/`payment_reference` contract views; **0 public/IQ grants, 0
  C2/C3/C4 base tables** (verified live: base-table read DENIED; contract views resolve real ids incl.
  `PAYMENT:MER-SYNTH-0001`). No BYPASSRLS → RLS via jurisdiction GUC (proven: ZA-GP sees only ZA-GP,
  ZA-WC only ZA-WC; anon/casino_admin grants = 0).
- New governed **Payment Reference Contract** view `guardian.payment_reference` (owner postgres; own
  jurisdiction predicate; plain view, not SECURITY DEFINER). Own secret; geo worker IAM `GetSecretValue`
  on one ARN; logs + SQS only. No enforcement, no geo-block, no provider referral, no AI legal decision.

## C6 Case & Investigation Management security
- **12 case tables** RLS-enabled (jurisdiction-local; Guardian principals only; IQ/anon denied);
  case/finding/review CHECKs forbid `is_legal_determination`=true AND `is_enforcement_authorised`=true;
  no enforcement status; no `ILLEGAL_OPERATOR_CONFIRMED`. Append-only chronology + status/priority history
  (trigger-guarded; live UPDATE rejected).
- **Fundamental boundary:** intelligence ≠ legal finding; case opened ≠ illegal; high priority ≠
  enforcement; finding ≠ final legal determination; case closed ≠ provider action. No `/enforce`,`/block`,
  `/takedown`,`/referral` API; no provider-response lifecycle; no AI legal decision.
- **Separate dedicated principal** `guardian_case_worker`: grants only on case tables + audit + SELECT on
  the `domain_reference`/`app_reference`/`payment_reference`/`geo_reference` contract views; **0 public/IQ
  grants, 0 C2–C5 base tables** (verified live: base-table read DENIED; all four views resolve; subjects
  resolved to `DOM-SYNTH-0003`/`APP-SYNTH-0003`/`MER-SYNTH-0001`/`GEO-SYNTH-0001`). No BYPASSRLS → RLS via
  jurisdiction GUC (proven: ZA-GP sees only ZA-GP; cross-jurisdiction denied; anon/casino_admin grants = 0).
- **Trigger-only guard function** `guardian.case_block_mutation()` (SECURITY INVOKER, not DEFINER); default
  PUBLIC EXECUTE **revoked** → still 0 new anon/PUBLIC-executable privileged functions.
- **SoD** (reused `evaluateSod`): same principal as Investigator+Reviewer → denied; distinct reviewer →
  pass. **MFA hard gate** intact (synthetic identities only). New governed **Geo Reference Contract** view
  `guardian.geo_reference` (owner postgres; own jurisdiction predicate; plain view, not SECURITY DEFINER).
  Own secret; case worker IAM `GetSecretValue` on one ARN; logs + SQS only.

## C7 Digital Evidence Vault security
- **9 evidence tables** RLS-enabled (jurisdiction-local; Guardian principals only; IQ/anon denied);
  `guardian_evidence`/`guardian_evidence_export` CHECKs forbid `is_legal_determination`=true AND
  `is_enforcement_authorised`=true. Append-only custody/access/integrity/version/derivation (trigger-guarded;
  live UPDATE rejected).
- **Integrity:** SHA-256 content hash + independent **per-evidence custody hash chain** (`sequence_number` +
  `previous_event_hash` -> `event_hash`) anchored to Shared Audit (ADR-0017). Tamper detectable: content ->
  `INTEGRITY_FAILED`; custody chain verification breaks on any altered event. Proven live: chain
  `00000000 -> a59a0e60 -> 7027385f -> c8e45979`.
- **Private S3 vault** `safebet-guardian-evidence-demo`: **all public access blocked**, SSE-AES256, versioning,
  TLS-only deny policy. Proven: anon GET/LIST -> 403; stored object AES256 + versioned. Worker `s3:PutObject`
  on `evidence/*` only; no public URL; deterministic key -> orphan-reconcilable.
- **Separate dedicated principal** `guardian_evidence_worker`: grants only on evidence tables + audit + SELECT
  on `case_reference`; **0 public/IQ grants, 0 C1-C6 base tables** (verified live: C6 base read DENIED; case_
  reference view resolves). No BYPASSRLS -> RLS via jurisdiction GUC (proven: ZA-GP sees only ZA-GP, ZA-WC only
  ZA-WC; anon/casino_admin grants = 0). Access model = role x jurisdiction x classification x purpose (no
  universal service-role human access; Investigator denied HIGHLY_RESTRICTED).
- **Trigger-only guard** `guardian.evidence_block_mutation()` (SECURITY INVOKER, not DEFINER); default PUBLIC
  EXECUTE **revoked** -> still 0 new anon/PUBLIC-executable privileged functions. New governed **Case Reference
  Contract** view `guardian.case_reference` (owner postgres; own jurisdiction predicate; plain view). Own
  secret; worker IAM least-privilege. No enforcement, no provider action, no AI legal decision.

## C8 Enforcement Policy Registry & Authorisation security
- **12 C8 tables** RLS-enabled (jurisdiction-local; Guardian principals only; IQ/anon denied);
  `action_authorisation` CHECKs force `is_external_action_executed=false` AND `is_provider_notified=false`;
  `legal_review` CHECK `is_enforcement_execution=false`. No EXECUTED/ACTIONED/PROVIDER_ACKNOWLEDGED state.
  Append-only history/review (trigger-guarded).
- **Authority ≠ execution:** C8 records a human AUTHORISED ACTION RECORD and STOPS. No `/execute`,`/send`,
  `/block`,`/referral`,`/publish` API; no outbound/provider client anywhere in the module (boundary-tested);
  a successful AUTHORISED produces 0 external calls/messages/emails.
- **Machine authorisation impossible (two layers):** the deterministic gate returns `AUTHORISER_NOT_PERMITTED`
  for `SYSTEM_SERVICE` (only a human `AUTHORISING_OFFICER` authorises); and `guardian_policy_worker` has **NO
  INSERT on `action_authorisation`/`legal_review`** — proven live (insert DENIED). SoD (Investigator ≠ Legal
  Reviewer ≠ Authorising Officer) enforced; evidence integrity is a HARD gate (`INTEGRITY_FAILED`/missing →
  BLOCKED).
- **Separate dedicated principal** `guardian_policy_worker`: SELECT the 12 C8 tables + audit + SELECT on the
  `case_reference`/`evidence_reference` contract views; INSERT ONLY `proposed_action`/history/audit; **0
  public/IQ grants, 0 C6/C7 base tables** (verified live); no BYPASSRLS → RLS via jurisdiction GUC (ZA-GP sees
  only ZA-GP; anon/casino_admin grants = 0). Own secret; worker IAM = logs + SQS + one secret (no
  external/provider permission).
- **Trigger-only guard** `guardian.policy_block_mutation()` (SECURITY INVOKER; PUBLIC EXECUTE revoked). New
  governed **Evidence Reference Contract** view `guardian.evidence_reference`. No AI legal decision.

## C9 Multi-Channel Enforcement Orchestration security
- **8 C9 tables** RLS-enabled (jurisdiction-local; Guardian principals only; IQ/anon denied);
  `enforcement_orchestration` CHECKs force `is_real_provider=false` AND `is_external_network_call=false`.
  Append-only response/verification/history/attempt/withdrawal/request (trigger-guarded).
- **Guardian orchestrates, providers perform:** SYNTHETIC providers only; no real ISP/registrar/host/bank/PSP/
  mobile/geo; no outbound/provider client anywhere in the module or worker (boundary-tested; no fetch/http/net/
  provider credential); no `/block-now`/`/freeze-account`/`/remove-app`/`/seize-domain` API. Provider-originated
  states come only from a `provider_response` row; ACK != ACTIONED; ACTIONED != VERIFIED (verifications=0 at
  ACTIONED, proven live).
- **Authenticated authorising identity (closes the C8 finding):** the `/authorise` and `/orchestrate` edges bind
  role/jurisdiction to an authenticated Guardian principal (`resolveGuardianPrincipal`); a caller cannot
  self-assert `AUTHORISING_OFFICER` from the request body (proven).
- **Consume only revalidated C8 authorisations:** the bounded `guardian.authorised_action` view is a data-layer
  revalidation gate (expired/withdrawn/superseded rows invisible); revalidated again before dispatch. No detection
  → enforcement path (no AUTHORISED contract → BLOCKED).
- **Separate dedicated principal** `guardian_enforcement_worker`: SELECT/INSERT the 8 C9 tables + audit; SELECT on
  `authorised_action` view only; **0 public/IQ grants, 0 C1–C8 base tables** (verified live); no BYPASSRLS → RLS
  via jurisdiction GUC (ZA-GP sees only ZA-GP; anon/casino_admin grants = 0). Own secret; worker IAM = logs + SQS
  + one secret (no external/provider/network permission).
- **Trigger-only guard** `guardian.orchestration_block_mutation()` (SECURITY INVOKER; PUBLIC EXECUTE revoked). New
  governed **Authorised-Action Contract** view. No AI enforcement; C8 human authorisation is the prerequisite.

## C10 Re-entry Intelligence & Continuous Verification security
- **7 C10 tables** RLS-enabled (jurisdiction-local; Guardian principals only; IQ/anon denied). Safety
  DB CHECKs: `is_illegality_determined=false`, `is_authority_applied=false`, `is_final_legal_determination=false`,
  `is_authorisation_granted=false`, `is_enforcement_dispatched=false`, `is_real_observation_source=false`,
  `is_external_network_call=false`.
- **Six append-only tables** (observation/relationship/coverage/review/routing/history) guarded by
  `guardian.reentry_block_mutation()` (SECURITY INVOKER; PUBLIC EXECUTE revoked). `reentry_candidate` is a
  state machine (service_role UPDATE) whose transitions are recorded in the append-only history; historic
  VERIFIED verification records are never rewritten.
- **No detection→enforcement**: C10 produces intelligence + routing only; C9 still runs only on a valid
  bounded C8 `AuthorisedActionContract`. `RE-ENTRY != ILLEGALITY`, `SIMILAR != SAME ENTITY`; standing
  authority is never inferred (explicit C8 coverage only).
- **Separate dedicated principal** `guardian_reentry_worker`: SELECT/INSERT the 7 C10 tables + audit; SELECT
  on the C9 **Orchestration Reference Contract** view only; **no C1–C9 base tables, no UPDATE/DELETE, no
  BYPASSRLS**. Worker IAM: logs + SQS Receive/Delete/GetQueueAttributes on the reentry queue+DLQ + one secret
  — **no `sqs:SendMessage`** (cannot enqueue C9 enforcement), no external/provider/network permission.
- **Immutable runtime** (C9.1 lesson from inception): the reentry ESM targets the qualified `:demo` alias,
  never `$LATEST`. Reviewer role/jurisdiction bound from the authenticated principal (no self-assert).
- **Synthetic sources only**: no real crawling/DNS/provider/app-store/payment/traffic surveillance; no
  person-level surveillance (operator/brand/service/domain/app/payment-channel/infra reference level; C5 boundary preserved).

## Estate impact (verified)
Platform-wide privileged exposure unchanged: `public` SECURITY DEFINER **138**, anon **1**,
PUBLIC **1** (the A5 RLS-predicate exception). No new platform-wide privileged exposure; no RLS
weakening; identityFederation OFF; A1–A5 intact; Production untouched. Guardian schema functions:
**6** (the C5 geo + C6 case + C7 evidence + C8 policy + C9 orchestration + C10 re-entry trigger-only append-only guards; SECURITY INVOKER; PUBLIC EXECUTE revoked).
