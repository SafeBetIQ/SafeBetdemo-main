# SafeBet IQ - Elastic Beanstalk Demo deployment
# Usage: pwsh ./deploy-demo.ps1  (run from repo root)

$ErrorActionPreference = "Stop"

$APP    = "safebet-iq-app"
$ENV    = "safebet-iq-demo"
$S3     = "safebet-iq-deployments-eu"
$REGION = "eu-west-1"
$VER    = "safebet-demo-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
$ZIP    = "app-demo.zip"
$ROOT   = $PSScriptRoot

Write-Host ""
Write-Host "=== SafeBet IQ Demo - Deploying $VER ==="
Write-Host ""

# --- 1. Install ---
Write-Host "[1/4] Installing dependencies..."
npm ci
if ($LASTEXITCODE) { throw "npm ci failed" }

# --- 2. Build ---
Write-Host "[2/4] Building Next.js (demo)..."
$env:NEXT_PUBLIC_ENV = "demo"
npm run build
if ($LASTEXITCODE) { throw "npm run build failed" }

if (-not (Test-Path ".next/standalone/server.js")) {
    throw "standalone server.js not found — ensure next.config.js has output: 'standalone'"
}

# Merge full .next output into standalone/.next (skip standalone/ and cache/)
Get-ChildItem ".next" | Where-Object { $_.Name -notin @('standalone', 'cache') } |
    ForEach-Object { Copy-Item $_.FullName -Destination ".next/standalone/.next/" -Recurse -Force }

if (Test-Path "public") {
    Copy-Item "public" ".next/standalone/public" -Recurse -Force
}

# --- 3. Package ---
Write-Host "[3/4] Packaging..."
Remove-Item "$ROOT/$ZIP" -ErrorAction Ignore

# Swap in a zero-dep package.json so EB's post-deploy npm install is a no-op
$pkgPath = (Resolve-Path "package.json").Path
$realPkgBytes = [System.IO.File]::ReadAllBytes($pkgPath)
$minPkg = [System.Text.Encoding]::ASCII.GetBytes('{"name":"safebet-iq-demo","version":"1.0.0","private":true}')
[System.IO.File]::WriteAllBytes($pkgPath, $minPkg)

# Strip source maps to keep bundle small
Get-ChildItem ".next/standalone" -Recurse -Filter "*.map" -File | Remove-Item -Force

tar --exclude="./.next/standalone/.next/cache" -a -c -f "$ROOT/$ZIP" `
    ./Procfile ./next.config.js ./.next/standalone ./.ebextensions ./package.json
$tarExit = $LASTEXITCODE

# Restore real package.json byte-for-byte
[System.IO.File]::WriteAllBytes($pkgPath, $realPkgBytes)

if ($tarExit) { throw "tar packaging failed" }
$mb = [math]::Round((Get-Item "$ROOT/$ZIP").Length / 1MB, 1)
Write-Host "   ${mb} MB"

# --- 4. Upload & deploy ---
Write-Host "[4/4] Deploying to Elastic Beanstalk ($ENV / $REGION)..."

aws s3 cp "$ROOT/$ZIP" "s3://$S3/$VER/$ZIP" --region $REGION
if ($LASTEXITCODE) { throw "S3 upload failed" }

aws elasticbeanstalk create-application-version `
    --application-name $APP `
    --version-label $VER `
    --source-bundle "S3Bucket=$S3,S3Key=$VER/$ZIP" `
    --region $REGION
if ($LASTEXITCODE) { throw "create-application-version failed" }

aws elasticbeanstalk update-environment `
    --application-name $APP `
    --environment-name $ENV `
    --version-label $VER `
    --region $REGION
if ($LASTEXITCODE) { throw "update-environment failed" }

Write-Host ""
Write-Host "=== Deployed: $VER ==="
Write-Host "Monitor: aws elasticbeanstalk describe-events --environment-name $ENV --region $REGION"
