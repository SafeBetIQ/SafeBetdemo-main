# SafeBet IQ — M1B-P1 shared guards (dot-source at the top of EVERY script).
# Fail-closed identity/environment/firewall assertions. No cloud mutation here.
#
#   . "$PSScriptRoot/00-common-guards.ps1"
#   Assert-AwsProvisionerIdentity      # AWS scripts only
#   Assert-Region
#
# NEVER prints secrets. NEVER permits a fallback identity.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ── Authorities (M1B-P1) ─────────────────────────────────────────────────────
$script:SBIQ = [ordered]@{
  Account             = '046276255259'
  Region              = 'eu-west-1'
  ProvisionerArnLike  = 'arn:aws:sts::046276255259:assumed-role/SafeBetIQPilotProvisioner/*'
  EbApp               = 'safebet-iq-app'
  EbEnv               = 'safebet-iq-pilot'
  Hostname            = 'pilot.safebetiq.com'
  Zone                = 'Z08227093UE2VXI2FU58S'
  ForbiddenZone       = 'Z01182572Y0Z0TTVHEY28'
  SecretsPrefix       = 'safebet-iq/pilot/'
  AppCommit           = '3b18faa4343eee30576aa4f3ac132ac2176c9713'
  SchemaSourceCommit  = '379141e45c7f6f9db1888ebaebfa45fbf86a993e'
  CanonicalSha        = '530941a513216c056eab18e182be09f3d0fe803955c7c7315ccd36123b9fa182'
  DerivativeSha       = 'c2125accccc133172357a36d96b343f0d42dcc3d07695e56089950dd01512067'
  Fingerprint         = '5f324b14ea87dec4601b0586bc4a4726be83ebceae3112253ba2db838ca55f49'
  ManifestSha         = 'ea03c077605e3fdecd88377f251cc2f10810f4ed6f52addf662007e1c65f27e6'
  SupabaseOrg         = 'fhttwsuoliasybqkacrm'
  CodeBuildProject    = 'safebet-iq-pilot-node20-build'
  CodeBuildRole       = 'safebet-iq-pilot-codebuild-role'
}
# Forbidden project refs / environment names (Production, Demo, Guardian). Any appearance aborts.
$script:SBIQ_FORBIDDEN = @(
  'ilibvipqbkugqkppzdmh',            # Supabase Production
  'uexdjngogzunjxkpxwll',            # Supabase Demo
  'druuskabkgyotslcgnys',            # Supabase Guardian
  'safebet-iq-prod', 'safebet-iq-demo', 'guardian-demo',
  'Z01182572Y0Z0TTVHEY28'            # non-authoritative duplicate zone
)

function Write-Guard([string]$m) { Write-Host "[guard] $m" }

function Assert-AwsProvisionerIdentity {
  # Hard-fail unless the CURRENT credentials are the SafeBetIQPilotProvisioner assumed role.
  Write-Guard 'verifying AWS caller identity …'
  $id = aws sts get-caller-identity --output json | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0 -or -not $id) { throw 'Assert-AwsProvisionerIdentity: sts:GetCallerIdentity failed' }
  if ($id.Account -ne $SBIQ.Account) { throw "IDENTITY ABORT: account $($id.Account) != $($SBIQ.Account)" }
  if ($id.Arn -notlike $SBIQ.ProvisionerArnLike) {
    throw "IDENTITY ABORT: caller '$($id.Arn)' is not assumed-role/SafeBetIQPilotProvisioner/*. Refusing (no fallback to safebetiq-backup-user / root / any other identity)."
  }
  Write-Guard "identity OK: $($id.Arn)"
}

function Assert-Region {
  $r = $env:AWS_REGION; if (-not $r) { $r = $env:AWS_DEFAULT_REGION }
  if (-not $r) { $r = (aws configure get region) }
  if ($r -ne $SBIQ.Region) { throw "REGION ABORT: region '$r' != $($SBIQ.Region). Set `$env:AWS_REGION='eu-west-1'." }
  Write-Guard "region OK: $r"
}

function Assert-NotForbidden([string[]]$Values) {
  foreach ($v in $Values) {
    if ([string]::IsNullOrEmpty($v)) { continue }
    foreach ($f in $SBIQ_FORBIDDEN) {
      if ($v -like "*$f*") { throw "FIREWALL ABORT: value contains forbidden identifier '$f' (Production/Demo/Guardian/duplicate-zone)." }
    }
  }
}

function Assert-Zone([string]$ZoneId) {
  if ($ZoneId -eq $SBIQ.ForbiddenZone) { throw "DNS ABORT: refusing the non-authoritative duplicate zone $($SBIQ.ForbiddenZone)." }
  if ($ZoneId -ne $SBIQ.Zone) { throw "DNS ABORT: Route53 writes are permitted ONLY in $($SBIQ.Zone) (got '$ZoneId')." }
}

function Assert-EbEnvName([string]$Name) {
  if ($Name -ne $SBIQ.EbEnv) { throw "EB ABORT: environment name '$Name' != $($SBIQ.EbEnv)." }
}

function Assert-SecretName([string]$Name) {
  if ($Name -notlike "$($SBIQ.SecretsPrefix)*") { throw "SECRETS ABORT: '$Name' is outside $($SBIQ.SecretsPrefix)*." }
}

function Assert-SupabaseRefNotForbidden([string]$Ref) {
  if ($Ref -notmatch '^[a-z]{20}$') { throw "SUPABASE ABORT: project ref '$Ref' is not a 20-letter ref." }
  Assert-NotForbidden @($Ref)
}

function Assert-AppCommit([string]$Commit) {
  if ($Commit -eq $SBIQ.SchemaSourceCommit) { throw "DEPLOY ABORT: $($SBIQ.SchemaSourceCommit) is the schema-source commit, not the application deployment authority." }
  if ($Commit -ne $SBIQ.AppCommit) { throw "DEPLOY ABORT: application commit '$Commit' != approved $($SBIQ.AppCommit)." }
}

# Never echo a secret. Helper that reads a secret from an env var and fails if missing/empty.
function Get-RequiredSecretEnv([string]$Name) {
  $val = [Environment]::GetEnvironmentVariable($Name)
  if ([string]::IsNullOrEmpty($val)) { throw "MISSING SECRET: environment variable $Name is not set (set it in THIS shell only; never commit it)." }
  return $val
}

Write-Guard 'common guards loaded (fail-closed; no fallback identity; no secret printing)'
