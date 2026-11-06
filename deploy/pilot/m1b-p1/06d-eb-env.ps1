# Phase 6d — create the EB environment safebet-iq-pilot (load-balanced, ALB, Node20 AL2023, min 1).
# AWS-mutating; provisioner identity only. DEPENDS ON 07 (application version) + 06a (ACM cert).
# Deploys the Pilot application version with the 5 Pilot env vars and HTTPS via the ACM cert.
. "$PSScriptRoot/00-common-guards.ps1"
Assert-AwsProvisionerIdentity
Assert-Region
Assert-EbEnvName $SBIQ.EbEnv

$ctx = Get-Content (Join-Path $PSScriptRoot 'pilot-context.json') | ConvertFrom-Json
if (-not $ctx.app_version_label) { throw 'EB ABORT: no app_version_label — run 07-deploy-app.ps1 first.' }
if (-not $ctx.acm_certificate_arn) { throw 'EB ABORT: no acm_certificate_arn — run 06a-acm-dns.ps1 first.' }
Assert-NotForbidden @($ctx.supabase_url, $ctx.anon_key, $ctx.app_version_label)

# Resolve the latest Node.js 20 on Amazon Linux 2023 solution stack (no hardcoded patch version).
$stack = aws elasticbeanstalk list-available-solution-stacks `
  --query "SolutionStacks[?contains(@,'Amazon Linux 2023') && contains(@,'Node.js 20')] | [0]" --output text
if (-not $stack -or $stack -eq 'None') { throw 'EB ABORT: no Node.js 20 / Amazon Linux 2023 solution stack found in eu-west-1.' }
Write-Host "solution stack: $stack"

# Option settings: load-balanced ALB, min 1 (autoscaling-capable), small 2GB-class instance (t3.small),
# default VPC, instance profile + service role, HTTPS:443 via ACM, HTTP:80 kept for ALB health/redirect,
# and the 5 Pilot application env vars. No SSH key, no public management ports.
$opts = @(
  @{ Namespace='aws:elasticbeanstalk:environment'; OptionName='EnvironmentType'; Value='LoadBalanced' },
  @{ Namespace='aws:elasticbeanstalk:environment'; OptionName='LoadBalancerType'; Value='application' },
  @{ Namespace='aws:elasticbeanstalk:environment'; OptionName='ServiceRole'; Value='aws-elasticbeanstalk-service-role' },
  @{ Namespace='aws:autoscaling:launchconfiguration'; OptionName='IamInstanceProfile'; Value='aws-elasticbeanstalk-ec2-role' },
  @{ Namespace='aws:autoscaling:launchconfiguration'; OptionName='InstanceType'; Value='t3.small' },   # 2 GB class
  @{ Namespace='aws:autoscaling:launchconfiguration'; OptionName='DisableIMDSv1'; Value='true' },
  @{ Namespace='aws:autoscaling:asg'; OptionName='MinSize'; Value='1' },
  @{ Namespace='aws:autoscaling:asg'; OptionName='MaxSize'; Value='2' },
  @{ Namespace='aws:elasticbeanstalk:application'; OptionName='Application Healthcheck URL'; Value='/api/version' },
  @{ Namespace='aws:elbv2:listener:443'; OptionName='ListenerEnabled'; Value='true' },
  @{ Namespace='aws:elbv2:listener:443'; OptionName='Protocol'; Value='HTTPS' },
  @{ Namespace='aws:elbv2:listener:443'; OptionName='SSLCertificateArns'; Value=$ctx.acm_certificate_arn },
  @{ Namespace='aws:elasticbeanstalk:application:environment'; OptionName='NEXT_PUBLIC_ENV'; Value='pilot' },
  @{ Namespace='aws:elasticbeanstalk:application:environment'; OptionName='NEXT_PUBLIC_SAFEBET_ENV'; Value='pilot' },
  @{ Namespace='aws:elasticbeanstalk:application:environment'; OptionName='SAFEBET_OPERATING_MODE'; Value='production' },
  @{ Namespace='aws:elasticbeanstalk:application:environment'; OptionName='NEXT_PUBLIC_SAFEBET_OPERATING_MODE'; Value='production' },
  @{ Namespace='aws:elasticbeanstalk:application:environment'; OptionName='ENABLE_DEMO_QUICK_LOGIN'; Value='false' },
  @{ Namespace='aws:elasticbeanstalk:application:environment'; OptionName='NEXT_PUBLIC_SUPABASE_URL'; Value=$ctx.supabase_url },
  @{ Namespace='aws:elasticbeanstalk:application:environment'; OptionName='NEXT_PUBLIC_SUPABASE_ANON_KEY'; Value=$ctx.anon_key }
) | ConvertTo-Json -Depth 5
$tmp = New-TemporaryFile; $opts | Set-Content $tmp -Encoding utf8

Write-Host "creating EB environment $($SBIQ.EbEnv) (default VPC; no new NAT gateway) …"
aws elasticbeanstalk create-environment --application-name $SBIQ.EbApp --environment-name $SBIQ.EbEnv `
  --solution-stack-name "$stack" --version-label $ctx.app_version_label `
  --option-settings "file://$tmp" `
  --tags Key=Project,Value=SafeBetIQ Key=Environment,Value=Pilot Key=ManagedBy,Value=M1B | Out-Null
Remove-Item $tmp -Force
Write-Host 'waiting for environment to go Ready …'
aws elasticbeanstalk wait environment-updated --application-name $SBIQ.EbApp --environment-names $SBIQ.EbEnv
Write-Host "EB environment $($SBIQ.EbEnv) created."

# pilot.safebetiq.com -> ALB alias, ONLY in the authoritative zone Z08227093.
Assert-Zone $SBIQ.Zone
$albArn = aws elasticbeanstalk describe-environment-resources --environment-name $SBIQ.EbEnv `
  --query 'EnvironmentResources.LoadBalancers[0].Name' --output text
$alb = aws elbv2 describe-load-balancers --load-balancer-arns $albArn `
  --query 'LoadBalancers[0].{dns:DNSName,zone:CanonicalHostedZoneId}' --output json | ConvertFrom-Json
if (-not $alb.dns) { throw 'DNS ABORT: could not resolve the Pilot ALB DNS name.' }
$batch = @{ Changes=@(@{ Action='UPSERT'; ResourceRecordSet=@{ Name=$SBIQ.Hostname; Type='A';
  AliasTarget=@{ HostedZoneId=$alb.zone; DNSName=$alb.dns; EvaluateTargetHealth=$true } } }) } | ConvertTo-Json -Depth 7
$tmp2 = New-TemporaryFile; $batch | Set-Content $tmp2 -Encoding utf8
aws route53 change-resource-record-sets --hosted-zone-id $SBIQ.Zone --change-batch "file://$tmp2" | Out-Null
Remove-Item $tmp2 -Force
Write-Host "upserted $($SBIQ.Hostname) A-alias -> $($alb.dns) in $($SBIQ.Zone)."
Write-Host "NOTE: security groups — instance SG accepts app traffic only from the ALB SG; no SSH/RDP/public management ports (EB-managed default; verified in 12-isolation-evidence)."
# ROLLBACK: terminate-environment safebet-iq-pilot ; DELETE the pilot.safebetiq.com alias from Z08227093.
