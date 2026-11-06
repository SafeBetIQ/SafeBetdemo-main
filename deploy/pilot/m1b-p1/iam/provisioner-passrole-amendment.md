# SafeBetIQPilotProvisionerPolicy — PassRole amendment for the Pilot CodeBuild role

**Prepared, NOT applied.** Both IAM actions below are out-of-band, separately-controlled steps performed by an
account administrator (the provisioner role deliberately lacks `iam:CreateRole`/`iam:PutRolePolicy`, so it cannot
create its own PassRole targets). Do NOT apply from Claude or from the provisioner scripts.

## Why
`SafeBetDemoCodeBuildRole` cannot support the Pilot CodeBuild project: its inline CloudWatch Logs permission is
scoped to `arn:aws:logs:eu-west-1:046276255259:log-group:/aws/codebuild/safebet-demo-node20-build*`, which does
not match the Pilot log group `/aws/codebuild/safebet-iq-pilot-node20-build`. A dedicated
`safebet-iq-pilot-codebuild-role` is therefore required (see `.trust.json` / `.policy.json`).

## Step 1 (admin, out-of-band) — create the dedicated role
```
aws iam create-role --role-name safebet-iq-pilot-codebuild-role \
  --assume-role-policy-document file://safebet-iq-pilot-codebuild-role.trust.json \
  --description "Pilot CodeBuild service role (M1B-P1): scoped logs + build artifacts only" \
  --tags Key=Project,Value=SafeBetIQ Key=Environment,Value=Pilot Key=ManagedBy,Value=M1B Key=Purpose,Value=CodeBuild
aws iam put-role-policy --role-name safebet-iq-pilot-codebuild-role \
  --policy-name safebet-iq-pilot-codebuild-inline \
  --policy-document file://safebet-iq-pilot-codebuild-role.policy.json
```

## Step 2 (admin, out-of-band) — minimal PassRole amendment to SafeBetIQPilotProvisionerPolicy
In the `PassOnlyApprovedRoles` statement, the Resource list changes from:
```
"Resource": [
  "arn:aws:iam::046276255259:role/aws-elasticbeanstalk-ec2-role",
  "arn:aws:iam::046276255259:role/aws-elasticbeanstalk-service-role",
  "arn:aws:iam::046276255259:role/SafeBetDemoCodeBuildRole"
]
```
to (MINIMAL — add the Pilot CodeBuild role):
```
"Resource": [
  "arn:aws:iam::046276255259:role/aws-elasticbeanstalk-ec2-role",
  "arn:aws:iam::046276255259:role/aws-elasticbeanstalk-service-role",
  "arn:aws:iam::046276255259:role/SafeBetDemoCodeBuildRole",
  "arn:aws:iam::046276255259:role/safebet-iq-pilot-codebuild-role"
]
```

**RECOMMENDED (tightening):** since Pilot now uses its own CodeBuild role, remove `SafeBetDemoCodeBuildRole`
from the Pilot provisioner's PassRole set so the provisioner can PassRole ONLY Pilot-owned build identity:
```
"Resource": [
  "arn:aws:iam::046276255259:role/aws-elasticbeanstalk-ec2-role",
  "arn:aws:iam::046276255259:role/aws-elasticbeanstalk-service-role",
  "arn:aws:iam::046276255259:role/safebet-iq-pilot-codebuild-role"
]
```
Apply as a new managed-policy version (fail-closed; keep the prior version for rollback). Closes B-IAM-2.
```
aws iam create-policy-version --policy-arn arn:aws:iam::046276255259:policy/SafeBetIQPilotProvisionerPolicy \
  --policy-document file://SafeBetIQPilotProvisionerPolicy-v2.json --set-as-default
```

## Scope of the dedicated role (safebet-iq-pilot-codebuild-role)
- CloudWatch Logs: ONLY the Pilot CodeBuild log group `/aws/codebuild/safebet-iq-pilot-node20-build(:*)`.
- S3: ONLY the Pilot build bucket `safebet-iq-pilot-build[/*]` and the EB bucket path
  `elasticbeanstalk-eu-west-1-046276255259/codebuild/safebet-iq-pilot-node20-build/*`.
- NO Secrets Manager (build inputs are NEXT_PUBLIC_* CodeBuild env vars supplied at start-build; none fetched).
- NO deployment permissions, NO Production, NO Demo, NO Guardian, NO AdministratorAccess.
