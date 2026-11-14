// M1B-P1 B-1 IAM gate: MFA-backed temporary-session enforcement (static; no AWS, no execution).
// Run: node --test tests/pilotB1IamGate.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const IAM = '../../deploy/pilot/m1b-p1/iam/';
const read = (f) => readFileSync(new URL(IAM + f, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// Code with full-line comments stripped (so explanatory comments that mention --profile don't register).
const code = (s) => s.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
// Remove the literal API name so "SessionToken" inside "GetSessionToken" is not a false match.
const noApiName = (s) => code(s).replace(/GetSessionToken/g, '').replace(/get-session-token/g, '');
const COMMON = read('B1-common.ps1');
const APPLY = read('B1-apply.ps1');
const ROLLBACK = read('B1-rollback.ps1');
const TRUST = read('safebet-iq-pilot-codebuild-role.trust.json');
const POLICY = read('safebet-iq-pilot-codebuild-role.policy.json');
const MFA_SERIAL = 'arn:aws:iam::046276255259:mfa/safebetiq-backup-user-mfa';
const SECRET_FIELDS = ['AccessKeyId', 'SecretAccessKey', 'SessionToken'];

// Mutating IAM verbs that must run under the MFA session (never --profile default).
const MUTATORS = ['create-role', 'put-role-policy', 'create-policy-version', 'set-default-policy-version',
  'delete-policy-version', 'delete-role-policy', 'delete-role'];

test('1. direct mutation with only --profile default is impossible (apply/rollback never pass --profile)', () => {
  assert.ok(!/--profile/.test(code(APPLY)), 'B1-apply.ps1 must not pass --profile (uses the MFA session env creds)');
  assert.ok(!/--profile/.test(code(ROLLBACK)), 'B1-rollback.ps1 must not pass --profile');
  // The only --profile default usage is the bootstrap in B1-common, and never on a mutating IAM verb.
  for (const l of code(COMMON).split('\n').filter((x) => x.includes('--profile'))) {
    assert.ok(!MUTATORS.some((m) => l.includes(`iam ${m}`)), `bootstrap --profile line must not mutate: ${l}`);
  }
  assert.ok(!/\biam (create-role|put-role-policy|create-policy-version|delete-role)\b/.test(COMMON), 'B1-common performs no IAM mutation');
});

test('2. the EXACT registered MFA serial is required (not merely any device)', () => {
  assert.ok(COMMON.includes(`MfaSerial = '${MFA_SERIAL}'`), 'exact MFA serial pinned');
  assert.match(COMMON, /Assert-ExactMfaSerial/);
  assert.match(COMMON, /\$serials -notcontains \$B1\.MfaSerial.*throw/s, 'aborts unless the exact serial is attached');
  // GetSessionToken must use that exact serial.
  assert.match(COMMON, /get-session-token --serial-number \$B1\.MfaSerial --token-code/);
});

test('3. a failed GetSessionToken aborts BEFORE any mutation', () => {
  assert.match(COMMON, /GetSessionToken failed/);
  assert.match(COMMON, /did not return temporary credentials/);
  // In both scripts New-MfaSession is invoked before the try{} that contains the mutations.
  for (const s of [APPLY, ROLLBACK]) {
    const iSession = s.indexOf('New-MfaSession');
    const iTry = s.indexOf('\ntry {');
    assert.ok(iSession > 0 && iTry > iSession, 'New-MfaSession precedes the mutation try-block');
  }
});

test('4. temporary credentials are used for mutation', () => {
  assert.match(COMMON, /\$env:AWS_ACCESS_KEY_ID\s*=\s*\$c\.AccessKeyId/);
  assert.match(COMMON, /\$env:AWS_SECRET_ACCESS_KEY\s*=\s*\$c\.SecretAccessKey/);
  assert.match(COMMON, /\$env:AWS_SESSION_TOKEN\s*=\s*\$c\.SessionToken/);
  // Mutating verbs appear in the scripts and (per test 1) carry no --profile, so they use the env session.
  for (const m of ['create-role', 'create-policy-version']) assert.ok(APPLY.includes(`iam ${m}`), `apply uses ${m}`);
  for (const m of ['set-default-policy-version', 'delete-role']) assert.ok(ROLLBACK.includes(`iam ${m}`), `rollback uses ${m}`);
});

test('5. temporary credentials are cleared in finally (both scripts)', () => {
  assert.match(COMMON, /function Clear-MfaSession/);
  for (const v of ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN']) {
    assert.ok(COMMON.includes(v), `Clear-MfaSession removes ${v}`);
  }
  assert.match(COMMON, /Remove-Item "env:\$v"/);
  for (const s of [APPLY, ROLLBACK]) {
    assert.match(s, /\nfinally \{[\s\S]*Clear-MfaSession[\s\S]*\}/, 'finally block clears the MFA session');
  }
});

test('6. the TOTP code is prompted interactively and never persisted/logged/written to evidence', () => {
  assert.match(COMMON, /Read-Host -AsSecureString/);
  assert.match(COMMON, /\$code = \$null/, 'plaintext TOTP cleared');
  // No evidence/return field carries the code; no param intake of a token-code.
  assert.ok(!/\[Parameter.*\].*\$TokenCode/i.test(APPLY + ROLLBACK), 'TOTP is not a script parameter');
  const ret = COMMON.slice(COMMON.indexOf('return [ordered]@{'));
  for (const bad of ['token', 'totp', 'code']) assert.ok(!new RegExp(`\\b${bad}\\b\\s*=`, 'i').test(ret.split('}')[0]), `evidence has no ${bad} field`);
});

test('7. AccessKeyId/SecretAccessKey/SessionToken are never written to evidence or logged', () => {
  // Apply/rollback must not reference the credential field names at all (ignoring the API name GetSessionToken).
  for (const v of SECRET_FIELDS) {
    assert.ok(!noApiName(APPLY).includes(v), `apply must not reference ${v}`);
    assert.ok(!noApiName(ROLLBACK).includes(v), `rollback must not reference ${v}`);
  }
  // In B1-common the credential fields appear ONLY in the env assignment, never in the returned evidence hashtable.
  const ret = COMMON.slice(COMMON.indexOf('return [ordered]@{'), COMMON.indexOf('function Clear-MfaSession'));
  for (const v of SECRET_FIELDS) assert.ok(!noApiName(ret).includes(v), `returned evidence must not contain ${v}`);
  // No Write-Host of credentials.
  assert.ok(!/Write-Host[^\n]*\$env:AWS_(ACCESS_KEY_ID|SECRET_ACCESS_KEY|SESSION_TOKEN)/.test(COMMON + APPLY + ROLLBACK), 'credentials never echoed');
});

test('8. existing trust/policy/PassRole/rollback behaviour is unchanged', () => {
  // Trust + policy scopes intact.
  assert.match(TRUST, /"Service": "codebuild\.amazonaws\.com"/);
  assert.match(POLICY, /\/aws\/codebuild\/safebet-iq-pilot-node20-build/);
  assert.ok(!/secretsmanager|AdministratorAccess|iam:/.test(POLICY), 'CodeBuild policy has no secrets/admin/iam');
  // Apply still does additive PassRole + drift checks + simulations.
  assert.match(APPLY, /\$pass\[0\]\.Resource = @\(\$res \+ \$ROLE_ARN\)/, 'additive PassRole only');
  assert.match(APPLY, /PassRole became wildcard/);
  assert.match(APPLY, /simulate-principal-policy/);
  assert.match(APPLY, /existing inline policy differs from approved policy\.json \(drift\)/);
  // Rollback still drift-refuses + restores prior version + deletes role.
  assert.match(ROLLBACK, /set-default-policy-version --policy-arn \$PROV_POL --version-id \$prior/);
  assert.match(ROLLBACK, /current adds more than just the Pilot CodeBuild role/);
  assert.match(ROLLBACK, /statements other than PassRole differ/);
  assert.match(ROLLBACK, /iam delete-role --role-name \$ROLE/);
});
