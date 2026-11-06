# Phase 2 — Supabase empty-project preflight (READ-ONLY; no mutation).
# Runs the governed deploy/pilot/baseline/pilot_preflight.sql against the NEW Pilot DB and asserts the
# project is empty + SSL. PILOT_DB_URL is taken from the environment (never a file, never printed).
#
#   $env:PILOT_DB_URL = '<pilot connection string, sslmode=require>'   # this shell only
#   ./02-supabase-preflight.ps1
. "$PSScriptRoot/00-common-guards.ps1"

$dsn = Get-RequiredSecretEnv 'PILOT_DB_URL'
Assert-NotForbidden @($dsn)                       # must not point at Prod/Demo/Guardian
if ($dsn -notmatch 'sslmode=require') { throw 'PILOT_DB_URL must use sslmode=require' }

$ctx = Get-Content (Join-Path $PSScriptRoot 'pilot-context.json') | ConvertFrom-Json
if ($dsn -notlike "*$($ctx.project_ref)*") { throw "PILOT_DB_URL does not target the recorded Pilot ref $($ctx.project_ref)" }

$preflight = Resolve-Path "$PSScriptRoot/../../pilot/baseline/pilot_preflight.sql"
Write-Host 'running read-only preflight (catalog metadata only; no secrets printed) …'
$out = & psql $dsn -X -q -At -v ON_ERROR_STOP=1 -f $preflight
if ($LASTEXITCODE -ne 0) { throw 'PREFLIGHT FAILED (see exception above)' }

# Redacted assertions only (do not print role/defacl lines).
if (-not ($out | Select-String -SimpleMatch 'ssl|true')) { throw 'preflight: connection is not SSL' }
if (-not ($out | Select-String -SimpleMatch 'public_relations|0')) { throw 'preflight: public schema is NOT empty — refusing' }
Write-Host 'preflight OK: PostgreSQL 17, postgres, empty public schema, SSL, platform roles/extensions present.'
Write-Host '(supabase_admin membership NOT required; A7 is detect-and-report only.)'
