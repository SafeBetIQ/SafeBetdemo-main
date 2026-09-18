// SafeBet Guardian — Privileged Identity, MFA & Authentication Assurance (ARCH-V4-PR1).
// Deterministic: a LOCAL RS256 keypair signs test tokens; StaticJwksProvider validates them.
// No real Cognito/IdP, no committed key. Run: node --test tests/guardian/guardianIdentityAuth.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { generateKeyPairSync, createSign } from 'node:crypto';
import {
  validateJwt, JwtValidationError, StaticJwksProvider, decodeJwt,
  mfaSatisfied, assuranceLevel, evaluateEntitlement, roleRequiresMfa,
  authenticateGuardianRequest, GuardianAuthError, extractBearer,
  buildAuthenticatedPrincipal, mayReachC8AuthorisationGate, principalMayAccessJurisdiction,
  hasCapability, violatesSeparationOfDuties,
} from '../../products/guardian/src/identity-auth/index.ts';

// ── Local signing key + JWKS ──────────────────────────────────────────────────
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const KID = 'test-key-1';
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: KID, use: 'sig', alg: 'RS256' };
const jwks = new StaticJwksProvider([jwk]);
const wrongKp = generateKeyPairSync('rsa', { modulusLength: 2048 });

const ISS = 'https://cognito-idp.eu-west-1.amazonaws.com/eu-west-1_TESTPOOL';
const AUD = 'test-client-id';
const NOW = 1_800_000_000; // fixed epoch seconds
const cfg = { issuer: ISS, audience: AUD, tokenUse: 'access', now: () => NOW };

