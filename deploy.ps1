# SafeBet IQ - Elastic Beanstalk deployment
# Usage: .\deploy.ps1  (run from repo root)

$ErrorActionPreference = "Stop"

$APP    = "safebet-iq-app"
$ENV    = "safebet-iq-prod"
$S3     = "safebet-iq-deployments-eu"
$REGION = "eu-west-1"
$VER    = "safebet-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
$ZIP    = "app.zip"
$ROOT   = $PSScriptRoot

Write-Host ""
Write-Host "=== SafeBet IQ - Deploying $VER ==="
Write-Host ""

# --- 1. Install & build ---
Push-Location (Join-Path $ROOT "frontend")

# Strip UTF-8 BOM from package.json if present — some Windows tools add it
# and both npm and webpack reject it as invalid JSON.
$pkgPath = (Resolve-Path "package.json").Path
$pkgBytes = [System.IO.File]::ReadAllBytes($pkgPath)
if ($pkgBytes.Length -ge 3 -and $pkgBytes[0] -eq 0xEF -and $pkgBytes[1] -eq 0xBB -and $pkgBytes[2] -eq 0xBF) {
    [System.IO.File]::WriteAllBytes($pkgPath, $pkgBytes[3..($pkgBytes.Length - 1)])
    Write-Host "   Stripped UTF-8 BOM from package.json"
}

Write-Host "[1/5] Installing dependencies..."
npm install
if ($LASTEXITCODE) { Pop-Location; throw "npm install failed" }

Write-Host "[2/5] Building Next.js..."
npm run build
$buildExit = $LASTEXITCODE

if (-not (Test-Path ".next/standalone/server.js")) {
    Pop-Location
    throw "standalone server.js not found - check next.config.js output: 'standalone'"
}

if ($buildExit) {
    Write-Host "   Warning: build had prerender errors (Windows path issue) - standalone exists, continuing"
}

# Next.js 13.5.x only creates prerender-manifest.js; the standalone server needs the full JSON
# structure with version/routes/dynamicRoutes/notFoundRoutes/preview.
if (Test-Path ".next\prerender-manifest.js") {
    $pmPreview = node -e "var self={}; eval(require('fs').readFileSync('.next/prerender-manifest.js','utf8')); process.stdout.write(self.__PRERENDER_MANIFEST)"
    if ($LASTEXITCODE -eq 0 -and $pmPreview) {
        $fullManifest = "{`"version`":4,`"routes`":{},`"dynamicRoutes`":{},`"notFoundRoutes`":[],`"preview`":$pmPreview}"
        [System.IO.File]::WriteAllBytes(".next\prerender-manifest.json", [System.Text.Encoding]::UTF8.GetBytes($fullManifest))
        Write-Host "   Created prerender-manifest.json"
    }
}

# Merge the full .next build output into standalone/.next (skip standalone/ and cache/)
Get-ChildItem ".next" | Where-Object { $_.Name -notin @('standalone','cache') } |
    ForEach-Object { Copy-Item $_.FullName -Destination ".next\standalone\.next\" -Recurse -Force }
Copy-Item "public" ".next\standalone\public" -Recurse -Force

# --- 2. Fix Windows backslash paths in server bundles ---
# Next.js built on Windows embeds require('next/dist\client\...') which
# fails on Linux. Replace all next/dist\ separators with next/dist/.
Write-Host "[3/5] Fixing Windows path separators..."
$fixed = 0
foreach ($f in (Get-ChildItem ".next" -Recurse -Include "*.js" -File)) {
    $c = [System.IO.File]::ReadAllText($f.FullName)
    if ($c -notmatch 'next/dist\\') { continue }
    $n = $c
    for ($i = 0; $i -lt 6; $i++) {
        $n = $n -replace '(next/dist[/a-zA-Z0-9._-]*)\\+([a-zA-Z0-9._-])', '$1/$2'
    }
    if ($n -ne $c) {
        [System.IO.File]::WriteAllText($f.FullName, $n)
        $fixed++
    }
}
Write-Host "   $fixed file(s) patched."

Pop-Location

# --- 3. Package ---
Write-Host "[4/5] Packaging..."
Remove-Item $ZIP -ErrorAction Ignore
Push-Location (Join-Path $ROOT "frontend")

# Temporarily replace package.json with a zero-dep version so EB's mandatory
# npm install step exits immediately instead of OOM-killing the instance.
# Windows built-in tar.exe does not support --transform for rename-in-archive.
# Use WriteAllBytes to avoid the UTF-8 BOM that Set-Content -Encoding utf8 adds
# (EB's Go JSON parser rejects the BOM as invalid character 'i').
$pkgPath = (Resolve-Path "package.json").Path
$realPkgBytes = [System.IO.File]::ReadAllBytes($pkgPath)
$minPkg = [System.Text.Encoding]::ASCII.GetBytes('{"name":"safebet-iq","version":"1.0.0","private":true}')
[System.IO.File]::WriteAllBytes($pkgPath, $minPkg)

tar --exclude="./.next/cache" -a -c -f "../$ZIP" `
    ./Procfile ./next.config.js ./.next ./public ./.ebextensions ./package.json
$te = $LASTEXITCODE

# Restore real package.json byte-for-byte regardless of tar exit code
[System.IO.File]::WriteAllBytes($pkgPath, $realPkgBytes)
Pop-Location

if ($te) { throw "tar packaging failed" }
$mb = [math]::Round((Get-Item $ZIP).Length / 1MB, 1)
Write-Host "   ${mb} MB"

# --- 4. Upload & deploy ---
Write-Host "[5/5] Deploying to Elastic Beanstalk ($REGION)..."

aws s3 cp $ZIP "s3://$S3/$VER/$ZIP" --region $REGION
if ($LASTEXITCODE) { throw "S3 upload failed" }

aws elasticbeanstalk create-application-version `
    --application-name $APP --version-label $VER `
    --source-bundle "S3Bucket=$S3,S3Key=$VER/$ZIP" --region $REGION
if ($LASTEXITCODE) { throw "create-application-version failed" }

aws elasticbeanstalk update-environment `
    --application-name $APP --environment-name $ENV `
    --version-label $VER --region $REGION
if ($LASTEXITCODE) { throw "update-environment failed" }

Write-Host ""
Write-Host "=== Deployed: $VER ==="
Write-Host "Monitor: aws elasticbeanstalk describe-events --environment-name $ENV --region $REGION"
