/**
 * SafeBet IQ — DR Alarm Stack  (us-east-1, N. Virginia)
 * ========================================================
 * Creates the CloudWatch alarm AND the Route53 health check that evaluates it.
 *
 * WHY us-east-1:
 *   Route53 CloudWatch metric health checks can ONLY reference CloudWatch
 *   alarms in us-east-1 (AWS hard constraint).
 *
 * THE TWO-ALARM DESIGN:
 *  • SafeBetDRAlarm (this stack, us-east-1)
 *      Purpose:  Route53 health check → DNS failover
 *      Actions:  None for alarm action (Route53 reads alarm state directly)
 *                Email via SNS if alertEmail is set
 *
 *  • SafeBetDRTrigger (trigger stack, eu-north-1)
 *      Purpose:  SNS → dr-trigger Lambda → rds-failover Lambda
 *
 * OUTPUTS:
 *   AlarmName     — 'SafeBetDatabaseHealthyAlarm'
 *   AlarmArn      — CloudWatch alarm ARN (us-east-1)
 *   HealthCheckId — Route53 health check ID → DR_ROUTE53_HEALTH_CHECK_ID
 */

import * as cdk        from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as route53    from 'aws-cdk-lib/aws-route53';
import * as sns        from 'aws-cdk-lib/aws-sns';
import * as sns_subs   from 'aws-cdk-lib/aws-sns-subscriptions';
import * as cw_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Construct }   from 'constructs';
import { CONFIG }      from './shared-config';

/* ── Stack props ─────────────────────────────────────────────────────── */
export interface SafeBetDRAlarmProps extends cdk.StackProps {
  alertEmail: string;
}

export class SafeBetDRAlarmStack extends cdk.Stack {

  public readonly dbHealthyAlarm: cloudwatch.Alarm;
  public readonly dbHealthCheck:  route53.CfnHealthCheck;

  constructor(scope: Construct, id: string, props: SafeBetDRAlarmProps) {
    super(scope, id, props);

    /* ── 1. SNS topic for alarm notifications ───────────────────────── */
    const alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      topicName:   'safebet-dr-alarm-notifications',
      displayName: 'SafeBet IQ — DR Alarm Notifications (us-east-1)',
    });
    if (props.alertEmail) {
      alarmTopic.addSubscription(
        new sns_subs.EmailSubscription(props.alertEmail)
      );
    }

    /* ── 2. CloudWatch alarm — DatabaseHealthy (us-east-1) ─────────────── */
    // Published every 5 min by health-check.yml GitHub Actions workflow.
    // Two consecutive 0-values (10 minutes) trigger the alarm.
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
        'Fires when DatabaseHealthy < 1 for 2 consecutive 5-min periods (10 min total).',
        'Route53 health check evaluates this alarm state directly.',
        'When ALARM: primary DNS record marked unhealthy → traffic routes to Ireland replica.',
      ].join(' '),

      metric:             dbHealthMetric,
      threshold:          1,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      evaluationPeriods:  2,
      datapointsToAlarm:  2,

      // NOT_BREACHING: Route53 should only failover when the alarm explicitly fires,
      // not on missing data (e.g., on first deploy before health-check.yml has run).
      // The insufficientDataHealthStatus: 'Unhealthy' on the Route53 health check
      // handles the truly-no-data case separately.
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,

      actionsEnabled: true,
    });

    // Email notification when alarm fires (in addition to Route53 DNS action)
    this.dbHealthyAlarm.addAlarmAction(
      new cw_actions.SnsAction(alarmTopic)
    );
    this.dbHealthyAlarm.addOkAction(
      new cw_actions.SnsAction(alarmTopic)
    );

    /* ── 3. Route53 health check — linked to alarm above ────────────────── */
    // Type CLOUDWATCH_METRIC — evaluates alarm state in real time.
    // Route53 marks PRIMARY failover record unhealthy when this transitions
    // to Unhealthy, causing DNS to route to SECONDARY (Ireland) automatically.
    //
    // insufficientDataHealthStatus: 'Unhealthy'
    // If alarm has no data at all (e.g., GitHub Actions secrets not configured),
    // treat as unhealthy so the failover state is explicit, not silently passing.
    this.dbHealthCheck = new route53.CfnHealthCheck(this, 'DbHealthCheck', {
      healthCheckConfig: {
        type: 'CLOUDWATCH_METRIC',
        alarmIdentifier: {
          region: CONFIG.ALARM_REGION,
          name:   this.dbHealthyAlarm.alarmName,
        },
        insufficientDataHealthStatus: 'Unhealthy',
      },
      healthCheckTags: [
        { key: 'Name',      value: 'safebet-db-health-check' },
        { key: 'Project',   value: CONFIG.PROJECT_TAG },
        { key: 'ManagedBy', value: 'CDK' },
        { key: 'Stack',     value: 'SafeBetDRAlarm' },
      ],
    });

    this.dbHealthCheck.addDependency(
      this.dbHealthyAlarm.node.defaultChild as cdk.CfnResource
    );

    /* ── 4. Stack outputs ───────────────────────────────────────────────── */
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
    new cdk.CfnOutput(this, 'HealthCheckId', {
      value:       this.dbHealthCheck.attrHealthCheckId,
      description: 'Route53 health check ID → set as DR_ROUTE53_HEALTH_CHECK_ID in Amplify',
      exportName:  'SafeBetDbHealthCheckId',
    });
    new cdk.CfnOutput(this, 'AlarmTopicArn', {
      value:       alarmTopic.topicArn,
      description: 'SNS alarm notifications topic (us-east-1)',
    });
    new cdk.CfnOutput(this, 'DeployNote', {
      value: [
        'health-check.yml publishes SafeBetIQ/DR/DatabaseHealthy to us-east-1 + eu-north-1 every 5 min.',
        'Required GitHub secrets: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY.',
        'Set DR_ROUTE53_HEALTH_CHECK_ID=<HealthCheckId> in Amplify env vars.',
      ].join(' | '),
      description: 'Post-deploy setup checklist',
    });
  }
}
