// ─── SafeBet Guardian — Domain observation SQS worker (ARCH-V4-C2) ────────────
//
// The first REAL Guardian durable async path: SQS (guardian-domain-observation) →
// this worker Lambda → DLQ (guardian-domain-observation-dlq). It performs ONLY
// synthetic C2 processing (normalise + deterministic signals + registry comparison
// via the C1 contract). It does NO web crawling and NO DNS resolution, and it holds
// NO database credentials (it emits the structured NON-LEGAL result to CloudWatch;
// the `guardian` schema is the store of record, proven via SQL). Poison/unknown
// messages are reported as batch-item failures so SQS retries them and, past the
// redrive maxReceiveCount, moves them to the DLQ.
//
// Bundled to CJS index.handler by scripts/guardian/build-guardian-domain-worker.mjs.

import { GuardianDomainWorker, PoisonMessageError } from '../src/index.ts';

declare const __GUARDIAN_GIT_COMMIT__: string;
const GIT = (typeof __GUARDIAN_GIT_COMMIT__ !== 'undefined' ? __GUARDIAN_GIT_COMMIT__ : (process.env.GUARDIAN_GIT_COMMIT ?? 'unknown'));

type SqsRecord = { messageId: string; body: string };
type SqsEvent = { Records?: SqsRecord[] };

// One worker instance per warm container gives in-invocation idempotency across a batch.
const worker = new GuardianDomainWorker();

export const handler = async (event: SqsEvent) => {
  const failures: { itemIdentifier: string }[] = [];
  for (const rec of event?.Records ?? []) {
    try {
      const msg = JSON.parse(rec.body);
      const out = worker.process(msg);
      // Observability only — product=GUARDIAN, synthetic, NON-LEGAL. No DB write, no secret.
      console.log(JSON.stringify({
        product: 'GUARDIAN', sourceSha: GIT, event: 'guardian.domain.observed',
        jurisdiction: out.result?.jurisdiction, idempotencyKey: out.idempotencyKey, duplicate: out.duplicate,
        matchState: out.result?.registryMatchState, reviewPriority: out.result?.reviewPriority,
        reviewRequired: out.result?.reviewRequired, reasonCodes: out.result?.reasonCodes,
        isIllegalDetermination: false,
      }));
    } catch (err) {
      const poison = err instanceof PoisonMessageError;
      console.error(JSON.stringify({ product: 'GUARDIAN', event: 'guardian.domain.observe.failed', messageId: rec.messageId, poison, error: (err as Error).message }));
      // Report as a batch-item failure → SQS retries → DLQ past maxReceiveCount.
      failures.push({ itemIdentifier: rec.messageId });
    }
  }
  return { batchItemFailures: failures };
};
