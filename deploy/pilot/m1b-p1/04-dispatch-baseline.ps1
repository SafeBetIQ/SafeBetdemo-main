# Phase 4 — dispatch the governed baseline-apply workflow against the NEW Pilot project.
# The workflow (pilot-m1b-baseline-apply.yml) re-runs the fail-closed postgres:17 rehearsal, then applies the
# Supabase derivative to the Pilot DB and verifies fingerprint + manifest. This script only triggers + waits.
. "$PSScriptRoot/00-common-guards.ps1"
$repo = 'SafeBetIQ/SafeBetdemo-main'

$ctx = Get-Content (Join-Path $PSScriptRoot 'pilot-context.json') | ConvertFrom-Json
Assert-SupabaseRefNotForbidden $ctx.project_ref

Write-Host "dispatching pilot-m1b-baseline-apply.yml (env=pilot, ref=$($ctx.project_ref)) …"
gh workflow run pilot-m1b-baseline-apply.yml --repo $repo `
  -f environment=pilot `
  -f expected_project_ref=$($ctx.project_ref) `
  -f expected_sha=$($SBIQ.CanonicalSha) `
  -f expected_fingerprint=$($SBIQ.Fingerprint) `
  -f authority_commit=$($SBIQ.SchemaSourceCommit)
if ($LASTEXITCODE -ne 0) { throw 'workflow dispatch failed' }

Start-Sleep -Seconds 8
$run = gh run list --workflow pilot-m1b-baseline-apply.yml --repo $repo --limit 1 --json databaseId,url | ConvertFrom-Json
Write-Host "run: $($run[0].url)"
Write-Host "NOTE: the 'apply' job will PAUSE for your required-reviewer approval in the 'pilot' environment before any Pilot DB access."
Write-Host "Approve it in the GitHub UI, then run 05-verify-baseline.ps1 with the run id $($run[0].databaseId)."
