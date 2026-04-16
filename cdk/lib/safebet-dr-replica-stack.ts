/**
 * SafeBet IQ — DR Replica Stack  (eu-west-1, Ireland)
 * ======================================================
 * Provisions the SECONDARY side of the DR system:
 *
 *   • VPC           — isolated subnets for RDS replica
 *   • RDS Replica   — cross-region PostgreSQL read replica from Cape Town
 *                     (uses L1 CfnDBInstance — L2 does not support cross-region)
 *   • Lambda        — safebet-rds-failover (promote replica + update Route53)
 *   • IAM role      — least-privilege role for rds-failover Lambda
 *   • Route53       — hosted zone, health check, failover CNAME records
 *   • CloudWatch    — log group
 *
 * DEPLOYMENT ORDER:
 *   This stack MUST be deployed after SafeBetDRPrimary because the RDS
 *   replica depends on the primary instance existing and having backups.
 *   CDK enforces this via `replicaStack.addDependency(primaryStack)`.
 *
 * OUTPUTS (copy to Amplify / Lambda env vars):
 *   ReplicaDbEndpoint         — replica CNAME endpoint
 *   RdsFailoverLambdaArn      — Lambda ARN
 *   HostedZoneId              — Route53 zone ID
 *   DbHealthCheckId           — Route53 health check ID  → DR_ROUTE53_HEALTH_CHECK_ID
 *   DbDnsCname                — db.{hostedZoneName} CNAME
 */

import * as cdk          from 'aws-cdk-lib';
import * as ec2          from 'aws-cdk-lib/aws-ec2';
import * as rds          from 'aws-cdk-lib/aws-rds';
import * as lambda       from 'aws-cdk-lib/aws-lambda';
import * as iam          from 'aws-cdk-lib/aws-iam';
import * as route53      from 'aws-cdk-lib/aws-route53';
import * as logs         from 'aws-cdk-lib/aws-logs';
import * as path         from 'path';
import { Construct }     from 'constructs';
import { CONFIG }        from './shared-config';

/* ── Stack props ─────────────────────────────────────────────────────── */
export interface SafeBetDRReplicaProps extends cdk.StackProps {
  account:        string;
  bucketName:     string;
  hostedZoneName: string;  // e.g. "safebetiq.com"
  primaryDbId:    string;  // CONFIG.PRIMARY_DB_ID
  primaryRegion:  string;  // CONFIG.PRIMARY_REGION
}

/* ═══════════════════════════════════════════════════════════════════════
   STACK
   ═══════════════════════════════════════════════════════════════════ */
export class SafeBetDRReplicaStack extends cdk.Stack {

