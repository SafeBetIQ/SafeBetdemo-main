# Phase 8 — enforce + verify the 5 Pilot application environment variables on safebet-iq-pilot.
# AWS-mutating (idempotent); provisioner identity only. 06d already sets these at create; this re-asserts
# and reads back, so the running app is guaranteed to carry the Pilot config.
. "$PSScriptRoot/00-common-guards.ps1"
Assert-AwsProvisionerIdentity
Assert-Region
Assert-EbEnvName $SBIQ.EbEnv

$pilotVars = @{
  NEXT_PUBLIC_ENV='pilot'; NEXT_PUBLIC_SAFEBET_ENV='pilot';
  SAFEBET_OPERATING_MODE='production'; NEXT_PUBLIC_SAFEBET_OPERATING_MODE='production';
  ENABLE_DEMO_QUICK_LOGIN='false'
}
$opts = ($pilotVars.GetEnumerator() | ForEach-Object {
  @{ Namespace='aws:elasticbeanstalk:application:environment'; OptionName=$_.Key; Value=$_.Value }
}) | ConvertTo-Json -Depth 5
$tmp = New-TemporaryFile; $opts | Set-Content $tmp -Encoding utf8
aws elasticbeanstalk update-environment --environment-name $SBIQ.EbEnv --option-settings "file://$tmp" | Out-Null
Remove-Item $tmp -Force
aws elasticbeanstalk wait environment-updated --environment-names $SBIQ.EbEnv

# Read back + assert exactly (identity-provider vars must remain UNSET).
$set = aws elasticbeanstalk describe-configuration-settings --application-name $SBIQ.EbApp --environment-name $SBIQ.EbEnv `
  --query "ConfigurationSettings[0].OptionSettings[?Namespace=='aws:elasticbeanstalk:application:environment']" --output json | ConvertFrom-Json
foreach ($k in $pilotVars.Keys) {
  $got = ($set | Where-Object OptionName -eq $k).Value
  if ($got -ne $pilotVars[$k]) { throw "ENV ABORT: $k='$got' != '$($pilotVars[$k])'" }
}
foreach ($bad in @('SAFEBET_IDENTITY_PROVIDER','NEXT_PUBLIC_SAFEBET_IDENTITY_PROVIDER','SUPABASE_SERVICE_ROLE_KEY')) {
  if ($set | Where-Object OptionName -eq $bad) { throw "ENV ABORT: $bad must NOT be set on the Pilot environment" }
}
Write-Host 'Pilot env vars verified: NEXT_PUBLIC_ENV=pilot, NEXT_PUBLIC_SAFEBET_ENV=pilot, SAFEBET_OPERATING_MODE=production, NEXT_PUBLIC_SAFEBET_OPERATING_MODE=production, ENABLE_DEMO_QUICK_LOGIN=false. Identity provider + service-role key UNSET.'
