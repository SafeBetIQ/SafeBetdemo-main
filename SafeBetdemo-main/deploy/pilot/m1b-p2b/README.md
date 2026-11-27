# M1B-P2B.2 — Governed Pilot IAM Isolation Execution Pack (PREPARED — DO NOT EXECUTE)

Reviewed, idempotent remediation for the cross-environment IAM findings in the M1B-P2B.1 assessment.
**Nothing here runs automatically.** Every step is owner-operated under an MFA session. Never print
credentials, session tokens, MFA codes, or secret values. No `GetSecretValue`. No secret creation until
the shared-role rollback (§3B) is complete.

Account `046276255259` · region `eu-west-1`. Policy JSONs live in `./policies/`.

## Identity model
- **Provisioning** (EB/CodeBuild/ACM/Route53/S3/secrets) → MFA session into `SafeBetIQPilotProvisioner`
  (trust requires `aws:MultiFactorAuthPresent=true`; MaxSession 3600).
- **IAM administration** (create roles/instance-profiles, attach policies, edit the provisioner's own
  managed policy) → the provisioner **must not** have this (no self-elevation). It requires a **separate
  owner-operated MFA-authenticated administrator** (see §3A). Do **not** fall back to the long-lived
  `safebetiq-backup-user` admin keys for routine provisioning.

### Establish the MFA provisioner session (owner shell; values typed only here)
```powershell
$MFA = "arn:aws:iam::046276255259:mfa/<your-mfa-serial>"
$c = aws sts assume-role --role-arn arn:aws:iam::046276255259:role/SafeBetIQPilotProvisioner `
      --role-session-name pilot-p2b --serial-number $MFA --token-code <6-digit-TOTP> --duration-seconds 3600 | ConvertFrom-Json
$env:AWS_ACCESS_KEY_ID=$c.Credentials.AccessKeyId; $env:AWS_SECRET_ACCESS_KEY=$c.Credentials.SecretAccessKey; $env:AWS_SESSION_TOKEN=$c.Credentials.SessionToken
aws sts get-caller-identity   # expect .../SafeBetIQPilotProvisioner/pilot-p2b
# ... run the provisioner-scoped steps ... then always clear:
# Remove-Item Env:AWS_ACCESS_KEY_ID,Env:AWS_SECRET_ACCESS_KEY,Env:AWS_SESSION_TOKEN
```

## Phase 1 — READ-ONLY preflight (provisioner or read-only session)
```powershell
aws sts get-caller-identity
# shared role still used by demo+prod:
aws elasticbeanstalk describe-configuration-settings --application-name safebet-iq-app --environment-name safebet-iq-demo  --region eu-west-1 --query "ConfigurationSettings[0].OptionSettings[?OptionName=='IamInstanceProfile'].Value|[0]"
aws elasticbeanstalk describe-configuration-settings --application-name safebet-iq-app --environment-name safebet-iq-prod  --region eu-west-1 --query "ConfigurationSettings[0].OptionSettings[?OptionName=='IamInstanceProfile'].Value|[0]"
# pilot env + secret must NOT exist yet:
aws elasticbeanstalk describe-environments --region eu-west-1 --environment-names safebet-iq-pilot --query "length(Environments[?Status!='Terminated'])"
aws secretsmanager list-secrets --region eu-west-1 --filters Key=name,Values=safebet-iq/pilot/supabase-service-role-key --query "length(SecretList)"
# shared role: confirm the Pilot-only inline policy we will remove, prod policy preserved:
aws iam get-role-policy --role-name aws-elasticbeanstalk-ec2-role --policy-name SafeBetPilotSecretRead --query "PolicyDocument"
aws iam get-role-policy --role-name aws-elasticbeanstalk-ec2-role --policy-name SafeBetSecretsManagerAccess --query "PolicyDocument.Statement[0].Resource"
```
**Abort unless:** pilot env = 0, pilot secret = 0, `SafeBetPilotSecretRead` matches `policies/pilot-ec2-secret-read.json`, and `SafeBetSecretsManagerAccess` still scopes `safebet/prod/database*`.

## 3A — Separate IAM administration from provisioning (IAM-admin bootstrap)
The provisioner's `SafeBetIQPilotProvisionerPolicy` grants EB/CodeBuild/ACM/Route53/S3/secrets but **no**
`iam:CreateRole / CreateInstanceProfile / PutRolePolicy / AttachRolePolicy / CreatePolicyVersion`. Confirm:
```powershell
aws iam simulate-principal-policy --policy-source-arn arn:aws:iam::046276255259:role/SafeBetIQPilotProvisioner `
  --action-names iam:CreateRole iam:CreateInstanceProfile iam:PutRolePolicy iam:AttachRolePolicy iam:CreatePolicyVersion `
  --query "EvaluationResults[].{a:EvalActionName,d:EvalDecision}"
