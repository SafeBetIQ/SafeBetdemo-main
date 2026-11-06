# Phase 6b — Pilot Secrets Manager namespace (safebet-iq/pilot/*). AWS-mutating; provisioner identity only.
# M1B-P1 has NO genuinely-secret AWS runtime value (the DB URL lives in the GitHub `pilot` environment, not
# AWS). This creates ONLY the Pilot public runtime-config entry so the namespace exists and is owned by Pilot.
# It HARD-REFUSES any service-role key or DB password. Skippable if no AWS runtime config is needed.
. "$PSScriptRoot/00-common-guards.ps1"
Assert-AwsProvisionerIdentity
Assert-Region

$ctx = Get-Content (Join-Path $PSScriptRoot 'pilot-context.json') | ConvertFrom-Json
$name = 'safebet-iq/pilot/runtime-public'
Assert-SecretName $name

# Only PUBLIC, client-safe values. No service-role key, no DB password, no token.
$payload = [ordered]@{
  NEXT_PUBLIC_ENV                        = 'pilot'
  NEXT_PUBLIC_SAFEBET_ENV                = 'pilot'
  NEXT_PUBLIC_SAFEBET_OPERATING_MODE     = 'production'
  NEXT_PUBLIC_SUPABASE_URL               = $ctx.supabase_url
  NEXT_PUBLIC_SUPABASE_ANON_KEY          = $ctx.anon_key
}
foreach ($v in $payload.Values) { Assert-NotForbidden @([string]$v) }
if (($payload.Values -join ' ') -match 'service_role') { throw 'SECRETS ABORT: refusing to store a service-role key.' }
$json = $payload | ConvertTo-Json -Compress

$exists = aws secretsmanager list-secrets --filters Key=name,Values=$name --query 'SecretList[0].ARN' --output text
if ($exists -and $exists -ne 'None') {
  aws secretsmanager put-secret-value --secret-id $name --secret-string $json | Out-Null
  Write-Host "updated secret $name (public runtime config only)"
} else {
  aws secretsmanager create-secret --name $name --secret-string $json `
    --description 'SafeBet IQ Pilot public runtime config (no service-role key, no DB password)' `
    --tags Key=Project,Value=SafeBetIQ Key=Environment,Value=Pilot Key=ManagedBy,Value=M1B | Out-Null
  Write-Host "created secret $name (public runtime config only)"
}
# ROLLBACK: aws secretsmanager delete-secret --secret-id safebet-iq/pilot/runtime-public --force-delete-without-recovery
