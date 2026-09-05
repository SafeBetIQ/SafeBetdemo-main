// ── SafeBet Guardian — synthetic foundation contract demonstration (ARCH-V4-C0) ─
// Read-only endpoint that demonstrates the Guardian foundation contracts with
// SYNTHETIC data only: identity + SoD + case + evidence reference + audit context
// + worker idempotency. It performs NO detection, NO enforcement, and does NOT
// proxy any SafeBet IQ business function. It exists to prove product independence.

import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import {
  guardianFoundationDescriptor, makeGuardianPrincipal, evaluateSod, makeCase,
  makeEvidenceReference, makeEnvelope, GuardianFoundationWorker, hashGuardianEvent,
} from '@/products/guardian/src/index.ts';

export const dynamic = 'force-dynamic';

export function GET() {
  const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
  const JUR = 'ZA-GP';
  const investigator = makeGuardianPrincipal({ principalId: 'syn-inv', jurisdiction: JUR, role: 'INVESTIGATOR', authAssurance: 'SYNTHETIC_TEST', purpose: 'demo', isSynthetic: true });
  const reviewer = makeGuardianPrincipal({ principalId: 'syn-leg', jurisdiction: JUR, role: 'LEGAL_REVIEWER', authAssurance: 'SYNTHETIC_TEST', purpose: 'demo', isSynthetic: true });
  const officer = makeGuardianPrincipal({ principalId: 'syn-auth', jurisdiction: JUR, role: 'AUTHORISING_OFFICER', authAssurance: 'SYNTHETIC_TEST', purpose: 'demo', isSynthetic: true });
  const sod = evaluateSod({ caseId: 'syn-case', investigator, legalReviewer: reviewer, authorisingOfficer: officer });
  const gcase = makeCase({ caseId: 'syn-case', jurisdiction: JUR, createdAt: new Date().toISOString(), actorPrincipalId: investigator.principalId, correlationId: 'corr' });
  const evidence = makeEvidenceReference({ evidenceId: 'syn-ev', jurisdiction: JUR, caseReference: gcase.caseId, classification: 'RESTRICTED', integrityHash: sha256('synthetic'), retentionUntil: '2030-01-01T00:00:00Z', accessPurpose: 'demo', createdAt: new Date().toISOString() });
  const auditHash = hashGuardianEvent({ product: 'GUARDIAN', actorPrincipalId: investigator.principalId, actorRole: investigator.role, jurisdiction: JUR, eventType: 'guardian.case.opened', correlationId: 'corr', occurredAt: gcase.createdAt, caseReference: gcase.caseId }, 1, '0'.repeat(64), 'evt', sha256);
  const worker = new GuardianFoundationWorker();
  const env = makeEnvelope({ eventType: 'guardian.foundation.ping', jurisdiction: JUR, correlationId: 'corr', idempotencyKey: 'idem', occurredAt: new Date().toISOString(), payloadReference: `evref:${evidence.evidenceId}` });
  worker.process(env);
  const replay = worker.process(env);

  return NextResponse.json({
    descriptor: guardianFoundationDescriptor(),
    sod,
    case: gcase,
    evidenceReference: { id: evidence.evidenceId, classification: evidence.classification },
    auditHash,
    workerIdempotent: replay.duplicate === true && worker.processedCount() === 1,
    note: 'SYNTHETIC foundation demonstration — no detection, no enforcement, no SafeBet IQ business data.',
  });
}
