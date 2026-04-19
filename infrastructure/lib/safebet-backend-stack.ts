/**
 * SafeBet IQ — Backend API Stack  (af-south-1, Cape Town)
 * =========================================================
 * Deploys six Lambda functions behind a single API Gateway REST API.
 * Attaches each Lambda to the existing primary DR VPC so they can
 * reach the RDS instance via the private VPC network.
 *
 * DB_HOST is always 'db.safebetiq.com' — the Route53 CNAME that
 * fails over between Cape Town (primary) and Ireland (replica).
 *
 * DEPLOYMENT:
 *   cdk deploy SafeBetBackend \
 *     --context account=046276255259 \
 *     --context cognitoUserPoolId=eu-west-1_XXXXXX \
 *     --context cognitoClientId=XXXXXXXXXXXXXXXXXXXXXXXXXX
 *
 * IMPORTANT: This stack does NOT modify any DR stack (Primary / Alarm /
 * Replica / Trigger). It only reads from shared-config.ts for naming
 * constants and imports the existing VPC + secret by lookup.
 */

import * as cdk          from 'aws-cdk-lib';
import * as ec2          from 'aws-cdk-lib/aws-ec2';
import * as lambda       from 'aws-cdk-lib/aws-lambda';
import * as lambdaNode   from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway   from 'aws-cdk-lib/aws-apigateway';
import * as logs         from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as path         from 'path';
import { Construct }     from 'constructs';
import { CONFIG }        from './shared-config';

/* ── Stack props ──────────────────────────────────────────────────────── */
export interface SafeBetBackendProps extends cdk.StackProps {
  account:            string;
  cognitoUserPoolId?: string;
  cognitoClientId?:   string;
  cognitoRegion?:     string;
  allowedOrigin?:     string;
}

/* ═══════════════════════════════════════════════════════════════════════
   STACK
   ═══════════════════════════════════════════════════════════════════ */
