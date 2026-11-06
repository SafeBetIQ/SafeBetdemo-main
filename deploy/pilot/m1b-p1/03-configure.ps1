# Phase 3 — configure the GitHub `pilot` environment (var + secret). Uses gh; sets the secret from env only.
#
#   $env:PILOT_DB_URL = '<pilot connection string>'   # this shell only; never a file
#   ./03-configure.ps1
. "$PSScriptRoot/00-common-guards.ps1"
$repo = 'SafeBetIQ/SafeBetdemo-main'

$ctx = Get-Content (Join-Path $PSScriptRoot 'pilot-context.json') | ConvertFrom-Json
Assert-SupabaseRefNotForbidden $ctx.project_ref
$dbUrl = Get-RequiredSecretEnv 'PILOT_DB_URL'
Assert-NotForbidden @($dbUrl, $ctx.project_ref)
if ($dbUrl -notmatch 'sslmode=require') { throw 'PILOT_DB_URL must use sslmode=require' }
if ($dbUrl -notlike "*$($ctx.project_ref)*") { throw 'PILOT_DB_URL does not target the recorded Pilot ref' }

# Ensure the environment exists (idempotent) with required reviewers = the current user.
$me = (gh api user --jq '.login')
Write-Host "ensuring environment 'pilot' with required reviewer $me …"
gh api -X PUT "repos/$repo/environments/pilot" -F "reviewers[][type]=User" -F "reviewers[][id]=$((gh api user --jq '.id'))" | Out-Null

# Non-secret variable.
gh variable set PILOT_PROJECT_REF --env pilot --body $ctx.project_ref --repo $repo

# Secret — piped from env; never echoed.
$dbUrl | gh secret set PILOT_DB_URL --env pilot --repo $repo
Write-Host 'pilot environment configured: PILOT_PROJECT_REF (var) + PILOT_DB_URL (secret). Secret value not printed.'