```
Expect **implicitDeny** for all. The IAM changes below (§3B remove, §3C create role, §3D provisioner
PassRole) are therefore performed by a **dedicated, owner-operated, MFA-authenticated IAM administrator
principal** — NOT the provisioner and NOT routine backup-user use. Do **not** grant the provisioner IAM
admin or self-update. Preserve existing policy versions for rollback (`--set-as-default` keeps the prior
version retrievable; never delete prior versions during this pack).

## 3B — Roll back the shared-role Pilot permission (IAM admin)
**Reconfirm immediately before** (must all hold): pilot secret absent, pilot EB env absent, no workload
depends on `SafeBetPilotSecretRead`, and its body equals `policies/pilot-ec2-secret-read.json`.
```powershell
# capture BEFORE evidence (redacted — policy doc only, no secrets):
aws iam get-role-policy --role-name aws-elasticbeanstalk-ec2-role --policy-name SafeBetPilotSecretRead > evidence/before-SafeBetPilotSecretRead.json
# remove ONLY the Pilot-only inline policy:
aws iam delete-role-policy --role-name aws-elasticbeanstalk-ec2-role --policy-name SafeBetPilotSecretRead
# verify removed + prod policy + managed policies untouched:
aws iam list-role-policies --role-name aws-elasticbeanstalk-ec2-role
aws iam get-role-policy --role-name aws-elasticbeanstalk-ec2-role --policy-name SafeBetSecretsManagerAccess --query "PolicyDocument.Statement[0].Resource"
```
**Rollback of 3B** (if ever needed): `aws iam put-role-policy --role-name aws-elasticbeanstalk-ec2-role --policy-name SafeBetPilotSecretRead --policy-document file://policies/pilot-ec2-secret-read.json`.

## 3C — Create the dedicated Pilot EC2 role + instance profile (IAM admin)
```powershell
aws iam create-role --role-name safebet-iq-pilot-eb-ec2-role --assume-role-policy-document file://policies/pilot-ec2-trust.json --tags Key=project,Value=safebet-iq-pilot
aws iam attach-role-policy --role-name safebet-iq-pilot-eb-ec2-role --policy-arn arn:aws:iam::aws:policy/AWSElasticBeanstalkWebTier
aws iam put-role-policy --role-name safebet-iq-pilot-eb-ec2-role --policy-name PilotSecretRead      --policy-document file://policies/pilot-ec2-secret-read.json
aws iam put-role-policy --role-name safebet-iq-pilot-eb-ec2-role --policy-name PilotArtifactsAndLogs --policy-document file://policies/pilot-ec2-artifacts-logs.json
aws iam create-instance-profile --instance-profile-name safebet-iq-pilot-eb-ec2-profile
aws iam add-role-to-instance-profile --instance-profile-name safebet-iq-pilot-eb-ec2-profile --role-name safebet-iq-pilot-eb-ec2-role
```
Least-privilege: **no** `AmazonS3FullAccess`, **no** Prod/Demo/Guardian secret, **no** IAM admin. Idempotent
(each create is skipped/409 if it already exists — treat `EntityAlreadyExists` as success after verifying the body matches).

## 3D — Provisioner PassRole for the new role (IAM admin)
Append `safebet-iq-pilot-eb-ec2-role` to the provisioner's `PassOnlyApprovedRoles` (see
`policies/provisioner-passrole-add-pilot-ec2.json`) via a **new** policy version, keeping the prior version:
```powershell
# fetch current default version document, add the one ARN to PassOnlyApprovedRoles.Resource, save as updated.json, then:
aws iam create-policy-version --policy-arn arn:aws:iam::046276255259:policy/SafeBetIQPilotProvisionerPolicy --policy-document file://updated.json --set-as-default
```
Rollback: `aws iam set-default-policy-version --policy-arn <...> --version-id <prior>`.