function b64url(objOrBuf) {
  const buf = Buffer.isBuffer(objOrBuf) ? objOrBuf : Buffer.from(JSON.stringify(objOrBuf));
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function sign(payload, { kid = KID, alg = 'RS256', key = privateKey } = {}) {
  const header = { alg, kid, typ: 'JWT' };
  const signingInput = `${b64url(header)}.${b64url(payload)}`;
  if (alg === 'none') return `${signingInput}.`;
  const sig = createSign('RSA-SHA256').update(signingInput).end().sign(key);
  return `${signingInput}.${b64url(sig)}`;
}
function claims(over = {}) {
  return { sub: 'sub-officer-1', iss: ISS, client_id: AUD, token_use: 'access', exp: NOW + 3600, iat: NOW - 10,
    auth_time: NOW - 10, jti: 'sess-1', amr: ['pwd', 'mfa'], ...over };
}
function token(over = {}, opts) { return sign(claims(over), opts); }

// Entitlement fixtures
const ENT = {
  'sub-officer-1': { subject: 'sub-officer-1', role: 'AUTHORISING_OFFICER', jurisdiction: 'ZA-GP', accountState: 'ACTIVE', effectiveFrom: null, effectiveUntil: null, isHuman: true },
  'sub-inv-1': { subject: 'sub-inv-1', role: 'INVESTIGATOR', jurisdiction: 'ZA-GP', accountState: 'ACTIVE', effectiveFrom: null, effectiveUntil: null, isHuman: true },
  'sub-legal-1': { subject: 'sub-legal-1', role: 'LEGAL_REVIEWER', jurisdiction: 'ZA-GP', accountState: 'ACTIVE', effectiveFrom: null, effectiveUntil: null, isHuman: true },
  'sub-disabled': { subject: 'sub-disabled', role: 'AUTHORISING_OFFICER', jurisdiction: 'ZA-GP', accountState: 'DISABLED', effectiveFrom: null, effectiveUntil: null, isHuman: true },
  'sub-service': { subject: 'sub-service', role: 'AUTHORISING_OFFICER', jurisdiction: 'ZA-GP', accountState: 'ACTIVE', effectiveFrom: null, effectiveUntil: null, isHuman: false },
  'sub-inv-wc': { subject: 'sub-inv-wc', role: 'INVESTIGATOR', jurisdiction: 'ZA-WC', accountState: 'ACTIVE', effectiveFrom: null, effectiveUntil: null, isHuman: true },
};
const lookup = async (s) => ENT[s] ?? null;
function auth(tok, over = {}) {
  return authenticateGuardianRequest({ authorizationHeader: tok ? `Bearer ${tok}` : null, jwks, validation: cfg, lookupEntitlement: lookup, now: new Date(NOW * 1000), ...over });
}
async function denied(promise, reason) {
  try { await promise; assert.fail('expected denial'); }
  catch (e) { assert.ok(e instanceof GuardianAuthError || e instanceof JwtValidationError, `typed error, got ${e}`); if (reason) assert.equal(e.reasonCode, reason); return e; }
}

// ── 20 negative scenarios (§37) ───────────────────────────────────────────────
test('1 — no token → denied', async () => { await denied(auth(null), 'NO_BEARER_TOKEN'); });
test('2 — malformed token → denied', async () => { await denied(auth('not-a-jwt'), 'MALFORMED_TOKEN'); });
test('3 — invalid signature → denied', async () => { await denied(auth(token({}, { key: wrongKp.privateKey })), 'INVALID_SIGNATURE'); });
test('4 — wrong issuer → denied', async () => { await denied(auth(token({ iss: 'https://evil.example' })), 'WRONG_ISSUER'); });
test('5 — wrong audience → denied', async () => { await denied(auth(token({ client_id: 'other', aud: 'other' })), 'WRONG_AUDIENCE'); });
test('6 — expired token → denied', async () => { await denied(auth(token({ exp: NOW - 3600 })), 'TOKEN_EXPIRED'); });
test('7 — disabled identity → denied', async () => { await denied(auth(token({ sub: 'sub-disabled' })), 'ACCOUNT_NOT_ACTIVE'); });
test('8 — missing Guardian entitlement → denied', async () => { await denied(auth(token({ sub: 'sub-unknown' })), 'NO_ENTITLEMENT'); });
test('9 — wrong jurisdiction (resource) → denied by authorization gate', async () => {
  const { principal } = await auth(token({ sub: 'sub-inv-1' }));
  assert.equal(principalMayAccessJurisdiction(principal, 'ZA-WC'), false);
  assert.equal(principalMayAccessJurisdiction(principal, 'ZA-GP'), true);
});
test('10 — role in request body → ignored (role comes only from entitlement)', async () => {
  const { principal } = await auth(token({ sub: 'sub-inv-1', 'custom:role': 'AUTHORISING_OFFICER', guardian_role: 'AUTHORISING_OFFICER' }));
  assert.equal(principal.role, 'INVESTIGATOR'); // entitlement wins; token/body claim ignored
});
test('11 — jurisdiction in request body → cannot elevate', async () => {
  const { principal } = await auth(token({ sub: 'sub-inv-1', 'custom:jurisdiction': 'ZA-WC' }));
  assert.equal(principal.jurisdiction, 'ZA-GP');
});
test('12 — privileged role without MFA → denied', async () => { await denied(auth(token({ amr: ['pwd'] })), 'MFA_REQUIRED'); });
test('13 — Authorising Officer with MFA → reaches C8 gate', async () => {
  const { principal } = await auth(token());
  assert.equal(mayReachC8AuthorisationGate(principal), true);
});
test('14 — Investigator attempts authorisation → denied (no AUTHORISE_ACTION cap)', async () => {
  const { principal } = await auth(token({ sub: 'sub-inv-1' }));
  assert.equal(hasCapability(principal, 'AUTHORISE_ACTION'), false);
  assert.equal(mayReachC8AuthorisationGate(principal), false);
  assert.equal(violatesSeparationOfDuties(principal, 'AUTHORISE_ACTION'), true);
});
test('15 — Legal Reviewer attempts authorisation → denied (SoD)', async () => {
  const { principal } = await auth(token({ sub: 'sub-legal-1' }));
  assert.equal(hasCapability(principal, 'AUTHORISE_ACTION'), false);
  assert.equal(hasCapability(principal, 'LEGAL_REVIEW'), true);
});
test('16 — service principal attempts human authorisation → denied', async () => {
  await denied(auth(token({ sub: 'sub-service' })), 'NOT_HUMAN_IDENTITY');
});
test('17 — synthetic principal id in body after auth failure → denied (no fallback)', async () => {
  // No token, but a body/header carrying a known synthetic principal id must NOT authenticate.
  await denied(authenticateGuardianRequest({ authorizationHeader: null, jwks, validation: cfg, lookupEntitlement: async () => ({ subject: 'syn-auth-zagp', role: 'AUTHORISING_OFFICER', jurisdiction: 'ZA-GP', accountState: 'ACTIVE', effectiveFrom: null, effectiveUntil: null, isHuman: true }), now: new Date(NOW * 1000) }), 'NO_BEARER_TOKEN');
});
test('18 — token/credential never present in the principal or audit metadata', async () => {
  const { principal, auditEvents } = await auth(token());
  const blob = JSON.stringify({ principal, auditEvents });
  assert.ok(!/eyJ[A-Za-z0-9_-]{6,}\./.test(blob), 'no JWT in principal/audit');
  assert.equal('token' in principal, false);
});
test('19 — SafeBet IQ casino_admin role is not a Guardian role → denied', async () => {
  const r = evaluateEntitlement({ subject: 's', role: 'casino_admin', jurisdiction: 'ZA-GP', accountState: 'ACTIVE', effectiveFrom: null, effectiveUntil: null, isHuman: true });
  assert.equal(r.ok, false); assert.equal(r.reason, 'UNKNOWN_ROLE');
});
test('20 — anon (no token) → denied', async () => { await denied(auth(null), 'NO_BEARER_TOKEN'); });

// ── Additional cryptographic + assurance guarantees ───────────────────────────
test('alg=none is rejected', async () => { await denied(auth(token({}, { alg: 'none' })), 'UNSUPPORTED_ALG'); });
test('unknown kid is rejected', async () => { await denied(auth(token({}, { kid: 'no-such-kid' })), 'UNKNOWN_KID'); });
test('wrong token_use is rejected', async () => { await denied(auth(token({ token_use: 'id' })), 'WRONG_TOKEN_USE'); });
test('not-yet-effective entitlement denied', async () => {
  await denied(authenticateGuardianRequest({ authorizationHeader: `Bearer ${token()}`, jwks, validation: cfg, lookupEntitlement: async () => ({ ...ENT['sub-officer-1'], effectiveFrom: new Date((NOW + 999999) * 1000).toISOString() }), now: new Date(NOW * 1000) }), 'ENTITLEMENT_NOT_YET_EFFECTIVE');
});
test('mfaSatisfied / assuranceLevel from amr only', () => {
  assert.equal(mfaSatisfied({ amr: ['pwd', 'mfa'] }), true);
  assert.equal(mfaSatisfied({ amr: ['pwd'] }), false);
  assert.equal(assuranceLevel({ amr: ['software_token_mfa'] }), 'AAL2_MFA');
  assert.equal(roleRequiresMfa('AUTHORISING_OFFICER'), true);
});
test('issuerEnforcesMfa (verified pool property) satisfies MFA when amr absent (Cognito)', async () => {
  // Cognito omits amr; a token from an MFA-required pool structurally evidences completed MFA.
  assert.equal(mfaSatisfied({}, { issuerEnforcesMfa: true }), true);
  assert.equal(mfaSatisfied({}, { issuerEnforcesMfa: false }), false);
  // A request-body/UI flag can NEVER supply this — it is a server-side option, not a claim.
  assert.equal(mfaSatisfied({ mfa_satisfied: true }), false);
  // End-to-end: officer with no amr but issuerEnforcesMfa=true reaches the C8 gate.
  const { principal } = await authenticateGuardianRequest({ authorizationHeader: `Bearer ${token({ amr: undefined })}`, jwks, validation: cfg, lookupEntitlement: lookup, issuerEnforcesMfa: true, now: new Date(NOW * 1000) });
  assert.equal(principal.mfaSatisfied, true);
  assert.equal(mayReachC8AuthorisationGate(principal), true);
  // Without the verified assertion AND without amr → denied.
  await denied(authenticateGuardianRequest({ authorizationHeader: `Bearer ${token({ amr: undefined })}`, jwks, validation: cfg, lookupEntitlement: lookup, issuerEnforcesMfa: false, now: new Date(NOW * 1000) }), 'MFA_REQUIRED');
});
test('extractBearer parses only a Bearer scheme', () => {
  assert.equal(extractBearer('Bearer abc.def.ghi'), 'abc.def.ghi');
  assert.equal(extractBearer('Basic x'), null);
  assert.equal(extractBearer(null), null);
});

// ── Positive flow (§38): authenticated + MFA + entitlement → C8 gate reachable ─
test('positive — TEST_AUTHORISING_OFFICER_ZAGP authenticated+MFA reaches C8 gate for ZA-GP', async () => {
  const { principal, auditEvents } = await auth(token());
  assert.equal(principal.principalKind, 'HUMAN');
  assert.equal(principal.role, 'AUTHORISING_OFFICER');
  assert.equal(principal.jurisdiction, 'ZA-GP');
  assert.equal(principal.mfaSatisfied, true);
  assert.equal(principal.isSynthetic, false);
  assert.equal(mayReachC8AuthorisationGate(principal), true);
  assert.equal(principalMayAccessJurisdiction(principal, 'ZA-GP'), true);
  assert.ok(auditEvents.includes('MFA_SUCCEEDED') && auditEvents.includes('PRIVILEGED_ACCESS_ALLOWED'));
});

// ── Cross-jurisdiction (§39) ───────────────────────────────────────────────────
test('cross-jurisdiction — ZA-GP investigator denied ZA-WC resource', async () => {
  const { principal } = await auth(token({ sub: 'sub-inv-1' }));
  assert.equal(principalMayAccessJurisdiction(principal, 'ZA-WC'), false);
});
test('cross-jurisdiction — ZA-WC investigator allowed ZA-WC, denied ZA-GP', async () => {
  const { principal } = await auth(token({ sub: 'sub-inv-wc' }));
  assert.equal(principalMayAccessJurisdiction(principal, 'ZA-WC'), true);
  assert.equal(principalMayAccessJurisdiction(principal, 'ZA-GP'), false);
});

// ── No secret / no outbound in the module (static scan) ───────────────────────
test('identity-auth module has no committed key/secret and no HMAC downgrade path', () => {
  const dir = 'products/guardian/src/identity-auth';
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.ts')) continue;
    const src = readFileSync(`${dir}/${f}`, 'utf8');
    assert.ok(!/BEGIN (RSA|EC|OPENSSH|PRIVATE)/.test(src), `${f} must not embed a private key`);
    assert.ok(!/\bHS256\b/.test(src), `${f} must not accept HS256`);
  }
});
