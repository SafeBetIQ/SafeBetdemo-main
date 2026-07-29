#!/usr/bin/env bash
# SafeBet IQ — recreate the temporary Linux Node 20 CodeBuild pipeline and
# build + deploy the demo.safebetiq.com artifact to the `safebet-iq-demo`
# Elastic Beanstalk environment. Idempotent-ish: safe to re-run.
#
# Prereqs: aws CLI configured for account 046276255259; a zip tool that writes
# forward-slash paths (bsdtar / Windows tar.exe / Linux zip). NEVER pass the
# Supabase service-role key here — only NEXT_PUBLIC_* (public) values.
#
# Usage:
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=<demo anon key> ./deploy/codebuild-demo.sh
set -euo pipefail

REGION=eu-west-1
ACCOUNT=046276255259
APP=safebet-iq-app
ENVN=safebet-iq-demo
BUCKET=elasticbeanstalk-${REGION}-${ACCOUNT}
PROJECT=safebet-demo-node20-build
ROLE=SafeBetDemoCodeBuildRole
SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL:-https://uexdjngogzunjxkpxwll.supabase.co}   # DEMO project
ANON=${NEXT_PUBLIC_SUPABASE_ANON_KEY:?set NEXT_PUBLIC_SUPABASE_ANON_KEY (demo anon key)}
COMMIT=$(git rev-parse --short HEAD)
LABEL="demo-node20-$(date -u +%Y%m%d%H%M)-${COMMIT}"
KEY="codebuild/artifacts/${LABEL}.zip"

# 1. IAM role for CodeBuild (logs + S3 codebuild path only) — create if absent
if ! aws iam get-role --role-name "$ROLE" >/dev/null 2>&1; then
  aws iam create-role --role-name "$ROLE" --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"codebuild.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
  aws iam put-role-policy --role-name "$ROLE" --policy-name "${ROLE}Inline" --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":[\"logs:CreateLogGroup\",\"logs:CreateLogStream\",\"logs:PutLogEvents\"],\"Resource\":\"arn:aws:logs:${REGION}:${ACCOUNT}:log-group:/aws/codebuild/${PROJECT}*\"},{\"Effect\":\"Allow\",\"Action\":[\"s3:GetObject\",\"s3:GetObjectVersion\",\"s3:PutObject\",\"s3:GetBucketLocation\"],\"Resource\":[\"arn:aws:s3:::${BUCKET}\",\"arn:aws:s3:::${BUCKET}/codebuild/*\"]}]}"
  sleep 10  # allow role to propagate
fi

# 2. Source zip (forward slashes, no node_modules/.next/.env) → S3
#    This app is a nested subtree (git root is the parent dir), so archive the
#    subtree so package.json / deploy/buildspec.yml land at the ZIP root.
TMP=$(mktemp -d)
APP_SUBTREE=$(git rev-parse --show-prefix)          # e.g. "SafeBetdemo-main/" or "" if app is at root
git archive --format=zip -o "$TMP/src.zip" "HEAD:${APP_SUBTREE}"   # tracked files only, no secrets
aws s3 cp "$TMP/src.zip" "s3://${BUCKET}/codebuild/safebet-src.zip" --region "$REGION"

# 3. CodeBuild project (buildspec lives in the repo at deploy/buildspec.yml)
if ! aws codebuild batch-get-projects --names "$PROJECT" --region "$REGION" --query 'projects[0].name' --output text 2>/dev/null | grep -q "$PROJECT"; then
  aws codebuild create-project --name "$PROJECT" --region "$REGION" \
    --source "{\"type\":\"S3\",\"location\":\"${BUCKET}/codebuild/safebet-src.zip\",\"buildspec\":\"deploy/buildspec.yml\"}" \
    --artifacts "{\"type\":\"S3\",\"location\":\"${BUCKET}\",\"path\":\"codebuild/artifacts\",\"name\":\"${LABEL}.zip\",\"namespaceType\":\"NONE\",\"packaging\":\"ZIP\"}" \
    --environment "{\"type\":\"LINUX_CONTAINER\",\"image\":\"aws/codebuild/standard:7.0\",\"computeType\":\"BUILD_GENERAL1_MEDIUM\"}" \
    --service-role "arn:aws:iam::${ACCOUNT}:role/${ROLE}" --timeout-in-minutes 30
fi

# 4. Build (inject safe provenance + public Supabase values)
BID=$(aws codebuild start-build --project-name "$PROJECT" --region "$REGION" \
  --artifacts-override "{\"type\":\"S3\",\"location\":\"${BUCKET}\",\"path\":\"codebuild/artifacts\",\"name\":\"${LABEL}.zip\",\"namespaceType\":\"NONE\",\"packaging\":\"ZIP\",\"overrideArtifactName\":true}" \
  --environment-variables-override \
    "name=NEXT_PUBLIC_SUPABASE_URL,value=${SUPABASE_URL},type=PLAINTEXT" \
    "name=NEXT_PUBLIC_SUPABASE_ANON_KEY,value=${ANON},type=PLAINTEXT" \
    "name=SAFEBET_GIT_COMMIT,value=$(git rev-parse HEAD),type=PLAINTEXT" \
    "name=SAFEBET_EB_VERSION,value=${LABEL},type=PLAINTEXT" \
  --query build.id --output text)
echo "CodeBuild: $BID"
while [ "$(aws codebuild batch-get-builds --ids "$BID" --region "$REGION" --query 'builds[0].buildStatus' --output text)" = IN_PROGRESS ]; do sleep 15; done
aws codebuild batch-get-builds --ids "$BID" --region "$REGION" --query 'builds[0].buildStatus' --output text

# 5. Register EB application version + deploy (keeps prior versions for rollback)
aws elasticbeanstalk create-application-version --application-name "$APP" --version-label "$LABEL" \
  --source-bundle "S3Bucket=${BUCKET},S3Key=${KEY}" --region "$REGION"
aws elasticbeanstalk update-environment --application-name "$APP" --environment-name "$ENVN" \
  --version-label "$LABEL" --region "$REGION"
echo "Deploying $LABEL to $ENVN. Rollback: aws elasticbeanstalk update-environment --application-name $APP --environment-name $ENVN --version-label rc1-v20 --region $REGION"

# 6. Optional cleanup of the temporary pipeline (uncomment to remove after deploy):
# aws codebuild delete-project --name "$PROJECT" --region "$REGION"
# aws iam delete-role-policy --role-name "$ROLE" --policy-name "${ROLE}Inline"; aws iam delete-role --role-name "$ROLE"
