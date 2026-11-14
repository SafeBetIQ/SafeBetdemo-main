# SafeBet IQ - M1B-P1 B-1 IAM gate: shared MFA-backed STS bootstrap.
# Dot-sourced by B1-apply.ps1 and B1-rollback.ps1. The long-lived 'default' profile is used ONLY to
# prove the base identity and to call sts:GetSessionToken; ALL subsequent (mutating) calls use the
# returned MFA-backed temporary session (process env vars), never --profile default.
#
# Never prints/persists/echoes: the TOTP code, AccessKeyId, SecretAccessKey or SessionToken.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:B1 = [ordered]@{
  Account   = '046276255259'
  UserArn   = 'arn:aws:iam::046276255259:user/safebetiq-backup-user'
  UserName  = 'safebetiq-backup-user'
  MfaSerial = 'arn:aws:iam::046276255259:mfa/safebetiq-backup-user-mfa'
  Duration  = 900   # short, controlled session for this gate
}

# Step 1 - base identity preflight (long-lived 'default' profile = bootstrap source only).
function Assert-BackupUserBase {
  $id = aws sts get-caller-identity --profile default --output json | ConvertFrom-Json
  if ($id.Account -ne $B1.Account) { throw "ABORT: base account $($id.Account) != $($B1.Account)" }
  if ($id.Arn -ne $B1.UserArn)     { throw "ABORT: base caller '$($id.Arn)' is not $($B1.UserArn) (refusing root / assumed role / other user / other account)." }
  return $id.Arn
}

# Step 2 - require the EXACT registered TOTP device (not merely 'any MFA device').
function Assert-ExactMfaSerial {
  $mfa = aws iam list-mfa-devices --user-name $B1.UserName --profile default --output json | ConvertFrom-Json
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
      # Step 4 - MFA-backed temporary session. --token-code comes from the interactive prompt only.
      $raw = aws sts get-session-token --serial-number $B1.MfaSerial --token-code $code `
               --duration-seconds $B1.Duration --profile default --output json
      if ($LASTEXITCODE -ne 0 -or -not $raw) { throw 'ABORT: STS GetSessionToken failed (bad/expired TOTP or MFA unusable).' }
      $c = ($raw | ConvertFrom-Json).Credentials
      if (-not $c -or -not $c.AccessKeyId -or -not $c.SecretAccessKey -or -not $c.SessionToken) { throw 'ABORT: STS did not return temporary credentials.' }
    } finally { $code = $null }   # clear the plaintext TOTP immediately, success or fail
  } finally { $sec.Dispose() }

  # Step 5 - switch THIS process to the temporary session (env vars only; never the permanent profile).
  $env:AWS_ACCESS_KEY_ID     = $c.AccessKeyId
  $env:AWS_SECRET_ACCESS_KEY = $c.SecretAccessKey
  $env:AWS_SESSION_TOKEN     = $c.SessionToken
  $c = $null

  # Step 6 - session identity check using the temporary session (NO --profile).
  $sid = aws sts get-caller-identity --output json | ConvertFrom-Json
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
