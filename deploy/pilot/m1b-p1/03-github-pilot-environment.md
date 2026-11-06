# Phase 3 — GitHub `pilot` environment (owner action; not AWS, not Supabase)

Configure the GitHub Actions environment the baseline-apply workflow binds to. `03-configure.ps1` automates it
with `gh` (you must be `gh auth login`'d to `SafeBetIQ/SafeBetdemo-main`).

## Requirements
- Environment name: `pilot`
- **Required reviewers**: add yourself (so the apply job pauses for manual approval before touching the Pilot DB).
- Variable `PILOT_PROJECT_REF` = the 20-char Pilot ref (non-secret).
- Secret `PILOT_DB_URL` = the Pilot DB connection string (`sslmode=require`). **Secret.** Set it straight from your
  shell env into GitHub; never write it to a file, never pass it to Claude.

## Notes
- The repo already has `vars.PILOT_PROJECT_REF`/`secrets.PILOT_DB_URL` referenced by
  `.github/workflows/pilot-m1b-baseline-apply.yml` at the `pilot` environment scope.
- The service-role key is NOT configured anywhere in CI.

## Rollback
Delete the secret/variable and (optionally) the environment:
```
gh api -X DELETE repos/SafeBetIQ/SafeBetdemo-main/environments/pilot/secrets/PILOT_DB_URL
gh variable delete PILOT_PROJECT_REF --env pilot
gh api -X DELETE repos/SafeBetIQ/SafeBetdemo-main/environments/pilot
```
