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

  // ── Geo & Jurisdiction Intelligence (C5) — property/service/aggregate-region;
  //    NON-LEGAL + NON-ENFORCEMENT. NO individual tracking, NO ISP/subscriber data.
  if (path === '/geo' && method === 'GET') {
    const jur = query.get('jurisdiction') ?? 'ZA-GP';
    const items = Object.values(SYNTHETIC_GEO_FIXTURES).filter((f) => f.jurisdiction === jur)
      .map((f) => ({ geoReference: f.geoReference, subjectType: f.subjectType, regionCode: f.region.regionCode, availabilityState: f.availabilityState, jurisdiction: f.jurisdiction }));
    return json(200, { product: 'GUARDIAN', jurisdiction: jur, dataClass: 'synthetic', privacyBoundary: 'property/service/aggregate-region — no individual tracking', count: items.length, geo: items });
  }
  if (path === '/geo/observe' && method === 'POST') {
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
    const ref = decodeURIComponent(path.split('/')[2] ?? '');
    const fx = SYNTHETIC_GEO_FIXTURES[ref];
    if (!fx) return json(404, { product: 'GUARDIAN', error: 'geo subject not found', geoReference: ref });
    const result = analyseGeo(SYNTHETIC_REGISTRY, fx, { observationId: `GOBS-${ref}` });
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', geoReference: fx.geoReference, observations: [{ region: fx.region, availabilityState: fx.availabilityState, observedAt: result.freshness.geoObservedAt }], isIllegalDetermination: false });
  }
  if (path.match(/^\/geo\/[^/]+\/review$/) && method === 'POST') {
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
    const jur = query.get('jurisdiction') ?? 'ZA-GP';
    const items = Object.values(SYNTHETIC_CASE_FIXTURES).filter((f) => f.jurisdiction === jur)
      .map((f) => { const r = analyseCaseIntake(f); return { caseReference: f.intakeReference, title: f.title, caseType: r.caseType, priority: r.priority, recommendation: r.recommendation, jurisdiction: f.jurisdiction }; });
    return json(200, { product: 'GUARDIAN', jurisdiction: jur, dataClass: 'synthetic', legalSafety: CASE_SAFETY, count: items.length, cases: items });
  }
  if (path === '/cases' && method === 'POST') {
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
    const ref = decodeURIComponent(caseSub[1]); const sub = caseSub[2];
    const fx = SYNTHETIC_CASE_FIXTURES[ref];
    if (!fx) return json(404, { product: 'GUARDIAN', error: 'case not found', caseReference: ref });
    const result = analyseCaseIntake(fx);
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', caseReference: ref, resource: sub, legalSafety: CASE_SAFETY, result: { caseType: result.caseType, priority: result.priority, reasonCodes: result.reasonCodes, reviewRequired: result.reviewRequired } });
  }
  if (path.startsWith('/cases/') && method === 'GET') {
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
    const jur = query.get('jurisdiction') ?? 'ZA-GP';
    const items = Object.values(SYNTHETIC_EVIDENCE_FIXTURES).filter((f) => f.jurisdiction === jur)
      .map((f) => ({ evidenceReference: f.evidenceReference, evidenceType: f.evidenceType, classification: f.classification, sourceDomain: f.sourceDomain, jurisdiction: f.jurisdiction }));
    return json(200, { product: 'GUARDIAN', jurisdiction: jur, dataClass: 'synthetic', legalSafety: EV_SAFETY, count: items.length, evidence: items });
  }
  if (path === '/evidence/register' && method === 'POST') {
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
    const ref = decodeURIComponent(evCustody[1]); const fx = SYNTHETIC_EVIDENCE_FIXTURES[ref];
    if (!fx) return json(404, { product: 'GUARDIAN', error: 'evidence not found', evidenceReference: ref });
    const r = registerEvidence(fx, { evidenceId: `GEV-${ref}` });
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', legalSafety: EV_SAFETY, evidenceReference: ref, custody: r.custodyChain.map((c) => ({ seq: c.sequenceNumber, eventType: c.eventType, eventHash: c.eventHash })), custodyChainOk: verifyCustodyChain(r.custodyChain).ok });
  }
  const evRetrieve = path.match(/^\/evidence\/([^/]+)\/(retrieve|content)$/);
  if (evRetrieve && method === 'POST') {
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
    const jur = query.get('jurisdiction') ?? 'ZA-GP';
    const items = Object.values(SYNTHETIC_POLICY_VERSIONS).filter((p) => p.jurisdiction === jur)
      .map((p) => ({ policyId: p.policyId, versionId: p.versionId, status: p.status, effectiveFrom: p.effectiveFrom, effectiveUntil: p.effectiveUntil, jurisdiction: p.jurisdiction }));
    return json(200, { product: 'GUARDIAN', jurisdiction: jur, dataClass: 'synthetic', legalSafety: AUTH_SAFETY, count: items.length, policies: items });
  }
  if (path.startsWith('/policies/') && method === 'GET') {
    const id = decodeURIComponent(path.slice('/policies/'.length));
    const p = SYNTHETIC_POLICY_VERSIONS[id]; if (!p) return json(404, { product: 'GUARDIAN', error: 'policy version not found', versionId: id });
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', legalSafety: AUTH_SAFETY, policy: p });
  }
  const paSub = path.match(/^\/proposed-actions\/([^/]+)\/(legal-review|request-authorisation|authorise|decline)$/);
  if (paSub && method === 'POST') {
    const ref = decodeURIComponent(paSub[1]); const sub = paSub[2]; const b = parseBody();
    const pa = syntheticProposedAction();
    // C9 §2/§49 edge binding: the authoriser's ROLE is bound to the authenticated Guardian
    // principal (registry) — it is NEVER taken from the request body. A caller can only present
    // a principal id from authenticated context (Demo header `x-guardian-principal` /
    // guardianPrincipalId); a self-asserted `authorisingOfficerRole` in the body is ignored.
    const principalId = (event as any)?.headers?.['x-guardian-principal'] ?? b.guardianPrincipalId;
    const principal = resolveGuardianPrincipal(String(principalId ?? ''));
    if (!principal) return json(403, { product: 'GUARDIAN', error: 'unresolved/unauthenticated Guardian principal — role cannot be self-asserted', legalSafety: AUTH_SAFETY });
    const who = { investigatorId: 'syn-inv', legalReviewerId: 'syn-leg', legalReviewOutcome: (b.legalReviewOutcome as any) ?? 'SUFFICIENT_FOR_AUTHORISATION_REVIEW', authorisingOfficerId: principal.principalId, authorisingOfficerRole: principal.role };
    const decision = evaluateAuthorisation({ ...pa, proposedActionId: ref }, who);
    if (sub === 'authorise') {
      const contract = decision.outcome === 'AUTHORISED' ? toAuthorisedActionContract(decision, { authorisationReference: `AUTH-${ref}`, authorityReference: pa.policyVersion?.authorityReference ?? null, authorisedAt: new Date().toISOString() }) : null;
      return json(decision.outcome === 'AUTHORISED' ? 200 : 409, { product: 'GUARDIAN', dataClass: 'synthetic', legalSafety: AUTH_SAFETY, resource: sub, decision, authorisedActionContract: contract });
    }
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', legalSafety: AUTH_SAFETY, resource: sub, proposedActionId: ref, applicability: evaluatePolicyApplicability(pa.policyVersion, { jurisdiction: pa.jurisdiction, actionType: pa.actionType }) });
  }
  if (path.startsWith('/proposed-actions/') && method === 'GET') {
    const ref = decodeURIComponent(path.slice('/proposed-actions/'.length));
    const pa = syntheticProposedAction();
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', legalSafety: AUTH_SAFETY, proposedAction: { proposedActionId: ref, actionType: pa.actionType, targetReference: pa.targetReference, jurisdiction: pa.jurisdiction }, applicability: evaluatePolicyApplicability(pa.policyVersion, { jurisdiction: pa.jurisdiction, actionType: pa.actionType }) });
  }

  // ── Multi-Channel Enforcement Orchestration (C9) — SYNTHETIC providers only.
  //    Guardian orchestrates/refers authorised requests; the external synthetic provider
  //    performs the provider-side action. No /block-now,/freeze-account,/remove-app,/seize-domain.
  const ORCH_SAFETY = { isRealProvider: false, isExternalNetworkCall: false, note: 'synthetic provider orchestration — Guardian refers an authorised request; no real provider, no enforcement execution' };
  if (path === '/enforcement' && method === 'GET') {
    const jur = query.get('jurisdiction') ?? 'ZA-GP';
    const channels = SYNTHETIC_PROVIDER_CHANNELS.filter((c) => c.jurisdiction === jur).map((c) => ({ providerChannelId: c.providerChannelId, providerType: c.providerType, supportedActionTypes: c.supportedActionTypes, jurisdiction: c.jurisdiction }));
    return json(200, { product: 'GUARDIAN', jurisdiction: jur, dataClass: 'synthetic', safety: ORCH_SAFETY, providerChannels: channels });
  }
  const orchestrateRoute = path.match(/^\/authorisations\/([^/]+)\/orchestrate$/);
  if (orchestrateRoute && method === 'POST') {
    const authRef = decodeURIComponent(orchestrateRoute[1]); const b = parseBody();
    // §2/§49: only an authenticated bound principal may orchestrate; role is NEVER caller-supplied.
    const principalId = (event as any)?.headers?.['x-guardian-principal'] ?? b.guardianPrincipalId;
    const principal = resolveGuardianPrincipal(String(principalId ?? ''));
    if (!principal || (principal.role !== 'AUTHORISING_OFFICER' && principal.role !== 'SYSTEM_SERVICE')) {
      return json(403, { product: 'GUARDIAN', error: 'unauthenticated/unpermitted Guardian principal — role cannot be self-asserted', safety: ORCH_SAFETY });
    }
    const authorised = { ...syntheticAuthorisedAction(), authorisationReference: authRef };
    const adapter = new SyntheticProviderAdapter();
    const decision = orchestrate({ orchestrationId: `ORCH-${authRef}`, authorised, requested: { actionType: authorised.actionType, targetType: authorised.targetType, targetReference: authorised.targetReference, jurisdiction: authorised.jurisdiction }, channels: SYNTHETIC_PROVIDER_CHANNELS, attemptNo: 1, dispatch: (h, n) => adapter.publishAuthorisedRequest({ requestPayloadHash: h, scenario: String(b.providerScenario ?? 'ACK_ACTIONED'), attemptNo: n }), principalAuthenticated: true });
    return json(decision.status === 'ORCHESTRATION_BLOCKED' ? 409 : 200, { product: 'GUARDIAN', dataClass: 'synthetic', safety: ORCH_SAFETY, guardianDispatchState: guardianDispatchState(authorised.actionType), decision });
  }
  const evVerifyRoute = path.match(/^\/enforcement\/([^/]+)\/verify$/);
  if (evVerifyRoute && method === 'POST') {
    const b = parseBody();
    const v = verifyProviderOutcome(String(b.actionType ?? 'DOMAIN_BLOCK') as any, b.providerActioned !== false, { observedState: String(b.observedState ?? 'UNAVAILABLE'), expectedState: String(b.expectedState ?? 'UNAVAILABLE') });
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', safety: ORCH_SAFETY, orchestrationId: decodeURIComponent(evVerifyRoute[1]), verification: v, note: 'ACTIONED != VERIFIED — verification is independent of dispatch' });
  }
  const evRespRoute = path.match(/^\/enforcement\/([^/]+)\/(responses|withdraw)$/);
  if (evRespRoute && (method === 'GET' || method === 'POST')) {
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', safety: ORCH_SAFETY, orchestrationId: decodeURIComponent(evRespRoute[1]), resource: evRespRoute[2], note: 'provider-originated states come only from the synthetic adapter; withdrawal after dispatch records a cancellation request, not a fabricated provider acceptance' });
  }
  const evHistoryRoute = path.match(/^\/enforcement\/([^/]+)\/verification-history$/);
  if (evHistoryRoute && method === 'GET') {
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
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', safety: ORCH_SAFETY, orchestrationId: decodeURIComponent(path.slice('/enforcement/'.length)) });
  }

  // ── Re-entry Intelligence & Continuous Verification (C10) — INTELLIGENCE + ROUTING ONLY.
  //    Never enforces, never applies authority, never dispatches C9. No /reblock,/re-enforce,
  //    /auto-referral. Human review is required before any routing; routing goes to C6/C8 only.
  const REENTRY_SAFETY = { isIllegalityDetermined: false, isAuthorityApplied: false, isEnforcementDispatched: false, isRealObservationSource: false, isExternalNetworkCall: false, note: 're-entry candidate is correlation + verification intelligence for human review; C10 cannot re-block/re-refer/dispatch and cannot self-assert authority' };
  if (path === '/reentry' && method === 'GET') {
    const jur = query.get('jurisdiction') ?? 'ZA-GP';
    const decision = detectReentry({ jurisdiction: jur, orchestration: syntheticVerifiedOrchestration({ jurisdiction: jur }), signal: SIGNAL_SAME_TARGET_AVAILABLE, coverage: coverageExplicit({ jurisdiction: jur }) });
    return json(200, { product: 'GUARDIAN', jurisdiction: jur, dataClass: 'synthetic', safety: REENTRY_SAFETY, candidate: decision });
  }
  const reentryReviewRoute = path.match(/^\/reentry\/([^/]+)\/review$/);
  if (reentryReviewRoute && method === 'POST') {
    const b = parseBody();
    // §42: reviewer role is bound from an authenticated Guardian principal — NEVER self-asserted,
    // and jurisdiction is never taken from the request body.
    const principalId = (event as any)?.headers?.['x-guardian-principal'] ?? b.guardianPrincipalId;
    const principal = resolveGuardianPrincipal(String(principalId ?? ''));
    if (!principal || (principal.role !== 'INVESTIGATOR' && principal.role !== 'LEGAL_REVIEWER')) {
      return json(403, { product: 'GUARDIAN', error: 'unauthenticated/unpermitted Guardian principal — reviewer role cannot be self-asserted', safety: REENTRY_SAFETY });
    }
    const allowed = ['SAME_TARGET_CONFIRMED', 'RELATED_TARGET_CONFIRMED', 'RELATIONSHIP_UNRESOLVED', 'FALSE_POSITIVE', 'EXISTING_AUTHORITY_REVIEW_REQUIRED', 'NEW_INVESTIGATION_REQUIRED', 'INSUFFICIENT_EVIDENCE'];
    const outcome = String(b.outcome ?? '');
    if (!allowed.includes(outcome)) return json(400, { product: 'GUARDIAN', error: 'unsupported review outcome (no AUTO_BLOCK_APPROVED exists)', outcome, safety: REENTRY_SAFETY });
    const review = applyReview(outcome as any);
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', safety: REENTRY_SAFETY, reentryCandidateId: decodeURIComponent(reentryReviewRoute[1]), reviewerRole: principal.role, jurisdiction: principal.jurisdiction, review });
  }
  const reentryRouteRoute = path.match(/^\/reentry\/([^/]+)\/route$/);
  if (reentryRouteRoute && method === 'POST') {
    const b = parseBody();
    const principalId = (event as any)?.headers?.['x-guardian-principal'] ?? b.guardianPrincipalId;
    const principal = resolveGuardianPrincipal(String(principalId ?? ''));
    if (!principal || (principal.role !== 'INVESTIGATOR' && principal.role !== 'LEGAL_REVIEWER')) {
      return json(403, { product: 'GUARDIAN', error: 'unauthenticated/unpermitted Guardian principal — role cannot be self-asserted', safety: REENTRY_SAFETY });
    }
    const routing = routeCandidate({ reviewOutcome: String(b.reviewOutcome ?? 'RELATIONSHIP_UNRESOLVED') as any, coverageState: String(b.coverageState ?? 'COVERAGE_UNCLEAR') as any });
    // C10 records a routing outcome to C6/C8 only — it never authorises (C8) or dispatches (C9).
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', safety: REENTRY_SAFETY, reentryCandidateId: decodeURIComponent(reentryRouteRoute[1]), routing, note: 'routing target is C6 investigation or C8 authority review only — final authorisation remains C8; dispatch remains C9' });
  }
  if (path.startsWith('/reentry/') && method === 'GET') {
    const ref = decodeURIComponent(path.slice('/reentry/'.length));
    const decision = detectReentry({ jurisdiction: query.get('jurisdiction') ?? 'ZA-GP', orchestration: syntheticVerifiedOrchestration(), signal: SIGNAL_SAME_TARGET_AVAILABLE, coverage: coverageExplicit() });
    return json(200, { product: 'GUARDIAN', dataClass: 'synthetic', safety: REENTRY_SAFETY, reentryCandidateId: ref, candidate: decision });
  }

  return json(404, { product: 'GUARDIAN', error: 'not found', path });
};
