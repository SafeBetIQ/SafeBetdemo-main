/**
 * SafeBet IQ — DR Alarm Stack  (us-east-1, N. Virginia)
 * ========================================================
 * Creates the CloudWatch alarm AND the Route53 health check that evaluates it.
 *
 * WHY THIS STACK MUST LIVE IN us-east-1
 * ─────────────────────────────────────────────────────────────────────
 * Route53 CloudWatch metric health checks can ONLY reference CloudWatch
 * alarms in us-east-1 (AWS hard constraint, not a CDK limitation).
 * Any other region is silently ignored — the health check stays in
 * INSUFFICIENT_DATA permanently, causing the primary DNS record to appear
 * unhealthy from the moment it is created.
 *
 * By co-locating the alarm AND the health check in this stack:
 *   • Both resources are guaranteed to exist after a single stack deploy.
 *   • The health check ID is exported for the replica stack's failover records.
 *   • There is no timing window where the alarm exists but the health check does not.
 *
 * THE TWO-ALARM DESIGN
 * ─────────────────────────────────────────────────────────────────────
 *  • SafeBetDRAlarm (this stack, us-east-1)
 *      Alarm name: SafeBetDatabaseHealthyAlarm
 *      Purpose:    Route53 health check → DNS failover
 *      Actions:    None (Route53 reads alarm state directly)
 *
 *  • SafeBetDRTrigger (trigger stack, eu-north-1)
 *      Alarm name: SafeBetDatabaseHealthyAlarm  (same name, different region)
 *      Purpose:    SNS → dr-trigger Lambda → rds-failover Lambda
 *      Actions:    SnsAction(drAlertsTopic)
 *
 * The health-check.yml GitHub Actions workflow publishes
 * SafeBetIQ/DR/DatabaseHealthy to BOTH us-east-1 and eu-north-1
 * so both alarms are fed simultaneously.
 *
 * DEPLOYMENT ORDER
 * ─────────────────────────────────────────────────────────────────────
 * SafeBetDRAlarm must be deployed BEFORE SafeBetDRReplica because the
 * replica stack's Route53 failover records reference this stack's
 * HealthCheckId output.  CDK enforces this via
 * replicaStack.addDependency(alarmStack).
 *
 * OUTPUTS:
 *   AlarmName     — 'SafeBetDatabaseHealthyAlarm'
 *   AlarmArn      — CloudWatch alarm ARN (us-east-1)
 *   HealthCheckId — Route53 health check ID → DR_ROUTE53_HEALTH_CHECK_ID
 */

import * as cdk        from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as route53    from 'aws-cdk-lib/aws-route53';
import { Construct }   from 'constructs';
import { CONFIG }      from './shared-config';

export class SafeBetDRAlarmStack extends cdk.Stack {

  public readonly dbHealthyAlarm: cloudwatch.Alarm;
  public readonly dbHealthCheck:  route53.CfnHealthCheck;

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    /* ── 1. CloudWatch alarm — DatabaseHealthy (us-east-1) ─────────────── */
    // The DatabaseHealthy metric (1 = healthy, 0 = unhealthy) is published
    // to us-east-1 every 5 minutes by the health-check.yml GitHub Actions
    // workflow.  Two consecutive 0-values (10 minutes) trigger the alarm.
    //
    // No SNS action is needed here — Route53 reads the alarm state directly
    // through the CLOUDWATCH_METRIC health check below.  The SNS → Lambda
    // failover chain is driven by the separate alarm in the trigger stack.
    const dbHealthMetric = new cloudwatch.Metric({
      namespace:  CONFIG.CW_NAMESPACE,
      metricName: CONFIG.CW_METRIC_DB_HEALTH,
      statistic:  'Minimum',
      period:     cdk.Duration.minutes(5),
    });

