# SafeBet IQ - M1B-P1 B-1 IAM gate (ROLLBACK). OUT-OF-BAND ADMIN ACTION. DO NOT run unless reversing B-1.
# Undoes EXACTLY what B1-apply.ps1 did: restores the prior SafeBetIQPilotProvisionerPolicy version
# (removing only the added Pilot CodeBuild PassRole entry) and deletes the dedicated Pilot CodeBuild
# role/policy created by B-1. All IAM MUTATION runs under an MFA-backed temporary STS session (never the
# long-lived 'default' profile). Refuses on any unexpected drift. No secret values retrieved/printed.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/B1-common.ps1"

$ROLE      = 'safebet-iq-pilot-codebuild-role'
$ROLE_ARN  = "arn:aws:iam::$($B1.Account):role/${ROLE}"
$INLINE    = 'safebet-iq-pilot-codebuild-inline'
$PROV_POL  = "arn:aws:iam::$($B1.Account):policy/SafeBetIQPilotProvisionerPolicy"
$HERE      = $PSScriptRoot
$TRUST     = Join-Path $HERE 'safebet-iq-pilot-codebuild-role.trust.json'
$POLICY    = Join-Path $HERE 'safebet-iq-pilot-codebuild-role.policy.json'
$EVIDENCE  = Join-Path $HERE 'B1-evidence.json'
function Note($m){ Write-Host "[B1-rollback] $m" }
function Canon($o){
  if ($o -is [System.Management.Automation.PSCustomObject]) {
    $h=[ordered]@{}; foreach($p in ($o.PSObject.Properties.Name | Sort-Object)){ $h[$p]=Canon $o.$p }; return $h
  } elseif ($o -is [System.Collections.IEnumerable] -and $o -isnot [string]) {
    $a=@($o | ForEach-Object { Canon $_ }); try { return @($a | Sort-Object { ($_ | ConvertTo-Json -Compress -Depth 20) }) } catch { return $a }
  } else { return $o }
}
function CanonJson($o){ (Canon $o) | ConvertTo-Json -Depth 20 -Compress }

# Steps 1-2: base identity + exact MFA serial (long-lived profile = bootstrap source only).
[void](Assert-BackupUserBase)
Assert-ExactMfaSerial

# Steps 3-6: acquire the MFA-backed temporary session. Everything after this uses env creds (no --profile).
[void](New-MfaSession)
Note 'MFA-backed temporary STS session acquired (GetSessionToken with registered MFA serial).'

