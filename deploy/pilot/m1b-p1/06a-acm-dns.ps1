# Phase 6a — ACM certificate (eu-west-1, DNS-validated) for pilot.safebetiq.com + Route53 validation record.
# AWS-mutating. Runs under SafeBetIQPilotProvisioner only. Route53 writes ONLY to Z08227093UE2VXI2FU58S.
. "$PSScriptRoot/00-common-guards.ps1"
Assert-AwsProvisionerIdentity
Assert-Region
Assert-Zone $SBIQ.Zone

$fqdn = $SBIQ.Hostname
Assert-NotForbidden @($fqdn)

# Idempotent: reuse an existing cert for the host if present.
$arn = aws acm list-certificates --certificate-statuses PENDING_VALIDATION ISSUED `
  --query "CertificateSummaryList[?DomainName=='$fqdn'].CertificateArn | [0]" --output text
if (-not $arn -or $arn -eq 'None') {
  Write-Host "requesting ACM certificate for $fqdn (eu-west-1, DNS validation) …"
  $arn = aws acm request-certificate --domain-name $fqdn --validation-method DNS `
    --tags Key=Project,Value=SafeBetIQ Key=Environment,Value=Pilot Key=ManagedBy,Value=M1B `
    --query CertificateArn --output text
  Start-Sleep -Seconds 5
}
Write-Host "certificate: $arn"

# Fetch the DNS validation record and upsert it in the authoritative zone only.
$rr = aws acm describe-certificate --certificate-arn $arn `
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord' --output json | ConvertFrom-Json
if (-not $rr) { throw 'ACM validation record not yet available; re-run in a moment.' }
Assert-Zone $SBIQ.Zone
$change = @{ Changes = @(@{ Action='UPSERT'; ResourceRecordSet = @{ Name=$rr.Name; Type=$rr.Type; TTL=300; ResourceRecords=@(@{ Value=$rr.Value }) } }) } | ConvertTo-Json -Depth 6
$tmp = New-TemporaryFile; $change | Set-Content $tmp -Encoding utf8
aws route53 change-resource-record-sets --hosted-zone-id $SBIQ.Zone --change-batch "file://$tmp" | Out-Null
Remove-Item $tmp -Force
Write-Host "validation CNAME upserted in $($SBIQ.Zone); waiting for ISSUED …"
aws acm wait certificate-validated --certificate-arn $arn
Write-Host "ACM certificate ISSUED: $arn"

# Record the cert ARN for 06d (ALB HTTPS listener).
$ctxPath = Join-Path $PSScriptRoot 'pilot-context.json'; $ctx = Get-Content $ctxPath | ConvertFrom-Json
$ctx | Add-Member -NotePropertyName acm_certificate_arn -NotePropertyValue $arn -Force
$ctx | ConvertTo-Json | Set-Content $ctxPath -Encoding utf8

# ROLLBACK: aws acm delete-certificate --certificate-arn <arn> (after detaching from the ALB);
#           remove the validation CNAME from Z08227093 (UPSERT->DELETE the same record).
