# Phase 6c — Pilot CodeBuild project (safebet-iq-pilot-node20-build). AWS-mutating; provisioner identity only.
# REQUIRES the dedicated service role safebet-iq-pilot-codebuild-role (created out-of-band by an admin — see
# iam/provisioner-passrole-amendment.md). This script does NOT create IAM and FAILS CLOSED if the role is
# missing or the provisioner cannot PassRole it. Build source is the S3 artifact uploaded by 07-deploy-app.ps1.
. "$PSScriptRoot/00-common-guards.ps1"
Assert-AwsProvisionerIdentity
Assert-Region

$project = $SBIQ.CodeBuildProject
$roleArn = "arn:aws:iam::$($SBIQ.Account):role/$($SBIQ.CodeBuildRole)"
$bucket  = 'safebet-iq-pilot-build'
Assert-NotForbidden @($project, $roleArn, $bucket)

# Pre-req: dedicated role must exist (IAM is out of provisioner scope; do NOT create it here).
$exists = aws iam get-role --role-name $SBIQ.CodeBuildRole --query 'Role.Arn' --output text 2>$null
if (-not $exists -or $exists -eq 'None') {
  throw "CODEBUILD ABORT: $($SBIQ.CodeBuildRole) does not exist. Create it via the out-of-band IAM step (iam/provisioner-passrole-amendment.md) and amend SafeBetIQPilotProvisionerPolicy PassRole BEFORE running this. Do NOT weaken IAM to proceed."
}

# Pilot build bucket (scoped to safebet-iq-pilot-*; versioned).
aws s3api head-bucket --bucket $bucket 2>$null
if ($LASTEXITCODE -ne 0) {
  aws s3api create-bucket --bucket $bucket --region $SBIQ.Region --create-bucket-configuration LocationConstraint=$SBIQ.Region | Out-Null
  aws s3api put-bucket-versioning --bucket $bucket --versioning-configuration Status=Enabled | Out-Null
  aws s3api put-public-access-block --bucket $bucket --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true | Out-Null
  aws s3api put-bucket-tagging --bucket $bucket --tagging 'TagSet=[{Key=Project,Value=SafeBetIQ},{Key=Environment,Value=Pilot}]' | Out-Null
  Write-Host "created build bucket $bucket (private, versioned)"
}

# Archive is rooted at the app dir (git archive 3b18faa:SafeBetdemo-main/), so the buildspec is at deploy/…
$src = @{ type='S3'; location="$bucket/source/safebet-iq-pilot-$($SBIQ.AppCommit).zip"; buildspec='deploy/buildspec-pilot.yml' } | ConvertTo-Json -Compress
$art = @{ type='S3'; location=$bucket; path='artifact'; namespaceType='BUILD_ID'; packaging='ZIP'; name='pilot-eb-bundle' } | ConvertTo-Json -Compress
$envc = @{ type='LINUX_CONTAINER'; image='aws/codebuild/amazonlinux2-x86_64-standard:5.0'; computeType='BUILD_GENERAL1_SMALL' } | ConvertTo-Json -Compress

$have = aws codebuild batch-get-projects --names $project --query 'projects[0].name' --output text 2>$null
if ($have -eq $project) {
  aws codebuild update-project --name $project --service-role $roleArn --source $src --artifacts $art --environment $envc | Out-Null
  Write-Host "updated CodeBuild project $project"
} else {
  aws codebuild create-project --name $project --service-role $roleArn --source $src --artifacts $art --environment $envc `
    --tags Key=Project,Value=SafeBetIQ Key=Environment,Value=Pilot Key=ManagedBy,Value=M1B | Out-Null
  Write-Host "created CodeBuild project $project (service role $($SBIQ.CodeBuildRole))"
}
# ROLLBACK: aws codebuild delete-project --name safebet-iq-pilot-node20-build ; (optionally) empty+delete bucket.