## 3E — Dedicated Pilot artifact bucket + CodeBuild re-point (provisioner)
The provisioner S3 scope (`safebet-iq-pilot-*`) and the CodeBuild role expect a **dedicated** bucket, not the
shared `safebet-iq-deployments-eu`. Create and re-point:
```powershell
aws s3api create-bucket --bucket safebet-iq-pilot-build --region eu-west-1 --create-bucket-configuration LocationConstraint=eu-west-1
aws s3api put-public-access-block --bucket safebet-iq-pilot-build --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws s3api put-bucket-versioning --bucket safebet-iq-pilot-build --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption --bucket safebet-iq-pilot-build --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
# re-upload the governed source (from the reviewed SHA, produced by git archive of SafeBetdemo-main/):
aws s3api put-object --bucket safebet-iq-pilot-build --key pilot/source/<REVIEWED_SHA>.zip --body <REVIEWED_SHA>.zip --content-type application/zip
# re-point the project source+artifacts to the dedicated bucket:
aws codebuild update-project --name safebet-iq-pilot-node20-build --region eu-west-1 `
  --source "type=S3,location=safebet-iq-pilot-build/pilot/source/<REVIEWED_SHA>.zip,buildspec=deploy/buildspec-pilot.yml" `
  --artifacts "type=S3,location=safebet-iq-pilot-build,path=pilot/build,name=safebet-iq-pilot.zip,packaging=ZIP"
```
`<REVIEWED_SHA>` = the commit this PR produces on `feat/iq-pilot-m1a-baseline` once merged (the new application
authority). Set the project-level `SAFEBET_APP_COMMIT` to that same SHA.

## CodeBuild override controls (defence in depth)
IAM cannot condition `StartBuild` on override **values**. Mitigations: restrict `codebuild:StartBuild`/`UpdateProject`
on this project to the provisioner only; the buildspec `SAFEBET_GIT_COMMIT==SAFEBET_APP_COMMIT` + exact-URL guards;
**versioned** `safebet-iq-pilot-build`; and a post-build check that `version.json.gitCommit` equals the authorised SHA.

## Post-apply verification
```powershell
aws iam list-role-policies --role-name aws-elasticbeanstalk-ec2-role                    # SafeBetPilotSecretRead gone; prod preserved
aws iam get-instance-profile --instance-profile-name safebet-iq-pilot-eb-ec2-profile --query "InstanceProfile.Roles[].RoleName"
aws iam list-role-policies --role-name safebet-iq-pilot-eb-ec2-role
aws iam simulate-principal-policy --policy-source-arn arn:aws:iam::046276255259:role/safebet-iq-pilot-eb-ec2-role --action-names secretsmanager:GetSecretValue --resource-arns arn:aws:secretsmanager:eu-west-1:046276255259:secret:safebet/prod/database-ABCDEF --query "EvaluationResults[].EvalDecision"  # expect implicitDeny (no prod secret)
aws s3api get-bucket-versioning --bucket safebet-iq-pilot-build
```
Generate **redacted** evidence (policy docs + decisions only; no secret values, no tokens) under `./evidence/`.

## Secret entry (owner, AWS Console — ONLY AFTER 3B+3C complete)
Secrets Manager → Store a new secret → Other/Plaintext = the Pilot service-role key (Console only) → key
`aws/secretsmanager` (default) → name `safebet-iq/pilot/supabase-service-role-key`. Never via CLI/shell/GitHub/
CodeBuild/plain EB env. EB later references it via `aws:elasticbeanstalk:application:environmentsecrets`
→ `SUPABASE_SERVICE_ROLE_KEY` = the secret ARN, read by `safebet-iq-pilot-eb-ec2-role`.

## Rollback (whole pack)
3B: re-`put-role-policy` the Pilot policy. 3C: `remove-role-from-instance-profile`/`delete-instance-profile`/
`delete-role-policy`/`detach-role-policy`/`delete-role`. 3D: `set-default-policy-version` to the prior version.
3E: `delete-bucket` (empty) + `update-project` back to prior source. No Demo/Prod resource is modified at any step.

## Blockers cleared when complete
Dedicated least-privilege Pilot EC2 role (no cross-env secret), shared role restored to pre-P2B state,
provisioner PassRole updated, dedicated versioned Pilot bucket + CodeBuild re-pointed, exact-URL guards in
code+build (this PR). Only then: populate the secret, then the governed build + EB env + DNS ALIAS.
