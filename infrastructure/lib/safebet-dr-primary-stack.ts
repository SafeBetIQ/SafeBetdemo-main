/**
 * SafeBet IQ — DR Primary Stack  (af-south-1, Cape Town)
 * =========================================================
 * Provisions the PRIMARY side of the DR system:
 *
 *   • VPC           — isolated subnets for RDS (no NAT, no cost)
 *   • RDS           — PostgreSQL 15 t4g.micro primary instance
 *                     Multi-AZ enabled for HA within Cape Town
 *   • Secrets Mgr   — imported RDS + Supabase credentials (no plaintext)
 *   • Lambda        — safebet-auto-failover (S3 → Supabase restore)
 *   • IAM role      — least-privilege role for auto-failover Lambda
 *   • CloudWatch    — Log group for Lambda execution
 *   • SNS           — DR alert topic
 *
 * SECURITY:
 *   Supabase credentials are stored in Secrets Manager under
 *   CONFIG.SECRET_SUPABASE_CREDS and read by the Lambda at runtime
 *   via GetSecretValue.  They are NEVER present as plaintext env vars.
 *
 * OUTPUTS (copy to Amplify env vars after deploy):
 *   PrimaryDbEndpoint   — RDS writer endpoint
 *   PrimaryDbIdentifier — RDS instance ID
 *   PrimaryDbSecretArn  — Secrets Manager ARN for DB creds
 *   AutoFailoverLambdaArn
 */

import * as cdk          from 'aws-cdk-lib';
import * as ec2          from 'aws-cdk-lib/aws-ec2';
import * as rds          from 'aws-cdk-lib/aws-rds';
import * as lambda       from 'aws-cdk-lib/aws-lambda';
import * as iam          from 'aws-cdk-lib/aws-iam';
import * as sns          from 'aws-cdk-lib/aws-sns';
import * as sns_subs     from 'aws-cdk-lib/aws-sns-subscriptions';
import * as logs         from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as path         from 'path';
import * as fs           from 'fs';
import { Construct }     from 'constructs';
import { CONFIG }        from './shared-config';

/* ── Stack props ─────────────────────────────────────────────────────── */
export interface SafeBetDRPrimaryProps extends cdk.StackProps {
  account:    string;
  bucketName: string;
  alertEmail: string;   // SNS email subscription (empty = no subscription)
}

/* ═══════════════════════════════════════════════════════════════════════
   STACK
   ═══════════════════════════════════════════════════════════════════ */
export class SafeBetDRPrimaryStack extends cdk.Stack {

  public readonly dbSecret:       secretsmanager.ISecret;
  public readonly drAlertsTopic:  sns.Topic;

  constructor(scope: Construct, id: string, props: SafeBetDRPrimaryProps) {
    super(scope, id, props);

    /* ── 1. VPC — isolated subnets only (no NAT = no cost) ─────────── */
    const vpc = new ec2.Vpc(this, 'DrPrimaryVpc', {
      vpcName:     'safebet-dr-primary-vpc',
      ipAddresses: ec2.IpAddresses.cidr('10.10.0.0/16'),
      maxAzs:      2,
      natGateways: 0,
      subnetConfiguration: [
        {
          name:       'DrIsolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask:   24,
        },
      ],
      enableDnsHostnames: true,
      enableDnsSupport:   true,
    });

    /* ── 2. Security group — RDS only reachable within VPC ─────────── */
    const rdsSg = new ec2.SecurityGroup(this, 'PrimaryRdsSg', {
      vpc,
      securityGroupName: 'safebet-primary-rds-sg',
      description:       'SafeBet RDS primary - PostgreSQL from VPC only',
      allowAllOutbound:  false,
    });
    rdsSg.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(5432),
      'PostgreSQL from VPC CIDR',
    );

    /* ── 3. Secrets Manager — import existing RDS credentials ──────── */
    this.dbSecret = secretsmanager.Secret.fromSecretNameV2(
      this, 'PrimaryDbSecret', CONFIG.SECRET_RDS_CREDS,
    );

