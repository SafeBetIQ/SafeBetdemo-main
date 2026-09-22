// ─── SafeBet Guardian — Lambda handler for the independent Demo runtime (C0.1) ─
//
// Runtime strategy: AWS Lambda + Function URL (ADR-0007). This is Guardian's OWN
// runtime — a separate compute unit, release artifact, version identity, health
// endpoint, log group and IAM role from SafeBet IQ. It consumes only the governed
// Shared Platform Foundation contracts and Guardian's own package. It performs NO
// detection and NO enforcement; synthetic foundation surface only.
//
// Provenance (source SHA / deployment version / build time) is injected at BUILD
// time by scripts/guardian/build-guardian-lambda.mjs via esbuild `define`, so the
// artifact itself carries its provenance (four-way parity: Git = build = deploy =
// live /version). Bundled to CJS `index.js`; Lambda handler = `index.handler`.

import { createHash } from 'node:crypto';
import {
  guardianVersion, guardianHealth, guardianFoundationDescriptor,
  makeGuardianPrincipal, evaluateSod, makeCase, makeEvidenceReference, makeEnvelope,
  GuardianFoundationWorker, toAuditEventFields, hashGuardianEvent, verifyGuardianChain,
  guardianChainScope, type GuardianVersion,
  SYNTHETIC_REGISTRY, matchOperator, resolveLegalReference,
  SYNTHETIC_DOMAIN_FIXTURES, analyseDomain,
  SYNTHETIC_APP_FIXTURES, analyseApp,
  SYNTHETIC_PAYMENT_FIXTURES, analysePayment,
  SYNTHETIC_GEO_FIXTURES, analyseGeo,
  SYNTHETIC_CASE_FIXTURES, analyseCaseIntake,
  SYNTHETIC_EVIDENCE_FIXTURES, registerEvidence, verifyEvidenceContent, verifyCustodyChain,
  evaluateEvidenceAccess, buildExportManifest,
  SYNTHETIC_POLICY_VERSIONS, syntheticProposedAction, evaluatePolicyApplicability, evaluateAuthorisation, toAuthorisedActionContract,
  resolveGuardianPrincipal, isBoundAuthorisingOfficer,
  SYNTHETIC_PROVIDER_CHANNELS, syntheticAuthorisedAction, orchestrate, SyntheticProviderAdapter, verifyProviderOutcome, guardianDispatchState,
} from '../src/index.ts';
// C10 re-entry intelligence — imported from the subpath (its VerificationType would collide with
// the C9 enforcement export in the shared top-level index). Intelligence + routing only.
import {
  detectReentry, applyReview, routeCandidate, buildVerificationObservation, actionedButNotVerified,
  syntheticVerifiedOrchestration, SIGNAL_SAME_TARGET_AVAILABLE, coverageExplicit,
} from '../src/reentry/index.ts';
// PR1 — production-ready human identity (cryptographic JWT + governed entitlement + MFA).
import {
  authenticateGuardianRequest, GuardianAuthError, RemoteJwksProvider, cognitoJwksUri,
  hasCapability, mayReachC8AuthorisationGate, principalMayAccessJurisdiction,
  type AuthenticatedGuardianPrincipal, type GuardianCapability, type EntitlementRecord,
} from '../src/identity-auth/index.ts';
import { Client as PgClient } from 'pg';
import { SecretsManagerClient as SM, GetSecretValueCommand as GetSecret } from '@aws-sdk/client-secrets-manager';

// ── PR1 production-ready auth infrastructure (module-level singletons; cached across invocations) ──
// GUARDIAN_AUTH_MODE = 'jwt' (production-ready; Cognito) | 'synthetic' (test harness / demo only).
// The two paths are SEPARATE: jwt mode NEVER consults the synthetic principal registry (no fallback).
const AUTH_MODE = process.env.GUARDIAN_AUTH_MODE ?? 'synthetic';
const JWT_REGION = process.env.AWS_REGION ?? 'eu-west-1';
const JWT_POOL_ID = process.env.GUARDIAN_JWT_USER_POOL_ID ?? '';
const JWT_ISSUER = process.env.GUARDIAN_JWT_ISSUER ?? (JWT_POOL_ID ? `https://cognito-idp.${JWT_REGION}.amazonaws.com/${JWT_POOL_ID}` : '');
const JWT_AUDIENCE = process.env.GUARDIAN_JWT_AUDIENCE ?? '';
const JWT_TOKEN_USE = (process.env.GUARDIAN_JWT_TOKEN_USE ?? 'access') as 'access' | 'id';
const IDENTITY_SECRET_ID = process.env.GUARDIAN_IDENTITY_DB_SECRET_ID ?? 'safebet-guardian/identity-resolver-db';
let _jwks: RemoteJwksProvider | null = null;
function jwksProvider(): RemoteJwksProvider {
  if (!_jwks) _jwks = new RemoteJwksProvider(process.env.GUARDIAN_JWT_JWKS_URI ?? cognitoJwksUri(JWT_REGION, JWT_POOL_ID));
  return _jwks;
}
let _idConn: { host: string; port: number; user: string; password: string; database: string } | null = null;
async function identityConn() {
  if (_idConn) return _idConn;
  const res = await new SM({ region: JWT_REGION }).send(new GetSecret({ SecretId: IDENTITY_SECRET_ID }));
  _idConn = JSON.parse(res.SecretString ?? '{}'); return _idConn!;
}
/** Governed entitlement lookup by trusted subject (least-privilege resolver role). */
async function lookupEntitlement(subject: string): Promise<EntitlementRecord | null> {
  const c = await identityConn();
  const client = new PgClient({ host: c.host, port: c.port, user: c.user, password: c.password, database: c.database, ssl: { rejectUnauthorized: false }, statement_timeout: 8000, connectionTimeoutMillis: 6000 });
  await client.connect();
  try {
    const r = await client.query('select subject, guardian_role, jurisdiction, account_state, effective_from, effective_until, is_human from guardian.identity_entitlement where subject=$1', [subject]);
    if ((r.rowCount ?? 0) === 0) return null;
    const row = r.rows[0];
    return { subject: row.subject, role: row.guardian_role, jurisdiction: row.jurisdiction, accountState: row.account_state, effectiveFrom: row.effective_from, effectiveUntil: row.effective_until, isHuman: row.is_human };
  } finally { await client.end().catch(() => {}); }
}

// Injected at build time (esbuild --define). Fallbacks keep local runs honest.
declare const __GUARDIAN_GIT_COMMIT__: string;
declare const __GUARDIAN_DEPLOYMENT_VERSION__: string;
declare const __GUARDIAN_BUILT_AT__: string;
const GIT = (typeof __GUARDIAN_GIT_COMMIT__ !== 'undefined' ? __GUARDIAN_GIT_COMMIT__ : (process.env.GUARDIAN_GIT_COMMIT ?? 'unknown'));
const DEPLOY = (typeof __GUARDIAN_DEPLOYMENT_VERSION__ !== 'undefined' ? __GUARDIAN_DEPLOYMENT_VERSION__ : (process.env.GUARDIAN_DEPLOYMENT_VERSION ?? 'guardian-c0-local'));
const BUILT_AT = (typeof __GUARDIAN_BUILT_AT__ !== 'undefined' ? __GUARDIAN_BUILT_AT__ : 'unknown');

const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

function provenance(): Partial<GuardianVersion> {
  return { gitCommit: GIT, deploymentVersion: DEPLOY, builtAt: BUILT_AT, environment: process.env.NEXT_PUBLIC_ENV ?? 'demo' };
}

type FnUrlEvent = { rawPath?: string; rawQueryString?: string; body?: string; isBase64Encoded?: boolean; requestContext?: { http?: { method?: string } } };

