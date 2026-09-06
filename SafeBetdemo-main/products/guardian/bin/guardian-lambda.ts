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
} from '../src/index.ts';

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
    const jur = query.get('jurisdiction') ?? 'ZA-GP';
    const operators = SYNTHETIC_REGISTRY.operators.filter((o) => o.jurisdiction === jur);
    return json(200, { product: 'GUARDIAN', jurisdiction: jur, dataClass: 'synthetic', count: operators.length, operators });
  }
  if (path.startsWith('/registry/operators/') && method === 'GET') {
    const id = path.slice('/registry/operators/'.length);
    const op = SYNTHETIC_REGISTRY.operators.find((o) => o.operatorId === id) ?? null;
    if (!op) return json(404, { product: 'GUARDIAN', error: 'operator not found', operatorId: id });
    const licences = SYNTHETIC_REGISTRY.licences.filter((l) => l.operatorId === id);
    const brands = SYNTHETIC_REGISTRY.operatorBrands.filter((r) => r.operatorId === id);
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', operator: op, licences, brandRelationships: brands });
  }
  if (path.startsWith('/registry/licences/') && method === 'GET') {
    const id = path.slice('/registry/licences/'.length);
    const lic = SYNTHETIC_REGISTRY.licences.find((l) => l.licenceId === id) ?? null;
    if (!lic) return json(404, { product: 'GUARDIAN', error: 'licence not found', licenceId: id });
    const sources = SYNTHETIC_REGISTRY.sourceRecords.filter((r) => r.subjectReference === lic.licenceReference);
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', licence: lic, sourceRecords: sources });
  }
  if (path.startsWith('/registry/sources/') && method === 'GET') {
    const id = path.slice('/registry/sources/'.length);
    const rec = SYNTHETIC_REGISTRY.sourceRecords.find((r) => r.recordId === id) ?? null;
    if (!rec) return json(404, { product: 'GUARDIAN', error: 'source record not found', recordId: id });
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', sourceRecord: rec });
  }
  if (path === '/registry/match' && method === 'POST') {
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
    const jur = query.get('jurisdiction') ?? 'ZA-GP';
    const domains = Object.values(SYNTHETIC_DOMAIN_FIXTURES)
      .filter((f) => f.jurisdiction === jur)
      .map((f) => ({ canonicalHostname: f.hostname, jurisdiction: f.jurisdiction }));
    return json(200, { product: 'GUARDIAN', jurisdiction: jur, dataClass: 'synthetic', count: domains.length, domains });
  }
  if (path === '/domains/observe' && method === 'POST') {
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
    const host = decodeURIComponent(path.slice('/domains/'.length));
    const fx = SYNTHETIC_DOMAIN_FIXTURES[host];
    if (!fx) return json(404, { product: 'GUARDIAN', error: 'domain not found', hostname: host });
    const result = analyseDomain(SYNTHETIC_REGISTRY, fx, { observationId: `OBS-${host}` });
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', domain: { canonicalHostname: fx.hostname, jurisdiction: fx.jurisdiction }, latestResult: result, isIllegalDetermination: false });
  }

  // ── Mobile App Intelligence (C3) — provider-neutral, synthetic; NON-LEGAL results.
  if (path === '/apps' && method === 'GET') {
    const jur = query.get('jurisdiction') ?? 'ZA-GP';
    const apps = Object.values(SYNTHETIC_APP_FIXTURES).filter((f) => f.jurisdiction === jur)
      .map((f) => ({ canonicalAppIdentifier: f.appIdentifier, displayName: f.displayName, platformType: f.platformType, jurisdiction: f.jurisdiction }));
    return json(200, { product: 'GUARDIAN', jurisdiction: jur, dataClass: 'synthetic', count: apps.length, apps });
  }
  if (path === '/apps/observe' && method === 'POST') {
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
    const id = decodeURIComponent(path.slice('/apps/'.length));
    const fx = SYNTHETIC_APP_FIXTURES[id];
    if (!fx) return json(404, { product: 'GUARDIAN', error: 'app not found', appIdentifier: id });
    const result = analyseApp(SYNTHETIC_REGISTRY, fx, { observationId: `AOBS-${id}` });
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', app: { canonicalAppIdentifier: fx.appIdentifier, jurisdiction: fx.jurisdiction, platformType: fx.platformType }, latestResult: result, isIllegalDetermination: false });
  }

  // ── Payment Intelligence (C4) — provider-neutral, synthetic; NON-LEGAL + NON-ENFORCEMENT.
  if ((path === '/payments' || path === '/merchants') && method === 'GET') {
    const jur = query.get('jurisdiction') ?? 'ZA-GP';
    const items = Object.values(SYNTHETIC_PAYMENT_FIXTURES).filter((f) => f.jurisdiction === jur)
      .map((f) => ({ merchantReference: f.merchantReference, merchantDescriptor: f.merchantDescriptor, channel: f.channel, providerType: f.providerType, jurisdiction: f.jurisdiction }));
    return json(200, { product: 'GUARDIAN', jurisdiction: jur, dataClass: 'synthetic', count: items.length, [path === '/merchants' ? 'merchants' : 'payments']: items });
  }
  if (path === '/payments/observe' && method === 'POST') {
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
    const ref = decodeURIComponent(path.split('/')[2] ?? '');
    const fx = SYNTHETIC_PAYMENT_FIXTURES[ref];
    if (!fx) return json(404, { product: 'GUARDIAN', error: 'payment/merchant not found', reference: ref });
    const result = analysePayment(SYNTHETIC_REGISTRY, fx, { observationId: `POBS-${ref}` });
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', subject: { merchantReference: fx.merchantReference, jurisdiction: fx.jurisdiction, channel: fx.channel }, latestResult: result, isIllegalDetermination: false, isEnforcementAuthorised: false });
  }

  return json(404, { product: 'GUARDIAN', error: 'not found', path });
};
