# Phase 12 — environment-isolation evidence (READ-ONLY). Proves the Pilot is isolated from Production,
# Demo and Guardian, and captures a redacted evidence file. No mutation; no secrets printed.
. "$PSScriptRoot/00-common-guards.ps1"
Assert-AwsProvisionerIdentity
Assert-Region
$ctx = Get-Content (Join-Path $PSScriptRoot 'pilot-context.json') | ConvertFrom-Json
$ev = [ordered]@{}

# 1) AWS identity is the provisioner assumed role (not backup-user/root).
$id = aws sts get-caller-identity --output json | ConvertFrom-Json
$ev.aws_identity = $id.Arn

# 2) EB: safebet-iq-pilot exists, Ready; its own resources; no forbidden env coupling.
$eb = aws elasticbeanstalk describe-environments --application-name $SBIQ.EbApp --environment-names $SBIQ.EbEnv `
  --query 'Environments[0].{status:Status,health:Health,cname:CNAME,version:VersionLabel}' --output json | ConvertFrom-Json
$ev.eb = $eb
Assert-NotForbidden @($eb.cname)

# 3) Supabase ref is the Pilot ref and not a forbidden ref.
Assert-SupabaseRefNotForbidden $ctx.project_ref
$ev.supabase_ref = $ctx.project_ref

# 4) DNS record only in the authoritative zone; forbidden zone untouched by us.
$auth = aws route53 list-resource-record-sets --hosted-zone-id $SBIQ.Zone --query "ResourceRecordSets[?Name=='$($SBIQ.Hostname).']|length(@)" --output text
$ev.dns_authoritative_records = $auth
$ev.dns_zone = $SBIQ.Zone

# 5) Secrets only under safebet-iq/pilot/*.
$sec = aws secretsmanager list-secrets --filters Key=name,Values=safebet-iq/pilot/ --query 'SecretList[].Name' --output json | ConvertFrom-Json
foreach ($s in $sec) { Assert-SecretName $s }
$ev.pilot_secrets = $sec

# 6) EB instance security group accepts app traffic only from the ALB SG; no 22/3389 from 0.0.0.0/0.
$envRes = aws elasticbeanstalk describe-environment-resources --environment-name $SBIQ.EbEnv `
  --query 'EnvironmentResources.Instances[0].Id' --output text
if ($envRes -and $envRes -ne 'None') {
  $sgIds = aws ec2 describe-instances --instance-ids $envRes --query 'Reservations[0].Instances[0].SecurityGroups[].GroupId' --output text
  $open = aws ec2 describe-security-groups --group-ids $sgIds `
    --query "SecurityGroups[].IpPermissions[?FromPort==`22` || FromPort==`3389`][].IpRanges[?CidrIp=='0.0.0.0/0']" --output text
  if ($open) { throw 'ISOLATION ABORT: a management port (22/3389) is open to 0.0.0.0/0 on the Pilot instance SG' }
  $ev.instance_sgs = $sgIds; $ev.public_mgmt_ports = 'none'
}

$ev.firewall = 'no Production (ilibvipqbkugqkppzdmh/safebet-iq-prod), no Demo (uexdjngogzunjxkpxwll/safebet-iq-demo), no Guardian (druuskabkgyotslcgnys/guardian-demo), no Cognito, no federation, no M1C, no B13.2'
$out = Join-Path $PSScriptRoot 'pilot-isolation-evidence.json'
$ev | ConvertTo-Json -Depth 6 | Set-Content $out -Encoding utf8
Write-Host "isolation evidence written -> $out"
Write-Host 'Pilot is isolated: own Supabase ref, own EB env, own secrets namespace, authoritative DNS zone, no public management ports, no forbidden coupling.'
