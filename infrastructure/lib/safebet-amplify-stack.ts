/**
 * SafeBet IQ — Amplify Hosting Stack
 * =====================================
 * Creates two completely isolated Amplify apps:
 *
 *   safebetiq-demo  → branch: demo        → demo.safebetiq.com
 *   safebetiq-prod  → branch: production  → safebetiq.com + www.safebetiq.com
 *
 * WAF WebACL (CLOUDFRONT scope) must live in us-east-1.
 * Both Amplify apps are deployed in us-east-1 for co-location.
 *
 * SECURITY NOTES:
 *   • GitHub OAuth token is read from SSM SecureString at deploy time —
 *     never stored in the CDK context or CloudFormation plaintext.
 *   • NEXT_PUBLIC_* variables (Supabase URL, anon key) are intentionally
 *     public — they are embedded in the browser JS bundle by Next.js.
 *   • Server-side secrets (SUPABASE_SERVICE_ROLE_KEY, TWILIO_*, etc.)
 *     must be set via the Amplify Console with the "Secret" toggle ON.
 *     DO NOT add them here — they would appear in the CloudFormation template.
 *
 * POST-DEPLOY — Associate WAF with each Amplify app (CLI):
 *   aws amplify associate-web-acl \
 *     --app-id <DemoAppId output> \
 *     --web-acl-arn <WafWebAclArn output> \
 *     --region us-east-1
 *   (repeat for ProdAppId)
 */

import * as cdk    from 'aws-cdk-lib';
import * as amplify from 'aws-cdk-lib/aws-amplify';
import * as wafv2  from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';

/* ── Build spec ───────────────────────────────────────────────────────────
 * Next.js SSR app lives in the frontend/ subdirectory.
 * Amplify detects SSR via the `framework` property on CfnBranch and
 * provisions a compute backend automatically — no custom rewrite rules needed.
 * ──────────────────────────────────────────────────────────────────────── */
const NEXTJS_BUILD_SPEC = `\
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - cd frontend
        - npm ci --cache .npm --prefer-offline
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: frontend/.next
    files:
      - '**/*'
  cache:
    paths:
      - frontend/.next/cache/**/*
      - frontend/node_modules/**/*
`;

/* ── Props ────────────────────────────────────────────────────────────── */
export interface SafeBetAmplifyStackProps extends cdk.StackProps {
  /** GitHub org / user that owns the repository */
  readonly githubOwner: string;
  /** GitHub repository name (without org prefix) */
  readonly githubRepo: string;
  /**
   * SSM SecureString parameter path that stores the GitHub personal access
   * token. The token needs repo + admin:repo_hook scopes.
   * Create it before deploying:
   *   aws ssm put-parameter \
   *     --name /safebet/github-token \
   *     --type SecureString \
   *     --value ghp_XXXX \
   *     --region us-east-1
   */
  readonly githubTokenParamName: string;

  /* ── Demo env vars ──────────────────────────────────────────────────── */
  /** https://<demo-project-ref>.supabase.co */
  readonly demoSupabaseUrl: string;
  /** Supabase anon/public key for the Demo project */
  readonly demoSupabaseAnonKey: string;

  /* ── Production env vars ────────────────────────────────────────────── */
  /** https://<prod-project-ref>.supabase.co */
  readonly prodSupabaseUrl: string;
  /** Supabase anon/public key for the Production project */
  readonly prodSupabaseAnonKey: string;

  /* ── DR env vars (production only) ─────────────────────────────────── */
  readonly drAwsRegion?: string;   // eu-west-1
  readonly drS3Region?: string;    // eu-north-1
  readonly drS3Bucket?: string;    // safebetiq-backups-ACCOUNT-eu-north-1
  readonly drLogGroup?: string;    // /aws/lambda/safebet-rds-failover
  readonly drCwNamespace?: string; // SafeBetIQ/DR
  readonly drHealthCheckId?: string;
}

/* ── Stack ────────────────────────────────────────────────────────────── */
export class SafeBetAmplifyStack extends cdk.Stack {
  /** Amplify App ID for the demo environment */
  public readonly demoApp: amplify.CfnApp;
  /** Amplify App ID for the production environment */
  public readonly prodApp: amplify.CfnApp;
  /** WAF WebACL ARN — associate manually post-deploy (see header comment) */
  public readonly webAcl: wafv2.CfnWebACL;

