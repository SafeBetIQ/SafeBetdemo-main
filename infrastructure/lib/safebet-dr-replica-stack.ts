/**
 * SafeBet IQ — DR Replica Stack  (eu-west-1, Ireland)
 * ======================================================
 * Provisions the SECONDARY side of the DR system:
 *
 *   • VPC           — isolated subnets for RDS replica
 *   • RDS Replica   — cross-region PostgreSQL 15 read replica from Cape Town
 *                     (uses L1 CfnDBInstance — L2 does not support cross-region)
 *   • Lambda        — safebet-rds-failover (promote replica + update Route53)
 *   • IAM role      — least-privilege role for rds-failover Lambda
 *   • Route53       — hosted zone (import or create), health check, failover CNAME records
 *   • CloudWatch    — log group, Lambda error alarm
 *
 * HOSTED ZONE STRATEGY:
 *   If props.hostedZoneId is provided (non-empty), the existing hosted zone is
 *   imported — no zone is created and NS delegation is already in place.
 *   If hostedZoneId is empty, a new public hosted zone is created and the
 *   NameServers output MUST be copied to the domain registrar NS records.
 *
 * OUTPUTS (copy to Amplify / Lambda env vars):
 *   ReplicaDbEndpoint         — replica CNAME endpoint
 *   RdsFailoverLambdaArn      — Lambda ARN
 *   HostedZoneId              — Route53 zone ID
 *   DbHealthCheckId           — Route53 health check ID → DR_ROUTE53_HEALTH_CHECK_ID
 *   DbDnsCname                — db.{hostedZoneName}
 *   NameServers               — ONLY populated for new zones; register at domain registrar
 */

import * as cdk          from 'aws-cdk-lib';
import * as ec2          from 'aws-cdk-lib/aws-ec2';
import * as rds          from 'aws-cdk-lib/aws-rds';
import * as lambda       from 'aws-cdk-lib/aws-lambda';
import * as iam          from 'aws-cdk-lib/aws-iam';
import * as route53      from 'aws-cdk-lib/aws-route53';
import * as logs         from 'aws-cdk-lib/aws-logs';
import * as cloudwatch   from 'aws-cdk-lib/aws-cloudwatch';
import * as cw_actions   from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns          from 'aws-cdk-lib/aws-sns';
import * as sns_subs     from 'aws-cdk-lib/aws-sns-subscriptions';
import * as path         from 'path';
import { Construct }     from 'constructs';
import { CONFIG }        from './shared-config';

/* ── Stack props ─────────────────────────────────────────────────────── */
export interface SafeBetDRReplicaProps extends cdk.StackProps {
  account:           string;
  bucketName:        string;
  hostedZoneName:    string;
  /**
   * If non-empty, the existing Route53 hosted zone with this ID is imported.
   * If empty, a new public hosted zone is created and the NameServers stack
   * output MUST be registered at the domain registrar.
   *
   * Pass via: --context hostedZoneId=ZXXXXXXXXXX
   */
  hostedZoneId:      string;
  alertEmail:        string;
  primaryDbId:       string;
  primaryRegion:     string;
  primaryDbEndpoint: string;
  healthCheckId:     string;
}

/* ═══════════════════════════════════════════════════════════════════════
   STACK
   ═══════════════════════════════════════════════════════════════════ */
export class SafeBetDRReplicaStack extends cdk.Stack {

  public readonly replicaDb:     rds.CfnDBInstance;
  public readonly rdsFailoverFn: lambda.Function;
  public readonly hostedZone:    route53.IHostedZone;

