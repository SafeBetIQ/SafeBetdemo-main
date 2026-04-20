/**
 * SafeBet IQ — Shared CDK Configuration
 * =======================================
 * Single source of truth for all resource identifiers, region names,
 * and naming conventions used across the DR stacks.
 *
 * HOW TO USE:
 *   import { CONFIG } from './shared-config';
 *
 * NAMING CONVENTION:
 *   All AWS resource names follow the pattern: safebet-{role}-{region-short}
 *   S3 bucket name embeds the account ID to guarantee global uniqueness.
 */

export const CONFIG = {
  /* ── Regions ─────────────────────────────────────────────────────────── */
  PRIMARY_REGION:  'af-south-1',   // Cape Town   — primary RDS, auto-failover Lambda
  REPLICA_REGION:  'eu-west-1',    // Ireland     — RDS replica, rds-failover Lambda, Route53
  TRIGGER_REGION:  'eu-north-1',   // Stockholm   — dr-trigger Lambda, S3 backup bucket, CW alarm
  ALARM_REGION:    'us-east-1',    // N. Virginia — CloudWatch alarm for Route53 health check ONLY
                                   //   Route53 CloudWatch metric health checks REQUIRE us-east-1

  /* ── RDS instance identifiers ────────────────────────────────────────── */
  PRIMARY_DB_ID:   'safebet-primary-capetown',
  REPLICA_DB_ID:   'safebet-replica-ireland',
  DB_NAME:         'safebet',
  DB_ADMIN_USER:   'safebet_admin',

  /* ── Lambda function names (must match existing code) ────────────────── */
  AUTO_FAILOVER_FN:  'safebet-auto-failover',   // af-south-1: S3→Supabase restore
  RDS_FAILOVER_FN:   'safebet-rds-failover',    // eu-west-1:  RDS promote + Route53
  DR_TRIGGER_FN:     'safebet-dr-trigger',      // eu-north-1: relay SNS → rds-failover

  /* ── S3 ──────────────────────────────────────────────────────────────── */
  s3BucketName(account: string): string {
    return `safebetiq-backups-${account}-eu-north-1`;
  },
  S3_BACKUP_PREFIX:   'backups/production',
  S3_DEMO_PREFIX:     'backups/demo',
  S3_MARKER_PREFIX:   'restore-complete',
  S3_DR_STATE_KEY:    'dr-state.json',

  /* ── CloudWatch ──────────────────────────────────────────────────────── */
  CW_NAMESPACE:        'SafeBetIQ/DR',
  CW_LOG_GROUP_BACKUP: 'safebet-backups',
  CW_METRIC_DB_HEALTH: 'DatabaseHealthy',
  CW_METRIC_FAILOVER:  'FailoverExecuted',

  /* ── SNS ─────────────────────────────────────────────────────────────── */
  SNS_TOPIC_NAME: 'safebet-dr-alerts',

  /* ── Secrets Manager ─────────────────────────────────────────────────── */
  SECRET_RDS_CREDS:      'safebet/rds/primary/credentials-v2',
  SECRET_SUPABASE_CREDS: 'safebet/supabase/credentials-v2',

  /* ── Route53 ─────────────────────────────────────────────────────────── */
  DB_RECORD_PREFIX: 'db',   // record → db.{hostedZoneName}
  DNS_TTL_SECONDS:  60,

  /* ── Tagging ─────────────────────────────────────────────────────────── */
  PROJECT_TAG:  'SafeBetIQ',
  // ENV_TAG is now derived per deployment via getEnvTag() — never hardcoded.

  /* ── Cost-control defaults ───────────────────────────────────────────── */
  RDS_INSTANCE_CLASS:    'db.t4g.micro',
  RDS_STORAGE_GB:        20,
  RDS_MAX_STORAGE_GB:    100,
  RDS_BACKUP_DAYS:       7,
  LAMBDA_MEMORY_MB:      256,
  LAMBDA_TIMEOUT_MIN:    15,
  LOG_RETENTION_DAYS:    30,
};

/** Short stack name → region lookup (used for resource naming) */
export const REGION_SHORT: Record<string, string> = {
  'af-south-1':  'cpt',   // Cape Town
  'eu-west-1':   'irl',   // Ireland
  'eu-north-1':  'sto',   // Stockholm
};

/**
 * Derive the environment tag from a CDK context value.
 * Pass --context env=production for production deployments.
 * Defaults to 'Demo' to prevent accidental production tags.
 */
export function getEnvTag(ctxEnv?: string): string {
  const valid = ['Demo', 'Production', 'Staging'];
  const raw   = ctxEnv ?? 'Demo';
  // Capitalise first letter for consistency with AWS tagging conventions
  const normalised = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  if (!valid.includes(normalised)) {
    console.warn(
      `[SafeBet CDK] Unknown --context env="${raw}" — valid values: ${valid.join(', ')}. Defaulting to "Demo".`
    );
    return 'Demo';
  }
  return normalised;
}

/** Standard tags applied to every resource in every stack */
export function commonTags(env: string): Record<string, string> {
  return {
    Project:     CONFIG.PROJECT_TAG,
    Environment: env,
    ManagedBy:   'CDK',
    Repository:  'SafeBetIQ/SafeBetdemo-main',
  };
}
