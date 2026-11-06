# Phase 7 — build + register the Pilot application version (commit 3b18faa). AWS-mutating; provisioner only.
# Model (owner decision 3): git archive 3b18faa:SafeBetdemo-main/ -> S3 -> Pilot CodeBuild -> EB app-version.
# DEPENDS ON 06c (CodeBuild project + bucket). 06d (create EB env) consumes the version label written here.
#
# NOTE / BLOCKER (see review): buildspec-pilot.yml enforces CODEBUILD_RESOLVED_SOURCE_VERSION==SAFEBET_GIT_COMMIT
# when CRSV is set. With an S3 source CRSV is an S3 version id, not a 40-hex commit, so a one-line M1B-P1F
# follow-up is required to gate that check on a 40-hex pattern. Do not weaken the guard here.
. "$PSScriptRoot/00-common-guards.ps1"
Assert-AwsProvisionerIdentity
Assert-Region
Assert-AppCommit $SBIQ.AppCommit

$ctx = Get-Content (Join-Path $PSScriptRoot 'pilot-context.json') | ConvertFrom-Json
$bucket = 'safebet-iq-pilot-build'
$srcKey = "source/safebet-iq-pilot-$($SBIQ.AppCommit).zip"
$repoRoot = Resolve-Path "$PSScriptRoot/../../.."

# 1) git archive the EXACT approved commit (app dir as archive root).
$zip = Join-Path ([IO.Path]::GetTempPath()) "safebet-iq-pilot-$($SBIQ.AppCommit).zip"
Write-Host "git archive $($SBIQ.AppCommit):SafeBetdemo-main/ -> $zip"
git -C $repoRoot archive --format=zip -o $zip "$($SBIQ.AppCommit):SafeBetdemo-main"
if ($LASTEXITCODE -ne 0) { throw 'git archive failed (is the commit present locally?)' }

# 2) upload source to the Pilot build bucket.
aws s3 cp $zip "s3://$bucket/$srcKey" | Out-Null
Remove-Item $zip -Force
Write-Host "uploaded source -> s3://$bucket/$srcKey"

# 3) start the Pilot build with the Pilot config as env overrides (NO service-role key).
$envOv = @(
  @{ name='NEXT_PUBLIC_ENV'; value='pilot' },
  @{ name='NEXT_PUBLIC_SAFEBET_ENV'; value='pilot' },
  @{ name='SAFEBET_OPERATING_MODE'; value='production' },
  @{ name='NEXT_PUBLIC_SAFEBET_OPERATING_MODE'; value='production' },
  @{ name='ENABLE_DEMO_QUICK_LOGIN'; value='false' },
  @{ name='SAFEBET_GIT_COMMIT'; value=$SBIQ.AppCommit },
  @{ name='NEXT_PUBLIC_SUPABASE_URL'; value=$ctx.supabase_url },
  @{ name='NEXT_PUBLIC_SUPABASE_ANON_KEY'; value=$ctx.anon_key }
) | ConvertTo-Json -Compress
foreach ($p in @($ctx.supabase_url,$ctx.anon_key)) { Assert-NotForbidden @([string]$p) }

$bid = aws codebuild start-build --project-name $SBIQ.CodeBuildProject `
  --source-location-override "$bucket/$srcKey" `
  --environment-variables-override $envOv --query 'build.id' --output text
Write-Host "build started: $bid ; waiting …"
do { Start-Sleep -Seconds 15
     $st = aws codebuild batch-get-builds --ids $bid --query 'builds[0].buildStatus' --output text
     Write-Host "  build status: $st"
} while ($st -eq 'IN_PROGRESS')
if ($st -ne 'SUCCEEDED') { throw "BUILD FAILED: $st (see CloudWatch /aws/codebuild/$($SBIQ.CodeBuildProject))" }

# 4) locate the EB bundle artifact produced by the buildspec and register an application version.
$artLoc = aws codebuild batch-get-builds --ids $bid --query 'builds[0].artifacts.location' --output text
# artLoc = arn:aws:s3:::<bucket>/<key> ; convert to S3Bucket/S3Key
$artPath = $artLoc -replace '^arn:aws:s3:::',''
$artBucket = $artPath.Split('/')[0]; $artKey = $artPath.Substring($artBucket.Length+1)
$label = "pilot-$($SBIQ.AppCommit.Substring(0,7))-$([DateTime]::UtcNow.ToString('yyyyMMddHHmmss'))"
aws elasticbeanstalk create-application-version --application-name $SBIQ.EbApp --version-label $label `
  --source-bundle "S3Bucket=$artBucket,S3Key=$artKey" --process `
  --tags Key=Project,Value=SafeBetIQ Key=Environment,Value=Pilot Key=Commit,Value=$($SBIQ.AppCommit) | Out-Null
Write-Host "registered EB application version: $label"

$ctx | Add-Member -NotePropertyName app_version_label -NotePropertyValue $label -Force
$ctx | ConvertTo-Json | Set-Content (Join-Path $PSScriptRoot 'pilot-context.json') -Encoding utf8
# ROLLBACK: aws elasticbeanstalk delete-application-version --application-name safebet-iq-app --version-label <label> --delete-source-bundle
