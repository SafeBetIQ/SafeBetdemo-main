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
$standaloneServer = Join-Path ".next" "standalone" | Join-Path -ChildPath "server.js"
if (-not (Test-Path $standaloneServer)) {
    throw ".next/standalone/server.js not found -- standalone build failed. Cannot deploy."
}
Write-Host "   Standalone server: $standaloneServer"

# Copy static assets into standalone so server.js can find them at runtime
Write-Host "   Copying static assets into standalone..."
Copy-Item -Path ".next\static" -Destination ".next\standalone\.next\static" -Recurse -Force
Copy-Item -Path "public"       -Destination ".next\standalone\public"        -Recurse -Force
Write-Host "   Static assets ready."
Write-Host ""

Pop-Location

# ── Step 4: Package ZIP from frontend/ contents ───────────────────
Write-Host ""
Write-Host "-> [4/6] Creating deployment package..."

# Verify critical files exist before zipping
$required = @(".next", "Procfile")
$frontendPath = Join-Path $REPO_ROOT "frontend"
foreach ($item in $required) {
    $itemPath = Join-Path $frontendPath $item
    if (-not (Test-Path $itemPath)) {
        throw "Required item missing from deployment package: $item -- aborting"
    }
    Write-Host "   [OK] $item"
}

# Use tar with an explicit file list so every required file is guaranteed
# at ZIP root with forward-slash paths (Compress-Archive uses backslashes).
# NOTE: package.json and package-lock.json are intentionally excluded.
#       Their presence triggers EB's automatic `npm install`, which takes
#       14+ minutes on t3.small and hits the deployment timeout.
#       The standalone build is self-contained: .next/standalone/node_modules/
#       has all runtime dependencies — no install step needed on the instance.
Remove-Item $ZIP_FILE -ErrorAction Ignore

Push-Location (Join-Path $REPO_ROOT "frontend")
# Exclude .next/cache (582 MB build cache, not needed at runtime).
# Its presence inflates the ZIP and causes 14-min EBS extraction on t3.small.
tar --exclude="./.next/cache" -a -c -f "../$ZIP_FILE" `
    ./Procfile `
    ./next.config.js `
    ./.next `
    ./public `
    ./.ebextensions
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "tar packaging failed" }

# Confirm ZIP root structure before uploading
Write-Host "-> ZIP root contents:"
tar -tf "../$ZIP_FILE" | Select-String "^[^/]+/?$" | Select-Object -First 20
Pop-Location

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
