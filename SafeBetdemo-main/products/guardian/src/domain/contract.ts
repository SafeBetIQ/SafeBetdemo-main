// ─── SafeBet Guardian — Domain Reference Contract (ARCH-V4-C3.1) ──────────────
//
// The GOVERNED interface by which OTHER Guardian modules (e.g. Mobile App
// Intelligence) obtain a bounded Domain reference — WITHOUT depending on Domain
// Intelligence's persistence implementation or its base tables.
//
//   Owner:     Domain Intelligence (C2)
//   Consumers: Mobile App Intelligence (C3), future modules
//   Returns:   ONLY the bounded fields below — never a full domain row, never a
//              query capability. Jurisdiction-scoped.
//
// Two aligned implementations of the SAME contract:
//   • this pure TS function (over the synthetic domain fixtures) — used at analysis
//     time by consumers;
//   • the bounded DB view `guardian.domain_reference` — used at persistence time by a
//     consumer worker (jurisdiction-filtered by the `app.guardian.jurisdiction` GUC).
// Neither exposes `guardian.domain_subject` directly to the consumer.

import { SYNTHETIC_DOMAIN_FIXTURES } from './fixtures.ts';
import { normaliseHostname } from './normalise.ts';

export type DomainReferenceMatchState = 'REFERENCED' | 'DOMAIN_REFERENCE_NOT_FOUND';

export interface DomainReferenceQuery { hostname: string; jurisdiction: string; correlationId?: string }

export interface DomainReference {
  matchState: DomainReferenceMatchState;
  canonicalHostname: string;
  jurisdiction: string;
  domainReferenceId: string | null;   // opaque Domain-owned reference id (or null)
  freshness: 'FRESH' | 'AGING' | 'STALE' | 'UNKNOWN';
  referenceStatus: 'REFERENCED' | 'NOT_FOUND';
}

/** Resolve a bounded Domain reference for one hostname in one jurisdiction. Jurisdiction-
 *  scoped: a hostname known only in another jurisdiction returns DOMAIN_REFERENCE_NOT_FOUND
 *  (never cross-jurisdiction data). NOT_FOUND is a bounded no-match — it is NOT illegal. */
export function resolveDomainReference(q: DomainReferenceQuery): DomainReference {
  const canonical = normaliseHostname(q.hostname).canonical;
  const known = Object.values(SYNTHETIC_DOMAIN_FIXTURES).find(
    (d) => d.jurisdiction === q.jurisdiction && normaliseHostname(d.hostname).canonical === canonical,
  );
  if (!known) {
    return { matchState: 'DOMAIN_REFERENCE_NOT_FOUND', canonicalHostname: canonical, jurisdiction: q.jurisdiction, domainReferenceId: null, freshness: 'UNKNOWN', referenceStatus: 'NOT_FOUND' };
  }
  return { matchState: 'REFERENCED', canonicalHostname: canonical, jurisdiction: q.jurisdiction, domainReferenceId: null, freshness: 'FRESH', referenceStatus: 'REFERENCED' };
}
