// ─── SafeBet Guardian — evidence registration engine (ARCH-V4-C7) ─────────────
// SYNTHETIC evidence fixture → hash → classify → build custody chain (REGISTERED →
// HASH_VERIFIED) → structured NON-LEGAL, NON-ENFORCEMENT registration result.
// Source references come from governed C1–C6 references; C7 stores references, not copies.

import { hashEvidenceContent, appendCustodyEvent, verifyEvidenceContent } from './custody.ts';
import type { EvidenceFixture, EvidenceRegistrationResult, CustodyEvent } from './types.ts';

/** A derived artefact (text extraction, thumbnail, …) that references its PARENT and never
 *  masquerades as the original. Carries its own hash + a DERIVED custody event. */
export interface DerivedEvidence {
  derivedEvidenceId: string;
  parentEvidenceId: string;
  derivationMethod: string;
  contentHash: string;
  jurisdiction: string;
  custodyEvent: CustodyEvent;
  isOriginal: false;
}
export function deriveEvidence(parent: EvidenceRegistrationResult, inp: { derivedEvidenceId: string; derivationMethod: string; syntheticBody: string; actor?: string; now?: Date }): DerivedEvidence {
  const iso = (inp.now ?? new Date()).toISOString();
  const custodyEvent = appendCustodyEvent([], { evidenceId: inp.derivedEvidenceId, eventType: 'DERIVED', actor: inp.actor ?? 'guardian-evidence-worker', actorRole: 'SYSTEM_SERVICE', jurisdiction: parent.jurisdiction, occurredAt: iso, reason: `derived from ${parent.evidenceId} via ${inp.derivationMethod}` });
  return { derivedEvidenceId: inp.derivedEvidenceId, parentEvidenceId: parent.evidenceId, derivationMethod: inp.derivationMethod, contentHash: hashEvidenceContent(inp.syntheticBody), jurisdiction: parent.jurisdiction, custodyEvent, isOriginal: false };
}

export function registerEvidence(
  fx: EvidenceFixture,
  opts: { evidenceId: string; now?: Date; actor?: string },
): EvidenceRegistrationResult {
  const now = opts.now ?? new Date();
  const iso = now.toISOString();
  const actor = opts.actor ?? 'guardian-evidence-worker';
  const contentHash = hashEvidenceContent(fx.syntheticBody);
  const storageReference = `synthetic://evidence/${fx.jurisdiction}/${opts.evidenceId}`;

  // Custody chain: REGISTERED → HASH_VERIFIED → STORED (append-only, hash-linked).
  const chain: CustodyEvent[] = [];
  chain.push(appendCustodyEvent(chain, { evidenceId: opts.evidenceId, eventType: 'REGISTERED', actor, actorRole: 'SYSTEM_SERVICE', jurisdiction: fx.jurisdiction, occurredAt: iso, reason: 'evidence registered' }));
  const integrityStatus = verifyEvidenceContent(contentHash, fx.syntheticBody);
  chain.push(appendCustodyEvent(chain, { evidenceId: opts.evidenceId, eventType: integrityStatus === 'VERIFIED' ? 'HASH_VERIFIED' : 'INTEGRITY_FAILED', actor, actorRole: 'SYSTEM_SERVICE', jurisdiction: fx.jurisdiction, occurredAt: iso, reason: 'content hash verified' }));
  chain.push(appendCustodyEvent(chain, { evidenceId: opts.evidenceId, eventType: 'STORED', actor, actorRole: 'SYSTEM_SERVICE', jurisdiction: fx.jurisdiction, occurredAt: iso, reason: 'stored/referenced' }));

  return {
    product: 'GUARDIAN', jurisdiction: fx.jurisdiction, evidenceId: opts.evidenceId, evidenceReference: fx.evidenceReference,
    evidenceType: fx.evidenceType, sourceDomain: fx.sourceDomain, sourceReference: fx.sourceReference, classification: fx.classification,
    contentHash, hashAlgorithm: 'SHA-256', sizeBytes: fx.sizeBytes, mediaType: fx.mediaType, storageReference, integrityStatus,
    custodyChain: chain, provenance: { sourceReference: fx.sourceReference, captureActor: fx.captureActor, captureMethod: fx.captureMethod },
    isLegalDetermination: false, isEnforcementAuthorised: false,
    note: 'Synthetic Guardian evidence registration — provenance + integrity only. NOT a legal finding and NOT an enforcement authorisation. Hash verified != fact legally proven.',
  };
}
