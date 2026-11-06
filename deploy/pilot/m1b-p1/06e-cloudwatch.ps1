# Phase 6e — CloudWatch for the Pilot: CodeBuild log group + minimal EB health alarms.
# AWS-mutating; provisioner identity only. eu-west-1.
. "$PSScriptRoot/00-common-guards.ps1"
Assert-AwsProvisionerIdentity
Assert-Region

# CodeBuild log group (matches the dedicated role's allowed resource).
$lg = "/aws/codebuild/$($SBIQ.CodeBuildProject)"
if ((aws logs describe-log-groups --log-group-name-prefix $lg --query "logGroups[?logGroupName=='$lg'] | length(@)" --output text) -eq '0') {
  aws logs create-log-group --log-group-name $lg | Out-Null
  aws logs put-retention-policy --log-group-name $lg --retention-in-days 30 | Out-Null
  Write-Host "created log group $lg (30d retention)"
}

# Minimal EB environment-health alarm (Severe) for safebet-iq-pilot.
$alarm = 'safebet-iq-pilot-eb-health-severe'
aws cloudwatch put-metric-alarm --alarm-name $alarm `
  --namespace 'AWS/ElasticBeanstalk' --metric-name EnvironmentHealth `
  --dimensions Name=EnvironmentName,Value=$($SBIQ.EbEnv) `
  --statistic Maximum --period 300 --evaluation-periods 2 --threshold 20 `
  --comparison-operator GreaterThanOrEqualToThreshold --treat-missing-data notBreaching `
  --tags Key=Project,Value=SafeBetIQ Key=Environment,Value=Pilot | Out-Null
Write-Host "put alarm $alarm (EB EnvironmentHealth >= Degraded)"
# ROLLBACK: aws cloudwatch delete-alarms --alarm-names safebet-iq-pilot-eb-health-severe ;
#           aws logs delete-log-group --log-group-name /aws/codebuild/safebet-iq-pilot-node20-build
