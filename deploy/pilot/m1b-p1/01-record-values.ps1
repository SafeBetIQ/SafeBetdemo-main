# Phase 1b - validate + record the new Pilot project identity (NO secrets persisted).
# Writes a NON-SECRET pilot-context.json (ref + public URL [+ optional public anon key]) for later phases.
# PILOT_DB_URL is NOT written to disk - it is set directly into the GitHub `pilot` environment in Phase 3.
#
# AnonKey is OPTIONAL: the application uses the LEGACY anon key via NEXT_PUBLIC_SUPABASE_ANON_KEY (confirmed:
# no publishable-key usage in the code). It is required only at the application build phase, so Phase 1 may
# record the minimum identity (ref + url) and defer the anon key. Do NOT change the key type (legacy anon).
param(
  [Parameter(Mandatory)] [string] $PilotProjectRef,
  [Parameter(Mandatory)] [string] $SupabaseUrl,
  [string] $AnonKey                                   # optional; public legacy anon key, or omit to defer
)
. "$PSScriptRoot/00-common-guards.ps1"

Assert-SupabaseRefNotForbidden $PilotProjectRef
if ($PilotProjectRef -notmatch '^[a-z]{20}$') { throw "ABORT: project ref '$PilotProjectRef' is not 20 lowercase chars." }
$toCheck = @($SupabaseUrl); if ($AnonKey) { $toCheck += $AnonKey }
Assert-NotForbidden $toCheck
if ($SupabaseUrl -ne "https://$PilotProjectRef.supabase.co") {
  throw "URL ABORT: $SupabaseUrl does not match https://$PilotProjectRef.supabase.co"
}

# Minimum non-secret identity only. No token / DB password / DB URL / service-role key is ever recorded.
$ctx = [ordered]@{
  project      = 'SafeBet IQ Pilot'
  org          = $SBIQ.SupabaseOrg
  region       = $SBIQ.Region
  project_ref  = $PilotProjectRef
  supabase_url = $SupabaseUrl
}
if ($AnonKey) {
  if ($AnonKey -match 'service_role') { throw 'KEY ABORT: value looks like a service-role key; only the public legacy anon key is permitted here.' }
  if ($AnonKey -match '^sb_publishable_') { throw 'KEY ABORT: a publishable key was supplied; the application uses the legacy anon key. Do not change the key type here.' }
  $ctx.anon_key = $AnonKey            # public legacy anon key (safe, client-side)
  $ctx.anon_key_recorded = $true
} else {
  $ctx.anon_key_recorded = $false     # deferred to the application configuration/build phase
}
$out = Join-Path $PSScriptRoot 'pilot-context.json'
$ctx | ConvertTo-Json | Set-Content -Path $out -Encoding utf8
Write-Host "recorded non-secret pilot context -> $out (anon_key_recorded=$($ctx.anon_key_recorded))"
Write-Host "PILOT_DB_URL is NOT stored here; set it into the GitHub 'pilot' environment in Phase 3 only."
