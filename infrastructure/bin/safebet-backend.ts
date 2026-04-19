#!/usr/bin/env node
/**
 * SafeBet IQ — Backend API CDK App
 * ====================================
 * Deploys SafeBetBackendStack independently of the DR stacks.
 * This app can be deployed without touching SafeBetDRPrimary/Replica/Alarm/Trigger.
 *
 * REQUIRED:
 *   cdk bootstrap aws://ACCOUNT/af-south-1   (already done for DR stacks)
 *
 * DEPLOY:
 *   cdk deploy SafeBetBackend \
 *     --app "npx ts-node --prefer-ts-exts bin/safebet-backend.ts" \
 *     --context account=046276255259 \
 *     --context cognitoUserPoolId=eu-west-1_XXXXXX \
 *     --context cognitoClientId=XXXXXXXXXXXXXXXXXXXXXXXXXX \
 *     --require-approval never
 *
 * OPTIONAL CONTEXT:
 *   --context cognitoRegion=eu-west-1
 *   --context allowedOrigin=https://app.safebetiq.com
 *
 * After deploy, copy ApiEndpoint output to:
 *   - Amplify environment variable: NEXT_PUBLIC_API_URL
 *   - Any frontend config referencing the API base URL
 */

import 'source-map-support/register';
import * as cdk                  from 'aws-cdk-lib';
import { SafeBetBackendStack }   from '../lib/safebet-backend-stack';
import { CONFIG, commonTags }    from '../lib/shared-config';

const app = new cdk.App();

/* ── Required context ─────────────────────────────────────────────── */
const account = app.node.tryGetContext('account') as string | undefined
  ?? process.env.CDK_DEFAULT_ACCOUNT;

if (!account) {
  throw new Error(
    '\n  AWS account ID is required.\n' +
    '    --context account=YOUR_ACCOUNT_ID\n',
  );
}

/* ── Optional context ─────────────────────────────────────────────── */
const cognitoUserPoolId = app.node.tryGetContext('cognitoUserPoolId') as string | undefined;
const cognitoClientId   = app.node.tryGetContext('cognitoClientId')   as string | undefined;
const cognitoRegion     = app.node.tryGetContext('cognitoRegion')     as string | undefined;
const allowedOrigin     = app.node.tryGetContext('allowedOrigin')     as string | undefined;

if (!cognitoUserPoolId || !cognitoClientId) {
  console.warn(
    '\n  Cognito context not provided — auth-service will skip JWT signature ' +
    'verification (audience/issuer checks disabled).\n' +
    '    --context cognitoUserPoolId=eu-west-1_XXXXX\n' +
    '    --context cognitoClientId=XXXXXXXXXXXXXXXX\n',
  );
}

/* ── Stack ────────────────────────────────────────────────────────── */
new SafeBetBackendStack(app, 'SafeBetBackend', {
  env: {
    account,
    region: CONFIG.PRIMARY_REGION,   // af-south-1 — co-located with primary RDS
  },
  description:           'SafeBet IQ - Backend API (Lambda + API Gateway)',
  terminationProtection: false,
  tags:                  commonTags(CONFIG.ENV_TAG),

  account,
  cognitoUserPoolId,
  cognitoClientId,
  cognitoRegion,
  allowedOrigin,
});

/* ── Global tags ──────────────────────────────────────────────────── */
cdk.Tags.of(app).add('Project',     CONFIG.PROJECT_TAG);
cdk.Tags.of(app).add('ManagedBy',   'CDK');
cdk.Tags.of(app).add('Environment', CONFIG.ENV_TAG);
