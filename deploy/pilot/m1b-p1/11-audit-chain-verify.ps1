# Phase 11 — configure continuous audit-chain verification via pg_cron (every 15 minutes) and run an
# initial verification. Supabase DB action (not AWS). Uses the existing accepted sbiq_verify_audit_chain.
# PILOT_DB_URL from env only; no secret printed. NO Demo simulator cron, NO financial cron, NO M1C cron.
. "$PSScriptRoot/00-common-guards.ps1"
$dsn = Get-RequiredSecretEnv 'PILOT_DB_URL'
Assert-NotForbidden @($dsn)
$ctx = Get-Content (Join-Path $PSScriptRoot 'pilot-context.json') | ConvertFrom-Json
if ($dsn -notlike "*$($ctx.project_ref)*") { throw 'PILOT_DB_URL does not target the recorded Pilot ref' }

# 1) initial verification (platform scope) — must return verified on the fresh, empty chain.
$res = & psql $dsn -X -q -At -v ON_ERROR_STOP=1 -c "select (sbiq_verify_audit_chain('platform'))->>'status';"
if ($LASTEXITCODE -ne 0) { throw 'audit-chain verify call failed' }
Write-Host "initial sbiq_verify_audit_chain('platform') => $res"
if ($res -ne 'verified') { throw "AUDIT ABORT: chain status '$res' != verified" }

# 2) schedule pg_cron every 15 minutes (idempotent: unschedule any prior job of the same name first).
$cron = @"
do \$\$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'sbiq_pilot_audit_verify_15m';
exception when others then null;
end \$\$;
select cron.schedule('sbiq_pilot_audit_verify_15m', '*/15 * * * *',
  \$cmd\$ select sbiq_verify_audit_chain('platform'); \$cmd\$);
"@
$cron | & psql $dsn -X -q -v ON_ERROR_STOP=1 -f -
if ($LASTEXITCODE -ne 0) { throw 'pg_cron scheduling failed' }

# 3) confirm exactly this one SafeBet cron job exists; refuse any Demo/financial/ingestion cron.
$jobs = & psql $dsn -X -q -At -c "select jobname || '|' || schedule from cron.job order by jobname;"
Write-Host "cron.job:`n$jobs"
if (-not ($jobs | Select-String -SimpleMatch 'sbiq_pilot_audit_verify_15m|*/15 * * * *')) { throw 'AUDIT ABORT: 15-minute audit-verify job not registered' }
foreach ($line in $jobs) {
  if ($line -match 'demo|simulate|simulator|financial_rollup_refresh|ingest|m1c' ) { throw "AUDIT ABORT: forbidden cron present: $line" }
}
Write-Host 'audit-chain verification configured: sbiq_verify_audit_chain every 15 minutes; no Demo/financial/ingestion cron.'
# ROLLBACK: select cron.unschedule('sbiq_pilot_audit_verify_15m');
