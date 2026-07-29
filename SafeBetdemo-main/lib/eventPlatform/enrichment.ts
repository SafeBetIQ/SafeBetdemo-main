// ─── Event Enrichment (Phase 3.2) ────────────────────────────────────────────
//
// Enriches a validated draft into the complete immutable envelope, ONCE:
//
//   • Identity — if the producer supplied a raw casino reference, it is
//     resolved here through the existing identity flow
//     (IdentityResolutionService → Identity Policy → Identity Provider).
//     No later component ever repeats this.
//   • Tenant / jurisdiction stamping
//   • Correlation (defaults to the session journey) and trace ids
//   • receivedAt / processedAt / replayNumber / schemaVersion
//
// Infrastructure only: no business interpretation of the payload.

import {
  ENVELOPE_SCHEMA_VERSION,
  freezeEnvelope,
  type CasinoEventDraft,
  type CasinoEventEnvelope,
} from './envelope.ts';
import { getIdentityService, type RpcClient } from '../playerIdentity/index.ts';

export interface EnrichmentContext {
  casinoId: string;
  /** Operator tenant. Defaults to casinoId (one tenant per casino today). */
  tenantId?: string;
  jurisdiction?: string;
  /** Stable name of the emitting component, e.g. 'casino-simulator'. */
  producer: string;
  /** Shared by all events of one ingest call. */
  traceId: string;
  /** Identity persistence client (service role). */
  identityClient?: RpcClient;
  receivedAt: string;
}

export const DEFAULT_JURISDICTION = 'ZA';

/** Build the complete immutable envelope from a validated draft. */
export async function enrichDraft(
  draft: CasinoEventDraft,
  ctx: EnrichmentContext,
): Promise<CasinoEventEnvelope> {
  // Identity resolution — exactly once, through Service → Policy → Provider.
  const safeBetPlayerId = draft.safeBetPlayerId
    ?? await getIdentityService().resolveIdentity(draft.casinoPlayerRef as string, {
      casinoId: ctx.casinoId,
      jurisdiction: ctx.jurisdiction,
      client: ctx.identityClient,
    });

  const sessionId = draft.sessionId ?? null;
  const eventId = crypto.randomUUID();

  return freezeEnvelope({
    eventId,
    correlationId: draft.correlationId ?? sessionId ?? crypto.randomUUID(),
    traceId: ctx.traceId,
    tenantId: ctx.tenantId ?? ctx.casinoId,
    casinoId: ctx.casinoId,
    jurisdiction: ctx.jurisdiction ?? DEFAULT_JURISDICTION,
    safeBetPlayerId,
    sessionId,
    machineId: draft.machineId ?? null,
    producer: ctx.producer,
    schemaVersion: ENVELOPE_SCHEMA_VERSION,
    eventType: draft.eventType,
    occurredAt: draft.occurredAt,
    receivedAt: ctx.receivedAt,
    processedAt: new Date().toISOString(),
    replayNumber: 0,
    // Producer-stable idempotency key; absent → eventId (every event distinct,
    // pre-4.3 behaviour). Retries reusing the key de-duplicate at the store.
    idempotencyKey: draft.idempotencyKey ?? eventId,
    payload: draft.payload ?? {},
  });
}
