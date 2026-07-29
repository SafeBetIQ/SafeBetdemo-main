# V2 — Non-Production Deployment Evidence (Milestone 4.6B)

**Environment: `local-independent-process` (non-production, synthetic). NOT managed cloud. NOT production.**

## 1. What Was Deployed
The SafeBet IQ Consumer Platform (Next.js 13.5.1) built fresh from branch `Demo` **with the Version 2.0
federation library present in the tree**, then run as the Next.js production server.

## 2. Independent-Process Proof
| Fact | Value |
|---|---|
| Command | `node ./node_modules/next/dist/bin/next start -p 3123` |
| Process PID | **24452** (child, independent of the test runner) |
| Startup | `✓ Ready in 496ms` |
| Bind | `http://127.0.0.1:3123` (loopback) |
| Server banner | `▲ Next.js 13.5.1` |
| Lifecycle | spawn → HTTP readiness poll (`/api/health` 200) → 44 requests served → SIGTERM/SIGKILL |

The evidence is HTTP responses from a separate OS process — not a class instantiated inside a test.

## 3. Build Evidence
`next build` exit **0**. Route manifest: 42 static (`○`) pages, `/api/health` server route, and
`/casino/players/[id]/investigate` server-rendered (`λ`). `tsc --noEmit` clean.

## 4. Production-Isolation Evidence
| Check | Result |
|---|---|
| `aws sts get-caller-identity` | **`InvalidClientTokenId`** — no valid AWS session; no cloud deploy possible |
| Elastic Beanstalk env configured | none (`.elasticbeanstalk` absent; no `eb` CLI) |
| Supabase target | `uexdjngogzunjxkpxwll` (demo); production `ilibvipqbkugqkppzdmh` absent from `.env.local` |
| Network | loopback only; no public traffic |
| Data | synthetic/demo only |
| Federation imported by app | 0 files |

## 5. HTTP Results Summary
- `/api/health` → **200**, `{"status":"ok","service":"safebet-iq","ts":"2026-07-25T19:11:17.453Z"}`, 13 ms.
- **43/43** page routes → **200**; **0 × 5xx**.
- Federation probe routes (`/api/federation`, `/api/sb-nat`, `/federation`, `/regulator/federation`,
  `/api/national-policy`) → **404** (no federation HTTP surface).
- Leakage scan (identityFederation / SB-NAT / national-twin / pepper / service_role / raw-pepper) across all
  responses → **0 hits**.

## 6. What This Evidence Does NOT Cover
Managed cloud deployment; managed RDS/native-RLS/WORM; AWS Secrets Manager/HSM/KMS; CloudWatch monitoring;
deployed server-side authentication/authorisation; deployed federation/connector/financial pipelines (no HTTP
surface by frozen design); managed-runtime restart and rollback. All OPEN — see the main report §23–§30, §38.
