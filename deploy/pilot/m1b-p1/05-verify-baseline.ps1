# Phase 5 — verify the baseline apply. Confirms the workflow run SUCCEEDED (its own steps already prove
# canonical SHA, derivative SHA, fingerprint 5f324b14, manifest ea03c077, PUBLIC=0, anon-secdef=0, no rows,
# no Demo) and independently re-reads those facts read-only against the Pilot DB.
param([Parameter(Mandatory)] [long] $RunId)
. "$PSScriptRoot/00-common-guards.ps1"
$repo = 'SafeBetIQ/SafeBetdemo-main'

$run = gh run view $RunId --repo $repo --json conclusion,status,url | ConvertFrom-Json
Write-Host "workflow run $($run.url) status=$($run.status) conclusion=$($run.conclusion)"
if ($run.status -ne 'completed' -or $run.conclusion -ne 'success') {
  throw "BASELINE VERIFY ABORT: workflow run did not succeed (status=$($run.status), conclusion=$($run.conclusion)). STOP."
}

# Independent read-only re-check against the Pilot DB (optional but belt-and-braces).
$dsn = Get-RequiredSecretEnv 'PILOT_DB_URL'
Assert-NotForbidden @($dsn)
$base = Resolve-Path "$PSScriptRoot/../../pilot/baseline"

$fp = (& psql $dsn -f (Join-Path $base 'fingerprint.sql') | ForEach-Object { $_ -replace "`r",'' }) -join "`n"
$fpSha = (Get-FileHash -InputStream ([IO.MemoryStream]::new([Text.Encoding]::UTF8.GetBytes($fp + "`n"))) -Algorithm SHA256).Hash.ToLower()
if ($fpSha -ne $SBIQ.Fingerprint) { throw "FINGERPRINT MISMATCH: $fpSha != $($SBIQ.Fingerprint)" }

$priv = (& psql $dsn -X -q -At -v ON_ERROR_STOP=1 -f (Join-Path $base 'pilot_privilege_verify.sql')) -join "`n"
$privSha = (Get-FileHash -InputStream ([IO.MemoryStream]::new([Text.Encoding]::UTF8.GetBytes($priv + "`n"))) -Algorithm SHA256).Hash.ToLower()
if ($privSha -ne $SBIQ.ManifestSha) { throw "MANIFEST MISMATCH: $privSha != $($SBIQ.ManifestSha)" }

Write-Host "VERIFIED: fingerprint=$fpSha ; manifest=$privSha (both match authorities). DB side READY."
