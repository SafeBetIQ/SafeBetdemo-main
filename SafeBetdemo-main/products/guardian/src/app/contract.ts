// ─── SafeBet Guardian — App Reference Contract (ARCH-V4-C4) ───────────────────
//
// The GOVERNED interface by which OTHER Guardian modules (e.g. Payment Intelligence)
// obtain a bounded App reference — WITHOUT depending on Mobile App Intelligence's
// persistence implementation or base tables. Parallel to the Domain Reference Contract.
//
//   Owner:     Mobile App Intelligence (C3)
//   Consumers: Payment Intelligence (C4), future modules
//   Returns:   ONLY the bounded fields below. Jurisdiction-scoped.
//
// Two aligned implementations: this pure TS function (over the synthetic app fixtures)
// and the bounded DB view `guardian.app_reference`.

import { SYNTHETIC_APP_FIXTURES } from './fixtures.ts';
import { normaliseAppIdentifier } from './normalise.ts';

export type AppReferenceMatchState = 'REFERENCED' | 'APP_REFERENCE_NOT_FOUND';

export interface AppReferenceQuery { appIdentifier: string; jurisdiction: string; correlationId?: string }

export interface AppReference {
  matchState: AppReferenceMatchState;
  canonicalAppIdentifier: string;
  jurisdiction: string;
  appReferenceId: string | null;
  freshness: 'FRESH' | 'AGING' | 'STALE' | 'UNKNOWN';
  referenceStatus: 'REFERENCED' | 'NOT_FOUND';
}

export function resolveAppReference(q: AppReferenceQuery): AppReference {
  const canonical = normaliseAppIdentifier(q.appIdentifier).canonical;
  const known = Object.values(SYNTHETIC_APP_FIXTURES).find(
    (a) => a.jurisdiction === q.jurisdiction && normaliseAppIdentifier(a.appIdentifier).canonical === canonical,
  );
  if (!known) {
    return { matchState: 'APP_REFERENCE_NOT_FOUND', canonicalAppIdentifier: canonical, jurisdiction: q.jurisdiction, appReferenceId: null, freshness: 'UNKNOWN', referenceStatus: 'NOT_FOUND' };
  }
  return { matchState: 'REFERENCED', canonicalAppIdentifier: canonical, jurisdiction: q.jurisdiction, appReferenceId: null, freshness: 'FRESH', referenceStatus: 'REFERENCED' };
}
