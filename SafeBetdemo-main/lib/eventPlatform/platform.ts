// ─── Enterprise Event Platform (Phase 3.2) ───────────────────────────────────
//
// The central nervous system of SafeBet IQ. Every event enters ONCE via
// ingest()/ingestBatch() and moves through the single lifecycle:
//
//   receive → validate (reject, never repair) → enrich (identity once,
//   correlation, trace, tenant, jurisdiction) → version → persist
//   (append-only casino_event_log) → distribute (Realtime on the event
//   store + transitional legacy adapter)
//
// The platform is INFRASTRUCTURE ONLY. It never calculates risk or
// behaviour, performs AI, triggers interventions, allocates machines, or
// manages sessions — those are future shared engines that will CONSUME
// events from this platform.
//
// Replay (regulator journey reconstruction) is RESERVED: the envelope
// carries replayNumber, the store is append-only and indexed by
// correlation/trace/player — replay() is deliberately not implemented yet.

import type { CasinoEventDraft, CasinoEventEnvelope } from './envelope.ts';
import { validateDraft, validateEnvelope } from './validation.ts';
import { enrichDraft } from './enrichment.ts';
import { persistEnvelopes, type EventStoreClient } from './persistence.ts';
import { getProjectionPlatform } from '../projectionPlatform/platform.ts';
import type { RpcClient } from '../playerIdentity/index.ts';
import { emit, increment } from '../observability/telemetry.ts';

export interface IngestContext {
  casinoId: string;
  /** Operator tenant. Defaults to casinoId. */
  tenantId?: string;
  jurisdiction?: string;
  /** Stable name of the emitting component, e.g. 'casino-simulator'. */
  producer: string;
  /**
   * Service-role client used for persistence, identity resolution, and the
   * transitional legacy channel. Required: nothing exists only in memory.
   */
  client: EventStoreClient & RpcClient;
}

export class EventPlatform {
  /** Ingest one event through the full lifecycle. Returns the immutable envelope. */
  async ingest(draft: CasinoEventDraft, ctx: IngestContext): Promise<CasinoEventEnvelope> {
    const [envelope] = await this.ingestBatch([draft], ctx);
    return envelope;
  }

  /**
   * Ingest a batch atomically sharing one traceId. Validation failures
   * reject the whole batch before anything is enriched or persisted.
   */
  async ingestBatch(drafts: CasinoEventDraft[], ctx: IngestContext): Promise<CasinoEventEnvelope[]> {
    if (drafts.length === 0) return [];
    if (!ctx.client) throw new Error('event platform requires a persistence client — events must never exist only in memory');

    // 1. Validate every draft first — reject, never repair.
    for (const draft of drafts) validateDraft(draft, ctx.casinoId);

    // 2. Enrich into immutable envelopes (identity resolved exactly once,
    //    shared trace, per-journey correlation) + 3. version stamp.
    const traceId = crypto.randomUUID();
    const receivedAt = new Date().toISOString();
    const envelopes: CasinoEventEnvelope[] = [];
    for (const draft of drafts) {
      envelopes.push(await enrichDraft(draft, {
        casinoId: ctx.casinoId,
        tenantId: ctx.tenantId,
        jurisdiction: ctx.jurisdiction,
        producer: ctx.producer,
        traceId,
        identityClient: ctx.client,
        receivedAt,
      }));
    }

    // 4. Final integrity check of the exact envelopes to be persisted.
    for (const envelope of envelopes) validateEnvelope(envelope);

    // 5. Persist (append-only, idempotent — Phase 4.3). Distribution IS the
    //    insert: Supabase Realtime on casino_event_log publishes the persisted
    //    envelope. Retries reusing an idempotency key de-duplicate here and
    //    are not returned, so each event is projected at most once.
    const persisted = await persistEnvelopes(ctx.client, envelopes);
    const deduplicated = envelopes.length - persisted.length;

    // 6. Only the newly-persisted envelopes continue into the Enterprise
    //    Projection Platform (Phase 3.3) — the only producer of runtime state.
    if (persisted.length > 0) {
      await getProjectionPlatform().applyEnvelopes(ctx.client, persisted);
    }

    // Observability (WS5): counts + timing only — no PII, no payloads.
    increment('ingest.events', envelopes.length);
    increment('ingest.persisted', persisted.length);
    if (deduplicated > 0) increment('ingest.deduplicated', deduplicated);
    emit('info', 'eventPlatform.ingest', 'batch_ingested', {
      casinoId: ctx.casinoId, producer: ctx.producer, traceId,
      received: envelopes.length, persisted: persisted.length,
      deduplicated, duration_ms: Date.now() - Date.parse(receivedAt),
    });

    // Callers receive the full enriched set; de-duplication is transparent.
    return envelopes;
  }

  /**
   * RESERVED (design only): regulator-grade replay of a player journey from
   * the immutable log, re-emitting envelopes with incremented replayNumber.
   * Implemented alongside the Projection Engine.
   */
  replay(): never {
    throw new Error('event replay is reserved for the Projection Engine phase — the append-only store and replayNumber field already support it');
  }
}

let defaultPlatform: EventPlatform | undefined;

/** Application-wide Enterprise Event Platform instance. */
export function getEventPlatform(): EventPlatform {
  if (!defaultPlatform) defaultPlatform = new EventPlatform();
  return defaultPlatform;
}
