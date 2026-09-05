// ─── SafeBet Guardian — standalone service entry (ARCH-V4-C0) ─────────────────
//
// Independently runnable Guardian foundation entry point (Option C runtime
// strategy). Run with:  npx tsx products/guardian/bin/guardian-service.ts
//
// It exercises the full synthetic foundation flow — health, version, a synthetic
// principal, SoD, a case, an evidence reference, an audit event, and the worker —
// WITHOUT importing any SafeBet IQ business module and WITHOUT requiring the
// SafeBet IQ Next.js runtime. This is the runtime-independence demonstration.

import { createHash } from 'node:crypto';
import {
  guardianFoundationDescriptor, makeGuardianPrincipal, evaluateSod, makeCase,
  makeEvidenceReference, makeEnvelope, GuardianFoundationWorker, hashGuardianEvent,
  guardianChainScope, GUARDIAN_FOUNDATION_QUEUE,
} from '../src/index.ts';

const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const JUR = 'ZA-GP';

const investigator = makeGuardianPrincipal({ principalId: 'syn-inv-1', jurisdiction: JUR, role: 'INVESTIGATOR', authAssurance: 'SYNTHETIC_TEST', purpose: 'demo', isSynthetic: true });
const reviewer = makeGuardianPrincipal({ principalId: 'syn-leg-1', jurisdiction: JUR, role: 'LEGAL_REVIEWER', authAssurance: 'SYNTHETIC_TEST', purpose: 'demo', isSynthetic: true });
const officer = makeGuardianPrincipal({ principalId: 'syn-auth-1', jurisdiction: JUR, role: 'AUTHORISING_OFFICER', authAssurance: 'SYNTHETIC_TEST', purpose: 'demo', isSynthetic: true });

const sod = evaluateSod({ caseId: 'syn-case-1', investigator, legalReviewer: reviewer, authorisingOfficer: officer });
const gcase = makeCase({ caseId: 'syn-case-1', jurisdiction: JUR, createdAt: new Date().toISOString(), actorPrincipalId: investigator.principalId, correlationId: 'corr-1' });
const evidence = makeEvidenceReference({ evidenceId: 'syn-ev-1', jurisdiction: JUR, caseReference: gcase.caseId, classification: 'RESTRICTED', integrityHash: sha256('synthetic-evidence'), retentionUntil: '2030-01-01T00:00:00Z', accessPurpose: 'demo', createdAt: new Date().toISOString() });
const auditHash = hashGuardianEvent({ product: 'GUARDIAN', actorPrincipalId: investigator.principalId, actorRole: investigator.role, jurisdiction: JUR, eventType: 'guardian.case.opened', correlationId: 'corr-1', occurredAt: new Date().toISOString(), caseReference: gcase.caseId }, 1, '0'.repeat(64), 'evt-1', sha256);

const worker = new GuardianFoundationWorker();
const env = makeEnvelope({ eventType: 'guardian.foundation.ping', jurisdiction: JUR, correlationId: 'corr-1', idempotencyKey: 'idem-1', occurredAt: new Date().toISOString(), payloadReference: `evref:${evidence.evidenceId}` });
const first = worker.process(env);
const second = worker.process(env); // idempotent replay

console.log(JSON.stringify({
  descriptor: guardianFoundationDescriptor(),
  chainScope: guardianChainScope(JUR),
  sod,
  case: gcase,
  evidence: { id: evidence.evidenceId, classification: evidence.classification, integrityHash: evidence.integrityHash },
  auditHash,
  queue: GUARDIAN_FOUNDATION_QUEUE,
  worker: { first: { duplicate: first.duplicate }, replay: { duplicate: second.duplicate }, processed: worker.processedCount() },
}, null, 2));

if (!sod.ok || first.duplicate || !second.duplicate || worker.processedCount() !== 1) {
  console.error('guardian-service: foundation self-check FAILED');
  process.exit(1);
}
console.error('guardian-service: foundation self-check PASS (standalone, no SafeBet IQ runtime)');
