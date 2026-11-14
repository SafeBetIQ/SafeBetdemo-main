# SafeBet IQ - M1B-P1 B-1 IAM gate: shared AWS-CLI wrapper + MFA-backed STS bootstrap.
# Dot-sourced by B1-apply.ps1 and B1-rollback.ps1.
#
# WHY THE WRAPPER: under Windows PowerShell 5.1, $ErrorActionPreference='Stop' does NOT make a failing
# native command (aws.exe non-zero exit) throw. Every security-relevant AWS call therefore goes through
# Invoke-Aws, which inspects $LASTEXITCODE and throws on any non-zero exit. stderr is left on the host as
# diagnostic output; only stdout is captured. No success message is emitted by the wrapper.
#
# The long-lived 'default' profile is used ONLY for the base-identity read, the MFA-device read, and
# sts:GetSessionToken; everything after that uses the MFA-backed temporary session (process env vars).
# Never prints/persists/echoes: the TOTP code, AccessKeyId, SecretAccessKey or SessionToken.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:B1 = [ordered]@{
  Account   = '046276255259'
  UserArn   = 'arn:aws:iam::046276255259:user/safebetiq-backup-user'
  UserName  = 'safebetiq-backup-user'
  MfaSerial = 'arn:aws:iam::046276255259:mfa/safebetiq-backup-user-mfa'
  Duration  = 900
}

# ---- Central AWS CLI wrapper (fail-closed on native non-zero exit) ----
# Runs: aws @CliArgs. Returns captured stdout. Throws (stopping the script) on any non-zero exit.
# Do NOT use this for sts:GetSessionToken (its args contain the TOTP) - see New-MfaSession.
function Invoke-Aws {
  param([Parameter(Mandatory)][string[]]$CliArgs)
  $global:LASTEXITCODE = 0
  $out = & aws @CliArgs
  if ($LASTEXITCODE -ne 0) { throw "AWS CLI failed (exit $LASTEXITCODE): aws $($CliArgs -join ' ')" }
  return $out
}
function Invoke-AwsJson {
  param([Parameter(Mandatory)][string[]]$CliArgs)
  $t = Invoke-Aws -CliArgs $CliArgs
  if (-not $t) { return $null }
  return (($t -join "`n") | ConvertFrom-Json)
}
# Expected-failure probe (e.g. get-role existence). Returns $null on non-zero (stderr suppressed); never throws.
function Get-AwsJsonOrNull {
  param([Parameter(Mandatory)][string[]]$CliArgs)
  $global:LASTEXITCODE = 0
  $out = & aws @CliArgs 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $out) { return $null }
  return (($out -join "`n") | ConvertFrom-Json)
}

# ---- Canonical JSON (sorted keys / sorted scalar arrays) for drift comparison ----
function Canon($o){
  if ($o -is [System.Management.Automation.PSCustomObject]) {
    $h=[ordered]@{}; foreach($p in ($o.PSObject.Properties.Name | Sort-Object)){ $h[$p]=Canon $o.$p }; return $h
  } elseif ($o -is [System.Collections.IEnumerable] -and $o -isnot [string]) {
    $a=@($o | ForEach-Object { Canon $_ }); try { return @($a | Sort-Object { ($_ | ConvertTo-Json -Compress -Depth 20) }) } catch { return $a }
  } else { return $o }
}
function CanonJson($o){ (Canon $o) | ConvertTo-Json -Depth 20 -Compress }

# ---- Write a JSON string to a file as UTF-8 WITHOUT BOM (PS 5.1 Set-Content -Encoding utf8 adds a BOM,
#      which the AWS policy parser rejects as "Syntax errors in policy") ----
function Write-Utf8NoBom([string]$Path, [string]$Text) {
  [System.IO.File]::WriteAllText($Path, $Text, (New-Object System.Text.UTF8Encoding($false)))
}

