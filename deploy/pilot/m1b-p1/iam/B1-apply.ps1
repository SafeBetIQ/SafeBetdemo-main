# SafeBet IQ - M1B-P1 B-1 IAM gate (APPLY, recovery-safe). OUT-OF-BAND ADMIN ACTION.
# Creates the dedicated Pilot CodeBuild role from the approved JSON (or verifies a pre-existing exact
# copy) and adds ONLY that role to the SafeBetIQPilotProvisionerPolicy iam:PassRole scope. Resumable
# and idempotent. All IAM calls go through Invoke-Aws (throws on native non-zero exit). Policy documents
# are transported via a UTF-8-no-BOM temp file validated locally and by Access Analyzer before apply.
# All mutation runs under an MFA-backed temporary STS session. Fail-closed; no secret printed.
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
$MARKER    = Join-Path $HERE 'B1-role-ownership.json'
$EB_EC2    = "arn:aws:iam::$($B1.Account):role/aws-elasticbeanstalk-ec2-role"
$EB_SVC    = "arn:aws:iam::$($B1.Account):role/aws-elasticbeanstalk-service-role"
$DEMO_CB   = "arn:aws:iam::$($B1.Account):role/SafeBetDemoCodeBuildRole"
$EXPECTED_EXISTING = @($EB_EC2, $EB_SVC, $DEMO_CB)   # the approved pre-amendment PassRole roles
$ev = [ordered]@{ step = @() }
$tmpFile = $null
function Note($m){ Write-Host "[B1] $m"; $ev.step += $m }
function Get-ProvDoc([string]$VerId){ (Invoke-AwsJson @('iam','get-policy-version','--policy-arn',$PROV_POL,'--version-id',$VerId,'--output','json')).PolicyVersion.Document }
function PassStmt($doc){ @($doc.Statement | Where-Object { @($_.Action) -contains 'iam:PassRole' }) }
function SimDecision($srcArn,$action,$resArn){
  (Invoke-Aws @('iam','simulate-principal-policy','--policy-source-arn',$srcArn,'--action-names',$action,'--resource-arns',$resArn,'--query','EvaluationResults[0].EvalDecision','--output','text')) -join ''
}

# Steps 1-2: base identity + exact MFA serial (long-lived profile = bootstrap source only).
$ev.base_caller = Assert-BackupUserBase
Assert-ExactMfaSerial
Note "base identity OK ($($ev.base_caller)); exact MFA serial present"

# Steps 3-6: acquire the MFA-backed temporary session. Everything after uses env creds (no --profile).
$ev.mfa = New-MfaSession
Note 'MFA-backed temporary STS session acquired.'

