# SafeBet IQ - M1B-P1 B-1 IAM gate (ROLLBACK, ownership-aware). OUT-OF-BAND ADMIN ACTION.
# DO NOT run unless reversing B-1. Restores the prior SafeBetIQPilotProvisionerPolicy version (removing
# only the added Pilot CodeBuild PassRole entry) and deletes the dedicated role ONLY when a B-1 ownership
# marker proves this sequence created it. Refuses on any drift; preserves the role if ownership is not
# established and reports for owner decision. All IAM calls go through Invoke-Aws (throws on non-zero).
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
$MARKER    = Join-Path $HERE 'B1-role-ownership.json'
function Note($m){ Write-Host "[B1-rollback] $m" }
function Get-ProvDoc([string]$VerId){ (Invoke-AwsJson @('iam','get-policy-version','--policy-arn',$PROV_POL,'--version-id',$VerId,'--output','json')).PolicyVersion.Document }
function PassStmt($doc){ @($doc.Statement | Where-Object { @($_.Action) -contains 'iam:PassRole' }) }

# Steps 1-2 + MFA session (long-lived profile = bootstrap source only; all mutation under the session).
[void](Assert-BackupUserBase)
Assert-ExactMfaSerial
[void](New-MfaSession)
Note 'MFA-backed temporary STS session acquired.'

try {
  $ev = $null;     if (Test-Path $EVIDENCE) { $ev = Get-Content $EVIDENCE -Raw | ConvertFrom-Json }
  $marker = $null; if (Test-Path $MARKER)   { $marker = Get-Content $MARKER   -Raw | ConvertFrom-Json }

  # ===== 1) Restore provisioner policy (only if the Pilot role is currently present) =====
  $curDef = (Invoke-AwsJson @('iam','get-policy','--policy-arn',$PROV_POL,'--output','json')).Policy.DefaultVersionId
  $curDoc = Get-ProvDoc $curDef
  $curPass = @((PassStmt $curDoc)[0].Resource)
  if ($curPass -notcontains $ROLE_ARN) {
    Note 'provisioner PassRole already at pre-B1 state (Pilot role absent) - no policy restore needed.'
  } else {
    if (-not $ev -or -not $ev.provisioner_prior_version) { throw 'ABORT: Pilot role present in PassRole but no evidence prior-version to restore to. Owner decision required.' }
    $prior = $ev.provisioner_prior_version; $applied = $ev.provisioner_new_version
    if ($applied -and $curDef -ne $applied) { throw "ABORT (drift): current default $curDef != the version B-1 created ($applied)." }
    $priorDoc = Get-ProvDoc $prior
    $priorPass = @((PassStmt $priorDoc)[0].Resource)
    $added   = @($curPass   | Where-Object { $priorPass -notcontains $_ })
    $removed = @($priorPass | Where-Object { $curPass   -notcontains $_ })
    if (@($removed).Count -ne 0) { throw "ABORT (drift): prior PassRole roles missing from current: $($removed -join ', ')." }
    if (@($added).Count -ne 1 -or $added[0] -ne $ROLE_ARN) { throw "ABORT (drift): current adds more than the Pilot role: $($added -join ', ')." }
    $curNoPass   = @($curDoc.Statement   | Where-Object { @($_.Action) -notcontains 'iam:PassRole' })
    $priorNoPass = @($priorDoc.Statement | Where-Object { @($_.Action) -notcontains 'iam:PassRole' })
    if ((CanonJson $curNoPass) -ne (CanonJson $priorNoPass)) { throw 'ABORT (drift): non-PassRole statements differ between current and prior.' }
    Note "restoring provisioner policy default to prior version $prior"
    Invoke-Aws @('iam','set-default-policy-version','--policy-arn',$PROV_POL,'--version-id',$prior) | Out-Null
    $restoredPass = @((PassStmt (Get-ProvDoc $prior))[0].Resource)
    if ($restoredPass -contains $ROLE_ARN) { throw 'ABORT: restored version still lists the Pilot CodeBuild role.' }
    Note 'provisioner PassRole restored (Pilot role removed; prior roles intact).'
    if ($applied -and $applied -ne $prior) { Invoke-Aws @('iam','delete-policy-version','--policy-arn',$PROV_POL,'--version-id',$applied) | Out-Null; Note "deleted the B-1-created version $applied" }
  }

  # ===== 2) Delete the dedicated role - ONLY when B-1 ownership is established by the marker =====
  $role = Get-AwsJsonOrNull @('iam','get-role','--role-name',$ROLE,'--output','json')
  if (-not $role) { Note "role $ROLE already absent - nothing to delete." }
  else {
    $owns = ($marker -and $marker.role_created_by_b1 -eq $true -and $marker.role_arn -eq $ROLE_ARN)
    if (-not $owns) {
      Write-Host "[B1-rollback] NOTICE: role $ROLE exists but B-1 ownership is NOT established (no valid B1-role-ownership.json). PRESERVING the role (safe). Owner decision required: if B-1 created it, place the ownership marker and re-run rollback; otherwise leave or remove it manually."
    } else {
      $approvedTrust  = Get-Content $TRUST  -Raw | ConvertFrom-Json
      $approvedPolicy = Get-Content $POLICY -Raw | ConvertFrom-Json
      if ((CanonJson $role.Role.AssumeRolePolicyDocument) -ne (CanonJson $approvedTrust)) { throw 'ABORT (drift): role trust differs from approved - refusing to delete a modified role.' }
      if (@((Invoke-AwsJson @('iam','list-attached-role-policies','--role-name',$ROLE,'--output','json')).AttachedPolicies).Count -ne 0) { throw 'ABORT (drift): role has attached managed policies - refusing to delete.' }
      $names = @((Invoke-AwsJson @('iam','list-role-policies','--role-name',$ROLE,'--output','json')).PolicyNames)
      if ($names.Count -ne 1 -or $names[0] -ne $INLINE) { throw "ABORT (drift): unexpected inline policies: $($names -join ', ')." }
      $livePol = (Invoke-AwsJson @('iam','get-role-policy','--role-name',$ROLE,'--policy-name',$INLINE,'--output','json')).PolicyDocument
      if ((CanonJson $livePol) -ne (CanonJson $approvedPolicy)) { throw 'ABORT (drift): inline policy differs from approved - refusing to delete.' }
      if (@((Invoke-AwsJson @('iam','list-instance-profiles-for-role','--role-name',$ROLE,'--output','json')).InstanceProfiles).Count -ne 0) { throw 'ABORT (drift): role attached to instance profiles - refusing to delete.' }
      Note "deleting dedicated role $ROLE (B-1 ownership established)"
      Invoke-Aws @('iam','delete-role-policy','--role-name',$ROLE,'--policy-name',$INLINE) | Out-Null
      Invoke-Aws @('iam','delete-role','--role-name',$ROLE) | Out-Null
      Remove-Item $MARKER -Force -ErrorAction SilentlyContinue
      Note 'dedicated Pilot CodeBuild role + inline policy deleted; ownership marker removed.'
    }
  }
  Write-Host 'B-1 ROLLBACK COMPLETE (policy restored as needed; role handled per ownership).'
}
finally {
  Clear-MfaSession
  Write-Host '[B1-rollback] temporary MFA session credentials cleared from this process.'
}
