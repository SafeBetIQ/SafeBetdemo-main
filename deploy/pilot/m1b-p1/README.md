# SafeBet IQ — M1B-P1 execution pack (SafeBet IQ Pilot only)

**Local-run PowerShell pack. Claude never runs these.** Run each script yourself, in order, while assumed into
`SafeBetIQPilotProvisioner`. Every AWS-mutating script hard-fails unless the caller is
`arn:aws:sts::046276255259:assumed-role/SafeBetIQPilotProvisioner/*`, account `046276255259`, region `eu-west-1`
— no fallback to `safebetiq-backup-user`/root. Fail-closed throughout; no secret is printed.

## Before you start
- Assume the role (MFA): `aws sts assume-role --role-arn arn:aws:iam::046276255259:role/SafeBetIQPilotProvisioner --role-session-name m1b-p1 --serial-number <your mfa> --token-code <code>` and load the temp creds into the shell; `$env:AWS_REGION='eu-west-1'`.
- `gh auth login` to `SafeBetIQ/SafeBetdemo-main`; have the Supabase management token for org `fhttwsuoliasybqkacrm`.
- PostgreSQL 17 `psql` on PATH (for the read-only Supabase phases).
- **Out-of-band IAM prerequisite (admin):** create `safebet-iq-pilot-codebuild-role` and amend
  `SafeBetIQPilotProvisionerPolicy` PassRole per `iam/provisioner-passrole-amendment.md`. The provisioner cannot
  create IAM; `06c` fails closed until this is done.

## Run order (note EB reality: the app version is built before the environment is created)
| Order | Script | Domain | Mutates |
|---|---|---|---|
| 1 | `01-supabase-create.md` + `01-record-values.ps1` | Supabase | create project (paid) |
| 2 | `02-supabase-preflight.ps1` | Supabase | read-only |
| 3 | `03-github-pilot-environment.md` + `03-configure.ps1` | GitHub | env var+secret |
| 4 | `04-dispatch-baseline.ps1` | GitHub→CI | dispatch (DB apply) |
| 5 | `05-verify-baseline.ps1` | Supabase | read-only verify |
| 6 | `06a-acm-dns.ps1`, `06b-secrets.ps1`, `06c-codebuild.ps1`, `06e-cloudwatch.ps1` | AWS | ACM/DNS, Secrets, CodeBuild, CW (paid: none-to-minor) |
| 7 | `07-deploy-app.ps1` | AWS | build + app-version (paid: CodeBuild) |
| 6d | `06d-eb-env.ps1` | AWS | **create EB env (paid) — needs the 07 version + 06a cert** |
| 8 | `08-eb-env-config.ps1` | AWS | enforce/verify env vars |
| 9 | `09-dns-tls-verify.ps1` | read-only | — |
| 10 | `10-app-health-verify.ps1` | read-only | — |
| 11 | `11-audit-chain-verify.ps1` | Supabase | pg_cron (15 min) |
| 12 | `12-isolation-evidence.ps1` | read-only | — |

`pilot-context.json` (non-secret: ref, public URL, anon key, cert ARN, version label) is written by the early
phases and read by later ones. `PILOT_DB_URL`, the Supabase token, and the DB password live only in your shell /
the GitHub `pilot` environment — never on disk, never to Claude. The service-role key is never used.

## Fail-closed rule
If any phase fails: STOP. Do not weaken IAM, change the approved hashes/fingerprint, disable verification, use
another Route53 zone, or use Demo/Production resources. Roll back using the per-script ROLLBACK notes.

## Authorities
Account `046276255259` · eu-west-1 · provisioner `SafeBetIQPilotProvisioner`. Schema-source `379141e…` (not the
app). App deploy `3b18faa…`. Canonical `530941a5…` · derivative `c2125acc…` · fingerprint `5f324b14…` ·
manifest `ea03c077…`. Supabase org `fhttwsuoliasybqkacrm` · Pilot `SafeBet IQ Pilot` (Pro+PITR, eu-west-1).
EB `safebet-iq-pilot` under `safebet-iq-app`. Host `pilot.safebetiq.com` in zone `Z08227093UE2VXI2FU58S`
(forbidden duplicate `Z01182572Y0Z0TTVHEY28`). Secrets `safebet-iq/pilot/*`.
