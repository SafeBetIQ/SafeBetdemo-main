# ============================================================
# SafeBet IQ — Elastic Beanstalk Deployment (PowerShell)
# Run from repo root: .\deploy.ps1
# Requires: node 18+, npm, 7-Zip or PowerShell 5+, aws CLI
# ============================================================

$APP_NAME     = "safebet-iq-app"
$ENV_NAME     = "safebet-iq-prod"
$S3_BUCKET    = "safebet-iq-deployments"
$REGION       = "af-south-1"    # change to your AWS region
$VERSION_LABEL = "safebet-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
$ZIP_FILE     = "app.zip"

Write-Host ""
Write-Host "========================================"
Write-Host " SafeBet IQ — EB Deployment"
Write-Host " Version: $VERSION_LABEL"
Write-Host " Region:  $REGION"
Write-Host "========================================"
Write-Host ""

# ── Step 1: Full install + build ──────────────────────────────
Write-Host "-> [1/6] Installing dependencies..."
Set-Location frontend
npm ci
if ($LASTEXITCODE -ne 0) { Write-Error "npm ci failed"; exit 1 }

Write-Host "-> [2/6] Building Next.js app..."
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "Build failed"; exit 1 }

Write-Host ""
Write-Host "-> Build output (.next must exist):"
Get-ChildItem .next | Select-Object Name, Length
Write-Host ""

# ── Step 2: Swap to production deps ───────────────────────────
Write-Host "-> [3/6] Trimming to production dependencies..."
Remove-Item -Recurse -Force node_modules
npm ci --omit=dev --ignore-scripts
if ($LASTEXITCODE -ne 0) { Write-Error "Production install failed"; exit 1 }

$nodeSize = (Get-ChildItem node_modules -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host "-> node_modules: $([math]::Round($nodeSize, 0)) MB"

# ── Step 3: Package ───────────────────────────────────────────
Write-Host ""
Write-Host "-> [4/6] Creating deployment package..."
Set-Location ..

if (Test-Path $ZIP_FILE) { Remove-Item $ZIP_FILE }

# Use Compress-Archive — excludes secrets, keeps node_modules
$exclude = @('.env.local','.env.production','.env.demo','.env.example','*.log')

# Compress entire frontend folder contents
$frontendItems = Get-ChildItem frontend -Force | Where-Object {
    $_.Name -notin $exclude -and
    $_.Name -ne '.git'
}

# Create temp staging dir to zip from correct root
$stage = "$env:TEMP\safebet-stage"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory $stage | Out-Null

foreach ($item in $frontendItems) {
    Copy-Item $item.FullName "$stage\" -Recurse -Force
}

Compress-Archive -Path "$stage\*" -DestinationPath $ZIP_FILE -Force
Remove-Item $stage -Recurse -Force

$zipMB = [math]::Round((Get-Item $ZIP_FILE).Length / 1MB, 1)
Write-Host "-> Package: $ZIP_FILE ($zipMB MB)"

if ($zipMB -eq 0) {
    Write-Error "Zip is empty. Aborting."
    exit 1
}

# ── Step 4: Upload + deploy ───────────────────────────────────
Write-Host ""
Write-Host "-> [5/6] Uploading to S3..."
aws s3 cp $ZIP_FILE "s3://$S3_BUCKET/$VERSION_LABEL/$ZIP_FILE" --region $REGION
if ($LASTEXITCODE -ne 0) { Write-Error "S3 upload failed"; exit 1 }

aws elasticbeanstalk create-application-version `
    --application-name $APP_NAME `
    --version-label $VERSION_LABEL `
    --source-bundle "S3Bucket=$S3_BUCKET,S3Key=$VERSION_LABEL/$ZIP_FILE" `
    --region $REGION
if ($LASTEXITCODE -ne 0) { Write-Error "create-application-version failed"; exit 1 }

Write-Host ""
Write-Host "-> [6/6] Deploying to Elastic Beanstalk..."
aws elasticbeanstalk update-environment `
    --application-name $APP_NAME `
    --environment-name $ENV_NAME `
    --version-label $VERSION_LABEL `
    --region $REGION
if ($LASTEXITCODE -ne 0) { Write-Error "Deployment failed"; exit 1 }

Write-Host ""
Write-Host "========================================"
Write-Host " Deployment triggered: $VERSION_LABEL"
Write-Host " Monitor:"
Write-Host "   aws elasticbeanstalk describe-events --environment-name $ENV_NAME --region $REGION"
Write-Host "========================================"
