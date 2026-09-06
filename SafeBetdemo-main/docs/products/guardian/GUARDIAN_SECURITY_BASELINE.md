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

## Estate impact (verified)
Platform-wide privileged exposure unchanged: `public` SECURITY DEFINER **138**, anon **1**,
PUBLIC **1** (the A5 RLS-predicate exception). No new platform-wide privileged exposure; no RLS
weakening; identityFederation OFF; A1–A5 intact; Production untouched.
