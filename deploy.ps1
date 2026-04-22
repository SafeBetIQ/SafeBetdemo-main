# ============================================================
# SafeBet IQ -- Elastic Beanstalk Deployment (PowerShell)
# Run from repo root: .\deploy.ps1
# Requires: node 18+, npm, PowerShell 5.1+, AWS CLI configured
# ============================================================

$ErrorActionPreference = "Stop"

$APP_NAME      = "safebet-iq-app"
$ENV_NAME      = "safebet-iq-prod"
$S3_BUCKET     = "safebet-iq-deployments-eu"
$REGION        = "eu-west-1"
$VERSION_LABEL = "safebet-" + (Get-Date -Format "yyyyMMdd-HHmmss")
$ZIP_FILE      = "app.zip"
$REPO_ROOT     = $PSScriptRoot

Write-Host ""
Write-Host "========================================"
Write-Host " SafeBet IQ -- EB Deployment"
Write-Host " Version : $VERSION_LABEL"
Write-Host " Region  : $REGION"
Write-Host "========================================"
Write-Host ""

# ── Step 1: Install dependencies (dev deps needed for build) ──────
Write-Host "-> [1/6] Installing dependencies..."
Push-Location (Join-Path $REPO_ROOT "frontend")

if (Test-Path "package-lock.json") {
    Write-Host "   package-lock.json found -- using npm ci"
    npm ci
    if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }
} else {
    Write-Host "   package-lock.json not found -- using npm install"
    npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
}

# ── Step 2: Build Next.js app ─────────────────────────────────────
Write-Host "-> [2/6] Building Next.js app..."
npm run build
if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }

# Verify the build actually produced output — fail loudly if not
$buildId = Join-Path ".next" "BUILD_ID"
if (-not (Test-Path $buildId)) {
    throw ".next/BUILD_ID not found after build -- build output is missing. Cannot deploy."
}
Write-Host "   Build ID: $(Get-Content $buildId)"
Write-Host "   .next contents:"
Get-ChildItem ".next" | Select-Object -Property Name | Format-Table -HideTableHeaders
Write-Host ""

# ── Step 3: Trim to production-only node_modules ──────────────────
Write-Host "-> [3/6] Trimming to production dependencies..."
Remove-Item -Path "node_modules" -Recurse -Force

if (Test-Path "package-lock.json") {
    Write-Host "   Using npm ci --omit=dev"
    npm ci --omit=dev --ignore-scripts
    if ($LASTEXITCODE -ne 0) { throw "npm ci (prod) failed" }
} else {
    Write-Host "   Using npm install --omit=dev"
    npm install --omit=dev --ignore-scripts
    if ($LASTEXITCODE -ne 0) { throw "npm install (prod) failed" }
}

$nodeMB = [math]::Round(
    (Get-ChildItem "node_modules" -Recurse -ErrorAction SilentlyContinue |
     Measure-Object -Property Length -Sum).Sum / 1MB, 0)
Write-Host "-> node_modules size: ${nodeMB} MB"

Pop-Location

# ── Step 4: Package ZIP from frontend/ contents ───────────────────
Write-Host ""
Write-Host "-> [4/6] Creating deployment package..."

if (Test-Path $ZIP_FILE) {
    Remove-Item -Path $ZIP_FILE -Force
}

$stage = Join-Path $env:TEMP "safebet-deploy-stage"
if (Test-Path $stage) {
    Remove-Item -Path $stage -Recurse -Force
}
New-Item -ItemType Directory -Path $stage | Out-Null

$skipNames = @(".env.local", ".env.production", ".env.demo", ".env.example", ".git")

$frontendPath = Join-Path $REPO_ROOT "frontend"
Get-ChildItem -Path $frontendPath -Force |
    Where-Object { $skipNames -notcontains $_.Name -and $_.Name -notlike "*.log" } |
    ForEach-Object { Copy-Item -Path $_.FullName -Destination $stage -Recurse -Force }

# Verify critical files are in the staging directory before zipping
$required = @(".next", "package.json", "Procfile", "node_modules")
foreach ($item in $required) {
    $itemPath = Join-Path $stage $item
    if (-not (Test-Path $itemPath)) {
        throw "Required item missing from deployment package: $item -- aborting"
    }
    Write-Host "   [OK] $item"
}

Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $ZIP_FILE -Force
Remove-Item -Path $stage -Recurse -Force

$zipMB = [math]::Round((Get-Item $ZIP_FILE).Length / 1MB, 1)
Write-Host "-> Package: $ZIP_FILE (${zipMB} MB)"

if ($zipMB -eq 0) {
    throw "Zip is empty -- aborting deploy"
}

# ── Step 5: Upload to S3 ──────────────────────────────────────────
Write-Host ""
Write-Host "-> [5/6] Uploading to S3..."

$s3Key = "$VERSION_LABEL/$ZIP_FILE"

$s3Args = @(
    "s3", "cp", $ZIP_FILE,
    "s3://$S3_BUCKET/$s3Key",
    "--region", $REGION
)
& aws @s3Args
if ($LASTEXITCODE -ne 0) { throw "S3 upload failed" }

$versionArgs = @(
    "elasticbeanstalk", "create-application-version",
    "--application-name", $APP_NAME,
    "--version-label",    $VERSION_LABEL,
    "--source-bundle",    "S3Bucket=$S3_BUCKET,S3Key=$s3Key",
    "--region",           $REGION
)
& aws @versionArgs
if ($LASTEXITCODE -ne 0) { throw "create-application-version failed" }

# ── Step 6: Trigger EB deployment ────────────────────────────────
Write-Host ""
Write-Host "-> [6/6] Deploying to Elastic Beanstalk..."

$deployArgs = @(
    "elasticbeanstalk", "update-environment",
    "--application-name",  $APP_NAME,
    "--environment-name",  $ENV_NAME,
    "--version-label",     $VERSION_LABEL,
    "--region",            $REGION
)
& aws @deployArgs
if ($LASTEXITCODE -ne 0) { throw "EB deployment trigger failed" }

Write-Host ""
Write-Host "========================================"
Write-Host " Deployment triggered: $VERSION_LABEL"
Write-Host " Wait ~3 minutes, then test:"
Write-Host "   curl http://<your-eb-url>/api/health"
Write-Host " Monitor with:"
Write-Host "   aws elasticbeanstalk describe-events --environment-name $ENV_NAME --region $REGION"
Write-Host "========================================"