  constructor(scope: Construct, id: string, props: SafeBetDRReplicaProps) {
    super(scope, id, props);

    /* ── 1. VPC for RDS replica ─────────────────────────────────────── */
    const vpc = new ec2.Vpc(this, 'DrReplicaVpc', {
      vpcName:     'safebet-dr-replica-vpc',
      ipAddresses: ec2.IpAddresses.cidr('10.20.0.0/16'),
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

    /* ── 2. Security group for RDS replica ──────────────────────────── */
    const rdsSg = new ec2.SecurityGroup(this, 'ReplicaRdsSg', {
      vpc,
      securityGroupName: 'safebet-replica-rds-sg',
      description:       'SafeBet RDS replica - PostgreSQL from VPC only',
      allowAllOutbound:  false,
    });
    rdsSg.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(5432),
      'PostgreSQL from VPC CIDR',
    );

    /* ── 3. RDS Subnet Group ─────────────────────────────────────────── */
    const subnetGroup = new rds.CfnDBSubnetGroup(this, 'ReplicaSubnetGroup', {
      dbSubnetGroupName:        'safebet-replica-subnet-group',
      dbSubnetGroupDescription: 'SafeBet DR replica subnet group (eu-west-1)',
      subnetIds:                vpc.isolatedSubnets.map(s => s.subnetId),
    });

    /* ── 4. RDS Read Replica — cross-region from Cape Town ───────────── */
    // Uses L1 CfnDBInstance — CDK L2 DatabaseInstanceReadReplica does not
    // support cross-region replication.
    // The SourceRegion parameter causes CloudFormation to auto-generate a
    // pre-signed URL for cross-region replication auth.
    //
    // PostgreSQL 15 allows backupRetentionPeriod > 0 on read replicas,
    // enabling point-in-time recovery on the replica itself.
    const sourceDbArn =
      `arn:aws:rds:${props.primaryRegion}:${props.account}:db:${props.primaryDbId}`;

    this.replicaDb = new rds.CfnDBInstance(this, 'ReplicaDb', {
      dbInstanceIdentifier:      CONFIG.REPLICA_DB_ID,
      dbInstanceClass:           CONFIG.RDS_INSTANCE_CLASS,

      engine:        'postgres',
      engineVersion: '15',   // must match primary; PG15 allows backup on replica

      sourceDbInstanceIdentifier: sourceDbArn,
      sourceRegion:              props.primaryRegion,

      dbSubnetGroupName:  subnetGroup.dbSubnetGroupName,
      vpcSecurityGroups:  [rdsSg.securityGroupId],

      publiclyAccessible: false,
      multiAz:            false,   // replica itself has no HA; the primary does
      storageType:        'gp3',
      storageEncrypted:   true,
      // Explicit KMS key required for cross-region encrypted replica
      kmsKeyId: `arn:aws:kms:${this.region}:${props.account}:alias/aws/rds`,

      // PG15 read replicas support automated backups — enables PITR on replica
      backupRetentionPeriod: 1,

      deletionProtection: true,

      tags: [
        { key: 'Project',     value: CONFIG.PROJECT_TAG },
        { key: 'Role',        value: 'DR-Replica' },
        { key: 'ManagedBy',   value: 'CDK' },
      ],
    });

    this.replicaDb.addDependency(subnetGroup);

    /* ── 5. Route53 — Hosted Zone ────────────────────────────────────── */
    // Import existing zone if hostedZoneId is provided; otherwise create new.
    // CRITICAL: if creating a new zone, copy NameServers output to your
    // domain registrar before failover will work.
    if (props.hostedZoneId) {
      this.hostedZone = route53.HostedZone.fromHostedZoneAttributes(
        this, 'DrHostedZone', {
          hostedZoneId: props.hostedZoneId,
          zoneName:     props.hostedZoneName,
        }
      );
      new cdk.CfnOutput(this, 'HostedZoneImported', {
        value:       props.hostedZoneId,
        description: 'Imported existing Route53 hosted zone ID',
      });
    } else {
      const newZone = new route53.HostedZone(this, 'DrHostedZone', {
        zoneName: props.hostedZoneName,
        comment:  'SafeBet IQ DR failover zone — managed by CDK',
      });
      this.hostedZone = newZone;
      new cdk.CfnOutput(this, 'NameServers', {
        value:       cdk.Fn.join(', ', newZone.hostedZoneNameServers ?? []),
        description: '⚠️  NEW ZONE: Copy these NS records to your domain registrar immediately',
      });
    }

    /* ── 6. Route53 — Failover DNS records ──────────────────────────── */
    const dbRecordName = `${CONFIG.DB_RECORD_PREFIX}.${props.hostedZoneName}`;

    // PRIMARY failover record → Cape Town endpoint
    new route53.CfnRecordSet(this, 'PrimaryFailoverRecord', {
      hostedZoneId:    this.hostedZone.hostedZoneId,
      name:            dbRecordName,
      type:            'CNAME',
      ttl:             String(CONFIG.DNS_TTL_SECONDS),
      resourceRecords: [props.primaryDbEndpoint],
      setIdentifier:   'primary-capetown',
      failover:        'PRIMARY',
      healthCheckId:   props.healthCheckId,
    });

    // SECONDARY failover record → Ireland replica endpoint
    // Updated by safebet-rds-failover Lambda on failover
    new route53.CfnRecordSet(this, 'SecondaryFailoverRecord', {
      hostedZoneId:    this.hostedZone.hostedZoneId,
      name:            dbRecordName,
      type:            'CNAME',
      ttl:             String(CONFIG.DNS_TTL_SECONDS),
      resourceRecords: [this.replicaDb.attrEndpointAddress],
      setIdentifier:   'secondary-ireland',
      failover:        'SECONDARY',
    });

    /* ── 7. SNS topic for replica-side alerts ────────────────────────── */
    const replicaAlertsTopic = new sns.Topic(this, 'ReplicaAlertsTopic', {
      topicName:   'safebet-dr-replica-alerts',
      displayName: 'SafeBet IQ — DR Replica Alerts (Ireland)',
    });
    if (props.alertEmail) {
      replicaAlertsTopic.addSubscription(
        new sns_subs.EmailSubscription(props.alertEmail)
      );
    }

    /* ── 8. IAM role for safebet-rds-failover Lambda ─────────────────── */
    const rdsFailoverRole = new iam.Role(this, 'RdsFailoverRole', {
      roleName:    'safebet-rds-failover-role',
      assumedBy:   new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Execution role for safebet-rds-failover Lambda (RDS promote + Route53)',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole'
        ),
      ],
    });

