#!/usr/bin/env node
/**
 * SafeBet IQ — Amplify CDK App Entry Point
 * ==========================================
 * Deploys the SafeBetAmplifyStack (demo + prod Amplify apps + WAF).
 * This app is intentionally SEPARATE from bin/safebet.ts (DR infrastructure)
 * to allow independent deploys and avoid accidental cross-stack interference.
 *
 * PREREQUISITES (run once before first deploy):
 *
 *   1. Bootstrap us-east-1 (if not already done for DR stacks):
 *        npx cdk bootstrap aws://ACCOUNT/us-east-1
 *
 *   2. Store the GitHub personal access token in SSM:
 *        aws ssm put-parameter \
 *          --name /safebet/github-token \
 *          --type SecureString \
 *          --value "ghp_XXXXXXXXXXXXXXXXXXXX" \
 *          --region us-east-1
 *        (Token needs: repo, admin:repo_hook scopes)
 *
 *   3. Deploy:
 *        npx cdk deploy SafeBetAmplify \
 *          --app "npx ts-node --prefer-ts-exts bin/safebet-amplify.ts" \
 *          --context account=046276255259 \
 *          --context demoSupabaseUrl=https://uexdjngogzunjxkpxwll.supabase.co \
 *          --context demoSupabaseAnonKey=eyJhbGci... \
 *          --context prodSupabaseUrl=https://ilibvipqbkugqkppzdmh.supabase.co \
 *          --context prodSupabaseAnonKey=eyJhbGci... \
 *          --context drS3Bucket=safebetiq-backups-046276255259-eu-north-1 \
 *          --require-approval never
 *
 * POST-DEPLOY (see WafWebAclArn + DemoAppId + ProdAppId stack outputs):
 *   aws amplify associate-web-acl \
 *     --app-id <DemoAppId> --web-acl-arn <WafWebAclArn> --region us-east-1
 *   aws amplify associate-web-acl \
 *     --app-id <ProdAppId> --web-acl-arn <WafWebAclArn> --region us-east-1
 *
 * SECRETS (set via Amplify Console — NOT here):
 *   SUPABASE_SERVICE_ROLE_KEY, TWILIO_*, SAFEPLAY_* → add with "Secret" toggle
 */

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SafeBetAmplifyStack }      from '../lib/safebet-amplify-stack';
import { getEnvTag, commonTags, CONFIG } from '../lib/shared-config';

const app = new cdk.App();

/* ── Required context ─────────────────────────────────────────────────── */
const account = (app.node.tryGetContext('account') as string | undefined)
  ?? process.env.CDK_DEFAULT_ACCOUNT;

if (!account) {
  throw new Error(
    '\n❌  AWS account ID is required.\n' +
    '    Pass it with: --context account=YOUR_ACCOUNT_ID\n' +
    '    Example: 046276255259\n',
  );
}

/* ── GitHub ───────────────────────────────────────────────────────────── */
const githubOwner         = (app.node.tryGetContext('githubOwner')        as string | undefined) ?? 'SafeBetIQ';
const githubRepo          = (app.node.tryGetContext('githubRepo')         as string | undefined) ?? 'SafeBetdemo-main';
const githubTokenParamName = (app.node.tryGetContext('githubTokenParam')  as string | undefined) ?? '/safebet/github-token';

/* ── Supabase public keys (NEXT_PUBLIC_* — safe to pass as context) ──── */
const demoSupabaseUrl     = (app.node.tryGetContext('demoSupabaseUrl')     as string | undefined) ?? '';
const demoSupabaseAnonKey = (app.node.tryGetContext('demoSupabaseAnonKey') as string | undefined) ?? '';
const prodSupabaseUrl     = (app.node.tryGetContext('prodSupabaseUrl')     as string | undefined) ?? '';
const prodSupabaseAnonKey = (app.node.tryGetContext('prodSupabaseAnonKey') as string | undefined) ?? '';

/* ── DR env vars (sourced from SafeBetDRTrigger / SafeBetDRAlarm outputs) */
const drAwsRegion      = (app.node.tryGetContext('drAwsRegion')      as string | undefined) ?? CONFIG.REPLICA_REGION;
const drS3Region       = (app.node.tryGetContext('drS3Region')       as string | undefined) ?? CONFIG.TRIGGER_REGION;
const drS3Bucket       = (app.node.tryGetContext('drS3Bucket')       as string | undefined) ?? '';
const drLogGroup       = (app.node.tryGetContext('drLogGroup')       as string | undefined) ?? '/aws/lambda/safebet-rds-failover';
const drCwNamespace    = (app.node.tryGetContext('drCwNamespace')    as string | undefined) ?? CONFIG.CW_NAMESPACE;
const drHealthCheckId  = (app.node.tryGetContext('drHealthCheckId')  as string | undefined) ?? '';

/* ── Validation warnings ─────────────────────────────────────────────── */
if (!demoSupabaseUrl || !demoSupabaseAnonKey) {
  console.warn(
    '\n⚠️  Demo Supabase context not provided — NEXT_PUBLIC_SUPABASE_URL/ANON_KEY will be empty.\n' +
    '   Pass: --context demoSupabaseUrl=https://... --context demoSupabaseAnonKey=eyJ...\n',
  );
}
if (!prodSupabaseUrl || !prodSupabaseAnonKey) {
  console.warn(
    '\n⚠️  Prod Supabase context not provided — NEXT_PUBLIC_SUPABASE_URL/ANON_KEY will be empty.\n' +
    '   Pass: --context prodSupabaseUrl=https://... --context prodSupabaseAnonKey=eyJ...\n',
  );
}
if (!drS3Bucket) {
  console.warn(
    '\n⚠️  drS3Bucket not provided — DR_S3_BUCKET env var will be empty in prod app.\n' +
    `   Expected: safebetiq-backups-${account}-eu-north-1\n` +
    '   Pass: --context drS3Bucket=safebetiq-backups-ACCOUNT-eu-north-1\n',
  );
}

/* ── Tags ─────────────────────────────────────────────────────────────── */
const deployEnv = (app.node.tryGetContext('env') as string | undefined) ?? 'Production';
const envTag    = getEnvTag(deployEnv);
const baseTags  = commonTags(envTag);

console.log(`\n[SafeBet Amplify CDK] account=${account}  region=us-east-1  env=${envTag}\n`);

/* ── Stack ───────────────────────────────────────────────────────────── */
new SafeBetAmplifyStack(app, 'SafeBetAmplify', {
  // WAF CLOUDFRONT scope requires us-east-1 — Amplify apps co-located here.
  env:                  { account, region: 'us-east-1' },
  description:          'SafeBet IQ — Amplify Hosting (demo + prod) + WAF WebACL',
  terminationProtection: true,
  tags:                 baseTags,

  githubOwner,
  githubRepo,
  githubTokenParamName,

  demoSupabaseUrl,
  demoSupabaseAnonKey,

  prodSupabaseUrl,
  prodSupabaseAnonKey,

  drAwsRegion,
  drS3Region,
  drS3Bucket:       drS3Bucket    || undefined,
  drLogGroup:       drLogGroup    || undefined,
  drCwNamespace:    drCwNamespace || undefined,
  drHealthCheckId:  drHealthCheckId || undefined,
});

/* ── Global tags ─────────────────────────────────────────────────────── */
for (const [k, v] of Object.entries(baseTags)) {
  cdk.Tags.of(app).add(k, v);
}