export const handler = async (event: FnUrlEvent) => {
  const path = (event?.rawPath ?? '/').replace(/\/+$/, '') || '/';
  const method = event?.requestContext?.http?.method ?? 'GET';
  const query = new URLSearchParams(event?.rawQueryString ?? '');
  const parseBody = (): Record<string, unknown> => {
    try {
      const raw = event?.isBase64Encoded ? Buffer.from(event.body ?? '', 'base64').toString('utf8') : (event?.body ?? '');
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  };
  const json = (status: number, body: unknown) => ({ statusCode: status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const headers = ((event as any)?.headers ?? {}) as Record<string, string>;

  // ── PR1 production-ready privileged gate ────────────────────────────────────
  // In 'jwt' mode: validate a Cognito bearer token → governed entitlement → MFA gate →
  // authenticated HUMAN principal; role/jurisdiction NEVER from the request; NO synthetic
  // fallback. Returns { principal } or { deny } (a ready json response). In 'synthetic' mode:
  // the isolated test-harness path (x-guardian-principal → SYNTHETIC_PRINCIPALS).
  type Gate = { principal?: AuthenticatedGuardianPrincipal; synthetic?: { role: string; jurisdiction: string; principalId: string }; deny?: ReturnType<typeof json> };
  const denyAudit = (status: number, reason: string, auditEvent: string) => json(status, { product: 'GUARDIAN', error: 'privileged access denied', reasonCode: reason, auditEvent, authMode: AUTH_MODE });
  async function gate(capability: GuardianCapability, resourceJurisdiction?: string): Promise<Gate> {
    if (AUTH_MODE === 'jwt') {
      try {
        const { principal } = await authenticateGuardianRequest({
          authorizationHeader: headers['authorization'] ?? headers['Authorization'],
          jwks: jwksProvider(), validation: { issuer: JWT_ISSUER, audience: JWT_AUDIENCE, tokenUse: JWT_TOKEN_USE },
          lookupEntitlement,
          // Verified pool property (MfaConfiguration=ON): a valid token evidences completed MFA.
          issuerEnforcesMfa: (process.env.GUARDIAN_JWT_ISSUER_ENFORCES_MFA ?? 'false') === 'true',
        });
        if (!hasCapability(principal, capability)) return { deny: denyAudit(403, 'CAPABILITY_DENIED', 'PRIVILEGED_ACCESS_DENIED') };
        if (resourceJurisdiction && !principalMayAccessJurisdiction(principal, resourceJurisdiction)) return { deny: denyAudit(403, 'JURISDICTION_DENIED', 'PRIVILEGED_ACCESS_DENIED') };
        return { principal };
      } catch (e) {
        const err = e as GuardianAuthError;
        return { deny: denyAudit(err.status ?? 401, err.reasonCode ?? 'AUTH_FAILED', err.auditEvent ?? 'AUTHENTICATION_FAILED') };
      }
    }
    // synthetic test-harness path (clearly separated; never used in jwt mode). Capability +
    // jurisdiction are enforced here too, so the harness mirrors the production-ready gate.
    const principalId = headers['x-guardian-principal'] ?? String(parseBody().guardianPrincipalId ?? '');
    const p = resolveGuardianPrincipal(principalId);
    if (!p) return { deny: json(403, { product: 'GUARDIAN', error: 'unauthenticated Guardian principal (synthetic harness)', authMode: AUTH_MODE }) };
    if (!hasCapability({ role: p.role } as unknown as AuthenticatedGuardianPrincipal, capability)) return { deny: json(403, { product: 'GUARDIAN', error: 'capability denied (synthetic harness)', reasonCode: 'CAPABILITY_DENIED', authMode: AUTH_MODE }) };
    if (resourceJurisdiction && p.jurisdiction !== resourceJurisdiction) return { deny: json(403, { product: 'GUARDIAN', error: 'jurisdiction denied (synthetic harness)', reasonCode: 'JURISDICTION_DENIED', authMode: AUTH_MODE }) };
    return { synthetic: { role: p.role, jurisdiction: p.jurisdiction, principalId: p.principalId } };
  }

  // PR1 identity introspection (proves the authenticated principal; no token echoed).
  if (path === '/auth/whoami' && method === 'GET') {
    if (AUTH_MODE !== 'jwt') return json(200, { product: 'GUARDIAN', authMode: AUTH_MODE, note: 'synthetic test-harness mode; production-ready identity is jwt mode' });
    const g = await gate('CASE_VIEW');
    if (g.deny) return g.deny;
    const p = g.principal!;
    return json(200, { product: 'GUARDIAN', authMode: 'jwt', principal: { principalKind: p.principalKind, subject: p.subject, role: p.role, jurisdiction: p.jurisdiction, mfaSatisfied: p.mfaSatisfied, assuranceLevel: p.assuranceLevel, accountState: p.accountState, isSynthetic: p.isSynthetic }, mayReachC8AuthorisationGate: mayReachC8AuthorisationGate(p) });
  }

  if (path === '/health' || path === '/') {
    return json(200, {
      ...guardianHealth('guardian-lambda'),
      deploymentVersion: DEPLOY,
      sourceSha: GIT,
      dataBoundary: 'guardian-schema',
      sharedContracts: ['@/lib/platform/audit', '@/lib/platform/evidence'],
      dependsOnSafebetIqRuntime: false,
      // C2.1 component posture (configuration state; no secrets, no live probe from the API).
      domainIntelligence: {
        domainWorker: 'HEALTHY',
        queue: 'guardian-domain-observation',
        dlq: 'guardian-domain-observation-dlq',
        persistence: 'HEALTHY',
        persistencePrincipal: 'guardian_domain_worker (least-privilege; guardian schema only)',
      },
      // C5 component posture (configuration state; no secrets, no live probe from the API).
      geoIntelligence: {
        geoWorker: 'HEALTHY',
        queue: 'guardian-geo-observation',
        dlq: 'guardian-geo-observation-dlq',
        persistence: 'HEALTHY',
        persistencePrincipal: 'guardian_geo_worker (least-privilege; guardian schema only)',
        privacyBoundary: 'property/service/aggregate-region — no individual tracking',
      },
      // C6 component posture (configuration state; no secrets, no live probe from the API).
      caseInvestigation: {
        caseWorker: 'HEALTHY',
        queue: 'guardian-case-intake',
        dlq: 'guardian-case-intake-dlq',
        persistence: 'HEALTHY',
        persistencePrincipal: 'guardian_case_worker (least-privilege; guardian schema only)',
        boundary: 'investigation only — no enforcement, no provider action, no legal determination',
      },
      // C7 component posture (configuration state; no secrets, no live probe from the API).
      evidenceVault: {
        evidenceWorker: 'HEALTHY',
        queue: 'guardian-evidence-processing',
        dlq: 'guardian-evidence-processing-dlq',
        storage: 'private S3 vault (block-public-access; SSE; versioned)',
        persistencePrincipal: 'guardian_evidence_worker (least-privilege; guardian schema only)',
        integrity: 'SHA-256 content hash + append-only per-evidence custody hash chain',
        boundary: 'provenance/integrity only — no enforcement, no provider action, no legal determination',
      },
      // C8 component posture (configuration state; no secrets, no live probe from the API).
      enforcementAuthorisation: {
        policyWorker: 'HEALTHY',
        queue: 'guardian-authorisation-evaluation',
        dlq: 'guardian-authorisation-evaluation-dlq',
        persistencePrincipal: 'guardian_policy_worker (least-privilege; cannot insert final authorisation)',
        boundary: 'human authority layer — authorises action records; NEVER executes, NEVER notifies a provider (no external action)',
      },
      // C9 component posture (configuration state; no secrets, no live probe from the API).
      enforcementOrchestration: {
        enforcementWorker: 'HEALTHY',
        queue: 'guardian-enforcement-orchestration',
        dlq: 'guardian-enforcement-orchestration-dlq',
        providers: 'SYNTHETIC only (no real ISP/registrar/host/bank/PSP/mobile/geo)',
        persistencePrincipal: 'guardian_enforcement_worker (least-privilege; consumes C8 authorised_action contract only)',
        boundary: 'Guardian orchestrates/refers authorised requests; external synthetic provider performs the action; ACK!=ACTIONED, ACTIONED!=VERIFIED; no real provider, no external network call',
      },
      // C10 component posture (configuration state; no secrets, no live probe from the API).
      reentryIntelligence: {
        reentryWorker: 'HEALTHY',
        queue: 'guardian-reentry-intelligence',
        dlq: 'guardian-reentry-intelligence-dlq',
        sources: 'SYNTHETIC only (no real crawling/DNS/provider/app-store/payment/traffic surveillance)',
        persistencePrincipal: 'guardian_reentry_worker (least-privilege; consumes C9 orchestration_reference contract only; no C9 enforcement queue send)',
        boundary: 'intelligence + continuous verification + routing only; RE-ENTRY != ILLEGALITY, SIMILAR != SAME ENTITY; human review required; routes to C6/C8 only; C10 cannot dispatch C9 or apply authority; historic VERIFIED immutable',
      },
      // PR1 privileged-identity posture (production-ready human authentication; test identities only).
      privilegedIdentity: {
        authMode: AUTH_MODE,
        identityProvider: AUTH_MODE === 'jwt' ? 'AWS Cognito User Pool (OIDC, TOTP MFA required)' : 'synthetic test harness only',
        tokenValidation: 'RS256 signature (JWKS/kid) + issuer + audience + expiry + token_use (crypto-verified; no HS downgrade; no pinned key)',
        roleSource: 'governed guardian.identity_entitlement (subject→role→jurisdiction→account_state) — never request-supplied',
        mfaEnforcement: 'privileged roles require trusted MFA assurance (amr) at the identity layer; C8 authorise gate = HUMAN AUTHORISING_OFFICER + MFA',
        resolverPrincipal: 'guardian_identity_resolver (least-privilege; SELECT identity_entitlement + INSERT audit only)',
        syntheticFallback: 'NONE (jwt mode never consults the synthetic registry)',
        humanVsService: 'distinct; service principals can never hold a human role or reach the C8 human authorisation gate',
        realPrivilegedUsersActivated: false,
      },
    });
  }

  if (path === '/version') {
    return json(200, { ...guardianVersion(provenance()), sourceSha: GIT });
  }

  if (path === '/foundation') {
    const JUR = 'ZA-GP';
    const investigator = makeGuardianPrincipal({ principalId: 'syn-inv', jurisdiction: JUR, role: 'INVESTIGATOR', authAssurance: 'SYNTHETIC_TEST', purpose: 'demo', isSynthetic: true });
    const reviewer = makeGuardianPrincipal({ principalId: 'syn-leg', jurisdiction: JUR, role: 'LEGAL_REVIEWER', authAssurance: 'SYNTHETIC_TEST', purpose: 'demo', isSynthetic: true });
    const officer = makeGuardianPrincipal({ principalId: 'syn-auth', jurisdiction: JUR, role: 'AUTHORISING_OFFICER', authAssurance: 'SYNTHETIC_TEST', purpose: 'demo', isSynthetic: true });
    const sod = evaluateSod({ caseId: 'syn-case', investigator, legalReviewer: reviewer, authorisingOfficer: officer });
    const gcase = makeCase({ caseId: 'syn-case', jurisdiction: JUR, createdAt: '2026-09-05T12:00:00.000Z', actorPrincipalId: investigator.principalId, correlationId: 'corr' });
    const evidence = makeEvidenceReference({ evidenceId: 'syn-ev', jurisdiction: JUR, caseReference: gcase.caseId, classification: 'RESTRICTED', integrityHash: sha('synthetic-evidence'), retentionUntil: '2030-01-01T00:00:00Z', accessPurpose: 'demo', createdAt: gcase.createdAt });

    // Shared Audit: build a Guardian-scoped event, hash it, verify via the shared verifier.
    const ctx = { product: 'GUARDIAN' as const, actorPrincipalId: investigator.principalId, actorRole: investigator.role, jurisdiction: JUR, eventType: 'guardian.case.opened', correlationId: 'corr', occurredAt: gcase.createdAt, caseReference: gcase.caseId };
    const fields = toAuditEventFields(ctx, 1, '0'.repeat(64), 'evt');
    const hash = hashGuardianEvent(ctx, 1, '0'.repeat(64), 'evt', sha);
    const chain = verifyGuardianChain(JUR, [{ ...fields, hash }], sha);

    // Worker idempotency.
    const worker = new GuardianFoundationWorker();
    const env = makeEnvelope({ eventType: 'guardian.foundation.ping', jurisdiction: JUR, correlationId: 'corr', idempotencyKey: 'idem', occurredAt: gcase.createdAt, payloadReference: `evref:${evidence.evidenceId}` });
    worker.process(env); const replay = worker.process(env);

    return json(200, {
      descriptor: guardianFoundationDescriptor(),
      sourceSha: GIT,
      sod,
      case: gcase,
      auditProof: { product: 'GUARDIAN', chainScope: guardianChainScope(JUR), correlationId: ctx.correlationId, actor: ctx.actorPrincipalId, hash, verified: chain.status === 'verified' },
      evidenceProof: { product: 'GUARDIAN', jurisdiction: evidence.jurisdiction, id: evidence.evidenceId, classification: evidence.classification, integrityHash: evidence.integrityHash, auditLinked: true, realBody: false },
      workerIdempotent: replay.duplicate === true && worker.processedCount() === 1,
      note: 'SYNTHETIC foundation proof — no detection, no enforcement, no SafeBet IQ business data.',
    });
  }

  // ── Legal Operator Registry (C1) — synthetic snapshot; store of record = guardian schema.
  //    Jurisdiction is required and scopes every response (no cross-jurisdiction leak).
  //    No endpoint returns illegal=true; responses carry fact + source + verification +
  //    match + human-review state.
  if (path === '/registry/operators' && method === 'GET') {
    const gg1 = await gate('CASE_VIEW'); if (gg1.deny) return gg1.deny;
    const jur = query.get('jurisdiction') ?? 'ZA-GP';
    const operators = SYNTHETIC_REGISTRY.operators.filter((o) => o.jurisdiction === jur);
    return json(200, { product: 'GUARDIAN', jurisdiction: jur, dataClass: 'synthetic', count: operators.length, operators });
  }
  if (path.startsWith('/registry/operators/') && method === 'GET') {
    const gg2 = await gate('CASE_VIEW'); if (gg2.deny) return gg2.deny;
    const id = path.slice('/registry/operators/'.length);
    const op = SYNTHETIC_REGISTRY.operators.find((o) => o.operatorId === id) ?? null;
    if (!op) return json(404, { product: 'GUARDIAN', error: 'operator not found', operatorId: id });
    const licences = SYNTHETIC_REGISTRY.licences.filter((l) => l.operatorId === id);
    const brands = SYNTHETIC_REGISTRY.operatorBrands.filter((r) => r.operatorId === id);
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', operator: op, licences, brandRelationships: brands });
  }
  if (path.startsWith('/registry/licences/') && method === 'GET') {
    const gg3 = await gate('CASE_VIEW'); if (gg3.deny) return gg3.deny;
    const id = path.slice('/registry/licences/'.length);
    const lic = SYNTHETIC_REGISTRY.licences.find((l) => l.licenceId === id) ?? null;
    if (!lic) return json(404, { product: 'GUARDIAN', error: 'licence not found', licenceId: id });
    const sources = SYNTHETIC_REGISTRY.sourceRecords.filter((r) => r.subjectReference === lic.licenceReference);
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', licence: lic, sourceRecords: sources });
  }
  if (path.startsWith('/registry/sources/') && method === 'GET') {
    const gg4 = await gate('CASE_VIEW'); if (gg4.deny) return gg4.deny;
    const id = path.slice('/registry/sources/'.length);
    const rec = SYNTHETIC_REGISTRY.sourceRecords.find((r) => r.recordId === id) ?? null;
    if (!rec) return json(404, { product: 'GUARDIAN', error: 'source record not found', recordId: id });
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', sourceRecord: rec });
  }
  if (path === '/registry/match' && method === 'POST') {
    const gg5 = await gate('CASE_VIEW'); if (gg5.deny) return gg5.deny;
    const b = parseBody();
    const jur = String(b.jurisdiction ?? '');
    if (!jur) return json(400, { product: 'GUARDIAN', error: 'jurisdiction required' });
    const subject = { jurisdiction: jur, legalName: b.legalName as string | undefined, licenceReference: b.licenceReference as string | undefined, registrationReference: b.registrationReference as string | undefined, brandName: b.brandName as string | undefined };
    const match = matchOperator(SYNTHETIC_REGISTRY, subject);
    const resolution = resolveLegalReference(SYNTHETIC_REGISTRY, subject);
    // Explicitly surface the safety invariant in the API contract.
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', match, resolution, isIllegalDetermination: false });
  }

  // ── Domain & Website Intelligence (C2) — synthetic; every result is NON-LEGAL.
  //    No endpoint returns illegal=true; each carries isIllegalDetermination:false.
  if (path === '/domains' && method === 'GET') {
    const gg6 = await gate('CASE_VIEW'); if (gg6.deny) return gg6.deny;
    const jur = query.get('jurisdiction') ?? 'ZA-GP';
    const domains = Object.values(SYNTHETIC_DOMAIN_FIXTURES)
      .filter((f) => f.jurisdiction === jur)
      .map((f) => ({ canonicalHostname: f.hostname, jurisdiction: f.jurisdiction }));
    return json(200, { product: 'GUARDIAN', jurisdiction: jur, dataClass: 'synthetic', count: domains.length, domains });
  }
  if (path === '/domains/observe' && method === 'POST') {
    const gg7 = await gate('CASE_REVIEW'); if (gg7.deny) return gg7.deny;
    const b = parseBody();
    const jur = String(b.jurisdiction ?? '');
    const host = String(b.fixtureHostname ?? '');
    if (!jur || !host) return json(400, { product: 'GUARDIAN', error: 'jurisdiction and fixtureHostname required' });
    const fx = SYNTHETIC_DOMAIN_FIXTURES[host];
    if (!fx) return json(404, { product: 'GUARDIAN', error: 'unknown synthetic fixture (no real domains are fetched)', fixtureHostname: host });
    if (fx.jurisdiction !== jur) return json(403, { product: 'GUARDIAN', error: 'cross-jurisdiction denied', fixtureJurisdiction: fx.jurisdiction });
    const result = analyseDomain(SYNTHETIC_REGISTRY, fx, { observationId: `OBS-${Date.now()}` });
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', legalSafety: { isIllegalDetermination: false, note: 'non-legal intelligence' }, result });
  }
  if (path.startsWith('/domains/') && method === 'GET') {
    const gg8 = await gate('CASE_VIEW'); if (gg8.deny) return gg8.deny;
    const host = decodeURIComponent(path.slice('/domains/'.length));
    const fx = SYNTHETIC_DOMAIN_FIXTURES[host];
    if (!fx) return json(404, { product: 'GUARDIAN', error: 'domain not found', hostname: host });
    const result = analyseDomain(SYNTHETIC_REGISTRY, fx, { observationId: `OBS-${host}` });
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', domain: { canonicalHostname: fx.hostname, jurisdiction: fx.jurisdiction }, latestResult: result, isIllegalDetermination: false });
  }

  // ── Mobile App Intelligence (C3) — provider-neutral, synthetic; NON-LEGAL results.
  if (path === '/apps' && method === 'GET') {
    const gg9 = await gate('CASE_VIEW'); if (gg9.deny) return gg9.deny;
    const jur = query.get('jurisdiction') ?? 'ZA-GP';
    const apps = Object.values(SYNTHETIC_APP_FIXTURES).filter((f) => f.jurisdiction === jur)
      .map((f) => ({ canonicalAppIdentifier: f.appIdentifier, displayName: f.displayName, platformType: f.platformType, jurisdiction: f.jurisdiction }));
    return json(200, { product: 'GUARDIAN', jurisdiction: jur, dataClass: 'synthetic', count: apps.length, apps });
  }
  if (path === '/apps/observe' && method === 'POST') {
    const gg10 = await gate('CASE_REVIEW'); if (gg10.deny) return gg10.deny;
    const b = parseBody();
    const jur = String(b.jurisdiction ?? ''); const id = String(b.fixtureAppIdentifier ?? '');
    if (!jur || !id) return json(400, { product: 'GUARDIAN', error: 'jurisdiction and fixtureAppIdentifier required' });
    const fx = SYNTHETIC_APP_FIXTURES[id];
    if (!fx) return json(404, { product: 'GUARDIAN', error: 'unknown synthetic app fixture (no real apps are accessed)', fixtureAppIdentifier: id });
    if (fx.jurisdiction !== jur) return json(403, { product: 'GUARDIAN', error: 'cross-jurisdiction denied', fixtureJurisdiction: fx.jurisdiction });
    const result = analyseApp(SYNTHETIC_REGISTRY, fx, { observationId: `AOBS-${Date.now()}` });
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', legalSafety: { isIllegalDetermination: false, note: 'non-legal intelligence; no app removal/enforcement' }, result });
  }
  if (path.startsWith('/apps/') && method === 'GET') {
    const gg11 = await gate('CASE_VIEW'); if (gg11.deny) return gg11.deny;
    const id = decodeURIComponent(path.slice('/apps/'.length));
    const fx = SYNTHETIC_APP_FIXTURES[id];
    if (!fx) return json(404, { product: 'GUARDIAN', error: 'app not found', appIdentifier: id });
    const result = analyseApp(SYNTHETIC_REGISTRY, fx, { observationId: `AOBS-${id}` });
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', app: { canonicalAppIdentifier: fx.appIdentifier, jurisdiction: fx.jurisdiction, platformType: fx.platformType }, latestResult: result, isIllegalDetermination: false });
  }

  // ── Payment Intelligence (C4) — provider-neutral, synthetic; NON-LEGAL + NON-ENFORCEMENT.
  if ((path === '/payments' || path === '/merchants') && method === 'GET') {
    const gg12 = await gate('CASE_VIEW'); if (gg12.deny) return gg12.deny;
    const jur = query.get('jurisdiction') ?? 'ZA-GP';
    const items = Object.values(SYNTHETIC_PAYMENT_FIXTURES).filter((f) => f.jurisdiction === jur)
      .map((f) => ({ merchantReference: f.merchantReference, merchantDescriptor: f.merchantDescriptor, channel: f.channel, providerType: f.providerType, jurisdiction: f.jurisdiction }));
    return json(200, { product: 'GUARDIAN', jurisdiction: jur, dataClass: 'synthetic', count: items.length, [path === '/merchants' ? 'merchants' : 'payments']: items });
  }
  if (path === '/payments/observe' && method === 'POST') {
    const gg13 = await gate('CASE_REVIEW'); if (gg13.deny) return gg13.deny;
    const b = parseBody();
    const jur = String(b.jurisdiction ?? ''); const ref = String(b.fixtureMerchantReference ?? '');
    if (!jur || !ref) return json(400, { product: 'GUARDIAN', error: 'jurisdiction and fixtureMerchantReference required' });
    const fx = SYNTHETIC_PAYMENT_FIXTURES[ref];
    if (!fx) return json(404, { product: 'GUARDIAN', error: 'unknown synthetic payment fixture (no real payment data accessed)', fixtureMerchantReference: ref });
    if (fx.jurisdiction !== jur) return json(403, { product: 'GUARDIAN', error: 'cross-jurisdiction denied', fixtureJurisdiction: fx.jurisdiction });
    const result = analysePayment(SYNTHETIC_REGISTRY, fx, { observationId: `POBS-${Date.now()}` });
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', legalSafety: { isIllegalDetermination: false, isEnforcementAuthorised: false, note: 'non-legal, non-enforcement intelligence' }, result });
  }
  if ((path.startsWith('/payments/') || path.startsWith('/merchants/')) && method === 'GET') {
    const gg14 = await gate('CASE_VIEW'); if (gg14.deny) return gg14.deny;
    const ref = decodeURIComponent(path.split('/')[2] ?? '');
    const fx = SYNTHETIC_PAYMENT_FIXTURES[ref];
    if (!fx) return json(404, { product: 'GUARDIAN', error: 'payment/merchant not found', reference: ref });
    const result = analysePayment(SYNTHETIC_REGISTRY, fx, { observationId: `POBS-${ref}` });
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', subject: { merchantReference: fx.merchantReference, jurisdiction: fx.jurisdiction, channel: fx.channel }, latestResult: result, isIllegalDetermination: false, isEnforcementAuthorised: false });
  }

  // ── Geo & Jurisdiction Intelligence (C5) — property/service/aggregate-region;
  //    NON-LEGAL + NON-ENFORCEMENT. NO individual tracking, NO ISP/subscriber data.
  if (path === '/geo' && method === 'GET') {
    const gg15 = await gate('CASE_VIEW'); if (gg15.deny) return gg15.deny;
    const jur = query.get('jurisdiction') ?? 'ZA-GP';
    const items = Object.values(SYNTHETIC_GEO_FIXTURES).filter((f) => f.jurisdiction === jur)
      .map((f) => ({ geoReference: f.geoReference, subjectType: f.subjectType, regionCode: f.region.regionCode, availabilityState: f.availabilityState, jurisdiction: f.jurisdiction }));
    return json(200, { product: 'GUARDIAN', jurisdiction: jur, dataClass: 'synthetic', privacyBoundary: 'property/service/aggregate-region — no individual tracking', count: items.length, geo: items });
  }
  if (path === '/geo/observe' && method === 'POST') {
    const gg16 = await gate('CASE_REVIEW'); if (gg16.deny) return gg16.deny;
    const b = parseBody();
    const jur = String(b.jurisdiction ?? ''); const ref = String(b.fixtureGeoReference ?? '');
    if (!jur || !ref) return json(400, { product: 'GUARDIAN', error: 'jurisdiction and fixtureGeoReference required' });
    const fx = SYNTHETIC_GEO_FIXTURES[ref];
    if (!fx) return json(404, { product: 'GUARDIAN', error: 'unknown synthetic geo fixture (no real location data accessed)', fixtureGeoReference: ref });
    if (fx.jurisdiction !== jur) return json(403, { product: 'GUARDIAN', error: 'cross-jurisdiction denied', fixtureJurisdiction: fx.jurisdiction });
    const result = analyseGeo(SYNTHETIC_REGISTRY, fx, { observationId: `GOBS-${Date.now()}` });
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', legalSafety: { isIllegalDetermination: false, isEnforcementAuthorised: false, note: 'non-legal, non-enforcement intelligence; no geo-block, no individual tracking' }, result });
  }
  if (path.match(/^\/geo\/[^/]+\/observations$/) && method === 'GET') {
    const gg17 = await gate('CASE_VIEW'); if (gg17.deny) return gg17.deny;
    const ref = decodeURIComponent(path.split('/')[2] ?? '');
    const fx = SYNTHETIC_GEO_FIXTURES[ref];
    if (!fx) return json(404, { product: 'GUARDIAN', error: 'geo subject not found', geoReference: ref });
    const result = analyseGeo(SYNTHETIC_REGISTRY, fx, { observationId: `GOBS-${ref}` });
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', geoReference: fx.geoReference, observations: [{ region: fx.region, availabilityState: fx.availabilityState, observedAt: result.freshness.geoObservedAt }], isIllegalDetermination: false });
  }
  if (path.match(/^\/geo\/[^/]+\/review$/) && method === 'POST') {
    const gg18 = await gate('CASE_REVIEW'); if (gg18.deny) return gg18.deny;
    const ref = decodeURIComponent(path.split('/')[2] ?? '');
    const fx = SYNTHETIC_GEO_FIXTURES[ref];
    if (!fx) return json(404, { product: 'GUARDIAN', error: 'geo subject not found', geoReference: ref });
    const b = parseBody();
    const decision = String(b.decision ?? 'REQUIRES_FURTHER_INVESTIGATION');
    const allowed = ['REFERENCE_MATCH_CONFIRMED', 'REGION_REFERENCE_CONFIRMED', 'SOURCE_DATA_INSUFFICIENT', 'INCONSISTENCY_CONFIRMED', 'REQUIRES_FURTHER_INVESTIGATION', 'FALSE_POSITIVE', 'DUPLICATE_SUBJECT'];
    if (!allowed.includes(decision)) return json(400, { product: 'GUARDIAN', error: 'unsupported review decision (no geo-block/enforcement decisions exist)', decision });
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', geoReference: fx.geoReference, review: { state: 'TRIAGED', decision }, isIllegalDetermination: false, isEnforcementAuthorised: false });
  }
  if (path.startsWith('/geo/') && method === 'GET') {
    const gg19 = await gate('CASE_VIEW'); if (gg19.deny) return gg19.deny;
    const ref = decodeURIComponent(path.slice('/geo/'.length));
    const fx = SYNTHETIC_GEO_FIXTURES[ref];
    if (!fx) return json(404, { product: 'GUARDIAN', error: 'geo subject not found', geoReference: ref });
    const result = analyseGeo(SYNTHETIC_REGISTRY, fx, { observationId: `GOBS-${ref}` });
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', subject: { geoReference: fx.geoReference, subjectType: fx.subjectType, region: fx.region, jurisdiction: fx.jurisdiction }, latestResult: result, isIllegalDetermination: false, isEnforcementAuthorised: false });
  }

  // ── Case & Investigation Management (C6) — governed investigation layer; NON-LEGAL,
  //    NON-ENFORCEMENT. No /enforce, /block, /takedown, /referral endpoint exists.
  const CASE_SAFETY = { isLegalDetermination: false, isEnforcementAuthorised: false, note: 'investigation only — not a legal finding, not an enforcement authorisation' };
  if (path === '/cases' && method === 'GET') {
    const gg20 = await gate('CASE_VIEW'); if (gg20.deny) return gg20.deny;
    const jur = query.get('jurisdiction') ?? 'ZA-GP';
    const items = Object.values(SYNTHETIC_CASE_FIXTURES).filter((f) => f.jurisdiction === jur)
      .map((f) => { const r = analyseCaseIntake(f); return { caseReference: f.intakeReference, title: f.title, caseType: r.caseType, priority: r.priority, recommendation: r.recommendation, jurisdiction: f.jurisdiction }; });
    return json(200, { product: 'GUARDIAN', jurisdiction: jur, dataClass: 'synthetic', legalSafety: CASE_SAFETY, count: items.length, cases: items });
  }
  if (path === '/cases' && method === 'POST') {
    const gg21 = await gate('CASE_REVIEW'); if (gg21.deny) return gg21.deny;
    const b = parseBody();
    const jur = String(b.jurisdiction ?? ''); const ref = String(b.fixtureIntakeReference ?? '');
    if (!jur || !ref) return json(400, { product: 'GUARDIAN', error: 'jurisdiction and fixtureIntakeReference required' });
    const fx = SYNTHETIC_CASE_FIXTURES[ref];
    if (!fx) return json(404, { product: 'GUARDIAN', error: 'unknown synthetic case fixture (no real cases accessed)', fixtureIntakeReference: ref });
    if (fx.jurisdiction !== jur) return json(403, { product: 'GUARDIAN', error: 'cross-jurisdiction denied', fixtureJurisdiction: fx.jurisdiction });
    const result = analyseCaseIntake(fx);
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', legalSafety: CASE_SAFETY, result });
  }
  // Bounded sub-resource surfaces (synthetic; investigation only). No enforcement paths.
  const caseSub = path.match(/^\/cases\/([^/]+)\/(subjects|intelligence|evidence|notes|findings|review|status)$/);
  if (caseSub && method === 'POST') {
    const gg22 = await gate('CASE_REVIEW'); if (gg22.deny) return gg22.deny;
    const ref = decodeURIComponent(caseSub[1]); const sub = caseSub[2];
    const fx = SYNTHETIC_CASE_FIXTURES[ref];
    if (!fx) return json(404, { product: 'GUARDIAN', error: 'case not found', caseReference: ref });
    const result = analyseCaseIntake(fx);
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', caseReference: ref, resource: sub, legalSafety: CASE_SAFETY, result: { caseType: result.caseType, priority: result.priority, reasonCodes: result.reasonCodes, reviewRequired: result.reviewRequired } });
  }
  if (path.startsWith('/cases/') && method === 'GET') {
    const gg23 = await gate('CASE_VIEW'); if (gg23.deny) return gg23.deny;
    const ref = decodeURIComponent(path.slice('/cases/'.length));
    const fx = SYNTHETIC_CASE_FIXTURES[ref];
    if (!fx) return json(404, { product: 'GUARDIAN', error: 'case not found', caseReference: ref });
    const result = analyseCaseIntake(fx);
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', legalSafety: CASE_SAFETY, case: { caseReference: fx.intakeReference, title: fx.title, jurisdiction: fx.jurisdiction }, latestResult: result });
  }

  // ── Digital Evidence Vault (C7) — provenance/integrity lifecycle; NON-LEGAL,
  //    NON-ENFORCEMENT. No permanent public URL; no provider action. IAM protected.
  const EV_SAFETY = { isLegalDetermination: false, isEnforcementAuthorised: false, note: 'evidence provenance/integrity only — not a legal finding, not an enforcement authorisation' };
  if (path === '/evidence' && method === 'GET') {
    const gg24 = await gate('EVIDENCE_ACCESS'); if (gg24.deny) return gg24.deny;
    const jur = query.get('jurisdiction') ?? 'ZA-GP';
    const items = Object.values(SYNTHETIC_EVIDENCE_FIXTURES).filter((f) => f.jurisdiction === jur)
      .map((f) => ({ evidenceReference: f.evidenceReference, evidenceType: f.evidenceType, classification: f.classification, sourceDomain: f.sourceDomain, jurisdiction: f.jurisdiction }));
    return json(200, { product: 'GUARDIAN', jurisdiction: jur, dataClass: 'synthetic', legalSafety: EV_SAFETY, count: items.length, evidence: items });
  }
  if (path === '/evidence/register' && method === 'POST') {
    const gg25 = await gate('EVIDENCE_ACCESS'); if (gg25.deny) return gg25.deny;
    const b = parseBody();
    const jur = String(b.jurisdiction ?? ''); const ref = String(b.fixtureEvidenceReference ?? '');
    if (!jur || !ref) return json(400, { product: 'GUARDIAN', error: 'jurisdiction and fixtureEvidenceReference required' });
    const fx = SYNTHETIC_EVIDENCE_FIXTURES[ref];
    if (!fx) return json(404, { product: 'GUARDIAN', error: 'unknown synthetic evidence fixture (no real evidence accessed)', fixtureEvidenceReference: ref });
    if (fx.jurisdiction !== jur) return json(403, { product: 'GUARDIAN', error: 'cross-jurisdiction denied', fixtureJurisdiction: fx.jurisdiction });
    const result = registerEvidence(fx, { evidenceId: `GEV-${Date.now()}` });
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', legalSafety: EV_SAFETY, result });
  }
  const evVerify = path.match(/^\/evidence\/([^/]+)\/verify$/);
  if (evVerify && method === 'POST') {
    const gg26 = await gate('EVIDENCE_ACCESS'); if (gg26.deny) return gg26.deny;
    const ref = decodeURIComponent(evVerify[1]); const fx = SYNTHETIC_EVIDENCE_FIXTURES[ref];
    if (!fx) return json(404, { product: 'GUARDIAN', error: 'evidence not found', evidenceReference: ref });
    const r = registerEvidence(fx, { evidenceId: `GEV-${ref}` });
    const b = parseBody();
    const body = typeof b.syntheticBody === 'string' ? b.syntheticBody : fx.syntheticBody; // tamper if a different body is supplied
    const integrityStatus = verifyEvidenceContent(r.contentHash, body);
    const custody = verifyCustodyChain(r.custodyChain);
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', legalSafety: EV_SAFETY, evidenceReference: ref, integrityStatus, custodyChainOk: custody.ok });
  }
  const evCustody = path.match(/^\/evidence\/([^/]+)\/custody$/);
  if (evCustody && method === 'GET') {
    const gg27 = await gate('EVIDENCE_ACCESS'); if (gg27.deny) return gg27.deny;
    const ref = decodeURIComponent(evCustody[1]); const fx = SYNTHETIC_EVIDENCE_FIXTURES[ref];
    if (!fx) return json(404, { product: 'GUARDIAN', error: 'evidence not found', evidenceReference: ref });
    const r = registerEvidence(fx, { evidenceId: `GEV-${ref}` });
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', legalSafety: EV_SAFETY, evidenceReference: ref, custody: r.custodyChain.map((c) => ({ seq: c.sequenceNumber, eventType: c.eventType, eventHash: c.eventHash })), custodyChainOk: verifyCustodyChain(r.custodyChain).ok });
  }
  const evRetrieve = path.match(/^\/evidence\/([^/]+)\/(retrieve|content)$/);
  if (evRetrieve && method === 'POST') {
    const gg28 = await gate('EVIDENCE_ACCESS'); if (gg28.deny) return gg28.deny;
    const ref = decodeURIComponent(evRetrieve[1]); const fx = SYNTHETIC_EVIDENCE_FIXTURES[ref];
    if (!fx) return json(404, { product: 'GUARDIAN', error: 'evidence not found', evidenceReference: ref });
    // Controlled retrieval is performed by the dedicated least-privilege reader identity
    // (guardian-evidence-reader): access policy (jurisdiction x classification x purpose) is
    // evaluated in the DB-backed reader BEFORE any s3:GetObject, then SHA-256 over the ACTUAL
    // stored bytes; every attempt is audited. This API route delegates there (no S3/DB in the
    // credential-free API Lambda; no public object URL is ever issued).
    return json(202, { product: 'GUARDIAN', dataClass: 'synthetic', legalSafety: EV_SAFETY, evidenceReference: ref, resource: evRetrieve[2], delegatedTo: 'guardian-evidence-reader (least-privilege s3:GetObject on evidence/* only)', note: 'byte-level verification against actual stored S3 bytes is performed by the reader service after access-policy evaluation; no public URL.' });
  }
  const evSub = path.match(/^\/evidence\/([^/]+)\/(link-case|hold|export)$/);
  if (evSub && method === 'POST') {
    // PR1.1 remediation (P2-2): hold (legal hold) + export (custody disclosure) require distinct
    // higher capabilities than plain read/retrieve; link-case remains EVIDENCE_ACCESS (investigator).
    const evCap: GuardianCapability = evSub[2] === 'export' ? 'EVIDENCE_EXPORT' : evSub[2] === 'hold' ? 'EVIDENCE_HOLD' : 'EVIDENCE_ACCESS';
    const gg29 = await gate(evCap); if (gg29.deny) return gg29.deny;
    const ref = decodeURIComponent(evSub[1]); const sub = evSub[2]; const fx = SYNTHETIC_EVIDENCE_FIXTURES[ref];
    if (!fx) return json(404, { product: 'GUARDIAN', error: 'evidence not found', evidenceReference: ref });
    const r = registerEvidence(fx, { evidenceId: `GEV-${ref}` });
    if (sub === 'export') {
      const manifest = buildExportManifest({ jurisdiction: fx.jurisdiction, caseReference: String((parseBody().caseReference) ?? ''), exportActor: 'syn-service', exportedAt: new Date().toISOString(), items: [{ evidenceId: r.evidenceId, evidenceReference: r.evidenceReference, contentHash: r.contentHash, classification: r.classification, integrityStatus: r.integrityStatus, capturedAt: null, sourceReference: r.sourceReference, custodyHead: r.custodyChain[r.custodyChain.length - 1].eventHash }] });
      return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', legalSafety: EV_SAFETY, resource: sub, manifest });
    }
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', legalSafety: EV_SAFETY, evidenceReference: ref, resource: sub });
  }
  if (path.startsWith('/evidence/') && method === 'GET') {
    const gg30 = await gate('EVIDENCE_ACCESS'); if (gg30.deny) return gg30.deny;
    const ref = decodeURIComponent(path.slice('/evidence/'.length));
    const fx = SYNTHETIC_EVIDENCE_FIXTURES[ref];
    if (!fx) return json(404, { product: 'GUARDIAN', error: 'evidence not found', evidenceReference: ref });
    const r = registerEvidence(fx, { evidenceId: `GEV-${ref}` });
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', legalSafety: EV_SAFETY, evidence: { evidenceReference: fx.evidenceReference, evidenceType: fx.evidenceType, classification: fx.classification, jurisdiction: fx.jurisdiction, contentHash: r.contentHash, integrityStatus: r.integrityStatus, storageReference: r.storageReference } });
  }

  // ── Enforcement Policy Registry + Authorisation Workflow (C8) — human authority
  //    layer; C8 AUTHORISES but NEVER executes/notifies a provider. No /execute,/send,
  //    /block,/referral,/publish endpoint exists.
  const AUTH_SAFETY = { isLegalDetermination: false, isEnforcementExecuted: false, isProviderNotified: false, note: 'human authority layer — authorises an action record only; no external action, no provider notification' };
  if (path === '/policies' && method === 'GET') {
    const gg31 = await gate('CASE_VIEW'); if (gg31.deny) return gg31.deny;
    const jur = query.get('jurisdiction') ?? 'ZA-GP';
    const items = Object.values(SYNTHETIC_POLICY_VERSIONS).filter((p) => p.jurisdiction === jur)
      .map((p) => ({ policyId: p.policyId, versionId: p.versionId, status: p.status, effectiveFrom: p.effectiveFrom, effectiveUntil: p.effectiveUntil, jurisdiction: p.jurisdiction }));
    return json(200, { product: 'GUARDIAN', jurisdiction: jur, dataClass: 'synthetic', legalSafety: AUTH_SAFETY, count: items.length, policies: items });
  }
  if (path.startsWith('/policies/') && method === 'GET') {
    const gg32 = await gate('CASE_VIEW'); if (gg32.deny) return gg32.deny;
    const id = decodeURIComponent(path.slice('/policies/'.length));
    const p = SYNTHETIC_POLICY_VERSIONS[id]; if (!p) return json(404, { product: 'GUARDIAN', error: 'policy version not found', versionId: id });
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', legalSafety: AUTH_SAFETY, policy: p });
  }
  const paSub = path.match(/^\/proposed-actions\/([^/]+)\/(legal-review|request-authorisation|authorise|decline)$/);
  if (paSub && method === 'POST') {
    const ref = decodeURIComponent(paSub[1]); const sub = paSub[2]; const b = parseBody();
    const pa = syntheticProposedAction();
    // PR1 §14: role/jurisdiction come from the authenticated principal (jwt mode: cryptographic
    // token + governed entitlement + MFA gate) — NEVER from the request body. The `authorise`
    // sub is the strongest gate: HUMAN AUTHORISING_OFFICER with MFA only; service/self-assert denied.
    const CAP: Record<string, GuardianCapability> = { 'authorise': 'AUTHORISE_ACTION', 'legal-review': 'LEGAL_REVIEW', 'request-authorisation': 'PROPOSE_ACTION', 'decline': 'LEGAL_REVIEW' };
    const g = await gate(CAP[sub] ?? 'CASE_VIEW', pa.jurisdiction);
    if (g.deny) return g.deny;
    if (sub === 'authorise' && AUTH_MODE === 'jwt' && !(g.principal && mayReachC8AuthorisationGate(g.principal))) {
      return json(403, { product: 'GUARDIAN', error: 'C8 authorisation gate requires a HUMAN AUTHORISING_OFFICER with MFA', legalSafety: AUTH_SAFETY });
    }
    const actorRole = (g.principal?.role ?? g.synthetic?.role ?? 'INVESTIGATOR') as 'INVESTIGATOR' | 'LEGAL_REVIEWER' | 'AUTHORISING_OFFICER' | 'SYSTEM_SERVICE';
    const actorId = g.principal?.subject ?? g.synthetic?.principalId ?? 'unknown';
    const who = { investigatorId: 'syn-inv', legalReviewerId: 'syn-leg', legalReviewOutcome: (b.legalReviewOutcome as any) ?? 'SUFFICIENT_FOR_AUTHORISATION_REVIEW', authorisingOfficerId: actorId, authorisingOfficerRole: actorRole };
    const decision = evaluateAuthorisation({ ...pa, proposedActionId: ref }, who);
    if (sub === 'authorise') {
      const contract = decision.outcome === 'AUTHORISED' ? toAuthorisedActionContract(decision, { authorisationReference: `AUTH-${ref}`, authorityReference: pa.policyVersion?.authorityReference ?? null, authorisedAt: new Date().toISOString() }) : null;
      return json(decision.outcome === 'AUTHORISED' ? 200 : 409, { product: 'GUARDIAN', dataClass: 'synthetic', legalSafety: AUTH_SAFETY, resource: sub, decision, authorisedActionContract: contract });
    }
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', legalSafety: AUTH_SAFETY, resource: sub, proposedActionId: ref, applicability: evaluatePolicyApplicability(pa.policyVersion, { jurisdiction: pa.jurisdiction, actionType: pa.actionType }) });
  }
  if (path.startsWith('/proposed-actions/') && method === 'GET') {
    const gg33 = await gate('CASE_VIEW'); if (gg33.deny) return gg33.deny;
    const ref = decodeURIComponent(path.slice('/proposed-actions/'.length));
    const pa = syntheticProposedAction();
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', legalSafety: AUTH_SAFETY, proposedAction: { proposedActionId: ref, actionType: pa.actionType, targetReference: pa.targetReference, jurisdiction: pa.jurisdiction }, applicability: evaluatePolicyApplicability(pa.policyVersion, { jurisdiction: pa.jurisdiction, actionType: pa.actionType }) });
  }

  // ── Multi-Channel Enforcement Orchestration (C9) — SYNTHETIC providers only.
  //    Guardian orchestrates/refers authorised requests; the external synthetic provider
  //    performs the provider-side action. No /block-now,/freeze-account,/remove-app,/seize-domain.
  const ORCH_SAFETY = { isRealProvider: false, isExternalNetworkCall: false, note: 'synthetic provider orchestration — Guardian refers an authorised request; no real provider, no enforcement execution' };
  if (path === '/enforcement' && method === 'GET') {
    const gg34 = await gate('ORCHESTRATION_VIEW'); if (gg34.deny) return gg34.deny;
    const jur = query.get('jurisdiction') ?? 'ZA-GP';
    const channels = SYNTHETIC_PROVIDER_CHANNELS.filter((c) => c.jurisdiction === jur).map((c) => ({ providerChannelId: c.providerChannelId, providerType: c.providerType, supportedActionTypes: c.supportedActionTypes, jurisdiction: c.jurisdiction }));
    return json(200, { product: 'GUARDIAN', jurisdiction: jur, dataClass: 'synthetic', safety: ORCH_SAFETY, providerChannels: channels });
  }
  const orchestrateRoute = path.match(/^\/authorisations\/([^/]+)\/orchestrate$/);
  if (orchestrateRoute && method === 'POST') {
    const authRef = decodeURIComponent(orchestrateRoute[1]); const b = parseBody();
    // PR1: only an AUTHENTICATED principal with AUTHORISE_ACTION may trigger orchestration; role is
    // NEVER caller-supplied. jwt mode = cryptographic token + governed entitlement (+MFA gate).
    const gO = await gate('AUTHORISE_ACTION');
    if (gO.deny) return gO.deny;
    const authorised = { ...syntheticAuthorisedAction(), authorisationReference: authRef };
    const adapter = new SyntheticProviderAdapter();
    const decision = orchestrate({ orchestrationId: `ORCH-${authRef}`, authorised, requested: { actionType: authorised.actionType, targetType: authorised.targetType, targetReference: authorised.targetReference, jurisdiction: authorised.jurisdiction }, channels: SYNTHETIC_PROVIDER_CHANNELS, attemptNo: 1, dispatch: (h, n) => adapter.publishAuthorisedRequest({ requestPayloadHash: h, scenario: String(b.providerScenario ?? 'ACK_ACTIONED'), attemptNo: n }), principalAuthenticated: true });
    return json(decision.status === 'ORCHESTRATION_BLOCKED' ? 409 : 200, { product: 'GUARDIAN', dataClass: 'synthetic', safety: ORCH_SAFETY, guardianDispatchState: guardianDispatchState(authorised.actionType), decision });
  }
  const evVerifyRoute = path.match(/^\/enforcement\/([^/]+)\/verify$/);
  if (evVerifyRoute && method === 'POST') {
    const gg35 = await gate('ORCHESTRATION_VIEW'); if (gg35.deny) return gg35.deny;
    const b = parseBody();
    const v = verifyProviderOutcome(String(b.actionType ?? 'DOMAIN_BLOCK') as any, b.providerActioned !== false, { observedState: String(b.observedState ?? 'UNAVAILABLE'), expectedState: String(b.expectedState ?? 'UNAVAILABLE') });
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', safety: ORCH_SAFETY, orchestrationId: decodeURIComponent(evVerifyRoute[1]), verification: v, note: 'ACTIONED != VERIFIED — verification is independent of dispatch' });
  }
  const evRespRoute = path.match(/^\/enforcement\/([^/]+)\/(responses|withdraw)$/);
  if (evRespRoute && (method === 'GET' || method === 'POST')) {
    // PR1.1 remediation (P2-1): withdraw is a state-changing cancellation of a dispatched enforcement
    // → AUTHORISING_OFFICER-only ENFORCEMENT_WITHDRAW (symmetric with dispatch); responses stays read-tier.
    const gg36 = await gate(evRespRoute[2] === 'withdraw' ? 'ENFORCEMENT_WITHDRAW' : 'ORCHESTRATION_VIEW'); if (gg36.deny) return gg36.deny;
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', safety: ORCH_SAFETY, orchestrationId: decodeURIComponent(evRespRoute[1]), resource: evRespRoute[2], note: 'provider-originated states come only from the synthetic adapter; withdrawal after dispatch records a cancellation request, not a fabricated provider acceptance' });
  }
  const evHistoryRoute = path.match(/^\/enforcement\/([^/]+)\/verification-history$/);
  if (evHistoryRoute && method === 'GET') {
    const gg37 = await gate('ORCHESTRATION_VIEW'); if (gg37.deny) return gg37.deny;
    // Continuous / follow-up verification history for an orchestration (synthetic, append-only).
    const ref = decodeURIComponent(evHistoryRoute[1]);
    const orchestration = syntheticVerifiedOrchestration({ orchestrationReference: ref });
    const followup = buildVerificationObservation(orchestration, SIGNAL_SAME_TARGET_AVAILABLE, 'FOLLOWUP');
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', orchestrationReference: ref,
      note: 'historic VERIFIED state is immutable; follow-up observations are appended, never rewritten',
      history: [{ observationKind: 'INITIAL', verificationType: followup.verificationType, result: 'EXPECTED_STATE_OBSERVED', immutable: true }, { observationKind: 'FOLLOWUP', verificationType: followup.verificationType, result: followup.result }],
      actionedButNotVerified: actionedButNotVerified(orchestration) });
  }
  if (path.startsWith('/enforcement/') && method === 'GET') {
    const gg38 = await gate('ORCHESTRATION_VIEW'); if (gg38.deny) return gg38.deny;
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', safety: ORCH_SAFETY, orchestrationId: decodeURIComponent(path.slice('/enforcement/'.length)) });
  }

  // ── Re-entry Intelligence & Continuous Verification (C10) — INTELLIGENCE + ROUTING ONLY.
  //    Never enforces, never applies authority, never dispatches C9. No /reblock,/re-enforce,
  //    /auto-referral. Human review is required before any routing; routing goes to C6/C8 only.
  const REENTRY_SAFETY = { isIllegalityDetermined: false, isAuthorityApplied: false, isEnforcementDispatched: false, isRealObservationSource: false, isExternalNetworkCall: false, note: 're-entry candidate is correlation + verification intelligence for human review; C10 cannot re-block/re-refer/dispatch and cannot self-assert authority' };
  if (path === '/reentry' && method === 'GET') {
    const gg39 = await gate('REENTRY_REVIEW'); if (gg39.deny) return gg39.deny;
    const jur = query.get('jurisdiction') ?? 'ZA-GP';
    const decision = detectReentry({ jurisdiction: jur, orchestration: syntheticVerifiedOrchestration({ jurisdiction: jur }), signal: SIGNAL_SAME_TARGET_AVAILABLE, coverage: coverageExplicit({ jurisdiction: jur }) });
    return json(200, { product: 'GUARDIAN', jurisdiction: jur, dataClass: 'synthetic', safety: REENTRY_SAFETY, candidate: decision });
  }
  const reentryReviewRoute = path.match(/^\/reentry\/([^/]+)\/review$/);
  if (reentryReviewRoute && method === 'POST') {
    const b = parseBody();
    // PR1 §42: reviewer role/jurisdiction from the authenticated principal (jwt mode) — never self-asserted.
    const gR = await gate('REENTRY_REVIEW');
    if (gR.deny) return gR.deny;
    const reviewerRole = gR.principal?.role ?? gR.synthetic?.role ?? 'INVESTIGATOR';
    const reviewerJur = gR.principal?.jurisdiction ?? gR.synthetic?.jurisdiction ?? 'ZA-GP';
    const allowed = ['SAME_TARGET_CONFIRMED', 'RELATED_TARGET_CONFIRMED', 'RELATIONSHIP_UNRESOLVED', 'FALSE_POSITIVE', 'EXISTING_AUTHORITY_REVIEW_REQUIRED', 'NEW_INVESTIGATION_REQUIRED', 'INSUFFICIENT_EVIDENCE'];
    const outcome = String(b.outcome ?? '');
    if (!allowed.includes(outcome)) return json(400, { product: 'GUARDIAN', error: 'unsupported review outcome (no AUTO_BLOCK_APPROVED exists)', outcome, safety: REENTRY_SAFETY });
    const review = applyReview(outcome as any);
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', safety: REENTRY_SAFETY, reentryCandidateId: decodeURIComponent(reentryReviewRoute[1]), reviewerRole, jurisdiction: reviewerJur, review });
  }
  const reentryRouteRoute = path.match(/^\/reentry\/([^/]+)\/route$/);
  if (reentryRouteRoute && method === 'POST') {
    const b = parseBody();
    const gRt = await gate('REENTRY_REVIEW');
    if (gRt.deny) return gRt.deny;
    const routing = routeCandidate({ reviewOutcome: String(b.reviewOutcome ?? 'RELATIONSHIP_UNRESOLVED') as any, coverageState: String(b.coverageState ?? 'COVERAGE_UNCLEAR') as any });
    // C10 records a routing outcome to C6/C8 only — it never authorises (C8) or dispatches (C9).
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', safety: REENTRY_SAFETY, reentryCandidateId: decodeURIComponent(reentryRouteRoute[1]), routing, note: 'routing target is C6 investigation or C8 authority review only — final authorisation remains C8; dispatch remains C9' });
  }
  if (path.startsWith('/reentry/') && method === 'GET') {
    const gg40 = await gate('REENTRY_REVIEW'); if (gg40.deny) return gg40.deny;
    const ref = decodeURIComponent(path.slice('/reentry/'.length));
    const decision = detectReentry({ jurisdiction: query.get('jurisdiction') ?? 'ZA-GP', orchestration: syntheticVerifiedOrchestration(), signal: SIGNAL_SAME_TARGET_AVAILABLE, coverage: coverageExplicit() });
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', safety: REENTRY_SAFETY, reentryCandidateId: ref, candidate: decision });
  }

  return json(404, { product: 'GUARDIAN', error: 'not found', path });
};
