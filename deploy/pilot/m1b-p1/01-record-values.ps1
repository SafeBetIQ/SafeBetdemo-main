# Phase 1b — validate + record the new Pilot project identity (NO secrets persisted).
# Writes a NON-SECRET pilot-context.json (ref + public URL + anon key) for later phases.
# PILOT_DB_URL is NOT written to disk — it is set directly into the GitHub `pilot` environment in Phase 3.
param(
  [Parameter(Mandatory)] [string] $PilotProjectRef,
  [Parameter(Mandatory)] [string] $SupabaseUrl,
  [Parameter(Mandatory)] [string] $AnonKey
)
. "$PSScriptRoot/00-common-guards.ps1"

Assert-SupabaseRefNotForbidden $PilotProjectRef
Assert-NotForbidden @($SupabaseUrl, $AnonKey)
if ($SupabaseUrl -ne "https://$PilotProjectRef.supabase.co") {
  throw "URL ABORT: $SupabaseUrl does not match https://$PilotProjectRef.supabase.co"
}
if ($AnonKey -match 'service_role') { throw 'KEY ABORT: value looks like a service-role key; only the anon/public key is permitted here.' }

$ctx = [ordered]@{
  project        = 'SafeBet IQ Pilot'
  org            = $SBIQ.SupabaseOrg
  region         = $SBIQ.Region
  project_ref    = $PilotProjectRef
  supabase_url   = $SupabaseUrl
  anon_key       = $AnonKey        # public anon key (safe, client-side)
  canonical_sha  = $SBIQ.CanonicalSha
  derivative_sha = $SBIQ.DerivativeSha
  fingerprint    = $SBIQ.Fingerprint
  manifest_sha   = $SBIQ.ManifestSha
  app_commit     = $SBIQ.AppCommit
}
$out = Join-Path $PSScriptRoot 'pilot-context.json'
$ctx | ConvertTo-Json | Set-Content -Path $out -Encoding utf8
Write-Host "recorded non-secret pilot context -> $out"
Write-Host "PILOT_DB_URL is NOT stored here; set it into the GitHub 'pilot' environment in Phase 3 only."