  constructor(scope: Construct, id: string, props: SafeBetAmplifyStackProps) {
    super(scope, id, props);

    /* ── GitHub OAuth token (resolved from SSM at deploy time) ─────────
     * unsafeUnwrap() produces the CloudFormation dynamic reference string
     * {{resolve:ssm-secure:/safebet/github-token:1}} — the actual token
     * value is never visible in the CDK app, CLI history, or CF template.
     * ─────────────────────────────────────────────────────────────────── */
    const githubToken = cdk.SecretValue
      .ssmSecure(props.githubTokenParamName)
      .unsafeUnwrap();

    const repoUrl = `https://github.com/${props.githubOwner}/${props.githubRepo}`;

    /* ════════════════════════════════════════════════════════════════════
       WAF WebACL  (CLOUDFRONT scope → must be in the same region as stack,
       which is us-east-1)
       ════════════════════════════════════════════════════════════════════ */
    this.webAcl = new wafv2.CfnWebACL(this, 'AmplifyWAF', {
      name:          'safebet-amplify-waf',
      description:   'WAF for SafeBet IQ Amplify Hosting (demo + prod)',
      scope:         'CLOUDFRONT',   // Amplify uses CloudFront internally
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName:               'safebet-amplify-waf',
        sampledRequestsEnabled:   true,
      },
      rules: [
        managedRule('AWSManagedRulesCommonRuleSet',         'AWS', 1),
        managedRule('AWSManagedRulesKnownBadInputsRuleSet', 'AWS', 2),
        managedRule('AWSManagedRulesAmazonIpReputationList','AWS', 3),
        managedRule('AWSManagedRulesSQLiRuleSet',           'AWS', 4),
      ],
    });