export class SafeBetBackendStack extends cdk.Stack {

  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: SafeBetBackendProps) {
    super(scope, id, props);

    /* ── 1. Import existing primary VPC ──────────────────────────────── */
    // The VPC is created by SafeBetDRPrimaryStack (af-south-1).
    // fromLookup reads VPC metadata at synthesis time — requires
    // `env.account` and `env.region` to be set on this stack (they are).
    // The existing RDS SG allows inbound port 5432 from the entire VPC
    // CIDR (10.10.0.0/16), so any Lambda placed in these subnets can
    // connect to RDS without an additional SG rule.
    const vpc = ec2.Vpc.fromLookup(this, 'PrimaryVpc', {
      vpcName: 'safebet-dr-primary-vpc',
    });

    /* ── 2. Security group for backend Lambda functions ───────────────── */
    const lambdaSg = new ec2.SecurityGroup(this, 'BackendLambdaSg', {
      vpc,
      securityGroupName: 'safebet-backend-lambda-sg',
      description:       'SafeBet backend Lambda - outbound to RDS and HTTPS',
      allowAllOutbound:  false,
    });

    // Outbound: PostgreSQL — reaches RDS in isolated subnets within same VPC
    lambdaSg.addEgressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(5432),
      'PostgreSQL to RDS within VPC',
    );

    // Outbound: HTTPS — required for Cognito JWKS endpoint, AWS API calls
    // Note: for fully air-gapped VPCs, replace with VPC endpoints for
    // Cognito and Secrets Manager instead of allowing public HTTPS egress.
    lambdaSg.addEgressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'HTTPS for Cognito JWKS and AWS APIs',
    );

    /* ── 3. Import existing DB credentials secret ─────────────────────── */
    // Created by SafeBetDRPrimaryStack. We import, never recreate.
    // CloudFormation dynamic references ({{resolve:secretsmanager:...}})
    // keep the raw value out of the template and encrypt it in Lambda env.
    const dbSecret = secretsmanager.Secret.fromSecretNameV2(
      this, 'DbSecret', CONFIG.SECRET_RDS_CREDS,
    );

    /* ── 4. Shared environment variables ─────────────────────────────── */
    const commonEnv: Record<string, string> = {
      // DB_HOST MUST remain db.safebetiq.com — Route53 CNAME for DR failover.
      // Never replace with a raw RDS endpoint. The CNAME resolves to the
      // primary RDS private IP when called from within the primary VPC.
      DB_HOST:                    'db.safebetiq.com',
      DB_PORT:                    '5432',
      DB_NAME:                    CONFIG.DB_NAME,
      DB_USER:                    dbSecret.secretValueFromJson('username').unsafeUnwrap(),
      DB_PASSWORD:                dbSecret.secretValueFromJson('password').unsafeUnwrap(),
      DB_POOL_MAX:                '5',
      DB_SSL_REJECT_UNAUTHORIZED: 'true',

      COGNITO_REGION:       props.cognitoRegion     ?? CONFIG.PRIMARY_REGION,
      COGNITO_USER_POOL_ID: props.cognitoUserPoolId ?? '',
      COGNITO_CLIENT_ID:    props.cognitoClientId   ?? '',
      ALLOWED_ORIGIN:       props.allowedOrigin     ?? '*',
      NODE_ENV:             'production',
    };

    /* ── 5. Shared Lambda configuration ─────────────────────────────── */
    const serviceSrcRoot = path.join(__dirname, '../safebet-backend/services');

    const sharedLambdaProps: Omit<lambdaNode.NodejsFunctionProps, 'entry' | 'functionName' | 'description'> = {
      runtime:      lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64,
      handler:      'handler',
      memorySize:   512,
      timeout:      cdk.Duration.seconds(30),

      // Place inside the primary VPC — reaches RDS via private network
      vpc,
      vpcSubnets:     { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [lambdaSg],

      environment: commonEnv,

      bundling: {
        externalModules: ['pg-native'],
        minify:          true,
        sourceMap:       false,
        target:          'node20',
      },

      logRetention: logs.RetentionDays.ONE_MONTH,
    };

    /* ── 6. Helper: create one Lambda + grant secret read ─────────────── */
    const mkLambda = (
      constructId:  string,
      serviceName:  string,
      extraEnv?:    Record<string, string>,
    ): lambdaNode.NodejsFunction => {
      // Explicit log group ensures retention is set before the first invocation
      new logs.LogGroup(this, `${constructId}Logs`, {
        logGroupName:  `/aws/lambda/safebet-${serviceName}`,
        retention:     logs.RetentionDays.ONE_MONTH,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });

      const fn = new lambdaNode.NodejsFunction(this, constructId, {
        ...sharedLambdaProps,
        functionName: `safebet-${serviceName}`,
        description:  `SafeBet IQ - ${serviceName}`,
        entry:        path.join(serviceSrcRoot, serviceName, 'index.ts'),
        environment:  extraEnv ? { ...commonEnv, ...extraEnv } : commonEnv,
      });

      // Allow Lambda to call GetSecretValue on the DB credentials secret
      dbSecret.grantRead(fn);

      return fn;
    };

    /* ── 7. Lambda functions ─────────────────────────────────────────── */

    // Auth Lambda runs OUTSIDE the VPC so it can reach public Cognito endpoints.
    // The VPC has no NAT Gateway, so any Lambda inside it cannot make outbound
    // internet calls. Auth does not touch RDS directly — it only calls Cognito
    // and returns tokens, so VPC placement is unnecessary.
    new logs.LogGroup(this, 'AuthFnLogs', {
      logGroupName:  '/aws/lambda/safebet-auth-service',
      retention:     logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const authFn = new lambdaNode.NodejsFunction(this, 'AuthFn', {
      // Inherit all shared props EXCEPT vpc / vpcSubnets / securityGroups
      runtime:      sharedLambdaProps.runtime,
      architecture: sharedLambdaProps.architecture,
      handler:      sharedLambdaProps.handler,
      memorySize:   sharedLambdaProps.memorySize,
      timeout:      sharedLambdaProps.timeout,
      bundling:     sharedLambdaProps.bundling,
      logRetention: sharedLambdaProps.logRetention,
      // No vpc / vpcSubnets / securityGroups — runs with full internet access
      functionName: 'safebet-auth-service',
      description:  'SafeBet IQ - auth-service (outside VPC for Cognito access)',
      entry:        path.join(serviceSrcRoot, 'auth-service', 'index.ts'),
      environment:  commonEnv,
    });
    dbSecret.grantRead(authFn);

    // user-service runs OUTSIDE the VPC — same reason as auth-service:
    // verifyToken() fetches the Cognito JWKS endpoint over the internet.
    // The VPC has no NAT gateway, so any Lambda inside it cannot reach
    // cognito-idp.af-south-1.amazonaws.com to fetch JWKS.
    new logs.LogGroup(this, 'UserFnLogs', {
      logGroupName:  '/aws/lambda/safebet-user-service',
      retention:     logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const userFn = new lambdaNode.NodejsFunction(this, 'UserFn', {
      runtime:      sharedLambdaProps.runtime,
      architecture: sharedLambdaProps.architecture,
      handler:      sharedLambdaProps.handler,
      memorySize:   sharedLambdaProps.memorySize,
      timeout:      sharedLambdaProps.timeout,
      bundling:     sharedLambdaProps.bundling,
      logRetention: sharedLambdaProps.logRetention,
      // No vpc / vpcSubnets / securityGroups — full internet access for Cognito JWKS
      functionName: 'safebet-user-service',
      description:  'SafeBet IQ - user-service (outside VPC for Cognito access)',
      entry:        path.join(serviceSrcRoot, 'user-service', 'index.ts'),
      environment:  commonEnv,
    });
    dbSecret.grantRead(userFn);
    const riskFn         = mkLambda('RiskFn',         'risk-engine');
    const analyticsFn    = mkLambda('AnalyticsFn',    'analytics-service');
    const interventionFn = mkLambda('InterventionFn', 'intervention-service');
    const complianceFn   = mkLambda('ComplianceFn',   'compliance-service');

    /* ── 8. API Gateway — access log group ───────────────────────────── */
    const apiLogGroup = new logs.LogGroup(this, 'ApiAccessLogs', {
      logGroupName:  '/aws/apigateway/safebet-backend',
      retention:     logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    /* ── 9. REST API ─────────────────────────────────────────────────── */
    this.api = new apigateway.RestApi(this, 'SafeBetApi', {
      restApiName: 'safebet-backend-api',
      description: 'SafeBet IQ - backend REST API',

      deployOptions: {
        stageName:            'v1',
        accessLogDestination: new apigateway.LogGroupLogDestination(apiLogGroup),
        accessLogFormat:      apigateway.AccessLogFormat.jsonWithStandardFields({
          caller:         true,
          httpMethod:     true,
          ip:             true,
          protocol:       true,
          requestTime:    true,
          resourcePath:   true,
          responseLength: true,
          status:         true,
          user:           true,
        }),
        loggingLevel:     apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: false,  // avoid logging request bodies (contains PII)
        metricsEnabled:   true,
        tracingEnabled:   true,   // X-Ray
      },

      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Api-Key',
          'X-Casino-Id',
        ],
      },
    });

    /* ── 10. Lambda proxy integration helper ─────────────────────────── */
    const proxy = (fn: lambda.IFunction) =>
      new apigateway.LambdaIntegration(fn, {
        proxy:           true,
        allowTestInvoke: false,
      });

    /* ── 11. Route table ─────────────────────────────────────────────── */

    // POST /auth/login
    const auth = this.api.root.addResource('auth');
    auth.addResource('login').addMethod('POST', proxy(authFn));

    // GET  /auth/verify  (token introspection — optional internal use)
    auth.addResource('verify').addMethod('GET', proxy(authFn));

    // POST /users              → register player
    // GET  /users/me           → current user profile
    // GET  /users/{id}         → get player by ID
    // PATCH /users/{id}        → update player
    const users = this.api.root.addResource('users');
    users.addMethod('POST', proxy(userFn));
    users.addResource('me').addMethod('GET', proxy(userFn));
    const userId = users.addResource('{playerId}');
    userId.addMethod('GET',   proxy(userFn));
    userId.addMethod('PATCH', proxy(userFn));

    // POST /risk/score                    → compute risk score
    // GET  /risk/score/{playerId}         → get latest risk score
    // GET  /risk/score/{playerId}?recompute=true → force recompute
    const risk = this.api.root.addResource('risk');
    const riskScore = risk.addResource('score');
    riskScore.addMethod('POST', proxy(riskFn));
    riskScore.addResource('{playerId}').addMethod('GET', proxy(riskFn));

    // GET /analytics/players              → player summaries (paginated)
    // GET /analytics/metrics              → casino-level metrics
    // GET /analytics/risk-distribution    → risk level breakdown
    // GET /analytics/top-loss             → top loss players (last 30 days)
    // GET /analytics/session-trend        → daily session + wager trend
    const analytics = this.api.root.addResource('analytics');
    analytics.addResource('players').addMethod('GET',            proxy(analyticsFn));
    analytics.addResource('metrics').addMethod('GET',            proxy(analyticsFn));
    analytics.addResource('risk-distribution').addMethod('GET',  proxy(analyticsFn));
    analytics.addResource('top-loss').addMethod('GET',           proxy(analyticsFn));
    analytics.addResource('session-trend').addMethod('GET',      proxy(analyticsFn));

    // POST  /interventions/{playerId}/evaluate     → compute risk + trigger interventions
    // GET   /interventions/{playerId}              → list interventions
    // PATCH /interventions/{playerId}/{interventionId} → acknowledge/dismiss
    const interventions = this.api.root.addResource('interventions');
    const iPlayer = interventions.addResource('{playerId}');
    iPlayer.addResource('evaluate').addMethod('POST', proxy(interventionFn));
    iPlayer.addMethod('GET', proxy(interventionFn));
    iPlayer.addResource('{interventionId}').addMethod('PATCH', proxy(interventionFn));

    // POST  /compliance/events                     → log compliance event
    // GET   /compliance/history/{playerId}         → player audit history
    // PATCH /compliance/kyc                        → update KYC status
    // POST  /compliance/self-exclusion             → apply self-exclusion
    const compliance = this.api.root.addResource('compliance');
    compliance.addResource('events').addMethod('POST', proxy(complianceFn));
    compliance.addResource('history')
      .addResource('{playerId}').addMethod('GET', proxy(complianceFn));
    compliance.addResource('kyc').addMethod('PATCH', proxy(complianceFn));
    compliance.addResource('self-exclusion').addMethod('POST', proxy(complianceFn));

    /* ── 12. Stack outputs ───────────────────────────────────────────── */
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value:       this.api.url,
      description: 'SafeBet IQ API Gateway base URL',
      exportName:  'SafeBetApiEndpoint',
    });

    new cdk.CfnOutput(this, 'ApiId', {
      value:       this.api.restApiId,
      description: 'API Gateway REST API ID',
      exportName:  'SafeBetApiId',
    });

    new cdk.CfnOutput(this, 'ApiStage', {
      value:       'v1',
      description: 'API Gateway stage name',
    });

    new cdk.CfnOutput(this, 'AuthFunctionArn', {
      value:       authFn.functionArn,
      description: 'safebet-auth-service Lambda ARN',
    });

    new cdk.CfnOutput(this, 'UserFunctionArn', {
      value:       userFn.functionArn,
      description: 'safebet-user-service Lambda ARN',
    });
  }
}