    this.dbHealthyAlarm = new cloudwatch.Alarm(this, 'DatabaseHealthyAlarm', {
      alarmName:        'SafeBetDatabaseHealthyAlarm',
      alarmDescription: [
        'Route53 DNS failover signal.',
        'Fires when DatabaseHealthy < 1 for 2 consecutive 5-min periods.',
        'Route53 health check evaluates this alarm state directly —',
        'when ALARM, primary DNS record is marked unhealthy and traffic',
        'routes to the Ireland replica (SECONDARY record).',
      ].join(' '),

      metric:             dbHealthMetric,
      threshold:          1,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      evaluationPeriods:  2,
      datapointsToAlarm:  2,

      // NOT_BREACHING: treat missing data as healthy to avoid false failover
      // on first deploy before the health-check.yml workflow has run.
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,

      // No alarm actions — Route53 reads alarm state directly.
      actionsEnabled: false,
    });

    /* ── 2. Route53 health check — linked to the alarm above ────────────── */
    // Type CLOUDWATCH_METRIC evaluates the alarm state in real time.
    // Route53 marks the PRIMARY failover record as unhealthy when this
    // health check transitions to Unhealthy, causing DNS to route to
    // the SECONDARY (Ireland) record automatically.
    //
    // CONSTRAINT: alarmIdentifier.region MUST be 'us-east-1'.
    // Route53 can only evaluate CloudWatch alarms in us-east-1 for
    // CLOUDWATCH_METRIC health checks — this is why the entire stack
    // lives in us-east-1.
    //
    // insufficientDataHealthStatus: 'Unhealthy'
    // If the alarm has no data (e.g., health-check.yml hasn't run yet),
    // treat it as unhealthy so the failover record takes effect rather
    // than silently allowing traffic to a potentially dead primary.
    this.dbHealthCheck = new route53.CfnHealthCheck(this, 'DbHealthCheck', {
      healthCheckConfig: {
        type: 'CLOUDWATCH_METRIC',
        alarmIdentifier: {
          // Must reference the alarm in the SAME region as this stack (us-east-1).
          region: CONFIG.ALARM_REGION,          // 'us-east-1'
          name:   this.dbHealthyAlarm.alarmName, // 'SafeBetDatabaseHealthyAlarm'
        },
        insufficientDataHealthStatus: 'Unhealthy',
      },
      healthCheckTags: [
        { key: 'Name',        value: 'safebet-db-health-check' },
        { key: 'Project',     value: CONFIG.PROJECT_TAG },
        { key: 'ManagedBy',   value: 'CDK' },
        { key: 'Stack',       value: 'SafeBetDRAlarm' },
      ],
    });

    // Explicit dependency: CloudFormation must create the alarm before the
    // health check, because the health check references the alarm by name.
    this.dbHealthCheck.addDependency(
      this.dbHealthyAlarm.node.defaultChild as cdk.CfnResource
    );

    /* ── 3. Stack outputs ───────────────────────────────────────────────── */
    new cdk.CfnOutput(this, 'AlarmName', {
      value:       this.dbHealthyAlarm.alarmName,
      description: 'CloudWatch alarm name (us-east-1) evaluated by Route53 health check',
      exportName:  'SafeBetDatabaseHealthyAlarmName',
    });

    new cdk.CfnOutput(this, 'AlarmArn', {
      value:       this.dbHealthyAlarm.alarmArn,
      description: 'CloudWatch alarm ARN (us-east-1)',
      exportName:  'SafeBetDatabaseHealthyAlarmArn',
    });

    // HealthCheckId is the value to set as DR_ROUTE53_HEALTH_CHECK_ID in
    // Amplify environment variables and as healthCheckId on the PRIMARY
    // Route53 failover record in SafeBetDRReplicaStack.
    new cdk.CfnOutput(this, 'HealthCheckId', {
      value:       this.dbHealthCheck.attrHealthCheckId,
      description: 'Route53 health check ID → set as DR_ROUTE53_HEALTH_CHECK_ID in Amplify',
      exportName:  'SafeBetDbHealthCheckId',
    });

    new cdk.CfnOutput(this, 'DeployNote', {
      value: [
        'health-check.yml publishes SafeBetIQ/DR/DatabaseHealthy to us-east-1 + eu-north-1.',
        'Required IAM: rds:DescribeDBInstances on primary ARN,',
        'cloudwatch:PutMetricData (namespace SafeBetIQ/DR) in both regions.',
        'Set DR_ROUTE53_HEALTH_CHECK_ID=<HealthCheckId> in Amplify env vars.',
      ].join(' '),
      description: 'Post-deploy setup checklist',
    });
  }
}