    rdsFailoverRole.addToPolicy(new iam.PolicyStatement({
      sid:     'RDSDescribeBothRegions',
      effect:  iam.Effect.ALLOW,
      actions: ['rds:DescribeDBInstances'],
      resources: [
        `arn:aws:rds:${props.primaryRegion}:${props.account}:db:${props.primaryDbId}`,
        `arn:aws:rds:${this.region}:${props.account}:db:${CONFIG.REPLICA_DB_ID}`,
      ],
    }));
    rdsFailoverRole.addToPolicy(new iam.PolicyStatement({
      sid:     'RDSPromoteReplica',
      effect:  iam.Effect.ALLOW,
      actions: ['rds:PromoteReadReplica'],
      resources: [
        `arn:aws:rds:${this.region}:${props.account}:db:${CONFIG.REPLICA_DB_ID}`,
      ],
    }));
    rdsFailoverRole.addToPolicy(new iam.PolicyStatement({
      sid:     'RDSCreateReadReplica',
      effect:  iam.Effect.ALLOW,
      actions: ['rds:CreateDBInstanceReadReplica'],
      resources: ['*'],
    }));
    rdsFailoverRole.addToPolicy(new iam.PolicyStatement({
      sid:     'Route53FailoverSwitch',
      effect:  iam.Effect.ALLOW,
      actions: ['route53:ChangeResourceRecordSets', 'route53:ListResourceRecordSets'],
      resources: [
        `arn:aws:route53:::hostedzone/${this.hostedZone.hostedZoneId}`,
      ],
    }));
    rdsFailoverRole.addToPolicy(new iam.PolicyStatement({
      sid:     'CloudWatchMetrics',
      effect:  iam.Effect.ALLOW,
      actions: ['cloudwatch:PutMetricData'],
      resources: ['*'],
      conditions: {
        StringEquals: { 'cloudwatch:namespace': CONFIG.CW_NAMESPACE },
      },
    }));
    rdsFailoverRole.addToPolicy(new iam.PolicyStatement({
      sid:     'CloudWatchLogs',
      effect:  iam.Effect.ALLOW,
      actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
      resources: [
        `arn:aws:logs:${this.region}:${props.account}:log-group:/aws/lambda/${CONFIG.RDS_FAILOVER_FN}:*`,
      ],
    }));
    rdsFailoverRole.addToPolicy(new iam.PolicyStatement({
      sid:     'S3DrState',
      effect:  iam.Effect.ALLOW,
      actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket'],
      resources: [
        `arn:aws:s3:::${props.bucketName}`,
        `arn:aws:s3:::${props.bucketName}/${CONFIG.S3_DR_STATE_KEY}`,
      ],
    }));
    rdsFailoverRole.addToPolicy(new iam.PolicyStatement({
      sid:     'StsCallerIdentity',
      effect:  iam.Effect.ALLOW,
      actions: ['sts:GetCallerIdentity'],
      resources: ['*'],
    }));

