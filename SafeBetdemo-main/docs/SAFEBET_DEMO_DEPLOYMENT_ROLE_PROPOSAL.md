# SafeBetDemoDeploymentRole — Least-Privilege Deployment Role Proposal

**Status:** Proposal only — NOT yet created or tested. **Do not claim least privilege is implemented until it is applied and a full build+deploy cycle has passed under it.**

## Security finding (high priority)

The identity currently used for demo deployments is the IAM **user** `safebetiq-backup-user`
(`arn:aws:iam::046276255259:user/safebetiq-backup-user`), which holds **AdministratorAccess**.

- A long-lived admin **user** (static access keys) used for routine CI/deploy is a standing risk:
  full authority over **production** EB, RDS, DNS, CloudFront, WAF, IAM, and all Supabase-adjacent
  AWS resources; blast radius of a leaked key is the entire account.
- **Do not remove or downgrade this identity automatically** — it may be the only administrative
  path the owner has, and removing it could lock the account owner out. Remediation must be
  owner-driven and staged.

## Proposed target: a scoped role, assumed (not a standing admin user)

Create `SafeBetDemoDeploymentRole`, assumable by a dedicated low-privilege deploy principal
(or via CI OIDC), scoped **only** to the demo release path. Production access is explicitly excluded.

### Permissions (demo-only)

| Capability | Scope |
|---|---|
| Read/deploy EB app versions | `application: safebet-iq-app`, `environment: safebet-iq-demo` **only** |
| Create/describe EB application versions | `safebet-iq-app` |
| S3 for source + artifacts | `elasticbeanstalk-eu-west-1-046276255259/codebuild/*` (get/put) |
| CodeBuild build (this project) | `project: safebet-demo-node20-build` (start/batch-get) |
| Read logs | `/aws/codebuild/safebet-demo-*`, `/aws/elasticbeanstalk/safebet-iq-demo/*` (read-only) |
| Describe env config | `safebet-iq-demo` |

### Explicit denies / exclusions

- **No** access to `safebet-iq-prod`, `Safebet-iq-prod-capetown-env-1`, or any environment != `safebet-iq-demo`.
- **No** RDS, Route53, CloudFront, ACM, or WAF write of any kind.
- **No** IAM write (cannot escalate).
- **No** access to production Supabase secrets or the `SUPABASE_SERVICE_ROLE_KEY` value beyond what
  the demo environment itself already holds (build receives only `NEXT_PUBLIC_*` values).

### Example scoping (illustrative — must be validated before use)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EBDemoDeployOnly",
      "Effect": "Allow",
      "Action": [
        "elasticbeanstalk:CreateApplicationVersion",
        "elasticbeanstalk:DescribeApplicationVersions",
        "elasticbeanstalk:DescribeEnvironments",
        "elasticbeanstalk:DescribeEvents",
        "elasticbeanstalk:DescribeConfigurationSettings",
        "elasticbeanstalk:UpdateEnvironment"
      ],
      "Resource": [
        "arn:aws:elasticbeanstalk:eu-west-1:046276255259:application/safebet-iq-app",
        "arn:aws:elasticbeanstalk:eu-west-1:046276255259:applicationversion/safebet-iq-app/*",
        "arn:aws:elasticbeanstalk:eu-west-1:046276255259:environment/safebet-iq-app/safebet-iq-demo"
      ]
    },
    {
      "Sid": "DenyProdEnvironments",
      "Effect": "Deny",
      "Action": "elasticbeanstalk:UpdateEnvironment",
      "Resource": "arn:aws:elasticbeanstalk:*:046276255259:environment/safebet-iq-app/safebet-iq-prod"
    }
  ]
}
```

> Note: EB `UpdateEnvironment` authorization also requires the underlying resource permissions
> (autoscaling, ec2, elasticloadbalancing, cloudformation, s3) that the managed policy
> `AWSElasticBeanstalkManagedUpdatesCustomerRolePolicy` grants. A true least-privilege role must be
> tested end-to-end (create version → update `safebet-iq-demo` → confirm a prod `UpdateEnvironment`
> is denied) before it can be relied upon. **Least privilege is not proven until that test passes.**

## Recommended remediation sequence (owner-executed, staged)

1. Create `SafeBetDemoDeploymentRole` with the scoped policy above + managed EB updates policy.
2. Create a dedicated deploy principal (CI OIDC preferred over static keys) able to assume only this role.
3. Run one full build+deploy of `safebet-iq-demo` under the new role; confirm a `safebet-iq-prod`
   update attempt is **denied**.
4. Once validated, rotate/retire `safebet-iq-backup-user` static keys and remove AdministratorAccess
   from routine deploy use — **manually, owner-confirmed**, retaining a separate break-glass admin.
