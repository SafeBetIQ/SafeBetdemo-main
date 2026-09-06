# ADR-0010 — Guardian domain worker persistence & least-privilege data access (ARCH-V4-C2.1)

- **Status:** Accepted (C2.1 on Demo; synthetic only; no production)
- **Date:** 2026-09-06
- **Relates to:** ADR-0009 (domain intelligence), ADR-0007 (runtime), ADR-0005 (privileged-fn/MFA), ADR-0006/0008

## Context
C2 built the durable domain-observation path (SQS→worker→DLQ) but the worker did not persist its
results — the least-privilege DB-access path was deferred. C2.1 closes that gap end-to-end.

## Decision
Persist worker output into the `guardian` schema through a **dedicated least-privilege Postgres role**
`guardian_domain_worker`:
- Grants ONLY on the 10 C2 domain tables + `audit_context` (USAGE on `guardian`); **no grants on
  public/IQ** → IQ business data unreachable at the privilege level. No BYPASSRLS → RLS enforced,
  scoped by a per-message jurisdiction GUC.
- Connection secret in **AWS Secrets Manager**; worker IAM `GetSecretValue` on that one ARN. Password
  set out-of-band, never committed/logged. Worker connects via the Supabase IPv4 **pooler** with `pg`.
- Writes only through a bounded **`DomainObservationRepository`** (fixed parameterised inserts; **no
  generic `execute(sql)`**). One transaction (no partial state); idempotent (deterministic ids +
  `on conflict do nothing`).

## Alternatives considered
- **service_role-mediated (PostgREST):** rejected — service_role bypasses RLS and can reach IQ tables;
  not least privilege. The dedicated role is strictly narrower.
- **Credential-free worker (C2 posture):** insufficient for C2.1 — observations must persist.
- **Separate Guardian database now:** deferred (P1 exit target); C2.1 uses schema + a dedicated
  least-privilege principal on the shared Supabase cluster as a governed interim boundary.

## Consequences
- Durable domain processing is end-to-end: SQS → worker → registry comparison → **idempotent DB
  persistence** → evidence reference → audit → review item. Proven live (persist, duplicate-suppress,
  non-destructive history, wrong-jurisdiction denial, poison→DLQ, IQ-access denied).
- No new SECURITY DEFINER / PUBLIC / anon; guardian schema still 0 functions. A1–A5 intact; MFA gate
  intact; Production untouched. Interim shared-cluster exception recorded; separate DB = P1 exit.

## Rollback
Worker code/alias via Lambda; IAM policy delete; secret delete; DB `revoke`+`drop role`+drop `gw_*`
policies (migration `20260905190000`). No schema drop; SafeBet IQ unaffected. Known-good C2 release
`aeec4d42fe9dece39d5514dca480754a63573630`.