    /* ════════════════════════════════════════════════════════════════════
       DEMO Amplify App — branch: demo → demo.safebetiq.com
       ════════════════════════════════════════════════════════════════════ */
    this.demoApp = new amplify.CfnApp(this, 'DemoApp', {
      name:                    'safebetiq-demo',
      repository:              repoUrl,
      oauthToken:              githubToken,
      buildSpec:               NEXTJS_BUILD_SPEC,
      enableBranchAutoDeletion: false,
      platform:                'WEB_COMPUTE',   // required for Next.js SSR
      environmentVariables: [
        { name: 'NEXT_PUBLIC_ENV',              value: 'demo'  },
        { name: 'NEXT_PUBLIC_APP_NAME',         value: 'SafeBet IQ (Demo)' },
        { name: 'NEXT_PUBLIC_SUPABASE_URL',     value: props.demoSupabaseUrl },
        { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', value: props.demoSupabaseAnonKey },
        { name: 'NEXT_PUBLIC_ENABLE_DEBUG',     value: 'true'  },
        { name: 'NEXT_PUBLIC_ENABLE_MOCK_DATA', value: 'true'  },
        { name: 'NEXT_TELEMETRY_DISABLED',      value: '1'     },
        { name: 'AWS_REGION',                   value: 'af-south-1' },
        { name: 'DR_CW_NAMESPACE',              value: 'SafeBetIQ/Demo' },
        { name: 'FAILOVER_ENABLED',             value: 'false' },
      ],
    });

    const demoBranch = new amplify.CfnBranch(this, 'DemoBranch', {
      appId:           this.demoApp.attrAppId,
      branchName:      'demo',
      description:     'Demo environment branch',
      enableAutoBuild: true,
      framework:       'Next.js - SSR',
      stage:           'DEVELOPMENT',
    });
    demoBranch.addDependency(this.demoApp);

    const demoDomain = new amplify.CfnDomain(this, 'DemoDomain', {
      appId:      this.demoApp.attrAppId,
      domainName: 'safebetiq.com',
      subDomainSettings: [
        { prefix: 'demo', branchName: demoBranch.branchName },
      ],
      enableAutoSubDomain:          false,
      autoSubDomainIamRole:         undefined,
      autoSubDomainCreationPatterns: undefined,
    });
    demoDomain.addDependency(demoBranch);

    /* ════════════════════════════════════════════════════════════════════
       PRODUCTION Amplify App — branch: production → safebetiq.com
       ════════════════════════════════════════════════════════════════════ */
    const prodEnvVars: amplify.CfnApp.EnvironmentVariableProperty[] = [
      { name: 'NEXT_PUBLIC_ENV',               value: 'production' },
      { name: 'NEXT_PUBLIC_APP_NAME',          value: 'SafeBet IQ' },
      { name: 'NEXT_PUBLIC_SUPABASE_URL',      value: props.prodSupabaseUrl },
      { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', value: props.prodSupabaseAnonKey },
      { name: 'NEXT_PUBLIC_ENABLE_DEBUG',      value: 'false' },
      { name: 'NEXT_PUBLIC_ENABLE_MOCK_DATA',  value: 'false' },
      { name: 'NEXT_TELEMETRY_DISABLED',       value: '1'     },
      { name: 'AWS_REGION',                    value: 'af-south-1' },
      { name: 'FAILOVER_ENABLED',              value: 'true'  },
    ];

    // DR env vars — only added when provided (sourced from DR stack outputs)
    if (props.drAwsRegion)    prodEnvVars.push({ name: 'DR_AWS_REGION',               value: props.drAwsRegion });
    if (props.drS3Region)     prodEnvVars.push({ name: 'DR_S3_REGION',                value: props.drS3Region });
    if (props.drS3Bucket)     prodEnvVars.push({ name: 'DR_S3_BUCKET',                value: props.drS3Bucket });
    if (props.drLogGroup)     prodEnvVars.push({ name: 'DR_LOG_GROUP',                value: props.drLogGroup });
    if (props.drCwNamespace)  prodEnvVars.push({ name: 'DR_CW_NAMESPACE',             value: props.drCwNamespace });
    if (props.drHealthCheckId) prodEnvVars.push({ name: 'DR_ROUTE53_HEALTH_CHECK_ID', value: props.drHealthCheckId });

    this.prodApp = new amplify.CfnApp(this, 'ProdApp', {
      name:                    'safebetiq-prod',
      repository:              repoUrl,
      oauthToken:              githubToken,
      buildSpec:               NEXTJS_BUILD_SPEC,
      enableBranchAutoDeletion: false,
      platform:                'WEB_COMPUTE',
      environmentVariables:    prodEnvVars,
    });

    const prodBranch = new amplify.CfnBranch(this, 'ProdBranch', {
      appId:           this.prodApp.attrAppId,
      branchName:      'production',
      description:     'Production environment branch',
      enableAutoBuild: true,
      framework:       'Next.js - SSR',
      stage:           'PRODUCTION',
    });
    prodBranch.addDependency(this.prodApp);

    const prodDomain = new amplify.CfnDomain(this, 'ProdDomain', {
      appId:      this.prodApp.attrAppId,
      domainName: 'safebetiq.com',
      subDomainSettings: [
        { prefix: '',    branchName: prodBranch.branchName }, // apex: safebetiq.com
        { prefix: 'www', branchName: prodBranch.branchName }, // www.safebetiq.com
      ],
      enableAutoSubDomain:          false,
      autoSubDomainIamRole:         undefined,
      autoSubDomainCreationPatterns: undefined,
    });
    prodDomain.addDependency(prodBranch);

    /* ── Stack outputs ──────────────────────────────────────────────── */
    new cdk.CfnOutput(this, 'DemoAppId', {
      value:       this.demoApp.attrAppId,
      description: 'Demo Amplify App ID — use to associate WAF and set secret env vars',
      exportName:  'SafeBetAmplifyDemoAppId',
    });

    new cdk.CfnOutput(this, 'ProdAppId', {
      value:       this.prodApp.attrAppId,
      description: 'Prod Amplify App ID — use to associate WAF and set secret env vars',
      exportName:  'SafeBetAmplifyProdAppId',
    });

    new cdk.CfnOutput(this, 'WafWebAclArn', {
      value:       this.webAcl.attrArn,
      description: [
        'WAF WebACL ARN. Associate with each Amplify app after deploy:',
        '  aws amplify associate-web-acl --app-id <DemoAppId> --web-acl-arn <this> --region us-east-1',
        '  aws amplify associate-web-acl --app-id <ProdAppId> --web-acl-arn <this> --region us-east-1',
      ].join('\n'),
      exportName: 'SafeBetAmplifyWafArn',
    });

    new cdk.CfnOutput(this, 'DemoUrl', {
      value:       'https://demo.safebetiq.com',
      description: 'Demo environment URL (active after DNS propagation)',
    });

    new cdk.CfnOutput(this, 'ProdUrl', {
      value:       'https://safebetiq.com',
      description: 'Production URL (active after DNS propagation)',
    });

    new cdk.CfnOutput(this, 'PostDeployChecklist', {
      value: [
        '1. Associate WAF with both apps (see WafWebAclArn output for commands)',
        '2. In Amplify Console → Demo App → Environment Variables → add SUPABASE_SERVICE_ROLE_KEY (secret)',
        '3. In Amplify Console → Prod App → Environment Variables → add SUPABASE_SERVICE_ROLE_KEY, TWILIO_*, SAFEPLAY_* (all secret)',
        '4. Verify DNS CNAME records for demo.safebetiq.com, safebetiq.com, www.safebetiq.com',
        '5. Trigger first build: git push to demo branch and production branch',
      ].join(' | '),
      description: 'Post-deploy manual steps required',
    });
  }
}

/* ── Helper: AWS-managed WAF rule group ───────────────────────────────── */
function managedRule(
  name:       string,
  vendorName: string,
  priority:   number,
): wafv2.CfnWebACL.RuleProperty {
  return {
    name,
    priority,
    overrideAction: { none: {} },
    statement: {
      managedRuleGroupStatement: { name, vendorName },
    },
    visibilityConfig: {
      cloudWatchMetricsEnabled: true,
      metricName:               name,
      sampledRequestsEnabled:   true,
    },
  };
}
