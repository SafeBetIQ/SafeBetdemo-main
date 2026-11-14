// M1B-P1 B-1 IAM gate: recovery-safe design (static; no AWS, no execution).
// Covers: central AWS-CLI failure handling, BOM-free policy transport, Access Analyzer pre-check,
// resume/idempotency, ownership-aware rollback, evidence timing, and secret/TOTP redaction.
// Run: node --test tests/pilotB1IamGate.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const IAM = '../../deploy/pilot/m1b-p1/iam/';
const read = (f) => readFileSync(new URL(IAM + f, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const code = (s) => s.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
const noApiName = (s) => code(s).replace(/GetSessionToken/g, '').replace(/get-session-token/g, '');
const COMMON = read('B1-common.ps1');
const APPLY = read('B1-apply.ps1');
const ROLLBACK = read('B1-rollback.ps1');
const PILOT = 'arn:aws:iam::046276255259:role/safebet-iq-pilot-codebuild-role';
const SECRET_FIELDS = ['AccessKeyId', 'SecretAccessKey', 'SessionToken'];

test('1. aws non-zero exit => Invoke-Aws throws (not just $ErrorActionPreference)', () => {
  assert.match(COMMON, /function Invoke-Aws/);
  assert.match(COMMON, /if \(\$LASTEXITCODE -ne 0\) \{ throw "AWS CLI failed \(exit \$LASTEXITCODE\)/);
  // mutations go through the wrapper (no raw `aws iam create-policy-version | Out-Null`).
  assert.ok(!/\naws iam (create-policy-version|create-role|set-default-policy-version|delete-role)/.test(APPLY + ROLLBACK), 'no un-wrapped mutating aws call');
  assert.match(APPLY, /Invoke-Aws @\('iam','create-policy-version'/);
});

test('2. no success message can be emitted after a failed create-policy-version', () => {
  const iCreate = APPLY.indexOf("Invoke-Aws @('iam','create-policy-version'");
  const iReadback = APPLY.indexOf('new Pilot CodeBuild role missing from PassRole');
  const iSuccess = APPLY.indexOf('amended and CONFIRMED');
  assert.ok(iCreate > 0 && iReadback > iCreate && iSuccess > iReadback,
    'create -> read-back verification -> success message, in that order');
  // The old premature "amended ... set as default" message is gone.
  assert.ok(!/amended \(added only the Pilot CodeBuild role; set as default\)/.test(APPLY));
});

test('3. the candidate provisioner policy is validated locally as JSON before apply', () => {
  assert.match(APPLY, /\$json \| ConvertFrom-Json/, 'local JSON round-trip validation');
});

test('4. candidate differs from current only by the one Pilot role ARN', () => {
  assert.match(APPLY, /\$added\s*=\s*@\(\$newPass \| Where-Object \{ \$curPass -notcontains \$_ \}\)/);
  assert.match(APPLY, /\$added\)\.Count -ne 1 -or \$added\[0\] -ne \$ROLE_ARN.*throw/s);
  assert.match(APPLY, /\$probe\.Statement\[\$ni\]\.Resource = \$curPass/);
  assert.match(APPLY, /\(CanonJson \$probe\) -ne \(CanonJson \$curDoc\).*throw/s, 'rest of the document must be identical');
});

test('5. candidate PassRole stays an array', () => {
  assert.match(APPLY, /\$newDoc\.Statement\[\$ni\]\.Resource = @\(\$curPass \+ \$ROLE_ARN\)/);
});

test('6. no wildcard PassRole', () => {
  assert.match(APPLY, /\$curPass -contains '\*'.*throw/s);
  assert.match(APPLY, /\$resN -contains '\*'.*throw/s);
});

test('7. temporary policy file is UTF-8 without BOM', () => {
  assert.match(COMMON, /function Write-Utf8NoBom/);
  assert.match(COMMON, /New-Object System\.Text\.UTF8Encoding\(\$false\)/);
  assert.match(APPLY, /Write-Utf8NoBom \$tmpFile \$json/);
  assert.match(APPLY, /ReadAllBytes\(\$tmpFile\)\)\[0\] -eq 0xEF.*throw/s, 'BOM self-check');
  // The BOM-prone Set-Content -Encoding utf8 is NOT used for the policy document.
  assert.ok(!/Set-Content \$tmp\w* -Encoding utf8/.test(APPLY), 'no Set-Content utf8 for the policy temp file');
});

test('8. an existing EXACT Pilot CodeBuild role resumes safely (no overwrite)', () => {
  assert.match(APPLY, /\$ev\.role_action = 'preexisting_verified'/);
  assert.match(APPLY, /already exists - verifying exact match \(no overwrite\)/);
  assert.ok(!/create-role/.test(APPLY.slice(APPLY.indexOf('already exists'), APPLY.indexOf('} else {'))), 'no create in the exists branch');
});

test('9. an existing DRIFTED role aborts', () => {
  assert.match(APPLY, /existing role trust differs from approved trust\.json \(drift\).*throw|throw 'ABORT: existing role trust differs/);
  assert.match(APPLY, /existing inline policy differs from approved policy\.json \(drift\)/);
});

test('10. v1 unchanged + Pilot role absent => additive amendment path', () => {
  const branch = APPLY.slice(APPLY.indexOf("} else {\n    # Build the additive candidate"));
  assert.match(branch, /Invoke-Aws @\('iam','create-policy-version'/);
  assert.match(APPLY, /\$ev\.passrole_action = 'added'/);
});

test('11. Pilot role already present => idempotent verified path (no new version)', () => {
  const idem = APPLY.slice(APPLY.indexOf("if (\$curPass -contains \$ROLE_ARN) {"), APPLY.indexOf('} else {\n    # Build the additive candidate'));
  assert.match(idem, /passrole_action = 'preexisting_verified'/);
  assert.ok(!/create-policy-version/.test(idem), 'no create-policy-version on the idempotent path');
});

test('12. unexpected provisioner-policy drift aborts', () => {
  assert.match(APPLY, /unexpected PassRole roles present.*throw|throw "ABORT \(drift\): unexpected PassRole roles present/);
  assert.match(APPLY, /expected existing PassRole role missing/);
});

test('13. the temporary policy file is removed in finally', () => {
  assert.match(APPLY, /\nfinally \{[\s\S]*if \(\$tmpFile -and \(Test-Path \$tmpFile\)\) \{ Remove-Item \$tmpFile -Force/);
});

test('14. MFA session cleanup remains mandatory in both scripts', () => {
  for (const s of [APPLY, ROLLBACK]) assert.match(s, /\nfinally \{[\s\S]*Clear-MfaSession/);
  for (const v of ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN']) assert.ok(COMMON.includes(v));
});

test('15. no AWS secret or TOTP is written to disk or evidence', () => {
  for (const v of SECRET_FIELDS) {
    assert.ok(!noApiName(APPLY).includes(v), `apply must not reference ${v}`);
    assert.ok(!noApiName(ROLLBACK).includes(v), `rollback must not reference ${v}`);
  }
  // The returned MFA evidence hashtable carries none of the credential field names.
  const ret = COMMON.slice(COMMON.indexOf('return [ordered]@{'), COMMON.indexOf('function Clear-MfaSession'));
  for (const v of SECRET_FIELDS) assert.ok(!noApiName(ret).includes(v));
  // TOTP interactive-only and cleared; ownership marker records no secret.
  assert.match(COMMON, /Read-Host -AsSecureString/);
  assert.match(COMMON, /\$code = \$null/);
  assert.ok(!/role_created_by_b1[\s\S]{0,120}(AccessKey|Secret|Token|code)/i.test(APPLY), 'ownership marker has no secret');
});

// --- carried essentials: exact identities, serial, duration, additive/rollback behaviour ---
test('exact base identity, MFA serial, 900s duration, bootstrap-only --profile', () => {
  assert.ok(COMMON.includes("UserArn   = 'arn:aws:iam::046276255259:user/safebetiq-backup-user'"));
  assert.ok(COMMON.includes("MfaSerial = 'arn:aws:iam::046276255259:mfa/safebetiq-backup-user-mfa'"));
  assert.ok(COMMON.includes('Duration  = 900'));
  assert.ok(!/--profile/.test(code(APPLY)) && !/--profile/.test(code(ROLLBACK)), 'no --profile in apply/rollback');
  assert.match(ROLLBACK, /set-default-policy-version','--policy-arn',\$PROV_POL,'--version-id',\$prior/);
  assert.match(ROLLBACK, /B-1 ownership is NOT established/);
});
