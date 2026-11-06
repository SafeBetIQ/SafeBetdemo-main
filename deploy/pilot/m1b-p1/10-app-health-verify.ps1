# Phase 10 — application health/version verification (READ-ONLY). Confirms the running Pilot app is the
# approved commit, labelled pilot, non-production, no-operator-data. No mutation.
. "$PSScriptRoot/00-common-guards.ps1"
$fqdn = $SBIQ.Hostname

$v = Invoke-RestMethod -Uri "https://$fqdn/api/version" -TimeoutSec 20
Write-Host ($v | ConvertTo-Json -Compress)

if ($v.environment -ne 'pilot') { throw "HEALTH ABORT: environment='$($v.environment)' != pilot" }
if ($v.environmentClass -ne 'non-production') { throw "HEALTH ABORT: environmentClass='$($v.environmentClass)' != non-production" }
if ($v.dataClass -eq 'synthetic') { throw "HEALTH ABORT: Pilot must not report synthetic data" }
if ($v.gitCommit -ne $SBIQ.AppCommit) { throw "HEALTH ABORT: gitCommit='$($v.gitCommit)' != $($SBIQ.AppCommit)" }

# EB environment health is Green/OK.
$h = aws elasticbeanstalk describe-environment-health --environment-name $SBIQ.EbEnv `
  --attribute-names HealthStatus Status --query '{health:HealthStatus,status:Status}' --output json | ConvertFrom-Json
Write-Host "EB health: $($h.health) / $($h.status)"
if ($h.status -ne 'Ready') { throw "HEALTH ABORT: EB status '$($h.status)' != Ready" }
Write-Host "app health/version verified: pilot, commit $($SBIQ.AppCommit), non-production, dataClass=$($v.dataClass)."
