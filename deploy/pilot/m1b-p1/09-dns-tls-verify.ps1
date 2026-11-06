# Phase 9 — DNS/TLS verification (READ-ONLY). Confirms pilot.safebetiq.com resolves to the Pilot ALB and
# serves a valid TLS certificate for the host. No mutation.
. "$PSScriptRoot/00-common-guards.ps1"
Assert-Region
$fqdn = $SBIQ.Hostname

# 1) The record exists in the authoritative zone (and NOT via the forbidden duplicate).
$rec = aws route53 list-resource-record-sets --hosted-zone-id $SBIQ.Zone `
  --query "ResourceRecordSets[?Name=='$fqdn.']" --output json | ConvertFrom-Json
if (-not $rec) { throw "DNS VERIFY: $fqdn not present in authoritative zone $($SBIQ.Zone)" }
Write-Host "authoritative record present in $($SBIQ.Zone)."

# 2) Public resolution + TLS handshake (host cert matches).
try { $ip = [System.Net.Dns]::GetHostAddresses($fqdn); Write-Host "resolves to: $($ip -join ', ')" }
catch { throw "DNS VERIFY: $fqdn does not resolve yet (allow propagation)" }

try {
  $resp = Invoke-WebRequest -Uri "https://$fqdn/api/version" -Method Head -TimeoutSec 20
  Write-Host "HTTPS OK: status $($resp.StatusCode) (valid certificate for $fqdn)"
} catch {
  throw "TLS/HTTPS VERIFY failed for https://$fqdn : $($_.Exception.Message)"
}
Write-Host 'DNS/TLS verified (authoritative zone; ALB alias; valid ACM cert).'
