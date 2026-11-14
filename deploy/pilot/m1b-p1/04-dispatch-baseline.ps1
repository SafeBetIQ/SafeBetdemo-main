# Phase 4 — dispatch the governed baseline-apply workflow against the NEW Pilot project.
# The workflow (pilot-m1b-baseline-apply.yml) re-runs the fail-closed postgres:17 rehearsal, then applies the
# Supabase derivative to the Pilot DB and verifies fingerprint + manifest. This script only triggers + waits.
. "$PSScriptRoot/00-common-guards.ps1"
$repo = 'SafeBetIQ/SafeBetdemo-main'

$ctx = Get-Content (Join-Path $PSScriptRoot 'pilot-context.json') | ConvertFrom-Json
Assert-SupabaseRefNotForbidden $ctx.project_ref

# The workflow version to run MUST be the approved branch holding this committed workflow - never a silent
# fall-back to the repository default branch (production) or a Demo branch. workflow_dispatch additionally
# requires the workflow file to exist on the default branch to be dispatchable (see the Phase-3 report).
$APPROVED_REF = 'feat/iq-pilot-m1a-baseline'
if ($APPROVED_REF -in 'production','main','master','Demo','demo') { throw "ABORT: approved ref must not be a default/Demo branch (got $APPROVED_REF)." }

Write-Host "dispatching pilot-m1b-baseline-apply.yml (ref=$APPROVED_REF, env=pilot, project=$($ctx.project_ref)) …"
gh workflow run pilot-m1b-baseline-apply.yml --repo $repo --ref $APPROVED_REF `
  -f environment=pilot `
  -f expected_project_ref=$($ctx.project_ref) `
  -f expected_sha=$($SBIQ.CanonicalSha) `
  -f expected_fingerprint=$($SBIQ.Fingerprint) `
  -f authority_commit=$($SBIQ.SchemaSourceCommit)
if ($LASTEXITCODE -ne 0) { throw 'workflow dispatch failed (note: the workflow must exist on the default branch to be dispatchable).' }

Start-Sleep -Seconds 8
$run = gh run list --workflow pilot-m1b-baseline-apply.yml --repo $repo --limit 1 --json databaseId,url | ConvertFrom-Json
Write-Host "run: $($run[0].url)"
Write-Host "NOTE: the 'apply' job will PAUSE for your required-reviewer approval in the 'pilot' environment before any Pilot DB access."
Write-Host "Approve it in the GitHub UI, then run 05-verify-baseline.ps1 with the run id $($run[0].databaseId)."
