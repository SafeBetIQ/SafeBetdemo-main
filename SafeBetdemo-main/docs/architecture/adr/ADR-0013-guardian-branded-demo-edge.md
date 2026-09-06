# ADR-0013 — SafeBet Guardian branded Demo domain & service edge (ARCH-V4-C3.2)

- **Status:** Accepted (Guardian Demo edge; synthetic; no production)
- **Date:** 2026-09-06
- **Relates to:** ADR-0007 (Guardian runtime), ADR-0006 (standalone foundation)

## Context
Guardian is an established standalone product reached via a raw AWS Lambda Function URL. It
needs a dedicated SafeBet-branded **Demo** hostname `guardian-demo.safebetiq.com` without
weakening authentication and without touching SafeBet IQ domains/runtimes or Production.

## Decision
Front the Guardian API Lambda (`safebet-guardian-demo`) with an **API Gateway HTTP API +
custom domain**:
- **HTTP API** (`safebet-guardian-demo-edge`) with a Lambda proxy integration (payload v2 —
  the existing handler already reads `rawPath`/method/body, so no runtime change).
- **Auth model preserved:** `$default` route uses **AWS_IAM** authorization (privileged
  `/apps`, `/domains`, `/registry`, `/foundation` require SigV4 → 403 unauth). Explicit
  `GET /health` and `GET /version` routes are **public** (liveness/version, no secrets) — the
  same posture as SafeBet IQ's public `/api/health`.
- **TLS:** ACM certificate (eu-west-1, DNS-validated) on a REGIONAL custom domain (TLS 1.2).
- **DNS:** a single **additive** Route 53 A-alias `guardian-demo.safebetiq.com` → the API
  Gateway regional domain, in the authoritative `safebetiq.com` zone. No existing record
  (safebetiq.com / demo / app) was altered.

Rejected: **CloudFront → Function URL** — would make the endpoint effectively public (client→
CloudFront unauthenticated), weakening the IAM auth model. Rejected: unauthenticated public API.

## Consequences
- `guardian-demo.safebetiq.com` serves ONLY Guardian (`product=GUARDIAN`), TLS-valid, with the
  auth model intact. Runtime provenance unchanged (`2d9ca93…`); no redeploy (DNS/edge only).
- The raw Lambda **Function URL** remains as an **internal infrastructure endpoint** (not the
  normal external address).
- SafeBet IQ domains/runtimes/DB untouched; no Guardian DB/RLS change; no new privileged
  execution; Production untouched. **Do NOT** create `guardian.safebetiq.com` (Production) here.

## Rollback
Delete the Route 53 `guardian-demo` alias + the ACM-validation CNAME; delete the API Gateway
custom domain, mapping, and HTTP API; the ACM cert can be left or deleted. The Function URL
remains the prior known-good endpoint. No DB rollback needed; SafeBet IQ unaffected.