# Step 1 - base identity preflight (long-lived 'default' profile = bootstrap source only).
function Assert-BackupUserBase {
  $id = Invoke-AwsJson @('sts','get-caller-identity','--profile','default','--output','json')
  if ($id.Account -ne $B1.Account) { throw "ABORT: base account $($id.Account) != $($B1.Account)" }
  if ($id.Arn -ne $B1.UserArn)     { throw "ABORT: base caller '$($id.Arn)' is not $($B1.UserArn) (refusing root / assumed role / other user / other account)." }
  return $id.Arn
}

# Step 2 - require the EXACT registered TOTP device (not merely 'any MFA device').
function Assert-ExactMfaSerial {
  $mfa = Invoke-AwsJson @('iam','list-mfa-devices','--user-name',$B1.UserName,'--profile','default','--output','json')
  $serials = @($mfa.MFADevices | ForEach-Object { $_.SerialNumber })
  if ($serials -notcontains $B1.MfaSerial) { throw "ABORT: required MFA serial $($B1.MfaSerial) is not attached to $($B1.UserName)." }
}

# Steps 3-6 - prompt TOTP interactively, GetSessionToken, load the MFA session into process env vars,
# verify the session identity. Returns a NON-SECRET evidence hashtable (no code / no credentials).
function New-MfaSession {
  $sec = Read-Host -AsSecureString 'Enter current TOTP code for safebetiq-backup-user-mfa'
  $c = $null
  try {
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    try { $code = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    try {
      if ($code -notmatch '^[0-9]{6}$') { throw 'ABORT: MFA code must be 6 digits.' }
      # Step 4 - MFA-backed temporary session. Bespoke (NOT via Invoke-Aws) so the TOTP never appears in
      # an error message; stderr suppressed; only a generic failure is surfaced.
      $global:LASTEXITCODE = 0
      $raw = & aws sts get-session-token --serial-number $B1.MfaSerial --token-code $code `
               --duration-seconds $B1.Duration --profile default --output json 2>$null
      if ($LASTEXITCODE -ne 0 -or -not $raw) { throw 'ABORT: STS GetSessionToken failed (bad/expired TOTP or MFA unusable).' }
      $c = (($raw -join "`n") | ConvertFrom-Json).Credentials
      if (-not $c -or -not $c.AccessKeyId -or -not $c.SecretAccessKey -or -not $c.SessionToken) { throw 'ABORT: STS did not return temporary credentials.' }
    } finally { $code = $null }
  } finally { $sec.Dispose() }

  # Step 5 - switch THIS process to the temporary session (env vars only; never the permanent profile).
  $env:AWS_ACCESS_KEY_ID     = $c.AccessKeyId
  $env:AWS_SECRET_ACCESS_KEY = $c.SecretAccessKey
  $env:AWS_SESSION_TOKEN     = $c.SessionToken
  $c = $null

  # Step 6 - session identity check using the temporary session (NO --profile).
  $sid = Invoke-AwsJson @('sts','get-caller-identity','--output','json')
  if ($sid.Account -ne $B1.Account) { Clear-MfaSession; throw "ABORT: session account $($sid.Account) != $($B1.Account)" }
  if ($sid.Arn -ne $B1.UserArn)     { Clear-MfaSession; throw "ABORT: session identity '$($sid.Arn)' is not the authorised $($B1.UserArn)." }

  return [ordered]@{
    account                 = $B1.Account
    authorised_principal    = $B1.UserArn
    mfa_serial              = $B1.MfaSerial
    mfa_session_acquisition = 'PASS'
    mfa_session_method      = 'sts:GetSessionToken using the registered MFA serial + interactive TOTP (temporary credentials obtained successfully)'
    session_identity        = $sid.Arn
    session_duration_seconds= $B1.Duration
  }
}

# Step 8 - remove the temporary credentials from this process. ALWAYS call in a finally block.
function Clear-MfaSession {
  foreach ($v in 'AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','AWS_SESSION_TOKEN') {
    if (Test-Path "env:$v") { Remove-Item "env:$v" -ErrorAction SilentlyContinue }
  }
}
