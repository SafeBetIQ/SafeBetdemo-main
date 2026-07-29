// ─── Policy fact views over the enriched Digital Twin (Phase 3.6) ────────────
//
// Policies decide on facts the enterprise already holds: the twin's
// projected fields plus the Domain Intelligence enrichment. A fact view is
// a TRANSIENT, read-only lens for condition evaluation inside one pass —
// it is never returned, never stored, never handed to any consumer. It is
// NOT a second runtime object: the twin instances remain the only runtime
// model, untouched by evaluation.
//
// No field is computed here. Twin fields are exposed as-is; the
// 'intelligence' root exposes the Domain Intelligence stages as-is.

import type { CasinoDigitalTwin, TwinObject } from '../digitalTwin/index.ts';
import { intelligenceOf } from '../domainIntelligence/index.ts';

/** Fact view for one runtime object: its fields + its intelligence stages. */
export function factsFor(object: TwinObject): Record<string, unknown> {
  return {
    ...(object as unknown as Record<string, unknown>),
    intelligence: intelligenceOf(object) ?? {},
  };
}

/** Fact view for the casino subject: projected aggregates + live counts. */
export function casinoFacts(twin: CasinoDigitalTwin): Record<string, unknown> {
  const aggregates = twin.casinoAggregates();
  return {
    kind: 'casino',
    casinoId: twin.casinoId,
    ...(aggregates as unknown as Record<string, unknown>),
    openSessions: twin.openSessions().length,
    occupiedMachines: twin.occupiedMachines().length,
    playersRequiringMonitoring: twin.playersRequiringMonitoring().length,
    activeInterventions: twin.activeInterventions().length,
  };
}