try {
  $approvedTrust  = Get-Content $TRUST  -Raw | ConvertFrom-Json
  $approvedPolicy = Get-Content $POLICY -Raw | ConvertFrom-Json

  # ===== ROLE PHASE (resume-aware) =====
  $r = Get-AwsJsonOrNull @('iam','get-role','--role-name',$ROLE,'--output','json')
  if ($r) {
    Note "role $ROLE already exists - verifying exact match (no overwrite)"
    if ((CanonJson $r.Role.AssumeRolePolicyDocument) -ne (CanonJson $approvedTrust)) { throw 'ABORT: existing role trust differs from approved trust.json (drift).' }
    $attached = Invoke-AwsJson @('iam','list-attached-role-policies','--role-name',$ROLE,'--output','json')
    if (@($attached.AttachedPolicies).Count -ne 0) { throw 'ABORT: existing role has attached managed policies (expected none).' }
    $names = @((Invoke-AwsJson @('iam','list-role-policies','--role-name',$ROLE,'--output','json')).PolicyNames)
    if ($names.Count -ne 1 -or $names[0] -ne $INLINE) { throw "ABORT: unexpected inline policy set on existing role: $($names -join ', ')." }
    $livePol = (Invoke-AwsJson @('iam','get-role-policy','--role-name',$ROLE,'--policy-name',$INLINE,'--output','json')).PolicyDocument
    if ((CanonJson $livePol) -ne (CanonJson $approvedPolicy)) { throw 'ABORT: existing inline policy differs from approved policy.json (drift).' }
    $ev.role_action = 'preexisting_verified'
    # Ownership: only a marker written by a prior B-1 run can establish that this sequence created the role.
    if (Test-Path $MARKER) {
      $mk = Get-Content $MARKER -Raw | ConvertFrom-Json
      if ($mk.role_created_by_b1 -eq $true -and $mk.role_arn -eq $ROLE_ARN) { $ev.role_ownership = 'b1_created' }
      else { $ev.role_ownership = 'preexisting_unverified' }
    } else { $ev.role_ownership = 'preexisting_unverified' }
    Note "existing role matches approved JSON exactly (ownership=$($ev.role_ownership))."
  } else {
    Note "creating role $ROLE from approved trust.json"
    Invoke-Aws @('iam','create-role','--role-name',$ROLE,'--assume-role-policy-document',"file://$TRUST",
      '--description','Pilot CodeBuild service role (M1B-P1): scoped logs + build artifacts only',
      '--tags','Key=Project,Value=SafeBetIQ','Key=Environment,Value=Pilot','Key=ManagedBy,Value=M1B','Key=Purpose,Value=CodeBuild') | Out-Null
    Invoke-Aws @('iam','put-role-policy','--role-name',$ROLE,'--policy-name',$INLINE,'--policy-document',"file://$POLICY") | Out-Null
    # Persist ownership immediately so a later failure (or rollback) still knows B-1 created it.
    (@{ role_arn=$ROLE_ARN; role_created_by_b1=$true; created_at_utc=[DateTime]::UtcNow.ToString('o') } | ConvertTo-Json) | Set-Content $MARKER -Encoding ascii
    $ev.role_action = 'created'; $ev.role_ownership = 'b1_created'
    Note 'role + inline policy created; ownership marker written.'
  }
  # Common read-back assertions.
  $trustBack = (Invoke-AwsJson @('iam','get-role','--role-name',$ROLE,'--output','json')).Role.AssumeRolePolicyDocument
  if ($trustBack.Statement[0].Principal.Service -ne 'codebuild.amazonaws.com') { throw 'ABORT: trust principal is not codebuild.amazonaws.com.' }
  if (@((Invoke-AwsJson @('iam','list-attached-role-policies','--role-name',$ROLE,'--output','json')).AttachedPolicies).Count -ne 0) { throw 'ABORT: role has managed policies attached.' }
  $ev.role_arn = $ROLE_ARN
  Note 'role read-back OK: codebuild-only trust; inline-only; no managed/admin policy.'

  # ===== PASSROLE PHASE (resume-aware) =====
  $priorVer = (Invoke-AwsJson @('iam','get-policy','--policy-arn',$PROV_POL,'--output','json')).Policy.DefaultVersionId
  $ev.provisioner_prior_version = $priorVer
  $curDoc = Get-ProvDoc $priorVer
  $passArr = PassStmt $curDoc
  if (@($passArr).Count -ne 1) { throw "ABORT: expected exactly one iam:PassRole statement, found $(@($passArr).Count)." }
  $curPass = @($passArr[0].Resource)
  if ($curPass -contains '*') { throw 'ABORT: existing PassRole is wildcard - refusing to touch.' }
  foreach ($rq in @($EB_EC2,$EB_SVC)) { if ($curPass -notcontains $rq) { throw "ABORT: expected existing PassRole role missing: $rq" } }
  $unexpected = @($curPass | Where-Object { $_ -ne $ROLE_ARN -and $EXPECTED_EXISTING -notcontains $_ })
  if (@($unexpected).Count -ne 0) { throw "ABORT (drift): unexpected PassRole roles present: $($unexpected -join ', ')." }

  if ($curPass -contains $ROLE_ARN) {
    $ev.passrole_action = 'preexisting_verified'; $ev.provisioner_new_version = $priorVer
    Note 'PassRole already includes the Pilot CodeBuild role - PassRole phase already complete.'
  } else {
    # Build the additive candidate in memory (independent deep clone of the current default).
    $newDoc = ($curDoc | ConvertTo-Json -Depth 30) | ConvertFrom-Json
    $ni = -1; for ($i=0; $i -lt @($newDoc.Statement).Count; $i++){ if (@($newDoc.Statement[$i].Action) -contains 'iam:PassRole'){ $ni=$i } }
    $newDoc.Statement[$ni].Resource = @($curPass + $ROLE_ARN)
    # Prove the ONLY semantic change is adding exactly the Pilot role ARN.
    $newPass = @($newDoc.Statement[$ni].Resource)
    $added   = @($newPass | Where-Object { $curPass -notcontains $_ })
    $removed = @($curPass | Where-Object { $newPass -notcontains $_ })
    if (@($removed).Count -ne 0) { throw "ABORT: candidate removes roles: $($removed -join ', ')." }
    if (@($added).Count -ne 1 -or $added[0] -ne $ROLE_ARN) { throw "ABORT: candidate adds more than the Pilot role: $($added -join ', ')." }
    $probe = ($newDoc | ConvertTo-Json -Depth 30) | ConvertFrom-Json
    $probe.Statement[$ni].Resource = $curPass
    if ((CanonJson $probe) -ne (CanonJson $curDoc)) { throw 'ABORT: candidate changes more than the PassRole resource array.' }

    # Serialize + local JSON validation + UTF-8-no-BOM temp file (file:// transport, never inline arg).
    $json = $newDoc | ConvertTo-Json -Depth 30
    $null = $json | ConvertFrom-Json   # local syntactic validation; throws if invalid
    $tmpFile = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "sbiq-prov-$([guid]::NewGuid()).json")
    Write-Utf8NoBom $tmpFile $json
    if (([System.IO.File]::ReadAllBytes($tmpFile))[0] -eq 0xEF) { throw 'ABORT: temp policy file has a BOM.' }

    # Access Analyzer validate-policy BEFORE create-policy-version. Zero ERROR required; warnings recorded.
    $findings = @(Invoke-AwsJson @('accessanalyzer','validate-policy','--policy-type','IDENTITY_POLICY','--policy-document',"file://$tmpFile",'--query','findings','--output','json'))
    $ev.analyzer = [ordered]@{
      errors   = @($findings | Where-Object { $_.findingType -eq 'ERROR' } | ForEach-Object { $_.issueCode })
      warnings = @($findings | Where-Object { $_.findingType -in @('SECURITY_WARNING','WARNING') } | ForEach-Object { "$($_.findingType):$($_.issueCode)" })
    }
    if (@($ev.analyzer.errors).Count -ne 0) { throw "ABORT: Access Analyzer ERROR findings on candidate: $($ev.analyzer.errors -join ', ')." }
    if (@($ev.analyzer.warnings).Count -ne 0) { Note "Access Analyzer warnings (recorded, not ignored): $($ev.analyzer.warnings -join ', ')" }

    # Respect the 5-version limit (never delete the current default).
    $vers = @((Invoke-AwsJson @('iam','list-policy-versions','--policy-arn',$PROV_POL,'--output','json')).Versions)
    if ($vers.Count -ge 5) {
      $old = @($vers | Where-Object { -not $_.IsDefaultVersion } | Sort-Object CreateDate | Select-Object -First 1)
      if ($old) { Invoke-Aws @('iam','delete-policy-version','--policy-arn',$PROV_POL,'--version-id',$old.VersionId) | Out-Null; Note "pruned oldest non-default version $($old.VersionId)" }
    }
    # Mutate (throws on any non-zero exit - no false success possible).
    Invoke-Aws @('iam','create-policy-version','--policy-arn',$PROV_POL,'--policy-document',"file://$tmpFile",'--set-as-default') | Out-Null

    # Read back and CONFIRM before declaring success.
    $newVer = (Invoke-AwsJson @('iam','get-policy','--policy-arn',$PROV_POL,'--output','json')).Policy.DefaultVersionId
    if ($newVer -eq $priorVer) { throw 'ABORT: default version did not advance after create-policy-version.' }
    $chk = Get-ProvDoc $newVer
    $resN = @((PassStmt $chk)[0].Resource)
    if ($resN -contains '*') { throw 'ABORT: PassRole became wildcard.' }
    if ($resN -notcontains $ROLE_ARN) { throw 'ABORT: new Pilot CodeBuild role missing from PassRole.' }
    foreach ($rq in @($EB_EC2,$EB_SVC)) { if ($resN -notcontains $rq) { throw "ABORT: existing approved PassRole role was dropped: $rq" } }
    $iamAdmin = @($chk.Statement | Where-Object { @($_.Action) | Where-Object { $_ -match '^iam:(Create|Put|Attach|Delete|Update)' -and $_ -ne 'iam:PassRole' } })
    if (@($iamAdmin).Count -ne 0) { throw 'ABORT: policy now contains IAM administrative actions.' }
    $probe2 = ($chk | ConvertTo-Json -Depth 30) | ConvertFrom-Json
    $pi = -1; for ($i=0; $i -lt @($probe2.Statement).Count; $i++){ if (@($probe2.Statement[$i].Action) -contains 'iam:PassRole'){ $pi=$i } }
    $probe2.Statement[$pi].Resource = $curPass
    if ((CanonJson $probe2) -ne (CanonJson $curDoc)) { throw 'ABORT: applied version changed more than the PassRole resource.' }
    $ev.passrole_action = 'added'; $ev.provisioner_new_version = $newVer
    Note "provisioner PassRole amended and CONFIRMED (version $newVer; +Pilot CodeBuild role only)."
  }

  # ===== SIMULATIONS (only now, before finalising evidence) =====
  $ev.sim = [ordered]@{}
  $ev.sim.pos_passrole_pilot     = SimDecision $PROV_ROLE 'iam:PassRole' $ROLE_ARN
  $ev.sim.neg_passrole_unrelated = SimDecision $PROV_ROLE 'iam:PassRole' "arn:aws:iam::$($B1.Account):role/OrganizationAccountAccessRole"
  if ($ev.sim.pos_passrole_pilot -ne 'allowed') { throw "ABORT: positive PassRole simulation = $($ev.sim.pos_passrole_pilot)." }
  if ($ev.sim.neg_passrole_unrelated -eq 'allowed') { throw 'ABORT: provisioner can PassRole an unrelated role.' }
  $ev.sim.cb_demo_secret    = SimDecision $ROLE_ARN 'secretsmanager:GetSecretValue' "arn:aws:secretsmanager:eu-west-1:$($B1.Account):secret:safebet-iq/demo/x"
  $ev.sim.cb_prod_secret    = SimDecision $ROLE_ARN 'secretsmanager:GetSecretValue' "arn:aws:secretsmanager:eu-west-1:$($B1.Account):secret:safebet-iq/prod/x"
  $ev.sim.cb_route53        = SimDecision $ROLE_ARN 'route53:ChangeResourceRecordSets' 'arn:aws:route53:::hostedzone/Z08227093UE2VXI2FU58S'
  $ev.sim.cb_eb_deploy      = SimDecision $ROLE_ARN 'elasticbeanstalk:UpdateEnvironment' '*'
  $ev.sim.cb_iam_createrole = SimDecision $ROLE_ARN 'iam:CreateRole' '*'
  foreach ($k in 'cb_demo_secret','cb_prod_secret','cb_route53','cb_eb_deploy','cb_iam_createrole') {
    if ($ev.sim[$k] -eq 'allowed') { throw "ABORT: CodeBuild role unexpectedly allowed $k." }
  }
  Note 'simulations OK (provisioner PassRole positive/negative; CodeBuild role denied secrets/DNS/EB/IAM).'

  # ===== EVIDENCE (ONLY after every check above has passed) =====
  $ev.timestamp_utc = [DateTime]::UtcNow.ToString('o')
  $ev | ConvertTo-Json -Depth 8 | Set-Content $EVIDENCE -Encoding ascii
  Note "non-secret evidence written -> $EVIDENCE"
  Write-Host "B-1 APPLY COMPLETE (role=$($ev.role_action); passrole=$($ev.passrole_action); verified; simulated)."
}
finally {
  if ($tmpFile -and (Test-Path $tmpFile)) { Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue }
  Clear-MfaSession
  Write-Host '[B1] temp policy file removed (if any); temporary MFA session credentials cleared.'
}