  public readonly replicaDb:        rds.CfnDBInstance;
  public readonly rdsFailoverFn:    lambda.Function;
  public readonly hostedZone:       route53.HostedZone;
  public readonly healthCheck:      route53.CfnHealthCheck;

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
      description:       'SafeBet RDS replica — PostgreSQL from VPC only',
      allowAllOutbound:  false,
    });
    rdsSg.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(5432),
      'PostgreSQL from VPC CIDR',
    );

    /* ── 3. RDS Subnet Group ─────────────────────────────────────────── */
    // L1 CfnDBSubnetGroup needed because L2 replica creation doesn't have
    // a dedicated cross-region factory method.
    const subnetGroup = new rds.CfnDBSubnetGroup(this, 'ReplicaSubnetGroup', {
      dbSubnetGroupName:        'safebet-replica-subnet-group',
      dbSubnetGroupDescription: 'SafeBet DR replica subnet group (eu-west-1)',
      subnetIds:                vpc.isolatedSubnets.map(s => s.subnetId),
    });

    /* ── 4. RDS Read Replica — cross-region from Cape Town ───────────── */
    // Uses L1 CfnDBInstance because CDK L2 (DatabaseInstanceReadReplica)
    // does not support cross-region replication.
    //
    // The SourceRegion parameter causes CDK/CloudFormation to generate a
    // pre-signed URL for cross-region replication auth automatically.
    //
    // IMPORTANT: The primary instance MUST have backupRetentionPeriod > 0
    //            (set to 7 days in the primary stack).
    const sourceDbArn =
      `arn:aws:rds:${props.primaryRegion}:${props.account}:db:${props.primaryDbId}`;

    this.replicaDb = new rds.CfnDBInstance(this, 'ReplicaDb', {
      dbInstanceIdentifier:      CONFIG.REPLICA_DB_ID,
      dbInstanceClass:           CONFIG.RDS_INSTANCE_CLASS,

      // These are inherited from source but must be set for L1:
      engine:                    'postgres',
      engineVersion:             '15.4',

      sourceDbInstanceIdentifier: sourceDbArn,
      sourceRegion:              props.primaryRegion,

      dbSubnetGroupName:         subnetGroup.dbSubnetGroupName,
      vpcSecurityGroups:         [rdsSg.securityGroupId],

      publiclyAccessible:        false,
      multiAz:                   false,
      storageType:               'gp3',
      storageEncrypted:          true,

      // Backup for the replica itself
      backupRetentionPeriod:     7,

      // Tags
      tags: [
        { key: 'Project',     value: CONFIG.PROJECT_TAG },
        { key: 'Environment', value: CONFIG.ENV_TAG },
        { key: 'Role',        value: 'DR-Replica' },
        { key: 'ManagedBy',   value: 'CDK' },
      ],
    });

    // The CfnDBInstance has an implicit dependency on the subnet group
    this.replicaDb.addDependency(subnetGroup);

    /* ── 5. Route53 — Hosted Zone ────────────────────────────────────── */
    // Creates a NEW public hosted zone for props.hostedZoneName.
    // If your domain is already managed in Route53, replace this with:
    //   route53.HostedZone.fromLookup(this, 'Zone', { domainName: props.hostedZoneName })
    // Note: fromLookup requires `env.account` and `env.region` to be set (they are).
    this.hostedZone = new route53.HostedZone(this, 'DrHostedZone', {
      zoneName: props.hostedZoneName,
      comment:  'SafeBet IQ DR failover zone — managed by CDK',
    });

    /* ── 6. Route53 — CloudWatch metric health check ─────────────────── */
    // Monitors the SafeBetIQ/DR/DatabaseHealthy CloudWatch metric in eu-north-1.
    // When metric = 0 (unhealthy), Route53 marks the PRIMARY record as unhealthy
    // and routes all traffic to the SECONDARY (Ireland replica) record.
    //
    // The alarm that feeds this health check is created in SafeBetDRTriggerStack.
    // Route53 health checks that use CloudWatch alarms MUST be in us-east-1.
    this.healthCheck = new route53.CfnHealthCheck(this, 'DbHealthCheck', {
      healthCheckConfig: {
        type:                  'CLOUDWATCH_METRIC',
        // These reference the alarm created in the trigger stack (eu-north-1).
        // CloudWatch metric health checks evaluate the alarm state directly.
        alarmIdentifier: {
          region:    CONFIG.TRIGGER_REGION,
          name:      'SafeBetDatabaseHealthyAlarm',
        },
        insufficientDataHealthStatus: 'Unhealthy',  // treat missing data as unhealthy
      },
      healthCheckTags: [
        { key: 'Name',        value: 'safebet-db-health-check' },
        { key: 'Project',     value: CONFIG.PROJECT_TAG },
        { key: 'ManagedBy',   value: 'CDK' },
      ],
    });

    /* ── 7. Route53 — Failover DNS records ──────────────────────────── */
    // db.{hostedZoneName} — PRIMARY record (Cape Town)
    //   → points to primary RDS CNAME endpoint
    //   → associated with health check
    //   → if unhealthy, traffic falls over to SECONDARY
    //
    // db.{hostedZoneName} — SECONDARY record (Ireland)
    //   → points to replica RDS CNAME endpoint
    //   → promoted on failover via safebet-rds-failover Lambda
    //
    // The rds-failover Lambda updates the SECONDARY record to point to the
    // newly-promoted primary endpoint via Route53 change_resource_record_sets.

    const dbRecordName = `${CONFIG.DB_RECORD_PREFIX}.${props.hostedZoneName}`;

    // PRIMARY failover record → Cape Town endpoint
    new route53.CfnRecordSet(this, 'PrimaryFailoverRecord', {
      hostedZoneId:   this.hostedZone.hostedZoneId,
      name:           dbRecordName,
      type:           'CNAME',
      ttl:            String(CONFIG.DNS_TTL_SECONDS),
      // Placeholder: after deploying primary stack, replace with actual endpoint
      resourceRecords: [
        cdk.Fn.importValue('SafeBetPrimaryDbEndpoint'),
      ],
      setIdentifier:  'primary-capetown',
      failover:       'PRIMARY',
      healthCheckId:  this.healthCheck.attrHealthCheckId,
    });

    // SECONDARY failover record → Ireland replica endpoint
    // This record is updated by safebet-rds-failover Lambda during failover
    new route53.CfnRecordSet(this, 'SecondaryFailoverRecord', {
      hostedZoneId:   this.hostedZone.hostedZoneId,
      name:           dbRecordName,
      type:           'CNAME',
      ttl:            String(CONFIG.DNS_TTL_SECONDS),
      resourceRecords: [
        this.replicaDb.attrEndpointAddress,
      ],
      setIdentifier:  'secondary-ireland',
      failover:       'SECONDARY',
    });

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

    // RDS: describe both primary and replica; promote replica only
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
      resources: ['*'],   // cross-region replica requires '*'
    }));

    // Route53: update DNS failover records
    rdsFailoverRole.addToPolicy(new iam.PolicyStatement({
      sid:     'Route53FailoverSwitch',
      effect:  iam.Effect.ALLOW,
      actions: ['route53:ChangeResourceRecordSets', 'route53:ListResourceRecordSets'],
      resources: [
        `arn:aws:route53:::hostedzone/${this.hostedZone.hostedZoneId}`,
      ],
    }));

    // CloudWatch: emit failover metrics
    rdsFailoverRole.addToPolicy(new iam.PolicyStatement({
      sid:     'CloudWatchMetrics',
      effect:  iam.Effect.ALLOW,
      actions: ['cloudwatch:PutMetricData'],
      resources: ['*'],
      conditions: {
        StringEquals: { 'cloudwatch:namespace': CONFIG.CW_NAMESPACE },
      },
    }));

    // CloudWatch Logs
    rdsFailoverRole.addToPolicy(new iam.PolicyStatement({
      sid:     'CloudWatchLogs',
      effect:  iam.Effect.ALLOW,
      actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
      resources: [
        `arn:aws:logs:${this.region}:${props.account}:log-group:/aws/lambda/${CONFIG.RDS_FAILOVER_FN}:*`,
      ],
    }));

    // S3: read/write DR state file (persistent cooldown)
    rdsFailoverRole.addToPolicy(new iam.PolicyStatement({
      sid:     'S3DrState',
      effect:  iam.Effect.ALLOW,
      actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket'],
      resources: [
        `arn:aws:s3:::${props.bucketName}`,
        `arn:aws:s3:::${props.bucketName}/${CONFIG.S3_DR_STATE_KEY}`,
      ],
    }));

    // STS: get caller identity (needed for cross-region replica ARN construction)
    rdsFailoverRole.addToPolicy(new iam.PolicyStatement({
      sid:     'StsCallerIdentity',
      effect:  iam.Effect.ALLOW,
      actions: ['sts:GetCallerIdentity'],
      resources: ['*'],
    }));

    /* ── 9. CloudWatch Log Group for rds-failover Lambda ─────────────── */
    const rdsFailoverLogGroup = new logs.LogGroup(this, 'RdsFailoverLogGroup', {
      logGroupName:  `/aws/lambda/${CONFIG.RDS_FAILOVER_FN}`,
      retention:     logs.RetentionDays.THREE_MONTHS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    /* ── 10. Lambda — safebet-rds-failover ───────────────────────────── */
    // No external pip dependencies — boto3 is pre-installed in Lambda runtime.
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

      // No bundling needed — boto3 is built into the Python 3.12 Lambda runtime
      code: lambda.Code.fromAsset(
        path.join(__dirname, '../../lambda/safebet-rds-failover'),
      ),

      environment: {
        REPLICA_DB:              CONFIG.REPLICA_DB_ID,
        REPLICA_DB_REGION:       this.region,
        REPLICA_DB_ENDPOINT:     this.replicaDb.attrEndpointAddress,
        ROUTE53_HOSTED_ZONE_ID:  this.hostedZone.hostedZoneId,
        ROUTE53_RECORD_NAME:     dbRecordName,
        PRIMARY_DB:              props.primaryDbId,
        PRIMARY_DB_REGION:       props.primaryRegion,
        AUTO_REBUILD:            'true',
        FAILOVER_COOLDOWN:       '600',
        S3_BUCKET:               props.bucketName,
      },

      retryAttempts: 0,  // no retry — failover must not run twice
    });

    /* ── 11. Stack outputs ───────────────────────────────────────────── */
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
      value:       this.healthCheck.attrHealthCheckId,
      description: 'Route53 health check ID → set as DR_ROUTE53_HEALTH_CHECK_ID in Amplify',
      exportName:  'SafeBetDbHealthCheckId',
    });

    new cdk.CfnOutput(this, 'DbDnsCname', {
      value:       dbRecordName,
      description: 'Failover DNS record (primary → Cape Town, secondary → Ireland)',
      exportName:  'SafeBetDbDnsCname',
    });

    new cdk.CfnOutput(this, 'NameServers', {
      value:       cdk.Fn.join(', ', this.hostedZone.hostedZoneNameServers ?? []),
      description: 'Route53 name servers — add these NS records to your domain registrar',
    });
  }
}
