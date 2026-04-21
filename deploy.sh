#!/bin/bash
set -e

# ============================================================
# SafeBet IQ — Elastic Beanstalk Deployment Script
# Run from repo root: bash deploy.sh
# Requires: node 18+, npm, zip, aws CLI configured
# ============================================================

APP_NAME="safebet-iq-app"
ENV_NAME="safebet-iq-prod"
S3_BUCKET="safebet-iq-deployments"   # must exist before first run
REGION="af-south-1"                  # change to your AWS region
VERSION_LABEL="safebet-$(date +%Y%m%d-%H%M%S)"
ZIP_FILE="app.zip"

echo ""
echo "========================================"
echo " SafeBet IQ — EB Deployment"
echo " Version: $VERSION_LABEL"
echo " Region:  $REGION"
echo "========================================"
echo ""

# ── Step 1: Full install (dev deps needed for build) ─────────
cd frontend

echo "→ [1/6] Installing all dependencies..."
npm ci

# ── Step 2: Build ────────────────────────────────────────────
echo "→ [2/6] Building Next.js app..."
npm run build

echo ""
echo "→ Build output (.next must exist, /api/health route must be present):"
ls -la .next/
grep -r "api/health" .next/server/app/api/ 2>/dev/null && echo "✓ health route built" || echo "⚠ health route not found in build"
echo ""

# ── Step 3: Swap to production-only node_modules ─────────────
# This removes ~300MB of dev/build tools the running app never needs.
# EB will skip npm install because node_modules already exists in the zip.
echo "→ [3/6] Trimming to production dependencies..."
rm -rf node_modules
npm ci --omit=dev --ignore-scripts

echo "→ node_modules size: $(du -sh node_modules | cut -f1)"

# ── Step 4: Package ──────────────────────────────────────────
echo ""
echo "→ [4/6] Creating deployment package..."

cd ..
rm -f "$ZIP_FILE"

cd frontend

# Zip everything in frontend/ — node_modules included so EB never runs npm install.
# Explicitly exclude secrets and files EB doesn't need.
zip -r "../$ZIP_FILE" . \
  --exclude "*.git*" \
  --exclude "*.log" \
  --exclude ".env.local" \
  --exclude ".env.production" \
  --exclude ".env.demo" \
  --exclude ".env.example" \
  --exclude "*.DS_Store"

cd ..

ZIP_SIZE=$(du -sh "$ZIP_FILE" | cut -f1)
echo "→ Package: $ZIP_FILE ($ZIP_SIZE)"

if [ "$ZIP_SIZE" = "0" ]; then
  echo "ERROR: zip is empty. Aborting."
  exit 1
fi

# ── Step 5: Upload to S3 ─────────────────────────────────────
echo ""
echo "→ [5/6] Uploading to S3..."

aws s3 cp "$ZIP_FILE" "s3://$S3_BUCKET/$VERSION_LABEL/$ZIP_FILE" \
  --region "$REGION"

aws elasticbeanstalk create-application-version \
  --application-name "$APP_NAME" \
  --version-label "$VERSION_LABEL" \
  --source-bundle "S3Bucket=$S3_BUCKET,S3Key=$VERSION_LABEL/$ZIP_FILE" \
  --region "$REGION"

# ── Step 6: Deploy ───────────────────────────────────────────
echo ""
echo "→ [6/6] Deploying to Elastic Beanstalk..."

aws elasticbeanstalk update-environment \
  --application-name "$APP_NAME" \
  --environment-name "$ENV_NAME" \
  --version-label "$VERSION_LABEL" \
  --region "$REGION"

echo ""
echo "========================================"
echo " Deployment triggered: $VERSION_LABEL"
echo " Monitor:"
echo "   aws elasticbeanstalk describe-events \\"
echo "     --environment-name $ENV_NAME \\"
echo "     --region $REGION"
echo "========================================"
