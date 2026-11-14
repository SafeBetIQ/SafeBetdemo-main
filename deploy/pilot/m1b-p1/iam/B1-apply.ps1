# SafeBet IQ - M1B-P1 B-1 IAM gate (APPLY). OUT-OF-BAND ADMIN ACTION.
# Creates the dedicated Pilot CodeBuild role from the approved JSON and adds ONLY that role to the
# SafeBetIQPilotProvisionerPolicy iam:PassRole scope. All IAM MUTATION runs under an MFA-backed
# temporary STS session (never the long-lived 'default' profile). Fail-closed; no secret printed.
#
# Run by the owner using the admin-capable bootstrap principal (safebetiq-backup-user):
#   # profile 'default' = safebetiq-backup-user   (bootstrap source only)
#   ./B1-apply.ps1          # prompts for the current TOTP, then runs under the MFA session
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/B1-common.ps1"

$ROLE      = 'safebet-iq-pilot-codebuild-role'
$ROLE_ARN  = "arn:aws:iam::$($B1.Account):role/${ROLE}"
$INLINE    = 'safebet-iq-pilot-codebuild-inline'
$PROV_POL  = "arn:aws:iam::$($B1.Account):policy/SafeBetIQPilotProvisionerPolicy"
$PROV_ROLE = "arn:aws:iam::$($B1.Account):role/SafeBetIQPilotProvisioner"
$HERE      = $PSScriptRoot
$TRUST     = Join-Path $HERE 'safebet-iq-pilot-codebuild-role.trust.json'
$POLICY    = Join-Path $HERE 'safebet-iq-pilot-codebuild-role.policy.json'
$EVIDENCE  = Join-Path $HERE 'B1-evidence.json'
$EB_EC2    = "arn:aws:iam::$($B1.Account):role/aws-elasticbeanstalk-ec2-role"
$EB_SVC    = "arn:aws:iam::$($B1.Account):role/aws-elasticbeanstalk-service-role"
$ev = [ordered]@{ step = @() }
function Note($m){ Write-Host "[B1] $m"; $ev.step += $m }
function Canon($o){
  if ($o -is [System.Management.Automation.PSCustomObject]) {
    $h=[ordered]@{}; foreach($p in ($o.PSObject.Properties.Name | Sort-Object)){ $h[$p]=Canon $o.$p }; return $h
  } elseif ($o -is [System.Collections.IEnumerable] -and $o -isnot [string]) {
    $a=@($o | ForEach-Object { Canon $_ }); try { return @($a | Sort-Object { ($_ | ConvertTo-Json -Compress -Depth 20) }) } catch { return $a }
  } else { return $o }
}
function CanonJson($o){ (Canon $o) | ConvertTo-Json -Depth 20 -Compress }
function SimDecision($srcArn,$action,$resArn){
  aws iam simulate-principal-policy --policy-source-arn $srcArn --action-names $action --resource-arns $resArn `
    --query 'EvaluationResults[0].EvalDecision' --output text
}

# Steps 1-2: base identity + exact MFA serial (long-lived profile = bootstrap source only).
$ev.base_caller = Assert-BackupUserBase
Assert-ExactMfaSerial
Note "base identity OK ($($ev.base_caller)); exact MFA serial $($B1.MfaSerial) present"

# Steps 3-6: acquire the MFA-backed temporary session. Everything after this uses env creds (no --profile).
$ev.mfa = New-MfaSession
Note 'MFA-backed temporary STS session acquired (GetSessionToken with registered MFA serial).'

try {
  # ---- Role: create or verify-no-drift (steps 6-10) ----
  $approvedTrust  = Get-Content $TRUST  -Raw | ConvertFrom-Json
  $approvedPolicy = Get-Content $POLICY -Raw | ConvertFrom-Json
  $r = $null
  try { $r = aws iam get-role --role-name $ROLE --output json 2>$null | ConvertFrom-Json } catch { $r = $null }
  if ($r) {
    Note "role $ROLE already exists - verifying no drift (will NOT overwrite)"
    if ((CanonJson $r.Role.AssumeRolePolicyDocument) -ne (CanonJson $approvedTrust)) { throw 'ABORT: existing role trust policy differs from approved trust.json (drift).' }
    $attached = aws iam list-attached-role-policies --role-name $ROLE --output json | ConvertFrom-Json
    if (@($attached.AttachedPolicies).Count -ne 0) { throw 'ABORT: existing role has attached managed policies (expected none).' }
    $inline = aws iam list-role-policies --role-name $ROLE --output json | ConvertFrom-Json
    if (@($inline.PolicyNames) -notcontains $INLINE) { throw "ABORT: existing role missing inline policy $INLINE." }
    $livePol = (aws iam get-role-policy --role-name $ROLE --policy-name $INLINE --output json | ConvertFrom-Json).PolicyDocument
    if ((CanonJson $livePol) -ne (CanonJson $approvedPolicy)) { throw 'ABORT: existing inline policy differs from approved policy.json (drift).' }
    Note 'existing role matches approved JSON exactly (no drift).'
  } else {
    Note "creating role $ROLE from approved trust.json"
    aws iam create-role --role-name $ROLE --assume-role-policy-document "file://$TRUST" `
      --description 'Pilot CodeBuild service role (M1B-P1): scoped logs + build artifacts only' `
      --tags Key=Project,Value=SafeBetIQ Key=Environment,Value=Pilot Key=ManagedBy,Value=M1B Key=Purpose,Value=CodeBuild | Out-Null
    aws iam put-role-policy --role-name $ROLE --policy-name $INLINE --policy-document "file://$POLICY" | Out-Null
    Note 'role + inline policy created.'
  }

  # Read back + assert minimal (steps 9-10).
  $attached = aws iam list-attached-role-policies --role-name $ROLE --output json | ConvertFrom-Json
  if (@($attached.AttachedPolicies).Count -ne 0) { throw 'ABORT: role has managed policies attached (must be inline-only, least-privilege).' }
  $trustBack = (aws iam get-role --role-name $ROLE --output json | ConvertFrom-Json).Role.AssumeRolePolicyDocument
  if ($trustBack.Statement[0].Principal.Service -ne 'codebuild.amazonaws.com') { throw 'ABORT: trust principal is not codebuild.amazonaws.com.' }
  $ev.role_arn = $ROLE_ARN
  Note 'role read-back OK: codebuild-only trust; inline-only; no Administrator/PowerUser/unrelated policy.'

  # ---- Provisioner PassRole amendment (steps 11-13) ----
  $defVer = (aws iam get-policy --policy-arn $PROV_POL --output json | ConvertFrom-Json).Policy.DefaultVersionId
  $ev.provisioner_prior_version = $defVer
  $doc = (aws iam get-policy-version --policy-arn $PROV_POL --version-id $defVer --output json | ConvertFrom-Json).PolicyVersion.Document
  $pass = @($doc.Statement | Where-Object { @($_.Action) -contains 'iam:PassRole' })
  if (@($pass).Count -ne 1) { throw "ABORT: expected exactly one iam:PassRole statement, found $(@($pass).Count)." }
  $res = @($pass[0].Resource)
  if ($res -contains '*') { throw 'ABORT: existing PassRole is already wildcard - refusing to touch.' }
  foreach($rq in @($EB_EC2,$EB_SVC)){ if ($res -notcontains $rq){ throw "ABORT: expected existing PassRole resource missing: $rq" } }
  if ($res -contains $ROLE_ARN) { Note 'PassRole already includes the Pilot CodeBuild role - no change needed.'; $ev.amended=$false }
  else {
    $pass[0].Resource = @($res + $ROLE_ARN)   # add ONLY the new role ARN; preserve everything else
    $new = $doc | ConvertTo-Json -Depth 30
    $tmp = New-TemporaryFile; $new | Set-Content $tmp -Encoding utf8
    $vers = (aws iam list-policy-versions --policy-arn $PROV_POL --output json | ConvertFrom-Json).Versions
    if (@($vers).Count -ge 5) {
      $old = @($vers | Where-Object { -not $_.IsDefaultVersion } | Sort-Object CreateDate | Select-Object -First 1)
      if ($old) { aws iam delete-policy-version --policy-arn $PROV_POL --version-id $old.VersionId | Out-Null; Note "pruned oldest non-default version $($old.VersionId)" }
    }
    aws iam create-policy-version --policy-arn $PROV_POL --policy-document "file://$tmp" --set-as-default | Out-Null
    Remove-Item $tmp -Force
    $ev.amended = $true
    Note 'provisioner PassRole amended (added only the Pilot CodeBuild role; set as default).'
  }

  # Read back + verify strictly additive (step 13).
  $newDef = (aws iam get-policy --policy-arn $PROV_POL --output json | ConvertFrom-Json).Policy.DefaultVersionId
  $ev.provisioner_new_version = $newDef
  $chk = (aws iam get-policy-version --policy-arn $PROV_POL --version-id $newDef --output json | ConvertFrom-Json).PolicyVersion.Document
  $resN = @(@($chk.Statement | Where-Object { @($_.Action) -contains 'iam:PassRole' })[0].Resource)
  if ($resN -contains '*') { throw 'ABORT: PassRole became wildcard.' }
  if ($resN -notcontains $ROLE_ARN) { throw 'ABORT: new Pilot CodeBuild role missing from PassRole.' }
  foreach($rq in @($EB_EC2,$EB_SVC)){ if ($resN -notcontains $rq){ throw "ABORT: existing approved PassRole role was dropped: $rq" } }
  $iamAdmin = @($chk.Statement | Where-Object { @($_.Action) | Where-Object { $_ -match '^iam:(Create|Put|Attach|Delete|Update)' -and $_ -ne 'iam:PassRole' } })
  if (@($iamAdmin).Count -ne 0) { throw 'ABORT: policy now contains IAM administrative actions (unexpected).' }
  $secStmt = @($chk.Statement | Where-Object { @($_.Action) | Where-Object { $_ -like 'secretsmanager:*' } })
  if (@($secStmt.Resource) -notcontains "arn:aws:secretsmanager:eu-west-1:$($B1.Account):secret:safebet-iq/pilot/*") { throw 'ABORT: Secrets scope changed.' }
  $r53 = @($chk.Statement | Where-Object { @($_.Action) -contains 'route53:ChangeResourceRecordSets' })
  if (@($r53.Resource) -notcontains 'arn:aws:route53:::hostedzone/Z08227093UE2VXI2FU58S') { throw 'ABORT: Route53 scope changed.' }
  $region = @($chk.Statement | Where-Object { $_.Condition -and $_.Condition.StringEquals.'aws:RequestedRegion' -eq 'eu-west-1' })
  if (@($region).Count -lt 1) { throw 'ABORT: eu-west-1 region guard missing.' }
  Note 'provisioner policy verified: +Pilot CodeBuild PassRole only; existing roles intact; no wildcard; no IAM admin; Secrets/Route53/region unchanged.'

  # ---- Simulations (steps 14-15) ----
  $ev.sim = [ordered]@{}
  $ev.sim.pos_passrole_pilot     = SimDecision $PROV_ROLE 'iam:PassRole' $ROLE_ARN                                                     # expect allowed
  $ev.sim.neg_passrole_unrelated = SimDecision $PROV_ROLE 'iam:PassRole' "arn:aws:iam::$($B1.Account):role/OrganizationAccountAccessRole"  # expect implicitDeny
  if ($ev.sim.pos_passrole_pilot -ne 'allowed') { throw "ABORT: positive PassRole simulation = $($ev.sim.pos_passrole_pilot) (expected allowed)." }
  if ($ev.sim.neg_passrole_unrelated -eq 'allowed') { throw 'ABORT: provisioner can PassRole an unrelated role (should be denied).' }
  $ev.sim.cb_demo_secret    = SimDecision $ROLE_ARN 'secretsmanager:GetSecretValue' "arn:aws:secretsmanager:eu-west-1:$($B1.Account):secret:safebet-iq/demo/x"
  $ev.sim.cb_prod_secret    = SimDecision $ROLE_ARN 'secretsmanager:GetSecretValue' "arn:aws:secretsmanager:eu-west-1:$($B1.Account):secret:safebet-iq/prod/x"
  $ev.sim.cb_route53        = SimDecision $ROLE_ARN 'route53:ChangeResourceRecordSets' 'arn:aws:route53:::hostedzone/Z08227093UE2VXI2FU58S'
  $ev.sim.cb_eb_deploy      = SimDecision $ROLE_ARN 'elasticbeanstalk:UpdateEnvironment' '*'
  $ev.sim.cb_iam_createrole = SimDecision $ROLE_ARN 'iam:CreateRole' '*'
  foreach ($k in 'cb_demo_secret','cb_prod_secret','cb_route53','cb_eb_deploy','cb_iam_createrole') {
    if ($ev.sim[$k] -eq 'allowed') { throw "ABORT: CodeBuild role unexpectedly allowed $k." }
  }
  Note 'simulations OK: provisioner PassRole positive/negative correct; CodeBuild role cannot read secrets / change DNS / deploy EB / administer IAM.'

  $ev.timestamp_utc = [DateTime]::UtcNow.ToString('o')
  $ev | ConvertTo-Json -Depth 8 | Set-Content $EVIDENCE -Encoding utf8
  Note "non-secret evidence written -> $EVIDENCE"
  Write-Host 'B-1 APPLY COMPLETE (MFA session; role created/verified; PassRole amended additively; verified; simulated).'
}
finally {
  # Step 8 (MANDATORY): drop the temporary session from this process whether B-1 succeeded or failed.
  Clear-MfaSession
  Write-Host '[B1] temporary MFA session credentials cleared from this process.'
}
