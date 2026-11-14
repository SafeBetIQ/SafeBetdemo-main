// M1B-P1 B-1 IAM gate: recovery-safe + semantic-delta finalizer (static + behavioral).
// Static text checks always run. Behavioral checks exercise Assert-AdditivePassRoleDelta via Windows
// PowerShell and auto-skip where PowerShell is unavailable (e.g. Linux CI).
// Run: node --test tests/pilotB1IamGate.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const IAM = '../../deploy/pilot/m1b-p1/iam/';
const read = (f) => readFileSync(new URL(IAM + f, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const code = (s) => s.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
const noApiName = (s) => code(s).replace(/GetSessionToken/g, '').replace(/get-session-token/g, '');
const COMMON = read('B1-common.ps1');
const APPLY = read('B1-apply.ps1');
const ROLLBACK = read('B1-rollback.ps1');
const COMMON_PATH = fileURLToPath(new URL(IAM + 'B1-common.ps1', import.meta.url));
const ACC = '046276255259';
const PILOT = `arn:aws:iam::${ACC}:role/safebet-iq-pilot-codebuild-role`;
const SECRET_FIELDS = ['AccessKeyId', 'SecretAccessKey', 'SessionToken'];

// ---- behavioral harness (PowerShell) ----
function hasPowerShell() {
  try { return spawnSync('powershell', ['-NoProfile', '-Command', '1'], { encoding: 'utf8' }).status === 0; }
  catch { return false; }
}
const PS = hasPowerShell();
const skipPS = PS ? false : 'PowerShell unavailable (behavioral delta checks run on the owner Windows host)';
function delta(prior, next) {
  const q = (o) => JSON.stringify(o).replace(/'/g, "''");
  const script = `$ErrorActionPreference='Stop'; . '${COMMON_PATH.replace(/'/g, "''")}' | Out-Null;`
    + `$p='${q(prior)}' | ConvertFrom-Json; $n='${q(next)}' | ConvertFrom-Json;`
    + `try { Assert-AdditivePassRoleDelta $p $n '${PILOT}'; 'PASS' } catch { 'THROW' }`;
  return (spawnSync('powershell', ['-NoProfile', '-Command', script], { encoding: 'utf8' }).stdout || '').trim();
}
const clone = (o) => JSON.parse(JSON.stringify(o));
const BASE = {
  Version: '2012-10-17',
  Statement: [
    { Sid: 'PassOnlyApprovedRoles', Effect: 'Allow', Action: 'iam:PassRole',
      Resource: [`arn:aws:iam::${ACC}:role/aws-elasticbeanstalk-ec2-role`, `arn:aws:iam::${ACC}:role/aws-elasticbeanstalk-service-role`, `arn:aws:iam::${ACC}:role/SafeBetDemoCodeBuildRole`] },
    { Sid: 'ServiceLinkedRolesForEB', Effect: 'Allow', Action: 'iam:CreateServiceLinkedRole', Resource: '*',
      Condition: { StringEquals: { 'iam:AWSServiceName': ['elasticbeanstalk.amazonaws.com', 'autoscaling.amazonaws.com', 'elasticloadbalancing.amazonaws.com'] } } },
    { Sid: 'Secrets', Effect: 'Allow', Action: ['secretsmanager:CreateSecret'], Resource: `arn:aws:secretsmanager:eu-west-1:${ACC}:secret:safebet-iq/pilot/*` },
  ],
};
const addPilot = (d) => { const c = clone(d); c.Statement[0].Resource = [...c.Statement[0].Resource, PILOT]; return c; };

test('1. pre-existing approved iam:CreateServiceLinkedRole does NOT trigger a false positive', { skip: skipPS }, () => {
  assert.equal(delta(BASE, addPilot(BASE)), 'PASS');
  assert.ok(!/policy now contains IAM administrative actions/.test(APPLY), 'the absolute iam: check is removed');
});
test('2. a newly ADDED IAM administrative action aborts', { skip: skipPS }, () => {
  const n = addPilot(BASE); n.Statement[1].Action = ['iam:CreateServiceLinkedRole', 'iam:CreateUser'];
  assert.equal(delta(BASE, n), 'THROW');
});
test('3. changing the allowed service-linked-role service list aborts', { skip: skipPS }, () => {
  const n = addPilot(BASE); n.Statement[1].Condition.StringEquals['iam:AWSServiceName'].push('ec2.amazonaws.com');
  assert.equal(delta(BASE, n), 'THROW');
});
test('4. broadening the CreateServiceLinkedRole condition aborts', { skip: skipPS }, () => {
  const n = addPilot(BASE); delete n.Statement[1].Condition;
  assert.equal(delta(BASE, n), 'THROW');
});
test('5. removing a prior IAM action aborts', { skip: skipPS }, () => {
  const n = addPilot(BASE); n.Statement.splice(1, 1);
  assert.equal(delta(BASE, n), 'THROW');
});
test('6. only the Pilot PassRole ARN delta is accepted (extra role / no-op / wildcard abort)', { skip: skipPS }, () => {
  const extra = addPilot(BASE); extra.Statement[0].Resource.push(`arn:aws:iam::${ACC}:role/some-other-role`);
  assert.equal(delta(BASE, extra), 'THROW');
  assert.equal(delta(BASE, clone(BASE)), 'THROW');            // no delta at all
  const wild = clone(BASE); wild.Statement[0].Resource = ['*'];
  assert.equal(delta(BASE, wild), 'THROW');                   // wildcard
});

test('7. exact current (v2) resumes idempotently without creating a new version', () => {
  const idem = APPLY.slice(APPLY.indexOf('if ($curPass -contains $ROLE_ARN) {'), APPLY.indexOf('} else {\n    # ADDITIVE'));
  assert.match(idem, /passrole_action = 'preexisting_verified'/);
  assert.match(idem, /no new version created/);
  assert.ok(!/create-policy-version/.test(idem), 'idempotent path creates no new version');
  assert.match(idem, /Assert-AdditivePassRoleDelta \$d \$curDoc \$ROLE_ARN/, 'proves the existing v2 is the additive delta vs a prior version');
});
test('8. simulations still run (and precede evidence) on every path', () => {
  const iSim = APPLY.indexOf("SimDecision \$PROV_ROLE 'iam:PassRole' \$ROLE_ARN");
  const iEv = APPLY.indexOf('EVIDENCE (ONLY after every check');
  assert.ok(iSim > 0 && iEv > iSim, 'simulations before evidence');
  for (const s of ['cb_demo_secret', 'cb_prod_secret', 'cb_route53', 'cb_eb_deploy', 'cb_iam_createrole']) assert.ok(APPLY.includes(s));
});
test('9. evidence written only after simulations; records version + action fields; no secrets', () => {
  assert.match(APPLY, /current_policy_version = \$ev\.provisioner_new_version/);
  assert.match(APPLY, /prior_policy_version   = \$ev\.provisioner_prior_version/);
  assert.match(APPLY, /Set-Content \$EVIDENCE -Encoding ascii/);
  for (const v of SECRET_FIELDS) assert.ok(!noApiName(APPLY).includes(v));
});

// ---- carried recovery/essentials (static) ----
test('native AWS failure handling + BOM-free transport retained', () => {
  assert.match(COMMON, /function Invoke-Aws/);
  assert.match(COMMON, /if \(\$LASTEXITCODE -ne 0\) \{ throw "AWS CLI failed/);
  assert.match(COMMON, /New-Object System\.Text\.UTF8Encoding\(\$false\)/);
  assert.match(APPLY, /Write-Utf8NoBom \$tmpFile \$json/);
  assert.match(APPLY, /ReadAllBytes\(\$tmpFile\)\)\[0\] -eq 0xEF.*throw/s);
  assert.ok(!/Set-Content \$tmp\w* -Encoding utf8/.test(APPLY));
  assert.match(APPLY, /Invoke-Aws @\('iam','create-policy-version'/);
});
test('semantic-delta verifier is defined and used for candidate + read-back', () => {
  assert.match(COMMON, /function Assert-AdditivePassRoleDelta/);
  assert.ok((APPLY.match(/Assert-AdditivePassRoleDelta/g) || []).length >= 2, 'used for candidate and applied read-back');
});
test('exact identities, serial, 900s, bootstrap-only --profile, MFA cleanup, ownership-preserving rollback', () => {
  assert.ok(COMMON.includes("UserArn   = 'arn:aws:iam::046276255259:user/safebetiq-backup-user'"));
  assert.ok(COMMON.includes("MfaSerial = 'arn:aws:iam::046276255259:mfa/safebetiq-backup-user-mfa'"));
  assert.ok(COMMON.includes('Duration  = 900'));
  assert.ok(!/--profile/.test(code(APPLY)) && !/--profile/.test(code(ROLLBACK)));
  for (const s of [APPLY, ROLLBACK]) assert.match(s, /\nfinally \{[\s\S]*Clear-MfaSession/);
  assert.match(ROLLBACK, /B-1 ownership is NOT established/);
});
