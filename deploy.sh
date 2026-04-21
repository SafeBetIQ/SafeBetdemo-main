#!/bin/bash
set -e

# ============================================================
# SafeBet IQ — Elastic Beanstalk Deployment Script
# Run from repo root: bash deploy.sh
# Requires: node, npm, zip, aws CLI configured
# ============================================================

APP_NAME="safebet-iq-app"
ENV_NAME="safebet-iq-prod"
S3_BUCKET="safebet-iq-deployments"          # must exist — see step 4
REGION="af-south-1"                          # change to your region
VERSION_LABEL="safebet-$(date +%Y%m%d-%H%M%S)"
ZIP_FILE="app.zip"

echo ""
echo "========================================"
echo " SafeBet IQ — EB Deployment"
echo " Version: $VERSION_LABEL"
echo " Region:  $REGION"
echo "========================================"
echo ""

# ── Step 1: Build ────────────────────────────────────────────
echo "→ [1/5] Installing dependencies..."
npm ci --prefix frontend

echo "→ [2/5] Building Next.js app..."
npm run build --prefix frontend

echo ""
echo "→ Build output:"
ls -la frontend/.next/

# ── Step 2: Package ──────────────────────────────────────────
echo ""
echo "→ [3/5] Creating deployment package..."

rm -f "$ZIP_FILE"

cd frontend

zip -r "../$ZIP_FILE" . \
  --exclude "node_modules/*" \
  --exclude ".git/*" \
  --exclude "*.log" \
  --exclude ".env.local" \
  --exclude ".env.production" \
  --exclude ".env.demo" \
  --exclude ".env.example"

cd ..

echo "→ Package size: $(du -sh $ZIP_FILE | cut -f1)"

# ── Step 3: Upload to S3 ──────────────────────────────────────
echo ""
echo "→ [4/5] Uploading to S3..."

aws s3 cp "$ZIP_FILE" "s3://$S3_BUCKET/$VERSION_LABEL/$ZIP_FILE" \
  --region "$REGION"

# ── Step 4: Create application version ───────────────────────
aws elasticbeanstalk create-application-version \
  --application-name "$APP_NAME" \
  --version-label "$VERSION_LABEL" \
  --source-bundle "S3Bucket=$S3_BUCKET,S3Key=$VERSION_LABEL/$ZIP_FILE" \
  --region "$REGION"

# ── Step 5: Deploy ────────────────────────────────────────────
echo ""
echo "→ [5/5] Deploying to Elastic Beanstalk..."

aws elasticbeanstalk update-environment \
  --application-name "$APP_NAME" \
  --environment-name "$ENV_NAME" \
  --version-label "$VERSION_LABEL" \
  --region "$REGION"

echo ""
echo "========================================"
echo " Deployment triggered: $VERSION_LABEL"
echo " Monitor at:"
echo " https://$REGION.console.aws.amazon.com/elasticbeanstalk"
echo "========================================"