    /* ── 5. RDS RETIRED (Stage D2C) — retained support resources ─────
       The PostgreSQL RDS (safebet-primary-capetown) was permanently retired
       under Stage D2C (physical delete) after Stage D2B detached it from this
       stack. It is intentionally NO LONGER defined here so a future synth/
       deploy cannot recreate it. Two support resources were RETAINED in the
       deployed stack during the D2B detach — the DB subnet group and the
       enhanced-monitoring IAM role (previously auto-generated children of the
       L2 PrimaryDb construct). They are re-declared here as explicit L1/L2
       constructs with their EXISTING deployed logical IDs preserved via
       overrideLogicalId, so this reconciliation performs ZERO resource
       actions on them. Their eventual cleanup is deferred to Stage E.
       (rdsSg / PrimaryRdsSg and PrimaryDbSecret import are likewise retained.) */
    const primaryDbSubnetGroup = new rds.CfnDBSubnetGroup(this, 'PrimaryDbSubnetGroupRetained', {
      dbSubnetGroupDescription: 'Subnet group for PrimaryDb database',
      subnetIds: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }).subnetIds,
    });
    primaryDbSubnetGroup.overrideLogicalId('PrimaryDbSubnetGroupED348943');

    const primaryDbMonitoringRole = new iam.Role(this, 'PrimaryDbMonitoringRoleRetained', {
      assumedBy: new iam.ServicePrincipal('monitoring.rds.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AmazonRDSEnhancedMonitoringRole',
        ),
      ],
    });
    (primaryDbMonitoringRole.node.defaultChild as iam.CfnRole)
      .overrideLogicalId('PrimaryDbMonitoringRoleC57F3424');
    // Retain the security group reference (PrimaryRdsSg) so it continues to synthesise.
    void rdsSg;

    /* ── 6 & 7. AutoFailover support resources RETIRED (Stage E2A) ─────
       The safebet-auto-failover Lambda was retired in Stage B2A/B2B; its
       dedicated IAM role (AutoFailoverRole9816D956, safebet-auto-failover-role),
       inline default policy (AutoFailoverRoleDefaultPolicy7D670003) and log
       group (AutoFailoverLogGroup13D0EE9F, /aws/lambda/safebet-auto-failover)
       were proven orphaned in Stage E1 (0 consumers; empty log group). They are
       NO LONGER defined here so they are not recreated; a separately-authorised
       Stage E2B change removes them from the deployed stack. */

    /* ── 10. SNS topic — DR alerts ──────────────────────────────────── */
    this.drAlertsTopic = new sns.Topic(this, 'DrAlertsTopic', {
      topicName:   CONFIG.SNS_TOPIC_NAME,
      displayName: 'SafeBet IQ — DR Alerts',
    });

    // NOTE: the alerts@safebetiq.com email subscription exists OUT-OF-BAND and
    // is intentionally NOT managed by this stack (the deployed template has no
    // AWS::SNS::Subscription). The source `addSubscription` was removed so this
    // reconciliation does NOT propose adding/adopting the live subscription.

    /* ── 11. Stack outputs ───────────────────────────────────────────── */
    new cdk.CfnOutput(this, 'PrimaryDbIdentifier', {
      value:       CONFIG.PRIMARY_DB_ID,
      description: 'RDS primary instance identifier',
      exportName:  'SafeBetPrimaryDbId',
    });
    new cdk.CfnOutput(this, 'PrimaryDbSecretArn', {
      value:       this.dbSecret.secretArn,
      description: 'Secrets Manager ARN — RDS admin credentials',
      exportName:  'SafeBetPrimaryDbSecretArn',
    });
    new cdk.CfnOutput(this, 'DrAlertsTopicArn', {
      value:       this.drAlertsTopic.topicArn,
      description: 'SNS DR alerts topic ARN',
      exportName:  'SafeBetDrAlertsTopicArn',
    });
    // SupabaseSecretArn output removed — not present in the deployed stack
    // (the auto-failover Lambda that consumed it was retired in Stage B2A/B2B).
  }
}