try {
  if (-not (Test-Path $EVIDENCE)) { throw 'ABORT: B1-evidence.json not found - cannot safely roll back without the apply record.' }
  $ev = Get-Content $EVIDENCE -Raw | ConvertFrom-Json
  $prior = $ev.provisioner_prior_version; $applied = $ev.provisioner_new_version
  if (-not $prior) { throw 'ABORT: evidence missing prior provisioner version.' }

  # ---- 1) Restore provisioner policy - remove ONLY the added Pilot CodeBuild PassRole entry ----
  $curDef = (aws iam get-policy --policy-arn $PROV_POL --output json | ConvertFrom-Json).Policy.DefaultVersionId
  if ($applied -and $curDef -ne $applied) { throw "ABORT (drift): current default version $curDef != the version B-1 created ($applied). Refusing automatic rollback." }
  $curDoc   = (aws iam get-policy-version --policy-arn $PROV_POL --version-id $curDef --output json | ConvertFrom-Json).PolicyVersion.Document
  $priorDoc = (aws iam get-policy-version --policy-arn $PROV_POL --version-id $prior  --output json | ConvertFrom-Json).PolicyVersion.Document
  $curPass   = @(@($curDoc.Statement   | Where-Object { @($_.Action) -contains 'iam:PassRole' })[0].Resource)
  $priorPass = @(@($priorDoc.Statement | Where-Object { @($_.Action) -contains 'iam:PassRole' })[0].Resource)
  $added   = @($curPass   | Where-Object { $priorPass -notcontains $_ })
  $removed = @($priorPass | Where-Object { $curPass   -notcontains $_ })
  if (@($removed).Count -ne 0) { throw "ABORT (drift): prior PassRole roles missing from current: $($removed -join ', ')." }
  if (@($added).Count -ne 1 -or $added[0] -ne $ROLE_ARN) { throw "ABORT (drift): current adds more than just the Pilot CodeBuild role: $($added -join ', '). Refusing." }
  $curNoPass   = @($curDoc.Statement   | Where-Object { @($_.Action) -notcontains 'iam:PassRole' })
  $priorNoPass = @($priorDoc.Statement | Where-Object { @($_.Action) -notcontains 'iam:PassRole' })
  if ((CanonJson $curNoPass) -ne (CanonJson $priorNoPass)) { throw 'ABORT (drift): statements other than PassRole differ between current and prior versions.' }

  Note "restoring provisioner policy default to prior version $prior"
  aws iam set-default-policy-version --policy-arn $PROV_POL --version-id $prior | Out-Null
  $restoredPass = @(@((aws iam get-policy-version --policy-arn $PROV_POL --version-id $prior --output json | ConvertFrom-Json).PolicyVersion.Document.Statement | Where-Object { @($_.Action) -contains 'iam:PassRole' })[0].Resource)
  if ($restoredPass -contains $ROLE_ARN) { throw 'ABORT: restored version still lists the Pilot CodeBuild role.' }
  Note 'provisioner PassRole restored (Pilot CodeBuild role removed; prior roles intact).'
  if ($applied -and $applied -ne $prior) {
    aws iam delete-policy-version --policy-arn $PROV_POL --version-id $applied | Out-Null
    Note "deleted the B-1-created version $applied"
  }

  # ---- 2) Delete the dedicated role/policy - only if it still matches the approved JSON ----
  $r = $null
  try { $r = aws iam get-role --role-name $ROLE --output json 2>$null | ConvertFrom-Json } catch { $r = $null }
  if (-not $r) { Note "role $ROLE already absent - nothing to delete." }
  else {
    $approvedTrust  = Get-Content $TRUST  -Raw | ConvertFrom-Json
    $approvedPolicy = Get-Content $POLICY -Raw | ConvertFrom-Json
    if ((CanonJson $r.Role.AssumeRolePolicyDocument) -ne (CanonJson $approvedTrust)) { throw 'ABORT (drift): role trust differs from approved - refusing to delete a modified role.' }
    $attached = aws iam list-attached-role-policies --role-name $ROLE --output json | ConvertFrom-Json
    if (@($attached.AttachedPolicies).Count -ne 0) { throw 'ABORT (drift): role has attached managed policies - refusing to delete.' }
    $names = @((aws iam list-role-policies --role-name $ROLE --output json | ConvertFrom-Json).PolicyNames)
    if ($names.Count -ne 1 -or $names[0] -ne $INLINE) { throw "ABORT (drift): unexpected inline policies on role: $($names -join ', ')." }
    $livePol = (aws iam get-role-policy --role-name $ROLE --policy-name $INLINE --output json | ConvertFrom-Json).PolicyDocument
    if ((CanonJson $livePol) -ne (CanonJson $approvedPolicy)) { throw 'ABORT (drift): inline policy differs from approved - refusing to delete.' }
    $prof = aws iam list-instance-profiles-for-role --role-name $ROLE --output json | ConvertFrom-Json
    if (@($prof.InstanceProfiles).Count -ne 0) { throw 'ABORT (drift): role attached to instance profiles - refusing to delete.' }
    Note "deleting dedicated role $ROLE (inline policy first)"
    aws iam delete-role-policy --role-name $ROLE --policy-name $INLINE | Out-Null
    aws iam delete-role --role-name $ROLE | Out-Null
    Note 'dedicated Pilot CodeBuild role + inline policy deleted.'
  }
  Write-Host 'B-1 ROLLBACK COMPLETE (MFA session; provisioner PassRole restored; dedicated role removed). No other change.'
}
finally {
  # Step 8 (MANDATORY): drop the temporary session from this process whether rollback succeeded or failed.
  Clear-MfaSession
  Write-Host '[B1-rollback] temporary MFA session credentials cleared from this process.'
}
