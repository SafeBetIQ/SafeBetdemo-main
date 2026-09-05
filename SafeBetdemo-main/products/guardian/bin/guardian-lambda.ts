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

type FnUrlEvent = { rawPath?: string; requestContext?: { http?: { method?: string } } };

export const handler = async (event: FnUrlEvent) => {
  const path = (event?.rawPath ?? '/').replace(/\/+$/, '') || '/';
  const json = (status: number, body: unknown) => ({ statusCode: status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

  if (path === '/health' || path === '/') {
    return json(200, {
      ...guardianHealth('guardian-lambda'),
      deploymentVersion: DEPLOY,
      sourceSha: GIT,
      dataBoundary: 'guardian-schema',
      sharedContracts: ['@/lib/platform/audit', '@/lib/platform/evidence'],
      dependsOnSafebetIqRuntime: false,
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

  return json(404, { product: 'GUARDIAN', error: 'not found', path });
};