    /* ── 9. CloudWatch Log Group ─────────────────────────────────────── */
    const rdsFailoverLogGroup = new logs.LogGroup(this, 'RdsFailoverLogGroup', {
      logGroupName:  `/aws/lambda/${CONFIG.RDS_FAILOVER_FN}`,
      retention:     logs.RetentionDays.THREE_MONTHS,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    /* ── 10. Lambda — safebet-rds-failover ───────────────────────────── */
    this.rdsFailoverFn = new lambda.Function(this, 'RdsFailoverFn', {
      functionName:  CONFIG.RDS_FAILOVER_FN,
      description:   'DR: promote RDS replica → update Route53 CNAME on failover',
      runtime:       lambda.Runtime.PYTHON_3_12,
      architecture:  lambda.Architecture.X86_64,
      handler:       'lambda_function.lambda_handler',
      role:          rdsFailoverRole,
      timeout:       cdk.Duration.minutes(CONFIG.LAMBDA_TIMEOUT_MIN),
      memorySize:    CONFIG.LAMBDA_MEMORY_MB,
      logGroup:      rdsFailoverLogGroup,

      code: lambda.Code.fromAsset(
        path.join(__dirname, '../../lambda/safebet-rds-failover'),
      ),

      environment: {
        REPLICA_DB:             CONFIG.REPLICA_DB_ID,
        REPLICA_DB_REGION:      this.region,
        REPLICA_DB_ENDPOINT:    this.replicaDb.attrEndpointAddress,
        ROUTE53_HOSTED_ZONE_ID: this.hostedZone.hostedZoneId,
        ROUTE53_RECORD_NAME:    dbRecordName,
        PRIMARY_DB:             props.primaryDbId,
        PRIMARY_DB_REGION:      props.primaryRegion,
        AUTO_REBUILD:           'true',
        FAILOVER_COOLDOWN:      '600',
        S3_BUCKET:              props.bucketName,
      },

      retryAttempts: 1,
    });

    /* ── 11. Lambda error alarm → SNS ───────────────────────────────── */
    const rdsFailoverErrors = this.rdsFailoverFn.metricErrors({
      period:    cdk.Duration.minutes(5),
      statistic: 'Sum',
    });
    const rdsFailoverErrorAlarm = new cloudwatch.Alarm(this, 'RdsFailoverErrorAlarm', {
      alarmName:          'SafeBetRdsFailoverErrors',
      alarmDescription:   'safebet-rds-failover Lambda errors — failover execution broken',
      metric:             rdsFailoverErrors,
      threshold:          1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      evaluationPeriods:  1,
      treatMissingData:   cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    rdsFailoverErrorAlarm.addAlarmAction(
      new cw_actions.SnsAction(replicaAlertsTopic)
    );

    /* ── 12. Stack outputs ───────────────────────────────────────────── */
    new cdk.CfnOutput(this, 'ReplicaDbEndpoint', {
      value:       this.replicaDb.attrEndpointAddress,
      description: 'RDS Ireland replica endpoint',
      exportName:  'SafeBetReplicaDbEndpoint',
    });
    new cdk.CfnOutput(this, 'RdsFailoverLambdaArn', {
      value:       this.rdsFailoverFn.functionArn,
      description: 'safebet-rds-failover Lambda ARN',
      exportName:  'SafeBetRdsFailoverArn',
    });
    new cdk.CfnOutput(this, 'HostedZoneId', {
      value:       this.hostedZone.hostedZoneId,
      description: 'Route53 hosted zone ID',
      exportName:  'SafeBetHostedZoneId',
    });
    new cdk.CfnOutput(this, 'DbHealthCheckId', {
      value:       props.healthCheckId,
      description: 'Route53 health check ID → set as DR_ROUTE53_HEALTH_CHECK_ID in Amplify',
      exportName:  'SafeBetDbHealthCheckId',
    });
    new cdk.CfnOutput(this, 'DbDnsCname', {
      value:       dbRecordName,
      description: 'Failover DNS CNAME (primary=Cape Town, secondary=Ireland)',
      exportName:  'SafeBetDbDnsCname',
    });
  }
}
